# Constituição do nuvy-ui

Princípios que valem para toda mudança. Cada um aponta onde o repositório já o aplica.

1. **Fonte única dos valores.** Cores, raio e fontes nascem em `tokens.mjs`. O que está em `dist/` é gerado por `npm run gerar`; ninguém edita `dist/` à mão. Prova: `test/dist.test.mjs`.
2. **`dist/` sempre em dia.** O PR que mexe em `tokens.mjs`, `layout/` ou `logo/` leva o `dist/` regenerado. O teste reprova se estiver defasado.
3. **Contraste WCAG 2.x AA medido.** Texto com 4,5:1 ou mais; borda de campo, foco, checkbox, switch e gráficos com 3:1 ou mais, nos dois modos e com o mouse em cima. Prova: `scripts/verificar.mjs`, `test/contraste.test.mjs`.
4. **Escuro por padrão**, com claro opcional. Páginas sem JavaScript são sempre escuras (`tokens-escuro.css`). Fonte: `README.md`, `docs/como-usar.md`.
5. **Sem cor fixa nos projetos.** O layout só usa `var()` e `color-mix`; os projetos usam os tokens (`bg-primary`, `text-muted-foreground`), nunca `#hex`. Prova: `test/layout.test.mjs`; regra em `docs/como-usar.md`.
6. **Prefixo `nv-` em toda classe do layout** e uso só de variáveis que o tema define. Prova: `test/layout.test.mjs`.
7. **Acessibilidade por padrão.** Foco visível com contorno cheio, botão de ícone com `aria-label`, movimento reduzido respeitado, gaveta fechada fora do Tab. Prova: `test/acoes-icones.test.mjs`, `test/layout-lateral.test.mjs`, `test/transicoes.test.mjs`.
8. **Sem dependências npm e sem rede no uso.** O repositório não tem dependências (Node 22 ou mais novo). Cada projeto recebe uma cópia do arquivo gerado; o build do projeto não busca nada daqui. Fonte: `README.md`, `scripts/copiar.mjs`.
9. **Versão sobe junto.** Mudança em cor ou raio sobe a versão em `package.json` e em `scripts/gerar.mjs` (`VERSAO`). Fonte: `docs/como-usar.md`.
10. **Dados fictícios.** Exemplos, prévias e testes não trazem dado pessoal, de cliente, segredo nem chave. Fonte: `README.md` (modelo "com dados fictícios"). Ver RNF-007 em `000-estado-atual`.
11. **Testes e CI verdes antes de mesclar.** O CI roda `npm test`; as actions são fixadas por SHA e as permissões são só de leitura. Prova: `.github/workflows/ci.yml`.
12. **Dependabot sem troca de versão principal.** Prova: `.github/dependabot.yml`.
13. **Mudança que afeta projetos consumidores é compatível ou vem avisada.** Nomes de tokens, classes e API não mudam sem versão nova e nota. Fonte: `docs/awwwards-rodadas.md`. [A CONFIRMAR] se há regra escrita de versionamento.

## O que não se aplica aqui

Login pela Conta NuvyTech, LGPD e migração de banco não se aplicam: o repositório não tem login, dados de usuário nem banco. A tela de acesso dos outros projetos usa o layout daqui, só isso. Quem usa o nuvy-ui cumpre essas regras nos próprios repositórios.
