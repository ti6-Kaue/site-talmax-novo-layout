import { useState, useEffect, useCallback } from 'react';
import { productService } from '../services/productService';
import { parseSafeExtraData } from '../utils/contentSafety';

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async (options = {}) => {
    const { silent = false } = options;

    if (!silent) {
      setLoading(true);
    }

    try {
      const data = await productService.getAll();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const createProduct = async (formData) => {
    try {
      await productService.create(formData);
      await fetchProducts({ silent: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateProduct = async (id, formData) => {
    try {
      await productService.update(id, formData);
      await fetchProducts({ silent: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteProduct = async (id) => {
    try {
      await productService.delete(id);
      await fetchProducts();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateProductActiveStatus = async (id, isActive) => {
    const previousProducts = products;
    setProducts((currentProducts) => currentProducts.map((product) => (
      product.id === id ? { ...product, is_active: isActive } : product
    )));

    try {
      await productService.updateActiveStatus(id, isActive);
      return { success: true };
    } catch (err) {
      setProducts(previousProducts);
      return { success: false, error: err.message };
    }
  };

  const updateProductQuoteButtonStatus = async (id, showQuoteButton) => {
    const previousProducts = products;
    setProducts((currentProducts) => currentProducts.map((product) => {
      if (product.id !== id) return product;

      const extra = parseSafeExtraData(product.extra_data);

      return {
        ...product,
        extra_data: {
          ...extra,
          showQuoteButton
        }
      };
    }));

    try {
      await productService.updateQuoteButtonStatus(id, showQuoteButton);
      return { success: true };
    } catch (err) {
      setProducts(previousProducts);
      return { success: false, error: err.message };
    }
  };

  const updateSpecialSection = async (section, selectedProducts) => {
    try {
      if (section === 'featured') await productService.updateFeatured(selectedProducts);
      
      await fetchProducts();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    products,
    loading,
    error,
    refresh: fetchProducts,
    createProduct,
    updateProduct,
    updateProductActiveStatus,
    updateProductQuoteButtonStatus,
    deleteProduct,
    updateSpecialSection
  };
};
