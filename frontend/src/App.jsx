import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import {
  Facebook,
  Youtube,
  Instagram,
  Linkedin,
  Search,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';

import Home from './components/Home/Home';
import AdminLogin from './components/AdminLogin/AdminLogin';
import CookieBanner from './components/CookieBanner/CookieBanner';
import PagePlaceholder from './components/PagePlaceholder/PagePlaceholder';
import SearchBar from './components/SearchBar/SearchBar';
import { useProductSearch } from './hooks/useProductSearch';
import API_URL from './services/api';
import { validateAdminSession } from './services/adminAuth';
import { trackPageView, trackWhatsappClick } from './services/analytics';
import homeContentBlockService from './services/homeContentBlockService';
import {
  readCookieConsentStatus,
  subscribeToCookieConsentStatus
} from './services/cookieConsent';
import { subscribeToAdminSessionExpired } from './services/adminSessionEvents';
import { apiAssetPath, assetPath } from './utils/assets';
import 'swiper/css';
import 'swiper/css/pagination';
import './App.css';

const QuemSomos = lazy(() => import('./components/QuemSomos/QuemSomos'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy/PrivacyPolicy'));
const ProductCatalog = lazy(() => import('./components/ProductCatalog/ProductCatalog'));
const ProductDetail = lazy(() => import('./components/ProductDetail/ProductDetail'));
const Support = lazy(() => import('./components/Support/Support'));
const HistoriaDiretoria = lazy(() => import('./components/HistoriaDiretoria/HistoriaDiretoria'));
const TalmaxDigital = lazy(() => import('./components/TalmaxDigital/TalmaxDigital'));
const DigitalGroupPage = lazy(() => import('./components/TalmaxDigital/DigitalGroupPage'));
const Upcera = lazy(() => import('./components/Upcera/Upcera'));
const Scanners = lazy(() => import('./components/Scanners/Scanners'));
const Impressoras3D = lazy(() => import('./components/Impressoras3D/Impressoras3D'));
const CustomPage = lazy(() => import('./components/CustomPage/CustomPage'));
const TechnicalAssistance = lazy(() => import('./components/TechnicalAssistance/TechnicalAssistance'));
const Admin = lazy(() => import('./pages/Admin/AdminDashboard'));

const THEME_STORAGE_KEY = 'talmax-theme';
const LOADER_DELAY_MS = 1000;
const PRODUCTS_NAV_CATEGORY_ORDER = [
  'Fresadoras',
  'Scanners',
  'Ligas Metalicas',
  'Ligas Metálicas',
  'Revestimentos',
  'Blocos',
  'Fresas',
  'Equipamentos',
  'Talmax Digital',
  'Prótese Dentária',
  'Nail e Podologia'
];

const normalizeNavCategoryText = (value = '') => (
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const normalizedProductsNavOrder = PRODUCTS_NAV_CATEGORY_ORDER.map(normalizeNavCategoryText);

const FullScreenLoader = ({ label = 'Carregando...' }) => (
  <div className="app-loader-overlay" role="status" aria-live="polite" aria-label={label}>
    <div className="app-loader-shell">
      <div className="loader loader_bubble" aria-hidden="true" />
      <span className="app-loader-text">{label}</span>
    </div>
  </div>
);

const DelayedFullScreenLoader = ({ label = 'Carregando...', delay = LOADER_DELAY_MS }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setVisible(true);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delay]);

  if (!visible) {
    return null;
  }

  return <FullScreenLoader label={label} />;
};

const RouteLoader = ({ children, label = 'Carregando pagina...' }) => (
  <Suspense fallback={<DelayedFullScreenLoader label={label} />}>
    {children}
  </Suspense>
);

const WhatsAppIcon = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M12.04 2C6.58 2 2.13 6.37 2.13 11.74c0 1.71.46 3.38 1.33 4.85L2 22l5.55-1.43a10.1 10.1 0 0 0 4.49 1.05c5.46 0 9.91-4.37 9.91-9.74S17.5 2 12.04 2Zm0 17.92c-1.46 0-2.89-.39-4.14-1.12l-.3-.18-3.28.84.87-3.15-.2-.32a8.03 8.03 0 0 1-1.25-4.25c0-4.43 3.72-8.04 8.3-8.04s8.3 3.61 8.3 8.04-3.72 8.18-8.3 8.18Zm4.55-6.04c-.25-.12-1.47-.72-1.7-.8-.23-.09-.4-.13-.57.12-.17.25-.65.8-.8.96-.15.17-.29.19-.54.06-.25-.12-1.06-.38-2.01-1.21-.74-.66-1.24-1.47-1.39-1.72-.15-.25-.02-.38.11-.5.12-.12.25-.29.38-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.35-.78-1.85-.2-.48-.41-.42-.57-.43h-.49c-.17 0-.43.06-.66.31-.23.25-.87.84-.87 2.04s.89 2.36 1.02 2.53c.12.17 1.76 2.64 4.26 3.7.6.25 1.06.4 1.42.51.6.19 1.14.16 1.57.1.48-.07 1.47-.59 1.68-1.16.21-.58.21-1.07.15-1.17-.06-.1-.23-.16-.48-.28Z"
    />
  </svg>
);

const withRouteLoader = (element, label) => (
  <RouteLoader label={label}>
    {element}
  </RouteLoader>
);

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

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const ProtectedAdminRoute = ({ children }) => {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let mounted = true;

    validateAdminSession({
      timeoutMs: 2500
    })
      .then((result) => {
        if (mounted) {
          setStatus(result.authenticated ? 'authenticated' : 'unauthenticated');
        }
      })
      .catch(() => {
        if (mounted) {
          setStatus('unauthenticated');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (status === 'checking') {
    return <DelayedFullScreenLoader label="Carregando painel..." />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [appReady, setAppReady] = useState(() => {
    if (typeof document === 'undefined') {
      return false;
    }

    return document.readyState === 'complete';
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    return window.localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  });
  const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '');

  useEffect(() => {
    if (appReady) {
      return undefined;
    }

    const releaseApp = () => {
      setAppReady(true);
    };

    window.addEventListener('load', releaseApp, { once: true });

    return () => {
      window.removeEventListener('load', releaseApp);
    };
  }, [appReady]);

  return (
    <Router basename={routerBasename}>
      <ScrollToTop />
      <AppContent
        appReady={appReady}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      />
    </Router>
  );
}

const AppContent = ({ appReady, menuOpen, setMenuOpen, theme, onToggleTheme }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith('/admin');
  const showGlobalLoader = !appReady && !isAdmin;
  const [navVisible, setNavVisible] = useState(true);
  const [activeMobileSection, setActiveMobileSection] = useState(null);
  const [desktopSearchExpanded, setDesktopSearchExpanded] = useState(false);
  const [cookieConsentStatus, setCookieConsentStatus] = useState(() => readCookieConsentStatus());
  const [footerAds, setFooterAds] = useState([]);
  const [productNavCategories, setProductNavCategories] = useState([]);
  const headerRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const desktopSearchExpandedRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const tickingScrollRef = useRef(false);

  const closeMobileMenu = () => {
    setMenuOpen(false);
    setActiveMobileSection(null);
  };

  const handleMenuToggle = () => {
    if (menuOpen) {
      closeMobileMenu();
      return;
    }

    setMenuOpen(true);
  };

  const toggleMobileSection = (section) => {
    setActiveMobileSection((current) => (current === section ? null : section));
  };

  const {
    closeSearch,
    handleProductSuggestionSelect,
    handleSearchInputChange,
    handleSearchInputFocus,
    handleSearchInputKeyDown,
    handleSearchSubmit,
    previewProduct,
    productSuggestions,
    searchInputRef,
    searchMatchesTotal,
    searchOpen,
    searchTerm,
    setSearchPreviewId,
    shouldShowSearchDropdown,
    toggleSearch
  } = useProductSearch({
    isAdmin,
    onNavigateComplete: () => {
      closeMobileMenu();
      setDesktopSearchExpanded(false);
    }
  });

  useEffect(() => {
    if (desktopSearchExpanded) {
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [desktopSearchExpanded, searchInputRef]);

  useEffect(() => {
    desktopSearchExpandedRef.current = desktopSearchExpanded;
  }, [desktopSearchExpanded]);

  useEffect(() => {
    if (!desktopSearchExpanded) {
      return undefined;
    }

    const handleDocumentPointerDown = (event) => {
      if (event.target instanceof Element && desktopSearchRef.current?.contains(event.target)) {
        return;
      }

      setDesktopSearchExpanded(false);
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
  }, [desktopSearchExpanded]);

  const sharedSearchBarProps = {
    onInputChange: handleSearchInputChange,
    onInputFocus: handleSearchInputFocus,
    onInputKeyDown: handleSearchInputKeyDown,
    onPreviewChange: setSearchPreviewId,
    onSelectProduct: handleProductSuggestionSelect,
    onSubmit: handleSearchSubmit,
    previewProduct,
    searchTerm,
    shouldShowDropdown: shouldShowSearchDropdown,
    suggestions: productSuggestions,
    totalMatches: searchMatchesTotal
  };

  useEffect(() => {
    if (isAdmin) {
      setProductNavCategories([]);
      return undefined;
    }

    const controller = new AbortController();

    fetch(`${API_URL}/categories`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Erro ao carregar categorias do menu');
        }

        return response.json();
      })
      .then((items) => {
        setProductNavCategories(Array.isArray(items) ? items : []);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Erro ao carregar categorias do menu:', error);
          setProductNavCategories([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isAdmin]);

  useEffect(() => {
    const unsubscribe = subscribeToAdminSessionExpired(() => {
      if (location.pathname.startsWith('/admin') && location.pathname !== '/admin/login') {
        navigate('/admin/login', {
          replace: true,
          state: { sessionExpired: true }
        });
      }
    });

    return unsubscribe;
  }, [location.pathname, navigate]);

  useEffect(() => {
    const unsubscribe = subscribeToCookieConsentStatus((nextStatus) => {
      setCookieConsentStatus(nextStatus);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      trackPageView(`${location.pathname}${location.search}`);
    }
  }, [cookieConsentStatus, isAdmin, location.pathname, location.search]);

  useEffect(() => {
    if (isAdmin) {
      setFooterAds([]);
      return undefined;
    }

    let isMounted = true;

    homeContentBlockService.getAll()
      .then((items) => {
        if (!isMounted) {
          return;
        }

        setFooterAds(
          (Array.isArray(items) ? items : [])
            .filter((item) => item.section_type === 'orange-ad' && item.active)
        );
      })
      .catch((error) => {
        console.error('Erro ao carregar propagandas do rodape:', error);

        if (isMounted) {
          setFooterAds([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return undefined;
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      if (tickingScrollRef.current) return;

      tickingScrollRef.current = true;

      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollYRef.current;

        if (delta > 8 && desktopSearchExpandedRef.current) {
          setDesktopSearchExpanded(false);
        }

        if (currentScrollY <= 24) {
          setNavVisible(true);
        } else if (delta > 14 && currentScrollY > 160) {
          setNavVisible((current) => (current ? false : current));
        } else if (delta < -14) {
          setNavVisible((current) => (current ? current : true));
        }

        lastScrollYRef.current = currentScrollY;
        tickingScrollRef.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, [isAdmin]);

  useEffect(() => {
    const rootElement = document.documentElement;

    if (isAdmin) {
      rootElement.style.setProperty('--site-header-current-height', '0px');
      return undefined;
    }

    const headerElement = headerRef.current;

    if (!headerElement) {
      return undefined;
    }

    let animationFrameId = 0;

    const updateHeaderHeight = () => {
      const headerHeight = Math.ceil(headerElement.getBoundingClientRect().height);
      rootElement.style.setProperty('--site-header-current-height', `${headerHeight}px`);
    };

    const requestHeaderHeightUpdate = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0;
        updateHeaderHeight();
      });
    };

    updateHeaderHeight();

    const resizeObserver = typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver(requestHeaderHeightUpdate)
      : null;

    resizeObserver?.observe(headerElement);
    window.addEventListener('resize', requestHeaderHeightUpdate);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      resizeObserver?.disconnect();
      window.removeEventListener('resize', requestHeaderHeightUpdate);
    };
  }, [isAdmin, menuOpen, navVisible, searchOpen]);

  useEffect(() => {
    const appliedTheme = isAdmin ? theme : 'light';
    document.body.dataset.theme = appliedTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, appliedTheme);
  }, [isAdmin, theme]);

  const currentPath = location.pathname;
  const isPathActive = (paths) => paths.some((path) => currentPath === path || currentPath.startsWith(`${path}/`));
  const navItemClassName = (active) => `nav-item${active ? ' is-active' : ''}`;
  const activeNavItems = {
    home: currentPath === '/',
    institucional: isPathActive(['/quem-somos', '/historia-diretoria', '/depoimentos']),
    produtos: isPathActive([
      '/produtos',
      '/categoria',
      '/produto',
      '/grupo-digital',
      '/upcera',
      '/scanners',
      '/impressoras-3d'
    ]),
    servicos: isPathActive(['/suporte', '/assistencia-tecnica']),
    contato: isPathActive(['/contato', '/comercial-comex']),
    cursos: isPathActive(['/cursos']),
    sac: isPathActive(['/sac', '/politicas-troca'])
  };
  const visibleProductNavCategories = useMemo(() => {
    const visibleItems = productNavCategories.filter((category) => (
      category?.slug
      && category.is_visible !== false
      && Number(category.is_visible ?? 1) !== 0
    ));

    const orderedItems = visibleItems
      .filter((category) => normalizedProductsNavOrder.includes(normalizeNavCategoryText(category.name)))
      .sort((a, b) => (
        normalizedProductsNavOrder.indexOf(normalizeNavCategoryText(a.name))
        - normalizedProductsNavOrder.indexOf(normalizeNavCategoryText(b.name))
      ));

    return orderedItems.length > 0 ? orderedItems : visibleItems.filter((category) => !category.parent_id);
  }, [productNavCategories]);

  const renderProductCategoryLinks = (onClick) => {
    if (visibleProductNavCategories.length === 0) {
      return (
        <>
          <Link to="/categoria/talmax-digital" onClick={onClick}>Talmax Digital</Link>
          <Link to="/categoria/protese-dentaria" onClick={onClick}>Prótese Dentária</Link>
          <Link to="/categoria/nail-e-podologia" onClick={onClick}>Nail e Podologia</Link>
        </>
      );
    }

    return visibleProductNavCategories.map((category) => (
      <Link
        key={`${category.parent_id || 'main'}-${category.id}-${category.slug}`}
        to={`/categoria/${category.slug}`}
        onClick={onClick}
      >
        {category.name}
      </Link>
    ));
  };

  return (
    <div className="app">
      {showGlobalLoader && <DelayedFullScreenLoader label="Carregando site..." />}

      {isAdmin && (
        <button
          type="button"
          className="theme-toggle-button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          <span className="theme-toggle-icon">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </span>
        </button>
      )}

      {!isAdmin && (
        <header
          ref={headerRef}
          className={`header ${navVisible ? 'nav-expanded' : 'nav-collapsed'} ${menuOpen ? 'menu-active' : ''} ${desktopSearchExpanded ? 'desktop-search-active' : ''}`}
        >
          <div className="header-top">
            <Link to="/" className="logo">
              <img src={assetPath('img/Talmaxlogo.logo.webp')} alt="TALMAX" />
            </Link>

            <nav className="nav-desktop header-nav-desktop hide-mobile">
              <div className={navItemClassName(activeNavItems.home)}>
                <Link to="/">Home</Link>
              </div>

              <div className={navItemClassName(activeNavItems.institucional)}>
                <span>Institucional <ChevronDown className="nav-dropdown-arrow" size={14} /></span>
                <div className="dropdown">
                  <Link to="/quem-somos">Quem Somos</Link>
                  <Link to="/historia-diretoria">História & Diretoria</Link>
                  <Link to="/depoimentos">Depoimentos</Link>
                </div>
              </div>

              <div className={navItemClassName(activeNavItems.produtos)}>
                <span>Produtos <ChevronDown className="nav-dropdown-arrow" size={14} /></span>
                <div className="dropdown">
                  <Link to="/produtos" className="highlight-link">Todos os produtos</Link>
                  <hr />
                  {renderProductCategoryLinks()}
                </div>
              </div>

              <div className={navItemClassName(activeNavItems.servicos)}>
                <span>Serviços <ChevronDown className="nav-dropdown-arrow" size={14} /></span>
                <div className="dropdown">
                  <Link to="/suporte">Suporte</Link>
                  <Link to="/assistencia-tecnica">Assistência Técnica</Link>
                </div>
              </div>

              <div className={navItemClassName(activeNavItems.contato)}>
                <span>Contato <ChevronDown className="nav-dropdown-arrow" size={14} /></span>
                <div className="dropdown">
                  <Link to="/contato">Formulário de Contato</Link>
                  <Link to="/comercial-comex">Comercial / Comex</Link>
                  <a href="https://www.bne.com.br/talmax" target="_blank" rel="noopener noreferrer">Trabalhe Conosco</a>
                </div>
              </div>
            </nav>

            <div
              ref={desktopSearchRef}
              className={`header-search-desktop hide-mobile ${desktopSearchExpanded ? 'is-expanded' : 'is-collapsed'}`}
            >
              {desktopSearchExpanded ? (
                <SearchBar
                  variant="desktop"
                  inputRef={searchInputRef}
                  {...sharedSearchBarProps}
                />
              ) : (
                <button
                  type="button"
                  className="desktop-search-icon-button"
                  onClick={() => setDesktopSearchExpanded(true)}
                  aria-label="Abrir busca"
                >
                  <Search size={18} />
                </button>
              )}
            </div>

            <div className="header-socials hide-mobile">
              <a
                href="https://talmax.com.br/portalcliente/"
                target="_blank"
                rel="noopener noreferrer"
                className="header-portal-button"
              >
                Portal do Cliente
              </a>
            </div>

            <button
              className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
              onClick={handleMenuToggle}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
            >
              <span className="menu-toggle-bar" />
              <span className="menu-toggle-bar" />
              <span className="menu-toggle-bar" />
            </button>
          </div>

          <div className={`sub-header hide-mobile ${navVisible ? 'is-visible' : 'is-hidden'}`}>
            <div className="sub-header-inner">
              <nav className="nav-desktop">
                <div className={navItemClassName(activeNavItems.home)}>
                  <Link to="/">Home</Link>
                </div>

                <div className={navItemClassName(activeNavItems.institucional)}>
                  <span>Institucional <ChevronDown size={14} /></span>
                  <div className="dropdown">
                    <Link to="/quem-somos">Quem Somos</Link>
                    <Link to="/historia-diretoria">História & Diretoria</Link>
                    <Link to="/depoimentos">Depoimentos</Link>
                  </div>
                </div>

                <div className={navItemClassName(activeNavItems.produtos)}>
                  <span>Produtos <ChevronDown size={14} /></span>
                  <div className="dropdown">
                    <Link to="/produtos" className="highlight-link">Todos os produtos</Link>
                    <hr />
                    {renderProductCategoryLinks()}
                  </div>
                </div>

                <div className={navItemClassName(activeNavItems.servicos)}>
                  <span>Serviços <ChevronDown size={14} /></span>
                  <div className="dropdown">
                    <Link to="/suporte">Suporte</Link>
                    <Link to="/assistencia-tecnica">Assistência Técnica</Link>
                  </div>
                </div>

                <div className={navItemClassName(activeNavItems.contato)}>
                  <span>Contato <ChevronDown size={14} /></span>
                  <div className="dropdown">
                    <Link to="/contato">Formulário de Contato</Link>
                    <Link to="/comercial-comex">Comercial / Comex</Link>
                    <a href="https://www.bne.com.br/talmax" target="_blank" rel="noopener noreferrer">Trabalhe Conosco</a>
                  </div>
                </div>

                <div className={navItemClassName(activeNavItems.cursos)}>
                  <Link to="/cursos">Cursos</Link>
                </div>

                <div className={navItemClassName(activeNavItems.sac)}>
                  <span>SAC <ChevronDown size={14} /></span>
                  <div className="dropdown">
                    <Link to="/sac">Fale Conosco</Link>
                    <Link to="/politicas-troca">Políticas de Troca</Link>
                  </div>
                </div>
              </nav>
            </div>
          </div>

          {searchOpen && (
            <SearchBar
              {...sharedSearchBarProps}
              variant="mobile"
              inputRef={searchInputRef}
              onClose={closeSearch}
            />
          )}

          <nav className={`nav-mobile ${menuOpen ? 'active' : ''}`}>
            <button
              className="search-trigger mobile-search-trigger"
              onClick={() => {
                closeMobileMenu();
                toggleSearch();
              }}
              aria-label={searchOpen ? 'Fechar busca' : 'Abrir busca'}
            >
              <Search size={18} />
              <span>Buscar no site</span>
            </button>

            <Link to="/" onClick={closeMobileMenu}>Home</Link>

            <div className="nav-mobile-item">
              <button
                type="button"
                className={`nav-mobile-trigger ${activeMobileSection === 'institucional' ? 'is-open' : ''}`}
                onClick={() => toggleMobileSection('institucional')}
                aria-expanded={activeMobileSection === 'institucional'}
              >
                <span>Institucional</span>
                <ChevronDown size={18} />
              </button>
              <div className={`nav-mobile-sub ${activeMobileSection === 'institucional' ? 'is-open' : ''}`}>
                <Link to="/quem-somos" onClick={closeMobileMenu}>Quem Somos</Link>
                <Link to="/historia-diretoria" onClick={closeMobileMenu}>História & Diretoria</Link>
                <Link to="/depoimentos" onClick={closeMobileMenu}>Depoimentos</Link>
              </div>
            </div>

            <div className="nav-mobile-item">
              <button
                type="button"
                className={`nav-mobile-trigger ${activeMobileSection === 'produtos' ? 'is-open' : ''}`}
                onClick={() => toggleMobileSection('produtos')}
                aria-expanded={activeMobileSection === 'produtos'}
              >
                <span>Produtos</span>
                <ChevronDown size={18} />
              </button>
              <div className={`nav-mobile-sub ${activeMobileSection === 'produtos' ? 'is-open' : ''}`}>
                <Link to="/produtos" onClick={closeMobileMenu} style={{ fontWeight: 'bold', color: '#374c92' }}>Ver Todos os Produtos</Link>
                <hr style={{ border: '0', borderTop: '1px solid rgba(255, 255, 255, 0.2)', margin: '5px 0' }} />
                {renderProductCategoryLinks(closeMobileMenu)}
              </div>
            </div>

            <div className="nav-mobile-item">
              <button
                type="button"
                className={`nav-mobile-trigger ${activeMobileSection === 'servicos' ? 'is-open' : ''}`}
                onClick={() => toggleMobileSection('servicos')}
                aria-expanded={activeMobileSection === 'servicos'}
              >
                <span>Serviços</span>
                <ChevronDown size={18} />
              </button>
              <div className={`nav-mobile-sub ${activeMobileSection === 'servicos' ? 'is-open' : ''}`}>
                <Link to="/suporte" onClick={closeMobileMenu}>Suporte</Link>
                <Link to="/assistencia-tecnica" onClick={closeMobileMenu}>Assistência Técnica</Link>
              </div>
            </div>

            <Link to="/contato" onClick={closeMobileMenu}>Contato</Link>
            <Link to="/cursos" onClick={closeMobileMenu}>Cursos</Link>

            <div className="nav-mobile-item">
              <button
                type="button"
                className={`nav-mobile-trigger ${activeMobileSection === 'sac' ? 'is-open' : ''}`}
                onClick={() => toggleMobileSection('sac')}
                aria-expanded={activeMobileSection === 'sac'}
              >
                <span>SAC</span>
                <ChevronDown size={18} />
              </button>
              <div className={`nav-mobile-sub ${activeMobileSection === 'sac' ? 'is-open' : ''}`}>
                <Link to="/sac" onClick={closeMobileMenu}>Fale Conosco</Link>
                <Link to="/politicas-troca" onClick={closeMobileMenu}>Políticas de Troca</Link>
              </div>
            </div>

            <div className="social-links">
              <Facebook size={24} />
              <Instagram size={24} />
              <Youtube size={24} />
            </div>
          </nav>
        </header>
      )}

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/painel"
            element={
              <ProtectedAdminRoute>
                {withRouteLoader(<Admin />, 'Carregando painel...')}
              </ProtectedAdminRoute>
            }
          />
          <Route path="/privacidade" element={withRouteLoader(<PrivacyPolicy />, 'Carregando politica de privacidade...')} />

          <Route path="/quem-somos" element={withRouteLoader(<QuemSomos />, 'Carregando pagina institucional...')} />
          <Route path="/historia-diretoria" element={withRouteLoader(<HistoriaDiretoria />, 'Carregando historia e diretoria...')} />
          <Route path="/depoimentos" element={<PagePlaceholder title="Depoimentos" />} />

          <Route path="/produtos" element={withRouteLoader(<ProductCatalog />, 'Carregando catalogo...')} />
          <Route path="/categoria/talmax-digital" element={withRouteLoader(<TalmaxDigital />, 'Carregando Talmax Digital...')} />
          <Route path="/grupo-digital/:slug" element={withRouteLoader(<DigitalGroupPage />, 'Carregando grupo digital...')} />
          <Route path="/upcera" element={withRouteLoader(<Upcera />, 'Carregando Upcera...')} />
          <Route path="/scanners" element={withRouteLoader(<Scanners />, 'Carregando scanners...')} />
          <Route path="/impressoras-3d" element={withRouteLoader(<Impressoras3D />, 'Carregando impressoras 3D...')} />
          <Route path="/pagina/:slug" element={withRouteLoader(<CustomPage />, 'Carregando pagina...')} />
          <Route path="/categoria/:slug" element={withRouteLoader(<ProductCatalog />, 'Carregando catalogo...')} />
          <Route path="/produto/:id" element={withRouteLoader(<ProductDetail />, 'Carregando produto...')} />

          <Route path="/blog" element={<PagePlaceholder title="Blog" />} />

          <Route path="/suporte" element={withRouteLoader(<Support />, 'Carregando suporte...')} />
          <Route
            path="/assistencia-tecnica"
            element={withRouteLoader(<TechnicalAssistance />, 'Carregando assistencia tecnica...')}
          />

          <Route path="/contato" element={<PagePlaceholder title="Formulário de Contato" />} />
          <Route path="/comercial-comex" element={<PagePlaceholder title="Comercial / Comex" />} />

          <Route path="/cursos" element={<PagePlaceholder title="Cursos" />} />
          <Route path="/portal-cliente" element={<PagePlaceholder title="Portal do Cliente" />} />
          <Route path="/sac" element={<PagePlaceholder title="SAC - Fale Conosco" />} />
          <Route path="/politicas-troca" element={<PagePlaceholder title="Políticas de Troca" />} />
        </Routes>
      </main>

      {!isAdmin && (
        <>
          {footerAds.length > 0 && (
            <div className="moby-footer-strips">
              <Swiper
                modules={[Autoplay]}
                className="moby-footer-strips__swiper"
                slidesPerView={1}
                loop={footerAds.length > 1}
                autoHeight
                autoplay={footerAds.length > 1 ? { delay: 4200, disableOnInteraction: false } : false}
                pagination={false}
              >
                {footerAds.map((ad, index) => (
                  <SwiperSlide key={ad.id || `footer-ad-${index}`}>
                    <FooterAdStrip ad={ad} />
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          )}

          {false && (
          <section className="moby-footer-strip" aria-label="Moby Work">
            <div className="moby-footer-strip__inner">
              <span className="moby-footer-strip__logo">moby</span>
              <p>Conheça nossa linha de móveis para sua clínica ou laboratório</p>
              <a
                href="https://mobywork.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="moby-footer-strip__button"
              >
                Conheça a Moby
                <ChevronRight size={20} strokeWidth={1.75} />
              </a>
            </div>
          </section>
          )}

          <footer className="footer">
          <div className="footer-grid">
            <div className="footer-section footer-contact">
              <h4>Contato</h4>
              <p><Mail size={18} /> <span>contato@talmax.com.br</span></p>
              <p><Phone size={18} /> <span>(41) 3012-3456</span></p>
              <p>
                <MapPin size={20} />
                <span>Rua Benedito Carollo, 890<br />Cidade Industrial de Curitiba<br />Curitiba - PR, 81290-060</span>
              </p>
            </div>

            <div className="footer-section footer-links">
              <h4>Ajuda</h4>
              <Link to="/sac">Dúvidas gerais</Link>
              <Link to="/portal-cliente">Pedidos</Link>
              <Link to="/produtos">Produtos</Link>
              <Link to="/contato">Fale Conosco</Link>
              <Link to="/contato">Talmax perto de você</Link>
            </div>

            <div className="footer-section footer-links">
              <h4>Marcas</h4>
              <Link to="/upcera">UPCERA</Link>
              <Link to="/produtos">Shining 3D</Link>
              <Link to="/produtos">Runyes</Link>
              <Link to="/produtos">Ceramotion</Link>
              <Link to="/produtos">Saeyang</Link>
              <Link to="/produtos">EFF</Link>
            </div>

            <div className="footer-section footer-brand">
              <img src={assetPath('img/Talmaxlogo.logo.webp')} alt="Talmax" className="footer-logo" />
              <p>Inovação e qualidade em produtos odontológicos.</p>
              <div className="footer-social-links" aria-label="Redes sociais">
                <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram size={28} />
                  </a>
                  <a
                    href="https://wa.me/554130123456"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    onClick={() => trackWhatsappClick('footer')}
                  >
                    <WhatsAppIcon size={28} />
                  </a>
                <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                  <Linkedin size={28} />
                </a>
                <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook size={28} />
                </a>
                <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                  <Youtube size={28} />
                </a>
              </div>
            </div>

            <div className="footer-section">
              <img src={assetPath('img/Talmaxlogo.logo.webp')} alt="TALMAX" className="footer-logo" />
              <p>Inovação e qualidade em produtos odontológicos.</p>
              <div className="social-links">
                <Facebook size={20} />
                <Instagram size={20} />
                <Youtube size={20} />
              </div>
            </div>
            <div className="footer-section">
              <h4>Contato</h4>
              <p><Mail size={16} /> contato@talmax.com.br</p>
              <p><Phone size={16} /> (41) 3012-3456</p>
            </div>
            <div className="footer-section">
              <h4>Endereço</h4>
              <p><MapPin size={16} /> Rua Benedito Carollo, 890 - Cidade Industrial de Curitiba</p>
              <p>Curitiba - PR - 81290-060</p>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="footer-bottom__inner">
              <nav className="footer-legal-links" aria-label="Links legais">
                <Link to="/privacidade">Política de privacidade</Link>
                <Link to="/privacidade">Política de cookies</Link>
                <Link to="/privacidade">Termos de uso</Link>
              </nav>
              <p>Copyright &copy; {new Date().getFullYear()} Talmax. Todos os direitos reservados. | Talmax - Produtos para Prótese Odontológica | CNPJ: 00.130.762/0001-02</p>
            </div>
            <p>&copy; {new Date().getFullYear()} Talmax. Todos os direitos reservados. | <Link to="/privacidade">Política de Privacidade</Link></p>
          </div>
          </footer>
        </>
      )}

      {!isAdmin && <CookieBanner />}
    </div>
  );
};

export default App;
