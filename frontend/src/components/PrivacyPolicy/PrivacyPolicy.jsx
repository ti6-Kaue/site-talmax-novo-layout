/**
 * Pagina: PrivacyPolicy
 * Rota: /privacidade
 * Responsabilidade: exibir a politica de privacidade do site
 */
import React from 'react';
import './PrivacyPolicy.css';

const PrivacyPolicy = () => {
  return (
    <div className="privacy-policy">
      <h1 className="privacy-policy-title">Política de Privacidade</h1>

      <section className="privacy-policy-section">
        <h2>1. Introdução</h2>
        <p>
          A TALMAX está comprometida em proteger a sua privacidade e em conformidade com a Lei Geral de
          Proteção de Dados (LGPD).
        </p>
      </section>

      <section className="privacy-policy-section">
        <h2>2. Coleta de Dados</h2>
        <p>
          Coletamos apenas os dados necessários para fornecer nossos produtos e serviços, como nome, e-mail e
          telefone, quando fornecidos voluntariamente por você em nossos formulários.
        </p>
      </section>

      <section className="privacy-policy-section">
        <h2>3. Uso de Cookies</h2>
        <p>
          Utilizamos cookies essenciais para o funcionamento do site. Cookies analíticos são ativados somente
          após o seu consentimento para medir acessos e melhorar a experiência.
        </p>
      </section>

      <section className="privacy-policy-section">
        <h2>4. Seus Direitos</h2>
        <p>
          De acordo com a LGPD, você tem o direito de acessar, corrigir ou excluir seus dados pessoais a qualquer
          momento.
        </p>
      </section>

      <section className="privacy-policy-section">
        <h2>5. Contato</h2>
        <p>
          Para dúvidas sobre nossa política de privacidade, entre em contato através do e-mail:
          contato@talmax.com.br
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
