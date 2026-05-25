import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Image as ImageIcon, Save } from 'lucide-react';
import { useAdmin } from '../../../context/useAdmin';
import pageSettingsService, { normalizeSpecialPageSettings } from '../../../services/pageSettingsService';
import './AdminTalmaxDigitalCarousels.css';

const normalizeCategoryOption = (category) => ({
  id: Number(category.id),
  name: category.name || '',
  slug: category.slug || '',
  parent_id: category.parent_id ? Number(category.parent_id) : null
});

const AdminTalmaxDigitalCarousels = () => {
  const { categories, addToast } = useAdmin();
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categoryOptions = useMemo(() => (
    (categories || [])
      .filter((category) => category?.id && category?.slug && category?.name)
      .map(normalizeCategoryOption)
      .filter((category) => !category.parent_id)
      .sort((a, b) => {
        return a.name.localeCompare(b.name, 'pt-BR');
      })
  ), [categories]);

  const selectedIds = useMemo(() => new Set(selectedCategories.map((category) => Number(category.id))), [selectedCategories]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);

    try {
      const items = await pageSettingsService.getAll();
      const normalized = normalizeSpecialPageSettings(items);
      setSelectedCategories(normalized['talmax-digital']?.carousel_categories || []);
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
    const normalizedCategory = normalizeCategoryOption(category);

    setSelectedCategories((current) => {
      const isSelected = current.some((item) => Number(item.id) === normalizedCategory.id);

      return isSelected
        ? current.filter((item) => Number(item.id) !== normalizedCategory.id)
        : [...current, normalizedCategory];
    });
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

      formData.set('carousel_categories', JSON.stringify(selectedCategories.filter((category) => !category.parent_id)));

      await pageSettingsService.update('talmax-digital', formData);
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
            <p>Escolha quais categorias ou subcategorias aparecem como carrosseis na pagina Talmax Digital.</p>
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

          <div className="admin-talmax-digital-carousels__grid">
            {categoryOptions.map((category) => {
              const isSelected = selectedIds.has(Number(category.id));

              return (
                <button
                  key={`${category.parent_id || 'main'}-${category.id}`}
                  type="button"
                  className={`admin-talmax-digital-carousels__option ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => toggleCategory(category)}
                >
                  <span>
                    <strong>{category.name}</strong>
                    <small>Categoria principal</small>
                  </span>
                  <CheckCircle size={18} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTalmaxDigitalCarousels;
