import React, { useState } from 'react';
import { Save, UploadCloud } from 'lucide-react';
import { apiAssetPath } from '../../../utils/assets';

const ButtonSavingIndicator = () => (
  <span className="loader loader_bubble admin-button-loader" aria-hidden="true" />
);

const DEFAULT_CATEGORY_FORM_STATE = {
  name: '',
  slug: '',
  icon: null,
  background: null,
  is_visible: true,
  parent_id: null
};

const buildCategoryFormState = (initialData) => (
  initialData
    ? {
        name: initialData.name || '',
        slug: initialData.slug || '',
        icon: null,
        background: null,
        is_visible: Boolean(initialData.is_visible),
        parent_id: initialData.parent_id || null
      }
    : { ...DEFAULT_CATEGORY_FORM_STATE }
);

const getImagePreview = (imageUrl) => (
  imageUrl ? apiAssetPath(imageUrl) : null
);

const CategoryForm = ({ initialData, mainCategories, onSubmit, onCancel, isSubmitting = false }) => {
  const [formData, setFormData] = useState(() => buildCategoryFormState(initialData));
  const [iconPreview, setIconPreview] = useState(() => getImagePreview(initialData?.icon_url));
  const [backgroundPreview, setBackgroundPreview] = useState(() => getImagePreview(initialData?.background_url));

  const handleNameChange = (e) => {
    const name = e.target.value;
    const slug = name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    setFormData({ ...formData, name, slug });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const data = new FormData();
    data.append('name', formData.name);
    data.append('slug', formData.slug);
    data.append('is_visible', formData.is_visible);
    if (formData.parent_id) data.append('parent_id', formData.parent_id);
    if (formData.icon) data.append('icon', formData.icon);
    if (formData.background) data.append('background', formData.background);

    onSubmit(data);
  };

  const isSubcategory = Boolean(formData.parent_id);

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>
        {(formData.parent_id || (!initialData && mainCategories.length > 0)) && (
          <div className="form-group">
            <label>Categoria Principal (Pai)</label>
            <select
              value={formData.parent_id || ''}
              onChange={(e) => setFormData({ ...formData, parent_id: e.target.value || null })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'white' }}
            >
              <option value="">-- Categoria Principal (Nenhuma) --</option>
              {mainCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>Nome da Categoria</label>
          <input
            type="text"
            required
            placeholder="Ex: Gessos e Revestimentos"
            value={formData.name}
            onChange={handleNameChange}
          />
        </div>

        <div className="form-group">
          <label>Slug (URL amigável)</label>
          <input
            type="text"
            required
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
          <input
            type="checkbox"
            id="catVisible"
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            checked={formData.is_visible}
            onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
          />
          <label htmlFor="catVisible" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 600 }}>Exibir categoria no site</label>
        </div>

        {!isSubcategory && (
          <>
            <div className="form-group">
              <label>Logo da Categoria</label>
              <div className="file-upload-area" style={{ padding: '15px' }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setFormData({ ...formData, icon: file });
                      setIconPreview(URL.createObjectURL(file));
                    }
                  }}
                />
                <UploadCloud size={32} color="var(--admin-primary)" style={{ marginBottom: '5px' }} />
                <p style={{ fontSize: '0.85rem' }}>Clique para enviar a logo</p>
              </div>
              {iconPreview && (
                <div className="preview-thumb category-icon-preview-thumb" style={{ marginTop: '10px', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--admin-border)' }}>
                  <img src={iconPreview} alt="Preview da logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              )}
            </div>

          </>
        )}

        <div className="form-group">
          <label>{isSubcategory ? 'Foto de fundo do card da subcategoria' : 'Foto de fundo do card da categoria'}</label>
          <div className="file-upload-area" style={{ padding: '15px' }}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setFormData({ ...formData, background: file });
                  setBackgroundPreview(URL.createObjectURL(file));
                }
              }}
            />
            <UploadCloud size={32} color="var(--admin-primary)" style={{ marginBottom: '5px' }} />
            <p style={{ fontSize: '0.85rem' }}>Clique para enviar a foto usada nos cards</p>
          </div>
          {backgroundPreview && (
            <div className="category-background-preview">
              <img src={backgroundPreview} alt="Preview do banner" />
            </div>
          )}
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? <ButtonSavingIndicator /> : <Save size={18} />}
          {isSubmitting ? 'Salvando' : (initialData ? 'Salvar alterações' : 'Criar categoria')}
        </button>
      </div>
    </form>
  );
};

export default CategoryForm;
