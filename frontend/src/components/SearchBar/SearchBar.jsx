import React from 'react';
import { Search, X } from 'lucide-react';

const truncateSearchText = (value = '', maxLength = 160) => {
  const normalizedValue = String(value || '').replace(/\s+/g, ' ').trim();

  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength - 3).trim()}...`;
};

const SearchSuggestionsDropdown = ({
  searchTerm,
  suggestions,
  totalMatches,
  previewProduct,
  onPreviewChange,
  onSelectProduct
}) => {
  const trimmedSearchTerm = searchTerm.trim();

  if (!trimmedSearchTerm) {
    return null;
  }

  if (suggestions.length === 0) {
    return (
      <div className="site-search-dropdown" role="presentation">
        <div className="site-search-dropdown-empty">
          <strong>Nenhum produto encontrado</strong>
          <span>Continue digitando ou clique em Buscar para procurar no catalogo completo.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="site-search-dropdown" role="presentation">
      <div className="site-search-dropdown-grid">
        <div className="site-search-dropdown-results">
          <div className="site-search-dropdown-heading">
            <strong>Produtos</strong>
            <span>
              Mostrando {suggestions.length}
              {totalMatches > suggestions.length ? ` de ${totalMatches}` : ''}
            </span>
          </div>

          <div className="site-search-suggestion-list" role="listbox" aria-label="Sugestoes de produtos">
            {suggestions.map((product) => {
              const isActive = previewProduct?.id === product.id;

              return (
                <button
                  key={product.id}
                  type="button"
                  className={`site-search-suggestion-item ${isActive ? 'is-active' : ''}`}
                  onMouseEnter={() => onPreviewChange(product.id)}
                  onFocus={() => onPreviewChange(product.id)}
                  onClick={() => onSelectProduct(product)}
                >
                  <span className="site-search-suggestion-name">{product.name}</span>
                  <span className="site-search-suggestion-meta">{product.categoryLabel || 'Produto Talmax'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="site-search-preview-panel">
          <div className="site-search-preview-media">
            {previewProduct?.image ? (
              <img src={previewProduct.image} alt={previewProduct.name} />
            ) : (
              <div className="site-search-preview-placeholder">
                <span>{previewProduct?.name || 'Produto'}</span>
              </div>
            )}
          </div>

          <div className="site-search-preview-body">
            <span className="site-search-preview-eyebrow">Pre-visualizacao</span>
            <h4>{previewProduct?.name}</h4>
            <span className="site-search-preview-category">{previewProduct?.categoryLabel || 'Produto Talmax'}</span>
            <p>
              {truncateSearchText(previewProduct?.description, 180) || 'Passe o mouse sobre um nome da lista para visualizar o produto aqui.'}
            </p>
            <button
              type="button"
              className="site-search-preview-cta"
              onClick={() => previewProduct && onSelectProduct(previewProduct)}
            >
              Ver produto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SearchBar = ({
  variant = 'desktop',
  searchTerm,
  shouldShowDropdown,
  suggestions,
  totalMatches,
  previewProduct,
  onPreviewChange,
  onSelectProduct,
  onSubmit,
  onInputChange,
  onInputFocus,
  onInputKeyDown,
  onClose,
  inputRef
}) => {
  const isMobile = variant === 'mobile';
  const formClassName = isMobile ? 'header-search-input-wrap' : 'header-search-inline';
  const shellClassName = `site-search-shell ${isMobile ? 'site-search-shell-mobile' : 'site-search-shell-desktop'}`;
  const placeholder = isMobile ? 'Digite o nome do produto...' : 'Buscar por produto, serviço...';

  const content = (
    <div className={shellClassName} data-site-search-root="true">
      <form className={formClassName} onSubmit={onSubmit}>
        <Search size={18} />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(event) => onInputChange(event.target.value)}
          onFocus={onInputFocus}
          onKeyDown={onInputKeyDown}
          placeholder={placeholder}
          aria-expanded={shouldShowDropdown}
          aria-haspopup="listbox"
        />

        {isMobile ? (
          <button
            type="button"
            className="header-search-close"
            onClick={onClose}
            aria-label="Fechar busca"
          >
            <X size={16} />
          </button>
        ) : null}
      </form>

      {shouldShowDropdown && (
        <SearchSuggestionsDropdown
          searchTerm={searchTerm}
          suggestions={suggestions}
          totalMatches={totalMatches}
          previewProduct={previewProduct}
          onPreviewChange={onPreviewChange}
          onSelectProduct={onSelectProduct}
        />
      )}
    </div>
  );

  if (isMobile) {
    return <div className="header-search-bar">{content}</div>;
  }

  return content;
};

export default SearchBar;
