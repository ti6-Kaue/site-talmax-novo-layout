import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Menu,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAdmin } from '../../../context/useAdmin';
import homeContentBlockService from '../../../services/homeContentBlockService';
import '../AdminHomeContent/AdminHomeContent.css';

const buildEmptyForm = () => ({
  section_type: 'header-menu',
  title: '',
  description: '',
  logo_text: '',
  logo_image_url: '',
  button_label: '',
  link_url: '',
  is_external: false,
  background_color: '#ffffff',
  text_color: '#243f96',
  button_color: '#374c92',
  button_text_color: '#ffffff',
  display_order: '0',
  active: true
});

const normalizeFormFromItem = (item) => ({
  ...buildEmptyForm(),
  title: item.title || '',
  link_url: item.link_url || '',
  is_external: Boolean(item.is_external),
  display_order: String(item.display_order ?? 0),
  active: Boolean(item.active)
});

const buildPayload = (form) => {
  const formData = new FormData();
  formData.append('section_type', 'header-menu');
  formData.append('title', form.title || '');
  formData.append('description', '');
  formData.append('logo_text', '');
  formData.append('logo_image_url', '');
  formData.append('button_label', '');
  formData.append('link_url', form.link_url || '');
  formData.append('is_external', String(Boolean(form.is_external)));
  formData.append('background_color', form.background_color || '#ffffff');
  formData.append('text_color', form.text_color || '#243f96');
  formData.append('button_color', form.button_color || '#374c92');
  formData.append('button_text_color', form.button_text_color || '#ffffff');
  formData.append('display_order', String(Number.parseInt(form.display_order, 10) || 0));
  formData.append('active', String(Boolean(form.active)));

  return formData;
};

const getCategorySlugFromPath = (value = '') => {
  const match = String(value || '').trim().match(/^\/categoria\/([^/?#]+)/);

  return match ? decodeURIComponent(match[1]) : '';
};

const AdminHeaderMenu = () => {
  const { addToast, categories } = useAdmin();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(buildEmptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [addingCategoryId, setAddingCategoryId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await homeContentBlockService.getAll({ admin: true });
      setItems((Array.isArray(data) ? data : []).filter((item) => item.section_type === 'header-menu'));
    } catch (error) {
      console.error('Erro ao carregar menu do cabeçalho:', error);
      addToast(error.message || 'Erro ao carregar menu do cabeçalho', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const availableHeaderCategories = useMemo(() => (
    (Array.isArray(categories) ? categories : [])
      .filter((category) => category?.slug)
      .filter((category) => !category.parent_id)
      .sort((a, b) => {
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      })
  ), [categories]);

  const headerMenuLinks = useMemo(() => new Set(
    items.map((item) => String(item.link_url || '').trim())
  ), [items]);
  const categoryNameBySlug = useMemo(() => new Map(
    (Array.isArray(categories) ? categories : [])
      .filter((category) => category?.slug)
      .map((category) => [String(category.slug), category.name || category.slug])
  ), [categories]);

  const sortedItems = useMemo(() => (
    items.slice().sort((a, b) => {
      const orderDifference = Number(a.display_order || 0) - Number(b.display_order || 0);

      return orderDifference || String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
    })
  ), [items]);
  const filteredHeaderCategories = useMemo(() => {
    const normalizedSearch = categorySearchTerm.trim().toLowerCase();
    const categoriesNotAdded = availableHeaderCategories.filter((category) => (
      !headerMenuLinks.has(`/categoria/${category.slug}`)
    ));

    if (!normalizedSearch) {
      return categoriesNotAdded;
    }

    return categoriesNotAdded.filter((category) => (
      `${category.name || ''} ${category.slug || ''}`.toLowerCase().includes(normalizedSearch)
    ));
  }, [availableHeaderCategories, categorySearchTerm, headerMenuLinks]);

  const handleCreate = () => {
    setEditingItem(null);
    setForm(buildEmptyForm());
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm(normalizeFormFromItem(item));
    setShowModal(true);
  };

  const handleInputChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
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
        addToast('Item do cabecalho atualizado com sucesso!');
      } else {
        await homeContentBlockService.create(buildPayload(form));
        addToast('Item do cabecalho criado com sucesso!');
      }

      setShowModal(false);
      setEditingItem(null);
      await loadItems();
    } catch (error) {
      console.error('Erro ao salvar item do cabeçalho:', error);
      addToast(error.message || 'Erro ao salvar item do cabeçalho', 'error');
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
      addToast(nextStatus ? 'Item ativado no cabeçalho!' : 'Item ocultado do cabeçalho!');
      await loadItems();
    } catch (error) {
      console.error('Erro ao alterar item do cabeçalho:', error);
      addToast(error.message || 'Erro ao alterar item do cabeçalho', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleOrderChange = async (item, value) => {
    const nextOrder = Math.max(Number.parseInt(value, 10) || 0, 0);

    if (Number(item.display_order || 0) === nextOrder || updatingOrderId === item.id) {
      return;
    }

    const nextForm = {
      ...normalizeFormFromItem(item),
      display_order: String(nextOrder)
    };

    try {
      setUpdatingOrderId(item.id);
      await homeContentBlockService.update(item.id, buildPayload(nextForm));
      await loadItems();
    } catch (error) {
      console.error('Erro ao alterar ordem do cabeçalho:', error);
      addToast(error.message || 'Erro ao alterar ordem do cabeçalho', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleAddCategoryToHeader = async (category) => {
    if (!category?.slug || addingCategoryId === category.id) {
      return;
    }

    const categoryPath = `/categoria/${category.slug}`;
    const maxDisplayOrder = items.reduce(
      (maxOrder, item) => Math.max(maxOrder, Number(item.display_order || 0)),
      0
    );
    const nextForm = {
      ...buildEmptyForm(),
      title: category.name || category.slug,
      link_url: categoryPath,
      display_order: String(maxDisplayOrder + 10),
      active: true
    };

    try {
      setAddingCategoryId(category.id);
      await homeContentBlockService.create(buildPayload(nextForm));
      addToast('Categoria adicionada ao cabeçalho!');
      await loadItems();
    } catch (error) {
      console.error('Erro ao adicionar categoria ao cabeçalho:', error);
      addToast(error.message || 'Erro ao adicionar categoria ao cabeçalho', 'error');
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
      addToast('Item removido do cabeçalho!');
      setShowDeleteModal(false);
      setItemToDelete(null);
      await loadItems();
    } catch (error) {
      console.error('Erro ao remover item do cabeçalho:', error);
      addToast(error.message || 'Erro ao remover item do cabeçalho', 'error');
    }
  };

  const renderHeaderItemCard = (item) => {
    const categorySlug = getCategorySlugFromPath(item.link_url);
    const categoryName = categorySlug ? categoryNameBySlug.get(categorySlug) : '';

    return (
      <article key={item.id} className="admin-home-content__header-item">
        <div className="admin-home-content__header-item-main">
          <strong>{item.title}</strong>
          {categoryName && <em>Categoria: {categoryName}</em>}
          {item.link_url && <span title={item.link_url}>{item.link_url}</span>}
        </div>
        <div className="admin-header-menu-order">
          <label htmlFor={`header-order-${item.id}`}>Ordem</label>
          <input
            id={`header-order-${item.id}`}
            type="number"
            min="0"
            defaultValue={item.display_order}
            disabled={updatingOrderId === item.id}
            onBlur={(event) => handleOrderChange(item, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
          />
        </div>

        <div className="admin-home-content__actions">
          <button
            type="button"
            className={`status-badge ${item.active ? 'status-active' : 'status-inactive'} ${togglingId === item.id ? 'is-toggling' : ''}`}
            onClick={() => handleToggleStatus(item)}
            disabled={togglingId === item.id}
          >
            {item.active ? <Eye size={14} /> : <EyeOff size={14} />}
            {item.active ? 'Ativo' : 'Oculto'}
          </button>
        <button
          type="button"
          className="btn-secondary admin-home-content__danger-button"
            onClick={() => {
              setItemToDelete(item);
              setShowDeleteModal(true);
            }}
          >
            <Trash2 size={16} />
            Excluir
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="admin-home-content">
      <section className="admin-card admin-home-content__section">
        <div className="card-header admin-home-content__section-header">
          <div>
            <h2><Menu size={20} /> Cabeçalho do site</h2>
            <p>Escolha quais categorias principais aparecem no dropdown Produtos.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={handleCreate}>
            <Plus size={18} />
            Novo link manual
          </button>
        </div>

        <div className="card-body">
          <div className="admin-header-menu-layout">
            <div className="admin-home-content__category-picker">
              <div className="admin-home-content__category-picker-head">
                <div>
                  <strong>Categorias principais</strong>
                  <span>{filteredHeaderCategories.length} disponíveis de {availableHeaderCategories.length}</span>
                </div>
                <div className="admin-header-menu-search">
                  <input
                    type="search"
                    value={categorySearchTerm}
                    onChange={(event) => setCategorySearchTerm(event.target.value)}
                    placeholder="Buscar categoria..."
                  />
                  {categorySearchTerm && (
                    <button type="button" onClick={() => setCategorySearchTerm('')} aria-label="Limpar busca">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {availableHeaderCategories.length === 0 ? (
                <div className="empty-state">
                  <Menu size={32} />
                  <p>Nenhuma categoria cadastrada.</p>
                </div>
              ) : filteredHeaderCategories.length === 0 ? (
                <div className="empty-state">
                  <Menu size={32} />
                  <p>{categorySearchTerm ? 'Nenhuma categoria encontrada.' : 'Todas as categorias principais já estão no cabeçalho.'}</p>
                </div>
              ) : (
                <div className="admin-home-content__category-list">
                  {filteredHeaderCategories.map((category) => {
                    const categoryPath = `/categoria/${category.slug}`;

                    return (
                      <article key={category.id || category.slug} className="admin-home-content__category-option">
                        <div>
                          <strong>{category.name}</strong>
                          <span>{categoryPath}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleAddCategoryToHeader(category)}
                          disabled={addingCategoryId === category.id}
                        >
                          {addingCategoryId === category.id ? 'Adicionando...' : 'Adicionar'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="admin-header-menu-selected">
              <div className="admin-home-content__subheading">
                <div>
                  <strong>Itens no cabecalho</strong>
                  <span>{sortedItems.length} itens selecionados</span>
                </div>
              </div>

              {isLoading ? (
                <div className="loading-container">Carregando cabeçalho...</div>
              ) : sortedItems.length === 0 ? (
                <div className="empty-state">
                  <Menu size={32} />
                  <p>Nenhum item cadastrado no cabeçalho.</p>
                </div>
              ) : (
                <div className="admin-home-content__header-list">
                  {sortedItems.map(renderHeaderItemCard)}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

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
                <h3>{editingItem?.id ? 'Editar item do cabecalho' : 'Novo item do cabecalho'}</h3>
                <button type="button" className="btn-icon" onClick={() => setShowModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body admin-home-content__modal-body">
                  <div className="admin-home-content__form-grid">
                    <div className="form-group admin-home-content__form-group--full">
                      <label>Texto do link</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(event) => handleInputChange('title', event.target.value)}
                        placeholder="Ex.: Fresadoras"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Link do menu</label>
                      <input
                        type="text"
                        value={form.link_url}
                        onChange={(event) => handleInputChange('link_url', event.target.value)}
                        placeholder="/categoria/fresadoras ou https://..."
                      />
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
                    {isSubmitting ? 'Salvando...' : 'Salvar item'}
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
                <h3>Excluir item?</h3>
                <p>Deseja remover <strong>{itemToDelete?.title}</strong> do cabeçalho?</p>
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

export default AdminHeaderMenu;
