import API_URL from './api';
import { createAdminRequestOptions, ensureAdminResponse } from './adminRequest';

const LEGACY_TECHNICAL_ASSISTANCE_DEFAULT_BANNER = '/img/assistenciatecnica-2.jpg.webp';
const LEGACY_SUPPORT_DEFAULT_LOGO = '/img/logo-talmax-suporte.png.webp';

export const DEFAULT_SPECIAL_PAGE_SETTINGS = {
  'talmax-digital': {
    page_name: 'talmax-digital',
    label: 'Talmax Digital',
    overline: 'TECNOLOGIA ODONTOLOGICA',
    
    description: 'O futuro da protese dentaria com tecnologia de ponta e precisao absoluta.',
    logo_url: '/img/logo-talmax-digital-pos.png',
    carousel_categories: []
  },
  upcera: {
    page_name: 'upcera',
    label: 'Upcera',
    overline: '',
    title: 'Innovation in Restorative Dentistry',
    description: 'Lider mundial em ceramicas odontologicas de alta performance, unindo estetica natural e resistencia extrema.',
    logo_url: '/img/logo-upcera-.webp'
  },
  scanners: {
    page_name: 'scanners',
    label: 'Scanners',
    overline: '',
    title: 'Digital Reality Capture',
    description: 'A mais alta tecnologia em digitalizacao 3D, transformando o fluxo fisico em digital com precisao absoluta.',
    logo_url: '/img/titulo-pag-scanners.png'
  },
  printers: {
    page_name: 'printers',
    label: 'Impressoras 3D',
    overline: '',
    title: 'High Precision Printing',
    description: 'A revolucao da manufatura aditiva com precisao industrial para o fluxo digital odontologico.',
    logo_url: '/img/impressoras3d.png'
  },
  'assistencia-tecnica': {
    page_name: 'assistencia-tecnica',
    label: 'Assistencia Tecnica',
    overline: '',
    title: 'Assistencia Tecnica',
    description: 'Confianca em cada servico, com\npecas originais e alto\npadrao de qualidade.',
    logo_url: '',
    banner_url: '',
    hero_content_x: 50,
    hero_content_y: 45,
    logo_width: 238,
    hero_tagline: 'Confianca em cada servico, com pecas originais e alto padrao de qualidade.',
    card_title: 'Assistencia Tecnica',
    card_description: 'Um time altamente especializado em qualidade, pronto para entregar rapidez, precisao e seguranca na manutencao dos seus equipamentos.',
    card_description_secondary: 'Trabalhamos para reduzir o tempo de parada e garantir o maximo desempenho, levando mais confianca e excelencia a cada atendimento.',
    card_button_label: 'Abrir chamado',
    card_url: 'https://talmax.tomticket.com/'
  },
  support: {
    page_name: 'support',
    label: 'Suporte',
    overline: '',
    title: 'Suporte Talmax',
    description: 'Estamos com voc\u00ea todos os dias, investindo em solu\u00e7\u00f5es, tecnologias e pessoas.',
    logo_url: '',
    banner_url: '',
    hero_content_x: 72,
    hero_content_y: 48,
    logo_width: 225,
    hero_tagline: 'Estamos com voc\u00ea todos os dias, investindo em solu\u00e7\u00f5es, tecnologias e pessoas.',
    info_title: 'Ao seu lado em cada resultado',
    info_subtitle: 'Atendimento especializado, \u00e1gil e conectado para impulsionar seus resultados todos os dias',
    info_body: [
      'Na Talmax, suporte vai al\u00e9m do atendimento. \u00c9 parceria no seu dia a dia. Investimos continuamente em tecnologia, processos e pessoas para entregar uma experi\u00eancia \u00e1gil, pr\u00f3xima e realmente eficiente.',
      'Nosso time est\u00e1 preparado para entender suas demandas e transformar desafios em solu\u00e7\u00f5es, trazendo mais dinamismo, seguran\u00e7a e excel\u00eancia para a rotina de t\u00e9cnicos e dentistas em laborat\u00f3rios, cl\u00ednicas e dentais em todo o Brasil.',
      'Com uma plataforma digital completa, voc\u00ea tem acesso a abertura de chamados, atendimento via chat, hist\u00f3rico integrado e um portal de conhecimento sempre dispon\u00edvel para apoiar sua opera\u00e7\u00e3o.'
    ].join('\n\n')
  }
};

export const normalizeSpecialPageSettings = (items = []) => {
  const normalizedMap = { ...DEFAULT_SPECIAL_PAGE_SETTINGS };

  if (Array.isArray(items)) {
    items.forEach((item) => {
      if (!item?.page_name || !normalizedMap[item.page_name]) {
        return;
      }

      const normalizedItem = { ...item };

      if (
        item.page_name === 'assistencia-tecnica'
        && normalizedItem.banner_url === LEGACY_TECHNICAL_ASSISTANCE_DEFAULT_BANNER
      ) {
        normalizedItem.banner_url = '';
      }

      if (
        item.page_name === 'support'
        && normalizedItem.logo_url === LEGACY_SUPPORT_DEFAULT_LOGO
      ) {
        normalizedItem.logo_url = '';
      }

      normalizedMap[item.page_name] = {
        ...normalizedMap[item.page_name],
        ...normalizedItem
      };
    });
  }

  return normalizedMap;
};

const pageSettingsService = {
  async getAll() {
    const response = await fetch(`${API_URL}/page-settings`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Erro ao buscar configuracoes das paginas especiais');
    }

    return response.json();
  },

  async update(pageName, formData) {
    const response = await fetch(`${API_URL}/page-settings/${pageName}`, createAdminRequestOptions({
      method: 'PUT',
      body: formData
    }));

    await ensureAdminResponse(response, 'Erro ao atualizar configuracao da pagina especial');
    return response.json();
  }
};

export default pageSettingsService;
