# Exame de Consciência

Aplicativo web **mobile-first** de Exame de Consciência católico — simples, privado, seguro e contemplativo. Instrumento sério para preparação à Confissão e para oração pessoal, sem diário, sem gamificação e sem coleta de dados.

> **O que acontece no exame permanece no dispositivo do usuário.**

## Propósito

Conduzir o usuário por um exame de consciência estruturado, fiel à doutrina católica, organizado e sóbrio, ajudando-o a reconhecer pecados, arrepender-se e preparar-se para a Confissão — sem substituir o sacerdote.

## Funcionalidades

- **Exame completo** — 7 seções (~70 perguntas) cobrindo Mandamentos, deveres de estado, pecados de omissão, virtudes e revisão final.
- **Exame rápido** — versão reduzida (8 perguntas) para revisão breve.
- **Exame diário** — 7 perguntas de revisão do dia (graça, pecados, omissões, gratidão, propósito).
- **Navegação serena** — avançar/voltar, saltar entre seções, progresso discreto (“3 de 12”), continuar de onde parou.
- **Marcação discreta** — por pergunta: *— / Para refletir / Levar à Confissão*. Sem nota, sem ranking, sem streak.
- **Anotações privadas opt-in** — desativadas por padrão, armazenadas só localmente, facilmente apagáveis, com aviso explícito. Campos com `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"` para reduzir sincronização com nuvem de teclados de terceiros.
- **Proteção local opcional por PIN** — desativada por padrão. Quando ativada, `anima:state:{exame}` é cifrado com Web Crypto API (PBKDF2 120k iterações + AES-GCM). Sem o PIN, leitura física do `localStorage` vê apenas texto cifrado. Se o usuário não configurar PIN, mantém texto puro com aviso explícito: “Suas notas não estão protegidas por senha neste dispositivo”.
- **Preparação para a Confissão** — lembretes de arrependimento, propósito de emenda e penitência.
- **Ato de Contrição** (PT/LA) + *Vinde Espírito Santo* e *Confiteor* em PT/LA, com alternância de idioma.
- **Tema claro/escuro**, responsivo, acessível (semântico, foco visível, teclado, leitores de tela).
- **PWA offline** — instalável, funciona sem internet após primeiro carregamento.
- **Saída rápida** — botão fixo “✕ Saída rápida” e atalho `Esc` que navega instantaneamente para tela neutra, útil se alguém entra no ambiente durante o exame.

## Privacidade

Este aplicativo:

- **Não possui backend, conta, login ou cadastro.**
- **Não possui analytics, cookies de rastreamento, publicidade ou serviços de terceiros.**
- **Não envia o que você marca ou escreve para a internet** — nenhum dado sai do dispositivo, nenhuma requisição de rede contém conteúdo do usuário (verificado na aba Network do DevTools: zero requisições durante exame completo, anotação e apagar dados).
- **Não utiliza CDNs, fontes externas, APIs externas ou telemetria.**
- **Não armazena respostas pessoais por padrão.** O fluxo principal é apenas leitura e reflexão mental.
- Anotações e marcações, quando ativadas, ficam somente em `localStorage` local e podem ser apagadas em **Apagar todos os meus dados** (com confirmação). Essa ação também limpa **Cache Storage do Service Worker** (`caches.keys()` + `caches.delete()` para todas as chaves) — testado manualmente: gravar dado → instalar SW → apagar → `caches.keys()` e `localStorage` vazios.
- `Content-Security-Policy` completa (ver seção abaixo), sem scripts externos, sem `unsafe-inline`.
- Ao sair da aba (`document.visibilitychange`), um overlay CSS borra/oculta a tela (`#privacy-overlay`) para reduzir risco de miniaturas de multitarefa exporem anotações sensíveis.

> Não fazemos alegações de segurança absoluta. O modelo documentado acima é o implementado; a privacidade depende também do dispositivo e do navegador do usuário.

### Content-Security-Policy (Fase 1)

Política final enviada via `<meta http-equiv="Content-Security-Policy">` em `index.html:8`:

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self';
font-src 'self';
connect-src 'none';
object-src 'none';
base-uri 'self';
form-action 'none';
frame-src 'none';
frame-ancestors 'none'
```

Varredura realizada (`grep -rn "innerHTML\|onclick=\|style=" js/ index.html`): nenhum `innerHTML` com dado do usuário, nenhum `onclick=` inline, nenhum `style=` inline. Scripts e estilos apenas em arquivos externos (`js/` e `css/`). Sem `unsafe-inline`, sem `unsafe-eval`. `frame-ancestors 'none'` + `frame-src 'none'` previne clickjacking; `form-action 'none'` bloqueia envio de formulários; `base-uri 'self'` evita injeção de `<base>`.

## Avisos importantes — fora do controle do app

### Backups automáticos do sistema operacional
Backups do SO (iCloud no iOS, Google Backup no Android, backups de desktop) **podem incluir dados do `localStorage`/`IndexedDB` e cópias do perfil do navegador**. Por essa via, dados podem sair do dispositivo mesmo sem o app enviar nada. Isso está fora do controle do app. Se isso é uma preocupação, revise as configurações de backup do seu SO/navegador e considere não ativar anotações ou ativar a proteção por PIN.

### In-app browsers (Instagram, TikTok, etc.)
Navegadores embutidos em apps de terceiros podem ter políticas de privacidade próprias, injetar scripts ou registrar histórico. **Recomenda-se abrir o link do exame no navegador padrão do sistema (Safari, Chrome, Firefox)** em vez de dentro de apps como Instagram, TikTok, Facebook ou WhatsApp.

### HTTPS obrigatório
O app **deve ser servido via HTTPS**, mesmo em uso local/paroquial. Servir via HTTP puro em rede compartilhada permite que um atacante na mesma rede injete um Service Worker malicioso no primeiro carregamento (ataque de persistência via SW). Nunca use HTTP em Wi-Fi público ou paroquial.

## Tecnologias

- HTML5, CSS3, JavaScript vanilla
- LocalStorage (mínimo necessário — preferências não sensíveis + estado opt-in)
- Web Crypto API — PBKDF2 + AES-GCM para cifra opcional de `anima:state:{exame}` quando PIN configurado
- PWA: `manifest.json` + Service Worker (`sw.js`)
- Sem frameworks, sem backend, sem banco remoto.

## Armazenamento local

| Chave | Conteúdo | Sensível? | Cifrado com PIN? |
|-------|----------|-----------|------------------|
| `anima:prefs` | tema, idioma de oração | não | não |
| `anima:progress` | exame atual e seção atual | não (apenas posição) | não |
| `anima:notesEnabled` | se anotações estão ativas | não | não |
| `anima:pinSalt` / `anima:pinCheck` | salt e verificação do PIN | não (metadado) | — |
| `anima:state:{exame}` | marcações e notas por pergunta | **sim — apenas se o usuário ativar** | **sim, quando PIN ativo (AES-GCM)** |

Nenhum dado sensível vai para URL, `console.log` ou cache do Service Worker. Todo `localStorage.setItem` está envolto em `try/catch`; em caso de `QuotaExceededError`, a UI mostra mensagem amigável sem nunca fazer `console.log(data)` ou `console.log(error)` com conteúdo da nota (ver `storage.js:15-22` e `app.js:showStorageError`). Teste manual: preencher nota muito longa até estourar cota → nada aparece no console com o conteúdo, usuário recebe feedback claro.

## Como executar

Sem build. Basta servir os arquivos estáticos via HTTPS (ou `http://localhost` para desenvolvimento).

```bash
# opção 1 — Python
python3 -m http.server 8000
# abrir http://localhost:8000

# opção 2 — npx
npx serve .
```

> Abrir via `file://` funciona para navegação, mas o Service Worker exige `http(s)`.

## Como instalar o PWA

1. Abra o app no navegador (Chrome, Edge, Firefox, Safari) via **HTTPS**.
2. No celular: menu → *Adicionar à tela inicial* / *Instalar aplicativo*.
3. No desktop (Chrome/Edge): ícone de instalação na barra de endereço.
4. Após instalado, funciona **offline**.

## Arquitetura

```
/
├── index.html
├── manifest.json
├── sw.js
├── css/style.css
├── js/
│   ├── content.js   # perguntas e orações (estático, offline)
│   ├── storage.js   # wrapper de LocalStorage com isolamento por prefixo + cifra opcional
│   └── app.js       # navegação, renderização, estado, privacidade
└── assets/icons/
    ├── icon-192.png
    └── icon-512.png
```

- `content.js` contém todo o conteúdo doutrinal offline — nenhum carregamento dinâmico de servidor.
- `storage.js` centraliza acesso a `localStorage` com tratamento de falha e prefixo `anima:`; quando PIN ativo, cifra `anima:state:*` com AES-GCM.
- `app.js` não usa `innerHTML` com dados do usuário; usa `textContent`/`createElement` exclusivamente (verificado com `grep -rn "innerHTML" js/`).
- `sw.js` faz cache **apenas** de assets estáticos listados em `ASSETS`; nunca de respostas dinâmicas com dado do usuário (comentário explícito em `sw.js:1-7` + lógica `shouldCache`).

### Integridade (SRI / hash) — Fase 4

Para distribuições por terceiros (paróquias reaproveitando o código), hashes SHA-256 dos arquivos críticos:

```
content.js: c3a03f5dd6ce90732719d1f03bbe7fe3a11f42162aac4e557d4f0ef35f232c99
sw.js:      822d885d637cc56b2b360c334ebc99680ac3f9f801a0da6a4be8a0b75d86f85c
```

Verificação manual: `sha256sum js/content.js sw.js` deve coincidir com acima. Se hospedado por terceiros via URL absoluta, considere adicionar `integrity="sha256-..."` (SRI).

## Modelo de ameaça e limitações conhecidas (Fase 6)

### O que o app protege
- Nenhum dado do usuário é enviado à rede (CSP `connect-src 'none'`, sem fetch/XHR, sem CDN/analytics).
- Sem `innerHTML` com dados do usuário → redução de XSS persistido.
- `localStorage` isolado por prefixo `anima:`; wipe completo remove localStorage + Cache Storage.
- PIN opcional cifra anotações em repouso contra leitura física do perfil do navegador.
- Overlay de privacidade reduz exposição em miniaturas de multitarefa.
- Saída rápida permite ocultar conteúdo instantaneamente.

### O que está fora do controle do app
- **Acesso físico ao dispositivo desbloqueado sem PIN**: sem PIN, qualquer pessoa com acesso ao navegador lê `localStorage` em texto puro. Recomende PIN ou não usar anotações.
- **Backups do SO/nuvem**: iCloud/Google Backup podem copiar `localStorage`. Fora do controle do app.
- **Teclados de terceiros**: teclados com sincronização em nuvem podem enviar texto digitado à nuvem do fabricante; mitigado por `autocomplete="off"` etc., mas não garantido.
- **Malware/extensão maliciosa no navegador**: pode ler `localStorage` mesmo cifrado se interceptar PIN em memória.
- **Rede no primeiro carregamento sem HTTPS**: permite injeção de SW malicioso. Use sempre HTTPS.
- **In-app browsers**: podem ter políticas próprias; prefira navegador padrão.
- **Esquecimento do PIN**: sem recuperação; dados cifrados serão perdidos se PIN for esquecido e wipe for necessário.

Verificação final realizada: `grep -rn "innerHTML" js/` → apenas comentários; Network DevTools → zero requisições.

## Screenshots

> *Espaço reservado — adicione capturas de Exame completo, Exame diário e Orações.*

## Revisão doutrinal

O conteúdo foi elaborado a partir dos Mandamentos, Mandamentos da Igreja, virtudes, deveres de estado e pecados de omissão, com linguagem de *perguntas para reflexão*, sem julgamento automático e com aviso explícito de que gravidade depende de matéria grave, pleno conhecimento e consentimento, a discernir com o sacerdote. Não substitui o confessor nem incentiva escrúpulo.

## Licença

Uso livre para fins pastorais e pessoais. Sem garantias.
