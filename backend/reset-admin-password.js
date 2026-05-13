/**
 * Script utilitario para resetar a senha de um admin.
 *
 * Uso:
 *   node reset-admin-password.js <username> <nova-senha>
 *
 * Exemplo:
 *   node reset-admin-password.js admin minhaSenha123
 *
 * O script tambem garante que o usuario tenha role='master' e bloq_user=1
 * para poder acessar o painel normalmente.
 *
 * APAGUE ESTE ARQUIVO APOS O USO.
 */
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const db = require('./src/config/database');
const { hasUncaughtExceptionCaptureCallback } = require('process');

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

const main = async () => {
  const [,, username, newPassword] = process.argv;

  if (!username || !newPassword) {
    console.error('Uso: node reset-admin-password.js <username> <nova-senha>');
    process.exit(1);
  }

  try {
    const [users] = await db.query(
      'SELECT id, username, role, bloq_user FROM users WHERE LOWER(username) = ? LIMIT 1',
      [username.trim().toLowerCase()]
    );

    if (users.length === 0) {
      console.error(`Usuario "${username}" não encontrado na tabela users.`);
      console.log('\nUsuarios existentes:');
      const [allUsers] = await db.query('SELECT id, username, role FROM users');
      allUsers.forEach((u) => console.log(`  id=${u.id}  username=${u.username}  role=${u.role || '(sem role)'}`));
      process.exit(1);
    }

    const user = users[0];
    const hashedPassword = hashPassword(newPassword);

    await db.query(
      'UPDATE users SET password = ?, role = COALESCE(NULLIF(role, \'\'), \'master\'), bloq_user = 1 WHERE id = ?',
      [hashedPassword, user.id]
    );

    console.log(`Senha do usuario "${user.username}" (id=${user.id}) atualizada com sucesso!`);
    console.log(`Role: ${user.role || 'master (definido agora)'}`);
    console.log('\nVocê ja pode fazer login no painel.');
    console.log('APAGUE este script apos o uso: del reset-admin-password.js');
  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  } finally {
    await db.end().catch(() => {});
    process.exit(0);
  }
};

main();

