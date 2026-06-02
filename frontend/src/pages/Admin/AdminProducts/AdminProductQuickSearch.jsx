import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit, PackageSearch, Search } from 'lucide-react';
import { useAdmin } from '../../../context/useAdmin';
import { normalizeSearchText } from '../../../utils/searchText';
import './AdminProducts.css';

const hasImageAndDescription = (product) => (
  String(product.main_image || '').trim()
  && String(product.description || '').trim()
);

const buildProductSearchText = (product) => (
  [
    product.sku,
    product.name,
    product.id,
    product.category_names,
    product.description
  ]
    .filter(Boolean)
    .map(normalizeSearchText)
    .join(' ')
);

const AdminProductQuickSearch = ({ onEditProduct }) => {
  const { products } = useAdmin();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm);

    if (!normalizedSearch) {
      return [...products].sort((left, right) => Number(left.id || 0) - Number(right.id || 0));
    }

    const searchTokens = normalizedSearch.split(/\s+/).filter(Boolean);

    return products
      .filter((product) => {
        const searchableText = buildProductSearchText(product);

        return searchTokens.every((token) => searchableText.includes(token));
      })
      .sort((left, right) => Number(left.id || 0) - Number(right.id || 0));
  }, [products, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  );

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const goToPreviousPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((page) => Math.min(totalPages, page + 1));
  };

  return (
    <div className="admin-products-list-page">
      <div className="admin-card">
        <div className="card-header admin-products-list-header">
          <div>
            <h2><PackageSearch size={20} /> Busca Rápida de Produtos</h2>
            <p>{filteredProducts.length} produto(s) encontrados.</p>
          </div>
        </div>

        <div className="card-body admin-products-list-body">
          <div className="admin-products-list-toolbar">
            <div className="product-list-search admin-products-list-search">
              <Search size={16} className="product-search-icon" />
              <input
                type="text"
                placeholder="Buscar rapidamente por SKU, nome ou ID..."
                className="product-search-input"
                value={searchTerm}
                autoFocus
                onChange={handleSearchChange}
              />
            </div>
          </div>

          <div className="admin-table-container">
            <table className="admin-table admin-products-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>SKU</th>
                  <th>Situação</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => {
                  const isComplete = hasImageAndDescription(product);

                  return (
                    <tr key={product.id} className="admin-products-table__row">
                      <td>
                        <div className="admin-products-table__product">
                          <div>
                            <strong>{product.name}</strong>
                            <span>ID: #{product.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>{product.sku || '-'}</td>
                      <td>
                        <span className={`badge-soft-blue ${isComplete ? '' : 'badge-secondary'}`}>
                          {isComplete ? 'Completo' : 'Pendente'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${product.is_active ? 'status-active' : 'status-inactive'}`}>
                          {product.is_active ? 'Ativo' : 'Oculto'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn-icon edit"
                          onClick={() => onEditProduct(product)}
                          title="Editar produto"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

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

          {filteredProducts.length > itemsPerPage && (
            <div className="admin-products-pagination">
              <button
                type="button"
                className="btn-secondary"
                onClick={goToPreviousPage}
                disabled={safeCurrentPage <= 1}
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <span>
                Página {safeCurrentPage} de {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={goToNextPage}
                disabled={safeCurrentPage >= totalPages}
              >
                Próxima
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProductQuickSearch;
