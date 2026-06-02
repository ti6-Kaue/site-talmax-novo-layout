import React, { useState } from 'react';
import { ShieldCheck, UnlockKeyhole } from 'lucide-react';
import { useAdmin } from '../../../context/useAdmin';
import { unlockAdminLoginByUser } from '../../../services/adminAuth';
import './AdminSecurity.css';

const AdminSecurity = () => {
  const { addToast, isMasterAdmin } = useAdmin();
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [lastUnlockedUser, setLastUnlockedUser] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isMasterAdmin) {
      setError('Somente o admin master pode liberar logins bloqueados.');
      return;
    }

    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      setError('Informe o usuário ou e-mail do admin que pediu desbloqueio.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await unlockAdminLoginByUser(normalizedUsername);
      setLastUnlockedUser(result.user || null);
      setUsername('');
      addToast(result.message || 'Usuário liberado para uma nova tentativa de login.', 'success');
    } catch (unlockError) {
      setError(unlockError.message);
      addToast(unlockError.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-security">
      <section className="admin-card">
        <div className="card-header admin-security__header">
          <div>
            <h2><ShieldCheck size={20} /> Segurança do Login</h2>
            <p>Desbloqueie manualmente um usuário específico do painel quando ele pedir nova tentativa.</p>
          </div>
        </div>

        <div className="card-body">
          {!isMasterAdmin && (
            <div className="admin-security__feedback is-error">
              Somente o admin master pode liberar novas tentativas de login.
            </div>
          )}

          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="admin-section-group">
              <div className="form-group">
                <label htmlFor="admin-security-username">Usuário ou e-mail do admin</label>
                <input
                  id="admin-security-username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Ex.: admin ou ti6@talmax.com.br"
                  autoComplete="off"
                  disabled={isSubmitting || !isMasterAdmin}
                />
              </div>

              <p className="admin-security__note">
                Regra usada pelo sistema: <code>bloq_user = 1</code> significa acesso livre e <code>bloq_user = 2</code>
                significa bloqueio temporário. Ao liberar por aqui, o usuário volta para <code>1</code> e o bloqueio
                atual é limpo.
              </p>

              {error && <div className="admin-security__feedback is-error">{error}</div>}

              {lastUnlockedUser && (
                <div className="admin-security__feedback is-success">
                  <strong>{lastUnlockedUser.username}</strong> voltou para o estado livre e já pode tentar login novamente.
                </div>
              )}

              <div className="admin-security__actions">
                <button type="submit" className="btn-primary" disabled={isSubmitting || !isMasterAdmin}>
                  <UnlockKeyhole size={18} />
                  {isSubmitting ? 'Liberando...' : 'Liberar nova tentativa'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};

export default AdminSecurity;
