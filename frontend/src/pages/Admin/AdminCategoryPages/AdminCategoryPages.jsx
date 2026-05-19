import React, { useMemo, useRef, useState } from 'react';
import { Eye, GalleryHorizontal, Image as ImageIcon, Save, Search, UploadCloud } from 'lucide-react';
import { useAdmin } from '../../../context/useAdmin';
import { apiAssetPath } from '../../../utils/assets';
import './AdminCategoryPages.css';

const ButtonSavingIndicator = () => (
  <span className="loader loader_bubble admin-button-loader" aria-hidden="true" />
);

const normalizeText = (value = '') => (
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const buildCategoryPageUrl = (slug) => {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return new URL(`categoria/${slug}`, `${window.location.origin}${baseUrl}`).toString();
};

const AdminCategoryPages = () => {
  const { mainCategories, categoriesHook, addToast } = useAdmin();
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => mainCategories[0]?.id || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const visibleMainCategories = useMemo(() => (
    mainCategories.filter((category) => (
      category.is_visible !== false
      && Number(category.is_visible ?? 1) !== 0
    ))
  ), [mainCategories]);

  const filteredCategories = useMemo(() => {
    const normalizedSearchTerm = normalizeText(searchTerm);

    if (!normalizedSearchTerm) {
      return visibleMainCategories;
    }

    return visibleMainCategories.filter((category) => (
      normalizeText(category.name).includes(normalizedSearchTerm)
      || normalizeText(category.slug).includes(normalizedSearchTerm)
    ));
  }, [searchTerm, visibleMainCategories]);

  const selectedCategory = useMemo(() => (
    visibleMainCategories.find((category) => Number(category.id) === Number(selectedCategoryId))
    || visibleMainCategories[0]
    || null
  ), [selectedCategoryId, visibleMainCategories]);

  const currentBannerUrl = selectedCategory?.page_banner_categorias_url
    ? apiAssetPath(selectedCategory.page_banner_categorias_url)
    : '';
  const previewUrl = bannerPreview || currentBannerUrl;

  const handleBannerChange = (file) => {
    if (!file) {
      return;
    }

    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleSelectCategory = (category) => {
    setSelectedCategoryId(category.id);
    setBannerFile(null);
    setBannerPreview('');
  };

  const handleSave = async () => {
    if (!selectedCategory || isSaving) {
      return;
    }

    if (!bannerFile) {
      addToast('Escolha uma imagem de banner antes de salvar.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append('name', selectedCategory.name || '');
      formData.append('slug', selectedCategory.slug || '');
      formData.append('is_visible', Boolean(selectedCategory.is_visible));
      formData.append('page_banner_categorias_url', bannerFile);

      const result = await categoriesHook.updateCategory(selectedCategory.id, formData);

      if (!result.success) {
        addToast(result.error || 'Erro ao salvar banner da categoria.', 'error');
        return;
      }

      addToast('Banner da pagina de categoria atualizado!');
      setBannerFile(null);
      setBannerPreview('');
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedCategory) {
    return (
      <div className="admin-category-pages">
        <div className="admin-card">
          <div className="card-body">
            <div className="empty-state">Nenhuma categoria principal visivel encontrada.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-category-pages">
      <section className="admin-card">
        <div className="card-header admin-category-pages__header">
          <div>
            <h2><GalleryHorizontal size={20} /> Pagina de Categoria</h2>
            <p>Escolha uma categoria principal e troque o banner que aparece no topo da pagina publica.</p>
          </div>
          <a
            className="btn-secondary admin-category-pages__preview-link"
            href={buildCategoryPageUrl(selectedCategory.slug)}
            target="_blank"
            rel="noreferrer"
          >
            <Eye size={16} />
            Ver pagina
          </a>
        </div>

        <div className="card-body">
          <div className="admin-category-pages__layout">
            <aside className="admin-category-pages__list-panel">
              <div className="admin-category-pages__search">
                <Search size={16} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar categoria"
                />
              </div>

              <div className="admin-category-pages__category-list">
                {filteredCategories.map((category) => {
                  const isSelected = Number(category.id) === Number(selectedCategory.id);

                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`admin-category-pages__category-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectCategory(category)}
                    >
                      <span className="admin-category-pages__category-thumb">
                        {category.page_banner_categorias_url ? (
                          <img src={apiAssetPath(category.page_banner_categorias_url)} alt="" />
                        ) : (
                          <ImageIcon size={17} />
                        )}
                      </span>
                      <span>
                        <strong>{category.name}</strong>
                        <small>Categoria principal / {category.slug}</small>
                      </span>
                    </button>
                  );
                })}

                {filteredCategories.length === 0 && (
                  <div className="admin-category-pages__empty-list">Nenhuma categoria encontrada.</div>
                )}
              </div>
            </aside>

            <section className="admin-category-pages__editor">
              <div className="admin-category-pages__selected-copy">
                <span>Categoria principal</span>
                <h3>{selectedCategory.name}</h3>
                <p>/categoria/{selectedCategory.slug}</p>
              </div>

              <div className={`admin-category-pages__hero-preview ${previewUrl ? 'has-image' : ''}`}>
                {previewUrl ? (
                  <img src={previewUrl} alt={`Banner de ${selectedCategory.name}`} />
                ) : (
                  <div className="admin-category-pages__hero-empty">
                    <GalleryHorizontal size={42} />
                    <span>Nenhum banner cadastrado</span>
                  </div>
                )}
                <div className="admin-category-pages__hero-overlay">
                  <span>Categoria</span>
                  <strong>{selectedCategory.name}</strong>
                </div>
              </div>

              <div className="admin-category-pages__upload-row">
                <div className="form-group">
                  <label>Banner da pagina</label>
                  <div className="file-upload-area admin-category-pages__upload">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => handleBannerChange(event.target.files?.[0])}
                    />
                    <UploadCloud size={28} color="var(--admin-primary)" />
                    <p>Enviar novo banner</p>
                  </div>
                </div>

                <div className="admin-category-pages__actions">
                  <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud size={16} />
                    Escolher imagem
                  </button>
                  <button type="button" className="btn-primary" onClick={handleSave} disabled={isSaving || !bannerFile}>
                    {isSaving ? <ButtonSavingIndicator /> : <Save size={16} />}
                    {isSaving ? 'Salvando' : 'Salvar banner'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminCategoryPages;
