/**
 * Pagina: Home
 * Rota: /
 * Responsabilidade: montar a pagina inicial e carregar categorias visiveis
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import HeroSlider from '../HeroSlider/HeroSlider';
import API_URL from '../../services/api';
import homeContentBlockService from '../../services/homeContentBlockService';
import { apiAssetPath } from '../../utils/assets';
import { parseSafeExtraData } from '../../utils/contentSafety';
import useDeferredSection from '../../hooks/useDeferredSection';
import '../ProductCatalog/ProductCatalog.css';
import './Home.css';

const HomeServicesSection = lazy(() => import('./sections/HomeServicesSection'));
const HomeFeaturedProductsSection = lazy(() => import('./sections/HomeFeaturedProductsSection'));
const HomeCategoriesSection = lazy(() => import('./sections/HomeCategoriesSection'));

const HomeSectionPlaceholder = ({ variant = 'default' }) => (
  <div
    className={`home-section-placeholder home-section-placeholder--${variant}`}
    aria-hidden="true"
  >
    <span className="home-section-placeholder__shine" />
  </div>
);

const Home = () => {
  const [categories, setCategories] = useState(null);
  const [featuredProducts, setFeaturedProducts] = useState(null);
  const [services, setServices] = useState(null);
  const [homeContentBlocks, setHomeContentBlocks] = useState([]);
  const { sectionRef: servicesRef, shouldLoad: shouldLoadServices } = useDeferredSection({ rootMargin: '200px 0px' });
  const { sectionRef: featuredRef, shouldLoad: shouldLoadFeatured } = useDeferredSection({ rootMargin: '320px 0px' });
  const { sectionRef: categoriesRef, shouldLoad: shouldLoadCategories } = useDeferredSection({ rootMargin: '320px 0px' });

  useEffect(() => {
    if (!shouldLoadServices) {
      return undefined;
    }

    const controller = new AbortController();

    const fetchHomeServices = async () => {
      try {
        const response = await fetch(`${API_URL}/home-services`, { signal: controller.signal });

        if (!response.ok) {
          throw new Error('Falha ao carregar serviços da home');
        }

        const data = await response.json();
        setServices(data.filter((service) => service.active));
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }

        console.error('Erro ao carregar serviços da home:', err);
        setServices([]);
      }
    };

    fetchHomeServices();

    return () => controller.abort();
  }, [shouldLoadServices]);

  useEffect(() => {
    if (!shouldLoadFeatured) {
      return undefined;
    }

    const controller = new AbortController();

    const fetchFeaturedProducts = async () => {
      try {
        const productsResponse = await fetch(`${API_URL}/featured-products`, { signal: controller.signal });

        if (!productsResponse.ok) {
          throw new Error('Falha ao carregar produtos em destaque');
        }

        const productsData = await productsResponse.json();

        const mappedFeaturedProducts = productsData
          .filter((product) => product.is_featured)
          .map((product) => {
            const extra = parseSafeExtraData(product.extra_data);

            return {
              ...product,
              featuredOrder: Number(extra.featured_order || 0),
              image: product.main_image ? apiAssetPath(product.main_image) : '',
              images: Array.isArray(extra.images) ? extra.images.map((image) => apiAssetPath(image)) : []
            };
          })
          .sort((a, b) => {
            if (a.featuredOrder !== b.featuredOrder) {
              return a.featuredOrder - b.featuredOrder;
            }

            return a.name.localeCompare(b.name, 'pt-BR');
          });

        setFeaturedProducts(mappedFeaturedProducts);
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }

        console.error('Erro ao carregar produtos em destaque na Home:', err);
        setFeaturedProducts([]);
      }
    };

    fetchFeaturedProducts();

    return () => controller.abort();
  }, [shouldLoadFeatured]);

  useEffect(() => {
    if (!shouldLoadCategories) {
      return undefined;
    }

    const controller = new AbortController();

    const fetchCategories = async () => {
      try {
        const [categoriesResponse, contentBlocks] = await Promise.all([
          fetch(`${API_URL}/categories`, { signal: controller.signal }),
          homeContentBlockService.getAll().catch((contentError) => {
            console.error('Erro ao carregar blocos editaveis da Home:', contentError);
            return [];
          })
        ]);

        if (!categoriesResponse.ok) {
          throw new Error('Falha ao carregar categorias');
        }

        const categoriesData = await categoriesResponse.json();

        const visibleMainCategories = categoriesData.filter((cat) =>
          !cat.parent_id &&
          (cat.is_visible === 1 || cat.is_visible === true || cat.is_visible === '1')
        );

        setCategories(visibleMainCategories);
        setHomeContentBlocks(Array.isArray(contentBlocks) ? contentBlocks : []);
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }

        console.error('Erro ao carregar categorias na Home:', err);
        setCategories([]);
        setHomeContentBlocks([]);
      }
    };

    fetchCategories();

    return () => controller.abort();
  }, [shouldLoadCategories]);

  return (
    <>
      <HeroSlider />

      <div ref={servicesRef}>
        {shouldLoadServices && services !== null ? (
          <Suspense fallback={<HomeSectionPlaceholder variant="services" />}>
            <HomeServicesSection services={services} />
          </Suspense>
        ) : (
          <HomeSectionPlaceholder variant="services" />
        )}
      </div>

      <div className="home-section-divider home-section-divider--before-featured" aria-hidden="true" />

      <div ref={featuredRef}>
        {shouldLoadFeatured && featuredProducts !== null ? (
          <Suspense fallback={<HomeSectionPlaceholder variant="featured" />}>
            <HomeFeaturedProductsSection featuredProducts={featuredProducts} />
          </Suspense>
        ) : (
          <HomeSectionPlaceholder variant="featured" />
        )}
      </div>

      <div className="home-section-divider home-section-divider--before-categories" aria-hidden="true" />

      <div ref={categoriesRef}>
        {shouldLoadCategories && categories !== null ? (
          <Suspense fallback={<HomeSectionPlaceholder variant="categories" />}>
            <HomeCategoriesSection
              categories={categories}
              promoCards={homeContentBlocks.filter((block) => block.section_type === 'info-card')}
            />
          </Suspense>
        ) : (
          <HomeSectionPlaceholder variant="categories" />
        )}
      </div>
    </>
  );
};

export default Home;
