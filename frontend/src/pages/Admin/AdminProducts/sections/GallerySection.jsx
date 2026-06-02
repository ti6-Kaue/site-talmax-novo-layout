import React from 'react';
import { UploadCloud, X } from 'lucide-react';
import { apiAssetPath } from '../../../../utils/assets';

const GallerySection = ({
  previews,
  primaryPreview,
  setPrimaryPreview,
  productBannerPreview,
  handleProductBannerChange,
  removeProductBanner,
  handleFileChange,
  removeImage
}) => (
  <div className="admin-section-group">
    <span className="section-label">3. Banner e Galeria de Fotos</span>

    <div className="product-banner-manager">
      <div className="product-banner-copy">
        <strong>Fundo do banner do produto</strong>
        <span>Essa imagem aparece no topo da página do produto, atrás da foto e do nome.</span>
      </div>

      <label className="product-banner-upload">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleProductBannerChange} />
        <UploadCloud size={26} color="var(--admin-primary)" />
        <span>{productBannerPreview ? 'Trocar fundo do banner' : 'Adicionar fundo do banner'}</span>
      </label>

      {productBannerPreview && (
        <div className="product-banner-preview">
          <img
            src={productBannerPreview.startsWith('blob:') ? productBannerPreview : apiAssetPath(productBannerPreview)}
            alt="Preview do banner do produto"
          />
          <button type="button" className="remove-preview" onClick={removeProductBanner}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>

    <div className="file-upload-area">
      <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} />
      <UploadCloud size={40} color="var(--admin-primary)" />
      <p>Clique ou arraste fotos para o produto</p>
    </div>

    {previews.length > 0 && (
      <p className="product-form-helper">
        Escolha qual foto deve ficar como principal. Essa será a imagem usada na listagem e no detalhe do produto.
      </p>
    )}

    <div className="admin-previews">
      {previews.map((src, index) => (
        <div key={index} className={`preview-thumb ${primaryPreview === src ? 'is-primary' : ''}`}>
          <img src={src.startsWith('blob:') ? src : apiAssetPath(src)} alt="Preview" />
          <button
            type="button"
            className={`preview-primary-toggle ${primaryPreview === src ? 'active' : ''}`}
            onClick={() => setPrimaryPreview(src)}
          >
            {primaryPreview === src ? 'Imagem principal' : 'Definir como principal'}
          </button>
          <button type="button" className="remove-preview" onClick={() => removeImage(index)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  </div>
);

export default GallerySection;
