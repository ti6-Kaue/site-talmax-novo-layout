/**
 * Componente: CookieBanner
 * Uso: componente global do site publico
 * Responsabilidade: exibir e registrar o consentimento de cookies
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  hasCookieConsentStatus,
  writeCookieConsentStatus
} from '../../services/cookieConsent';
import './CookieBanner.css';

const CookieBanner = () => {
  const [showBanner, setShowBanner] = useState(() => !hasCookieConsentStatus());

  const handleConsent = (status) => {
    writeCookieConsentStatus(status);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="cookie-banner">
      <div className="cookie-banner-content">
        <h3>Privacidade e Cookies</h3>
        <p>
          Usamos cookies essenciais e, com seu aceite, métricas anônimas do próprio site para melhorar produtos e buscas.
          Consulte nossa <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
      </div>
      <div className="cookie-banner-actions">
        <button className="btn-cookie btn-accept" onClick={() => handleConsent('accepted')}>
          Aceitar
        </button>
        <button className="btn-cookie btn-reject" onClick={() => handleConsent('rejected')}>
          Recusar
        </button>
      </div>
    </div>
  );
};

export default CookieBanner;
