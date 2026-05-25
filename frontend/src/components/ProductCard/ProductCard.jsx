/**
 * Componente: ProductCard
 * Uso: catalogos, paginas especiais e relacionados
 * Responsabilidade: renderizar o card reutilizavel de produto
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { trackProductClick } from '../../services/analytics';
import './ProductCard.css';

const FIXED_SEGMENT_NAMES = ['talmax digital', 'protese dentaria', 'nail e podologia'];

const getAvailableImages = (product) => (
  [product.image, ...(Array.isArray(product.images) ? product.images : [])]
    .filter(Boolean)
    .filter((image, index, images) => images.indexOf(image) === index)
);

const normalizeLabel = (value) => (
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const getProductLabels = (product) => (
  [product.category_names, product.category_name, product.category, product.subcategory, product.sub_category]
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      return String(value || '').split(',');
    })
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, labels) => labels.indexOf(value) === index)
);

const getProductBrand = (product) => {
  const explicitBrand = product.brand || product.marca || product.fabricante || product.manufacturer;
  if (explicitBrand) return explicitBrand;
  if (product.is_upcera === true || Number(product.is_upcera) === 1) return 'UPCERA';

  const labels = getProductLabels(product);
  const knownBrand = labels.find((label) => ['upcera', 'talmax'].includes(normalizeLabel(label)));
  return knownBrand || 'Talmax';
};

const getProductCategory = (product, brand) => {
  const explicitCategory = product.product_type || product.tipo || product.type;
  if (explicitCategory) return explicitCategory;

  const normalizedBrand = normalizeLabel(brand);
  const labels = getProductLabels(product);
  return labels.find((label) => {
    const normalizedLabel = normalizeLabel(label);
    return normalizedLabel !== normalizedBrand && !FIXED_SEGMENT_NAMES.includes(normalizedLabel);
  }) || 'Produto';
};

const ProductCard = ({ product, imageLoading = 'lazy', imageFetchPriority = 'auto' }) => {
  const availableImages = getAvailableImages(product);
  const [activeImage, setActiveImage] = React.useState(availableImages[0] || '');
  const [shouldLoadThumbnails, setShouldLoadThumbnails] = React.useState(false);
  const navigate = useNavigate();
  const productBrand = getProductBrand(product);
  const productCategory = getProductCategory(product, productBrand);

  // Sincroniza a imagem ativa quando o produto muda
  React.useEffect(() => {
    setActiveImage(getAvailableImages(product)[0] || '');
    setShouldLoadThumbnails(false);
  }, [product]);

  const handleCardClick = () => {
    trackProductClick(product, 'product_card');
    navigate(`/produto/${product.id}`);
    window.scrollTo(0, 0);
  };

  return (
    <div
      className="premium-product-card"
      onClick={handleCardClick}
      onMouseEnter={() => setShouldLoadThumbnails(true)}
      onFocus={() => setShouldLoadThumbnails(true)}
      style={{ cursor: 'pointer' }}
    >
      <div className={`card-image-box${activeImage ? '' : ' is-empty'}`}>
        {activeImage && (
          <img
            src={activeImage}
            alt={product.name}
            loading={imageLoading}
            fetchPriority={imageFetchPriority}
            decoding="async"
            onError={() => {
              setActiveImage(availableImages.find((image) => image !== activeImage) || '');
            }}
          />
        )}
        
        {shouldLoadThumbnails && availableImages.length > 1 && (
          <div className="product-thumbnails">
            {availableImages.map((img, idx) => (
              <img 
                key={idx} 
                src={img} 
                alt="thumb" 
                className={activeImage === img ? 'active' : ''}
                loading="lazy"
                fetchPriority="low"
                decoding="async"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImage(img);
                }}
              />
            ))}
          </div>
        )}
      </div>
      
      <div className="card-details">
        <div className="card-copy">
          <h3 className="card-title">{product.name}</h3>
          <div className="card-brand">{productBrand}</div>
          <div className="card-category">{productCategory}</div>
        </div>

        <div className="card-footer-lux">
          <Link 
            to={`/produto/${product.id}`}
            className="btn-quote-lux"
            aria-label={`Ver detalhes de ${product.name}`}
            onClick={(e) => {
              e.stopPropagation();
              trackProductClick(product, 'product_card_button');
            }}
          >
            Saiba Mais
            <ChevronRight size={22} strokeWidth={2.15} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
