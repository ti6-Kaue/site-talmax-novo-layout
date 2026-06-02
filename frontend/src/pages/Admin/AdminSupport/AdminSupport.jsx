import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Globe,
  Headphones,
  Image as ImageIcon,
  Pencil,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '../../../context/useAdmin';
import { apiAssetPath } from '../../../utils/assets';
import pageSettingsService, { DEFAULT_SPECIAL_PAGE_SETTINGS, normalizeSpecialPageSettings } from '../../../services/pageSettingsService';
import supportService from '../../../services/supportService';
import '../AdminTechnicalAssistance/AdminTechnicalAssistance.css';
import './AdminSupport.css';

const DEFAULT_PAGE_SETTINGS = DEFAULT_SPECIAL_PAGE_SETTINGS.support;

const buildEmptyContentCardForm = () => ({
  title: '',
  description: '',
  description_secondary: '',
  button_label: 'Saiba mais',
  link_url: '',
  display_order: 0,
  is_active: true
});

const clampNumber = (value, fallback, min, max) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
};

const buildPageSettingsForm = (setting = DEFAULT_PAGE_SETTINGS) => {
  const mergedSetting = {
    ...DEFAULT_PAGE_SETTINGS,
    ...setting
  };

  return {
    ...mergedSetting,
    hero_content_x: clampNumber(mergedSetting.hero_content_x, DEFAULT_PAGE_SETTINGS.hero_content_x, 0, 100),
    hero_content_y: clampNumber(mergedSetting.hero_content_y, DEFAULT_PAGE_SETTINGS.hero_content_y, 0, 100),
    logo_width: clampNumber(mergedSetting.logo_width, DEFAULT_PAGE_SETTINGS.logo_width, 80, 520),
    logoFile: null,
    logoPreview: mergedSetting.logo_url ? apiAssetPath(mergedSetting.logo_url) : null,
    bannerFile: null,
    bannerPreview: mergedSetting.banner_url ? apiAssetPath(mergedSetting.banner_url) : null
  };
};

const buildHeroContentPreviewStyle = (form) => ({
  left: `${clampNumber(form.hero_content_x, DEFAULT_PAGE_SETTINGS.hero_content_x, 0, 100)}%`,
  top: `${clampNumber(form.hero_content_y, DEFAULT_PAGE_SETTINGS.hero_content_y, 0, 100)}%`,
  '--admin-technical-assistance-preview-logo-width': `${clampNumber(form.logo_width, DEFAULT_PAGE_SETTINGS.logo_width, 80, 520)}px`
});

const AdminSupport = () => {
  const { addToast } = useAdmin();
  const [pageSettingsForm, setPageSettingsForm] = useState(buildPageSettingsForm());
  const [isPageSettingsLoading, setIsPageSettingsLoading] = useState(true);
  const [isPageSettingsSaving, setIsPageSettingsSaving] = useState(false);
  const [contentCards, setContentCards] = useState([]);
  const [isContentCardsLoading, setIsContentCardsLoading] = useState(true);
  const [showContentCardModal, setShowContentCardModal] = useState(false);
  const [showContentCardDeleteModal, setShowContentCardDeleteModal] = useState(false);
  const [contentCardToDelete, setContentCardToDelete] = useState(null);
  const [editingContentCard, setEditingContentCard] = useState(null);
  const [contentCardForm, setContentCardForm] = useState(buildEmptyContentCardForm());
  const [isContentCardSubmitting, setIsContentCardSubmitting] = useState(false);

  const loadPageSettings = useCallback(async () => {
    setIsPageSettingsLoading(true);

    try {
      const items = await pageSettingsService.getAll();
      const normalizedMap = normalizeSpecialPageSettings(items);
      setPageSettingsForm(buildPageSettingsForm(normalizedMap.support));
    } catch (error) {
      console.error('Erro ao carregar conteúdo da página de suporte:', error);
      addToast(error.message || 'Erro ao carregar conteúdo da página de suporte', 'error');
    } finally {
      setIsPageSettingsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadPageSettings();
  }, [loadPageSettings]);

  const loadContentCards = useCallback(async () => {
    setIsContentCardsLoading(true);

    try {
      const data = await supportService.getContentCards({ includeInactive: true });
      setContentCards(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar cards de suporte:', error);
      addToast(error.message || 'Erro ao carregar cards de suporte', 'error');
    } finally {
      setIsContentCardsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadContentCards();
  }, [loadContentCards]);

  const handlePageSettingsInputChange = (field, value) => {
    setPageSettingsForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handlePageSettingsNumberChange = (field, value, min, max) => {
    setPageSettingsForm((current) => ({
      ...current,
      [field]: clampNumber(value, current[field], min, max)
    }));
  };

  const handlePageSettingsImageChange = (field, file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPageSettingsForm((current) => ({
        ...current,
        [`${field}File`]: file,
        [`${field}Preview`]: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePageLogo = () => {
    setPageSettingsForm((current) => ({
      ...current,
      logo_url: '',
      logoFile: null,
      logoPreview: null
    }));
  };

  const handleResetBanner = () => {
    setPageSettingsForm((current) => ({
      ...current,
      banner_url: '',
      bannerFile: null,
      bannerPreview: null
    }));
  };

  const handleSavePageSettings = async () => {
    if (isPageSettingsSaving) return;

    setIsPageSettingsSaving(true);

    try {
      const formData = new FormData();
      formData.append('overline', pageSettingsForm.overline || '');
      formData.append('title', pageSettingsForm.title || '');
      formData.append('description', pageSettingsForm.description || '');
      formData.append('logo_url', pageSettingsForm.logo_url || '');
      formData.append('banner_url', pageSettingsForm.banner_url || '');
      formData.append('hero_content_x', pageSettingsForm.hero_content_x ?? DEFAULT_PAGE_SETTINGS.hero_content_x);
      formData.append('hero_content_y', pageSettingsForm.hero_content_y ?? DEFAULT_PAGE_SETTINGS.hero_content_y);
      formData.append('logo_width', pageSettingsForm.logo_width ?? DEFAULT_PAGE_SETTINGS.logo_width);
      formData.append('hero_tagline', '');
      formData.append('info_title', pageSettingsForm.info_title || '');
      formData.append('info_subtitle', pageSettingsForm.info_subtitle || '');
      formData.append('info_body', pageSettingsForm.info_body || '');

      if (pageSettingsForm.logoFile) {
        formData.append('logo', pageSettingsForm.logoFile);
      }

      if (pageSettingsForm.bannerFile) {
        formData.append('banner', pageSettingsForm.bannerFile);
      }

      const result = await pageSettingsService.update('support', formData);
      if (result?.item) {
        setPageSettingsForm(buildPageSettingsForm(result.item));
      }
      addToast('Conteúdo da página de suporte atualizado com sucesso!');
      await loadPageSettings();
    } catch (error) {
      console.error('Erro ao salvar conteúdo da página de suporte:', error);
      addToast(error.message || 'Erro ao salvar conteúdo da página de suporte', 'error');
    } finally {
      setIsPageSettingsSaving(false);
    }
  };

  const resetContentCardForm = () => {
    setContentCardForm(buildEmptyContentCardForm());
    setEditingContentCard(null);
  };

  const handleCreateContentCard = () => {
    resetContentCardForm();
    setShowContentCardModal(true);
  };

  const handleEditContentCard = (card) => {
    setEditingContentCard(card);
    setContentCardForm({
      title: card.title || '',
      description: card.description || '',
      description_secondary: card.description_secondary || '',
      button_label: card.button_label || 'Saiba mais',
      link_url: card.link_url || '',
      display_order: Number(card.display_order) || 0,
      is_active: card.is_active !== false
    });
    setShowContentCardModal(true);
  };

  const handleContentCardDeleteClick = (card) => {
    setContentCardToDelete(card);
    setShowContentCardDeleteModal(true);
  };

  const handleContentCardInputChange = (field, value) => {
    setContentCardForm((current) => ({
      ...current,
      [field]: field === 'is_active' ? Boolean(value) : value
    }));
  };

  const handleContentCardSubmit = async (event) => {
    event.preventDefault();

    if (isContentCardSubmitting) {
      return;
    }

    const payload = {
      ...contentCardForm,
      display_order: Number(contentCardForm.display_order) || 0,
      is_active: Boolean(contentCardForm.is_active)
    };

    try {
      setIsContentCardSubmitting(true);

      if (editingContentCard?.id) {
        await supportService.updateContentCard(editingContentCard.id, payload);
        addToast('Card de suporte atualizado com sucesso!');
      } else {
        await supportService.createContentCard(payload);
        addToast('Card de suporte criado com sucesso!');
      }

      setShowContentCardModal(false);
      resetContentCardForm();
      await loadContentCards();
    } catch (error) {
      console.error('Erro ao salvar card de suporte:', error);
      addToast(error.message || 'Erro ao salvar card de suporte', 'error');
    } finally {
      setIsContentCardSubmitting(false);
    }
  };

  const confirmContentCardDelete = async () => {
    if (!contentCardToDelete?.id) {
      return;
    }

    try {
      await supportService.removeContentCard(contentCardToDelete.id);
      addToast('Card de suporte removido com sucesso!');
      setShowContentCardDeleteModal(false);
      setContentCardToDelete(null);
      await loadContentCards();
    } catch (error) {
      console.error('Erro ao excluir card de suporte:', error);
      addToast(error.message || 'Erro ao excluir card de suporte', 'error');
    }
  };

  return (
    <div className="admin-technical-assistance admin-support">
      <div className="admin-card admin-technical-assistance__page-settings">
        <div className="card-header admin-technical-assistance__header">
          <div className="admin-technical-assistance__header-copy">
            <h2><ImageIcon size={20} /> Conteúdo da página de suporte</h2>
            <p>Edite o banner, logo, texto do topo e o bloco "Ao seu lado em cada resultado".</p>
          </div>
        </div>

        <div className="card-body">
          {isPageSettingsLoading ? (
            <div className="loading-container">Carregando conteúdo da página...</div>
          ) : (
            <article className="admin-technical-assistance__settings-panel">
              <div className="admin-technical-assistance__settings-grid">
                <div className="form-group admin-technical-assistance__form-group--full">
                  <label>Banner do suporte</label>
                  <div className="file-upload-area admin-technical-assistance__upload-area admin-technical-assistance__upload-area--banner">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => handlePageSettingsImageChange('banner', event.target.files?.[0])}
                    />
                    <UploadCloud size={28} color="var(--admin-primary)" />
                    <p>Enviar imagem do banner</p>
                  </div>

                  {pageSettingsForm.bannerPreview && (
                    <div className="admin-technical-assistance__preview admin-technical-assistance__preview--banner">
                      <img src={pageSettingsForm.bannerPreview} alt="Preview do banner do suporte" />
                      <button type="button" className="btn-secondary" onClick={handleResetBanner}>
                        Remover banner
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group admin-technical-assistance__form-group--full">
                  <label>Prévia da posição no banner</label>
                  <div className="admin-technical-assistance__hero-preview">
                    {pageSettingsForm.bannerPreview ? (
                      <img src={pageSettingsForm.bannerPreview} alt="" aria-hidden="true" />
                    ) : (
                      <div className="admin-technical-assistance__hero-preview-empty">
                        Envie um banner para visualizar a posição
                      </div>
                    )}

                    <div
                      className="admin-technical-assistance__hero-preview-content"
                      style={buildHeroContentPreviewStyle(pageSettingsForm)}
                    >
                      {pageSettingsForm.logoPreview && (
                        <img
                          src={pageSettingsForm.logoPreview}
                          alt=""
                          aria-hidden="true"
                          className="admin-technical-assistance__hero-preview-logo"
                        />
                      )}
                      {pageSettingsForm.description && (
                        <p>{pageSettingsForm.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Logo do banner</label>
                  <div className="file-upload-area admin-technical-assistance__upload-area">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => handlePageSettingsImageChange('logo', event.target.files?.[0])}
                    />
                    <UploadCloud size={28} color="var(--admin-primary)" />
                    <p>Enviar logo</p>
                  </div>

                  {pageSettingsForm.logoPreview && (
                    <div className="admin-technical-assistance__preview">
                      <img src={pageSettingsForm.logoPreview} alt="Preview do logo do suporte" />
                      <button type="button" className="btn-secondary" onClick={handleRemovePageLogo}>
                        Remover logo
                      </button>
                    </div>
                  )}
                </div>

                <div className="admin-technical-assistance__settings-fields">
                  <div className="form-group">
                    <label>Texto abaixo do logo</label>
                    <textarea
                      rows="3"
                      value={pageSettingsForm.description || ''}
                      onChange={(event) => handlePageSettingsInputChange('description', event.target.value)}
                      placeholder="Estamos com você todos os dias..."
                    />
                  </div>

                  <div className="form-group admin-technical-assistance__form-group--full">
                    <label>Posição da logo e do texto</label>
                    <div className="admin-technical-assistance__range-grid">
                      <label className="admin-technical-assistance__range-control">
                        <span>Horizontal <strong>{pageSettingsForm.hero_content_x}%</strong></span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={pageSettingsForm.hero_content_x}
                          onChange={(event) => handlePageSettingsNumberChange('hero_content_x', event.target.value, 0, 100)}
                        />
                      </label>

                      <label className="admin-technical-assistance__range-control">
                        <span>Vertical <strong>{pageSettingsForm.hero_content_y}%</strong></span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={pageSettingsForm.hero_content_y}
                          onChange={(event) => handlePageSettingsNumberChange('hero_content_y', event.target.value, 0, 100)}
                        />
                      </label>

                      <label className="admin-technical-assistance__range-control">
                        <span>Tamanho da logo <strong>{pageSettingsForm.logo_width}px</strong></span>
                        <input
                          type="range"
                          min="80"
                          max="520"
                          step="5"
                          value={pageSettingsForm.logo_width}
                          onChange={(event) => handlePageSettingsNumberChange('logo_width', event.target.value, 80, 520)}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="admin-support__info-fields">
                  <div className="form-group">
                    <label>Titulo do bloco de texto</label>
                    <input
                      type="text"
                      value={pageSettingsForm.info_title || ''}
                      onChange={(event) => handlePageSettingsInputChange('info_title', event.target.value)}
                      placeholder="Ao seu lado em cada resultado"
                    />
                  </div>

                  <div className="form-group">
                    <label>Subtitulo do bloco</label>
                    <input
                      type="text"
                      value={pageSettingsForm.info_subtitle || ''}
                      onChange={(event) => handlePageSettingsInputChange('info_subtitle', event.target.value)}
                      placeholder="Atendimento especializado..."
                    />
                  </div>

                  <div className="form-group admin-support__info-body">
                    <label>Texto do bloco</label>
                    <textarea
                      rows="8"
                      value={pageSettingsForm.info_body || ''}
                      onChange={(event) => handlePageSettingsInputChange('info_body', event.target.value)}
                      placeholder="Use uma linha em branco para separar paragrafos"
                    />
                  </div>
                </div>
              </div>

              <div className="admin-technical-assistance__settings-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSavePageSettings}
                  disabled={isPageSettingsSaving}
                >
                  <Save size={18} />
                  {isPageSettingsSaving ? 'Salvando...' : 'Salvar conteudo da pagina'}
                </button>
              </div>
            </article>
          )}
        </div>
      </div>

      <div className="admin-card admin-technical-assistance__content-section">
        <div className="card-header admin-technical-assistance__header">
          <div className="admin-technical-assistance__header-copy">
            <h2><Headphones size={20} /> Cards de suporte</h2>
            <p>Edite os dois cards de suporte exibidos abaixo do banner ou cadastre novos cards.</p>
          </div>

          <button type="button" className="btn-secondary" onClick={handleCreateContentCard}>
            <Plus size={18} />
            Novo card
          </button>
        </div>

        <div className="card-body">
          {isContentCardsLoading ? (
            <div className="loading-container">Carregando cards de suporte...</div>
          ) : contentCards.length === 0 ? (
            <div className="empty-state">
              <Headphones size={32} />
              <p>Nenhum card de suporte cadastrado.</p>
            </div>
          ) : (
            <div className="admin-technical-assistance__content-grid">
              {contentCards.map((card) => (
                <article key={card.id} className="admin-technical-assistance__content-card">
                  <div className="admin-technical-assistance__content-card-head">
                    <span className={`admin-technical-assistance__content-status${card.is_active ? ' is-active' : ''}`}>
                      {card.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="admin-technical-assistance__content-order">Ordem {Number(card.display_order) || 0}</span>
                  </div>

                  <h3 title={card.title}>{card.title}</h3>

                  {card.description && <p>{card.description}</p>}
                  {card.description_secondary && <p>{card.description_secondary}</p>}

                  {card.link_url && (
                    <span className="admin-technical-assistance__content-link" title={card.link_url}>
                      <Globe size={15} />
                      <span>{card.link_url}</span>
                    </span>
                  )}

                  <div className="admin-technical-assistance__actions">
                    <button type="button" className="btn-secondary" onClick={() => handleEditContentCard(card)}>
                      <Pencil size={16} />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-secondary admin-technical-assistance__danger-button"
                      onClick={() => handleContentCardDeleteClick(card)}
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showContentCardModal && (
          <div className="modal-overlay">
            <motion.div
              className="modal-content admin-technical-assistance__modal"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
            >
              <div className="modal-header">
                <h3>{editingContentCard?.id ? 'Editar card de suporte' : 'Novo card de suporte'}</h3>
                <button type="button" className="btn-icon" onClick={() => setShowContentCardModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleContentCardSubmit}>
                <div className="modal-body admin-technical-assistance__modal-body">
                  <div className="admin-technical-assistance__form-grid">
                    <div className="form-group admin-technical-assistance__form-group--full">
                      <label>Titulo do card</label>
                      <input
                        type="text"
                        value={contentCardForm.title}
                        onChange={(event) => handleContentCardInputChange('title', event.target.value)}
                        placeholder="Suporte Digital"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Texto do botao</label>
                      <input
                        type="text"
                        value={contentCardForm.button_label}
                        onChange={(event) => handleContentCardInputChange('button_label', event.target.value)}
                        placeholder="Saiba mais"
                      />
                    </div>

                    <div className="form-group">
                      <label>Ordem</label>
                      <input
                        type="number"
                        min="0"
                        value={contentCardForm.display_order}
                        onChange={(event) => handleContentCardInputChange('display_order', event.target.value)}
                        placeholder="0"
                      />
                    </div>

                    <div className="form-group admin-technical-assistance__form-group--full">
                      <label>Primeiro texto do card</label>
                      <textarea
                        rows="4"
                        value={contentCardForm.description}
                        onChange={(event) => handleContentCardInputChange('description', event.target.value)}
                        placeholder="Texto principal do card"
                      />
                    </div>

                    <div className="form-group admin-technical-assistance__form-group--full">
                      <label>Segundo texto do card</label>
                      <textarea
                        rows="4"
                        value={contentCardForm.description_secondary}
                        onChange={(event) => handleContentCardInputChange('description_secondary', event.target.value)}
                        placeholder="Texto complementar do card"
                      />
                    </div>

                    <div className="form-group admin-technical-assistance__form-group--full">
                      <label>Link do card</label>
                      <input
                        type="text"
                        value={contentCardForm.link_url}
                        onChange={(event) => handleContentCardInputChange('link_url', event.target.value)}
                        placeholder="https://talmax.com.br/suportetalmax/"
                      />
                    </div>

                    <label className="admin-technical-assistance__checkbox admin-technical-assistance__form-group--full">
                      <input
                        type="checkbox"
                        checked={contentCardForm.is_active}
                        onChange={(event) => handleContentCardInputChange('is_active', event.target.checked)}
                      />
                      Exibir card na pagina publica
                    </label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowContentCardModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={isContentCardSubmitting}>
                    {isContentCardSubmitting ? 'Salvando...' : 'Salvar card'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showContentCardDeleteModal && (
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
                <h3>Excluir card de suporte?</h3>
                <p>Deseja remover o card <strong>{contentCardToDelete?.title}</strong>?</p>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowContentCardDeleteModal(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary admin-technical-assistance__danger-button"
                  onClick={confirmContentCardDelete}
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

export default AdminSupport;
