const { z } = require('zod');
const { sanitizeTextInput } = require('../utils/inputSanitization');

const ADMIN_ROLE_MASTER = 'master';
const ADMIN_ROLE_EDITOR = 'editor';
const ADMIN_USER_ALLOWED_ROLES = [ADMIN_ROLE_MASTER, ADMIN_ROLE_EDITOR];
const ADMIN_USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

const sanitizeSingleLineText = (value) => (
  typeof value === 'string'
    ? sanitizeTextInput(value, { preserveNewlines: false })
    : value
);

const requiredTrimmedString = (label, maxLength) => z.preprocess(
  sanitizeSingleLineText,
  z.string({
    required_error: `${label} é obrigatório.`,
    invalid_type_error: `${label} precisa ser um texto.`
  })
    .min(1, `${label} é obrigatório.`)
    .max(maxLength, `${label} deve ter no máximo ${maxLength} caracteres.`)
);

const optionalTrimmedString = (label, maxLength) => z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return sanitizeSingleLineText(value);
}, z.string({
  invalid_type_error: `${label} precisa ser um texto.`
})
  .min(1, `${label} é obrigatório.`)
  .max(maxLength, `${label} deve ter no máximo ${maxLength} caracteres.`)
  .optional());

const requiredEmail = z.preprocess(
  sanitizeSingleLineText,
  z.string({
    required_error: 'E-mail é obrigatório.',
    invalid_type_error: 'E-mail precisa ser um texto.'
  })
    .min(1, 'E-mail é obrigatório.')
    .max(160, 'E-mail deve ter no máximo 160 caracteres.')
    .email('Informe um e-mail válido.')
    .transform((value) => value.toLowerCase())
);

const optionalEmail = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return sanitizeSingleLineText(value);
}, z.string({
  invalid_type_error: 'E-mail precisa ser um texto.'
})
  .max(160, 'E-mail deve ter no máximo 160 caracteres.')
  .email('Informe um e-mail válido.')
  .transform((value) => value.toLowerCase())
  .optional());

const requiredUsername = z.preprocess(
  sanitizeSingleLineText,
  z.string({
    required_error: 'Usuário é obrigatório.',
    invalid_type_error: 'Usuário precisa ser um texto.'
  })
    .min(3, 'Usuário deve ter pelo menos 3 caracteres.')
    .max(50, 'Usuário deve ter no máximo 50 caracteres.')
    .regex(ADMIN_USERNAME_PATTERN, 'Usuário pode ter apenas letras, números, ponto, traço e underscore.')
);

const optionalUsername = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return sanitizeSingleLineText(value);
}, z.string({
  invalid_type_error: 'Usuário precisa ser um texto.'
})
  .min(3, 'Usuário deve ter pelo menos 3 caracteres.')
  .max(50, 'Usuário deve ter no máximo 50 caracteres.')
  .regex(ADMIN_USERNAME_PATTERN, 'Usuário pode ter apenas letras, números, ponto, traço e underscore.')
  .optional());

const requiredPassword = z.preprocess(
  sanitizeSingleLineText,
  z.string({
    required_error: 'Senha é obrigatória.',
    invalid_type_error: 'Senha precisa ser um texto.'
  })
    .min(6, 'Senha deve ter pelo menos 6 caracteres.')
    .max(100, 'Senha deve ter no máximo 100 caracteres.')
);

const optionalPassword = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return sanitizeSingleLineText(value);
}, z.string({
  invalid_type_error: 'Senha precisa ser um texto.'
})
  .min(6, 'Senha deve ter pelo menos 6 caracteres.')
  .max(100, 'Senha deve ter no máximo 100 caracteres.')
  .optional());

const requiredRole = z.preprocess((value) => {
  if (typeof value === 'string') {
    return sanitizeSingleLineText(value).toLowerCase();
  }

  return value;
}, z.string({
  required_error: 'Perfil de acesso é obrigatório.',
  invalid_type_error: 'Perfil de acesso inválido.'
}).refine((role) => ADMIN_USER_ALLOWED_ROLES.includes(role), 'Perfil de acesso inválido.'));

const optionalRole = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    return sanitizeSingleLineText(value).toLowerCase();
  }

  return value;
}, z.string({
  invalid_type_error: 'Perfil de acesso inválido.'
})
  .refine((role) => ADMIN_USER_ALLOWED_ROLES.includes(role), 'Perfil de acesso inválido.')
  .optional());

const createAdminUserSchema = z.object({
  full_name: requiredTrimmedString('Nome do funcionario', 100),
  email: requiredEmail,
  username: requiredUsername,
  password: requiredPassword,
  role: requiredRole.default(ADMIN_ROLE_EDITOR)
}).strict();

const updateAdminUserSchema = z.object({
  full_name: optionalTrimmedString('Nome do funcionario', 100),
  email: optionalEmail,
  username: optionalUsername,
  password: optionalPassword,
  role: optionalRole
})
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe ao menos um campo para atualizar.'
  });

module.exports = {
  ADMIN_ROLE_MASTER,
  ADMIN_ROLE_EDITOR,
  createAdminUserSchema,
  updateAdminUserSchema
};
