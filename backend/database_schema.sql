-- ======================================================
-- SCRIPT DE CRIACAO DO BANCO DE DADOS - TALMAX
-- Estado atualizado com base no banco atual do projeto
-- ======================================================

CREATE DATABASE IF NOT EXISTS `site-talmax`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `site-talmax`;

-- ======================================================
-- TABELAS PRINCIPAIS
-- ======================================================

CREATE TABLE IF NOT EXISTS categorias (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    icon_url VARCHAR(255) DEFAULT NULL,
    background_url VARCHAR(500) DEFAULT NULL,
    page_banner_categorias_url VARCHAR(500) DEFAULT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    is_visible BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uk_categorias_name (name),
    UNIQUE KEY uk_categorias_slug (slug)
);

CREATE TABLE IF NOT EXISTS sub_categorias (
    id INT NOT NULL AUTO_INCREMENT,
    category_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    background_url VARCHAR(500) DEFAULT NULL,
    display_order INT DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sub_categorias_slug (slug),
    KEY idx_sub_categorias_category_id (category_id),
    CONSTRAINT fk_sub_categorias_categoria
        FOREIGN KEY (category_id) REFERENCES categorias(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS produtos (
    id INT NOT NULL AUTO_INCREMENT,
    category_id INT DEFAULT NULL,
    sub_category_id INT DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    main_image VARCHAR(255) DEFAULT NULL,
    extra_data JSON DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_upcera BOOLEAN DEFAULT FALSE,
    is_scanner BOOLEAN DEFAULT FALSE,
    is_3d_printer BOOLEAN DEFAULT FALSE,
    upcera_order INT DEFAULT 0,
    scanner_order INT DEFAULT 0,
    printer_order INT DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_produtos_category_id (category_id),
    KEY idx_produtos_sub_category_id (sub_category_id),
    KEY idx_produtos_active_id (is_active, id),
    KEY idx_produtos_featured_active (is_featured, is_active),
    KEY idx_produtos_name (name),
    KEY idx_produtos_upcera_order (is_upcera, upcera_order),
    KEY idx_produtos_scanner_order (is_scanner, scanner_order),
    KEY idx_produtos_printer_order (is_3d_printer, printer_order),
    CONSTRAINT fk_produtos_categoria
        FOREIGN KEY (category_id) REFERENCES categorias(id) ON DELETE SET NULL,
    CONSTRAINT fk_produtos_sub_categoria
        FOREIGN KEY (sub_category_id) REFERENCES sub_categorias(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS abas_produto (
    id INT NOT NULL AUTO_INCREMENT,
    product_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT DEFAULT NULL,
    content_as_list BOOLEAN DEFAULT FALSE,
    video_url VARCHAR(2048) DEFAULT NULL,
    show_content_with_video BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_abas_produto_product_id (product_id),
    KEY idx_abas_produto_display_order (display_order),
    CONSTRAINT fk_abas_produto_product
        FOREIGN KEY (product_id) REFERENCES produtos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS banners (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) DEFAULT NULL,
    subtitle VARCHAR(255) DEFAULT NULL,
    image_url VARCHAR(255) NOT NULL,
    link_url VARCHAR(255) DEFAULT NULL,
    display_order INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) DEFAULT NULL,
    email VARCHAR(160) DEFAULT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'editor',
    bloq_user TINYINT NOT NULL DEFAULT 1,
    session_version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username),
    UNIQUE KEY uk_users_email (email)
);

CREATE TABLE IF NOT EXISTS admin_login_rate_limits (
    key_name VARCHAR(255) NOT NULL,
    failed_attempts INT NOT NULL DEFAULT 0,
    window_started_at BIGINT NOT NULL,
    blocked_until BIGINT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (key_name),
    KEY idx_admin_login_rate_limits_updated_at (updated_at),
    KEY idx_admin_login_rate_limits_blocked_until (blocked_until)
);

CREATE TABLE IF NOT EXISTS page_settings (
    id INT NOT NULL AUTO_INCREMENT,
    page_name VARCHAR(50) NOT NULL,
    logo_url VARCHAR(500) DEFAULT NULL,
    content JSON DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_page_settings_page_name (page_name)
);

CREATE TABLE IF NOT EXISTS technical_assistance_cards (
    id INT NOT NULL AUTO_INCREMENT,
    company VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(120) NOT NULL,
    state_code CHAR(2) NOT NULL,
    phone VARCHAR(40) DEFAULT NULL,
    phone_2 VARCHAR(40) DEFAULT NULL,
    phone_3 VARCHAR(40) DEFAULT NULL,
    email VARCHAR(160) DEFAULT NULL,
    map_url VARCHAR(1000) DEFAULT NULL,
    site_url VARCHAR(1000) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS custom_pages (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(160) NOT NULL,
    slug VARCHAR(180) NOT NULL,
    layout_type VARCHAR(40) NOT NULL DEFAULT 'hero-left',
    banner_url VARCHAR(500) DEFAULT NULL,
    logo_url VARCHAR(500) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    sub_description TEXT DEFAULT NULL,
    product_ids JSON DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_custom_pages_slug (slug)
);

-- ======================================================
-- DADOS INICIAIS
-- Observacao:
-- Os IDs abaixo refletem o banco atual do projeto.
-- Isso inclui categorias e subcategorias criadas depois do schema antigo.
-- ======================================================

INSERT INTO categorias (id, name, slug, icon_url, display_order, is_visible) VALUES
(1, 'Gesso e Troquelizacao', 'gesso-e-troquelizacao', NULL, 1, 0),
(2, 'Duplicadores', 'duplicadores', NULL, 2, 0),
(3, 'Ceras', 'ceras', NULL, 3, 0),
(4, 'Revestimentos', 'revestimentos', NULL, 4, 0),
(5, 'Zirkon Ice', 'zirkon-ice', NULL, 5, 0),
(6, 'Ligas Metalicas', 'ligas-metalicas', NULL, 6, 0),
(7, 'Soldas', 'soldas', NULL, 7, 0),
(8, 'Corte e Acabamento', 'corte-e-acabamento', NULL, 8, 0),
(9, 'Microscopio e Lupa', 'microscopio-e-lupa', NULL, 9, 0),
(10, 'Equipamentos', 'equipamentos', NULL, 10, 1),
(11, 'Acessorios para Ceramica', 'acessorios-para-ceramica', NULL, 11, 0),
(12, 'T-Lithium', 't-lithium', NULL, 12, 0),
(13, 'Talmax Digital', 'talmax-digital', NULL, 13, 0),
(14, 'Blocos', 'blocos', NULL, 14, 0),
(15, 'Linha Cad/Cam', 'linha-cad-cam', NULL, 15, 0),
(16, 'Linha de Ceramicas', 'linha-de-ceramicas', NULL, 16, 0),
(17, 'Resinas', 'resinas', NULL, 17, 0),
(18, 'Protese Dentaria', 'protese-dentaria', NULL, 0, 0),
(19, 'Nail e Podologia', 'nail-e-podologia', NULL, 0, 0)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    slug = VALUES(slug),
    icon_url = VALUES(icon_url),
    display_order = VALUES(display_order),
    is_visible = VALUES(is_visible);

INSERT INTO sub_categorias (id, category_id, name, slug, display_order, is_visible) VALUES
(1, 3, 'Ceras Galileo', 'ceras-galileo', 0, 1),
(2, 3, 'Ceras Flex', 'ceras-flex', 0, 1),
(3, 3, 'Equipamento para Cera', 'equipamento-para-cera', 0, 1),
(4, 3, 'Utilitarios para Cera', 'utilitrios-para-cera', 0, 1),
(5, 8, 'Pedras Ninja - Para Metal', 'pedras-ninja-para-metal', 0, 1),
(6, 8, 'Disco Ninja - Disco e Brocas Diamantada', 'disco-ninja-disco-e-brocas-diamantada', 0, 1),
(7, 8, 'Borrachas Ninja', 'borrachas-ninja', 0, 1),
(8, 8, 'Escovas Ninja', 'escovas-ninja', 0, 1),
(9, 8, 'Utilitario para Corte e Acabamento', 'utilitrio-para-corte-e-acabamento', 0, 1),
(10, 8, 'Pedras Ninja - Para Zirconia', 'pedras-ninja-para-zircnia', 0, 1),
(11, 8, 'Brocas Sinterizadas', 'brocas-sinterizadas', 0, 1),
(12, 10, 'Micromotores', 'micromotores', 0, 1),
(13, 10, 'Fornos', 'fornos', 0, 1),
(14, 10, 'Microscopios - Lupas', 'microscpios-lupas', 0, 1),
(15, 10, 'Fresadoras', 'fresadoras', 0, 1),
(16, 10, 'Ultra-som', 'ultra-som', 0, 1),
(17, 10, 'Aspiradores', 'aspiradores', 0, 1),
(18, 10, 'Poletriz', 'poletriz', 0, 1),
(19, 10, 'Scanners de Mesa', 'scanners-de-mesa', 0, 1),
(20, 15, 'Fit Plus Cera - Aman', 'fit-plus-cera-aman', 0, 1),
(21, 15, 'Fit Plus Cera - Open', 'fit-plus-cera-open', 0, 1),
(22, 15, 'Fit Plus Cera - ZZ', 'fit-plus-cera-zz', 0, 1),
(23, 15, 'Fit Plus ZR - Aman', 'fit-plus-zr-aman', 0, 1),
(24, 15, 'Fit Plus ZR - Open', 'fit-plus-zr-open', 0, 1),
(25, 15, 'Fit Plus ZR - ZZ', 'fit-plus-zr-zz', 0, 1),
(26, 1, 'Gesso Tuff Rock', 'gesso-tuff-rock', 0, 1),
(27, 1, 'Pinos de Troquel', 'pinos-de-troquel', 0, 1),
(28, 1, 'Pinos de Troquel in Box', 'pinos-de-troquel-in-box', 0, 1),
(29, 1, 'Troquelizadores', 'troquelizadores', 0, 1),
(30, 1, 'Articuladores', 'articuladores', 0, 1),
(31, 1, 'Impermeabilizante', 'impermeabilizante', 0, 1),
(32, 1, 'Espacadores', 'espaadores', 0, 1),
(33, 1, 'Isolante', 'isolante', 0, 1),
(34, 6, 'Blocos e Nucleos - Ligas', 'blocos-e-ncleos-ligas', 0, 1),
(35, 6, 'Metaloceramica - Ligas', 'metalocermica-ligas', 0, 1),
(36, 6, 'PPR - Ligas', 'ppr-ligas', 0, 1),
(37, 6, 'Utilitarios para Ligas (Cadinhos)', 'utilitrios-para-ligas-cadinhos', 0, 1),
(38, 16, 'Pinceis', 'pincis', 0, 1),
(39, 16, 'Godes', 'gods', 0, 1),
(40, 16, 'Bases Refratarias', 'bases-refratrias', 0, 1),
(41, 4, 'Revestimentos - Fundicao - Prensagem - Refratarios', 'revestimentos-fundio-prensagem-refratrios', 0, 1),
(42, 4, 'Refratarios', 'refratrios', 0, 1),
(43, 4, 'Revestimento para Solda', 'revestimento-para-solda', 0, 1),
(44, 4, 'Silicone', 'silicone', 0, 1),
(45, 4, 'Utilitarios para Fundicao e Prensagem', 'utilitrios-para-fundio-e-prensagem', 0, 1),
(46, 4, 'Micro Fit', 'micro-fit', 0, 1),
(47, 2, 'Duplicador - Fundicao - Prensagem - Refratarios', 'duplicador-fundio-prensagem-refratrios', 0, 1),
(48, 2, 'Refratarios Duplicadores', 'refratrios-duplicadores', 0, 1),
(49, 2, 'Revestimento para Solda Duplicadores', 'revestimento-para-solda-duplicadores', 0, 1),
(50, 2, 'Silicone Duplicadores', 'silicone-duplicadores', 0, 1),
(51, 2, 'Utilitarios Duplicadores', 'utilitrios-duplicadores', 0, 1),
(52, 2, 'Micro Fit Duplicadores', 'micro-fit-duplicadores', 0, 1),
(53, 7, 'Metaloceramica - Soldas', 'metalocermica-soldas', 0, 1),
(54, 7, 'PPR - Soldas', 'ppr-soldas', 0, 1),
(55, 7, 'Utilitarios para Soldas', 'utilitrios-para-soldas', 0, 1),
(56, 12, 'Press', 'press', 0, 1),
(57, 12, 'Pad', 'pad', 0, 1),
(58, 12, 'Acessorios T-Lithium', 'acessrios-t-lithium', 0, 1),
(61, 13, 'Upcera', 'upcera', 0, 1),
(62, 13, 'Scanner', 'scanner', 0, 1),
(63, 13, 'Impressora', 'impressora', 0, 1)
ON DUPLICATE KEY UPDATE
    category_id = VALUES(category_id),
    name = VALUES(name),
    slug = VALUES(slug),
    display_order = VALUES(display_order),
    is_visible = VALUES(is_visible);

INSERT INTO page_settings (id, page_name, logo_url, content) VALUES
(
    1,
    'scanners',
    '/img/titulo-pag-scanners.png',
    JSON_OBJECT(
        'title', 'Digital Precision Engineering',
        'description', 'O apice da captura digital para diagnosticos e planejamentos proteticos de precisao absoluta.'
    )
),
(
    2,
    'upcera',
    '/img/logo-upcera-.webp',
    JSON_OBJECT(
        'title', 'Upcera - Solucoes em Zirconia',
        'description', 'Lider mundial em tecnologia de ceramicas odontologicas.'
    )
),
(
    3,
    'equipamentos',
    NULL,
    JSON_OBJECT(
        'title', 'Equipamentos Odontologicos de Alta Performance',
        'description', 'Tecnologia avancada para laboratorios e consultorios que buscam excelencia e produtividade.'
    )
)
ON DUPLICATE KEY UPDATE
    page_name = VALUES(page_name),
    logo_url = VALUES(logo_url),
    content = VALUES(content);

-- Nenhum usuario admin padrao e criado pelo schema base.
-- Crie o primeiro acesso com ADMIN_BOOTSTRAP_* no ambiente do backend
-- ou por um procedimento operacional controlado fora do repositorio.

-- ======================================================
-- FIM DO SCRIPT
-- ======================================================
