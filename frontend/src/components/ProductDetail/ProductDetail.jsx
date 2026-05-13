/**
 * Pagina: ProductDetail
 * Rota: /produto/:id
 * Responsabilidade: exibir detalhes do produto, galeria, modelos e relacionados
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import {
  CheckCircle2,
  MessageCircle,
  Info,
  ChevronRight,
  ChevronLeft,
  Package,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import ProductCard from '../ProductCard/ProductCard';
import API_URL from '../../services/api';
import { trackProductView, trackQuoteClick, trackWhatsappClick } from '../../services/analytics';
import { apiAssetPath } from '../../utils/assets';
import { parseSafeExtraData } from '../../utils/contentSafety';
import { getVisibleCategoryLabel } from '../../utils/productCategories';
import 'swiper/css';
import 'swiper/css/navigation';
import './ProductDetail.css';

const shouldShowQuoteButton = (value) => !(
  value === false ||
  value === 'false' ||
  value === 0 ||
  value === '0'
);

const normalizeModelTable = (modelTable) => {
  const fallback = {
    headers: ['Tipo / Referencia', 'Codigo'],
    rows: [['', '']],
    mergeRanges: []
  };

  if (!modelTable || !Array.isArray(modelTable.headers) || !Array.isArray(modelTable.rows)) {
    return fallback;
  }

  const headers = modelTable.headers.length > 0
    ? modelTable.headers.map((header) => (typeof header === 'string' ? header : ''))
    : fallback.headers;

  const rows = modelTable.rows.length > 0
    ? modelTable.rows.map((row) => {
      const normalizedRow = Array.isArray(row) ? row.map((cell) => (typeof cell === 'string' ? cell : '')) : [];
      while (normalizedRow.length < headers.length) {
        normalizedRow.push('');
      }
      return normalizedRow.slice(0, headers.length);
    })
    : [];

  const normalizeMergeRanges = (mergeRanges) => {
    if (!Array.isArray(mergeRanges)) {
      return [];
    }

    return mergeRanges
      .map((range) => {
        const startRow = Number.parseInt(range?.startRow ?? range?.row, 10);
        const endRow = Number.parseInt(range?.endRow ?? range?.row, 10);
        const rawStart = Number.parseInt(range?.startCol, 10);
        const rawEnd = Number.parseInt(range?.endCol, 10);

        if (!Number.isInteger(startRow) || !Number.isInteger(endRow) || !Number.isInteger(rawStart) || !Number.isInteger(rawEnd)) {
          return null;
        }

        const normalizedStartRow = Math.max(0, Math.min(Math.min(startRow, endRow), rows.length));
        const normalizedEndRow = Math.max(0, Math.min(Math.max(startRow, endRow), rows.length));
        const startCol = Math.max(0, Math.min(Math.min(rawStart, rawEnd), headers.length - 1));
        const endCol = Math.max(0, Math.min(Math.max(rawStart, rawEnd), headers.length - 1));

        if ((normalizedEndRow <= normalizedStartRow) && (endCol <= startCol)) {
          return null;
        }

        return { startRow: normalizedStartRow, endRow: normalizedEndRow, startCol, endCol };
      })
      .filter(Boolean);
  };

  const legacyMergeRanges = modelTable?.mergedHeader
    ? [{
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: Number.isInteger(modelTable.mergedHeaderEndColumn)
        ? Math.max(0, Math.min(modelTable.mergedHeaderEndColumn, headers.length - 1))
        : headers.length - 1
    }]
    : [];

  const mergeRanges = normalizeMergeRanges(
    Array.isArray(modelTable?.mergeRanges) && modelTable.mergeRanges.length > 0
      ? modelTable.mergeRanges
      : legacyMergeRanges
  );

  return { headers, rows, mergeRanges };
};

const getMergeRangeForCell = (mergeRanges, rowIndex, colIndex) => (
  Array.isArray(mergeRanges)
    ? mergeRanges.find((range) => (
      range.startRow <= rowIndex
      && range.endRow >= rowIndex
      && range.startCol <= colIndex
      && range.endCol >= colIndex
    )) || null
    : null
);

const normalizeTechnicalTables = (tables, legacyTitle = '', legacyTable = null) => {
  if (Array.isArray(tables) && tables.length > 0) {
    return tables.map((table) => ({
      title: typeof table?.title === 'string' ? table.title : '',
      modelTable: normalizeModelTable(table?.modelTable || table?.table || table)
    }));
  }

  if (!legacyTable) {
    return [];
  }

  return [{
    title: typeof legacyTitle === 'string' ? legacyTitle : '',
    modelTable: normalizeModelTable(legacyTable)
  }];
};

const normalizeDynamicSections = (sections, legacySections = []) => {
  const source = Array.isArray(sections) && sections.length > 0 ? sections : legacySections;

  return Array.isArray(source)
    ? source
      .map((section, index) => ({
        id: section?.id ? `dynamic-${section.id}` : `dynamic-${index}`,
        title: typeof section?.title === 'string' ? section.title.trim() : '',
        content: typeof section?.content === 'string' ? section.content : '',
        contentAsList: Boolean(section?.contentAsList || section?.content_as_list),
        showContentWithVideo: section?.showContentWithVideo ?? section?.show_content_with_video ?? true,
        videoUrl: typeof (section?.videoUrl || section?.video_url) === 'string'
          ? (section.videoUrl || section.video_url).trim()
          : ''
      }))
      .filter((section) => section.title && (section.content.trim() || section.videoUrl))
    : [];
};

const getVideoEmbedUrl = (url) => {
  if (!url) return null;

  // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo: vimeo.com/ID, player.vimeo.com/video/ID
  const vimeoMatch = url.match(
    /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/
  );
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
};

const renderSectionContent = (content, asList = false) => {
  if (asList) {
    return (
      <ul className="description-list">
        {content.split('\n').filter((line) => line.trim() !== '').map((line, idx) => (
          <li key={idx}><CheckCircle2 size={16} className="text-primary" /> {line}</li>
        ))}
      </ul>
    );
  }

  return <p>{content}</p>;
};

const isLegacyDefaultDescriptionTabLabel = (label) => {
  const normalizedLabel = String(label || '')
    .trim()
    .toLocaleLowerCase('pt-BR');

  return normalizedLabel === 'descricao detalhada';
};

const isLegacyDefaultTechnicalTabLabel = (label) => {
  const normalizedLabel = String(label || '')
    .trim()
    .toLocaleLowerCase('pt-BR');

  return normalizedLabel === 'informacao tecnica';
};

const normalizeCategoryIds = (value) => (
  Array.isArray(value)
    ? value.map(Number).filter((id) => Number.isFinite(id))
    : []
);

const shuffleProducts = (products) => {
  const shuffled = [...products];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [activeImage, setActiveImage] = useState('');
  const [isFeaturesCollapsed, setIsFeaturesCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState('description');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProductData = async () => {
      setLoading(true);
      try {
        const [prodRes, allRes] = await Promise.all([
          fetch(`${API_URL}/products/${id}`),
          fetch(`${API_URL}/products`)
        ]);

        if (!prodRes.ok) {
          navigate('/produtos');
          return;
        }

        const data = await prodRes.json();
        const others = await allRes.json();

        const extra = parseSafeExtraData(data.extra_data);

        let finalTable = extra.modelTable;
        if (!finalTable && extra.models && extra.models.length > 0) {
          finalTable = {
            headers: extra.modelHeaders || ['Tipo / Referencia', 'Codigo'],
            rows: (typeof extra.models[0] === 'object' && !Array.isArray(extra.models[0]))
              ? extra.models.map((model) => [model.type || '', model.code || ''])
              : extra.models
          };
        }

        const fixedSegmentNames = ['Talmax Digital', 'Protese Dentaria', 'Nail e Podologia'];

        const formattedProduct = {
          id: data.id,
          name: data.name,
          category_names: data.category_names || data.category_name || '',
          is_upcera: data.is_upcera === true || Number(data.is_upcera) === 1,
          category: getVisibleCategoryLabel(data.category_names || data.category_name || '', fixedSegmentNames),
          categoryIds: normalizeCategoryIds(data.category_ids),
          description: data.description,
          image: data.main_image ? apiAssetPath(data.main_image) : '',
          product_tabs: Array.isArray(data.product_tabs) ? data.product_tabs : [],
          ...extra,
          productBannerUrl: extra.productBannerUrl ? apiAssetPath(extra.productBannerUrl) : '',
          images: Array.isArray(extra.images) ? extra.images.map((image) => apiAssetPath(image)).filter(Boolean) : extra.images,
          modelTable: finalTable,
          modelTables: normalizeTechnicalTables(extra.modelTables, extra.modelTitle, finalTable)
        };

        setProduct(formattedProduct);
        trackProductView(formattedProduct);
        setActiveImage(formattedProduct.image || (Array.isArray(formattedProduct.images) ? formattedProduct.images[0] : '') || '');
        setIsFeaturesCollapsed(true);
        setActiveTab('description');
        setAllProducts(others.map((currentProduct) => ({
          id: currentProduct.id,
          name: currentProduct.name,
          category_names: currentProduct.category_names || currentProduct.category_name || '',
          is_upcera: currentProduct.is_upcera === true || Number(currentProduct.is_upcera) === 1,
          category: getVisibleCategoryLabel(
            currentProduct.category_names || currentProduct.category_name || '',
            fixedSegmentNames
          ),
          categoryIds: normalizeCategoryIds(currentProduct.category_ids),
          image: currentProduct.main_image
            ? apiAssetPath(currentProduct.main_image)
            : '',
          images: []
        })));
      } catch (err) {
        console.error('Erro ao carregar detalhes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
    window.scrollTo(0, 0);
  }, [id, navigate]);

  const handleNextImage = () => {
    if (galleryImages.length === 0) return;
    const currentIndex = galleryImages.indexOf(activeImage);
    const nextIndex = (currentIndex + 1) % galleryImages.length;
    setActiveImage(galleryImages[nextIndex]);
  };

  const handlePrevImage = () => {
    if (galleryImages.length === 0) return;
    const currentIndex = galleryImages.indexOf(activeImage);
    const prevIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
    setActiveImage(galleryImages[prevIndex]);
  };

  const relatedProducts = useMemo(() => {
    if (!product) return [];

    const currentCategoryIds = normalizeCategoryIds(product.categoryIds);

    const matchingProducts = allProducts
      .filter((currentProduct) => {
        if (currentProduct.id === product.id) {
          return false;
        }

        const relatedCategoryIds = normalizeCategoryIds(currentProduct.categoryIds);

        if (currentCategoryIds.length > 0 && relatedCategoryIds.length > 0) {
          return relatedCategoryIds.some((categoryId) => currentCategoryIds.includes(categoryId));
        }

        return currentProduct.category === product.category;
      });
    
    return shuffleProducts(matchingProducts).slice(0, 6);
  }, [product, allProducts]);

  const technicalTables = useMemo(() => {
    if (!product) {
      return [];
    }

    return normalizeTechnicalTables(product.modelTables, product.modelTitle, product.modelTable);
  }, [product]);

  const dynamicSections = useMemo(
    () => normalizeDynamicSections(product?.product_tabs, product?.dynamicSections),
    [product]
  );
  const galleryImages = useMemo(() => (
    Array.from(new Set([
      product?.image,
      ...(Array.isArray(product?.images) ? product.images : [])
    ].filter(Boolean)))
  ), [product?.image, product?.images]);

  const descriptionTabLabel = useMemo(
    () => {
      const rawLabel = product?.descriptionTabLabel?.trim() || '';

      if (!rawLabel) {
        return '';
      }

      if (dynamicSections.length === 0 && isLegacyDefaultDescriptionTabLabel(rawLabel)) {
        return '';
      }

      return rawLabel;
    },
    [dynamicSections.length, product?.descriptionTabLabel]
  );

  const technicalTabLabel = useMemo(() => {
    const rawLabel = product?.technicalTabLabel?.trim() || '';

    if (!rawLabel) {
      return '';
    }

    if (isLegacyDefaultTechnicalTabLabel(rawLabel)) {
      return '';
    }

    return rawLabel;
  }, [product?.technicalTabLabel]);

  const shouldUseCustomTabs = dynamicSections.length > 0;

  const hasTechnicalContent = useMemo(() => (
    Boolean(
      (Array.isArray(product?.techSpecs) && product.techSpecs.length > 0)
      || (technicalTables.length > 0 && product?.showModelSection !== false)
    )
  ), [product, technicalTables]);

  const availableTabs = useMemo(() => {
    const tabs = [];

    if (!shouldUseCustomTabs && descriptionTabLabel && product?.description?.trim()) {
      tabs.push({
        id: 'description',
        label: descriptionTabLabel
      });
    }

    dynamicSections.forEach((section) => {
      tabs.push({ id: section.id, label: section.title });
    });

    if (hasTechnicalContent) {
      tabs.push({
        id: 'specs',
        label: technicalTabLabel || 'Informacoes Tecnicas'
      });
    }

    return tabs;
  }, [descriptionTabLabel, dynamicSections, hasTechnicalContent, product?.description, shouldUseCustomTabs, technicalTabLabel]);

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(availableTabs[0]?.id || 'description');
    }
  }, [activeTab, availableTabs]);

  if (loading) return <div className="detail-loader">Carregando...</div>;
  if (!product) return null;

  const whatsappMessage = encodeURIComponent(`Ola! Gostaria de mais informacoes sobre o produto: ${product.name}`);
  const whatsappUrl = `https://wa.me/554130123456?text=${whatsappMessage}`;
  const handleQuoteClick = (source) => {
    trackQuoteClick(product, source);
    trackWhatsappClick(source);
  };
  const descriptionLines = String(product.description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const shouldShowDescriptionAsTopics = product.descriptionAsList || descriptionLines.length > 1;
  const hasDescriptionContent = Boolean(String(product.description || '').trim());
  const productFeatures = Array.isArray(product.features)
    ? product.features.map((feature) => String(feature || '').trim()).filter(Boolean)
    : [];
  const hasFeatureContent = productFeatures.length > 0;
  const productName = String(product.name || '').trim();
  const heroNameParts = productName.match(/^([A-Za-zÀ-ÿ]+)\s+(.+)$/);
  const shouldSplitHeroName = Boolean(heroNameParts && /[\d-]/.test(heroNameParts[2]));
  const heroOverline = shouldSplitHeroName ? heroNameParts[1] : product.category;
  const heroTitle = shouldSplitHeroName ? heroNameParts[2] : productName;
  const renderMergedRowCells = (values, mergeRanges, rowIndex, cellTag = 'td') => {
    const CellTag = cellTag;

    return values.map((cell, cellIndex) => {
      const mergeRange = getMergeRangeForCell(mergeRanges, rowIndex, cellIndex);

      if (mergeRange && (mergeRange.startCol !== cellIndex || mergeRange.startRow !== rowIndex)) {
        return null;
      }

      const colSpan = mergeRange ? (mergeRange.endCol - mergeRange.startCol + 1) : 1;
      const rowSpan = mergeRange ? (mergeRange.endRow - mergeRange.startRow + 1) : 1;

      return (
        <CellTag key={`${rowIndex}-${cellIndex}`} colSpan={colSpan} rowSpan={rowSpan}>
          {cell}
        </CellTag>
      );
    });
  };

  return (
    <div className="product-detail-container">
      <div className="container-inner">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={`product-hero-banner${product.productBannerUrl ? ' has-custom-banner' : ''}`}
          style={product.productBannerUrl ? { '--product-banner-image': `url("${product.productBannerUrl}")` } : undefined}
        >
          <div className={`product-hero-media${activeImage ? '' : ' is-empty'}`}>
            {activeImage && <img src={activeImage} alt={product.name} />}
            {galleryImages.length > 1 && (
              <>
                <button className="img-nav-btn prev" onClick={handlePrevImage} aria-label="Imagem anterior"><ChevronLeft size={24} /></button>
                <button className="img-nav-btn next" onClick={handleNextImage} aria-label="Proxima imagem"><ChevronRight size={24} /></button>
              </>
            )}
          </div>

          <div className="product-hero-copy">
            {heroOverline && <span className="product-hero-overline">{heroOverline}</span>}
            <h1>{heroTitle}</h1>
            {product.is_upcera && <span className="product-hero-brand">UPCERA</span>}

            {shouldShowQuoteButton(product.showQuoteButton) && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp-quote"
                onClick={() => handleQuoteClick('product_hero')}
              >
                <MessageCircle size={20} /> Solicitar Orçamento
              </a>
            )}
          </div>

          {galleryImages.length > 1 && (
            <div className="product-hero-dots" aria-label="Imagens do produto">
              {galleryImages.map((img, idx) => (
                <button
                  key={img}
                  type="button"
                  className={`product-hero-dot ${activeImage === img ? 'is-active' : ''}`}
                  onClick={() => setActiveImage(img)}
                  aria-label={`Mostrar imagem ${idx + 1}`}
                  aria-pressed={activeImage === img}
                />
              ))}
            </div>
          )}
        </motion.section>

        {(hasDescriptionContent || hasFeatureContent) && (
          <section className="product-description-panel" aria-label="Descricao do produto">
            {hasDescriptionContent && (
              shouldShowDescriptionAsTopics ? (
                <ul className="product-description-list">
                  {descriptionLines.map((line, idx) => (
                    <li key={`description-${idx}`}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="product-description-text">{product.description}</p>
              )
            )}

            {hasFeatureContent && (
              <ul className="product-description-list product-feature-list">
                {productFeatures.map((feature, idx) => (
                  <li key={`feature-${idx}`}>{feature}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="product-detail-grid">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="product-images-section"
          >
            <div className={`main-image-card${activeImage ? '' : ' is-empty'}`}>
              {activeImage && <img src={activeImage} alt={product.name} />}
              {galleryImages.length > 1 && (
                <>
                  <button className="img-nav-btn prev" onClick={handlePrevImage}><ChevronLeft size={24} /></button>
                  <button className="img-nav-btn next" onClick={handleNextImage}><ChevronRight size={24} /></button>
                </>
              )}
            </div>
            {galleryImages.length > 1 && (
              <div className="thumbnail-grid">
                {galleryImages.map((img, idx) => (
                  <div
                    key={idx}
                    className={`thumb-item ${activeImage === img ? 'active' : ''}`}
                    onClick={() => setActiveImage(img)}
                  >
                    <img src={img} alt={`${product.name} ${idx}`} />
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="product-info-section"
          >
            <span className="product-category-tag">{product.category}</span>
            <h1 className="product-title">{product.name}</h1>
            <div className="product-description">
              {product.descriptionAsList ? (
                <ul className="description-list">
                  {product.description.split('\n').filter((line) => line.trim() !== '').map((line, idx) => (
                    <li key={idx}><CheckCircle2 size={16} className="text-primary" /> {line}</li>
                  ))}
                </ul>
              ) : (
                product.description
              )}
            </div>

            {product.features && product.features.length > 0 && (
              <div className="product-features">
                <button
                  type="button"
                  className="product-features__toggle"
                  onClick={() => setIsFeaturesCollapsed((current) => !current)}
                  aria-expanded={!isFeaturesCollapsed}
                >
                  <span className="product-features__title">
                    <Info size={18} /> Caracteristicas Principais
                  </span>
                  <span className="product-features__action">
                    {isFeaturesCollapsed ? 'Expandir' : 'Recolher'}
                    <ChevronRight
                      size={18}
                      className={`product-features__chevron ${isFeaturesCollapsed ? 'is-collapsed' : ''}`}
                    />
                  </span>
                </button>
                {!isFeaturesCollapsed && (
                  <ul>
                    {product.features.map((feature, idx) => (
                      <li key={idx}><CheckCircle2 size={16} className="text-primary" /><span>{feature}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {shouldShowQuoteButton(product.showQuoteButton) && (
              <div className="product-actions">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp-quote"
                  onClick={() => handleQuoteClick('product_actions')}
                >
                  <MessageCircle size={20} /> Solicitar Orçamento
                </a>
              </div>
            )}
          </motion.div>
        </div>

        {availableTabs.length > 0 && (
          <div className="product-tabs-section">
            <div className="tabs-header">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  <ChevronRight size={28} strokeWidth={1.7} />
                </button>
              ))}
            </div>

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="tab-content"
            >
              {!shouldUseCustomTabs && activeTab === 'description' && (
                <div className="detailed-description-content">
                  {renderSectionContent(product.description, product.descriptionAsList)}
                </div>
              )}

              {dynamicSections.map((section) => (
                activeTab === section.id && (
                  <div key={section.id} className="detailed-description-content">
                    {(() => {
                      const embedUrl = getVideoEmbedUrl(section.videoUrl);
                      const shouldShowContent = section.content?.trim()
                        && (!embedUrl || section.showContentWithVideo !== false);

                      return (
                        <>
                          {shouldShowContent && renderSectionContent(section.content, section.contentAsList)}
                          {embedUrl && (
                            <div className="tab-video-embed">
                              <iframe
                                src={embedUrl}
                                title={section.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )
              ))}

              {activeTab === 'specs' && (
                <div className="specs-content">
                  {product.techSpecs && product.techSpecs.length > 0 && (
                    <div className="tech-specs-grid">
                      {product.techSpecs.map((spec, idx) => (
                        <div key={idx} className="spec-item">
                          <span className="spec-label">{spec.label}</span>
                          <span className="spec-value">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {product.showModelSection !== false && technicalTables.map((tableConfig, tableIndex) => (
                    <div key={`technical-table-${tableIndex}`} className="models-table-wrapper">
                      <div className="section-title-group">
                        <Package size={24} className="text-primary" />
                        <h2>{tableConfig.title || `Modelos / Codigos ${technicalTables.length > 1 ? tableIndex + 1 : ''}`.trim()}</h2>
                      </div>

                      <div className="table-container">
                        <table className="models-table">
                          <thead>
                            <tr>
                              {renderMergedRowCells(
                                tableConfig.modelTable.headers,
                                tableConfig.modelTable.mergeRanges,
                                0,
                                'th'
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {tableConfig.modelTable.rows.map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {renderMergedRowCells(
                                  row,
                                  tableConfig.modelTable.mergeRanges,
                                  rowIndex + 1
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {relatedProducts.length > 0 && (
          <div className="related-products-section">
            <div className="section-header">
              <h2><Sparkles size={24} className="text-primary" /> Produtos Relacionados</h2>
              <p>Confira outras soluções da categoria <strong>{product.category}</strong></p>
            </div>

            <div className="related-products-carousel">
              <button
                type="button"
                className="related-products__nav related-products__nav-prev"
                aria-label="Produto relacionado anterior"
              />
              <button
                type="button"
                className="related-products__nav related-products__nav-next"
                aria-label="Próximo produto relacionado"
              />

              <Swiper
                modules={[Autoplay, Navigation]}
                spaceBetween={24}
                slidesPerView={1}
                loop={relatedProducts.length > 1}
                navigation={{
                  prevEl: '.related-products__nav-prev',
                  nextEl: '.related-products__nav-next'
                }}
                autoplay={{ delay: 3500, disableOnInteraction: false }}
                breakpoints={{
                  640: { slidesPerView: 2 },
                  1024: { slidesPerView: 3 },
                  1400: { slidesPerView: 4 }
                }}
              >
                {relatedProducts.map((related, index) => (
                  <SwiperSlide key={related.id}>
                    <ProductCard product={related} index={index} />
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
