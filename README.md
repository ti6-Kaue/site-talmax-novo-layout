# Site Talmax

Repositorio do site institucional e do painel administrativo da Talmax.

## Visao geral

O projeto tem duas aplicacoes principais:

- `frontend/`
  React 19 + Vite 8 + React Router 7 para o site publico e o painel.
- `backend/`
  Node.js + Express 5 + MySQL para autenticacao do admin, CRUD, paginas dinamicas e upload de imagens.

Arquitetura em alto nivel:

```txt
Frontend React
-> services do frontend
-> API Express em /api
-> MySQL + storage de imagens
```

Em producao o backend tambem serve:

- `frontend/dist`
- arquivos em `/img`

## O que o sistema faz

- publica o site da Talmax
- lista produtos, categorias e detalhes de produto
- entrega paginas especiais como Talmax Digital, Upcera, Scanners e Impressoras 3D
- permite criar paginas personalizadas em `/pagina/:slug`
- permite criar grupos digitais em `/grupo-digital/:slug`
- administra produtos, categorias, banners, destaques da home, segmentos, paginas especiais e configuracoes pelo painel
- aceita upload local, Cloudinary ou SFTP

## Estrutura do repositorio

```txt
site-talmax/
|-- backend/
|-- docs/
|   `-- explicacao/
|-- frontend/
|-- GEMINI.md
|-- KINGHOST_DEPLOY.md
`-- README.md
```

Arquivos centrais:

- `frontend/src/App.jsx`
  router principal, layout publico, busca e protecao da rota do admin
- `frontend/src/pages/Admin/AdminDashboard.jsx`
  estrutura do painel e selecao dos modulos internos
- `backend/server.js`
  bootstrap do backend
- `backend/src/server/app.js`
  middlewares, arquivos estaticos e montagem das rotas
- `backend/database_schema.sql`
  schema base do banco

## Frontend

Stack principal:

- React 19
- React Router 7
- Vite 8
- Mantine
- Framer Motion
- Lucide React

Rotas publicas principais:

- `/`
- `/privacidade`
- `/quem-somos`
- `/historia-diretoria`
- `/produtos`
- `/categoria/:slug`
- `/produto/:id`
- `/categoria/talmax-digital`
- `/grupo-digital/:slug`
- `/pagina/:slug`
- `/upcera`
- `/scanners`
- `/impressoras-3d`
- `/suporte`

Rotas do admin:

- `/admin/login`
- `/admin/painel`

Observacoes importantes:

- o frontend usa `VITE_API_URL` quando definido
- em desenvolvimento, o fallback da API usa a mesma maquina atual na porta `5000`
- `frontend/vite.config.js` usa `VITE_PUBLIC_BASE_PATH`
- neste repositorio, `frontend/.env.development` e `frontend/.env.production` fixam `/site-talmax/`, entao dev e build continuam usando esse prefixo

## Painel administrativo

O painel usa autenticacao por cookie HTTP-only e hoje concentra os seguintes modulos:

- dashboard
- categorias
- seguranca do login
- cadastro de produtos
- lista de produtos
- banners
- home destaques
- home segmentos
- paginas personalizadas
- grupo de segmentos
- Talmax Digital
- Upcera
- Scanners
- Impressoras 3D

Fluxo resumido:

```txt
AdminLogin
-> /api/admin/login
-> cookie talmax-admin-session
-> /admin/painel
-> services e hooks autenticados
```

## Backend

Stack principal:

- Express 5
- MySQL2
- Multer
- Cloudinary
- SSH2 SFTP Client
- Zod

Dominios principais da API:

- `/api/admin`
  login, sessao, logout e desbloqueio de tentativas
- `/api/categories`
  CRUD de categorias e subcategorias
- `/api/banners`
  CRUD de banners da home
- `/api/products`
  CRUD de produtos, status ativo e botao de cotacao
- `/api/home-services`
  cards e segmentos da home
- `/api/page-settings`
  textos e logos das paginas especiais
- `/api/custom-pages`
  paginas dinamicas do site e CRUD do admin
- `/api/digital-groups`
  grupos digitais e CRUD do admin
- `/api/upcera/products`
- `/api/scanners/products`
- `/api/3d-printers/products`
- `/api/featured-products`

Observacoes importantes:

- rotas protegidas exigem sessao valida do admin
- o backend responde `index.html` para `GET` fora de `/api`
- imagens novas sao servidas a partir de `backend/storage/img` ou `UPLOAD_DIR`
- imagens legadas em `frontend/public/img` e `frontend/dist/img` continuam sendo servidas por compatibilidade

## Banco de dados

Schema base:

- `backend/database_schema.sql`

Tabelas ja presentes no schema base:

- `categorias`
- `sub_categorias`
- `produtos`
- `abas_produto`
- `banners`
- `users`
- `page_settings`
- `custom_pages`

Tambem existem evolucoes adicionais por migration ou runtime:

- `home_services`
- `digital_groups`
- `digital_group_cards`
- colunas extras em `produtos`, `users` e `home_services`

Os scripts de apoio ficam em:

- `backend/src/scripts/migrations/`

Seguranca:

- o SQL base nao cria usuario admin padrao
- o primeiro acesso deve ser criado via `ADMIN_BOOTSTRAP_*` no backend ou por um procedimento operacional controlado

## Variaveis de ambiente

Arquivo de referencia:

- `backend/.env.example`

Variaveis essenciais:

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SSL`
- `DB_SSL_CA` ou `DB_SSL_CA_PATH`
- `DB_SSL_CERT` ou `DB_SSL_CERT_PATH`
- `DB_SSL_KEY` ou `DB_SSL_KEY_PATH`
- `DB_SSL_SERVERNAME`
- `PORT`
- `NODE_ENV`
- `ADMIN_JWT_SECRET`
- `ADMIN_JWT_EXPIRES_IN_SECONDS`
- `CORS_ALLOWED_ORIGINS`
- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`

Variaveis opcionais de storage:

- `UPLOAD_DIR`
- `UPLOAD_MAX_FILE_SIZE_MB`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER`
- `SFTP_HOST`
- `SFTP_PORT`
- `SFTP_USER`
- `SFTP_PASSWORD`
- `SFTP_HOST_FINGERPRINT_SHA256` ou `SFTP_HOST_FINGERPRINT_MD5`
- `SFTP_REMOTE_DIR`
- `SFTP_PUBLIC_BASE_URL`

Variaveis opcionais para bootstrap do primeiro admin:

- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_FULL_NAME`

Observacoes:

- use `ADMIN_BOOTSTRAP_*` apenas em ambiente vazio para criar o primeiro admin com senha hasheada
- depois do primeiro login, remova essas variaveis do ambiente
- quando `DB_SSL` estiver ativo, o backend valida o certificado TLS do MySQL; para CA privada, configure `DB_SSL_CA` ou `DB_SSL_CA_PATH`
- quando o modo `SFTP_*` estiver ativo, configure tambem a fingerprint do host em `SFTP_HOST_FINGERPRINT_SHA256` ou `SFTP_HOST_FINGERPRINT_MD5`

Variavel opcional do frontend:

- `VITE_API_URL`

## Como rodar em desenvolvimento

1. Crie o banco MySQL.
2. Importe `backend/database_schema.sql`.
3. Crie `backend/.env` a partir de `backend/.env.example`.
4. Instale e suba o backend.
5. Instale e suba o frontend.

Backend:

```powershell
cd backend
npm install
npm start
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Scripts

Frontend:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

Backend:

- `npm start`
  unico script de subida confiavel no estado atual
- `npm run dev`
  referencia `setup-development.js`, que nao existe no repositorio atual
- `npm run dev:check`
  referencia `debug-storage.js`, que nao existe no repositorio atual

## Documentacao complementar

- [Resumo da documentacao](docs/explicacao/README.md)
- [Guia de deploy na KingHost](KINGHOST_DEPLOY.md)
- [Resumo do frontend](frontend/README.md)
- [Resumo do painel admin](frontend/src/pages/Admin/README.md)
- [Guia rapido para IA](GEMINI.md)
