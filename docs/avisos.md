# Pilha de avisos (`nuvyAviso`)

Avisos curtos empilhados no canto da tela, feitos do zero no `modelos/nuvy-aviso.js` (script comum, sem
dependência) com o CSS do `layout.css`. Só animam `transform` e `opacity`, com os tokens `--nv-mov` e
`--nv-mov-curva`. O texto sempre entra por `textContent`: nada vira HTML.

## Como funciona

- **Até 3 na tela.** O mais novo fica na frente; os outros aparecem atrás, um pouco menores. Do 4º em diante
  vão para a fila e entram quando um sai.
- **Leitor de tela.** O script cria a `<div class="nv-avisos" role="region" aria-label="Avisos">` (ou reaproveita
  a que já está na página) com duas regiões vivas escondidas: a educada (`polite`) para info, sucesso e
  carregando, e a assertiva (`assertive`) para erro e atenção.
- **Teclado.** `Alt+T` leva o foco ao aviso mais novo e abre a pilha. `Esc` fecha o aviso com foco e devolve o foco
  para onde ele estava. Os botões têm `:focus-visible` e alvo de 44 px (`--nv-controle`).
- **Tempo.** O padrão é 5000 ms. O tempo pausa com o mouse ou o foco na pilha (que abre, mostrando todos), com a aba
  escondida e durante o arraste, e continua de onde parou. `duracao: Infinity` deixa fixo.
- **Arrastar para o lado.** Passou de 45% da largura, ou foi um gesto rápido, o aviso sai; senão volta ao lugar.
  Começar o arraste em cima de um botão não conta.
- **Entrada e saída.** Entra com `@starting-style` e sai com `data-saindo`; o nó é removido no `transitionend`
  (com uma folga de segurança). Com `prefers-reduced-motion: reduce` a pilha vira lista, sem deslocar nem escalar,
  só um fade de 80 ms, e o anel de carregando vira reticências paradas.

## API

| Função | O que faz |
|---|---|
| `nuvyAviso.mostrar(opcoes)` | Mostra um aviso e devolve o `id`. `opcoes` pode ser só o texto. |
| `nuvyAviso.sucesso(texto, opcoes)` | Atalho com `tipo: 'sucesso'`. Também há `erro` e `atencao`. |
| `nuvyAviso.promessa(p, mensagens)` | Mostra "carregando" sem tempo e troca o mesmo aviso por sucesso ou erro. Devolve a mesma promise. |
| `nuvyAviso.fechar(id)` | Fecha um aviso (ou tira da fila). Id que não existe é ignorado. |
| `nuvyAviso.limpar()` | Esvazia a fila e fecha todos. |

Opções de `mostrar`: `texto`, `titulo`, `tipo` (`info`, `sucesso`, `atencao`, `erro`, `carregando`), `duracao` (ms
ou `Infinity`) e `acao: { rotulo, aoClicar }` (um botão que roda a função e fecha o aviso).

Em `promessa`, cada mensagem (`carregando`, `sucesso`, `erro`) pode ser texto ou função. A função recebe o valor (ou
o erro) e deve devolver texto; se lançar ou devolver outra coisa, aparece "Algo deu errado.". Use texto fixo no
`erro` para não mostrar detalhe interno ao cliente: a mensagem do `Error` nunca vai para a tela sozinha.

## Portal (HTML)

```html
<link rel="stylesheet" href="/css/tokens.css" />
<link rel="stylesheet" href="/css/layout.css" />
<script src="/js/nuvy-aviso.js" defer></script>

<button class="nv-botao" type="button" id="salvar">Salvar</button>
<script>
  document.getElementById('salvar').addEventListener('click', () => {
    nuvyAviso.promessa(fetch('/api/salvar', { method: 'POST' }).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
    }), {
      carregando: 'Salvando…',
      sucesso: 'Alterações salvas.',
      erro: 'Não foi possível salvar. Tente de novo.',
    }).catch(() => {});
  });
</script>
```

Desfazer com ação:

```js
nuvyAviso.sucesso('Cliente arquivado.', {
  acao: { rotulo: 'Desfazer', aoClicar: () => desarquivar(id) },
});
```

## Angular

Copie `nuvy-aviso.js` para `public/js/` e ponha no `index.html` com `<script src="js/nuvy-aviso.js" defer></script>`
(ou no `scripts` do `angular.json`, porque ele é script comum). Um serviço pequeno deixa o uso tipado:

```ts
type Tipo = 'info' | 'sucesso' | 'atencao' | 'erro' | 'carregando';
interface OpcoesAviso { texto: string; titulo?: string; tipo?: Tipo; duracao?: number;
  acao?: { rotulo: string; aoClicar: () => void }; }
declare const nuvyAviso: {
  mostrar(o: OpcoesAviso | string): string;
  sucesso(t: string, o?: Partial<OpcoesAviso>): string;
  erro(t: string, o?: Partial<OpcoesAviso>): string;
  atencao(t: string, o?: Partial<OpcoesAviso>): string;
  promessa<T>(p: Promise<T>, m: { carregando?: string; sucesso?: string | ((v: T) => string);
    erro?: string | ((e: unknown) => string) }): Promise<T>;
  fechar(id: string): void;
  limpar(): void;
};

@Injectable({ providedIn: 'root' })
export class AvisoService {
  sucesso(texto: string) { return nuvyAviso.sucesso(texto); }
  erro(texto: string) { return nuvyAviso.erro(texto); }
  salvando<T>(p: Promise<T>) {
    return nuvyAviso.promessa(p, { carregando: 'Salvando…', sucesso: 'Salvo.', erro: 'Não foi possível salvar.' });
  }
}
```

Para `Observable`, use `firstValueFrom(obs$)` antes de passar para `promessa`. Telas com spartan podem seguir com o
sonner deles; este é para o portal e as páginas sem spartan.
