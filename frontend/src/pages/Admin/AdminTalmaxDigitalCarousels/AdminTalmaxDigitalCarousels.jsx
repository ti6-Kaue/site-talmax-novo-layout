import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Image as ImageIcon, Save, Search } from 'lucide-react';
import { useAdmin } from '../../../context/useAdmin';
import pageSettingsService, { normalizeSpecialPageSettings } from '../../../services/pageSettingsService';
import './AdminTalmaxDigitalCarousels.css';

const normalizeCategoryOption = (category, categories = []) => {
  return {
    id: Number(category.id),
    name: category.name || '',
    slug: category.slug || '',
    parent_id: category.parent_id ? Number(category.parent_id) : null,
    order: Number(category.order || category.display_order || 0)
  };
};

const normalizeSelectedCategories = (items = []) => (
  items
    .filter((category) => !category.parent_id)
    .map((category, index) => ({
      ...normalizeCategoryOption(category),
      order: Math.max(1, Number(category.order || category.display_order || index + 1))
    }))
);

const AdminTalmaxDigitalCarousels = () => {
  const { categories, addToast } = useAdmin();
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categoryOptions = useMemo(() => (
    (categories || [])
      .filter((category) => category?.id && category?.slug && category?.name)
      .map((category) => normalizeCategoryOption(category, categories))
      .filter((category) => !category.parent_id)
      .sort((a, b) => {
        return a.name.localeCompare(b.name, 'pt-BR');
      })
  ), [categories]);

  const selectedIds = useMemo(() => new Set(selectedCategories.map((category) => Number(category.id))), [selectedCategories]);
  const availableCategories = useMemo(() => (
    categoryOptions.filter((category) => {
      if (selectedIds.has(Number(category.id))) {
        return false;
      }

      const normalizedSearch = searchTerm.trim().toLowerCase();
      if (!normalizedSearch) {
        return true;
      }

      return `${category.name} ${category.slug}`.toLowerCase().includes(normalizedSearch);
    })
  ), [categoryOptions, searchTerm, selectedIds]);
  const orderedSelectedCategories = useMemo(() => (
    normalizeSelectedCategories(selectedCategories).sort((a, b) => {
      const orderA = Number(a.order || 1);
      const orderB = Number(b.order || 1);

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    })
  ), [selectedCategories]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);

    try {
      const items = await pageSettingsService.getAll();
      const normalized = normalizeSpecialPageSettings(items);
      setSelectedCategories(normalizeSelectedCategories(normalized['talmax-digital']?.carousel_categories || []));
    } catch (error) {
      console.error('Erro ao carregar carrosseis da Talmax Digital:', error);
      addToast(error.message || 'Erro ao carregar carrosseis da Talmax Digital', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const toggleCategory = (category) => {
    const normalizedCategory = normalizeCategoryOption(category, categories);

    setSelectedCategories((current) => {
      const isSelected = current.some((item) => Number(item.id) === normalizedCategory.id);

      return isSelected
        ? current.filter((item) => Number(item.id) !== normalizedCategory.id)
        : [...current, { ...normalizedCategory, order: current.length + 1 }];
    });
  };

  const updateCategoryOrder = (categoryId, order) => {
    const nextOrder = Math.max(1, Number(order || 1));

    setSelectedCategories((current) => current.map((category) => (
      Number(category.id) === Number(categoryId)
        ? { ...category, order: nextOrder }
        : category
    )));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const currentItems = await pageSettingsService.getAll();
      const currentSettings = normalizeSpecialPageSettings(currentItems)['talmax-digital'];
      const formData = new FormData();

      Object.entries(currentSettings).forEach(([key, value]) => {
        if (key === 'page_name' || key === 'updated_at') {
          return;
        }

        formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value ?? ''));
      });

      const categoriesToSave = orderedSelectedCategories.map((category, index) => ({
        id: Number(category.id),
        name: category.name,
        slug: category.slug,
        parent_id: null,
        order: Math.max(1, Number(category.order || index + 1))
      }));

      formData.set('carousel_categories', JSON.stringify(categoriesToSave));

      const response = await pageSettingsService.update('talmax-digital', formData);
      setSelectedCategories(normalizeSelectedCategories(response?.item?.carousel_categories || categoriesToSave));
      addToast('Carrosseis da Talmax Digital salvos com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar carrosseis da Talmax Digital:', error);
      addToast(error.message || 'Erro ao salvar carrosseis da Talmax Digital', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="loading-container">Carregando carrosseis da Talmax Digital...</div>;
  }

  return (
    <div className="admin-talmax-digital-carousels">
      <div className="admin-card">
        <div className="card-header admin-talmax-digital-carousels__header">
          <div>
            <h2><ImageIcon size={20} /> Talmax Digital</h2>
            <p>Escolha quais categorias principais aparecem como carrosseis na pagina Talmax Digital.</p>
          </div>
          <button className="btn-primary" type="button" onClick={handleSave} disabled={isSaving}>
            <Save size={16} />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        <div className="card-body">
          <div className="admin-talmax-digital-carousels__summary">
            <strong>{selectedCategories.length} carrossel(is) selecionado(s)</strong>
            <span>A ordem dos carrosseis segue a ordem em que voce seleciona as categorias.</span>
          </div>

          <div className="admin-talmax-digital-carousels__columns">
            <section className="admin-talmax-digital-carousels__panel">
              <div className="admin-talmax-digital-carousels__panel-header">
                <strong>Disponiveis</strong>
                <span>{availableCategories.length}</span>
              </div>

              <label className="admin-talmax-digital-carousels__search">
                <Search size={16} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar categoria..."
                />
              </label>

              <div className="admin-talmax-digital-carousels__list">
                {availableCategories.map((category) => (
                  <button
                    key={`${category.parent_id || 'main'}-${category.id}`}
                    type="button"
                    className="admin-talmax-digital-carousels__option"
                    onClick={() => toggleCategory(category)}
                  >
                    <span>
                      <strong>{category.name}</strong>
                      <small>Categoria principal</small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
            </section>

            <section className="admin-talmax-digital-carousels__panel admin-talmax-digital-carousels__panel--selected">
              <div className="admin-talmax-digital-carousels__panel-header">
                <strong>Selecionadas</strong>
                <span>{orderedSelectedCategories.length}</span>
              </div>

              <div className="admin-talmax-digital-carousels__list">
                {orderedSelectedCategories.length > 0 ? (
                  orderedSelectedCategories.map((category) => (
                    <div
                      key={`${category.parent_id || 'main'}-${category.id}`}
                      className="admin-talmax-digital-carousels__option is-selected"
                    >
                      <button
                        type="button"
                        className="admin-talmax-digital-carousels__remove"
                        onClick={() => toggleCategory(category)}
                        aria-label={`Remover ${category.name}`}
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <span>
                        <strong>{category.name}</strong>
                      </span>
                      <label className="admin-talmax-digital-carousels__order">
                        <small>Ordem</small>
                        <input
                          type="number"
                          min="1"
                          value={Math.max(1, Number(category.order || 1))}
                          onChange={(event) => updateCategoryOrder(category.id, event.target.value)}
                        />
                      </label>
                      <CheckCircle size={18} />
                    </div>
                  ))
                ) : (
                  <div className="admin-talmax-digital-carousels__empty">
                    Nenhuma categoria selecionada.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTalmaxDigitalCarousels;
