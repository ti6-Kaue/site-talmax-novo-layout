/**
 * Centraliza a autenticacao do painel administrativo.
 * Aqui ficam login, logout, leitura do cookie de sessao e permissoes do admin.
 */
const crypto = require('crypto');
const db = require('../../config/database');
const {
  ADMIN_LOGIN_RATE_LIMIT_MESSAGE,
  clearAdminLoginRateLimitByUsername,
  getAdminLoginRateLimitStateByUsername,
  getRetryAfterSecondsFromResetTime,
  normalizeAdminUsername,
  registerFailedAdminLoginAttemptByIdentifiers
} = require('../seguranca/adminLoginRateLimit');
const { createHttpError, wrapError } = require('../utils/errorHandling');
const { validateWithSchema } = require('../validation/requestValidation');
const {
  ADMIN_ROLE_MASTER,
  ADMIN_ROLE_EDITOR,
  createAdminUserSchema,
  updateAdminUserSchema
} = require('../validation/adminUserSchemas');
const {
  hashAdminPassword,
  safeEqual,
  verifyAdminPassword
} = require('./adminPassword');

const ADMIN_SESSION_COOKIE = 'talmax-admin-session';
const ADMIN_COOKIE_PATH = '/api';
const LEGACY_ADMIN_COOKIE_PATH = '/';
const ADMIN_USER_FREE_FLAG_VALUE = 1;
const ADMIN_USER_TEMP_BLOCKED_FLAG_VALUE = 2;
const ADMIN_LOGIN_INVALID_CREDENTIALS_MESSAGE = 'Credenciais invalidas.';

if (!process.env.ADMIN_JWT_SECRET) {
  throw new Error('A variavel ADMIN_JWT_SECRET nao foi definida no ambiente.');
}

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const ADMIN_JWT_EXPIRES_IN_SECONDS = Number(process.env.ADMIN_JWT_EXPIRES_IN_SECONDS || 60 * 60 * 8);
const isProduction = process.env.NODE_ENV === 'production';
const normalizeAdminCookieSameSite = (value) => {
  const normalizedValue = typeof value === 'string' ? value.trim().toLowerCase() : '';

  if (['strict', 'lax', 'none'].includes(normalizedValue)) {
    return normalizedValue;
  }

  return 'lax';
};
const ADMIN_COOKIE_SAME_SITE = normalizeAdminCookieSameSite(process.env.ADMIN_COOKIE_SAME_SITE);
const DUMMY_ADMIN_PASSWORD_HASH = hashAdminPassword(`talmax-dummy-${crypto.randomUUID()}`);

let usersTableHasBloqUserColumn = null;
let usersTableHasEmailColumn = null;
let usersTableHasRoleColumn = null;
let usersTableHasSessionVersionColumn = null;

const normalizeAdminRole = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === ADMIN_ROLE_MASTER) {
    return ADMIN_ROLE_MASTER;
  }

  if (normalizedValue === ADMIN_ROLE_EDITOR) {
    return ADMIN_ROLE_EDITOR;
  }

  return null;
};

const hasAdminPanelAccess = (adminUser) => Boolean(normalizeAdminRole(adminUser?.role));
const normalizeAdminSessionVersion = (value) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
};

const parseCookies = (req) => {
  const cookieHeader = req.headers.cookie || '';

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      cookies[name] = decodeURIComponent(value);
      return cookies;
    }, {});
};

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url');

const base64UrlDecode = (value) => Buffer.from(value, 'base64url').toString('utf8');

const createJwtToken = (payload) => {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: nowInSeconds,
    exp: nowInSeconds + ADMIN_JWT_EXPIRES_IN_SECONDS
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', ADMIN_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const verifyJwtToken = (token) => {
  if (!token) {
    return null;
  }

  const parts = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', ADMIN_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (!payload.exp || payload.exp <= nowInSeconds) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
};

const getAdminSessionToken = (req) => {
  const cookies = parseCookies(req);
  return cookies[ADMIN_SESSION_COOKIE] || null;
};

const getAdminCookieOptions = (cookiePath = ADMIN_COOKIE_PATH) => ({
  httpOnly: true,
  sameSite: ADMIN_COOKIE_SAME_SITE,
  secure: isProduction || ADMIN_COOKIE_SAME_SITE === 'none',
  path: cookiePath,
  maxAge: ADMIN_JWT_EXPIRES_IN_SECONDS * 1000
});

const clearAdminSessionCookies = (res) => {
  res.clearCookie(ADMIN_SESSION_COOKIE, getAdminCookieOptions(ADMIN_COOKIE_PATH));

  if (LEGACY_ADMIN_COOKIE_PATH !== ADMIN_COOKIE_PATH) {
    res.clearCookie(ADMIN_SESSION_COOKIE, getAdminCookieOptions(LEGACY_ADMIN_COOKIE_PATH));
  }
};

const usersTableSupportsBloqUser = async () => {
  if (typeof usersTableHasBloqUserColumn === 'boolean') {
    return usersTableHasBloqUserColumn;
  }

  const [columns] = await db.query("SHOW COLUMNS FROM users LIKE 'bloq_user'");
  usersTableHasBloqUserColumn = columns.length > 0;
  return usersTableHasBloqUserColumn;
};

const usersTableSupportsEmail = async () => {
  if (typeof usersTableHasEmailColumn === 'boolean') {
    return usersTableHasEmailColumn;
  }

  const [columns] = await db.query("SHOW COLUMNS FROM users LIKE 'email'");
  usersTableHasEmailColumn = columns.length > 0;
  return usersTableHasEmailColumn;
};

const usersTableSupportsRole = async () => {
  if (typeof usersTableHasRoleColumn === 'boolean') {
    return usersTableHasRoleColumn;
  }

  const [columns] = await db.query("SHOW COLUMNS FROM users LIKE 'role'");
  usersTableHasRoleColumn = columns.length > 0;
  return usersTableHasRoleColumn;
};

const usersTableSupportsSessionVersion = async () => {
  if (typeof usersTableHasSessionVersionColumn === 'boolean') {
    return usersTableHasSessionVersionColumn;
  }

  const [columns] = await db.query("SHOW COLUMNS FROM users LIKE 'session_version'");
  usersTableHasSessionVersionColumn = columns.length > 0;
  return usersTableHasSessionVersionColumn;
};

const assertAdminUserManagementIsAvailable = async () => {
  const [supportsEmail, supportsRole] = await Promise.all([
    usersTableSupportsEmail(),
    usersTableSupportsRole()
  ]);

  if (supportsEmail && supportsRole) {
    return;
  }

  throw createHttpError(503, 'A gestao de usuarios do painel exige as colunas email e role na tabela users. Execute a migration add_admin_user_identity.js antes de usar esta tela.', {
    code: 'ADMIN_USER_MANAGEMENT_COLUMNS_MISSING',
    expose: true
  });
};

const getAdminSelectClause = async ({ includePassword = false } = {}) => {
  const [supportsBloqUser, supportsEmail, supportsRole, supportsSessionVersion] = await Promise.all([
    usersTableSupportsBloqUser(),
    usersTableSupportsEmail(),
    usersTableSupportsRole(),
    usersTableSupportsSessionVersion()
  ]);

  const fields = [
    'id',
    'username',
    'full_name'
  ];

  if (includePassword) {
    fields.push('password');
  }

  fields.push(
    supportsEmail ? 'email' : 'NULL AS email',
    supportsRole ? 'role' : 'NULL AS role',
    supportsBloqUser ? 'bloq_user' : `${ADMIN_USER_FREE_FLAG_VALUE} AS bloq_user`,
    supportsSessionVersion ? 'session_version' : '0 AS session_version',
    'created_at'
  );

  return fields.join(', ');
};

const serializeAdminUser = (adminUser) => {
  if (!adminUser) {
    return null;
  }

  return {
    id: adminUser.id,
    username: adminUser.username,
    full_name: adminUser.full_name,
    email: adminUser.email || null,
    role: normalizeAdminRole(adminUser.role),
    bloq_user: Number(adminUser.bloq_user || ADMIN_USER_FREE_FLAG_VALUE),
    created_at: adminUser.created_at || null
  };
};

const buildAdminSessionPayload = (adminUser, overrides = {}) => ({
  ...serializeAdminUser(adminUser),
  session_version: normalizeAdminSessionVersion(adminUser?.session_version),
  ...overrides
});

const adminSessionVersionMatches = (session, adminUser) => (
  normalizeAdminSessionVersion(session?.session_version) === normalizeAdminSessionVersion(adminUser?.session_version)
);

const getAdminUserByIdentifier = async (identifier) => {
  const normalizedIdentifier = normalizeAdminUsername(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  const selectClause = await getAdminSelectClause({ includePassword: true });
  const supportsEmail = await usersTableSupportsEmail();
  const lookupQuery = supportsEmail
    ? `SELECT ${selectClause} FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1`
    : `SELECT ${selectClause} FROM users WHERE LOWER(username) = ? LIMIT 1`;
  const params = supportsEmail
    ? [normalizedIdentifier, normalizedIdentifier]
    : [normalizedIdentifier];
  const [users] = await db.query(lookupQuery, params);

  return users[0] || null;
};

const getAdminUserById = async (adminUserId, options = {}) => {
  const numericId = Number.parseInt(adminUserId, 10);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  const selectClause = await getAdminSelectClause({ includePassword: Boolean(options.includePassword) });
  const [users] = await db.query(`SELECT ${selectClause} FROM users WHERE id = ? LIMIT 1`, [numericId]);
  return users[0] || null;
};

const getAdminUserByUsername = async (username) => {
  const normalizedUsername = normalizeAdminUsername(username);

  if (!normalizedUsername) {
    return null;
  }

  const selectClause = await getAdminSelectClause({ includePassword: true });
  const [users] = await db.query(
    `SELECT ${selectClause} FROM users WHERE LOWER(username) = ? LIMIT 1`,
    [normalizedUsername]
  );

  return users[0] || null;
};

const getAdminUserByEmail = async (email) => {
  const normalizedEmail = normalizeAdminUsername(email);

  if (!normalizedEmail || !await usersTableSupportsEmail()) {
    return null;
  }

  const selectClause = await getAdminSelectClause({ includePassword: true });
  const [users] = await db.query(
    `SELECT ${selectClause} FROM users WHERE LOWER(email) = ? LIMIT 1`,
    [normalizedEmail]
  );

  return users[0] || null;
};

const setAdminBlockState = async (adminUserId, value) => {
  if (!await usersTableSupportsBloqUser()) {
    const error = new Error('A coluna bloq_user nao existe na tabela users. Execute a migration antes de usar o desbloqueio manual.');
    error.code = 'BLOQ_USER_COLUMN_MISSING';
    throw error;
  }

  await db.query(
    'UPDATE users SET bloq_user = ? WHERE id = ? LIMIT 1',
    [value, adminUserId]
  );
};

const incrementAdminSessionVersion = async (adminUserId) => {
  if (!await usersTableSupportsSessionVersion()) {
    return false;
  }

  await db.query(
    'UPDATE users SET session_version = COALESCE(session_version, 0) + 1 WHERE id = ? LIMIT 1',
    [adminUserId]
  );

  return true;
};

const clearRateLimitKeysForAdminUser = async (identifiers = []) => {
  const normalizedIdentifiers = [];

  identifiers.forEach((value) => {
    const normalizedValue = normalizeAdminUsername(value);

    if (normalizedValue && !normalizedIdentifiers.includes(normalizedValue)) {
      normalizedIdentifiers.push(normalizedValue);
    }
  });

  const tasks = normalizedIdentifiers
    .map((value) => clearAdminLoginRateLimitByUsername(value).catch(() => false));

  await Promise.all(tasks);
};

const getRateLimitResetTimeForAdminUser = async (adminUser, attemptedIdentifier) => {
  const identifiers = [attemptedIdentifier, adminUser?.username, adminUser?.email]
    .map((value) => normalizeAdminUsername(value))
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);

  if (identifiers.length === 0) {
    return null;
  }

  const states = await Promise.all(
    identifiers.map((identifier) => getAdminLoginRateLimitStateByUsername(identifier))
  );

  return states.reduce((latestResetTime, state) => {
    const resetTime = state?.resetTime instanceof Date ? state.resetTime : null;

    if (!resetTime || resetTime.getTime() <= Date.now()) {
      return latestResetTime;
    }

    if (!latestResetTime || resetTime.getTime() > latestResetTime.getTime()) {
      return resetTime;
    }

    return latestResetTime;
  }, null);
};

const ensureAdminUserIsNotTemporarilyBlocked = async (adminUser, res, attemptedIdentifier) => {
  if (!adminUser) {
    return true;
  }

  const resetTime = await getRateLimitResetTimeForAdminUser(adminUser, attemptedIdentifier);

  if (!resetTime || resetTime.getTime() <= Date.now()) {
    if (Number(adminUser.bloq_user || ADMIN_USER_FREE_FLAG_VALUE) === ADMIN_USER_TEMP_BLOCKED_FLAG_VALUE) {
      await setAdminBlockState(adminUser.id, ADMIN_USER_FREE_FLAG_VALUE).catch(() => null);
      adminUser.bloq_user = ADMIN_USER_FREE_FLAG_VALUE;
    }

    return true;
  }

  if (Number(adminUser.bloq_user || ADMIN_USER_FREE_FLAG_VALUE) !== ADMIN_USER_TEMP_BLOCKED_FLAG_VALUE) {
    await setAdminBlockState(adminUser.id, ADMIN_USER_TEMP_BLOCKED_FLAG_VALUE).catch(() => null);
    adminUser.bloq_user = ADMIN_USER_TEMP_BLOCKED_FLAG_VALUE;
  }

  res.status(429).json({
    error: ADMIN_LOGIN_RATE_LIMIT_MESSAGE,
    retry_after_seconds: getRetryAfterSecondsFromResetTime(resetTime)
  });

  return false;
};

const getValidatedAdminSession = (req, res) => {
  const token = getAdminSessionToken(req);
  const session = verifyJwtToken(token);

  if (!session) {
    clearAdminSessionCookies(res);
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return null;
  }

  req.adminSession = session;
  return session;
};

const rejectAdminSession = (res, statusCode = 403, message = 'Usuário sem acesso ao painel.') => {
  clearAdminSessionCookies(res);
  return res.status(statusCode).json({ error: message });
};

const getAuthenticatedAdminSession = async (req) => {
  const token = getAdminSessionToken(req);
  const session = verifyJwtToken(token);

  if (!session) {
    return null;
  }

  const currentAdminUser = await getAdminUserById(session.id);

  if (!currentAdminUser || !hasAdminPanelAccess(currentAdminUser)) {
    return null;
  }

  if (!adminSessionVersionMatches(session, currentAdminUser)) {
    return null;
  }

  const authenticatedSession = {
    ...session,
    ...serializeAdminUser(currentAdminUser),
    role: normalizeAdminRole(currentAdminUser.role)
  };

  req.adminSession = authenticatedSession;
  return authenticatedSession;
};

const requireAdminSession = async (req, res, next) => {
  try {
    const session = getValidatedAdminSession(req, res);

    if (!session) {
      return undefined;
    }

    const currentAdminUser = await getAdminUserById(session.id);

    if (!currentAdminUser || !hasAdminPanelAccess(currentAdminUser)) {
      return rejectAdminSession(res);
    }

    if (!adminSessionVersionMatches(session, currentAdminUser)) {
      return rejectAdminSession(res, 401, 'Sessão inválida ou expirada.');
    }

    req.adminSession = {
      ...session,
      ...serializeAdminUser(currentAdminUser),
      role: normalizeAdminRole(currentAdminUser.role)
    };

    return next();
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao validar sessao do admin.' }));
  }
};

const requireMasterAdminSession = async (req, res, next) => {
  try {
    const session = getValidatedAdminSession(req, res);

    if (!session) {
      return undefined;
    }

    const currentAdminUser = await getAdminUserById(session.id);
    const effectiveRole = hasAdminPanelAccess(currentAdminUser)
      ? normalizeAdminRole(currentAdminUser.role)
      : null;

    if (!currentAdminUser || !adminSessionVersionMatches(session, currentAdminUser)) {
      return rejectAdminSession(res, 401, 'Sessão inválida ou expirada.');
    }

    if (effectiveRole !== ADMIN_ROLE_MASTER) {
      return rejectAdminSession(res, 403, 'Apenas o admin master pode gerenciar acessos do painel.');
    }

    req.adminSession = {
      ...session,
      ...serializeAdminUser(currentAdminUser),
      role: effectiveRole
    };

    return next();
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao validar permissão do admin.' }));
  }
};

const loginAdmin = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Informe usuário ou e-mail e senha.' });
    }

    const adminUser = await getAdminUserByIdentifier(username);

    if (!adminUser || !hasAdminPanelAccess(adminUser)) {
      verifyAdminPassword(password, DUMMY_ADMIN_PASSWORD_HASH);
      const failedAttempt = await registerFailedAdminLoginAttemptByIdentifiers([username]);

      if (failedAttempt.isBlocked && failedAttempt.resetTime) {
        return res.status(429).json({
          error: ADMIN_LOGIN_RATE_LIMIT_MESSAGE,
          retry_after_seconds: getRetryAfterSecondsFromResetTime(failedAttempt.resetTime)
        });
      }

      return res.status(401).json({ error: ADMIN_LOGIN_INVALID_CREDENTIALS_MESSAGE });
    }

    const canContinueLogin = await ensureAdminUserIsNotTemporarilyBlocked(adminUser, res, username);

    if (!canContinueLogin) {
      return undefined;
    }

    if (!verifyAdminPassword(password, adminUser.password)) {
      const failedAttempt = await registerFailedAdminLoginAttemptByIdentifiers([
        username,
        adminUser.username,
        adminUser.email
      ]);

      if (failedAttempt.isBlocked && failedAttempt.resetTime) {
        await setAdminBlockState(adminUser.id, ADMIN_USER_TEMP_BLOCKED_FLAG_VALUE).catch(() => null);
        adminUser.bloq_user = ADMIN_USER_TEMP_BLOCKED_FLAG_VALUE;

        return res.status(429).json({
          error: ADMIN_LOGIN_RATE_LIMIT_MESSAGE,
          retry_after_seconds: getRetryAfterSecondsFromResetTime(failedAttempt.resetTime)
        });
      }

      return res.status(401).json({ error: ADMIN_LOGIN_INVALID_CREDENTIALS_MESSAGE });
    }

    await Promise.all([
      clearRateLimitKeysForAdminUser([username, adminUser.username, adminUser.email]),
      setAdminBlockState(adminUser.id, ADMIN_USER_FREE_FLAG_VALUE).catch(() => null)
    ]);

    const sessionPayload = buildAdminSessionPayload(adminUser, {
      created_at: new Date().toISOString()
    });
    const token = createJwtToken(sessionPayload);

    clearAdminSessionCookies(res);
    res.cookie(ADMIN_SESSION_COOKIE, token, getAdminCookieOptions());

    return res.json({
      user: {
        ...serializeAdminUser(adminUser),
        created_at: sessionPayload.created_at
      }
    });
  } catch (err) {
    return next(wrapError(err, { publicMessage: 'Erro ao processar login do admin.' }));
  }
};

const unlockAdminLoginByUser = async (req, res, next) => {
  try {
    const { username } = req.body || {};

    if (!normalizeAdminUsername(username)) {
      return res.status(400).json({ error: 'Informe o usuário ou e-mail que deve ser liberado.' });
    }

    const adminUser = await getAdminUserByIdentifier(username);

    if (!adminUser || !hasAdminPanelAccess(adminUser)) {
      return res.status(404).json({ error: 'Usuário admin não encontrado.' });
    }

    await setAdminBlockState(adminUser.id, ADMIN_USER_FREE_FLAG_VALUE);
    await clearRateLimitKeysForAdminUser([username, adminUser.username, adminUser.email]);

    return res.json({
      message: 'Usuário desbloqueado com sucesso. Oriente a pessoa a recarregar a página e tentar de novo.',
      user: serializeAdminUser({
        ...adminUser,
        bloq_user: ADMIN_USER_FREE_FLAG_VALUE
      })
    });
  } catch (error) {
    if (error.code === 'BLOQ_USER_COLUMN_MISSING') {
      return next(createHttpError(503, error.message, {
        code: error.code,
        expose: true,
        cause: error
      }));
    }

    return next(wrapError(error, { publicMessage: 'Erro ao desbloquear login do admin.' }));
  }
};

const getAdminSession = async (req, res, next) => {
  try {
    const currentAdminUser = await getAdminUserById(req.adminSession?.id);

    if (!currentAdminUser) {
      return rejectAdminSession(res);
    }

    if (!hasAdminPanelAccess(currentAdminUser)) {
      return rejectAdminSession(res);
    }

    return res.json({
      user: {
        ...req.adminSession,
        ...serializeAdminUser(currentAdminUser)
      }
    });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao consultar a sessao do admin.' }));
  }
};

const listAdminUsers = async (_req, res, next) => {
  try {
    await assertAdminUserManagementIsAvailable();

    const selectClause = await getAdminSelectClause();
    const [users] = await db.query(`
      SELECT ${selectClause}
      FROM users
      ORDER BY
        CASE WHEN LOWER(role) = ? THEN 0 ELSE 1 END,
        COALESCE(NULLIF(full_name, ''), username) ASC,
        id ASC
    `, [ADMIN_ROLE_MASTER]);

    return res.json({
      users: users.map(serializeAdminUser)
    });
  } catch (error) {
    if (error.code === 'ADMIN_USER_MANAGEMENT_COLUMNS_MISSING') {
      return next(error);
    }

    return next(wrapError(error, { publicMessage: 'Erro ao listar usuários do painel.' }));
  }
};

const createAdminUser = async (req, res, next) => {
  try {
    await assertAdminUserManagementIsAvailable();

    const payload = validateWithSchema(createAdminUserSchema, req.body || {});
    const [existingUsernameUser, existingEmailUser] = await Promise.all([
      getAdminUserByUsername(payload.username),
      getAdminUserByEmail(payload.email)
    ]);

    if (existingUsernameUser) {
      return res.status(409).json({ error: 'Já existe um admin com este usuário.' });
    }

    if (existingEmailUser) {
      return res.status(409).json({ error: 'Já existe um admin com este e-mail.' });
    }

    const [insertResult] = await db.query(`
      INSERT INTO users (username, password, full_name, email, role, bloq_user)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      payload.username,
      hashAdminPassword(payload.password),
      payload.full_name,
      payload.email,
      normalizeAdminRole(payload.role),
      ADMIN_USER_FREE_FLAG_VALUE
    ]);

    const createdAdminUser = await getAdminUserById(insertResult.insertId);

    return res.status(201).json({
      message: 'Usuário admin criado com sucesso.',
      user: serializeAdminUser(createdAdminUser)
    });
  } catch (error) {
    if (error.code === 'ADMIN_USER_MANAGEMENT_COLUMNS_MISSING') {
      return next(error);
    }

    return next(wrapError(error, { publicMessage: 'Erro ao criar usuário do painel.' }));
  }
};

const updateAdminUser = async (req, res, next) => {
  try {
    await assertAdminUserManagementIsAvailable();

    const adminUserId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(adminUserId) || adminUserId <= 0) {
      return res.status(400).json({ error: 'Informe um usuário válido para atualizar.' });
    }

    const payload = validateWithSchema(updateAdminUserSchema, req.body || {});
    const adminUser = await getAdminUserById(adminUserId, { includePassword: true });

    if (!adminUser) {
      return res.status(404).json({ error: 'Usuário admin não encontrado.' });
    }

    if (payload.username && normalizeAdminUsername(payload.username) !== normalizeAdminUsername(adminUser.username)) {
      const conflictingUsernameUser = await getAdminUserByUsername(payload.username);

      if (conflictingUsernameUser && conflictingUsernameUser.id !== adminUserId) {
        return res.status(409).json({ error: 'Já existe um admin com este usuário.' });
      }
    }

    if (payload.email && normalizeAdminUsername(payload.email) !== normalizeAdminUsername(adminUser.email)) {
      const conflictingEmailUser = await getAdminUserByEmail(payload.email);

      if (conflictingEmailUser && conflictingEmailUser.id !== adminUserId) {
        return res.status(409).json({ error: 'Já existe um admin com este e-mail.' });
      }
    }

    const nextRole = payload.role ? normalizeAdminRole(payload.role) : normalizeAdminRole(adminUser.role);

    if (req.adminSession?.id === adminUserId && nextRole !== ADMIN_ROLE_MASTER) {
      return res.status(400).json({ error: 'O admin master logado não pode remover a própria permissão master.' });
    }

    const updates = [];
    const params = [];

    if (payload.full_name !== undefined) {
      updates.push('full_name = ?');
      params.push(payload.full_name);
    }

    if (payload.email !== undefined) {
      updates.push('email = ?');
      params.push(payload.email);
    }

    if (payload.username !== undefined) {
      updates.push('username = ?');
      params.push(payload.username);
    }

    if (payload.password !== undefined) {
      updates.push('password = ?');
      params.push(hashAdminPassword(payload.password));
    }

    if (payload.role !== undefined) {
      updates.push('role = ?');
      params.push(nextRole);
    }

    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ? LIMIT 1`,
      [...params, adminUserId]
    );

    if (payload.password !== undefined || payload.role !== undefined) {
      await incrementAdminSessionVersion(adminUserId);
    }

    const updatedAdminUser = await getAdminUserById(adminUserId);

    return res.json({
      message: 'Usuário admin atualizado com sucesso.',
      user: serializeAdminUser(updatedAdminUser)
    });
  } catch (error) {
    if (error.code === 'ADMIN_USER_MANAGEMENT_COLUMNS_MISSING') {
      return next(error);
    }

    return next(wrapError(error, { publicMessage: 'Erro ao atualizar usuário do painel.' }));
  }
};

const logoutAdmin = async (req, res, next) => {
  try {
    await incrementAdminSessionVersion(req.adminSession?.id);
    clearAdminSessionCookies(res);
    return res.json({ message: 'Logout realizado com sucesso.' });
  } catch (error) {
    return next(wrapError(error, { publicMessage: 'Erro ao encerrar sessão do admin.' }));
  }
};

module.exports = {
  ADMIN_ROLE_MASTER,
  ADMIN_ROLE_EDITOR,
  getAuthenticatedAdminSession,
  requireAdminSession,
  requireMasterAdminSession,
  loginAdmin,
  unlockAdminLoginByUser,
  getAdminSession,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  logoutAdmin
};
