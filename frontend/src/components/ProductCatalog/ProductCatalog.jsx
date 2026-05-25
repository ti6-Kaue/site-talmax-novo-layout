/**
 * Pagina: ProductCatalog
 * Rota: /produtos e /categoria/:slug
 * Responsabilidade: listar produtos e aplicar filtros por busca e categoria
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import {
  ChevronRight,
  SlidersHorizontal,
  X,
  PackageSearch,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductCard from '../ProductCard/ProductCard';
import API_URL from '../../services/api';
import { trackSearch } from '../../services/analytics';
import pageSettingsService, { normalizeSpecialPageSettings } from '../../services/pageSettingsService';
import { apiAssetPath } from '../../utils/assets';
import { parseSafeExtraData } from '../../utils/contentSafety';
import { getNormalizedCategoryNames, getVisibleCategoryLabel } from '../../utils/productCategories';
import { normalizeSearchText } from '../../utils/searchText';
import 'swiper/css';
import 'swiper/css/navigation';
import './ProductCatalog.css';

const ITEMS_PER_PAGE = 20;

const CustomPagination = ({ total, current, onChange }) => {
  const pages = [];
  for (let i = 1; i <= total; i++) {
    pages.push(i);
  }

  // LÃ³gica para mostrar apenas algumas pÃ¡ginas se houver muitas
  const visiblePages = pages.filter(p => 
    p === 1 || p === total || (p >= current - 2 && p <= current + 2)
  );

  const renderPages = [];
  let lastPage = 0;

  visiblePages.forEach(p => {
    if (lastPage !== 0 && p - lastPage > 1) {
      renderPages.push(<span key={`dots-${p}`} className="pagination-dots">...</span>);
    }
    renderPages.push(
      <button
        key={p}
        className={`pagination-btn ${current === p ? 'active' : ''}`}
        onClick={() => onChange(p)}
      >
        {p}
      </button>
    );
    lastPage = p;
  });

  return (
    <div className="custom-pagination">
      <button 
        className="pagination-arrow" 
        disabled={current === 1} 
        onClick={() => onChange(current - 1)}
      >
        <ChevronLeft size={18} />
      </button>
      
      <div className="pagination-numbers">
        {renderPages}
      </div>

      <button 
        className="pagination-arrow" 
        disabled={current === total} 
        onClick={() => onChange(current + 1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

const featuredCategoryOrder = [
  'Troquelizacao',
  'Duplicadores',
  'Ceras',
  'Revestimentos',
  'Zirkon Ice',
  'Ligas MetÃ¡licas',
  'Soldas',
  'Corte e Acabamento',
  'MicroscÃ³pio e Lupa',
  'Equipamentos',
  'AcessÃ³rios para CerÃ¢mica',
  'T-Lithium',
  'Talmax Digital',
  'Blocos',
  'Linha Cad/Cam',
  'Linha de Ceramicas',
  'Resinas',
  'PrÃ³tese DentÃ¡ria',
  'Nail e Podologia'
];

const normalizedFeaturedCategoryOrder = featuredCategoryOrder.map(normalizeSearchText);

const talmaxDigitalProductGroups = [
  { id: 'fresadoras', title: 'Fresadoras', keywords: ['fresadora', 'fresadoras'] },
  { id: 'scanners', title: 'Scanners', keywords: ['scanner', 'scanners'] },
  { id: 'impressoras', title: 'Impressoras', keywords: ['impressora', 'impressoras', 'impressora 3d', 'impressoras 3d'], subCategoryIds: [63], flag: 'is_3d_printer' },
  { id: 'cad-cam', title: 'CAD/CAM', keywords: ['cad cam', 'cad/cam', 'linha cad cam', 'linha cad/cam'], categoryIds: [15] }
];

const getTalmaxDigitalGroupIndex = (product) => {
  const searchableText = normalizeSearchText([
    product.name,
    product.category,
    product.category_names,
    ...(Array.isArray(product.allCategoryNames) ? product.allCategoryNames : [])
  ].filter(Boolean).join(' '));

  return talmaxDigitalProductGroups.findIndex((group) =>
    group.keywords.some((keyword) => searchableText.includes(normalizeSearchText(keyword)))
    || (group.flag && product[group.flag])
    || (Array.isArray(group.categoryIds) && Array.isArray(product.categoryIds)
      && product.categoryIds.some((categoryId) => group.categoryIds.includes(Number(categoryId))))
    || (Array.isArray(group.subCategoryIds) && Array.isArray(product.subCategoryIds)
      && product.subCategoryIds.some((subCategoryId) => group.subCategoryIds.includes(Number(subCategoryId))))
  );
};

const TalmaxDigitalCarousel = ({ group }) => {
  if (!group.products.length) {
    return null;
  }

  return (
    <section className="talmax-digital-featured-group">
      <div className="talmax-digital-featured-group__inner">
        <div className="talmax-digital-featured__header">
          <h2>{group.title}</h2>
          <p>Produtos Talmax Digital</p>
        </div>

        <div className="talmax-digital-featured__carousel">
          <button
            type="button"
            className={`talmax-digital-featured__nav talmax-digital-featured__nav-prev talmax-digital-featured__nav-prev--${group.id}`}
            aria-label="Produto anterior"
          />
          <button
            type="button"
            className={`talmax-digital-featured__nav talmax-digital-featured__nav-next talmax-digital-featured__nav-next--${group.id}`}
            aria-label="Proximo produto"
          />
          <Swiper
            modules={[Autoplay, Navigation]}
            spaceBetween={10}
            slidesPerView={2}
            loop={group.products.length > 1}
            navigation={{
              prevEl: `.talmax-digital-featured__nav-prev--${group.id}`,
              nextEl: `.talmax-digital-featured__nav-next--${group.id}`
            }}
            autoplay={{ delay: 3500, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 2, spaceBetween: 16 },
              1024: { slidesPerView: 3, spaceBetween: 24 },
              1400: { slidesPerView: 5, spaceBetween: 24 }
            }}
          >
            {group.products.map((product, index) => (
              <SwiperSlide key={product.id}>
                <ProductCard product={product} index={index} imageLoading="lazy" imageFetchPriority="low" />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </section>
  );
};

const TalmaxDigitalCarousels = ({ groups }) => {
  const visibleGroups = groups.filter((group) => group.products.length > 0);

  if (!visibleGroups.length) {
    return null;
  }

  return (
    <section className="talmax-digital-featured">
      {visibleGroups.map((group) => (
        <TalmaxDigitalCarousel key={group.id} group={group} />
      ))}
    </section>
  );
};

const ProductCatalog = () => {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategories, setActiveCategories] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [talmaxDigitalCarouselSettings, setTalmaxDigitalCarouselSettings] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSubcategorySlug, setActiveSubcategorySlug] = useState('');

  // Sincroniza o estado inicial e as mudanÃ§as de URL
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const searchQuery = queryParams.get('busca') || '';
    const categoryQuery = queryParams.get('categoria');
    const subcategoryQuery = queryParams.get('subcategoria') || '';

    // Sincroniza o termo de busca local com a URL
    setSearchTerm(searchQuery);

    if (categoryQuery && allCategories.length > 0) {
      const category = allCategories.find((item) => item.slug === categoryQuery);
      if (category) {
        const parentCategory = category.parent_id
          ? allCategories.find((item) => Number(item.id) === Number(category.parent_id))
          : category;

        setActiveCategories(parentCategory ? [parentCategory.name] : [category.name]);
        setActiveSubcategorySlug(category.parent_id ? category.slug : subcategoryQuery);
      }
    } else if (slug && allCategories.length > 0) {
      const category = allCategories.find((item) => item.slug === slug);
      if (category) {
        const parentCategory = category.parent_id
          ? allCategories.find((item) => Number(item.id) === Number(category.parent_id))
          : category;

        setActiveCategories(parentCategory ? [parentCategory.name] : [category.name]);
        setActiveSubcategorySlug(category.parent_id ? category.slug : subcategoryQuery);
      }
    } else if (!categoryQuery && !slug) {
      setActiveCategories([]);
      setActiveSubcategorySlug('');
    } else {
      setActiveSubcategorySlug(subcategoryQuery);
    }
    
    // Sempre volta para a primeira pÃ¡gina ao mudar busca ou categoria na URL
    setCurrentPage(1);
  }, [location.search, slug, allCategories]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      setIsLoading(true);
      try {
        
        // Se houver busca, pedimos para a API filtrar para garantir consistÃªncia

        const [prodRes, catRes, pageSettingsItems] = await Promise.all([
          fetch(`${API_URL}/products`, { signal: controller.signal }),
          fetch(`${API_URL}/categories`, { signal: controller.signal }),
          pageSettingsService.getAll().catch(() => [])
        ]);

        if (!prodRes.ok) {
          throw new Error('Erro ao carregar produtos do catalogo');
        }

        if (!catRes.ok) {
          throw new Error('Erro ao carregar categorias do catalogo');
        }

        const prodData = await prodRes.json();
        const catData = await catRes.json();
        const normalizedSettings = normalizeSpecialPageSettings(pageSettingsItems);
        setAllCategories(catData);
        setTalmaxDigitalCarouselSettings(normalizedSettings['talmax-digital']?.carousel_categories || []);

        // Se a API retornou um objeto com paginaÃ§Ã£o (comum em buscas), pegamos os itens
        const rawProducts = Array.isArray(prodData) ? prodData : (prodData.items || []);

        const segmentSlugs = ['talmax-digital', 'protese-dentaria', 'nail-e-podologia'];
        const segmentNames = catData
          .filter((category) => segmentSlugs.includes(category.slug))
          .map((category) => category.name);

        const formattedProducts = rawProducts.map((product) => {
          const extra = parseSafeExtraData(product.extra_data);
          const productCatNames = getNormalizedCategoryNames(product.category_names);

          return {
            id: product.id,
            name: product.name,
            description: product.description || extra.description || extra.features?.[0] || '',
            allCategoryNames: productCatNames,
            category_names: product.category_names || '',
            categoryIds: Array.isArray(product.category_ids) ? product.category_ids.map(Number) : [],
            subCategoryIds: Array.isArray(product.sub_category_ids) ? product.sub_category_ids.map(Number) : [],
            is_upcera: product.is_upcera === true || Number(product.is_upcera) === 1,
            is_3d_printer: product.is_3d_printer === true || Number(product.is_3d_printer) === 1,
            category: getVisibleCategoryLabel(productCatNames, segmentNames),
            image: product.main_image ? apiAssetPath(product.main_image) : '',
            ...extra,
            images: Array.isArray(extra.images) ? extra.images.map((image) => apiAssetPath(image)).filter(Boolean) : extra.images
          };
        });

        setProducts(formattedProducts);
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }
        console.error('Erro ao carregar dados do catÃ¡logo:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, []);

  const routeCategory = useMemo(() => {
    const queryParams = new URLSearchParams(location.search);
    const routeCategorySlug = queryParams.get('categoria') || slug || '';

    if (!routeCategorySlug) {
      return null;
    }

    return allCategories.find((category) => category.slug === routeCategorySlug) || null;
  }, [allCategories, location.search, slug]);

  const activeRouteCategory = useMemo(() => {
    if (!routeCategory) {
      return null;
    }

    if (!routeCategory.parent_id) {
      return routeCategory;
    }

    return allCategories.find((category) => Number(category.id) === Number(routeCategory.parent_id)) || routeCategory;
  }, [allCategories, routeCategory]);

  const activeRouteSubcategories = useMemo(() => {
    if (!activeRouteCategory || activeRouteCategory.parent_id) {
      return [];
    }

    return allCategories.filter((category) => (
      Number(category.parent_id) === Number(activeRouteCategory.id)
      && category.is_visible !== false
      && Number(category.is_visible ?? 1) !== 0
    ));
  }, [activeRouteCategory, allCategories]);

  const activeRouteSubcategory = useMemo(() => (
    activeRouteSubcategories.find((category) => category.slug === activeSubcategorySlug) || null
  ), [activeRouteSubcategories, activeSubcategorySlug]);

  const categoryMatchesProduct = useCallback((product, category) => {
    if (!category) {
      return true;
    }

    const categoryId = Number(category.id);
    const productCategoryIds = Array.isArray(product.categoryIds) ? product.categoryIds.map(Number) : [];
    const productSubCategoryIds = Array.isArray(product.subCategoryIds) ? product.subCategoryIds.map(Number) : [];
    const allCategoryNames = Array.isArray(product.allCategoryNames) ? product.allCategoryNames : [];

    if (category.parent_id) {
      return (
        productSubCategoryIds.includes(categoryId)
        || allCategoryNames.some((name) => normalizeSearchText(String(name)) === normalizeSearchText(String(category.name)))
      );
    }

    const childIds = allCategories
      .filter((item) => Number(item.parent_id) === categoryId)
      .map((item) => Number(item.id));
    const namesToMatch = [
      category.name,
      ...allCategories
        .filter((item) => Number(item.parent_id) === categoryId)
        .map((item) => item.name)
    ];

    return (
      productCategoryIds.includes(categoryId)
      || productSubCategoryIds.some((id) => childIds.includes(Number(id)))
      || allCategoryNames.some((name) =>
        namesToMatch.some((catToMatch) =>
          normalizeSearchText(String(name)) === normalizeSearchText(String(catToMatch))
        )
      )
    );
  }, [allCategories]);

  const categoriesTree = useMemo(() => {
    const filteredCategories = allCategories.filter((category) =>
      normalizedFeaturedCategoryOrder.includes(normalizeSearchText(category.name))
    );

    return filteredCategories.sort(
      (a, b) =>
        normalizedFeaturedCategoryOrder.indexOf(normalizeSearchText(a.name)) -
        normalizedFeaturedCategoryOrder.indexOf(normalizeSearchText(b.name))
    );
  }, [allCategories]);

  const filteredProducts = useMemo(() => {
    const normalizedTerm = normalizeSearchText(searchTerm);

    if (!normalizedTerm && activeCategories.length === 0 && !activeRouteSubcategory) {
      return products;
    }

    const results = products.filter((product) => {
      const productName = String(product.name || '');

      const normName = normalizeSearchText(productName);
      const matchesSearch = !normalizedTerm || normName.includes(normalizedTerm);

      if (activeCategories.length === 0 && !activeRouteSubcategory) {
        return matchesSearch;
      }

      const selectedCategoryObjects = activeRouteSubcategory
        ? [activeRouteSubcategory]
        : activeCategories
          .map((selectedCategoryName) => allCategories.find((category) => category.name === selectedCategoryName))
          .filter(Boolean);

      const matchesCategory = selectedCategoryObjects.length === 0
        || selectedCategoryObjects.some((category) => categoryMatchesProduct(product, category));

      return matchesSearch && matchesCategory;
    });
    return results;
  }, [searchTerm, activeCategories, activeRouteSubcategory, products, allCategories, categoryMatchesProduct]);

  // PaginaÃ§Ã£o
  useEffect(() => {
    const normalizedTerm = searchTerm.trim();

    if (normalizedTerm.length < 2) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      trackSearch({
        searchTerm: normalizedTerm,
        resultCount: filteredProducts.length,
        source: 'catalog'
      });
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [filteredProducts.length, searchTerm]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const isTalmaxDigitalCategory = activeCategories.length === 1 && activeCategories[0] === 'Talmax Digital';
  const talmaxDigitalCarouselGroups = useMemo(() => {
    const configuredCategories = Array.isArray(talmaxDigitalCarouselSettings)
      ? talmaxDigitalCarouselSettings
      : [];

    if (configuredCategories.length > 0) {
      return configuredCategories.map((category) => ({
        id: `category-${category.id}`,
        title: category.name,
        products: products
          .filter((product) => categoryMatchesProduct(product, category))
          .sort((productA, productB) =>
            String(productA.name || '').localeCompare(String(productB.name || ''), 'pt-BR')
          )
      }));
    }

    return talmaxDigitalProductGroups.map((group, groupIndex) => ({
      ...group,
      products: products
        .filter((product) => getTalmaxDigitalGroupIndex(product) === groupIndex)
        .sort((productA, productB) =>
          String(productA.name || '').localeCompare(String(productB.name || ''), 'pt-BR')
        )
    }));
  }, [categoryMatchesProduct, products, talmaxDigitalCarouselSettings]);

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
    
    // Atualizar a URL sem recarregar a pÃ¡gina (opcional, mas recomendado para consistÃªncia)
    const params = new URLSearchParams(location.search);
    if (value) {
      params.set('busca', value);
    } else {
      params.delete('busca');
    }
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  const handleCategorySelect = (categoryName) => {
    const nextCategories = activeCategories.includes(categoryName)
      ? activeCategories.filter((item) => item !== categoryName)
      : [...activeCategories, categoryName];
    
    setActiveCategories(nextCategories);
    setCurrentPage(1);

    if (window.innerWidth < 768) {
      setIsDrawerOpen(false);
    }
  };

  const handleSubcategorySelect = (subcategorySlug) => {
    const params = new URLSearchParams(location.search);
    const nextSlug = activeSubcategorySlug === subcategorySlug ? '' : subcategorySlug;

    if (nextSlug) {
      params.set('subcategoria', nextSlug);
    } else {
      params.delete('subcategoria');
    }

    setActiveSubcategorySlug(nextSlug);
    setCurrentPage(1);
    const queryString = params.toString();
    navigate(`${location.pathname}${queryString ? `?${queryString}` : ''}`, { replace: true });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setActiveCategories([]);
    setCurrentPage(1);
    setIsDrawerOpen(false);
    navigate('/produtos');
  };

  const activeRouteCategoryBannerUrl = activeRouteCategory?.page_banner_categorias_url || '';
  const shouldShowCatalogTopNav = !isTalmaxDigitalCategory;
  const renderFilterButton = (className = '') => (
    <button
      type="button"
      className={`btn-filter-toggle ${activeCategories.length > 0 ? 'has-filters' : ''} ${className}`.trim()}
      onClick={() => setIsDrawerOpen(true)}
    >
      <SlidersHorizontal size={15} />
      <span>Filtrar</span>
    </button>
  );

  return (
    <div className="catalog-container">
      {activeRouteCategory && (
        <>
          {activeRouteCategoryBannerUrl && (
            <section className="category-page-banner" aria-label={`Banner de ${activeRouteCategory.name}`}>
              <img
                src={apiAssetPath(activeRouteCategoryBannerUrl)}
                alt=""
                aria-hidden="true"
                className="category-page-banner__image"
              />
            </section>
          )}

          <section className={`category-page-intro ${!activeRouteCategoryBannerUrl ? 'category-page-intro--no-banner' : ''} ${isTalmaxDigitalCategory ? 'category-page-intro--talmax-digital' : ''}`}>
            <div className="category-page-intro__inner">
              <div className="category-page-title-row">
                <h1>{activeRouteCategory.name}</h1>
                <div className="category-page-tools">
                  <span className="category-page-count">{filteredProducts.length} itens</span>
                  {renderFilterButton('btn-filter-toggle--category')}
                </div>
              </div>

              {!isTalmaxDigitalCategory && activeRouteSubcategories.length > 0 && (
                <nav className="category-subnav" aria-label={`Subcategorias de ${activeRouteCategory.name}`}>
                  <button
                    type="button"
                    className={!activeSubcategorySlug ? 'active' : ''}
                    onClick={() => handleSubcategorySelect('')}
                  >
                    Todas
                    <ChevronRight size={18} />
                  </button>
                  {activeRouteSubcategories.map((category) => (
                    <button
                      key={`${category.parent_id}-${category.id}`}
                      type="button"
                      className={activeSubcategorySlug === category.slug ? 'active' : ''}
                      onClick={() => handleSubcategorySelect(category.slug)}
                    >
                      {category.name}
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </nav>
              )}
            </div>
          </section>
        </>
      )}

      {isTalmaxDigitalCategory && (
        <TalmaxDigitalCarousels groups={talmaxDigitalCarouselGroups} />
      )}

      {shouldShowCatalogTopNav && !activeRouteCategory && (
        <header className="catalog-top-nav catalog-top-nav--actions-only">
          <div className="top-nav-inner">
            <div className="catalog-actions">
              <span className="category-page-count">{filteredProducts.length} itens</span>
              {renderFilterButton()}
            </div>
          </div>
        </header>
      )}

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="drawer-overlay"
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 250 }}
              className="filter-drawer"
            >
              <div className="drawer-header">
                <h2>Categorias</h2>
                <button
                  type="button"
                  className="btn-close-drawer"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Fechar filtros"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="drawer-content">
                <div className="options-stack">
                  <button
                    type="button"
                    className={`filter-option filter-option--all ${activeCategories.length === 0 ? 'active' : ''}`}
                    onClick={resetFilters}
                  >
                    <span>Ver todos</span>
                    <span className="filter-option__arrow" aria-hidden="true">
                      <ChevronRight size={20} />
                    </span>
                  </button>

                  {categoriesTree.map((category) => (
                    <div key={category.id} className="category-group">
                      <button
                        type="button"
                        className={`filter-option parent-cat ${activeCategories.includes(category.name) ? 'active' : ''}`}
                        onClick={() => handleCategorySelect(category.name)}
                      >
                        <span>{category.name}</span>
                        <span className="filter-option__arrow" aria-hidden="true">
                          <ChevronRight size={20} />
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="drawer-footer">
                <button type="button" className="btn-apply" onClick={() => setIsDrawerOpen(false)}>
                  Ver Resultados
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                <button type="button" className="btn-clear-all" onClick={resetFilters}>
                  Limpar Filtros
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="catalog-viewport">
        {isLoading ? (
          <div className="pro-loader">
            <div className="spinner-lux"></div>
            <p>Sincronizando catÃ¡logo...</p>
          </div>
        ) : isTalmaxDigitalCategory ? null : (
          <>
            <div className="catalog-grid-lux">
              <AnimatePresence mode="popLayout">
                {paginatedProducts.length > 0 ? (
                  paginatedProducts.map((product, index) => (
                    <ProductCard key={product.id} product={product} index={index} />
                  ))
                ) : (
                  <div className="empty-state">
                    <PackageSearch size={60} strokeWidth={1} color="#d2d2d7" />
                    <h3>Nenhum produto encontrado</h3>
                    <p>Tente ajustar sua busca ou filtro para encontrar o que deseja.</p>
                    <button onClick={resetFilters} className="btn-clear-filters">
                      Ver todos os produtos
                    </button>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {totalPages > 1 && (
              <div className="catalog-pagination">
                <CustomPagination
                  total={totalPages}
                  current={currentPage}
                  onChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ProductCatalog;
