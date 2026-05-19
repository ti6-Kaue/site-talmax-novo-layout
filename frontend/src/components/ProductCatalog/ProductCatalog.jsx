/**
 * Pagina: ProductCatalog
 * Rota: /produtos e /categoria/:slug
 * Responsabilidade: listar produtos e aplicar filtros por busca e categoria
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
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
import { apiAssetPath } from '../../utils/assets';
import { parseSafeExtraData } from '../../utils/contentSafety';
import { getNormalizedCategoryNames, getVisibleCategoryLabel } from '../../utils/productCategories';
import { normalizeSearchText } from '../../utils/searchText';
import './ProductCatalog.css';

const ITEMS_PER_PAGE = 20;

const CustomPagination = ({ total, current, onChange }) => {
  const pages = [];
  for (let i = 1; i <= total; i++) {
    pages.push(i);
  }

  // Lógica para mostrar apenas algumas páginas se houver muitas
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
  'Ligas Metálicas',
  'Soldas',
  'Corte e Acabamento',
  'Microscópio e Lupa',
  'Equipamentos',
  'Acessórios para Cerâmica',
  'T-Lithium',
  'Talmax Digital',
  'Blocos',
  'Linha Cad/Cam',
  'Linha de Ceramicas',
  'Resinas',
  'Prótese Dentária',
  'Nail e Podologia'
];

const normalizedFeaturedCategoryOrder = featuredCategoryOrder.map(normalizeSearchText);

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
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSubcategorySlug, setActiveSubcategorySlug] = useState('');

  // Sincroniza o estado inicial e as mudanças de URL
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
    
    // Sempre volta para a primeira página ao mudar busca ou categoria na URL
    setCurrentPage(1);
  }, [location.search, slug, allCategories]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      setIsLoading(true);
      try {
        
        // Se houver busca, pedimos para a API filtrar para garantir consistência

        const [prodRes, catRes] = await Promise.all([
          fetch(`${API_URL}/products`, { signal: controller.signal }),
          fetch(`${API_URL}/categories`, { signal: controller.signal })
        ]);

        if (!prodRes.ok) {
          throw new Error('Erro ao carregar produtos do catalogo');
        }

        if (!catRes.ok) {
          throw new Error('Erro ao carregar categorias do catalogo');
        }

        const prodData = await prodRes.json();
        const catData = await catRes.json();
        setAllCategories(catData);

        // Se a API retornou um objeto com paginação (comum em buscas), pegamos os itens
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
            allCategoryNames: productCatNames,
            category_names: product.category_names || '',
            categoryIds: Array.isArray(product.category_ids) ? product.category_ids.map(Number) : [],
            subCategoryIds: Array.isArray(product.sub_category_ids) ? product.sub_category_ids.map(Number) : [],
            is_upcera: product.is_upcera === true || Number(product.is_upcera) === 1,
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
        console.error('Erro ao carregar dados do catálogo:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, []);

  const activeCategoryLabel = useMemo(() => {
    if (activeCategories.length === 0) return 'Ver todos';
    if (activeCategories.length === 1) return activeCategories[0];
    return `${activeCategories.length} categorias selecionadas`;
  }, [activeCategories]);

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

  // Paginação
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

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
    
    // Atualizar a URL sem recarregar a página (opcional, mas recomendado para consistência)
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
    const targetPath = activeRouteCategory?.slug ? `/categoria/${activeRouteCategory.slug}` : location.pathname;
    navigate(`${targetPath}${queryString ? `?${queryString}` : ''}`, { replace: true });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setActiveCategories([]);
    setCurrentPage(1);
    setIsDrawerOpen(false);
    navigate('/produtos');
  };

  const activeRouteCategoryBannerUrl = activeRouteCategory?.page_banner_categorias_url || '';

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

          <section className={`category-page-intro ${!activeRouteCategoryBannerUrl ? 'category-page-intro--no-banner' : ''}`}>
            <div className="category-page-intro__inner">
              <h1>{activeRouteCategory.name}</h1>

              {activeRouteSubcategories.length > 0 && (
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

      {activeCategories.length === 1 && activeCategories[0] === 'Talmax Digital' && (
        <section className="digital-quick-nav">
          <div className="quick-nav-grid">
            {[
              { id: 'upcera', title: 'UPCERA', desc: 'Cerâmicas e Discos', icon: 'U' },
              { id: 'scanners', title: 'SCANNERS', desc: 'Intraoral e Bancada', icon: 'S' },
              { id: 'impressoras', title: 'IMPRESSORAS 3D', desc: 'Anycubic e Resinas', icon: '3D' },
              { id: 'componentes', title: 'COMPONENTES', desc: 'Peças e Estruturas', icon: 'C' },
              { id: 'insumos', title: 'INSUMOS', desc: 'Blocos e Ceras', icon: 'I' }
            ].map((item) => (
              <div
                key={item.id}
                className="quick-card-standard"
                onClick={() => {
                  if (item.id === 'upcera') {
                    navigate('/upcera');
                  } else {
                    handleSearchChange(item.title);
                    setActiveCategories([]);
                  }
                }}
              >
                <div className="card-icon-box">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <div className="card-arrow">
                  <ChevronRight size={16} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!(activeCategories.length === 1 && activeCategories[0] === 'Talmax Digital') && (
        <header className="catalog-top-nav">
          <div className="top-nav-inner">
            <div className="category-quick-info">
              <span className="active-cat-label">{activeCategoryLabel}</span>
              <span className="results-count">{filteredProducts.length} itens</span>
            </div>

            <div className="catalog-actions">
              <div className="search-minimalist">
                <Search size={18} color="#86868b" />
                <input
                  type="text"
                  placeholder="O que você procura?"
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                />
              </div>
              <button
                className={`btn-filter-toggle ${activeCategories.length > 0 ? 'has-filters' : ''}`}
                onClick={() => setIsDrawerOpen(true)}
              >
                <SlidersHorizontal size={18} />
                <span>Filtrar</span>
              </button>
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
                <button className="btn-close-drawer" onClick={() => setIsDrawerOpen(false)}>
                  <X size={24} />
                </button>
              </div>

              <div className="drawer-content">
                <div className="options-stack">
                  <button
                    className={activeCategories.length === 0 ? 'active' : ''}
                    onClick={resetFilters}
                  >
                    Ver todos
                  </button>

                  {categoriesTree.map((category) => (
                    <div key={category.id} className="category-group">
                      <button
                        className={`parent-cat ${activeCategories.includes(category.name) ? 'active' : ''}`}
                        onClick={() => handleCategorySelect(category.name)}
                      >
                        {category.name}
                        {activeCategories.includes(category.name) && <ChevronRight size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="drawer-footer">
                <button className="btn-apply" onClick={() => setIsDrawerOpen(false)}>
                  Ver Resultados
                </button>
                <button className="btn-clear-all" onClick={resetFilters}>
                  Limpar Filtros
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
            <p>Sincronizando catálogo...</p>
          </div>
        ) : activeCategories.length === 1 && activeCategories[0] === 'Talmax Digital' ? null : (
          <>
            <div className={`catalog-grid-lux ${activeCategories.length === 1 && activeCategories[0] === 'Talmax Digital' ? 'five-cols' : ''}`}>
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
