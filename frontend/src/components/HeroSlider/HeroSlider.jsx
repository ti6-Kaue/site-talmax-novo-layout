/**
 * Componente: HeroSlider
 * Uso: pagina Home
 * Responsabilidade: banner principal da pagina inicial
 */
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { slides as staticSlides } from '../../data';
import API_URL from '../../services/api';
import { apiAssetPath } from '../../utils/assets';
import { isExternalNavigationTarget, sanitizeNavigationTarget } from '../../utils/contentSafety';

import './HeroSlider.css';

const AUTOPLAY_DELAY_MS = 5000;

const HeroSlider = () => {
  const [banners, setBanners] = useState(staticSlides);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sliderHeight, setSliderHeight] = useState(null);
  const containerRef = useRef(null);
  const activeImageRef = useRef(null);
  const navigate = useNavigate();

  const measureActiveBanner = () => {
    const container = containerRef.current;
    const activeImage = activeImageRef.current;
    if (!activeImage) return;

    const updateHeight = () => {
      const containerWidth = container.clientWidth;
      const naturalWidth = activeImage.naturalWidth;
      const naturalHeight = activeImage.naturalHeight;

      if (!containerWidth || !naturalWidth || !naturalHeight) return;

      const nextHeight = Math.ceil(containerWidth * (naturalHeight / naturalWidth));
      if (nextHeight > 0) {
        setSliderHeight(nextHeight);
      }
    };

    if (activeImage.complete) {
      window.requestAnimationFrame(updateHeight);
    } else {
      activeImage.addEventListener('load', updateHeight, { once: true });
    }
  };

  const goToSlide = useCallback((nextIndex) => {
    setActiveIndex((currentIndex) => {
      const totalBanners = banners.length;

      if (totalBanners <= 0) {
        return 0;
      }

      if (typeof nextIndex === 'function') {
        return (nextIndex(currentIndex) + totalBanners) % totalBanners;
      }

      return (nextIndex + totalBanners) % totalBanners;
    });
  }, [banners.length]);

  const handleBannerClick = (linkUrl) => {
    const safeTarget = sanitizeNavigationTarget(linkUrl, { allowExternal: true, allowRelative: true });

    if (!safeTarget) return;

    if (isExternalNavigationTarget(safeTarget)) {
      window.location.href = safeTarget;
      return;
    }

    navigate(safeTarget);
  };

  useEffect(() => {
    const controller = new AbortController();

    const fetchBanners = async () => {
      try {
        const response = await fetch(`${API_URL}/banners`, { signal: controller.signal });

        if (response.ok) {
          const data = await response.json();
          const activeBanners = data.filter((banner) => banner.active);

          if (activeBanners.length > 0) {
            setBanners(activeBanners);
            setActiveIndex(0);
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }

        console.error('Erro ao buscar banners:', error);
      }
    };

    fetchBanners();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleResize = () => measureActiveBanner();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(measureActiveBanner);
  }, [activeIndex, banners]);

  useEffect(() => {
    if (banners.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      goToSlide((currentIndex) => currentIndex + 1);
    }, AUTOPLAY_DELAY_MS);

    return () => window.clearInterval(intervalId);
  }, [banners.length, goToSlide]);

  if (banners.length === 0) {
    return null;
  }

  const activeBanner = banners[activeIndex] || banners[0];
  const safeLinkUrl = sanitizeNavigationTarget(activeBanner.link_url, { allowExternal: true, allowRelative: true });
  const activeBannerImageSrc = activeBanner.image_url ? apiAssetPath(activeBanner.image_url) : activeBanner.image;

  return (
    <section
      ref={containerRef}
      className="hero-slider-container hero-slider-container--with-actions"
      style={sliderHeight ? { height: `${sliderHeight}px` } : undefined}
    >
      <div
        className="hero-swiper"
        style={sliderHeight ? { height: `${sliderHeight}px` } : undefined}
      >
        <div
          className="slide-content"
          style={{ cursor: safeLinkUrl ? 'pointer' : 'default' }}
          onClick={() => handleBannerClick(activeBanner.link_url)}
        >
          <img
            key={activeBannerImageSrc}
            ref={activeImageRef}
            src={activeBannerImageSrc}
            alt={activeBanner.title}
            className="banner-img"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            onLoad={(event) => {
              event.currentTarget.style.display = 'block';
              measureActiveBanner();
            }}
          />
          <span className="hero-slide-action-corner" aria-hidden="true">
            <span className="hero-slide-cta">
              Saiba Mais
              <ChevronRight size={30} strokeWidth={1.8} />
            </span>
          </span>
        </div>

        {banners.length > 1 && (
          <>
            <button
              type="button"
              className="hero-slider-button hero-slider-button--prev"
              onClick={() => goToSlide((currentIndex) => currentIndex - 1)}
              aria-label="Banner anterior"
            >
              <ChevronLeft size={44} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="hero-slider-button hero-slider-button--next"
              onClick={() => goToSlide((currentIndex) => currentIndex + 1)}
              aria-label="Proximo banner"
            >
              <ChevronRight size={44} strokeWidth={1.8} />
            </button>
            <div className="hero-slider-pagination" aria-label="Selecionar banner">
              {banners.map((slide, index) => (
                <button
                  type="button"
                  key={slide.id || `banner-${index}`}
                  className={`hero-slider-bullet${index === activeIndex ? ' is-active' : ''}`}
                  onClick={() => goToSlide(index)}
                  aria-label={`Ir para banner ${index + 1}`}
                  aria-current={index === activeIndex ? 'true' : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default HeroSlider;
