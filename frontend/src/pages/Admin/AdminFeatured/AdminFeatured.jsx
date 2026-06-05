import React from 'react';
import { useAdmin } from '../../../context/useAdmin';
import SpecialSectionManager from '../AdminSpecialSection/SpecialSectionManager';
import '../AdminProducts/AdminProducts.css';
import '../AdminSpecialSection/SpecialSectionManager.css';

const AdminFeatured = () => {
  const { products, mainCategories, subCategories, productsHook, addToast } = useAdmin();

  const handleSave = async (selectedProducts) => {
    const result = await productsHook.updateSpecialSection('featured', selectedProducts);
    if (result.success) {
      addToast('Produtos em destaque atualizados com sucesso!');
    } else {
      addToast(result.error, 'error');
    }
  };

  return (
    <SpecialSectionManager
      sectionTitle="Produtos em Destaque da Home"
      sectionKey="featured"
      products={products}
      mainCategories={mainCategories}
      subCategories={subCategories}
      supportsDisplayMode={false}
      onSave={handleSave}
    />
  );
};

export default AdminFeatured;
