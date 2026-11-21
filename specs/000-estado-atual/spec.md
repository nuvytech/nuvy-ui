# 000 - Estado atual do nuvy-ui

Descreve o que o repositório faz hoje (versão 1.9.0 em `package.json`). Cada requisito aponta o que o comprova. Onde não houve certeza, está `[A CONFIRMAR]`.

## 1. Visão

O nuvy-ui é o tema único da NuvyTech para telas: tokens de cor, raio e fonte; um gerador que produz os arquivos prontos; um layout em CSS puro para páginas sem spartan; e uma conferência automática de contraste. Os projetos copiam os arquivos gerados; o repositório não é uma dependência de build. Fonte: `README.md`, `package.json`, `docs/superpowers/specs/2026-10-18-tema-nuvytech-design.md`.

## 2. Atores

| Ator                                                     | O que faz com o repositório                  |
| -------------------------------------------------------- | -------------------------------------------- |
| Mantenedor do tema                                       | edita tokens e layout, gera `dist/`, abre PR |
| Dev de projeto Angular (spartan/ui + Tailwind v4)        | copia `tema.css` para o projeto              |
| Dev de página sem JavaScript (portal, login, relatórios) | usa `tokens-escuro.css` e `layout.css`       |
| Designer ou revisor                                      | vê as prévias e importa tokens no Penpot     |
| CI                                                       | roda `npm test` em PR e na main              |

## 3. Histórias de usuário

- H1. Como mantenedor, quero mudar uma cor em um só lugar e ter todos os arquivos regenerados, para que os projetos não divirjam.
- H2. Como mantenedor, quero que uma combinação com contraste abaixo do AA reprove o CI, para não publicar cor ilegível.
- H3. Como dev Angular, quero copiar o tema com um comando e ser avisado se o `styles.css` sobrescreve as cores.
- H4. Como dev de página sem JavaScript, quero um layout pronto (cabeçalho, cartões, formulários, tabelas, avisos) que funcione em escuro e claro.
- H5. Como dev de app com várias telas, quero a variante de coluna lateral recolhível, com gaveta no celular.
- H6. Como dev, quero o favicon e a logo oficiais prontos para copiar.
- H7. Como designer, quero ver cores, componentes e estados em uma página e importar os tokens no Penpot.

## 4. Requisitos funcionais

| Id     | Requisito                                                                                                                                                                                             | Comprovado em                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| RF-001 | `npm run gerar` produz `dist/` a partir de `tokens.mjs` (tokens, tema, layout, logos, favicon, sprite de ícones, Penpot).                                                                             | `scripts/gerar.mjs`, `package.json`                                                                |
| RF-002 | `tokens.mjs` define neutros, marca, gráficos, raio e fontes, com escuro e claro.                                                                                                                      | `tokens.mjs`, `dist/tokens.json`                                                                   |
| RF-003 | `dist/nuvytech/tema.css` traz as variáveis, os extras para o Tailwind, a base e a regra do botão com o mouse em cima, com a versão no cabeçalho.                                                      | `README.md`, `test/dist.test.mjs`                                                                  |
| RF-004 | `tokens.css` traz o claro no `:root` e o escuro em `.dark`; `tokens-escuro.css` traz só o escuro direto no `:root`.                                                                                   | `test/dist.test.mjs`                                                                               |
| RF-005 | `dist/tokens.json` traz todos os valores em OKLCH e hex, com a versão e os dois modos.                                                                                                                | `test/dist.test.mjs`                                                                               |
| RF-006 | `dist/penpot/tokens.json` traz os mesmos tokens no formato do Penpot.                                                                                                                                 | `docs/penpot.md`                                                                                   |
| RF-007 | `npm run copiar -- <pasta>` grava `src/styles/nuvy-tema.css` no projeto (ou outro destino dentro dele), informa a versão anterior e recusa pasta sem `package.json`.                                  | `scripts/copiar.mjs`, `test/copiar.test.mjs`                                                       |
| RF-008 | A cópia avisa quando o `styles.css` do projeto define `--background`, `--primary` ou `--radius`; não avisa quando só importa o tema.                                                                  | `scripts/copiar.mjs`, `test/copiar.test.mjs`                                                       |
| RF-009 | `npm run copiar-favicon -- <pasta-publica>` grava os cinco arquivos de favicon, iguais aos do `dist`.                                                                                                 | `scripts/copiar-favicon.mjs`, `test/dist.test.mjs`                                                 |
| RF-010 | `layout.css` oferece o layout padrão com classes `nv-`: página, cabeçalho, texto, cartão, grade, indicadores, botão, formulário, tabela, selos e avisos.                                              | `layout/layout.css`, `docs/como-usar.md`                                                           |
| RF-011 | Botão e campo têm a mesma altura, e nenhuma variante de botão a muda.                                                                                                                                 | `test/espacamento.test.mjs`                                                                        |
| RF-012 | Ações em tabela usam botão só de ícone de 44 px, com `aria-label`, ícone escondido do leitor e símbolo existente no sprite.                                                                           | `test/acoes-icones.test.mjs`, `docs/como-usar.md`                                                  |
| RF-013 | A dica do botão de ícone abre com mouse e foco, só com CSS, à esquerda do ícone; sem mouse ou abaixo de 768 px a descrição fica visível ao lado.                                                      | `test/acoes-icones.test.mjs`                                                                       |
| RF-014 | Variante com coluna lateral (`nv-pagina--lateral`): grupos, sub-itens, contagem de não lidos, conta no pé; sem JavaScript a coluna aparece inteira.                                                   | `docs/layout-lateral.md`, `test/layout-lateral.test.mjs`                                           |
| RF-015 | `modelos/nuvy-lateral.js` recolhe a coluna (escolha guardada em `localStorage`, sem quebrar se bloqueado) e abre a gaveta no celular com foco no botão Fechar; Esc ou o véu fecham e devolvem o foco. | `test/layout-lateral.test.mjs`                                                                     |
| RF-016 | Transições sutis: esqueleto, modal, aviso flutuante e menu suspenso, só com `opacity` e `transform`, com movimento reduzido tratado.                                                                  | `docs/transicoes.md`, `test/transicoes.test.mjs`                                                   |
| RF-017 | `modelos/nuvy-tema.js` aplica `.dark` antes da primeira pintura, com a escolha em `localStorage` (chave `nuvy-tema`) e escuro por padrão.                                                             | `test/nuvy-tema.test.mjs`, desenho de 18/10/2026                                                   |
| RF-018 | `modelos/tema.service.ts` e `modelos/preparo-testes.ts` servem de modelo para apps Angular.                                                                                                           | `README.md`                                                                                        |
| RF-019 | A logo oficial (claro e escuro) e o favicon (SVG, ICO, PNGs, apple-touch, trecho de `<head>`) saem em `dist/nuvytech/`.                                                                               | `README.md`, `logo/`                                                                               |
| RF-020 | `npm run previa` e `npm run referencia` montam páginas em `previa/` para ver cores, componentes, estados, contraste e escalas nos dois modos.                                                         | `scripts/previa.mjs`, `scripts/referencia.mjs`, `test/previa.test.mjs`, `test/referencia.test.mjs` |
| RF-021 | `modelos/layout-exemplo.html` e `modelos/layout-lateral-exemplo.html` usam só classes que existem no layout.                                                                                          | `test/layout.test.mjs`                                                                             |

## 5. Requisitos não funcionais

| Id      | Requisito                                                                                                                                                                        | Comprovado em                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| RNF-001 | Contraste AA em todas as combinações, nos dois modos: texto 4,5:1, interface 3:1. O desenho cita 142 combinações. [A CONFIRMAR] o número atual.                                  | `scripts/verificar.mjs`, `test/contraste.test.mjs` |
| RNF-002 | Sem dependências npm; Node 22 ou mais novo.                                                                                                                                      | `README.md`, `package.json`                        |
| RNF-003 | `dist/` idêntico ao que `npm run gerar` produz.                                                                                                                                  | `test/dist.test.mjs`, `test/layout.test.mjs`       |
| RNF-004 | `layout.css` sem cor literal; só `var()` e `color-mix`; classes com prefixo `nv-`; define `:focus-visible`.                                                                      | `test/layout.test.mjs`                             |
| RNF-005 | Foco visível com contorno cheio em todas as variantes de botão.                                                                                                                  | `test/espacamento.test.mjs`                        |
| RNF-006 | Escuro por padrão; páginas sem JavaScript sempre escuras.                                                                                                                        | `README.md`, `docs/como-usar.md`                   |
| RNF-007 | Sem segredo nem dado pessoal; exemplos com dados fictícios. [A CONFIRMAR] se algum teste verifica isso.                                                                          | `README.md`                                        |
| RNF-008 | CI: `npm test` com limite de 5 minutos; actions fixadas por SHA; permissões `contents: read`; execuções antigas de PR são canceladas; em runner próprio roda com concorrência 2. | `.github/workflows/ci.yml`                         |
| RNF-009 | Fonte Inter servida pelo próprio app, sem Google Fonts.                                                                                                                          | desenho de 18/10/2026, seção 6                     |
| RNF-010 | Em telas pequenas (até 720 px) a navegação quebra linha, tabelas rolam ou viram cartões e formulários de duas colunas viram uma.                                                 | `docs/como-usar.md`                                |

## 6. Critérios de aceite verificáveis

- CA-1. `npm test` termina sem falhas em Node 22 (RNF-001, RNF-003, RNF-004, RF-007, RF-014 a RF-017).
- CA-2. Alterar um token sem rodar `npm run gerar` faz `test/dist.test.mjs` falhar.
- CA-3. Baixar um contraste abaixo do mínimo faz o teste de contraste falhar com o nome da combinação.
- CA-4. `npm run copiar -- <pasta sem package.json>` falha sem criar arquivos.
- CA-5. Uma regra do layout com `#hex` ou `rgb(` faz `test/layout.test.mjs` falhar.
- CA-6. O CI roda em PR e em push na main e fica verde antes de mesclar.

## 7. Fora de escopo

- Gerador de design em canvas de Artifact.
- Sites de clientes do gerador Astro do site-factory: mantêm a identidade de cada cliente; só o site da NuvyTech usa o tema.
- A migração de cada projeto: tem desenho e plano próprios no repositório do projeto.
- Hospedar o Penpot (só o arquivo de tokens está pronto). Fonte: `docs/penpot.md`.
- Login, banco de dados e backend.

## 8. Pendências conhecidas

- Sugestões do crítico de visual: sparkline ou variação nos indicadores; alertas empilhados no exemplo pesam; no celular um valor em reais quebra linha no indicador. Fonte: `docs/awwwards-rodadas.md`.
- Armazenamento e histórico da nuvem grátis do Penpot não confirmados. Fonte: `docs/penpot.md`.
- Coluna lateral para o portal: quais abas viram sub-itens é "decidir por tela". Fonte: `docs/layout-lateral.md`.
- [A CONFIRMAR] se `docs/superpowers/plans/` tem plano ainda em aberto.
- [A CONFIRMAR] política de versionamento e de aviso aos projetos consumidores quando uma classe ou token muda.
