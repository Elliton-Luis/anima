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
- **Anotações privadas opt-in** — desativadas por padrão, armazenadas só localmente, facilmente apagáveis, com aviso explícito.
- **Preparação para a Confissão** — lembretes de arrependimento, propósito de emenda e penitência.
- **Ato de Contrição** (PT/LA) + *Vinde Espírito Santo* e *Confiteor* em PT/LA, com alternância de idioma.
- **Tema claro/escuro**, responsivo, acessível (semântico, foco visível, teclado, leitores de tela).
- **PWA offline** — instalável, funciona sem internet após primeiro carregamento.

## Privacidade

Este aplicativo:

- **Não possui backend, conta, login ou cadastro.**
- **Não possui analytics, cookies de rastreamento, publicidade ou serviços de terceiros.**
- **Não envia o que você marca ou escreve para a internet** — nenhum dado sai do dispositivo, nenhuma requisição de rede contém conteúdo do usuário.
- **Não utiliza CDNs, fontes externas, APIs externas ou telemetria.**
- **Não armazena respostas pessoais por padrão.** O fluxo principal é apenas leitura e reflexão mental.
- Anotações e marcações, quando ativadas, ficam somente em `localStorage` local e podem ser apagadas em **Apagar todos os meus dados** (com confirmação).
- `Content-Security-Policy` restritiva (`default-src 'self'`, `connect-src 'none'`), sem scripts externos.

> Não fazemos alegações de segurança absoluta. O modelo documentado acima é o implementado; a privacidade depende também do dispositivo e do navegador do usuário.

## Tecnologias

- HTML5, CSS3, JavaScript vanilla
- LocalStorage (mínimo necessário — preferências não sensíveis + estado opt-in)
- Web Crypto API — não necessária para o escopo atual (sem criptografia adicional além do isolamento local)
- PWA: `manifest.json` + Service Worker (`sw.js`)
- Sem frameworks, sem backend, sem banco remoto.

## Armazenamento local

| Chave | Conteúdo | Sensível? |
|-------|----------|-----------|
| `anima:prefs` | tema, idioma de oração | não |
| `anima:progress` | exame atual e seção atual | não (apenas posição) |
| `anima:notesEnabled` | se anotações estão ativas | não |
| `anima:state:{exame}` | marcações e notas por pergunta | **sim — apenas se o usuário ativar** |

Nenhum dado sensível vai para URL, `console.log` ou cache do Service Worker.

## Como executar

Sem build. Basta servir os arquivos estáticos.

```bash
# opção 1 — Python
python3 -m http.server 8000
# abrir http://localhost:8000

# opção 2 — npx
npx serve .
```

> Abrir via `file://` funciona para navegação, mas o Service Worker exige `http(s)`.

## Como instalar o PWA

1. Abra o app no navegador (Chrome, Edge, Firefox, Safari).
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
│   ├── storage.js   # wrapper de LocalStorage com isolamento por prefixo
│   └── app.js       # navegação, renderização, estado, privacidade
└── assets/icons/
    ├── icon-192.png
    └── icon-512.png
```

- `content.js` contém todo o conteúdo doutrinal offline — nenhum carregamento dinâmico de servidor.
- `storage.js` centraliza acesso a `localStorage` com tratamento de falha e prefixo `anima:`.
- `app.js` não usa `innerHTML` com dados do usuário; usa `textContent`/`createElement`.
- `sw.js` faz cache apenas de assets estáticos listados; não registra conteúdo do usuário.

## Screenshots

> *Espaço reservado — adicione capturas de Exame completo, Exame diário e Orações.*

## Revisão doutrinal

O conteúdo foi elaborado a partir dos Mandamentos, Mandamentos da Igreja, virtudes, deveres de estado e pecados de omissão, com linguagem de *perguntas para reflexão*, sem julgamento automático e com aviso explícito de que gravidade depende de matéria grave, pleno conhecimento e consentimento, a discernir com o sacerdote. Não substitui o confessor nem incentiva escrúpulo.

## Licença

Uso livre para fins pastorais e pessoais. Sem garantias.
