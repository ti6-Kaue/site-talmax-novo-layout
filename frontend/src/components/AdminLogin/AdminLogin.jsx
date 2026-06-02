import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole, User, ShieldCheck } from 'lucide-react';
import { loginAdmin } from '../../services/adminAuth';
import { ADMIN_SESSION_EXPIRED_MESSAGE } from '../../services/adminSessionEvents';
import './AdminLogin.css';

const ADMIN_LOGIN_LOCK_STORAGE_KEY = 'talmax-admin-login-lock-expires-at';

const normalizeAdminIdentifier = (value = '') => String(value || '').trim().toLowerCase();

const readStoredLockState = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ADMIN_LOGIN_LOCK_STORAGE_KEY);
    const parsedValue = JSON.parse(rawValue || 'null');
    const expiresAt = Number(parsedValue?.expiresAt);
    const identifier = normalizeAdminIdentifier(parsedValue?.identifier);

    if (!identifier || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      window.localStorage.removeItem(ADMIN_LOGIN_LOCK_STORAGE_KEY);
      return null;
    }

    return {
      identifier,
      expiresAt
    };
  } catch {
    try {
      window.localStorage.removeItem(ADMIN_LOGIN_LOCK_STORAGE_KEY);
    } catch {
      // Ignora erros de storage.
    }

    return null;
  }
};

const getRemainingLockSeconds = (lockExpiresAt) => {
  if (!lockExpiresAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((lockExpiresAt - Date.now()) / 1000));
};

const formatCountdown = (totalSeconds) => {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lockState, setLockState] = useState(() => readStoredLockState());
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);
  const currentIdentifier = normalizeAdminIdentifier(formData.username);
  const isLocked = Boolean(
    lockState?.identifier &&
    currentIdentifier &&
    lockState.identifier === currentIdentifier &&
    lockRemainingSeconds > 0
  );

  useEffect(() => {
    if (!lockState?.identifier || !lockState?.expiresAt) {
      setLockRemainingSeconds(0);

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(ADMIN_LOGIN_LOCK_STORAGE_KEY);
      }

      return undefined;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_LOGIN_LOCK_STORAGE_KEY, JSON.stringify(lockState));
    }

    const updateRemainingTime = () => {
      const remainingSeconds = getRemainingLockSeconds(lockState.expiresAt);
      setLockRemainingSeconds(remainingSeconds);

      if (remainingSeconds <= 0) {
        setLockState(null);
      }
    };

    updateRemainingTime();
    const intervalId = window.setInterval(updateRemainingTime, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [lockState]);

  useEffect(() => {
    if (location.state?.sessionExpired) {
      setError(ADMIN_SESSION_EXPIRED_MESSAGE);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setError('');
    setFormData((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setIsLoading(true);

    try {
      await loginAdmin(formData);
      setLockState(null);
      navigate('/admin/painel');
    } catch (loginError) {
      if (loginError.retryAfterSeconds) {
        const attemptedIdentifier = normalizeAdminIdentifier(formData.username);

        if (attemptedIdentifier) {
          setLockState({
            identifier: attemptedIdentifier,
            expiresAt: Date.now() + (loginError.retryAfterSeconds * 1000)
          });
        }
      } else if (loginError.statusCode && loginError.statusCode !== 429) {
        setLockState(null);
      }

      setError(loginError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const displayedError = isLocked
    ? error || 'Muitas tentativas de login. Tente novamente mais tarde.'
    : error;

  return (
    <div className="admin-login-page">
      <div className="admin-login-shell">
        <div className="admin-login-brand">
          <span className="admin-login-badge">Painel Administrativo</span>
          <h1>TALMAX ADMIN</h1>
          <p>Acesse o painel com suas credenciais para gerenciar produtos, categorias e banners.</p>
        </div>

        <form className="admin-login-card" onSubmit={handleSubmit}>
          <div className="admin-login-card-header">
            <div className="admin-login-icon">
              <ShieldCheck size={24} />
            </div>
            <h2>Entrar no painel</h2>
          </div>

          <label className="admin-login-field">
            <span>Usuário ou e-mail</span>
            <div className="admin-login-input">
              <User size={18} />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Digite seu usuário ou e-mail"
                autoComplete="username"
                disabled={isLoading}
                required
              />
            </div>
          </label>

          <label className="admin-login-field">
            <span>Senha</span>
            <div className="admin-login-input">
              <LockKeyhole size={18} />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                disabled={isLoading}
                required
              />
            </div>
          </label>

          {displayedError && <div className="admin-login-error">{displayedError}</div>}

          <button type="submit" className="admin-login-submit" disabled={isLoading}>
            {isLoading ? 'Entrando...' : isLocked ? `Tentar novamente (${formatCountdown(lockRemainingSeconds)})` : 'Acessar painel'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
