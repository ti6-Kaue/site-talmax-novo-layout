import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import API_URL from '../services/api';
import { trackProductClick, trackSearch } from '../services/analytics';
import { apiAssetPath } from '../utils/assets';
import { parseSafeExtraData } from '../utils/contentSafety';
import { getNormalizedCategoryNames } from '../utils/productCategories';
import { normalizeSearchText } from '../utils/searchText';

const MAX_SEARCH_SUGGESTIONS = 10;
const MIN_SEARCH_TERM_LENGTH = 2;
const SEARCH_FETCH_DELAY_MS = 180;

const SEARCH_ROUTES = [
  { path: '/', keywords: ['home', 'inicio', 'principal'] },
  { path: '/quem-somos', keywords: ['quem somos', 'empresa', 'talmax'] },
  { path: '/historia-diretoria', keywords: ['historia', 'diretoria', 'institucional'] },
  { path: '/produtos', keywords: ['produtos', 'catalogo', 'produto'] },
  { path: '/categoria/talmax-digital', keywords: ['talmax digital', 'digital', 'cad cam'] },
  { path: '/upcera', keywords: ['upcera', 'zirconia'] },
  { path: '/scanners', keywords: ['scanner', 'scanners'] },
  { path: '/impressoras-3d', keywords: ['impressora 3d', 'impressoras 3d', '3d'] },
  { path: '/suporte', keywords: ['suporte', 'ajuda'] },
  { path: '/contato', keywords: ['contato', 'fale conosco', 'comercial'] },
  { path: '/cursos', keywords: ['cursos', 'curso', 'treinamento'] },
  { path: '/sac', keywords: ['sac', 'troca', 'politicas'] }
];

const PRODUCT_TERMS = [
  'produto',
  'produtos',
  'catalogo',
  'catalog',
  'upcera',
  'scanner',
  'scanners',
  'impressora',
  'impressoras',
  'impressora 3d',
  'impressoras 3d',
  'resina',
  'zirconia',
  'cad cam',
  'protese',
  'odontologica',
  'odontologico'
];

const isCatalogPath = (pathname = '') =>
  pathname === '/produtos' || pathname.startsWith('/categoria/');

const getSearchTermFromLocation = (search = '') => (
  new URLSearchParams(search).get('busca') || ''
);

const buildSearchPath = (pathname, search, value) => {
  const params = new URLSearchParams(search);
  const trimmedValue = value.trim();

  if (trimmedValue) {
    params.set('busca', trimmedValue);
  } else {
    params.delete('busca');
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
};

const formatSearchProduct = (product) => {
  const extra = parseSafeExtraData(product.extra_data);
  const fallbackImage = Array.isArray(extra.images) ? extra.images[0] : '';
  const categoryLabel = getNormalizedCategoryNames(product.category_names)
    .slice(0, 2)
    .join(' / ');

  return {
    id: product.id,
    name: product.name || '',
    description: product.description || extra.features?.[0] || '',
    categoryLabel,
    image: product.main_image ? apiAssetPath(product.main_image) : (fallbackImage ? apiAssetPath(fallbackImage) : '')
  };
};

const resolveSearchDestination = (rawSearchTerm) => {
  const trimmedSearchTerm = rawSearchTerm.trim();
  const normalizedTerm = normalizeSearchText(trimmedSearchTerm);

  if (!normalizedTerm) {
    return null;
  }

  const shouldGoToCatalog = PRODUCT_TERMS.some((term) => {
    const normalizedKeyword = normalizeSearchText(term);

    return (
      normalizedKeyword === normalizedTerm ||
      normalizedKeyword.includes(normalizedTerm) ||
      normalizedTerm.includes(normalizedKeyword)
    );
  });

  if (shouldGoToCatalog) {
    return `/produtos?busca=${encodeURIComponent(trimmedSearchTerm)}`;
  }

  const matchedRoute = SEARCH_ROUTES.find((item) =>
    item.keywords.some((keyword) => {
      const normalizedKeyword = normalizeSearchText(keyword);

      return (
        normalizedKeyword === normalizedTerm ||
        normalizedKeyword.includes(normalizedTerm) ||
        normalizedTerm.includes(normalizedKeyword)
      );
    })
  );

  return matchedRoute ? matchedRoute.path : `/produtos?busca=${encodeURIComponent(trimmedSearchTerm)}`;
};

export const useProductSearch = ({ isAdmin, onNavigateComplete } = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const previousPathnameRef = useRef(location.pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => getSearchTermFromLocation(location.search));
  const [searchProducts, setSearchProducts] = useState([]);
  const [searchProductsLoaded, setSearchProductsLoaded] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchPreviewId, setSearchPreviewId] = useState(null);

  const normalizedSearchTerm = normalizeSearchText(searchTerm);
  const shouldShowDropdown = normalizedSearchTerm.length >= MIN_SEARCH_TERM_LENGTH;

  const productSearchMatches = useMemo(() => {
    if (isAdmin || normalizedSearchTerm.length < MIN_SEARCH_TERM_LENGTH) {
      return [];
    }

    return searchProducts
      .filter((product) => normalizeSearchText(product.name).includes(normalizedSearchTerm))
      .sort((productA, productB) => {
        const normalizedNameA = normalizeSearchText(productA.name);
        const normalizedNameB = normalizeSearchText(productB.name);
        const startsWithA = normalizedNameA.startsWith(normalizedSearchTerm);
        const startsWithB = normalizedNameB.startsWith(normalizedSearchTerm);

        if (startsWithA !== startsWithB) {
          return startsWithA ? -1 : 1;
        }

        const positionA = normalizedNameA.indexOf(normalizedSearchTerm);
        const positionB = normalizedNameB.indexOf(normalizedSearchTerm);

        if (positionA !== positionB) {
          return positionA - positionB;
        }

        return productA.name.localeCompare(productB.name, 'pt-BR');
      });
  }, [isAdmin, normalizedSearchTerm, searchProducts]);

  const productSuggestions = useMemo(
    () => productSearchMatches.slice(0, MAX_SEARCH_SUGGESTIONS),
    [productSearchMatches]
  );

  const previewProduct = useMemo(
    () => productSuggestions.find((product) => product.id === searchPreviewId) || productSuggestions[0] || null,
    [productSuggestions, searchPreviewId]
  );

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (isAdmin) {
      setSearchOpen(false);
      setSearchProducts([]);
      setSearchProductsLoaded(false);
      setSearchDropdownOpen(false);
      setSearchPreviewId(null);
      return undefined;
    }

    if (normalizedSearchTerm.length < MIN_SEARCH_TERM_LENGTH || searchProductsLoaded) {
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    const fetchSearchProducts = async () => {
      try {
        const response = await fetch(`${API_URL}/products`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error('Erro ao carregar produtos da busca');
        }

        const data = await response.json();

        if (!active) {
          return;
        }

        const items = Array.isArray(data) ? data : (data.items || []);
        setSearchProducts(items.map(formatSearchProduct));
        setSearchProductsLoaded(true);
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }

        if (active) {
          console.error('Erro ao carregar produtos da busca:', error);
          setSearchProducts([]);
          setSearchProductsLoaded(false);
        }
      }
    };

    const timeoutId = window.setTimeout(fetchSearchProducts, SEARCH_FETCH_DELAY_MS);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isAdmin, normalizedSearchTerm, searchProductsLoaded]);

  useEffect(() => {
    if (!shouldShowDropdown || productSuggestions.length === 0) {
      setSearchPreviewId(null);
      return;
    }

    setSearchPreviewId((currentPreviewId) => (
      currentPreviewId && productSuggestions.some((product) => product.id === currentPreviewId)
        ? currentPreviewId
        : productSuggestions[0].id
    ));
  }, [productSuggestions, shouldShowDropdown]);

  useEffect(() => {
    const handleDocumentPointerDown = (event) => {
      if (event.target instanceof Element && event.target.closest('[data-site-search-root="true"]')) {
        return;
      }

      setSearchDropdownOpen(false);
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
  }, []);

  useEffect(() => {
    const pathnameChanged = previousPathnameRef.current !== location.pathname;
    previousPathnameRef.current = location.pathname;
    const nextSearchTerm = getSearchTermFromLocation(location.search);

    if (pathnameChanged) {
      setSearchDropdownOpen(false);
      setSearchPreviewId(null);
    } else if (isCatalogPath(location.pathname)) {
      const shouldKeepDropdownOpen = normalizeSearchText(nextSearchTerm).length >= MIN_SEARCH_TERM_LENGTH;
      setSearchDropdownOpen(shouldKeepDropdownOpen);

      if (!shouldKeepDropdownOpen) {
        setSearchPreviewId(null);
      }
    }

    setSearchTerm((currentSearchTerm) => (
      currentSearchTerm === nextSearchTerm ? currentSearchTerm : nextSearchTerm
    ));
  }, [location.pathname, location.search]);

  const resetSearchState = (nextSearchTerm = '') => {
    setSearchTerm(nextSearchTerm);
    setSearchDropdownOpen(false);
    setSearchPreviewId(null);
  };

  const finishSearchNavigation = (path, { nextSearchTerm = '' } = {}) => {
    navigate(path);
    setSearchOpen(false);
    resetSearchState(nextSearchTerm);
    onNavigateComplete?.();
  };

  const handleSearchInputChange = (value) => {
    setSearchTerm(value);
    setSearchDropdownOpen(normalizeSearchText(value).length >= MIN_SEARCH_TERM_LENGTH);

    if (isCatalogPath(location.pathname)) {
      navigate(buildSearchPath(location.pathname, location.search, value), { replace: true });
    }
  };

  const handleSearchInputFocus = () => {
    if (normalizedSearchTerm.length >= MIN_SEARCH_TERM_LENGTH) {
      setSearchDropdownOpen(true);
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    resetSearchState(getSearchTermFromLocation(location.search));
  };

  const toggleSearch = () => {
    if (searchOpen) {
      closeSearch();
      return;
    }

    setSearchOpen(true);
  };

  const handleSearchInputKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (searchOpen) {
        closeSearch();
        return;
      }

      setSearchDropdownOpen(false);
      setSearchPreviewId(null);
      return;
    }

    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && productSuggestions.length > 0) {
      event.preventDefault();
      setSearchDropdownOpen(true);

      const currentIndex = productSuggestions.findIndex(
        (product) => product.id === (searchPreviewId || productSuggestions[0].id)
      );
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + direction + productSuggestions.length) % productSuggestions.length;

      setSearchPreviewId(productSuggestions[nextIndex].id);
    }
  };

  const handleProductSuggestionSelect = (product) => {
    trackProductClick(product, 'search_suggestion');
    finishSearchNavigation(`/produto/${product.id}`);
  };

  const handleViewAllProducts = () => {
    finishSearchNavigation('/produtos');
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    const destination = resolveSearchDestination(searchTerm);

    if (!destination) {
      return;
    }

    trackSearch({
      searchTerm,
      resultCount: productSearchMatches.length,
      source: 'header'
    });

    const nextSearchTerm = destination.includes('?busca=') ? searchTerm.trim() : '';
    finishSearchNavigation(destination, { nextSearchTerm });
  };

  return {
    closeSearch,
    handleProductSuggestionSelect,
    handleSearchInputChange,
    handleSearchInputFocus,
    handleSearchInputKeyDown,
    handleSearchSubmit,
    handleViewAllProducts,
    previewProduct,
    productSuggestions,
    searchInputRef,
    searchMatchesTotal: productSearchMatches.length,
    searchOpen,
    searchTerm,
    setSearchPreviewId,
    shouldShowSearchDropdown: shouldShowDropdown,
    toggleSearch
  };
};
