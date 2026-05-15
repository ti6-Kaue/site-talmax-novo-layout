# Medidas de Seguranca e Performance Aplicadas no Site Talmax

Este documento foi feito em linguagem simples para explicar o que foi aplicado no projeto, por que isso existe e para que serve.

Importante:
- Este levantamento considera o estado atual do codigo em `2026-04-22`.
- Eu considerei tanto o que ja estava no projeto quanto as alteracoes locais recentes que aparecem no workspace.
- Quando uma medida ajuda seguranca e performance ao mesmo tempo, eu explico isso.

## 1. Visao Rapida

Pense no sistema assim:

```txt
Pessoa usuaria
   |
   v
Navegador
   |  -> headers de seguranca, cookies, consentimento de analytics
   v
Frontend React
   |  -> validacao basica, sanitizacao, lazy loading, carregamento sob demanda
   v
API Express
   |  -> autenticacao, rate limit, CORS, bloqueio de origem suspeita, upload seguro
   v
Banco e storage
      -> SSL no banco, fingerprint no SFTP, cache de imagem, indices
```

Resumo bem simples:
- Seguranca = impedir acesso indevido, arquivos perigosos, links maliciosos e abuso de login.
- Performance = fazer o site abrir mais rapido, usar menos dados e evitar trabalho desnecessario no servidor e no navegador.

## 2. Mudancas Recentes Identificadas

Estas foram as mudancas mais claras que apareceram nas alteracoes atuais do projeto:

| # | Mudanca | O que mudou | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | Analytics depois do consentimento | O script saiu do HTML fixo e passou a carregar so depois do aceite | Evita rastreamento antes da permissao |
| 2 | Banner de cookies centralizado | A escolha da pessoa fica salva e o sistema reage a ela | Evita analytics ligado sem permissao |
| 3 | Politica de Privacidade ajustada | O texto ficou mais alinhado ao uso real dos cookies | Melhora transparencia e LGPD |
| 4 | CSP mais rigida para scripts | Saiu a permissao de script inline com `unsafe-inline` | Reduz risco de XSS |
| 5 | Cookie admin limitado a `/api` | O cookie de sessao circula em menos rotas | Diminui exposicao desnecessaria |
| 6 | Erro generico no login | A resposta nao revela se o usuario existe | Evita enumeracao de usuarios |
| 7 | Hash falso para usuario inexistente | O tempo de resposta fica mais parecido | Dificulta ataque por diferenca de tempo |
| 8 | Logout com invalidacao de sessao | Tokens antigos deixam de valer com mais seguranca | Evita reaproveitamento de sessao |

## 3. Glossario Rapido

Antes da lista completa, aqui vai um mini dicionario:

- `CORS`: e o porteiro que decide quais sites podem falar com a API.
- `CSP`: e uma lista de fontes permitidas para scripts, imagens, iframes e estilos.
- `HTTP-only cookie`: cookie que o JavaScript da pagina nao consegue ler.
- `SameSite`: regra que ajuda o navegador a nao mandar cookie em contexto indevido.
- `Rate limit`: trava que limita repeticao de tentativas.
- `Sanitizacao`: limpeza de texto, link ou caminho para remover partes perigosas.
- `Cache`: guardar uma copia temporaria para nao baixar ou recalcular tudo de novo.
- `Lazy loading`: carregar so quando for realmente precisar.

## 4. Medidas de Seguranca

### 4.1 Protecao do navegador e da resposta HTTP

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | `Helmet` no backend | Adiciona cabecalhos de seguranca automaticamente | O navegador bloqueia mais coisas perigosas por padrao |
| 2 | `Content-Security-Policy` | Limita de onde scripts, imagens, fontes e iframes podem vir | Evita codigo vindo de lugar suspeito |
| 3 | `frameAncestors 'none'` | Impede o site de abrir dentro de iframe de outro dominio | Ajuda contra clickjacking |
| 4 | `objectSrc 'none'` | Bloqueia objetos embutidos antigos | Reduz superficie de ataque |
| 5 | `referrerPolicy: strict-origin-when-cross-origin` | Limita quanta informacao da URL vai para outro site | Protege navegacao da pessoa |
| 6 | `app.disable('x-powered-by')` | Esconde que a API usa Express | Evita entregar detalhe tecnico desnecessario |

Explicacao leiga:
- E como colocar regras na portaria do navegador antes mesmo de qualquer script rodar.

### 4.2 Controle de origem e protecao contra chamada indevida

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | Lista de origens permitidas no CORS | So dominios autorizados fazem chamadas com credenciais | Evita uso indevido da API por outros sites |
| 2 | Liberacao controlada no ambiente local | Permite `localhost`, IP privado e `.local` em desenvolvimento | Facilita teste sem abrir demais em producao |
| 3 | `requireTrustedWriteOrigin` | Confere `Origin` ou `Referer` em escritas da API | Diminui risco de CSRF |
| 4 | `trust proxy` configuravel | Ajusta IP e protocolo corretos atras de proxy | Faz protecoes de IP e HTTPS funcionarem direito |

Explicacao leiga:
- Aqui o sistema verifica se a chamada veio mesmo de um endereco confiavel e nao de um site aleatorio tentando se passar pelo seu.

### 4.3 Sessao, login e permissao do admin

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | Cookie admin `httpOnly` | O JavaScript da pagina nao le a sessao | Dificulta roubo de cookie por script |
| 2 | `SameSite` no cookie | Restringe envio do cookie entre sites | Ajuda contra envio indevido de sessao |
| 3 | `secure` no cookie | Obriga uso mais seguro do cookie | Evita trafego sensivel em contexto inseguro |
| 4 | Cookie com `path=/api` | Restringe o cookie ao trecho que realmente usa sessao | Menor exposicao do cookie |
| 5 | JWT assinado com HMAC SHA-256 | Detecta alteracao indevida do token | Garante integridade da sessao |
| 6 | Verificacao de expiracao | Sessao antiga deixa de valer | Reduz uso prolongado indevido |
| 7 | `timingSafeEqual` | Compara assinatura e senha sem entregar pista pelo tempo | Dificulta ataque por tempo |
| 8 | Perfis `master` e `editor` | Nem todo admin pode tudo | Aplica menor privilegio |
| 9 | `requireAdminSession` e `requireMasterAdminSession` | Protege rotas sensiveis | Sem autenticacao, nao entra |
| 10 | `session_version` no usuario | Invalida token antigo quando senha ou papel mudam | Logout e troca de senha ficam mais fortes |
| 11 | Logout incrementando `session_version` | Encerra a sessao atual de forma mais segura | Token antigo deixa de servir |
| 12 | Login por usuario ou e-mail | Permite mais de uma forma de acesso valida | Conveniencia com regra centralizada |
| 13 | Mensagem generica no login | Nao revela se o usuario existe | Evita enumeracao de contas |
| 14 | Hash falso para usuario inexistente | Mantem resposta parecida com a de usuario real | Dificulta ataque por medicao de tempo |

Explicacao leiga:
- O painel nao fica protegido so por "ter senha". Ele tem regra de sessao, tempo de validade, perfil de acesso e invalida token antigo quando precisa.

### 4.4 Senha e resistencia a ataque de login

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | Hash de senha com `scrypt` | A senha nao fica salva em texto puro | Mesmo com vazamento de banco, a senha nao sai pronta |
| 2 | Salt aleatorio por senha | Senhas iguais geram hashes diferentes | Dificulta ataques em lote |
| 3 | Rate limit persistido no banco | O bloqueio continua mesmo apos reinicio | Mantem protecao firme em producao |
| 4 | Controle por usuario, e-mail e IP | Fecha varias portas de ataque automatizado | Dificulta forca bruta |
| 5 | Resposta `429` com `retry_after_seconds` | Informa o tempo de espera | Evita repeticao agressiva |
| 6 | Bloqueio temporario do usuario | Painel e API ficam alinhados no estado do bloqueio | Facilita operacao e suporte |
| 7 | Desbloqueio so por admin master | Nem todo mundo pode liberar conta travada | Mantem governanca do acesso |
| 8 | Contador visual no login | Mostra o tempo restante de espera | Melhora usabilidade |

Explicacao leiga:
- E como uma fechadura que trava por alguns minutos depois de varias tentativas erradas.

### 4.5 Validacao e limpeza de dados

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | Validacao com `Zod` | Confere formato e tipo do dado | Evita lixo e erro entrando no sistema |
| 2 | `.strict()` nos schemas | Bloqueia campos extras | Evita payload escondido |
| 3 | Validacao por contexto | Cada tela aceita so o que deveria aceitar | Reduz erro humano e abuso |
| 4 | Sanitizacao de texto | Remove tags, comentarios e lixo | Evita conteudo perigoso ou quebrado |
| 5 | Sanitizacao de link | Recusa `javascript:`, `data:`, `file:` e link malformado | Evita link malicioso |
| 6 | Sanitizacao de imagem | Aceita so caminho e URL validos | Evita referencia estranha quebrando a pagina |
| 7 | Sanitizacao no frontend tambem | Limpa antes de exibir e reaproveitar | Cria dupla camada de protecao |
| 8 | Normalizacao de slug | Deixa URL limpa e previsivel | Evita endereco quebrado |
| 9 | Validacao de e-mail, usuario, senha e papel | Impede cadastro incoerente | Melhora seguranca e qualidade do dado |

Explicacao leiga:
- O sistema nao confia cegamente no que foi digitado. Ele primeiro limpa e depois confere.

### 4.6 Upload de imagem com protecao

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | Lista de formatos permitidos | So aceita `JPG`, `JPEG`, `PNG`, `WEBP` e `GIF` | Fecha caminho para arquivos mais perigosos |
| 2 | Limite de tamanho | Bloqueia upload exagerado | Evita abuso e sobrecarga |
| 3 | Limite de quantidade | Impede envio em massa na mesma requisicao | Protege servidor e disco |
| 4 | Nome higienizado | Remove caracteres estranhos do nome original | Evita confusao de caminho |
| 5 | Sufixo aleatorio | Diminui colisao entre arquivos | Evita sobrescrita acidental |
| 6 | Verificacao de extensao e MIME type | Confere o que o arquivo diz ser | Filtra falsificacao simples |
| 7 | Leitura da assinatura real | Verifica o formato binario do arquivo | Evita arquivo disfarcado |
| 8 | Limpeza de temporario em erro | Apaga lixo quando algo falha | Mantem storage organizado |
| 9 | Restricao contra `..` | Impede escapar para outras pastas do servidor | Protege o sistema de arquivos |

Explicacao leiga:
- Nao basta o arquivo se chamar `foto.png`. O sistema abre um pedacinho dele para ver se ele e imagem mesmo.

### 4.7 Banco, infraestrutura e integridade

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | Credenciais via `.env` | Mantem segredos fora do codigo | Evita segredo hardcoded |
| 2 | SSL/TLS com `rejectUnauthorized: true` | Confere a autenticidade da conexao com o banco | Evita interceptacao e servidor falso |
| 3 | Leitura de CA, cert e key | Permite configuracao segura em varios ambientes | Flexibilidade sem perder seguranca |
| 4 | Fingerprint do host SFTP | Confere a identidade do servidor SFTP | Evita envio para servidor impostor |
| 5 | Indice unico para e-mail admin | Nao deixa duplicar identidade | Melhora integridade e busca |
| 6 | Slug unico em paginas e grupos | Evita colisao de URL publica | Enderecos ficam confiaveis |
| 7 | Chaves estrangeiras com `ON DELETE CASCADE` | Mantem relacao limpa entre tabelas | Evita dado orfao |

Explicacao leiga:
- Essas medidas evitam que o sistema converse com o servidor errado ou grave dados duplicados e incoerentes.

### 4.8 Logs, rastreio de erro e resposta segura

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | `X-Request-Id` por requisicao | Da um identificador unico a cada chamada | Facilita localizar erro |
| 2 | Handler centralizado de erro | Padroniza resposta e log de falha | Reduz vazamento tecnico |
| 3 | Mensagem generica em erro interno | Esconde detalhe sensivel do backend | O usuario ve so o necessario |
| 4 | Redacao de campos sensiveis | Mascara senha, token, cookie e chaves | Evita vazamento por log |
| 5 | Resumo controlado de upload | Registra o necessario sem expor demais | Ajuda suporte e investigacao |

Explicacao leiga:
- O sistema registra erro para a equipe, mas tenta nao entregar informacao sensivel para quem esta do lado de fora.

### 4.9 Privacidade e uso de analytics

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | Banner de consentimento | Pede uma escolha clara sobre cookies | Transparencia e LGPD |
| 2 | Consentimento salvo no navegador | Lembra a decisao da pessoa | Evita perguntar toda hora |
| 3 | Analytics so apos aceite | Nao mede antes da permissao | Privacidade primeiro |
| 4 | `anonymize_ip: true` | Reduz identificacao do acesso | Coleta menos sensivel |
| 5 | `ad_storage`, `ad_user_data` e `ad_personalization` negados | Bloqueia uso para publicidade personalizada | Coleta mais enxuta |

Explicacao leiga:
- O site continua funcionando sem analytics. A medicao so entra depois da autorizacao.

## 5. Medidas de Performance

### 5.1 Backend e entrega de arquivos

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | Compressao HTTP (`compression`) | Diminui o tamanho das respostas de texto | API e arquivos textuais viajam mais rapido |
| 2 | Pulo de compressao em imagem ja comprimida | Evita trabalho inutil de CPU | Nao gasta recurso sem ganho real |
| 3 | Cache longo para imagem principal | Guarda a imagem por muito tempo no navegador | Melhora visitas repetidas |
| 4 | `immutable` na imagem principal | Diz que o mesmo nome nao vai mudar | Evita revalidacao desnecessaria |
| 5 | Cache para imagem estatica e placeholder | Reaproveita download em visitas seguintes | Site abre mais rapido |
| 6 | Placeholder SVG para falta de imagem | Evita quebra visual quando o arquivo nao existe | Melhor experiencia |

Explicacao leiga:
- Em vez de baixar tudo sempre de novo, o navegador reaproveita o que ainda vale.

### 5.2 Frontend e carregamento visual

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | `React.lazy` e `Suspense` | Carrega modulo so quando a pessoa entra | Reduz peso inicial do site |
| 2 | Carregamento sob demanda na Home | Carrega secoes quando estao chegando na tela | A primeira dobra abre mais leve |
| 3 | `IntersectionObserver` | Observa quando a secao esta perto de aparecer | Evita baixar cedo demais |
| 4 | `loading="lazy"` nas imagens | Deixa imagem fora da vista esperar | Economiza dados e acelera abertura |
| 5 | `decoding="async"` | Decodifica imagem de forma menos bloqueante | Interface mais fluida |
| 6 | `fetchPriority="high"` no hero | Prioriza a primeira imagem importante | Melhora percepcao de velocidade |
| 7 | `fetchPriority="low"` nas demais | Faz imagem secundaria esperar mais | Usa melhor a banda |
| 8 | `preconnect` para Google Fonts | Abre conexao antes da fonte ser pedida | Reduz atraso do texto |
| 9 | Uso forte de `WEBP` | Entrega imagem menor com qualidade boa | Carregamento mais rapido |

Explicacao leiga:
- O site tenta mostrar primeiro o que a pessoa precisa ver agora e deixa o resto para depois.

### 5.3 Controle de requisicao e fluidez da interface

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | `AbortController` nas buscas | Cancela pedido antigo quando a tela muda | Evita trabalho desperdicado |
| 2 | `requestAnimationFrame` | Atualiza scroll e medicao no ritmo certo do navegador | Interface mais suave |
| 3 | Loader com atraso controlado | So aparece quando realmente precisa | Evita pisca-pisca desnecessario |
| 4 | Pequeno atraso antes da busca | Nao dispara requisicao cedo demais | Reduz chamadas desnecessarias |
| 5 | Limite de 10 sugestoes | Mantem o dropdown enxuto | Resposta visual mais rapida |

Explicacao leiga:
- O sistema evita fazer varias coisas ao mesmo tempo sem necessidade.

### 5.4 API, banco e consulta

| # | Medida | O que faz | Beneficio pratico |
| --- | --- | --- | --- |
| 1 | Paginacao defensiva na API | Devolve so um pedaco da lista | Evita resposta gigante |
| 2 | Limite maximo de `60` por pagina | Bloqueia consulta exagerada | Protege servidor e resposta |
| 3 | Filtros de busca e categoria | Reduz o conjunto retornado | Traz so o necessario |
| 4 | Pool de conexao MySQL | Reaproveita conexoes com o banco | Menos custo por requisicao |
| 5 | `keepAlive` no pool | Mantem conexoes prontas | Ajuda estabilidade e tempo de resposta |
| 6 | Indices em tabelas de relacao e controle | Acelera campos usados com frequencia | Menos tempo para localizar dado |
| 7 | Indices em rate limit e `abas_produto` | Acelera leituras comuns dessas areas | Melhora consulta recorrente |

Explicacao leiga:
- Aqui a ideia e nao pedir para o banco procurar tudo "na unha" toda vez.

## 6. O Que Cada Grupo Evita na Pratica

### 6.1 Se estas medidas nao existissem

| # | Grupo | Risco sem a medida |
| --- | --- | --- |
| 1 | Sessao e cookie | Roubo de sessao ficaria mais facil |
| 2 | Rate limit de login | Robo poderia tentar milhares de senhas |
| 3 | Sanitizacao | Link malicioso ou conteudo quebrado poderia ir para o site |
| 4 | Validacao de upload | Arquivo disfarcado poderia entrar no servidor |
| 5 | CORS e origem confiavel | Outro site poderia tentar usar a API em nome da pessoa logada |
| 6 | Headers de seguranca | O navegador teria menos ajuda para bloquear comportamento perigoso |
| 7 | Cache, lazy loading e compressao | O site abriria mais pesado e gastaria mais dados |

## 7. Observacoes Honestas

Nem tudo e "perfeito", entao vale registrar os pontos com transparencia:

- A API publica de produtos ja suporta paginacao e limite maximo, mas o catalogo publico do frontend ainda baixa a lista inteira em algumas telas e pagina no navegador. Ou seja: a protecao existe na API, mas ainda ha espaco para usar isso melhor no front.
- Eu nao encontrei um token CSRF separado. A protecao usada aqui e combinacao de `SameSite`, cookie `httpOnly`, CORS e verificacao de origem confiavel. Isso ajuda bastante, mas e bom saber exatamente qual estrategia esta em uso.
- O `DOCUMENTO_GERAL.md` diz que upload aceita `SVG`, mas o codigo atual de validacao permite `JPG`, `JPEG`, `PNG`, `WEBP` e `GIF`. Na pratica, isso e mais seguro do que liberar SVG.
- Em `Helmet`, scripts inline foram endurecidos, mas estilos inline ainda continuam permitidos por compatibilidade (`style-src 'unsafe-inline'`).

## 8. Arquivos Mais Importantes Para Estas Medidas

Se voce quiser mostrar de onde saiu cada explicacao, estes sao os arquivos principais:

- `backend/src/server/app.js`
- `backend/src/server/seguranca/helmet.js`
- `backend/src/server/seguranca/trustProxy.js`
- `backend/src/server/seguranca/trustedWriteOrigin.js`
- `backend/src/server/seguranca/adminLoginRateLimit.js`
- `backend/src/server/auth/adminSession.js`
- `backend/src/server/auth/adminPassword.js`
- `backend/src/server/config/cors.js`
- `backend/src/server/config/performance.js`
- `backend/src/server/config/upload.js`
- `backend/src/server/config/imageStorage.js`
- `backend/src/server/utils/uploadedImageValidation.js`
- `backend/src/server/utils/inputSanitization.js`
- `backend/src/server/utils/errorHandling.js`
- `backend/src/config/database.js`
- `backend/src/server/services/fileStorageService.js`
- `frontend/src/App.jsx`
- `frontend/src/services/analytics.js`
- `frontend/src/services/cookieConsent.js`
- `frontend/src/components/CookieBanner/CookieBanner.jsx`
- `frontend/src/components/PrivacyPolicy/PrivacyPolicy.jsx`
- `frontend/src/hooks/useDeferredSection.js`
- `frontend/src/components/Home/Home.jsx`
- `frontend/src/pages/Admin/AdminDashboard.jsx`
- `frontend/src/components/HeroSlider/HeroSlider.jsx`
- `frontend/src/components/ProductCard/ProductCard.jsx`
- `frontend/src/components/AdminLogin/AdminLogin.jsx`

## 9. Fechamento em Linguagem Bem Simples

Se eu resumisse tudo em poucas frases:

- A parte de seguranca foi pensada para proteger login, sessao, origem da requisicao, arquivos enviados e conteudo digitado.
- A parte de performance foi pensada para fazer o site carregar menos coisa de uma vez, reaproveitar cache e evitar downloads e processamentos desnecessarios.
- As mudancas mais novas reforcam principalmente privacidade, endurecimento do navegador e seguranca da sessao admin.

Em outras palavras:
- seguranca = "quem pode entrar, o que pode enviar e de onde pode chamar"
- performance = "o que precisa carregar agora, o que pode esperar e o que pode ser reaproveitado"
