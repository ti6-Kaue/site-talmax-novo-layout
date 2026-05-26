import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import customPageService from '../../services/customPageService';
import CustomPageHeroLeft from './layouts/CustomPageHeroLeft';
import CustomPageHeroCentered from './layouts/CustomPageHeroCentered';
import CustomPageHeroSplit from './layouts/CustomPageHeroSplit';
import './CustomPage.css';

const CustomPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPage = async () => {
      setIsLoading(true);

      try {
        const data = await customPageService.getPublicBySlug(slug);
        setPage(data);
        setError('');
      } catch (loadError) {
        setError(loadError.message || 'Página não encontrada');
      } finally {
        setIsLoading(false);
      }
    };

    loadPage();
  }, [slug]);

  if (isLoading) {
    return <div className="custom-page__state custom-page__state--loading">Carregando página...</div>;
  }

  if (error || !page) {
    return <div className="custom-page__state">{error || 'Página não encontrada.'}</div>;
  }

  if (page.layout_type === 'hero-left') {
    return <CustomPageHeroLeft page={page} navigate={navigate} />;
  }

  if (page.layout_type === 'hero-centered') {
    return <CustomPageHeroCentered page={page} navigate={navigate} />;
  }

  return <CustomPageHeroSplit page={page} navigate={navigate} />;
};

export default CustomPage;
