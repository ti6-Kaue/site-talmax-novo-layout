/**
 * Pagina: AdminDashboard
 * Rota: /admin/painel
 * Responsabilidade: servir como estrutura principal do painel administrativo
 * e alternar entre as secoes internas como dashboard, produtos, categorias e banners
 * container principal do painel administrativo.
 */
import React, { Suspense, lazy, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Image as ImageIcon,
  LayoutDashboard,
  Layers,
  LogOut,
  CheckCircle,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Menu,
  UserCog,
  Wrench,
  Megaphone,
  Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminProvider } from '../../context/AdminContext';
import { useAdmin } from '../../context/useAdmin';
import { logoutAdmin } from '../../services/adminAuth';
import AdminDashboardHome from './AdminDashboardHome/AdminDashboardHome';
import './AdminBase.css';

const AdminProducts = lazy(() => import('./AdminProducts/AdminProducts'));
const AdminProductsList = lazy(() => import('./AdminProducts/AdminProductsList'));
const AdminCategories = lazy(() => import('./AdminCategories/AdminCategories'));
const AdminCategoryPages = lazy(() => import('./AdminCategoryPages/AdminCategoryPages'));
const AdminBanners = lazy(() => import('./AdminBanners/AdminBanners'));
const AdminFeatured = lazy(() => import('./AdminFeatured/AdminFeatured'));
const AdminUpcera = lazy(() => import('./AdminUpcera/AdminUpcera'));
const AdminScanners = lazy(() => import('./AdminScanners/AdminScanners'));
const AdminPrinters = lazy(() => import('./AdminPrinters/AdminPrinters'));
const AdminSegments = lazy(() => import('./AdminSegments/AdminSegments'));
const AdminHomeContent = lazy(() => import('./AdminHomeContent/AdminHomeContent'));
const AdminTalmaxDigital = lazy(() => import('./AdminTalmaxDigital/AdminTalmaxDigital'));
const AdminDigitalGroups = lazy(() => import('./AdminTalmaxDigital/AdminDigitalGroups'));
const AdminCustomPages = lazy(() => import('./AdminCustomPages/AdminCustomPages'));
const AdminUsers = lazy(() => import('./AdminUsers/AdminUsers'));
const AdminTechnicalAssistance = lazy(() => import('./AdminTechnicalAssistance/AdminTechnicalAssistance'));
const AdminSupport = lazy(() => import('./AdminSupport/AdminSupport'));

const AdminLoadingScreen = ({ label = 'Carregando painel...' }) => (
  <div className="app-loader-overlay app-loader-overlay-admin" role="status" aria-live="polite" aria-label={label}>
    <div className="app-loader-shell">
      <div className="loader loader_bubble" aria-hidden="true" />
      <span className="app-loader-text">{label}</span>
    </div>
  </div>
);

const AdminSectionLoader = ({ children, label = 'Carregando secao...' }) => (
  <Suspense fallback={<AdminLoadingScreen label={label} />}>
    {children}
  </Suspense>
);

const withAdminSectionLoader = (element, label) => (
  <AdminSectionLoader label={label}>
    {element}
  </AdminSectionLoader>
);

const AdminDashboardContent = () => {
  const navigate = useNavigate();
  const {
    loading,
    activeTab,
    setActiveTab,
    productToEdit,
    setProductToEdit,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isCatalogOpen,
    setIsCatalogOpen,
    isHomeOpen,
    setIsHomeOpen,
    isEditPagesOpen,
    setIsEditPagesOpen,
    isPagesOpen,
    setIsPagesOpen,
    toasts,
    sessionUser,
    isMasterAdmin
  } = useAdminState();

  if (loading) {
    return <AdminLoadingScreen label="Carregando dados do painel..." />;
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'support', label: 'Suporte', icon: <Headphones size={20} /> },
    { id: 'technical-assistance', label: 'Assistencia Tecnica', icon: <Wrench size={20} /> },
    ...(isMasterAdmin ? [{ id: 'users', label: 'Usuarios Admin', icon: <UserCog size={20} /> }] : [])
  ];
  const catalogItems = [
    { id: 'products', label: 'Cadastro de Produtos', icon: <Package size={18} /> },
    { id: 'products-list', label: 'Lista de Produtos', icon: <Search size={18} /> },
    { id: 'category-pages', label: 'Pagina de Categoria', icon: <ImageIcon size={18} /> },
  ];
  const homeItems = [
    { id: 'banners', label: 'Banners', icon: <ImageIcon size={18} /> },
    { id: 'segments', label: 'Home Segmentos', icon: <Layers size={18} /> },
    { id: 'featured', label: 'Home Destaques', icon: <CheckCircle size={18} /> },
    { id: 'categories', label: 'Categorias', icon: <Layers size={18} /> },
    { id: 'home-content', label: 'Cards e Propagandas', icon: <Megaphone size={18} /> }
  ];
  const editPageItems = [
    
    { id: 'custom-pages', label: 'Paginas Personalizadas', icon: <LayoutDashboard size={18} /> },
    { id: 'digital-groups', label: 'Grupo de Segmentos', icon: <Layers size={18} /> },
  ];
  const pageItems = [
    { id: 'talmax-digital', label: 'Talmax Digital', icon: <ImageIcon size={18} /> },
    { id: 'upcera', label: 'Upcera', icon: <CheckCircle size={18} /> },
    { id: 'scanners', label: 'Scanners', icon: <Search size={18} /> },
    { id: 'printers', label: 'Impressoras 3D', icon: <ImageIcon size={18} /> }
  ];
  const activeItem = [...menuItems, ...catalogItems, ...homeItems, ...editPageItems, ...pageItems].find((item) => item.id === activeTab);
  const isHomeSectionActive = homeItems.some((item) => item.id === activeTab);
  const isEditPagesSectionActive = editPageItems.some((item) => item.id === activeTab);
  const isPagesSectionActive = pageItems.some((item) => item.id === activeTab);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboardHome onOpenTab={setActiveTab} />;
      case 'products':
        return withAdminSectionLoader(
          <AdminProducts
            productToEdit={productToEdit}
            onProductEditHandled={() => setProductToEdit(null)}
          />,
          'Carregando cadastro de produtos...'
        );
      case 'products-list':
        return withAdminSectionLoader(
          <AdminProductsList
            onOpenRegister={() => {
              setProductToEdit(null);
              setActiveTab('products');
            }}
            onEditProduct={(product) => {
              setProductToEdit(product);
              setActiveTab('products');
            }}
          />,
          'Carregando lista de produtos...'
        );
      case 'categories':
        return withAdminSectionLoader(<AdminCategories />, 'Carregando categorias...');
      case 'users':
        return withAdminSectionLoader(<AdminUsers />, 'Carregando usuarios do painel...');
      case 'banners':
        return withAdminSectionLoader(<AdminBanners />, 'Carregando banners...');
      case 'featured':
        return withAdminSectionLoader(<AdminFeatured />, 'Carregando destaques da home...');
      case 'home-content':
        return withAdminSectionLoader(<AdminHomeContent />, 'Carregando conteudos da home...');
      case 'segments':
        return withAdminSectionLoader(<AdminSegments />, 'Carregando segmentos...');
      case 'custom-pages':
        return withAdminSectionLoader(<AdminCustomPages />, 'Carregando paginas personalizadas...');
      case 'category-pages':
        return withAdminSectionLoader(<AdminCategoryPages />, 'Carregando paginas de categoria...');
      case 'talmax-digital':
        return withAdminSectionLoader(<AdminTalmaxDigital />, 'Carregando pagina Talmax Digital...');
      case 'digital-groups':
        return withAdminSectionLoader(<AdminDigitalGroups />, 'Carregando grupos de segmentos...');
      case 'upcera':
        return withAdminSectionLoader(<AdminUpcera />, 'Carregando pagina Upcera...');
      case 'scanners':
        return withAdminSectionLoader(<AdminScanners />, 'Carregando pagina Scanners...');
      case 'printers':
        return withAdminSectionLoader(<AdminPrinters />, 'Carregando pagina Impressoras 3D...');
      case 'technical-assistance':
        return withAdminSectionLoader(<AdminTechnicalAssistance />, 'Carregando assistencia tecnica...');
      case 'support':
        return withAdminSectionLoader(<AdminSupport />, 'Carregando suporte...');
      default:
        return <AdminDashboardHome onOpenTab={setActiveTab} />;
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className={`admin-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo-text">
            {!isSidebarCollapsed && <span className="brand">TALMAX ADMIN</span>}
          </div>
          <button className="btn-toggle-sidebar" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
            >
              {item.icon}
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </div>
          ))}

          <div className={`nav-dropdown ${isHomeOpen ? 'open' : ''}`}>
            <div
              className={`nav-link ${isHomeSectionActive ? 'active' : ''}`}
              onClick={() => {
                if (isSidebarCollapsed) {
                  setIsSidebarCollapsed(false);
                  setIsHomeOpen(true);
                } else {
                  setIsHomeOpen(!isHomeOpen);
                }
              }}
            >
              <ImageIcon size={20} />
              {!isSidebarCollapsed && <span>Pagina Home</span>}
              {!isSidebarCollapsed && <ChevronRight size={16} className="dropdown-arrow" />}
            </div>

            {!isSidebarCollapsed && (
              <div className="dropdown-content">
                {homeItems.map((item) => (
                  <div
                    key={item.id}
                    className={`nav-link sub-link ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsHomeOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <div className="dot" />
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`nav-dropdown ${isCatalogOpen ? 'open' : ''}`}>
            <div
              className={`nav-link ${catalogItems.some((item) => item.id === activeTab) ? 'active' : ''}`}
              onClick={() => {
                if (isSidebarCollapsed) {
                  setIsSidebarCollapsed(false);
                  setIsCatalogOpen(true);
                } else {
                  setIsCatalogOpen(!isCatalogOpen);
                }
              }}
            >
              <Package size={20} />
              {!isSidebarCollapsed && <span>Catalogo</span>}
              {!isSidebarCollapsed && <ChevronRight size={16} className="dropdown-arrow" />}
            </div>

            {!isSidebarCollapsed && (
              <div className="dropdown-content">
                {catalogItems.map((item) => (
                  <div
                    key={item.id}
                    className={`nav-link sub-link ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsCatalogOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <div className="dot" />
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`nav-dropdown ${isEditPagesOpen ? 'open' : ''}`}>
            <div
              className={`nav-link ${isEditPagesSectionActive ? 'active' : ''}`}
              onClick={() => {
                if (isSidebarCollapsed) {
                  setIsSidebarCollapsed(false);
                  setIsEditPagesOpen(true);
                } else {
                  setIsEditPagesOpen(!isEditPagesOpen);
                }
              }}
            >
              <LayoutDashboard size={20} />
              {!isSidebarCollapsed && <span>Edit de Paginas</span>}
              {!isSidebarCollapsed && <ChevronRight size={16} className="dropdown-arrow" />}
            </div>

            {!isSidebarCollapsed && (
              <div className="dropdown-content">
                {editPageItems.map((item) => (
                  <div
                    key={item.id}
                    className={`nav-link sub-link ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsEditPagesOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <div className="dot" />
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`nav-dropdown ${isPagesOpen ? 'open' : ''}`}>
            <div
              className={`nav-link ${isPagesSectionActive ? 'active' : ''}`}
              onClick={() => {
                if (isSidebarCollapsed) {
                  setIsSidebarCollapsed(false);
                  setIsPagesOpen(true);
                } else {
                  setIsPagesOpen(!isPagesOpen);
                }
              }}
            >
              <Layers size={20} />
              {!isSidebarCollapsed && <span>Paginas Especiais</span>}
              {!isSidebarCollapsed && <ChevronRight size={16} className="dropdown-arrow" />}
            </div>

            {!isSidebarCollapsed && (
              <div className="dropdown-content">
                {pageItems.map((item) => (
                  <div
                    key={item.id}
                    className={`nav-link sub-link ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsPagesOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <div className="dot" />
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={20} />
            {!isSidebarCollapsed && <span>Sair do Painel</span>}
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="menu-toggle btn-mobile-menu" onClick={() => setIsMobileMenuOpen(true)} style={{ display: 'none' }}>
            <Menu size={24} />
          </button>
          <h1>{activeItem?.label}</h1>
          <div className="user-profile">
            <span className="user-name">{sessionUser?.full_name || sessionUser?.username || 'Admin'}</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderActiveTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="toast-container">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className={`toast ${toast.type}`}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
            >
              {toast.type === 'success'
                ? <CheckCircle size={20} color="var(--admin-success)" />
                : <AlertCircle size={20} color="var(--admin-danger)" />}
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const useAdminState = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [productToEdit, setProductToEdit] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isHomeOpen, setIsHomeOpen] = useState(false);
  const [isEditPagesOpen, setIsEditPagesOpen] = useState(false);
  const [isPagesOpen, setIsPagesOpen] = useState(false);
  const { loading, toasts, sessionUser, isMasterAdmin } = useAdmin();

  return {
    loading,
    activeTab,
    setActiveTab,
    productToEdit,
    setProductToEdit,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isCatalogOpen,
    setIsCatalogOpen,
    isHomeOpen,
    setIsHomeOpen,
    isEditPagesOpen,
    setIsEditPagesOpen,
    isPagesOpen,
    setIsPagesOpen,
    toasts,
    sessionUser,
    isMasterAdmin
  };
};

const AdminDashboard = () => (
  <AdminProvider>
    <AdminDashboardContent />
  </AdminProvider>
);

export default AdminDashboard;
