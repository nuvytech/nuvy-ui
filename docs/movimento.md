# Movimento

Regras de animação de todo o `layout.css` (avisos, modal, menu, número animado e os efeitos de
[efeitos.md](efeitos.md)). Os testes em `test/` conferem cada uma delas.

## Tokens

| Token | Valor | Uso |
|---|---|---|
| `--nv-mov-rapido` | `150ms` | Cor, borda e fundo no hover; respostas a clique. |
| `--nv-mov` | `200ms` | Entrada e saída de peças (aviso, modal, menu, palavra que gira, cartão 3D). |
| `--nv-mov-curva` | `cubic-bezier(0.2, 0, 0, 1)` | Curva padrão: sai rápido e assenta devagar. Serve para entrar e para sair. |
| `--nv-letreiro-vel` | `30s` | Uma volta completa do letreiro. Mais itens pedem mais tempo. |

Efeitos longos usam múltiplos do token, nunca um número solto: o brilho do botão dura `calc(var(--nv-mov) * 4)`,
o do texto `calc(var(--nv-mov) * 10)` e a volta da borda viva `calc(var(--nv-mov) * 20)`. Assim, se o token mudar,
tudo acompanha. Animação contínua (letreiro, borda viva) usa `linear`; o resto usa `--nv-mov-curva`.

## Só `transform` e `opacity`

Transição e `@keyframes` só mexem em `transform` e `opacity`. Essas duas propriedades rodam na GPU, sem refazer o
layout nem repintar a página. Por isso:

- nada de animar `width`, `height`, `top`, `left`, `margin`, `padding`, `background-position` ou `box-shadow`;
- para "crescer", use `scale`; para "andar", `translate`; para "aparecer", `opacity`;
- o que o JavaScript escreve no `style` também é só `transform`, `opacity` ou uma variável `--nv-*` usada dentro
  de um `transform` (como `--nv-inclina-x` no cartão 3D);
- um brilho que passa por cima é um pseudo-elemento (`::before`/`::after`) com gradiente parado que anda por
  `translateX`, nunca um `background-position` animado.

Cor e borda no hover são a única exceção, com `--nv-mov-rapido`, porque mudam sem deslocar nada.

## Movimento reduzido

Toda classe que anima tem uma regra no bloco `@media (prefers-reduced-motion: reduce)` que fica antes de
`.nv-pagina--lateral`. Nesse bloco não pode aparecer `translate` nem `scale`. O que cada peça vira:

| Peça | Com movimento reduzido |
|---|---|
| Esqueleto (`.nv-esqueleto`) | Fica parado, sem o brilho. |
| Modal, aviso e menu suspenso | Só um fade de 80 ms, sem subir nem escalar. |
| Número animado (`.nv-numero`) | Troca o texto direto, sem rolar as colunas. |
| Letreiro (`.nv-letreiro`) | Para e vira uma faixa com rolagem manual; a cópia some. |
| Borda viva (`.nv-borda-viva`) | O brilho da borda fica parado num ponto. |
| Botão com brilho e texto em gradiente | O brilho não aparece (o gradiente do texto fica). |
| Palavra que gira (`.nv-palavra-gira`) | Fica na primeira palavra (o JS nem troca). |
| Cartão 3D (`.nv-cartao-3d`) | Não inclina. |

O JavaScript também consulta `matchMedia('(prefers-reduced-motion: reduce)')` antes de cada passo, então mudar a
preferência com a página aberta já vale no passo seguinte.

## Quando não usar

- **Em tela de trabalho.** Tabela, formulário, financeiro e telas que o cliente usa todo dia ficam quietos.
  Efeito é para vitrine: página inicial, apresentação de plano, página de venda.
- **Mais de um efeito chamativo por tela.** Escolha um: letreiro, borda viva ou texto em gradiente. Dois brigam pela
  atenção.
- **No texto que precisa ser lido.** Palavra que gira e texto em gradiente vão no título, nunca em preço, prazo ou
  aviso. O leitor de tela ouve só a primeira palavra.
- **Em botão que não é a ação principal.** O brilho chama o olho; use só no botão que fecha a venda.
- **Para esconder lentidão.** Animação não substitui carregar rápido. Esqueleto sim, efeito não.
- **Acima de 5 segundos sem pausa.** O que fica rodando (letreiro, borda viva, palavra que gira) pausa com o mouse ou
  o foco, e para com a aba escondida (palavra) ou com movimento reduzido (todos).
