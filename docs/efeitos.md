# Efeitos de vitrine

Seis efeitos para páginas de venda e apresentação, feitos do zero no `layout.css` e no
`modelos/nuvy-efeitos.js` (script comum, sem dependência). Seguem as regras de [movimento.md](movimento.md):
só `transform` e `opacity`, tokens `--nv-mov`, regra própria no movimento reduzido e nada de `innerHTML`.
Use um efeito chamativo por tela, e nunca em tela de trabalho.

| Classe | Precisa do JS? | O que faz |
|---|---|---|
| `.nv-letreiro` | Sim | Faixa de logos ou frases que corre sem emenda, com botão de pausar. |
| `.nv-borda-viva` | Não | Um brilho que dá a volta na borda do cartão. |
| `.nv-botao--brilho` | Opcional | Um reflexo passa pelo botão uma vez ao aparecer e de novo no hover. |
| `.nv-texto-gradiente` | Não | Título com gradiente da marca e um reflexo que passa duas vezes. |
| `.nv-palavra-gira` | Sim | Troca uma palavra do título a cada 2,5 s e para depois de 2 voltas. |
| `.nv-cartao-3d` | Sim | O cartão inclina até 6° seguindo o mouse. |

Sem o JavaScript nada some nem quebra: o letreiro vira uma faixa com rolagem, a palavra fica fixa e o cartão fica
reto.

## Cada efeito

**Letreiro.** Ponha a lista dentro de `.nv-letreiro__trilho`. O script cria a `.nv-letreiro__faixa`, copia o trilho
com `cloneNode` (a cópia ganha `aria-hidden="true"` e `inert`, perde os ids e os links saem da ordem do Tab) e marca
`data-pronto`. A faixa anda até `-50%` e recomeça, por isso a emenda não aparece. Pausa com o mouse em cima, com
foco dentro e pelo botão `.nv-letreiro__pausa` que o script põe no canto (rótulo "Pausar o letreiro",
`aria-pressed` diz se está pausado e o letreiro ganha `data-pausado`). O botão é o que vale no celular e para quem
não usa mouse (WCAG 2.2.2). Com movimento reduzido a faixa fica parada, com rolagem, e o botão some. A velocidade
vem de `--nv-letreiro-vel` (padrão `30s`).

**Borda viva.** Um `conic-gradient` gira atrás do cartão por `transform`, e o `::after` cobre o meio com `--card`.
A cor vem de `--nv-borda-cor` (padrão `--primary`) e a espessura de `--nv-borda-largura` (padrão `2px`). Funciona
melhor em cartão mais largo que alto (até uns 2:1 no sentido da altura).

**Botão com brilho.** Junte a `.nv-botao`. Com o script, o reflexo passa quando o botão entra na tela (marca
`data-visto`, uma vez só); sem o script, só no hover.

**Texto em gradiente.** Gradiente de `--primary` a `--chart-4`, as duas pontas com contraste AA no claro e no
escuro. O reflexo passa duas vezes (cerca de 4 s) e para. Dentro de um cartão, ponha
`style="--nv-texto-fundo: var(--card)"` para o reflexo combinar com o fundo. Navegador sem `background-clip: text`
mostra o texto em `--primary`.

**Palavra que gira.** As palavras vão em `data-palavras` como lista JSON; o texto do elemento é a primeira. O leitor
de tela ouve só a primeira (em `.nv-so-leitor`, com `aria-live="off"`); a troca visual fica com `aria-hidden`. Dá
`data-voltas` voltas na lista (padrão 2, de 1 a 3), termina na primeira palavra e para de vez, com `data-parado`
(WCAG 2.2.2: nada se mexe sozinho por mais de 5 s sem fim). Só gira enquanto está na tela, e fica parada com o mouse
em cima, com a aba escondida e com movimento reduzido (inclusive se a pessoa ligar o reduzido com a página aberta). As palavras entram por `textContent`, então
`<b>` aparece como texto.

**Cartão 3D.** Só com ponteiro fino (`pointer: fine`, mouse ou caneta); toque não inclina. O script escreve
`--nv-inclina-x` e `--nv-inclina-y` (limitados a ±6°, uma escrita por quadro, com o tamanho do cartão lido só na
entrada do mouse) e volta a 0 quando o mouse sai. O `transform` só existe enquanto inclina (`data-inclinado`):
parado, o cartão não tem `transform` próprio, então pode ter outra classe com `transform` e menus `position: fixed`
dentro dele continuam presos à tela.

## Portal (HTML)

```html
<link rel="stylesheet" href="/css/tokens.css" />
<link rel="stylesheet" href="/css/layout.css" />
<script src="/js/nuvy-efeitos.js" defer></script>

<h1>
  Fazemos <span class="nv-palavra-gira" data-palavras='["sites","lojas","apps"]' data-voltas="2">sites</span>
  para <span class="nv-texto-gradiente">pequenas empresas</span>
</h1>

<a class="nv-botao nv-botao--brilho" href="/cadastro">Quero meu site</a>

<div class="nv-letreiro" role="region" aria-label="Clientes atendidos">
  <ul class="nv-letreiro__trilho">
    <li>Padaria Sol</li>
    <li>Oficina Lua</li>
    <li>Clínica Mar</li>
  </ul>
</div>

<article class="nv-cartao nv-borda-viva nv-cartao-3d">
  <h2>Plano completo</h2>
  <p>Site, domínio e relatório mensal.</p>
</article>
```

## Angular

Copie `nuvy-efeitos.js` para `public/js/` e carregue no `index.html` (ou no `scripts` do `angular.json`). O script
monta sozinho o que já está na página; para o que o Angular desenha depois, chame `nuvyEfeitos.montar(elemento)`.
Montar de novo o mesmo elemento não duplica nada.

```ts
declare const nuvyEfeitos: { montar(raiz?: Element | Document): void };

@Component({
  selector: 'app-vitrine',
  template: `
    <h1>Fazemos <span class="nv-palavra-gira" [attr.data-palavras]="palavras">{{ primeira }}</span></h1>
    <div class="nv-letreiro" role="region" aria-label="Clientes atendidos">
      <ul class="nv-letreiro__trilho">
        @for (c of clientes; track c) { <li>{{ c }}</li> }
      </ul>
    </div>
  `,
})
export class VitrineComponent {
  private host = inject(ElementRef<HTMLElement>);
  clientes = ['Padaria Sol', 'Oficina Lua', 'Clínica Mar'];
  palavras = JSON.stringify(['sites', 'lojas', 'apps']);
  primeira = 'sites';

  constructor() {
    afterNextRender(() => nuvyEfeitos.montar(this.host.nativeElement));
  }
}
```

O script mexe no DOM do letreiro e da palavra (cria a faixa e os `span`). Se a lista mudar depois de montada, recrie
o componente (por exemplo com `@if` ou um `track` novo) em vez de mudar os itens no lugar.
