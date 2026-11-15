# Rodadas de visual (padrão Awwwards)

Crítico novo a cada rodada (subagente sonnet), que só viu as fotos da prévia: desktop 1440x900 e celular 390x844, foco, hover e axe.
Pesos: Design 40%, Usabilidade 30%, Criatividade 20%, Conteúdo 10%. A meta é 6.

| Rodada | Design | Usabilidade | Criatividade | Conteúdo | Média | Custo aprox. |
|---|---|---|---|---|---|---|
| 0 (antes) | 6,5 | 6,0 | 5,5 | 6,5 | 6,15 | US$ 0,5 |
| 1 (depois) | 7,2 | 7,8 | 5,5 | 7,5 | 7,1 | US$ 2,5 |

Custo total: cerca de US$ 3, dentro do teto de US$ 8.

## O que mudou na rodada 1

- Sombras com profundidade: tom puxado da marca, duas camadas e um brilho interno de 1px nos cartões (`--nv-sombra`, `--nv-sombra-elevada`).
- Brilho radial discreto da marca no topo da página (`.nv-pagina`).
- Botões: no hover sobem 1px com brilho da cor; ao clicar, afundam (scale 0,98). Desabilitado e movimento reduzido não se mexem. O mesmo vale para o botão da spartan no `tema.css`.
- Menu do topo: fundo suave no hover. Menu lateral: filete da marca à esquerda e o ícone desliza 2px no hover.
- Números dos indicadores maiores, com tracking negativo.
- Prévia lateral: no celular a tabela vira cartões (`nv-tabela--cartoes`), em vez de ficar cortada.
- Exemplo: o esqueleto ganhou `role="status"`, o que zera o axe.

Nomes de tokens, classes e API não mudaram.

## O que ficou para depois (sugestões do crítico)

- Sparkline ou variação nos indicadores.
- Os alertas empilhados no exemplo pesam; é conteúdo de demonstração.
- No celular, "R$ 48.230,00" quebra linha no indicador.
