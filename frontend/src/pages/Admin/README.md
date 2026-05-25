# Painel Admin

Resumo da area administrativa carregada em `/admin/painel`.

## Entrada e fluxo

- login em `/admin/login`
- validacao de sessao em `/api/admin/session`
- dashboard principal em `frontend/src/pages/Admin/AdminDashboard.jsx`
- estado compartilhado em `frontend/src/context/AdminContext.jsx`

Fluxo resumido:

```txt
AdminLogin
-> adminAuth.js
-> /api/admin/login
-> cookie talmax-admin-session
-> /admin/painel
```

## Como o painel e organizado

O painel nao usa subrotas internas por modulo. A troca entre telas acontece por estado local em `AdminDashboard.jsx`.

Modulos disponiveis hoje:

- `dashboard`
- `categories`
- `security`
- `products`
- `products-list`
- `banners`
- `featured`
- `segments`
- `custom-pages`
- `talmax-digital-carousels`

## Pastas principais

```txt
frontend/src/pages/Admin/
|-- AdminDashboard.jsx
|-- AdminBase.css
|-- AdminBanners/
|-- AdminCategories/
|-- AdminCustomPages/
|-- AdminFeatured/
|-- AdminProducts/
|-- AdminSecurity/
|-- AdminSegments/
|-- AdminSpecialSection/
`-- AdminTalmaxDigitalCarousels/
```

## Arquivos importantes

- `frontend/src/pages/Admin/AdminDashboard.jsx`
  layout principal, menu lateral, tabs e logout
- `frontend/src/context/AdminContext.jsx`
  dados globais, loading, erros e toasts
- `frontend/src/services/adminAuth.js`
  login, sessao e logout
- `frontend/src/services/adminRequest.js`
  requisicoes autenticadas

## Observacoes

- a rota protegida real do painel e `/admin/painel`
- o modulo `security` conversa com `/api/admin/login-unlock`
- o modulo Talmax Digital usa `/api/page-settings` para escolher as categorias dos carrosseis
