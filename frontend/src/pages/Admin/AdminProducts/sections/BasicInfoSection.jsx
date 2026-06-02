import React from 'react';
import { CheckCircle, ChevronRight, X } from 'lucide-react';

const BasicInfoSection = ({
  formData,
  setFormData,
  mainCategories,
  subCategories,
  filteredSubCategories,
  isCategoryDropdownOpen,
  setIsCategoryDropdownOpen,
  isSubCategoryDropdownOpen,
  setIsSubCategoryDropdownOpen
}) => (
  <div className="admin-section-group">
    <span className="section-label">1. Informacoes Basicas</span>

    <div className="form-group">
      <label>Nome Comercial</label>
      <input
        type="text"
        required
        value={formData.name}
        onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))}
      />
    </div>

    <div className="product-form-options">
      <label className="product-form-option">
        <input
          type="checkbox"
          checked={formData.is_active}
          onChange={(e) => setFormData((current) => ({ ...current, is_active: e.target.checked }))}
        />
        <div>
          <strong>Produto ativo no catálogo</strong>
          <span>Quando desativado, ele some do catálogo e das páginas públicas, mas continua no painel administrativo.</span>
        </div>
      </label>
    </div>

    <div className="product-form-toggle-bar">
      <div className="product-form-toggle-copy">
        <strong>Botão de orçamento</strong>
        <span>Status atual: {formData.showQuoteButton ? 'ON' : 'OFF'}</span>
      </div>
      <button
        type="button"
        className={`btn-secondary product-form-toggle-button ${formData.showQuoteButton ? 'is-on' : 'is-off'}`}
        onClick={() => setFormData((current) => ({ ...current, showQuoteButton: !current.showQuoteButton }))}
      >
        {formData.showQuoteButton ? 'Desligar orçamento' : 'Ligar orçamento'}
      </button>
    </div>

    <div className="form-group">
      <label>Categorias Principais</label>
      {formData.category_ids.length === 0 && (
        <p className="product-form-helper">
          Selecione pelo menos uma categoria principal para o produto não aparecer como sem categoria.
        </p>
      )}

      <div className="custom-multi-select">
        <div className="multi-select-header" onClick={() => setIsCategoryDropdownOpen((current) => !current)}>
          <div className="selected-tags-container">
            {formData.category_ids.length > 0 ? (
              formData.category_ids.map((id) => (
                <span key={id} className="header-tag">
                  {mainCategories.find((category) => category.id === id)?.name}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData((current) => ({
                        ...current,
                        category_ids: current.category_ids.filter((categoryId) => categoryId !== id)
                      }));
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            ) : <span className="placeholder">Selecione...</span>}
          </div>
          <ChevronRight size={16} />
        </div>

        {isCategoryDropdownOpen && (
          <div className="multi-select-options">
            {mainCategories.map((category) => (
              <div
                key={category.id}
                className={`multi-select-option ${formData.category_ids.includes(category.id) ? 'selected' : ''}`}
                onClick={() => {
                  setFormData((current) => {
                    const isSelected = current.category_ids.includes(category.id);

                    return {
                      ...current,
                      category_ids: isSelected
                        ? current.category_ids.filter((id) => id !== category.id)
                        : [...current.category_ids, category.id]
                    };
                  });
                }}
              >
                {category.name} <CheckCircle className="check-icon" size={16} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {filteredSubCategories.length > 0 && (
      <div className="form-group">
        <label>Subcategorias</label>

        <div className="custom-multi-select">
          <div className="multi-select-header" onClick={() => setIsSubCategoryDropdownOpen((current) => !current)}>
            <div className="selected-tags-container">
              {formData.sub_category_ids.length > 0 ? (
                formData.sub_category_ids.map((id) => (
                  <span key={id} className="header-tag">
                    {subCategories.find((category) => category.id === id)?.name}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData((current) => ({
                          ...current,
                          sub_category_ids: current.sub_category_ids.filter((subCategoryId) => subCategoryId !== id)
                        }));
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              ) : <span className="placeholder">Selecione...</span>}
            </div>
            <ChevronRight size={16} />
          </div>

          {isSubCategoryDropdownOpen && (
            <div className="multi-select-options">
              {filteredSubCategories.map((category) => (
                <div
                  key={category.id}
                  className={`multi-select-option ${formData.sub_category_ids.includes(category.id) ? 'selected' : ''}`}
                  onClick={() => {
                    setFormData((current) => {
                      const isSelected = current.sub_category_ids.includes(category.id);

                      return {
                        ...current,
                        sub_category_ids: isSelected
                          ? current.sub_category_ids.filter((id) => id !== category.id)
                          : [...current.sub_category_ids, category.id]
                      };
                    });
                  }}
                >
                  {category.name} <CheckCircle className="check-icon" size={16} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

export default BasicInfoSection;
