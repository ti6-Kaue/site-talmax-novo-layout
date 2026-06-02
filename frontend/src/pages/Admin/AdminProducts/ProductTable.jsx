import React, { useMemo, useState } from 'react';
import { Edit, Trash2, Search, List, Plus, Eye, EyeOff } from 'lucide-react';
import { apiAssetPath } from '../../../utils/assets';
import { parseSafeExtraData } from '../../../utils/contentSafety';
import { normalizeSearchText } from '../../../utils/searchText';

const shouldShowQuoteButton = (value) => !(
  value === false ||
  value === 'false' ||
  value === 0 ||
  value === '0'
);

const ProductTable = ({ products, onCreate, onEdit, onDelete, onToggleActive, onToggleQuoteButton, selectedProductId }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm);

    return products.filter((product) => {
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
  }, [products, searchTerm]);

  return (
    <div className="admin-card">
      <div className="card-header product-list-header">
        <div>
          <h2><List size={20} /> Lista de Produtos</h2>
          <p>{filteredProducts.length} item(ns) encontrados</p>
        </div>
        <button className="btn-primary product-list-create" onClick={onCreate}>
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="product-list-search">
        <Search size={16} className="product-search-icon" />
        <input
          type="text"
          placeholder="Buscar por nome, SKU, ID ou categoria..."
          className="product-search-input"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="product-sidebar-list">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className={`product-sidebar-item ${selectedProductId === product.id ? 'active' : ''}`}
            onClick={() => onEdit(product)}
          >
            <div className="product-cell">
              {product.main_image && (
                <img
                  src={apiAssetPath(product.main_image)}
                  alt={product.name}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="product-info">
                <h4>{product.name}</h4>
                <p>{product.sku ? `SKU: ${product.sku}` : `ID: #${product.id}`}</p>
              </div>
            </div>

            <div className="product-badge-container">
              <span className={`status-badge ${product.is_active ? 'status-active' : 'status-inactive'}`}>
                {product.is_active ? 'Ativo' : 'Oculto'}
              </span>
              <button
                type="button"
                className={`status-badge product-quote-toggle ${shouldShowQuoteButton(parseSafeExtraData(product.extra_data).showQuoteButton) ? 'status-active' : 'status-inactive'}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleQuoteButton(product);
                }}
                title="Alternar botão de orçamento"
              >
                {shouldShowQuoteButton(parseSafeExtraData(product.extra_data).showQuoteButton) ? 'Orçamento on' : 'Orçamento off'}
              </button>
            </div>

            <div className="product-sidebar-actions">
              <button
                type="button"
                className="btn-icon"
                title={product.is_active ? 'Ocultar' : 'Ativar'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleActive(product);
                }}
              >
                {product.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                className="btn-icon edit"
                title="Editar"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(product);
                }}
              >
                <Edit size={16} />
              </button>
              <button
                type="button"
                className="btn-icon delete"
                title="Excluir"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(product);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="product-empty-state">
            Nenhum produto encontrado.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductTable;
