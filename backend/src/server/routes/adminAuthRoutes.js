/**
 * Define as rotas de autenticação do admin.
 * Expõe login, consulta da sessão atual e logout do painel.
 */
const express = require('express');
const { adminLoginRateLimit } = require('../seguranca/adminLoginRateLimit');
const {
  requireAdminSession,
  requireMasterAdminSession,
  loginAdmin,
  getAdminSession,
  logoutAdmin,
  unlockAdminLoginByUser,
  listAdminUsers,
  createAdminUser,
  updateAdminUser
} = require('../auth/adminSession');

const router = express.Router();

// TEMPORARIO: endpoint de diagnostico para depurar cookies em producao.
// REMOVA apos resolver o problema de login.
router.get('/debug-session', (req, res) => {
  const cookieHeader = req.headers.cookie || '';
  const hasCookie = cookieHeader.includes('talmax-admin-session');
  const cookieNames = cookieHeader
    .split(';')
    .map((c) => c.trim().split('=')[0])
    .filter(Boolean);

  res.json({
    hasCookie,
    cookieNames,
    cookieHeaderLength: cookieHeader.length,
    origin: req.headers.origin || null,
    referer: req.headers.referer || null,
    protocol: req.protocol,
    secure: req.secure,
    host: req.headers.host,
    sameSiteConfig: process.env.ADMIN_COOKIE_SAME_SITE || '(não definido, padrão lax)',
    nodeEnv: process.env.NODE_ENV || '(não definido)'
  });
});

router.post('/login', adminLoginRateLimit, loginAdmin);
router.post('/login-unlock', requireMasterAdminSession, unlockAdminLoginByUser);
router.get('/session', requireAdminSession, getAdminSession);
router.get('/users', requireMasterAdminSession, listAdminUsers);
router.post('/users', requireMasterAdminSession, createAdminUser);
router.put('/users/:id', requireMasterAdminSession, updateAdminUser);
router.post('/logout', requireAdminSession, logoutAdmin);

module.exports = router;
