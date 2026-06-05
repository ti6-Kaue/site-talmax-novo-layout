/**
 * Contexto global do painel administrativo.
 *
 * Ideia principal:
 * em vez de cada tela do admin buscar produtos, categorias e banners por conta propria,
 * este contexto centraliza esses dados e entrega tudo pronto para os componentes filhos.
 *
 * Exemplo de uso:
 * - AdminProducts
 * - AdminCategories
 * - AdminBanners
 *
 * Todos eles podem consumir `useAdmin()` para acessar dados, loading, erros e funcoes auxiliares.
 */
import React, { useEffect, useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useBanners } from '../hooks/useBanners';
import { validateAdminSession } from '../services/adminAuth';
import AdminContext from './AdminContextValue';

export const AdminProvider = ({ children }) => {
  // Cada hook encapsula a logica de uma area do painel.
  // Aqui apenas juntamos tudo em um unico lugar.
  const productsHook = useProducts();
  const categoriesHook = useCategories();
  const bannersHook = useBanners();
  const [sessionUser, setSessionUser] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);

  // Toasts sao avisos temporarios exibidos na interface, como:
  // "Produto salvo com sucesso" ou "Erro ao excluir banner".
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadSessionUser = async () => {
      try {
        const result = await validateAdminSession();

        if (!isMounted) {
          return;
        }

        setSessionUser(result.authenticated ? result.user || null : null);
      } catch {
        if (isMounted) {
          setSessionUser(null);
        }
      } finally {
        if (isMounted) {
          setIsSessionLoading(false);
        }
      }
    };

    loadSessionUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const addToast = (message, type = 'success') => {
    const id = Date.now();

    // Adiciona o novo aviso na lista.
    setToasts(prev => [...prev, { id, message, type }]);

    // Remove automaticamente apos 3 segundos.
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const isLoadingAdminData = isSessionLoading || productsHook.loading || categoriesHook.loading || bannersHook.loading;

  useEffect(() => {
    if (!isLoadingAdminData) {
      setHasCompletedInitialLoad(true);
    }
  }, [isLoadingAdminData]);

  // Este objeto e o "pacote" que o contexto entrega para quem usar `useAdmin()`.
  //
  // Ele contem:
  // - listas principais do painel
  // - estado geral de carregamento e erro
  // - hooks completos para operacoes especificas
  // - funcoes utilitarias como refreshAll e addToast
  const value = {
    // Dados prontos para uso nas telas.
    products: productsHook.products,
    categories: categoriesHook.categories,
    mainCategories: categoriesHook.mainCategories,
    subCategories: categoriesHook.subCategories,
    banners: bannersHook.banners,
    sessionUser,
    isMasterAdmin: sessionUser?.role === 'master',

    // Mostra a tela cheia somente na primeira carga do painel.
    loading: !hasCompletedInitialLoad && isLoadingAdminData,

    // O mesmo raciocinio vale para erro:
    // se qualquer hook falhar, o contexto expoe esse erro para a interface.
    error: productsHook.error || categoriesHook.error || bannersHook.error,

    // Recarrega manualmente todas as areas do painel.
    refreshAll: () => {
      productsHook.refresh();
      categoriesHook.refresh();
      bannersHook.refresh();
    },
    refreshSessionUser: async () => {
      const result = await validateAdminSession();
      setSessionUser(result.authenticated ? result.user || null : null);
      return result.user || null;
    },

    // Hooks completos expostos para as telas que precisam chamar create/update/delete.
    productsHook,
    categoriesHook,
    bannersHook,

    // Sistema de feedback visual.
    toasts,
    addToast
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};
