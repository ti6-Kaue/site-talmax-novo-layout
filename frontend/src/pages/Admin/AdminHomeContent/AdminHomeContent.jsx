import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeInfo,
  Eye,
  EyeOff,
  Menu,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAdmin } from '../../../context/useAdmin';
import homeContentBlockService from '../../../services/homeContentBlockService';
import { apiAssetPath } from '../../../utils/assets';
import './AdminHomeContent.css';

const SECTION_LABELS = {
  'header-menu': 'Menu do cabecalho',
  'info-card': 'Card informativo',
  'orange-ad': 'Propaganda'
};

const buildEmptyForm = (sectionType = 'info-card') => ({
  section_type: sectionType,
  title: '',
  description: '',
  logo_text: sectionType === 'orange-ad' ? 'moby' : '',
  logo_image_url: '',
  logo_image_file: null,
  button_label: sectionType === 'header-menu' ? '' : (sectionType === 'orange-ad' ? 'Conheca' : 'Saiba Mais'),
  link_url: '',
  is_external: sectionType === 'orange-ad',
  background_color: sectionType === 'orange-ad' ? '#f06400' : (sectionType === 'header-menu' ? '#ffffff' : '#111630'),
  text_color: sectionType === 'header-menu' ? '#243f96' : '#ffffff',
  button_color: '#374c92',
  button_text_color: '#ffffff',
  display_order: '0',
  active: true
});

const normalizeFormFromItem = (item) => ({
  section_type: item.section_type || 'info-card',
  title: item.title || '',
  description: item.description || '',
  logo_text: item.logo_text || '',
  logo_image_url: item.logo_image_url || '',
  logo_image_file: null,
  button_label: item.button_label || '',
  link_url: item.link_url || '',
  is_external: Boolean(item.is_external),
  background_color: item.background_color || (item.section_type === 'orange-ad' ? '#f06400' : '#111630'),
  text_color: item.text_color || '#ffffff',
  button_color: item.button_color || '#374c92',
  button_text_color: item.button_text_color || '#ffffff',
  display_order: String(item.display_order ?? 0),
  active: Boolean(item.active)
});

const buildPayload = (form) => {
  const formData = new FormData();
  formData.append('section_type', form.section_type || 'info-card');
  formData.append('title', form.title || '');
  formData.append('description', form.description || '');
  formData.append('logo_text', form.logo_text || '');
  formData.append('logo_image_url', form.logo_image_url || '');
  formData.append('button_label', form.button_label || '');
  formData.append('link_url', form.link_url || '');
  formData.append('is_external', String(Boolean(form.is_external)));
  formData.append('background_color', form.background_color || '');
  formData.append('text_color', form.text_color || '');
  formData.append('button_color', form.button_color || '');
  formData.append('button_text_color', form.button_text_color || '');
  formData.append('display_order', String(Number.parseInt(form.display_order, 10) || 0));
  formData.append('active', String(Boolean(form.active)));

  if (form.logo_image_file) {
    formData.append('logo_image', form.logo_image_file);
  }

  return formData;
};

const AdminHomeContent = () => {
  const { addToast, categories } = useAdmin();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(buildEmptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [addingCategoryId, setAddingCategoryId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await homeContentBlockService.getAll({ admin: true });
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar conteudos da home:', error);
      addToast(error.message || 'Erro ao carregar conteudos da home', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) => (
      [
        SECTION_LABELS[item.section_type],
        item.title,
        item.description,
        item.logo_text,
        item.button_label,
        item.link_url
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    ));
  }, [items, searchTerm]);

  const infoCards = filteredItems.filter((item) => item.section_type === 'info-card');
  const orangeAds = filteredItems.filter((item) => item.section_type === 'orange-ad');
  const headerMenuItems = filteredItems.filter((item) => item.section_type === 'header-menu');
  const allHeaderMenuItems = items.filter((item) => item.section_type === 'header-menu');
  const availableHeaderCategories = useMemo(() => (
    (Array.isArray(categories) ? categories : [])
      .filter((category) => category?.slug)
      .sort((a, b) => {
        const parentDifference = Number(a.parent_id || 0) - Number(b.parent_id || 0);

        return parentDifference || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      })
  ), [categories]);
  const headerMenuLinks = useMemo(() => new Set(
    allHeaderMenuItems.map((item) => String(item.link_url || '').trim())
  ), [allHeaderMenuItems]);
  const logoImagePreview = useMemo(() => (
    form.logo_image_file ? URL.createObjectURL(form.logo_image_file) : ''
  ), [form.logo_image_file]);

  useEffect(() => () => {
    if (logoImagePreview) {
      URL.revokeObjectURL(logoImagePreview);
    }
  }, [logoImagePreview]);

  const handleCreate = (sectionType) => {
    setEditingItem(null);
    setForm(buildEmptyForm(sectionType));
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm(normalizeFormFromItem(item));
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    if (field === 'section_type') {
      setForm((current) => ({
        ...buildEmptyForm(value),
        title: current.title,
        description: current.description,
        logo_image_url: value === 'orange-ad' ? current.logo_image_url : '',
        logo_image_file: value === 'orange-ad' ? current.logo_image_file : null,
        link_url: current.link_url,
        display_order: current.display_order,
        active: current.active,
        section_type: value
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleLogoImageChange = (file) => {
    setForm((current) => ({
      ...current,
      logo_image_file: file || null,
      logo_image_url: file ? current.logo_image_url : current.logo_image_url
    }));
  };

  const handleRemoveLogoImage = () => {
    setForm((current) => ({
      ...current,
      logo_image_file: null,
      logo_image_url: ''
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingItem?.id) {
        await homeContentBlockService.update(editingItem.id, buildPayload(form));
        addToast('Conteudo atualizado com sucesso!');
      } else {
        await homeContentBlockService.create(buildPayload(form));
        addToast('Conteudo criado com sucesso!');
      }

      setShowModal(false);
      setEditingItem(null);
      await loadItems();
    } catch (error) {
      console.error('Erro ao salvar conteudo da home:', error);
      addToast(error.message || 'Erro ao salvar conteudo da home', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item) => {
    if (togglingId === item.id) {
      return;
    }

    try {
      setTogglingId(item.id);
      const nextStatus = !item.active;
      await homeContentBlockService.updateActiveStatus(item.id, nextStatus);
      addToast(nextStatus ? 'Conteudo ativado com sucesso!' : 'Conteudo ocultado com sucesso!');
      await loadItems();
    } catch (error) {
      console.error('Erro ao alterar status do conteudo:', error);
      addToast(error.message || 'Erro ao alterar status do conteudo', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleAddCategoryToHeader = async (category) => {
    if (!category?.slug || addingCategoryId === category.id) {
      return;
    }

    const categoryPath = `/categoria/${category.slug}`;
    const maxDisplayOrder = allHeaderMenuItems.reduce(
      (maxOrder, item) => Math.max(maxOrder, Number(item.display_order || 0)),
      0
    );
    const nextForm = {
      ...buildEmptyForm('header-menu'),
      title: category.name || category.slug,
      link_url: categoryPath,
      display_order: String(maxDisplayOrder + 10),
      active: true
    };

    try {
      setAddingCategoryId(category.id);
      await homeContentBlockService.create(buildPayload(nextForm));
      addToast('Categoria adicionada ao cabecalho!');
      await loadItems();
    } catch (error) {
      console.error('Erro ao adicionar categoria ao cabecalho:', error);
      addToast(error.message || 'Erro ao adicionar categoria ao cabecalho', 'error');
    } finally {
      setAddingCategoryId(null);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete?.id) {
      return;
    }

    try {
      await homeContentBlockService.remove(itemToDelete.id);
      addToast('Conteudo removido com sucesso!');
      setShowDeleteModal(false);
      setItemToDelete(null);
      await loadItems();
    } catch (error) {
      console.error('Erro ao excluir conteudo da home:', error);
      addToast(error.message || 'Erro ao excluir conteudo da home', 'error');
    }
  };

  const renderItemCard = (item) => {
    const Icon = item.section_type === 'orange-ad' ? Megaphone : (item.section_type === 'header-menu' ? Menu : BadgeInfo);
    const style = {
      '--admin-home-preview-bg': item.background_color || '#111630',
      '--admin-home-preview-color': item.text_color || '#ffffff',
      '--admin-home-preview-button-bg': item.button_color || '#374c92',
      '--admin-home-preview-button-color': item.button_text_color || '#ffffff'
    };

    return (
      <article key={item.id} className={`admin-home-content__item admin-home-content__item--${item.section_type}`} style={style}>
        <div className="admin-home-content__preview">
          <div className="admin-home-content__preview-head">
            <Icon size={18} />
            <span>{SECTION_LABELS[item.section_type]}</span>
          </div>
          {item.logo_image_url ? (
            <img
              src={apiAssetPath(item.logo_image_url)}
              alt={item.logo_text || 'Logo da propaganda'}
              className="admin-home-content__logo-image"
            />
          ) : item.logo_text ? (
            <strong className="admin-home-content__logo-text">{item.logo_text}</strong>
          ) : null}
          <h3>{item.title}</h3>
          {item.description && <p>{item.description}</p>}
          {item.button_label && <span className="admin-home-content__fake-button">{item.button_label}</span>}
        </div>

        <div className="admin-home-content__meta">
          <span>Ordem {item.display_order}</span>
          {item.link_url && <span title={item.link_url}>{item.link_url}</span>}
        </div>

        <div className="admin-home-content__actions">
          <button
            type="button"
            className={`status-badge ${item.active ? 'status-active' : 'status-inactive'} ${togglingId === item.id ? 'is-toggling' : ''}`}
            onClick={() => handleToggleStatus(item)}
            disabled={togglingId === item.id}
          >
            {togglingId === item.id ? (
              <span className="status-badge-spinner" aria-hidden="true" />
            ) : item.active ? (
              <Eye size={14} />
            ) : (
              <EyeOff size={14} />
            )}
            {item.active ? 'Ativo' : 'Oculto'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleEdit(item)}>
            <Pencil size={16} />
            Editar
          </button>
          <button type="button" className="btn-secondary admin-home-content__danger-button" onClick={() => handleDeleteClick(item)}>
            <Trash2 size={16} />
            Excluir
          </button>
        </div>
      </article>
    );
  };

  const renderSection = ({ title, description, icon: Icon, actionLabel, sectionType, sectionItems }) => (
    <section className="admin-card admin-home-content__section">
      <div className="card-header admin-home-content__section-header">
        <div>
          <h2><Icon size={20} /> {title}</h2>
          <p>{description}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => handleCreate(sectionType)}>
          <Plus size={18} />
          {actionLabel}
        </button>
      </div>

      <div className="card-body">
        {sectionItems.length === 0 ? (
          <div className="empty-state">
            <Icon size={32} />
            <p>Nenhum item cadastrado nessa area.</p>
          </div>
        ) : (
          <div className="admin-home-content__grid">
            {sectionItems.map(renderItemCard)}
          </div>
        )}
      </div>
    </section>
  );

  const renderHeaderMenuSection = () => (
    <section className="admin-card admin-home-content__section">
      <div className="card-header admin-home-content__section-header">
        <div>
          <h2><Menu size={20} /> Menu do cabecalho</h2>
          <p>Escolha quais categorias aparecem no dropdown Produtos do cabecalho.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => handleCreate('header-menu')}>
          <Plus size={18} />
          Novo link manual
        </button>
      </div>

      <div className="card-body">
        <div className="admin-home-content__category-picker">
          <div className="admin-home-content__category-picker-head">
            <strong>Categorias disponiveis</strong>
            <span>{availableHeaderCategories.length} categorias encontradas</span>
          </div>

          {availableHeaderCategories.length === 0 ? (
            <div className="empty-state">
              <Menu size={32} />
              <p>Nenhuma categoria cadastrada.</p>
            </div>
          ) : (
            <div className="admin-home-content__category-list">
              {availableHeaderCategories.map((category) => {
                const categoryPath = `/categoria/${category.slug}`;
                const alreadyAdded = headerMenuLinks.has(categoryPath);

                return (
                  <article key={category.id || category.slug} className="admin-home-content__category-option">
                    <div>
                      <strong>{category.name}</strong>
                      <span>{categoryPath}</span>
                    </div>
                    <button
                      type="button"
                      className={alreadyAdded ? 'status-badge status-active' : 'btn-secondary'}
                      onClick={() => handleAddCategoryToHeader(category)}
                      disabled={alreadyAdded || addingCategoryId === category.id}
                    >
                      {alreadyAdded ? 'No cabecalho' : addingCategoryId === category.id ? 'Adicionando...' : 'Adicionar'}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {headerMenuItems.length > 0 && (
          <>
            <div className="admin-home-content__subheading">
              <strong>Itens no cabecalho</strong>
              <span>Edite ordem, nome ou remova quando precisar.</span>
            </div>
            <div className="admin-home-content__grid">
              {headerMenuItems.map(renderItemCard)}
            </div>
          </>
        )}
      </div>
    </section>
  );

  return (
    <div className="admin-home-content">
      <div className="admin-card">
        <div className="card-header admin-home-content__main-header">
          <div>
            <h2><Megaphone size={20} /> Conteudos da Home</h2>
            <p>Edite os cards abaixo das categorias e cadastre quantas propagandas laranja quiser antes do rodape.</p>
          </div>

          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar conteudo..."
            />
            {searchTerm && (
              <button type="button" className="clear-search" onClick={() => setSearchTerm('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="admin-card">
          <div className="card-body">
            <div className="loading-container">Carregando conteudos da Home...</div>
          </div>
        </div>
      ) : (
        <>
          {renderSection({
            title: 'Cards informativos',
            description: 'Cards escuros exibidos logo abaixo das categorias de produto.',
            icon: BadgeInfo,
            actionLabel: 'Novo card',
            sectionType: 'info-card',
            sectionItems: infoCards
          })}

          {renderSection({
            title: 'Propagandas ',
            description: 'Faixas promocionais exibidas antes do rodape. Pode cadastrar quantas quiser.',
            icon: Megaphone,
            actionLabel: 'Nova propaganda',
            sectionType: 'orange-ad',
            sectionItems: orangeAds
          })}
        </>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay">
            <motion.div
              className="modal-content admin-home-content__modal"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
            >
              <div className="modal-header">
                <h3>{editingItem?.id ? 'Editar conteudo' : 'Novo conteudo'}</h3>
                <button type="button" className="btn-icon" onClick={() => setShowModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body admin-home-content__modal-body">
                  <div className="admin-home-content__form-grid">
                    <div className="form-group">
                      <label>Tipo</label>
                      <select
                        value={form.section_type}
                        onChange={(event) => handleInputChange('section_type', event.target.value)}
                      >
                        <option value="info-card">Card informativo</option>
                        <option value="orange-ad">Propaganda </option>
                        <option value="header-menu">Menu do cabecalho</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Ordem</label>
                      <input
                        type="number"
                        min="0"
                        value={form.display_order}
                        onChange={(event) => handleInputChange('display_order', event.target.value)}
                      />
                    </div>

                    {form.section_type === 'orange-ad' && (
                      <div className="form-group">
                        <label>Texto da logo</label>
                        <input
                          type="text"
                          value={form.logo_text}
                          onChange={(event) => handleInputChange('logo_text', event.target.value)}
                          placeholder="Ex.: moby"
                          required={!form.logo_image_url && !form.logo_image_file}
                        />
                      </div>
                    )}

                    {form.section_type === 'orange-ad' && (
                      <div className="form-group admin-home-content__form-group--full">
                        <label>Imagem da logo da propaganda</label>
                        <div className="admin-home-content__logo-upload">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => handleLogoImageChange(event.target.files?.[0] || null)}
                          />
                          <div>
                            <strong>Enviar logo</strong>
                            <span>A imagem aparece no lugar do texto da logo na faixa laranja.</span>
                          </div>
                        </div>
                        {(form.logo_image_file || form.logo_image_url) && (
                          <div className="admin-home-content__logo-current">
                            <img
                              src={logoImagePreview || apiAssetPath(form.logo_image_url)}
                              alt="Previa da logo"
                            />
                            <button type="button" className="btn-secondary" onClick={handleRemoveLogoImage}>
                              Remover logo
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="form-group admin-home-content__form-group--full">
                      <label>
                        {form.section_type === 'orange-ad'
                          ? 'Chamada da propaganda'
                          : form.section_type === 'header-menu'
                            ? 'Texto do link'
                            : 'Titulo do card'}
                      </label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(event) => handleInputChange('title', event.target.value)}
                        placeholder={form.section_type === 'header-menu' ? 'Ex.: Fresadoras' : 'Texto principal'}
                        required
                      />
                    </div>

                    {form.section_type !== 'header-menu' && (
                      <div className="form-group admin-home-content__form-group--full">
                        <label>Descricao</label>
                        <textarea
                          value={form.description}
                          onChange={(event) => handleInputChange('description', event.target.value)}
                          placeholder="Texto complementar. Quebre linhas para separar os blocos."
                        />
                      </div>
                    )}

                    {form.section_type !== 'header-menu' && (
                      <div className="form-group">
                        <label>Texto do botão</label>
                        <input
                          type="text"
                          value={form.button_label}
                          onChange={(event) => handleInputChange('button_label', event.target.value)}
                          placeholder="Saiba Mais"
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label>{form.section_type === 'header-menu' ? 'Link do menu' : 'Link do botão'}</label>
                      <input
                        type="text"
                        value={form.link_url}
                        onChange={(event) => handleInputChange('link_url', event.target.value)}
                        placeholder="/contato ou https://..."
                      />
                    </div>

                    <div className="admin-home-content__color-row admin-home-content__form-group--full">
                      <div className="form-group">
                        <label>Fundo</label>
                        <input
                          type="color"
                          value={form.background_color}
                          onChange={(event) => handleInputChange('background_color', event.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Texto</label>
                        <input
                          type="color"
                          value={form.text_color}
                          onChange={(event) => handleInputChange('text_color', event.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Botão</label>
                        <input
                          type="color"
                          value={form.button_color}
                          onChange={(event) => handleInputChange('button_color', event.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Texto do botão</label>
                        <input
                          type="color"
                          value={form.button_text_color}
                          onChange={(event) => handleInputChange('button_text_color', event.target.value)}
                        />
                      </div>
                    </div>

                    <label className="admin-home-content__check">
                      <input
                        type="checkbox"
                        checked={form.is_external}
                        onChange={(event) => handleInputChange('is_external', event.target.checked)}
                      />
                      <span>Abrir link em nova aba</span>
                    </label>

                    <label className="admin-home-content__check">
                      <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(event) => handleInputChange('active', event.target.checked)}
                      />
                      <span>Exibir no site</span>
                    </label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Salvar conteudo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && (
          <div className="modal-overlay">
            <motion.div
              className="modal-content"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
            >
              <div className="modal-body">
                <div className="modal-icon">
                  <AlertCircle size={32} />
                </div>
                <h3>Excluir conteudo?</h3>
                <p>Deseja remover <strong>{itemToDelete?.title}</strong>?</p>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary admin-home-content__danger-button"
                  onClick={confirmDelete}
                >
                  Sim, excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminHomeContent;
