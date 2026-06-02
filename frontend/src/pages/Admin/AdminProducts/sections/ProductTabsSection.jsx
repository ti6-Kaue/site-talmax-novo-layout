import React from 'react';
import { Plus, Trash2, Video } from 'lucide-react';

const ProductTabsSection = ({
  formData,
  setFormData,
  updateDynamicSection,
  removeDynamicSection,
  addDynamicSection
}) => (
  <div className="admin-section-group">
    <span className="section-label">4. Abas do Produto</span>

    <div className="form-group">
      <label>Nome da aba principal</label>
      <input
        type="text"
        value={formData.descriptionTabLabel}
        onChange={(e) => setFormData((current) => ({ ...current, descriptionTabLabel: e.target.value }))}
        placeholder="Ex.: Descricao Detalhada, Teste123, Visao Geral"
      />
    </div>

    <div className="form-group">
      <label>Abas do produto</label>
      <p className="product-form-helper">
        Adicione quantas abas extras quiser. Cada aba tem um nome e um conteúdo próprio para aparecer na página do produto.
      </p>

      {formData.productTabs.length === 0 && (
        <p className="product-form-helper">
          Nenhuma aba extra cadastrada ainda. Use o botão abaixo para criar a primeira.
        </p>
      )}

      {formData.productTabs.map((section, index) => (
        <div key={`dynamic-section-${index}`} className="dynamic-section-card">
          <div className="dynamic-section-card__header">
            <strong>Aba extra {index + 1}</strong>
            <button
              type="button"
              className="btn-icon delete"
              onClick={() => removeDynamicSection(index)}
              aria-label={`Remover aba extra ${index + 1}`}
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="dynamic-section-card__grid">
            <div className="dynamic-section-card__field">
              <label>Titulo da aba</label>
              <input
                type="text"
                value={section.title}
                onChange={(e) => updateDynamicSection(index, 'title', e.target.value)}
                placeholder="Ex.: Teste, Tecnico, Aplicacoes, Beneficios"
              />
            </div>
          </div>

          <label className="product-form-option dynamic-section-card__toggle">
            <input
              type="checkbox"
              checked={section.contentAsList}
              onChange={(e) => updateDynamicSection(index, 'contentAsList', e.target.checked)}
            />
            <div>
              <strong>Exibir conteúdo em tópicos</strong>
              <span>Cada linha do texto vira um item listado dentro desta aba.</span>
            </div>
          </label>

          <div className="dynamic-section-card__field">
            <label>Conteúdo da aba</label>
            <textarea
              value={section.content}
              onChange={(e) => updateDynamicSection(index, 'content', e.target.value)}
              placeholder={
                section.contentAsList
                  ? 'Escreva um item por linha para montar a lista desta aba'
                  : 'Escreva o conteúdo que será mostrado ao clicar nesta aba'
              }
            />
          </div>

          <div className="dynamic-section-card__field">
            <label><Video size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Link do vídeo (opcional)</label>
            <input
              type="url"
              value={section.videoUrl || ''}
              onChange={(e) => updateDynamicSection(index, 'videoUrl', e.target.value)}
              placeholder="Ex.: https://www.youtube.com/watch?v=... ou https://vimeo.com/..."
            />
            <p className="product-form-helper">
              Cole o link do YouTube ou Vimeo. O vídeo será exibido dentro da aba junto com o conteúdo.
            </p>
          </div>

          <label className="product-form-option dynamic-section-card__toggle">
            <input
              type="checkbox"
              checked={section.showContentWithVideo !== false}
              onChange={(e) => updateDynamicSection(index, 'showContentWithVideo', e.target.checked)}
            />
            <div>
              <strong>Exibir descrição junto do vídeo</strong>
              <span>Se desativado, a aba mostra só o título e o vídeo.</span>
            </div>
          </label>
        </div>
      ))}

      <button type="button" className="btn-add" onClick={addDynamicSection}>
        <Plus size={16} /> Adicionar Aba Extra
      </button>
    </div>
  </div>
);

export default ProductTabsSection;
