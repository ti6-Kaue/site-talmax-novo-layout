import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

const DescriptionFeaturesSection = ({ formData, setFormData }) => (
  <div className="admin-section-group">
    <span className="section-label">2. Descricao e Destaques</span>

    <div className="product-form-options">
      <label className="product-form-option">
        <input
          type="checkbox"
          checked={formData.descriptionAsList}
          onChange={(e) => setFormData((current) => ({ ...current, descriptionAsList: e.target.checked }))}
        />
        <div>
          <strong>Exibir descrição em tópicos</strong>
          <span>Cada linha da descrição vira um item com marcador na página do produto.</span>
        </div>
      </label>

      <label className="product-form-option">
        <input
          type="checkbox"
          checked={formData.showFeatures}
          onChange={(e) => setFormData((current) => ({ ...current, showFeatures: e.target.checked }))}
        />
        <div>
          <strong>Exibir destaques / diferenciais</strong>
          <span>Ative apenas se quiser mostrar tópicos extras separados da descrição.</span>
        </div>
      </label>
    </div>

    <div className="form-group">
      <label>Descrição</label>
      <textarea
        value={formData.description}
        onChange={(e) => setFormData((current) => ({ ...current, description: e.target.value }))}
        placeholder={
          formData.descriptionAsList
            ? 'Escreva um item por linha para virar um tópico no site'
            : 'Descreva o produto normalmente'
        }
      />
    </div>

    <div className={`form-group ${formData.showFeatures ? '' : 'product-form-group-disabled'}`}>
      <label>Destaques / Diferenciais</label>

      {!formData.showFeatures && (
        <p className="product-form-helper">
          Ative a opcao acima se quiser adicionar topicos extras de destaque para este produto.
        </p>
      )}

      {formData.features.map((feature, index) => (
        <div key={index} className="dynamic-input-group">
          <input
            disabled={!formData.showFeatures}
            value={feature}
            onChange={(e) => {
              setFormData((current) => {
                const nextFeatures = [...current.features];
                nextFeatures[index] = e.target.value;

                return {
                  ...current,
                  features: nextFeatures
                };
              });
            }}
          />
          <button
            type="button"
            className="btn-icon delete"
            disabled={!formData.showFeatures}
            onClick={() => {
              setFormData((current) => ({
                ...current,
                features: current.features.filter((_, featureIndex) => featureIndex !== index)
              }));
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}

      <button
        type="button"
        className="btn-add"
        disabled={!formData.showFeatures}
        onClick={() => {
          setFormData((current) => ({
            ...current,
            features: [...current.features, '']
          }));
        }}
      >
        <Plus size={16} /> Adicionar Destaque
      </button>
    </div>
  </div>
);

export default DescriptionFeaturesSection;
