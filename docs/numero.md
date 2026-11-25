# Número animado (`.nv-numero`)

Número em que cada dígito rola até o valor novo, como um contador de bomba de gasolina. Serve para
indicadores, saldos e totais que mudam na tela (ex.: o card de faturamento depois de uma baixa).
Código 100% nosso: `modelos/nuvy-numero.js` (navegador) + `modelos/nuvy-numero-formato.mjs` (formatação pura,
roda no navegador e no Node) + `modelos/nuvy-numero-servidor.mjs` (HTML pronto no servidor).

## Como funciona

- O formato vem do `Intl.NumberFormat` (pt-BR por padrão). `partes()` quebra o texto em dígitos e símbolos,
  cada um com uma **chave fixa pela posição** contada a partir da unidade (`i0` unidade, `i1` dezena, `f0`
  primeira casa decimal, `d` vírgula, `g3` ponto do milhar...). Assim 1234 → 1235 só mexe na coluna das unidades.
- Cada dígito é uma janela de uma linha com a pilha 0–9; a pilha sobe com `transform: translateY()`.
- Dígito que entra ou sai (99 → 100) aparece ou some só com `opacity` e `scale`; a largura não anima.
- Largura fixa por dígito com `font-variant-numeric: tabular-nums`: o número não "dança".
- Acessibilidade: a raiz **não** recebe `aria-label` (num `<span>` comum ele não é confiável). Quem fala é o
  texto: o que veio do servidor ou, depois da 1ª atualização, um `span.nv-so-leitor` com o texto formatado;
  todas as colunas têm `aria-hidden="true"`. O leitor de tela lê "R$ 1.234,50", nunca "0 1 2 3 4 5 6 7 8 9".
- `grupo()` faz todas as escritas, lê o layout **uma vez só** e então rola todos os números (sem vaivém de layout).
- Movimento reduzido (`prefers-reduced-motion: reduce`): `atualizar` só troca o `textContent`.
- Valor inválido (`NaN`, `Infinity`, texto) é ignorado com um `console.warn`; o que está na tela fica.
- Todo texto entra por `textContent`/`createTextNode`. Nada de `innerHTML`.

## Opções (`data-formato`, JSON)

| chave | valores | padrão |
| --- | --- | --- |
| `estilo` | `decimal`, `moeda`, `porcentagem` | `decimal` |
| `moeda` | código ISO (`BRL`, `USD`...) | `BRL` |
| `casas` | 0–20 (mínimo e máximo iguais) | do Intl |
| `minCasas`, `maxCasas` | 0–20 | do Intl |
| `sinal` | `auto`, `sempre`, `nunca`, `exceto-zero` | `auto` |
| `agrupar` | `false` tira o ponto do milhar | `true` |

`data-locale` troca o idioma (padrão `pt-BR`). Opção inválida cai no formato decimal simples.

## Portal (HTML)

Copie `nuvy-numero.js` e `nuvy-numero-formato.mjs` para a mesma pasta e carregue como módulo:

```html
<script type="module" src="/js/nuvy-numero.js"></script>

<p class="nv-indicador__valor">
  <span class="nv-numero" data-nome="faturamento" data-valor="1234.5"
        data-formato='{"estilo":"moeda"}'>R$&nbsp;1.234,50</span>
</p>

<script type="module">
  // Um número só:
  nuvyNumero.atualizar(document.querySelector('[data-nome="faturamento"]'), 1580.9);
  // Vários de uma vez, no mesmo quadro (o card muda todo junto):
  nuvyNumero.grupo(document.querySelector('.nv-indicadores'), { faturamento: 1580.9, clientes: 42 });
</script>
```

O texto final já vem no HTML: sem JavaScript o número aparece certo. As colunas só são criadas na primeira
atualização (hidratação sem salto). Elemento vazio (montado no cliente) ganha as colunas na hora.

### Gerando o HTML no servidor

```js
import { htmlNumero } from './nuvy-numero-servidor.mjs';
const html = htmlNumero(1234.5, { estilo: 'moeda' }); // texto e atributos já escapados
```

`htmlNumero` escapa `& < > " ' \`` e remove os caracteres de controle bidirecional (U+202A–U+202E,
U+2066–U+2069). Mesmo assim, use-o só para montar a marcação do número, não para outros dados.

## Angular

Copie os dois arquivos para `public/js/` e carregue no `index.html` com
`<script type="module" src="js/nuvy-numero.js"></script>` (o `scripts` do `angular.json` não serve: ele
não carrega módulos). Deixe o `<span>` vazio, sem interpolação do Angular dentro, porque o script troca os filhos:

```ts
@Component({
  selector: 'app-saldo',
  template: `<span #num class="nv-numero" data-formato='{"estilo":"moeda"}'></span>`,
})
export class SaldoComponent {
  saldo = input.required<number>();
  private num = viewChild.required<ElementRef<HTMLElement>>('num');
  constructor() {
    effect(() => (window as any).nuvyNumero?.atualizar(this.num().nativeElement, this.saldo()));
  }
}
```

Também dá para importar o formatador puro (`partes`, `formatar`) direto no TypeScript para testes ou SSR.
