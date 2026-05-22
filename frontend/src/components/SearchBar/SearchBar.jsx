import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Search, X } from 'lucide-react';

const SearchSuggestionsDropdown = ({
  searchTerm,
  suggestions,
  onSelectProduct,
  onViewAll,
  dropdownStyle
}) => {
  const trimmedSearchTerm = searchTerm.trim();
  const visibleSuggestions = suggestions.slice(0, 3);

  if (!trimmedSearchTerm) {
    return null;
  }

  return (
    <div className="site-search-dropdown site-search-dropdown--compact" role="presentation" data-site-search-root="true" style={dropdownStyle}>
      {visibleSuggestions.length > 0 ? (
        <div className="site-search-compact-list" role="listbox" aria-label="Sugestoes de produtos">
          {visibleSuggestions.map((product) => (
            <button
              key={product.id}
              type="button"
              className="site-search-compact-item"
              onClick={() => onSelectProduct(product)}
            >
              <span className="site-search-compact-thumb">
                {product.image ? (
                  <img src={product.image} alt="" aria-hidden="true" />
                ) : (
                  <span>{product.name.slice(0, 2)}</span>
                )}
              </span>
              <span className="site-search-compact-copy">
                <strong>{product.name}</strong>
                <span>{product.categoryLabel || 'Produto Talmax'}</span>
              </span>
              <span className="site-search-compact-corner" aria-hidden="true">
                <span className="site-search-compact-corner-seam" />
                <span className="site-search-compact-arrow">
                  <ChevronRight size={16} strokeWidth={2.4} />
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="site-search-compact-empty">
          <strong>Nenhum produto encontrado</strong>
          <span>Buscar no catálogo completo</span>
        </div>
      )}

      <button type="button" className="site-search-compact-all" onClick={onViewAll}>
        Todos os produtos
      </button>
    </div>
  );
};

const SearchBar = ({
  variant = 'desktop',
  searchTerm,
  shouldShowDropdown,
  suggestions,
  onSelectProduct,
  onSubmit,
  onInputChange,
  onInputFocus,
  onInputKeyDown,
  onClose,
  onViewAllProducts,
  inputRef
}) => {
  const isMobile = variant === 'mobile';
  const formClassName = isMobile ? 'header-search-input-wrap' : 'header-search-inline';
  const shellClassName = `site-search-shell ${isMobile ? 'site-search-shell-mobile' : 'site-search-shell-desktop'}`;
  const placeholder = isMobile ? 'Digite o nome do produto...' : 'Buscar por produto, serviço...';
  const formRef = useRef(null);
  const [desktopDropdownStyle, setDesktopDropdownStyle] = useState(null);

  useEffect(() => {
    if (isMobile || !shouldShowDropdown) {
      setDesktopDropdownStyle(null);
      return undefined;
    }

    const updateDropdownPosition = () => {
      const rect = formRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setDesktopDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 12}px`,
        left: `${rect.left + rect.width / 2}px`,
        right: 'auto',
        width: `min(720px, calc(100vw - 2rem))`,
        maxWidth: `${Math.min(Math.max(rect.width + 220, 460), window.innerWidth - 32)}px`,
        transform: 'translateX(-50%)'
      });
    };

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isMobile, shouldShowDropdown, searchTerm]);

  const dropdown = shouldShowDropdown ? (
    <SearchSuggestionsDropdown
      searchTerm={searchTerm}
      suggestions={suggestions}
      onSelectProduct={onSelectProduct}
      onViewAll={onViewAllProducts}
      dropdownStyle={desktopDropdownStyle || undefined}
    />
  ) : null;

  const content = (
    <div className={shellClassName} data-site-search-root="true">
      <form ref={formRef} className={formClassName} onSubmit={onSubmit}>
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
        ) : (
          <button type="submit">Buscar</button>
        )}
      </form>

      {isMobile ? dropdown : null}
    </div>
  );

  if (isMobile) {
    return <div className="header-search-bar">{content}</div>;
  }

  return (
    <>
      {content}
      {!isMobile && dropdown && createPortal(dropdown, document.body)}
    </>
  );
};

export default SearchBar;
