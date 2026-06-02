import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import { apiAssetPath } from '../../utils/assets';

import 'swiper/css';
import 'swiper/css/pagination';

const isExternalFooterAdTarget = (value = '') => /^(?:https?:|mailto:|tel:)/i.test(String(value || '').trim());

const FooterAdStrip = ({ ad }) => {
  const href = String(ad.link_url || '').trim();
  const isExternal = Boolean(ad.is_external) || isExternalFooterAdTarget(href);
  const hasLogo = Boolean(ad.logo_image_url || ad.logo_text);
  const style = {
    '--moby-strip-bg': ad.background_color || '#f06400',
    '--moby-strip-text-color': ad.text_color || '#ffffff',
    '--moby-strip-button-bg': ad.button_color || '#374c92',
    '--moby-strip-button-text': ad.button_text_color || '#ffffff'
  };
  const buttonContent = (
    <>
      {ad.button_label || 'Conheca'}
      <ChevronRight size={20} strokeWidth={1.75} />
    </>
  );

  return (
    <section className="moby-footer-strip" aria-label={ad.logo_text || ad.title || 'Propaganda'} style={style}>
      <div className={`moby-footer-strip__inner ${hasLogo ? '' : 'moby-footer-strip__inner--no-logo'}`}>
        {ad.logo_image_url ? (
          <img
            src={apiAssetPath(ad.logo_image_url)}
            alt={ad.logo_text || 'Logo da propaganda'}
            className="moby-footer-strip__logo-image"
          />
        ) : ad.logo_text ? (
          <span className="moby-footer-strip__logo">{ad.logo_text}</span>
        ) : null}
        <p>{ad.title}</p>
        {href && ad.button_label && isExternal && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="moby-footer-strip__button"
          >
            {buttonContent}
          </a>
        )}
        {href && ad.button_label && !isExternal && (
          <Link to={href} className="moby-footer-strip__button">
            {buttonContent}
          </Link>
        )}
      </div>
    </section>
  );
};

const FooterAdCarousel = ({ ads }) => (
  <div className="moby-footer-strips">
    <Swiper
      modules={[Autoplay]}
      className="moby-footer-strips__swiper"
      slidesPerView={1}
      loop={ads.length > 1}
      autoHeight
      autoplay={ads.length > 1 ? { delay: 4200, disableOnInteraction: false } : false}
      pagination={false}
    >
      {ads.map((ad, index) => (
        <SwiperSlide key={ad.id || `footer-ad-${index}`}>
          <FooterAdStrip ad={ad} />
        </SwiperSlide>
      ))}
    </Swiper>
  </div>
);

export default FooterAdCarousel;
