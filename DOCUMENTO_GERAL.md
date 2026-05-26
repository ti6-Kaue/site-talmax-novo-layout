# Documento Geral - Site Talmax

## 1. Objetivo

Este documento centraliza, em um so lugar, o que existe no projeto, para que serve cada parte, onde editar cada area e onde configurar o sistema.

Ele foi feito para responder estas perguntas:

- o que o site tem hoje
- onde cada pagina e montada
- o que vem do banco e o que esta fixo no codigo
- onde mexer quando precisar alterar conteudo
- onde configurar API, banco, imagens, login e deploy

---

## 2. Resumo rapido

O projeto e dividido em 4 partes principais:

1. `frontend/`
   Site publico e painel admin em React + Vite.
2. `backend/`
   API em Node.js + Express.
3. `MySQL`
   Banco com produtos, categorias, banners, usuarios, paginas e configuracoes.
4. `storage de imagens`
   Pode ser local, Cloudinary ou SFTP.

Fluxo geral:

```txt
Frontend React
-> chama a API em /api
-> backend Express
-> banco MySQL
-> imagens em /img
```

---

## 3. Onde mexer rapido

Se a duvida for "quero mudar tal coisa, por onde comeco?", use este mapa:

| O que quer alterar | Onde mexer primeiro | Arquivos / tabelas principais |
| --- | --- | --- |
| Menu do topo, footer, busca do site, rotas | codigo do frontend | `frontend/src/App.jsx`, `frontend/src/App.css` |
| Login admin | codigo do frontend + backend auth | `frontend/src/components/AdminLogin/AdminLogin.jsx`, `frontend/src/services/adminAuth.js`, `backend/src/server/auth/adminSession.js` |
| Usuarios admin | painel admin master + tabela `users` | `frontend/src/pages/Admin/AdminUsers/`, `backend/src/server/routes/adminAuthRoutes.js`, tabela `users` |
| Banner da home | painel admin > Banners | `frontend/src/pages/Admin/AdminBanners/`, `backend/src/server/routes/bannerRoutes.js`, tabela `banners` |
| Cards da home | painel admin > Home Segmentos | `frontend/src/pages/Admin/AdminSegments/`, `backend/src/server/routes/homeServiceRoutes.js`, tabela `home_services` |
| Produtos em destaque da home | painel admin > Home Destaques | `frontend/src/pages/Admin/AdminFeatured/`, `backend/src/server/routes/specialSectionRoutes.js`, tabela `produtos` + `extra_data` |
| Categorias e subcategorias | painel admin > Categorias | `frontend/src/pages/Admin/AdminCategories/`, `backend/src/server/routes/categoryRoutes.js`, tabelas `categorias` e `sub_categorias` |
| Produto completo | painel admin > Cadastro de Produtos | `frontend/src/pages/Admin/AdminProducts/`, `backend/src/server/routes/productRoutes.js`, tabelas `produtos`, `abas_produto` |
| Lista de produtos | painel admin > Lista de Produtos | `frontend/src/pages/Admin/AdminProducts/AdminProductsList.jsx`, `backend/src/server/routes/productRoutes.js` |
| Talmax Digital | painel admin > Talmax Digital | `frontend/src/pages/Admin/AdminTalmaxDigital/AdminTalmaxDigital.jsx`, `backend/src/server/routes/homeServiceRoutes.js`, tabela `home_services` |
| Upcera | painel admin > Upcera | `frontend/src/pages/Admin/AdminUpcera/`, `backend/src/server/routes/pageSettingsRoutes.js`, `backend/src/server/routes/specialSectionRoutes.js` |
| Scanners | painel admin > Scanners | `frontend/src/pages/Admin/AdminScanners/`, `backend/src/server/routes/pageSettingsRoutes.js`, `backend/src/server/routes/specialSectionRoutes.js` |
| Impressoras 3D | painel admin > Impressoras 3D | `frontend/src/pages/Admin/AdminPrinters/`, `backend/src/server/routes/pageSettingsRoutes.js`, `backend/src/server/routes/specialSectionRoutes.js` |
| Paginas personalizadas `/pagina/:slug` | painel admin > Paginas Personalizadas | `frontend/src/pages/Admin/AdminCustomPages/`, `backend/src/server/routes/customPageRoutes.js`, tabela `custom_pages` |
| Grupo de segmentos `/grupo-digital/:slug` | painel admin > Grupo de Segmentos | `frontend/src/pages/Admin/AdminTalmaxDigital/AdminDigitalGroups.jsx`, `backend/src/server/routes/digitalGroupRoutes.js`, tabelas `digital_groups` e `digital_group_cards` |
| Politica de privacidade | codigo fixo | `frontend/src/components/PrivacyPolicy/` |
| Quem somos | codigo fixo | `frontend/src/components/QuemSomos/` |
| Historia e diretoria | codigo fixo | `frontend/src/components/HistoriaDiretoria/` |
| Suporte | codigo fixo | `frontend/src/components/Support/` |
| API base do frontend | configuracao do frontend | `frontend/src/services/api.js` |
| Base do build do Vite | configuracao do frontend | `frontend/vite.config.js` |
| Banco de dados | configuracao do backend | `backend/src/config/database.js`, `backend/.env` |
| CORS | configuracao do backend | `backend/src/server/config/cors.js` |
| Upload de imagens | configuracao do backend | `backend/src/server/config/upload.js`, `backend/src/server/config/imageStorage.js`, `backend/src/server/services/fileStorageService.js` |

---

## 4. Estrutura do repositorio

```txt
site-talmax/
|-- DOCUMENTO_GERAL.md
|-- README.md
|-- KINGHOST_DEPLOY.md
|-- backend/
|   |-- server.js
|   |-- database_schema.sql
|   |-- .env.example
|   `-- src/
|-- frontend/
|   |-- vite.config.js
|   `-- src/
`-- docs/
```

Arquivos centrais:

- `frontend/src/main.jsx`
  Entrada do React.
- `frontend/src/App.jsx`
  Router principal, layout publico, busca do site, rotas e protecao do admin.
- `frontend/src/pages/Admin/AdminDashboard.jsx`
  Estrutura completa do painel.
- `backend/server.js`
  Entrada do backend.
- `backend/src/server/app.js`
  Onde as rotas da API sao montadas.
- `backend/database_schema.sql`
  Schema base do banco.

---

## 5. O que e fixo no codigo e o que vem do banco

### 5.1 Conteudo fixo no codigo

Estas areas dependem principalmente de arquivos `.jsx` e `.css`:

- menu do topo
- menu mobile
- footer
- busca geral do site
- pagina de privacidade
- pagina quem somos
- pagina historia e diretoria
- pagina suporte
- tela de login admin
- visual do painel admin

Arquivos mais importantes para isso:

- `frontend/src/App.jsx`
- `frontend/src/App.css`
- `frontend/src/index.css`
- `frontend/src/components/PrivacyPolicy/`
- `frontend/src/components/QuemSomos/`
- `frontend/src/components/HistoriaDiretoria/`
- `frontend/src/components/Support/`
- `frontend/src/components/AdminLogin/`

### 5.2 Conteudo dinamico vindo do banco/API

Estas areas sao alimentadas por API e banco:

- banners da home
- produtos
- categorias
- subcategorias
- cards da home
- produtos em destaque
- paginas especiais
- paginas personalizadas
- grupos digitais
- usuarios admin

---

## 6. Mapa do site publico

### 6.1 Layout global

O layout publico fica principalmente em:

- `frontend/src/App.jsx`
- `frontend/src/App.css`

Ali estao:

- router principal
- header
- menu desktop e mobile
- busca geral do site
- footer
- rotas publicas
- redirecionamentos do admin

Se quiser mudar links do menu, footer, placeholders ou estrutura geral do site, o primeiro lugar para editar e `frontend/src/App.jsx`.

### 6.2 Rotas publicas

| URL | O que e | Componente | Origem do conteudo | Onde editar |
| --- | --- | --- | --- | --- |
| `/` | Home | `frontend/src/components/Home/Home.jsx` | API + banco | hero via `HeroSlider`, cards via `home_services`, destaques via `produtos`, categorias via `categorias` |
| `/privacidade` | Politica de privacidade | `frontend/src/components/PrivacyPolicy/PrivacyPolicy.jsx` | fixo no codigo | editar JSX/CSS da pasta |
| `/quem-somos` | Institucional | `frontend/src/components/QuemSomos/QuemSomos.jsx` | fixo no codigo | editar JSX/CSS da pasta |
| `/historia-diretoria` | Institucional | `frontend/src/components/HistoriaDiretoria/HistoriaDiretoria.jsx` | fixo no codigo | editar JSX/CSS da pasta |
| `/produtos` | Catalogo geral | `frontend/src/components/ProductCatalog/ProductCatalog.jsx` | API `/api/products` + `/api/categories` | filtro, busca e visual no componente; dados no painel admin |
| `/categoria/:slug` | Catalogo filtrado por categoria | `frontend/src/components/ProductCatalog/ProductCatalog.jsx` | API `/api/products` + `/api/categories` | mesmas fontes do catalogo |
| `/produto/:id` | Detalhe do produto | `frontend/src/components/ProductDetail/ProductDetail.jsx` | API `/api/products/:id` | alterar no cadastro do produto |
| `/categoria/talmax-digital` | Pagina Talmax Digital | `frontend/src/components/TalmaxDigital/TalmaxDigital.jsx` | API `/api/home-services` + `/api/page-settings` | admin Talmax Digital + Page Settings |
| `/grupo-digital/:slug` | Grupo de segmentos | `frontend/src/components/TalmaxDigital/DigitalGroupPage.jsx` | API `/api/digital-groups/public/:slug` | admin Grupo de Segmentos |
| `/pagina/:slug` | Pagina personalizada | `frontend/src/components/CustomPage/CustomPage.jsx` | API `/api/custom-pages/public/:slug` | admin Paginas Personalizadas |
| `/upcera` | Pagina especial Upcera | `frontend/src/components/Upcera/Upcera.jsx` | API `/api/products` + `/api/page-settings` | admin Upcera |
| `/scanners` | Pagina especial Scanners | `frontend/src/components/Scanners/Scanners.jsx` | API `/api/products` + `/api/page-settings` | admin Scanners |
| `/impressoras-3d` | Pagina especial Impressoras 3D | `frontend/src/components/Impressoras3D/Impressoras3D.jsx` | API `/api/products` + `/api/page-settings` | admin Impressoras 3D |
| `/suporte` | Pagina de suporte | `frontend/src/components/Support/Support.jsx` | fixo no codigo | editar JSX/CSS da pasta |

### 6.3 Rotas que hoje estao como placeholder

Estas rotas hoje ainda usam `PagePlaceholder`:

- `/depoimentos`
- `/blog`
- `/assistencia-tecnica`
- `/contato`
- `/comercial-comex`
- `/cursos`
- `/portal-cliente`
- `/sac`
- `/politicas-troca`

Onde isso esta definido:

- `frontend/src/App.jsx`
- `frontend/src/components/PagePlaceholder/PagePlaceholder.jsx`

Se quiser transformar alguma dessas paginas em pagina real, o caminho e:

1. criar um componente novo em `frontend/src/components/`
2. criar o CSS da pagina
3. trocar a rota em `frontend/src/App.jsx`

### 6.4 Home

Arquivos principais:

- `frontend/src/components/Home/Home.jsx`
- `frontend/src/components/HeroSlider/HeroSlider.jsx`
- `frontend/src/components/Home/sections/HomeServicesSection.jsx`
- `frontend/src/components/Home/sections/HomeFeaturedProductsSection.jsx`
- `frontend/src/components/Home/sections/HomeCategoriesSection.jsx`

Origem dos dados:

- banner: tabela `banners`
- cards/servicos da home: tabela `home_services`
- destaques: tabela `produtos` com flag `is_featured` e ordem em `extra_data`
- categorias visiveis: tabela `categorias`

Onde mexer:

- visual da home: arquivos `.jsx` e `.css` da pasta `Home`
- conteudo dinamico: painel admin

### 6.5 Catalogo e produto

Arquivos principais:

- `frontend/src/components/ProductCatalog/ProductCatalog.jsx`
- `frontend/src/components/ProductDetail/ProductDetail.jsx`
- `frontend/src/components/ProductCard/ProductCard.jsx`

Os produtos usam:

- tabela `produtos`
- tabela `abas_produto`
- campo `extra_data` dentro de `produtos`

Observacao importante:

O campo `extra_data` guarda varias configuracoes do produto, como:

- galeria de imagens
- tabs do produto
- ordem de destaque
- ordem de secoes especiais
- exibicao de botao de orcamento

### 6.6 Paginas especiais

As paginas especiais usam dois tipos de configuracao:

1. textos/logo gerais
   tabela `page_settings`
2. quais produtos aparecem nelas
   flags em `produtos`

Arquivos principais:

- `frontend/src/components/TalmaxDigital/TalmaxDigital.jsx`
- `frontend/src/components/Upcera/Upcera.jsx`
- `frontend/src/components/Scanners/Scanners.jsx`
- `frontend/src/components/Impressoras3D/Impressoras3D.jsx`
- `backend/src/server/routes/pageSettingsRoutes.js`
- `backend/src/server/routes/specialSectionRoutes.js`

Chaves usadas em `page_settings.page_name`:

- `talmax-digital`
- `upcera`
- `scanners`
- `printers`

---

## 7. Mapa do painel administrativo

### 7.1 Entrada do painel

Rotas:

- `/admin/login`
- `/admin/painel`

Arquivos principais:

- `frontend/src/components/AdminLogin/AdminLogin.jsx`
- `frontend/src/services/adminAuth.js`
- `frontend/src/pages/Admin/AdminDashboard.jsx`
- `frontend/src/context/AdminContext.jsx`
- `backend/src/server/auth/adminSession.js`
- `backend/src/server/routes/adminAuthRoutes.js`

### 7.2 Como o painel funciona

O painel nao usa varias subrotas internas para cada modulo.

Ele abre sempre em:

- `/admin/painel`

E troca de tela por estado local dentro de:

- `frontend/src/pages/Admin/AdminDashboard.jsx`

### 7.3 Modulos do painel

| Modulo | Para que serve | Frontend | Backend / API | Banco |
| --- | --- | --- | --- | --- |
| Dashboard | visao geral do painel | `AdminDashboard.jsx` | usa contexto | produtos, categorias, banners |
| Categorias | criar, editar e excluir categorias e subcategorias | `AdminCategories/` | `/api/categories` | `categorias`, `sub_categorias` |
| Usuarios Admin | criar e editar usuarios do painel | `AdminUsers/` | `/api/admin/users` | `users` |
| Seguranca do Login | desbloquear usuario travado | `AdminSecurity/` | `/api/admin/login-unlock` | `users` + rate limit |
| Cadastro de Produtos | cadastro completo do produto | `AdminProducts/` | `/api/products` | `produtos`, `produto_*`, `abas_produto` |
| Lista de Produtos | listar e abrir para edicao | `AdminProducts/AdminProductsList.jsx` | `/api/products` | `produtos` |
| Banners | cadastrar banners da home | `AdminBanners/` | `/api/banners` | `banners` |
| Home Destaques | escolher produtos em destaque | `AdminFeatured/` | `/api/featured-products` | `produtos` |
| Paginas Personalizadas | criar `/pagina/:slug` | `AdminCustomPages/` | `/api/custom-pages` | `custom_pages` |
| Grupo de Segmentos | criar `/grupo-digital/:slug` | `AdminTalmaxDigital/AdminDigitalGroups.jsx` | `/api/digital-groups` | `digital_groups`, `digital_group_cards` |
| Home Segmentos | cards da home | `AdminSegments/` | `/api/home-services` | `home_services` |
| Talmax Digital | conteudo da pagina Talmax Digital | `AdminTalmaxDigital/AdminTalmaxDigital.jsx` | `/api/home-services` e `/api/page-settings` | `home_services`, `page_settings` |
| Upcera | texto/logo + produtos da pagina Upcera | `AdminUpcera/` | `/api/page-settings`, `/api/upcera/products` | `page_settings`, `produtos` |
| Scanners | texto/logo + produtos da pagina Scanners | `AdminScanners/` | `/api/page-settings`, `/api/scanners/products` | `page_settings`, `produtos` |
| Impressoras 3D | texto/logo + produtos da pagina Impressoras 3D | `AdminPrinters/` | `/api/page-settings`, `/api/3d-printers/products` | `page_settings`, `produtos` |

### 7.4 Permissoes de usuario admin

A tabela `users` hoje guarda:

- `username`
- `password`
- `full_name`
- `email`
- `role`
- `bloq_user`

Perfis:

- `master`
  Pode gerenciar usuarios e desbloquear login.
- `editor`
  Usa o painel, mas sem poderes de administracao de acessos.

Arquivos principais:

- `backend/src/server/auth/adminSession.js`
- `backend/src/server/validation/adminUserSchemas.js`
- `frontend/src/pages/Admin/AdminUsers/`

### 7.5 Bloqueio de login admin

O bloqueio de tentativas esta em:

- `backend/src/server/seguranca/adminLoginRateLimit.js`

Configuracao principal:

- 5 tentativas falhas
- janela padrao de 15 minutos
- bloqueio por usuario ou e-mail informado

No frontend, a tela de login tambem salva o tempo de espera por usuario em:

- `frontend/src/components/AdminLogin/AdminLogin.jsx`

---

## 8. Frontend: pastas e responsabilidades

### 8.1 Pastas principais

```txt
frontend/src/
|-- components/
|-- context/
|-- hooks/
|-- pages/
|-- services/
|-- utils/
|-- App.jsx
`-- main.jsx
```

### 8.2 O que existe em cada pasta

- `components/`
  Paginas e blocos visuais do site publico.
- `pages/Admin/`
  Modulos do painel administrativo.
- `services/`
  Comunicacao com API.
- `context/`
  Estado global do admin.
- `hooks/`
  Hooks de produtos, categorias, banners e carga adiada.
- `utils/`
  Funcoes de apoio, assets, categorias, seguranca de conteudo, busca.

### 8.3 Servicos principais do frontend

| Arquivo | Para que serve |
| --- | --- |
| `frontend/src/services/api.js` | define a URL base da API |
| `frontend/src/services/adminAuth.js` | login, sessao, logout do admin |
| `frontend/src/services/adminRequest.js` | chamadas autenticadas com token/cookie |
| `frontend/src/services/bannerService.js` | CRUD de banners |
| `frontend/src/services/categoryService.js` | CRUD de categorias |
| `frontend/src/services/productService.js` | CRUD de produtos |
| `frontend/src/services/homeService.js` | CRUD dos cards da home |
| `frontend/src/services/pageSettingsService.js` | textos/logo das paginas especiais |
| `frontend/src/services/customPageService.js` | paginas personalizadas |
| `frontend/src/services/digitalGroupService.js` | grupos digitais |
| `frontend/src/services/adminUsers.js` | usuarios admin |

### 8.4 Estilos

No projeto, o CSS geralmente fica ao lado do componente.

Exemplos:

- `Home.jsx` -> `Home.css`
- `AdminLogin.jsx` -> `AdminLogin.css`
- `AdminUsers.jsx` -> `AdminUsers.css`

Para mudar a aparencia de uma tela, normalmente voce mexe em:

1. componente `.jsx`
2. CSS da mesma pasta

---

## 9. Backend: estrutura e responsabilidades

### 9.1 Entrada do backend

Arquivo:

- `backend/server.js`

Responsabilidades:

- carregar `.env`
- iniciar logger
- criar a app Express
- subir o servidor na porta configurada

### 9.2 Montagem da API

Arquivo:

- `backend/src/server/app.js`

Responsabilidades:

- aplicar seguranca (`helmet`)
- aplicar `trust proxy`
- aplicar `cors`
- aplicar compressao
- servir imagens em `/img`
- servir `frontend/dist`
- montar rotas `/api`
- responder SPA fora de `/api`

### 9.3 Rotas principais da API

| Prefixo | Arquivo | Para que serve |
| --- | --- | --- |
| `/api/admin` | `backend/src/server/routes/adminAuthRoutes.js` | login, sessao, logout, usuarios admin, desbloqueio |
| `/api/categories` | `backend/src/server/routes/categoryRoutes.js` | categorias e subcategorias |
| `/api/banners` | `backend/src/server/routes/bannerRoutes.js` | banners |
| `/api/products` | `backend/src/server/routes/productRoutes.js` | produtos |
| `/api/home-services` | `backend/src/server/routes/homeServiceRoutes.js` | cards da home |
| `/api/page-settings` | `backend/src/server/routes/pageSettingsRoutes.js` | textos/logo de paginas especiais |
| `/api/custom-pages` | `backend/src/server/routes/customPageRoutes.js` | paginas personalizadas |
| `/api/digital-groups` | `backend/src/server/routes/digitalGroupRoutes.js` | grupos digitais |
| `/api/upcera/products` | `backend/src/server/routes/specialSectionRoutes.js` | produtos da pagina Upcera |
| `/api/scanners/products` | `backend/src/server/routes/specialSectionRoutes.js` | produtos da pagina Scanners |
| `/api/3d-printers/products` | `backend/src/server/routes/specialSectionRoutes.js` | produtos da pagina Impressoras 3D |
| `/api/featured-products` | `backend/src/server/routes/specialSectionRoutes.js` | destaques da home |

### 9.4 Services importantes do backend

| Arquivo | Para que serve |
| --- | --- |
| `backend/src/server/services/productService.js` | listagem, detalhe, tabs e relacoes do produto |
| `backend/src/server/services/fileStorageService.js` | salvar imagem em local, Cloudinary ou SFTP |
| `backend/src/server/services/backupContentService.js` | fallback local para alguns conteudos |

### 9.5 Validacao e utilitarios

Pastas principais:

- `backend/src/server/validation/`
- `backend/src/server/utils/`

Uso:

- validar payloads
- sanitizar texto
- sanitizar links
- sanitizar caminhos de imagem
- padronizar erro de API

---

## 10. Banco de dados

### 10.1 Arquivo base

- `backend/database_schema.sql`

Esse arquivo cria o banco e as tabelas principais.

### 10.2 Tabelas principais

| Tabela | Para que serve |
| --- | --- |
| `categorias` | categorias principais do catalogo |
| `sub_categorias` | subcategorias ligadas a uma categoria principal |
| `produtos` | cadastro principal dos produtos, incluindo categoria e subcategoria |
| `abas_produto` | abas tecnicas e conteudo adicional do produto |
| `banners` | banners da home |
| `users` | usuarios do painel admin |
| `page_settings` | textos e logos das paginas especiais |
| `custom_pages` | paginas personalizadas publicas |
| `home_services` | cards e blocos da home/Talmax Digital |
| `digital_groups` | grupos digitais publicos |
| `digital_group_cards` | cards internos de cada grupo digital |

### 10.3 Tabelas que podem ser garantidas pelo backend

Algumas estruturas podem ser criadas ou completadas pelo backend quando a rota roda:

- `page_settings`
- `custom_pages`
- `digital_groups`
- `digital_group_cards`
- colunas extras de `home_services`

Mesmo assim, o certo em ambiente novo e:

1. importar `backend/database_schema.sql`
2. rodar as migrations necessarias

### 10.4 Pasta de migrations

- `backend/src/scripts/migrations/`

Exemplos atuais:

- `add_admin_user_identity.js`
- `add_bloq_user_to_users.js`
- `add_home_services_table.js`
- `add_special_orders.js`
- `add_upcera_column.js`
- `add_3d_printer_column.js`
- `update_segments.js`
- `capitalize_segments.js`

---

## 11. Configuracao do ambiente

### 11.1 Arquivo de ambiente

Arquivo de referencia:

- `backend/.env.example`

No ambiente real, use:

- `backend/.env`

### 11.2 Variaveis basicas do backend

| Variavel | Para que serve |
| --- | --- |
| `DB_HOST` | host do MySQL |
| `DB_PORT` | porta do MySQL |
| `DB_USER` | usuario do MySQL |
| `DB_PASSWORD` | senha do MySQL |
| `DB_NAME` | nome do banco |
| `DB_SSL` | ativa SSL no banco quando necessario |
| `PORT` | porta do backend |
| `NODE_ENV` | `development` ou `production` |
| `LOG_LEVEL` | nivel do logger |

### 11.3 Variaveis do admin

| Variavel | Para que serve |
| --- | --- |
| `ADMIN_JWT_SECRET` | chave do token da sessao admin |
| `ADMIN_JWT_EXPIRES_IN_SECONDS` | tempo de sessao |
| `ADMIN_COOKIE_SAME_SITE` | politica do cookie admin |
| `ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS` | janela do bloqueio de tentativas |
| `ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | quantidade maxima de tentativas |

### 11.4 Variaveis de CORS e proxy

| Variavel | Para que serve |
| --- | --- |
| `CORS_ALLOWED_ORIGINS` | dominios extras liberados no CORS |
| `EXPRESS_TRUST_PROXY` | configuracao de proxy reverso |

### 11.5 Variaveis de upload e storage

| Variavel | Para que serve |
| --- | --- |
| `IMAGE_STORAGE_PROVIDER` | escolha explicita: `cloudinary`, `s3`, `sftp` ou `local` |
| `UPLOAD_DIR` | pasta local principal das imagens |
| `UPLOAD_MAX_FILE_SIZE_MB` | tamanho maximo por upload |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary |
| `CLOUDINARY_API_KEY` | Cloudinary |
| `CLOUDINARY_API_SECRET` | Cloudinary |
| `CLOUDINARY_FOLDER` | pasta base no Cloudinary |
| `AWS_REGION` | regiao do S3 |
| `AWS_ACCESS_KEY_ID` | chave de acesso para S3 |
| `AWS_SECRET_ACCESS_KEY` | chave secreta para S3 |
| `S3_BUCKET` | bucket de imagens |
| `S3_PREFIX` | pasta base no bucket |
| `S3_PUBLIC_BASE_URL` | URL publica/CDN opcional para montar links |
| `S3_ENDPOINT` | endpoint opcional para S3 compativel |
| `S3_FORCE_PATH_STYLE` | use `true` para alguns provedores compativeis com S3 |
| `S3_CACHE_CONTROL` | cache enviado no objeto |
| `SFTP_HOST` | servidor SFTP |
| `SFTP_PORT` | porta SFTP |
| `SFTP_USER` | usuario SFTP |
| `SFTP_PASSWORD` | senha SFTP |
| `SFTP_REMOTE_DIR` | pasta remota do SFTP |
| `SFTP_PUBLIC_BASE_URL` | URL publica das imagens do SFTP |

### 11.6 Variaveis de cache e performance

| Variavel | Para que serve |
| --- | --- |
| `PRIMARY_IMAGE_CACHE_SECONDS` | cache das imagens principais |
| `STATIC_IMAGE_CACHE_SECONDS` | cache das imagens estaticas |
| `PLACEHOLDER_IMAGE_CACHE_SECONDS` | cache da imagem placeholder |
| `COMPRESSION_THRESHOLD_BYTES` | limiar da compressao |

### 11.7 Configuracao do frontend

Arquivo:

- `frontend/src/services/api.js`

Regra atual:

- em `dev`, usa `http://maquina-atual:5000/api`
- em `build/producao`, usa `/api`
- se `VITE_API_URL` existir, ele sobrescreve tudo

### 11.8 Base do Vite

Arquivo:

- `frontend/vite.config.js`

Configuracao atual:

```js
base: normalizeBasePath(env.VITE_PUBLIC_BASE_PATH || '/')
```

Importante:

- sem `VITE_PUBLIC_BASE_PATH`, o padrao e `/`
- neste repositorio, `frontend/.env.development` e `frontend/.env.production` fixam `/site-talmax/`

---

## 12. Imagens e uploads

### 12.1 Como o sistema serve imagens

O backend responde imagens em:

- `/img/...`

Arquivos principais:

- `backend/src/server/config/imageStorage.js`
- `backend/src/server/config/upload.js`
- `backend/src/server/services/fileStorageService.js`

### 12.2 Ordem de prioridade do storage

Hoje o projeto pode funcionar assim:

1. `IMAGE_STORAGE_PROVIDER`, se estiver configurado
2. Cloudinary, se estiver configurado
3. S3, se Cloudinary nao estiver ativo e S3 estiver configurado
4. SFTP, se os anteriores nao estiverem ativos e o SFTP estiver configurado
5. armazenamento local

### 12.3 Pastas de imagem

Pasta principal local:

- `backend/storage/img`

Pastas legadas ainda servidas:

- `frontend/public/img`
- `frontend/dist/img`

Isso existe para nao quebrar imagens antigas.

### 12.4 Tipos de imagem permitidos

O upload aceita:

- JPG
- PNG
- WEBP
- GIF
- SVG

---

## 13. Autenticacao do admin

### 13.1 Onde esta a autenticacao

- `frontend/src/components/AdminLogin/AdminLogin.jsx`
- `frontend/src/services/adminAuth.js`
- `backend/src/server/auth/adminSession.js`
- `backend/src/server/routes/adminAuthRoutes.js`

### 13.2 Como funciona

Fluxo:

```txt
AdminLogin
-> POST /api/admin/login
-> backend valida usuario ou e-mail + senha
-> gera token de sessao
-> salva cookie da sessao
-> frontend entra em /admin/painel
```

### 13.3 O que a tabela `users` precisa guardar

- nome do funcionario: `full_name`
- e-mail: `email`
- usuario: `username`
- senha: `password`
- permissao: `role`
- bloqueio temporario: `bloq_user`

### 13.4 Observacoes importantes

- a senha hoje e armazenada com hash `scrypt` quando criada/alterada pelo fluxo novo
- o login aceita `username` ou `email`
- so `master` pode gerenciar usuarios admin

---

## 14. Como rodar localmente

### 14.1 Backend

```powershell
cd backend
npm install
npm start
```

### 14.2 Frontend

```powershell
cd frontend
npm install
npm run dev
```

### 14.3 Banco

1. criar o banco MySQL
2. importar `backend/database_schema.sql`
3. criar `backend/.env`
4. rodar migrations se o ambiente precisar de colunas novas

---

## 15. Scripts existentes

### 15.1 Frontend

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

### 15.2 Backend

- `npm start`

Observacao importante:

No estado atual do repositorio, os scripts abaixo existem no `package.json`, mas apontam para arquivos que nao estao no projeto:

- `npm run dev`
- `npm run dev:check`

Entao, para subir o backend com seguranca, use:

```powershell
npm start
```

---

## 16. Checklist de manutencao comum

### 16.1 Para trocar banner da home

1. entrar no admin
2. abrir `Banners`
3. subir a nova imagem
4. conferir link e ordem

Arquivos envolvidos:

- `frontend/src/pages/Admin/AdminBanners/`
- `backend/src/server/routes/bannerRoutes.js`

### 16.2 Para criar categoria ou subcategoria

1. entrar no admin
2. abrir `Categorias`
3. criar categoria principal ou subcategoria

Arquivos envolvidos:

- `frontend/src/pages/Admin/AdminCategories/`
- `backend/src/server/routes/categoryRoutes.js`

### 16.3 Para cadastrar produto

1. entrar no admin
2. abrir `Cadastro de Produtos`
3. preencher dados, imagens, categorias e tabs

Arquivos envolvidos:

- `frontend/src/pages/Admin/AdminProducts/`
- `backend/src/server/routes/productRoutes.js`

### 16.4 Para mudar textos/logo de Upcera, Scanners, Impressoras ou Talmax Digital

1. entrar no admin
2. abrir a pagina especial correspondente
3. alterar texto e logo

Arquivos envolvidos:

- `frontend/src/pages/Admin/AdminUpcera/`
- `frontend/src/pages/Admin/AdminScanners/`
- `frontend/src/pages/Admin/AdminPrinters/`
- `frontend/src/pages/Admin/AdminTalmaxDigital/`
- `backend/src/server/routes/pageSettingsRoutes.js`

### 16.5 Para criar uma pagina nova do tipo `/pagina/:slug`

1. entrar no admin
2. abrir `Paginas Personalizadas`
3. definir titulo, slug, layout, imagens e produtos

Arquivos envolvidos:

- `frontend/src/pages/Admin/AdminCustomPages/`
- `frontend/src/components/CustomPage/`
- `backend/src/server/routes/customPageRoutes.js`

### 16.6 Para criar um grupo digital do tipo `/grupo-digital/:slug`

1. entrar no admin
2. abrir `Grupo de Segmentos`
3. cadastrar grupo, slug, logo e cards

Arquivos envolvidos:

- `frontend/src/pages/Admin/AdminTalmaxDigital/AdminDigitalGroups.jsx`
- `frontend/src/components/TalmaxDigital/DigitalGroupPage.jsx`
- `backend/src/server/routes/digitalGroupRoutes.js`

### 16.7 Para criar ou editar usuario admin

1. entrar com usuario `master`
2. abrir `Usuarios Admin`
3. cadastrar ou editar nome, e-mail, usuario, senha e role

Arquivos envolvidos:

- `frontend/src/pages/Admin/AdminUsers/`
- `backend/src/server/auth/adminSession.js`
- tabela `users`

---

## 17. Arquivos que mais valem conhecer

Se precisar entender o projeto rapido, estes sao os arquivos mais importantes:

- `frontend/src/App.jsx`
- `frontend/src/components/Home/Home.jsx`
- `frontend/src/components/ProductCatalog/ProductCatalog.jsx`
- `frontend/src/components/ProductDetail/ProductDetail.jsx`
- `frontend/src/components/CustomPage/CustomPage.jsx`
- `frontend/src/components/TalmaxDigital/DigitalGroupPage.jsx`
- `frontend/src/pages/Admin/AdminDashboard.jsx`
- `frontend/src/context/AdminContext.jsx`
- `backend/server.js`
- `backend/src/server/app.js`
- `backend/src/server/auth/adminSession.js`
- `backend/src/server/routes/productRoutes.js`
- `backend/src/server/routes/categoryRoutes.js`
- `backend/src/server/routes/bannerRoutes.js`
- `backend/src/server/routes/pageSettingsRoutes.js`
- `backend/src/server/routes/customPageRoutes.js`
- `backend/src/server/routes/digitalGroupRoutes.js`
- `backend/src/server/routes/homeServiceRoutes.js`
- `backend/database_schema.sql`

---

## 18. Resumo final

O projeto hoje tem:

- site institucional publico
- catalogo de produtos
- paginas especiais
- paginas personalizadas
- grupos digitais
- painel administrativo completo
- login admin com permissao por perfil
- banco MySQL
- upload de imagens local/remoto

O melhor ponto de partida para qualquer alteracao costuma ser:

1. `frontend/src/App.jsx` se a mudanca for estrutural no site
2. `frontend/src/pages/Admin/AdminDashboard.jsx` se a mudanca for no painel
3. `backend/src/server/app.js` se a mudanca for de rota/API
4. `backend/database_schema.sql` se a mudanca for estrutural no banco
