import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Eye,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
  Users,
  Zap
} from 'lucide-react';
import { useAdmin } from '../../../context/useAdmin';
import { getAdminAnalyticsSummary } from '../../../services/adminAnalytics';
import { parseSafeExtraData } from '../../../utils/contentSafety';
import DashboardList from './DashboardList';
import DashboardMetricCard from './DashboardMetricCard';
import './AdminDashboardHome.css';

const DEFAULT_SUMMARY = {
  period_days: 30,
  totals: {
    visitors_today: 0,
    visitors_period: 0,
    page_views: 0,
    searches: 0,
    quote_clicks: 0,
    whatsapp_clicks: 0
  },
  top_pages: [],
  top_products_viewed: [],
  top_products_clicked: [],
  top_quote_products: [],
  top_search_terms: [],
  searches_without_results: [],
  recent_interests: []
};

const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(Number(value) || 0);

const getRecentInterestLabel = (item) => {
  const labels = {
    quote_click: 'Orcamento',
    whatsapp_click: 'WhatsApp',
    product_view: 'Produto visto',
    product_click: 'Produto clicado',
    search: 'Busca'
  };

  const mainLabel = item.product_name || item.search_term || item.path || 'Interesse registrado';
  return `${labels[item.event_type] || 'Evento'}: ${mainLabel}`;
};

const AdminDashboardHome = ({ onOpenTab }) => {
  const { products, categories } = useAdmin();
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getAdminAnalyticsSummary({ days: 30 });

        if (isMounted) {
          setSummary({ ...DEFAULT_SUMMARY, ...data, totals: { ...DEFAULT_SUMMARY.totals, ...(data.totals || {}) } });
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Nao foi possivel carregar as metricas.');
          setSummary(DEFAULT_SUMMARY);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const productStats = useMemo(() => {
    const activeProducts = products.filter((product) => Number(product.is_active ?? 1) === 1).length;
    const quoteProducts = products.filter((product) => {
      const extra = parseSafeExtraData(product.extra_data);
      return extra.showQuoteButton !== false && extra.showQuoteButton !== 'false';
    }).length;

    return {
      total: products.length,
      active: activeProducts,
      quoteEnabled: quoteProducts
    };
  }, [products]);

  const recentInterests = (summary.recent_interests || []).map((item) => ({
    label: getRecentInterestLabel(item),
    total: item.result_count ?? ''
  }));

  return (
    <div className="admin-dashboard-home">
      <div className="dashboard-hero">
        <div>
          <span>Dashboard Talmax</span>
          <h2>Visao simples do que os clientes estao procurando</h2>
          <p>Metricas anonimas do proprio site, sem Google Analytics.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => onOpenTab('products')}>
          <Package size={18} /> Cadastrar produto
        </button>
      </div>

      {error && (
        <div className="dashboard-alert" role="alert">
          {error}
        </div>
      )}

      <section className="dashboard-metrics-grid" aria-busy={loading}>
        <DashboardMetricCard
          title="Visitantes hoje"
          value={formatNumber(summary.totals.visitors_today)}
          description="Pessoas unicas que acessaram hoje"
          icon={<Users size={22} />}
          tone="blue"
        />
        <DashboardMetricCard
          title="Visitantes 30 dias"
          value={formatNumber(summary.totals.visitors_period)}
          description={`${formatNumber(summary.totals.page_views)} visualizacoes`}
          icon={<Eye size={22} />}
          tone="green"
        />
        <DashboardMetricCard
          title="Buscas feitas"
          value={formatNumber(summary.totals.searches)}
          description="Termos pesquisados no site"
          icon={<Search size={22} />}
          tone="orange"
        />
        <DashboardMetricCard
          title="Cliques em orcamento"
          value={formatNumber(summary.totals.quote_clicks)}
          description="Botao solicitar orcamento"
          icon={<ShoppingBag size={22} />}
          tone="purple"
        />
        <DashboardMetricCard
          title="Cliques no WhatsApp"
          value={formatNumber(summary.totals.whatsapp_clicks)}
          description="Contatos iniciados pelo site"
          icon={<MessageCircle size={22} />}
          tone="teal"
        />
        <DashboardMetricCard
          title="Produtos ativos"
          value={`${formatNumber(productStats.active)} / ${formatNumber(productStats.total)}`}
          description={`${formatNumber(productStats.quoteEnabled)} com orcamento ligado`}
          icon={<Package size={22} />}
          tone="slate"
          onClick={() => onOpenTab('products-list')}
        />
      </section>

      <section className="dashboard-panels-grid">
        <DashboardList
          title="Produtos mais vistos"
          description="Ajuda a entender onde existe mais interesse."
          items={summary.top_products_viewed}
        />
        <DashboardList
          title="Produtos mais clicados"
          description="Produtos que mais levaram clientes para detalhes."
          items={summary.top_products_clicked}
        />
        <DashboardList
          title="Mais pedidos em orcamento"
          description="Produtos com maior intencao de compra."
          items={summary.top_quote_products}
        />
        <DashboardList
          title="Termos mais buscados"
          description="O que os clientes digitam no site."
          items={summary.top_search_terms}
        />
      </section>

      <section className="dashboard-bottom-grid">
        <DashboardList
          title="Buscas sem resultado"
          description="Sinais de produtos ou nomes faltando no catalogo."
          items={summary.searches_without_results}
        />
        <DashboardList
          title="Paginas mais acessadas"
          description="Mostra os caminhos com mais trafego."
          items={summary.top_pages}
        />
        <div className="dashboard-list-panel">
          <div className="dashboard-list-panel__header">
            <h3>Ultimos interesses</h3>
            <p>Eventos recentes de busca, produto, orcamento e WhatsApp.</p>
          </div>
          {recentInterests.length > 0 ? (
            <ol className="dashboard-list dashboard-list--recent">
              {recentInterests.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <span className="dashboard-list__rank"><Activity size={14} /></span>
                  <span className="dashboard-list__label">{item.label}</span>
                  {item.total !== '' && <strong>{item.total}</strong>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="dashboard-empty-state">Ainda nao existem eventos recentes.</p>
          )}
        </div>
      </section>

      <section className="dashboard-actions">
        <button type="button" onClick={() => onOpenTab('products-list')}>
          <Search size={18} /> Revisar produtos
        </button>
        <button type="button" onClick={() => onOpenTab('categories')}>
          <Zap size={18} /> Ajustar categorias ({formatNumber(categories.length)})
        </button>
        <button type="button" onClick={() => onOpenTab('support')}>
          <MessageCircle size={18} /> Ver suporte
        </button>
      </section>
    </div>
  );
};

export default AdminDashboardHome;
