import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Package, Search, ExternalLink, Filter, Check, ChevronDown, Edit, Eye, EyeOff } from 'lucide-react';
import { useAdmin } from '../../../context/useAdmin';
import { apiAssetPath } from '../../../utils/assets';
import { parseSafeExtraData } from '../../../utils/contentSafety';
import { normalizeSearchText } from '../../../utils/searchText';
import './AdminProducts.css';

const shouldShowQuoteButton = (value) => !(
  value === false ||
  value === 'false' ||
  value === 0 ||
  value === '0'
);

const getCategoryCount = (product) => {
  const mainCount = Array.isArray(product.category_ids) ? product.category_ids.length : 0;
  const subCount = Array.isArray(product.sub_category_ids) ? product.sub_category_ids.length : 0;

  if (mainCount || subCount) {
    return mainCount + subCount;
  }

  return product.category_names
    ? product.category_names.split(',').map((item) => item.trim()).filter(Boolean).length
    : 0;
};

const getNextQuoteButtonValue = (product) => (
  !shouldShowQuoteButton(parseSafeExtraData(product.extra_data).showQuoteButton)
);

const hasImageAndDescription = (product) => (
  String(product.main_image || '').trim()
  && String(product.description || '').trim()
);

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativos' },
  { value: 'all', label: 'Ver Todos' },
  { value: 'complete', label: 'Completos' },
  { value: 'hidden', label: 'Somente Ocultos' }
];

const getListDescription = (filterStatus, count) => {
  if (filterStatus === 'active') {
    return `${count} item(ns) encontrados`;
  }

  if (filterStatus === 'complete') {
    return `${count} produto(s) com foto principal e descrição.`;
  }

  return `${count} produto(s) encontrados no painel.`;
};

const AdminProductsList = ({ onOpenRegister, onEditProduct }) => {
  const { products, productsHook, addToast } = useAdmin();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const statusDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!statusDropdownRef.current?.contains(event.target)) {
        setIsStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm);

    let result = products.filter((product) => {
      const searchableText = [
        product.name,
        product.sku,
        product.id,
        product.category_names
      ]
        .filter(Boolean)
        .map(normalizeSearchText)
        .join(' ');

      return !normalizedSearch || searchableText.includes(normalizedSearch);
    });

    if (filterStatus === 'active') {
      result = result.filter((product) => product.is_active);
    } else if (filterStatus === 'complete') {
      result = result.filter((product) => hasImageAndDescription(product));
    } else if (filterStatus === 'hidden') {
      result = result.filter((product) => !product.is_active);
    }

    return result;
  }, [products, searchTerm, filterStatus]);

  const handleToggleStatus = async (event, product) => {
    event.stopPropagation();
    if (togglingId === product.id) return;
    setTogglingId(product.id);
    const newStatus = !product.is_active;
    const result = await productsHook.updateProductActiveStatus(product.id, newStatus);
    setTogglingId(null);
    if (result.success) {
      addToast(
        newStatus
          ? `"${product.name}" ativado no catálogo.`
          : `"${product.name}" ocultado do catálogo.`,
        'success'
      );
    } else {
      addToast('Erro ao atualizar status do produto.', 'error');
    }
  };

  const handleToggleQuoteButton = async (event, product) => {
    event.stopPropagation();
    const nextValue = getNextQuoteButtonValue(product);
    const result = await productsHook.updateProductQuoteButtonStatus(product.id, nextValue);

    if (result.success) {
      addToast(
        nextValue
          ? `"${product.name}" com botão de orçamento ativado.`
          : `"${product.name}" com botão de orçamento desativado.`,
        'success'
      );
    } else {
      addToast('Erro ao atualizar botão de orçamento.', 'error');
    }
  };

  return (
    <div className="admin-products-list-page">
      <div className="admin-card">
        <div className="card-header admin-products-list-header">
          <div>
            <h2><Package size={20} /> Todos os Produtos</h2>
            <p>{getListDescription(filterStatus, filteredProducts.length)}</p>
          </div>
          <div className="admin-products-list-header-actions">
            <div className="filter-group">
              <div className="filter-control filter-control-status" ref={statusDropdownRef}>
                <button
                  type="button"
                  className={`filter-control-status-trigger ${isStatusDropdownOpen ? 'is-open' : ''}`}
                  onClick={() => setIsStatusDropdownOpen((current) => !current)}
                  aria-haspopup="listbox"
                  aria-expanded={isStatusDropdownOpen}
                >
                  <div className="filter-control-icon">
                    <Filter size={14} />
                  </div>
                  <div className="filter-control-copy">
                    <span className="filter-control-label">Status</span>
                    <span className="filter-control-value">
                      {STATUS_OPTIONS.find((option) => option.value === filterStatus)?.label}
                    </span>
                  </div>
                  <ChevronDown size={16} className="filter-control-chevron-icon" />
                </button>

                {isStatusDropdownOpen && (
                  <div className="filter-control-status-menu" role="listbox" aria-label="Filtrar produtos por status">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`filter-control-status-option ${filterStatus === option.value ? 'is-selected' : ''}`}
                        onClick={() => {
                          setFilterStatus(option.value);
                          setIsStatusDropdownOpen(false);
                        }}
                      >
                        <span>{option.label}</span>
                        {filterStatus === option.value && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button type="button" className="btn-primary" onClick={onOpenRegister}>
              <ExternalLink size={16} /> Ir para Cadastro
            </button>
          </div>
        </div>

        <div className="card-body admin-products-list-body">
          <div className="admin-products-list-toolbar">
            <div className="product-list-search admin-products-list-search">
              <Search size={16} className="product-search-icon" />
              <input
                type="text"
              placeholder="Buscar por nome, SKU, ID ou categoria..."
                className="product-search-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="admin-table-container">
            <table className="admin-table admin-products-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categorias</th>
                  <th>Orçamento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="admin-products-table__row"
                  >
                    <td>
                      <div className="admin-products-table__product">
                        {product.main_image && (
                          <img
                            src={apiAssetPath(product.main_image)}
                            alt={product.name}
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div>
                          <strong>{product.name}</strong>
                          <span>ID: #{product.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-soft-blue ${getCategoryCount(product) === 0 ? 'badge-secondary' : ''}`}>
                        {getCategoryCount(product)} categoria(s)
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`status-badge product-quote-toggle ${shouldShowQuoteButton(parseSafeExtraData(product.extra_data).showQuoteButton) ? 'status-active' : 'status-inactive'}`}
                        onClick={(event) => handleToggleQuoteButton(event, product)}
                        title="Alternar botão de orçamento"
                      >
                        {shouldShowQuoteButton(parseSafeExtraData(product.extra_data).showQuoteButton) ? 'Com botão' : 'Sem botão'}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`status-badge ${product.is_active ? 'status-active' : 'status-inactive'}${togglingId === product.id ? ' is-toggling' : ''}`}
                        onClick={(event) => handleToggleStatus(event, product)}
                        disabled={togglingId === product.id}
                        title={product.is_active ? 'Clique para ocultar do catálogo' : 'Clique para ativar no catálogo'}
                      >
                        {product.is_active ? (
                          <Eye size={12} />
                        ) : (
                          <EyeOff size={12} />
                        )}
                        {product.is_active ? 'Ativo' : 'Oculto'}
                      </button>
                    </td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn-icon edit"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditProduct(product);
                        }}
                        title="Editar produto"
                      >
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="product-empty-state">Nenhum produto encontrado.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProductsList;
