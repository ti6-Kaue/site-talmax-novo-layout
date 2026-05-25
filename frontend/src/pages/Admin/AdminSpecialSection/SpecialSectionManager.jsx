import React, { useMemo, useState } from 'react';
import { Search, Save, CheckCircle, ChevronRight } from 'lucide-react';
import { apiAssetPath } from '../../../utils/assets';
import { parseSafeExtraData } from '../../../utils/contentSafety';
import { normalizeSearchText } from '../../../utils/searchText';

const DISPLAY_MODE_OPTIONS = [
  { value: 'description', label: 'Descrição' },
  { value: 'features', label: 'Destaques' },
  { value: 'none', label: 'Sem nada' }
];

const getInitialDisplayMode = (product, sectionKey) => {
  const extra = parseSafeExtraData(product.extra_data);
  const storedMode = extra.specialSectionDisplay?.[sectionKey];

  if (storedMode) return storedMode;
  if (Array.isArray(extra.features) && extra.features.length > 0) return 'features';
  if ((product.description || '').trim()) return 'description';
  return 'none';
};

const getInitialOrder = (product, sectionKey) => {
  const extra = parseSafeExtraData(product.extra_data);

  if (sectionKey === 'featured') {
    return extra.featured_order || '';
  }

  return '';
};

const buildSelectedProductsFromScope = (products, sectionKey) => (
  products
    .filter((product) => {
      if (sectionKey === 'featured') return product.is_featured;
      return false;
    })
    .map((product) => ({
      id: product.id,
      displayMode: getInitialDisplayMode(product, sectionKey),
      order: getInitialOrder(product, sectionKey)
    }))
);

const SpecialSectionManager = ({
  sectionTitle,
  sectionKey,
  products,
  mainCategories,
  subCategories = [],
  categoryMatcher,
  supportsDisplayMode = true,
  onSave
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCats, setSelectedCats] = useState([]);
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);

  const allowedSubCategoryIds = useMemo(() => {
    if (!categoryMatcher) return [];
    return subCategories
      .filter(categoryMatcher)
      .map((category) => category.id);
  }, [subCategories, categoryMatcher]);

  const scopedProducts = useMemo(() => {
    if (allowedSubCategoryIds.length === 0) {
      return products;
    }

    return products.filter((product) =>
      product.sub_category_ids && product.sub_category_ids.some((id) => allowedSubCategoryIds.includes(id))
    );
  }, [products, allowedSubCategoryIds]);

  const availableMainCategories = useMemo(() => {
    const mainCategoryIds = new Set();

    scopedProducts.forEach((product) => {
      (product.category_ids || []).forEach((id) => {
        if (mainCategories.some((category) => category.id === id)) {
          mainCategoryIds.add(id);
        }
      });

      (product.sub_category_ids || []).forEach((subCategoryId) => {
        const subCategory = subCategories.find((category) => category.id === subCategoryId);
        if (subCategory?.parent_id) {
          mainCategoryIds.add(Number(subCategory.parent_id));
        }
      });
    });

    return mainCategories.filter((category) => mainCategoryIds.has(category.id));
  }, [scopedProducts, mainCategories, subCategories]);

  const initialSelectedProducts = useMemo(
    () => buildSelectedProductsFromScope(scopedProducts, sectionKey),
    [scopedProducts, sectionKey]
  );

  const [selectedProductsState, setSelectedProductsState] = useState(() => ({
    source: initialSelectedProducts,
    items: initialSelectedProducts
  }));

  if (selectedProductsState.source !== initialSelectedProducts) {
    setSelectedProductsState({
      source: initialSelectedProducts,
      items: initialSelectedProducts
    });
  }

  const selectedProducts = selectedProductsState.items;
  const setSelectedProducts = (updater) => {
    setSelectedProductsState((current) => ({
      ...current,
      items: typeof updater === 'function' ? updater(current.items) : updater
    }));
  };

  const toggleProduct = (product) => {
    const isSelected = selectedProducts.find((item) => item.id === product.id);

    if (isSelected) {
      setSelectedProducts(selectedProducts.filter((item) => item.id !== product.id));
      return;
    }

    setSelectedProducts([...selectedProducts, { id: product.id, order: '', displayMode: getInitialDisplayMode(product, sectionKey) }]);
  };

  const updateOrder = (id, order) => {
    setSelectedProducts(selectedProducts.map((item) =>
      item.id === id ? { ...item, order } : item
    ));
  };

  const updateDisplayMode = (id, displayMode) => {
    setSelectedProducts(selectedProducts.map((item) =>
      item.id === id ? { ...item, displayMode } : item
    ));
  };

  const normalizedSelectedProducts = useMemo(() => {
    return selectedProducts.map((item) => ({
      ...item,
      order: item.order === '' ? 0 : Number(item.order)
    }));
  }, [selectedProducts]);

  const selectedProductsMap = useMemo(() => {
    return new Map(selectedProducts.map((item) => [item.id, item]));
  }, [selectedProducts]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm);

    return [...scopedProducts]
      .filter((product) => {
        const matchesSearch = !normalizedSearch
          || normalizeSearchText(product.name).includes(normalizedSearch);
        const productMainCategoryIds = new Set([
          ...(product.category_ids || []),
          ...(product.sub_category_ids || [])
            .map((subCategoryId) => subCategories.find((category) => category.id === subCategoryId)?.parent_id)
            .filter(Boolean)
            .map(Number)
        ]);
        const matchesCat = selectedCats.length === 0
          || Array.from(productMainCategoryIds).some((id) => selectedCats.includes(id));

        return matchesSearch && matchesCat;
      })
      .sort((a, b) => {
        const selectedA = selectedProductsMap.get(a.id);
        const selectedB = selectedProductsMap.get(b.id);

        if (selectedA && !selectedB) return -1;
        if (!selectedA && selectedB) return 1;

        if (selectedA && selectedB) {
          const orderA = selectedA.order === '' ? Number.MAX_SAFE_INTEGER : Number(selectedA.order);
          const orderB = selectedB.order === '' ? Number.MAX_SAFE_INTEGER : Number(selectedB.order);

          if (orderA !== orderB) {
            return orderA - orderB;
          }
        }

        return a.name.localeCompare(b.name, 'pt-BR');
      });
  }, [scopedProducts, searchTerm, selectedCats, selectedProductsMap, subCategories]);

  return (
    <div className="admin-card">
      <div className="card-header special-section-header">
        <h2><Search size={20} /> Seleção de {sectionTitle}</h2>
        <button className="btn-primary" onClick={() => onSave(normalizedSelectedProducts)}>
          <Save size={18} /> Salvar Alterações
        </button>
      </div>
      <div className="card-body special-section-body">
        <div className="admin-form">
          <div className="special-filters-panel">
            <div className="filter-group">
              <label className="special-filter-label">Buscar Produtos</label>
              <div className="special-search-field">
                <Search size={16} className="special-search-icon" />
                <input
                  type="text"
                  placeholder="Digite o nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="special-search-input"
                />
              </div>
            </div>

            <div className="filter-group">
              <label className="special-filter-label">Filtrar por Categoria</label>
              <div className="custom-multi-select">
                <div
                  className="multi-select-header"
                  onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                >
                  <span>{selectedCats.length === 0 ? 'Todas as categorias' : `${selectedCats.length} selecionada(s)`}</span>
                  <ChevronRight size={16} className={`special-filter-arrow ${isCatDropdownOpen ? 'open' : ''}`} />
                </div>
                {isCatDropdownOpen && (
                  <div className="multi-select-options">
                    {availableMainCategories.map((cat) => (
                      <div
                        key={cat.id}
                        className={`multi-select-option ${selectedCats.includes(cat.id) ? 'selected' : ''}`}
                        onClick={() => setSelectedCats(
                          selectedCats.includes(cat.id)
                            ? selectedCats.filter((id) => id !== cat.id)
                            : [...selectedCats, cat.id]
                        )}
                      >
                        {cat.name} <CheckCircle className="check-icon" size={16} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCats([]);
              }}
              className="btn-secondary special-reset-button"
            >
              Resetar
            </button>
          </div>

          <div className="admin-section-group special-section-card">
            <p className="special-section-hint">
              {supportsDisplayMode
                ? `Selecione quais produtos devem aparecer na página de ${sectionTitle} e defina a ordem.`
                : `Selecione quais produtos devem aparecer em ${sectionTitle} e defina a ordem de exibição.`}
            </p>

            <div className="special-products-list">
              {filteredProducts.map((product) => {
                const selected = selectedProducts.find((item) => item.id === product.id);
                const isSelected = Boolean(selected);

                return (
                  <div
                    key={product.id}
                    className={`product-select-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleProduct(product)}
                  >
                    <div className={`product-select-checkbox ${isSelected ? 'selected' : ''}`}>
                      {isSelected && <CheckCircle size={14} color="white" />}
                    </div>
                    <div className="product-select-image-shell">
                      {product.main_image && (
                        <img
                          src={apiAssetPath(product.main_image)}
                          alt={product.name}
                          className="product-select-image"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div className="product-select-info">
                      <p className="product-select-name">{product.name}</p>
                      <span className="product-select-meta">
                        {isSelected ? 'Selecionado para exibicao' : 'Clique para incluir nesta secao'}
                      </span>
                    </div>
                    {isSelected && (
                      <div onClick={(e) => e.stopPropagation()} className="product-order-group">
                        <label className="product-order-label">Ordem de exibicao</label>
                        <input
                          type="number"
                          value={selected.order}
                          onChange={(e) => updateOrder(product.id, e.target.value)}
                          placeholder="0"
                          className="product-order-input"
                        />
                        {supportsDisplayMode && (
                          <select
                            value={selected.displayMode || 'features'}
                            onChange={(e) => updateDisplayMode(product.id, e.target.value)}
                            className="product-display-mode-select"
                          >
                            {DISPLAY_MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="special-selection-summary">
              <span>{selectedProducts.length} produto(s) selecionados.</span>
              <button className="btn-primary" onClick={() => onSave(normalizedSelectedProducts)}>
                Salvar Lista
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecialSectionManager;
