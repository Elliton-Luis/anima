# Análise — Exame de Consciência (PWA offline)

> Gerado em 2026-08-30. Código auditado em `index.html:1`, `js/app.js:1`, `js/storage.js:1`, `js/content.js:1`, `sw.js:1`, `css/style.css:1`, `manifest.json:1`.

---

## 1. Como cada parte da aplicação funciona

### 1.1 `index.html` — Estrutura e navegação por views

PWA vanilla sem build. Um único `index.html:32` com 6 seções (`view-home`, `view-intro`, `view-exam`, `view-conclusion`, `view-prayers`, `view-about`) alternadas via `class="hidden"`/`hidden` em `js/app.js:25` (`showView()`). Nenhum roteamento por URL/Hash com dado sensível — progresso fica só em `localStorage` (`anima:progress`). CSP via `<meta http-equiv>` em `index.html:8`, `referrer=no-referrer` `index.html:9`.

**Home** `index.html:34`: hero + 3 CTAs (`btn-start-completo/rapido/diario` → `startExam()`), card `home-continue-wrap` se `Storage.getProgress()` existir, links para Orações/Sobre.

**Intro** `index.html:75`: texto preparatório estático, `btn-intro-begin` → `beginExam()` que restaura `sectionIndex` salvo ou 0 e chama `renderExam()`.

**Exame** `index.html:96`: topbar com progresso (`#exam-progress`), drawer de seções (`#sections-list`), header (`#exam-kicker/title/desc`), container `#exam-questions` gerado dinamicamente, nav Anterior/Próxima, `toggle-notes` (opt-in) e `#btn-clear-exam`.

**Conclusão** `index.html:135`: lista `conclusion-marked` com itens `confess`, ações imprimir/apagar, botões para Ato de Contrição e `wipeAll`.

**Orações** `index.html:170`: tabs PT/LA (`data-lang`), 3 `prayer-card` com `data-prayer` preenchidos via `PRAYERS[lang]` usando `textContent` (`js/app.js:98`).

**Sobre** `index.html:201`: texto privacidade + `pin-card` (`#pin-setup/unlock/manage`) para proteção local opcional, `#btn-wipe-all-about`.

**Footer** `index.html:261`, **overlay privacidade** `index.html:267` (`#privacy-overlay` hidden por padrão), **saída rápida** `index.html:275` (`#btn-quick-exit` + `#quick-exit-view`), **modal** `index.html:282`.

### 1.2 `js/content.js` — Conteúdo doutrinal estático

`content.js:2` exporta `EXAM_CONTENT` (3 exames) e `PRAYERS`. Nenhum `fetch`/`import` dinâmico — 100% offline.

- `completo`: 7 seções (`relacao-deus` 12q, `proximo` 13q, `vida-pessoal` 12q, `deveres` 12q, `omissoes` 12q, `virtudes` 12q, `revisao` 6q) ≈79 perguntas.
- `rapido`: 1 seção 8q; `diario`: 1 seção 7q.
- Cada `section` tem `id/title/desc/questions[]`. Perguntas são strings puras sem HTML.
- `PRAYERS` com `pt/la` para `contricao/espirito/confiteor`. Renderizado sempre via `textContent` (`js/app.js:98`), nunca `innerHTML`.

### 1.3 `js/storage.js` — Persistência local isolada + cifra opcional

Wrapper `Storage` (`storage.js:15`) com prefixo `anima:` e objeto `safe` (`get/set/remove`) com `try/catch`. Chaves auditadas (`storage.js:3-13`):

| Chave | Sensível | Cifrada |
|-------|----------|---------|
| `anima:prefs` (`theme/prayerLang`) | não | não |
| `anima:progress` (`examId/sectionIndex`) | não | não |
| `anima:notesEnabled` | não | não |
| `anima:pinSalt/pinCheck` | não (metadado) | — |
| `anima:state:{exame}` (`marks/notes`) | **sim** | **sim se PIN ativo** |

- **Prefs/Progress** (`storage.js:211-235`): `JSON.parse/stringify`, `savePrefs` mescla com atual.
- **Notes flag** (`storage.js:237`): `"1"` ou ausente.
- **State** (`storage.js:245`): forma `{marks:{ "sec:idx": "none"/"reflect"/"confess"}, notes:{ "sec:idx": string}}`. `slice(0,2000)` limita nota.
- **Crypto** (`storage.js:57-82`): `deriveKey(pin, salt)` via `PBKDF2 120k SHA-256 → AES-GCM 256`; `encryptString` gera `iv 12B` + `cipher` em `b64(iv).b64(cipher)`; `decryptString` inverso. Salt `16B` aleatório (`crypto.getRandomValues`). `PIN_CHECK_PLAINTEXT = "anima-pin-check"` cifrado como teste de senha.
- **PIN lifecycle** (`storage.js:89-209`): `isPinEnabled()` checa `pinSalt && pinCheck`; `_cryptoKey` em memória (sessão). `enablePin` cria salt/key/check e recifra estados de texto puro; `unlockPin` deriva e decifra check; `disablePin`/`changePin` decifram e voltam a texto puro ou novo salt. `getState` síncrono retorna `_locked:true` se bloqueado; `getStateAsync` decifra com `await`.
- **Wipe** (`storage.js:363-383`): `clearState/clearAllStates/clearAll/wipeEverything` removem por prefixo; `wipeEverythingWithCaches` além disso faz `caches.keys() + caches.delete()` para SW.
- **Quota** (`storage.js:27`): `set` captura `QuotaExceededError` e relança `Error("QuotaExceededError")` sem logar `val` (conteúdo da nota nunca em `console`).

### 1.4 `js/app.js` — Estado, render e privacidade

IIFE `app.js:5`, sem rede (`fetch/XHR/WebSocket` ausentes), sem `innerHTML` com dado usuário.

- **Helpers** `app.js:6`: `$`/`$$`, `views` map, `currentExamId/currentSection/cachedStates/isPinLocked`.
- **`showView()`** `app.js:25`: alterna `hidden`, `scrollTo(0,0)`, atualiza `home-continue` e `pinUI`.
- **`showStorageError()`** `app.js:38`: toast `#storage-error` genérico, sem expor nota, auto-hide 6s.
- **Tema** `app.js:59`: `applyTheme()` lê `Storage.getPrefs().theme` (`auto/light/dark`) + `matchMedia`, seta `data-theme` e `meta theme-color`; `toggleTheme()` cicla.
- **Orações** `app.js:88`: `renderPrayers()` preenche `.prayer-body` via `textContent`.
- **Estado exame** `app.js:105`: `loadExamState` (`Storage.getStateAsync`), cache `cachedStates[examId]`; `getCachedState` fallback síncrono; `getMark/setMark` e `getNote/setNote` (`app.js:125-168`) operam no cache e persistem via `Storage.saveState` (Promise) com `QuotaExceededError → showStorageError()`. Nota `slice(0,2000)`.
- **`renderExam()`** `app.js:170` (async): header, drawer seções (botões `active`), `#exam-questions` com `createElement/textContent` para cada pergunta (`q-text`, `q-actions` com 3 `q-btn`, `aria-pressed`), `textarea.q-note` com `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"` `app.js:271`, debounce 300ms `setNote`. Se `_locked`, mostra `intro-warn` e desabilita botões.
- **`updatePinHint()`** `app.js:301`: texto explícito "não protegidas por senha" vs "proteção ativa".
- **`next/prevSection`** `app.js:312`, **`showConclusion()`** `app.js:331` (coleta `confess`, monta `li` via `createElement/textContent`, nota `slice(0,500)`), **`start/begin/continueExam`** `app.js:387-424`, **`openModal/closeModal`** `app.js:426`.
- **`wipeCurrentExam/wipeAll`** `app.js:443-463`: `wipeAll` chama `Storage.wipeEverythingWithCaches()` (limpa SW cache).
- **PIN UI** `app.js:466`: `updatePinUI()` alterna `#pin-setup/unlock/manage` conforme `isPinEnabled/isUnlocked`.
- **Saída rápida** `app.js:492`: `triggerQuickExit()` mostra `#quick-exit-view` neutra; `Esc` em `app.js:649` fecha modal→drawer→quickExit ou ativa quickExit se em exame. Botão fixo `#btn-quick-exit` `index.html:275`.
- **`bind()`** `app.js:510`: todos os listeners (tema, navegação, toggle-notes, clear, print, wipe, tabs, PIN enable/unlock/lock/disable com `prompt` para desativar). `visibilitychange` `app.js:670`: mostra `#privacy-overlay` quando `document.hidden===true` (mitiga miniatura multitarefa). Registra SW `navigator.serviceWorker.register("sw.js")` `app.js:695` (silencioso se `file://`).

### 1.5 `sw.js` — Cache offline estático

`sw.js:1`: cache `anima-v1`, `ASSETS = ["./","index.html","manifest.json","css/style.css","js/app.js","js/content.js","js/storage.js","icons..."]`. `install` `sw.js:21` faz `c.addAll(ASSETS) + skipWaiting`; `activate` `sw.js:27` remove caches antigos; `fetch` `sw.js:35` só `GET` same-origin, `caches.match` → `fetch` → `shouldCache` (`ASSETS.some(path.endsWith...)`) e só então `c.put`. Comentário explícito `sw.js:1` garante nunca cachear dado usuário; wipe em `storage.js:375` limpa tudo.

### 1.6 `manifest.json` + `css/style.css`

`manifest.json:1`: `name "Exame de Consciência"`, `display standalone`, `start_url index.html`, `icons 192/512`.

`style.css:1`: variáveis `--bg/card/text/muted/accent/...` + temas `prefers-color-scheme:dark` e `data-theme`. Corrige contraste dark com `--on-accent/--on-danger` (ex: `btn-primary` `css/style.css:160` usa `var(--on-accent)`). Layout mobile-first, `q-card`, `modal`, `privacy-overlay` blur, `quick-exit` fixo, `storage-error` toast, `pin-card`.

---

## 2. Principais vulnerabilidades (com severidade e onde mitigar)

### Crítico / Alto

**V1 — Dados sensíveis em texto puro por padrão (`localStorage` sem cifra)**
- Local: `storage.js:321` (`!isPinEnabled → JSON.stringify` puro), `app.js:130` cache em memória.
- Impacto: qualquer pessoa com acesso físico ao perfil do navegador, extensão maliciosa ou XSS lê `anima:state:*` (pecados/notas) via DevTools/`localStorage.getItem`. Sem PIN, nenhuma confidencialidade em repouso.
- Mitigação atual: cifra opt-in `js/storage.js:69`; aviso `#notes-pin-hint` "não protegidas". Recomendação: alertar no onboarding, considerar cifra por padrão ou pelo menos `sessionStorage` efêmero.

**V2 — PIN fraco e sem rate-limit; bypass por deleção**
- Local: `storage.js:68` `iterations 120000` OK, mas PIN mín 4 chars (`storage.js:122`, `app.js:593`), sem bloqueio após tentativas; `pinSalt/pinCheck` apagáveis via `localStorage.removeItem` faz app voltar a texto puro; `prompt()` em `app.js:625` sem proteção anti-brute.
- Impacto: PIN `0000` brute-forçável offline (salt conhecido, atacante com acesso ao arquivo pode testar offline). Apagar `pinSalt` destrói integridade sem wipe do resto.
- Mitigação: impor PIN ≥6, `iterations ≥310k` (OWASP), rate-limit + timeout exponencial, armazenar `salt` com `integrity` HMAC, não permitir texto puro se PIN já existiu sem wipar.

**V3 — Primeiro carregamento via HTTP permite injeção persistente de SW**
- Local: `sw.js:35` (`fetch` sem `integrity`), `README` alerta mas app aceita `http://`.
- Impacto: rede compartilhada/paroquial sem HTTPS → MITM injeta `sw.js` malicioso que persiste via `caches` e intercepta tudo.
- Mitigação: servir só `https://` (HSTS), `sw.js` registrar com `updateViaCache: none`, CSP `upgrade-insecure-requests`.

**V4 — CSP via `<meta>` não equivale a header**
- Local: `index.html:8` (`<meta http-equiv="Content-Security-Policy">`).
- Impacto: `meta` não protege `frame-ancestors` em todos browsers, pode ser injetada após carregamento, e `connect-src 'none'` não bloqueia SW `fetch` (SW tem escopo próprio). Header `Content-Security-Policy` no servidor é mais forte.
- Mitigação: enviar CSP como header HTTP + `X-Frame-Options DENY`.

### Alto

**V5 — Falta `Subresource Integrity` / verificação de integridade para hospedagem terceira**
- Local: `index.html:13-15` (`<script src="js/...">` sem `integrity`), `sw.js` sem hash verificado.
- Impacto: paróquia que redistribui código pode ter arquivos adulterados; usuário não detecta. `README` lista `sha256sum` mas não é enforcement.
- Mitigação: `integrity="sha256-..."` + `crossorigin` ou publicação de assinatura.

**V6 — Vazamento por backup do SO e teclado de terceiros fora do app**
- Local: `js/app.js:271` (`autocomplete off` etc.), `README` avisa iCloud/Google Backup.
- Impacto: `localStorage` copiado para nuvem do fabricante; teclado com predição envia digitação para servidor (atributo `autocomplete off` é hint, não garantia).
- Mitigação: documentado; alternativa é nunca persistir nota ou cifrar + não restaurar de backup.

**V7 — XSS latente se `textContent` for trocado por `innerHTML`**
- Local: `app.js:98/220/360` hoje usa `textContent/createElement` correto; `content.js` é confiável.
- Impacto: regressão futura com `innerHTML = note` permitiria injeção persistida via nota. `grep innerHTML` hoje só em comentários.
- Mitigação: manter `textContent`, adicionar ESLint `no-inner-html`, teste `grep -rn innerHTML js/` em CI.

### Médio

**V8 — `localStorage` não tem apagamento seguro**
- Local: `storage.js:345-374` (`removeItem`).
- Impacto: dado “apagado” pode permanecer em disco/SSD não sobrescrito, recuperável forenseamente. `QuotaExceededError` apenas notifica.
- Mitigação: sobrescrever antes de remover (`setItem(random)`), mas ainda não é garantido em SSD; orientar descarte físico.

**V9 — Overlay `visibilitychange` não impede screenshot de SO nem preview de app switcher em todos OS**
- Local: `app.js:670` (`#privacy-overlay`).
- Impacto: iOS/Android capturam snapshot antes do evento; overlay reduz mas não elimina miniatura.
- Mitigação: além de overlay, limpar DOM/tirar foco de `textarea` em `pagehide`, desabilitar `autofill`.

**V10 — Saída rápida só oculta, não limpa memória/disco**
- Local: `app.js:492` (`quick-exit-view`); `Esc` hide.
- Impacto: dado permanece em `cachedStates` e `localStorage`; atacante com acesso pós-saída rápida ainda lê via DevTools.
- Mitigação: `triggerQuickExit` também `Storage.lockPin() + cachedStates={} + blur inputs`.

**V11 — `cache` pode vazar pathname sensível se usuário imprime via `window.print()`**
- Local: `app.js:573` (`window.print()` da lista `confess`).
- Impacto: PDF gerado fica no histórico de impressão do SO, não controlado pelo app.
- Mitigação: aviso antes de imprimir, não incluir notas em print por padrão.

**V12 — Falta validação de tamanho/conteúdo no `savePrefs/progress`**
- Local: `storage.js:219/232` sem limite.
- Impacto: `localStorage` pollution pode causar DoS (quota) mesmo sem nota grande.
- Mitigação: limitar `JSON.stringify` e validar `examId` contra `EXAM_CONTENT`.

### Baixo / Informativo

**V13 — `file://` tem origem `null`, SW falha silencioso** (`app.js:695` `catch(()=>{})`) — usuário acha que está offline mas não está cacheado.
**V14 — `referrer no-referrer` `index.html:9` bom, mas sem `Permissions-Policy` para desabilitar geoloc/cam.**
**V15 — Sem `HttpOnly`/`Secure` porque não há cookies — OK, mas documentar.**
**V16 — Contraste corrigido (`--on-accent`) `css/style.css:13` mas ainda testar WCAG AA em todos botões `btn-ghost`/`sec-count`.**
**V17 — `prompt()` para desativar PIN `app.js:625` expõe PIN em UI síncrona e trava thread.**

---

#### O que está dentro vs fora do controle do app

- **Dentro:** CSP `default-src 'self'` + `connect-src 'none'`, `textContent`, opt-in notes, cifra PIN, wipe + `caches.delete`, overlay, `autocomplete off`, sem log de dado, sem rede.
- **Fora:** backup SO, teclado terceiro, malware/extensão com acesso a `localStorage`/`_cryptoKey` em RAM, acesso físico sem PIN, HTTP inicial, impressão PDF, recuperação forense pós-delete.
