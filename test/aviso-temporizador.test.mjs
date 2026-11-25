import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerArq } from './apoio/dom-falso.mjs';
import { carregarAviso } from './apoio/aviso.mjs';

const saindo = (li) => li.hasAttribute('data-saindo');

function esconder(a, estado) {
  a.document.visibilityState = estado;
  a.evento(a.document, 'visibilitychange', { bubbles: false });
}

test('temporizador: aviso de 5000 ms parado aos 2000 ms por 10 s fecha 3000 ms depois de voltar', () => {
  const a = carregarAviso();
  const li = a.item(a.api.mostrar({ texto: 'Salvo', duracao: 5000 }));
  a.clock.avancar(2000);
  esconder(a, 'hidden');
  a.clock.avancar(10000);
  assert.equal(saindo(li), false, 'não pode fechar com a aba escondida');
  esconder(a, 'visible');
  a.clock.avancar(2999);
  assert.equal(saindo(li), false);
  a.clock.avancar(1);
  assert.equal(saindo(li), true);
});

test('temporizador: passar o mouse ou focar a pilha pausa e abre; sair retoma', () => {
  const a = carregarAviso();
  const li = a.item(a.api.mostrar({ texto: 'Salvo', duracao: 5000 }));
  a.clock.avancar(1000);
  a.evento(a.caixa(), 'pointerenter', { bubbles: false });
  assert.ok(a.caixa().hasAttribute('data-expandido'));
  a.clock.avancar(20000);
  assert.equal(saindo(li), false);
  a.evento(a.caixa(), 'pointerleave', { bubbles: false });
  assert.equal(a.caixa().hasAttribute('data-expandido'), false);
  a.clock.avancar(3999);
  assert.equal(saindo(li), false);
  a.clock.avancar(1);
  assert.equal(saindo(li), true);
});

test('temporizador: visibilitychange pausa e retoma todos os avisos visíveis', () => {
  const a = carregarAviso();
  const um = a.item(a.api.mostrar({ texto: 'um', duracao: 3000 }));
  const dois = a.item(a.api.mostrar({ texto: 'dois', duracao: 6000 }));
  esconder(a, 'hidden');
  assert.equal(a.clock.pendentes(), 0, 'escondida não deixa temporizador rodando');
  a.clock.avancar(60000);
  esconder(a, 'visible');
  a.clock.avancar(3000);
  assert.equal(saindo(um), true);
  assert.equal(saindo(dois), false);
  a.clock.avancar(3000);
  assert.equal(saindo(dois), true);
});

test('duração Infinity fica; duração inválida vira 5000 ms', () => {
  const a = carregarAviso();
  const fixo = a.item(a.api.mostrar({ texto: 'fixo', duracao: Infinity }));
  const ruim = a.item(a.api.mostrar({ texto: 'ruim', duracao: -1 }));
  a.clock.avancar(5000);
  assert.equal(saindo(fixo), false);
  assert.equal(saindo(ruim), true, 'duração inválida volta para 5000 ms');
});

function arrastar(a, li, dx, ms = 1000) {
  a.evento(li, 'pointerdown', { button: 0, pointerId: 1, clientX: 100 });
  a.evento(li, 'pointermove', { pointerId: 1, clientX: 100 + dx / 2 });
  a.clock.avancar(ms);
  a.evento(li, 'pointermove', { pointerId: 1, clientX: 100 + dx });
  a.evento(li, 'pointerup', { pointerId: 1, clientX: 100 + dx });
}

test('arraste: 60% da largura dispensa o aviso', () => {
  const a = carregarAviso();
  const id = a.api.mostrar({ texto: 'arraste', duracao: Infinity });
  const li = a.item(id);
  li.largura = 300;
  arrastar(a, li, 180);
  assert.equal(saindo(li), true);
  assert.equal(li.style.transform, 'translateX(300px)');
  assert.equal(li.style.opacity, '0');
  assert.equal(li.hasAttribute('data-arrastando'), false);
  assert.deepEqual(li.capturas, [1]);
});

test('arraste: 20% devolve o aviso ao lugar e limpa o transform', () => {
  const a = carregarAviso();
  const li = a.item(a.api.mostrar({ texto: 'arraste', duracao: 5000 }));
  li.largura = 300;
  a.evento(li, 'pointerdown', { button: 0, pointerId: 1, clientX: 100 });
  a.evento(li, 'pointermove', { pointerId: 1, clientX: 40 });
  assert.ok(li.hasAttribute('data-arrastando'));
  assert.equal(li.style.transform, 'translateX(-60px)');
  assert.equal(li.style.opacity, '0.8');
  // Enquanto arrasta, o tempo não corre.
  a.clock.avancar(8000);
  assert.equal(saindo(li), false);
  a.evento(li, 'pointerup', { pointerId: 1, clientX: 40 });
  assert.equal(saindo(li), false);
  assert.equal(li.style.transform, '');
  assert.equal(li.style.opacity, '');
  assert.equal(li.hasAttribute('data-arrastando'), false);
  a.clock.avancar(5000);
  assert.equal(saindo(li), true, 'o tempo volta a correr depois de soltar');
});

test('arraste: gesto rápido dispensa mesmo curto; pointercancel devolve', () => {
  const a = carregarAviso();
  const rapido = a.item(a.api.mostrar({ texto: 'rápido', duracao: Infinity }));
  rapido.largura = 300;
  arrastar(a, rapido, -60, 100); // 0,6 px/ms
  assert.equal(saindo(rapido), true);
  assert.equal(rapido.style.transform, 'translateX(-300px)');
  const cancelado = a.item(a.api.mostrar({ texto: 'cancelado', duracao: Infinity }));
  cancelado.largura = 300;
  a.evento(cancelado, 'pointerdown', { button: 0, pointerId: 2, clientX: 0 });
  a.evento(cancelado, 'pointermove', { pointerId: 2, clientX: 250 });
  a.evento(cancelado, 'pointercancel', { pointerId: 2 });
  assert.equal(saindo(cancelado), false);
  assert.equal(cancelado.style.transform, '');
});

test('arraste: pointerdown num botão, botão direito ou toque curto não arrastam', () => {
  const a = carregarAviso();
  const li = a.item(a.api.mostrar({ texto: 'x', duracao: Infinity, acao: { rotulo: 'Ver', aoClicar() {} } }));
  li.largura = 300;
  for (const botao of [li.querySelector('.nv-aviso__fechar'), li.querySelector('.nv-aviso__acao')]) {
    a.evento(botao, 'pointerdown', { button: 0, pointerId: 1, clientX: 0 });
    a.evento(li, 'pointermove', { pointerId: 1, clientX: 250 });
    a.evento(li, 'pointerup', { pointerId: 1, clientX: 250 });
  }
  a.evento(li, 'pointerdown', { button: 2, pointerId: 1, clientX: 0 });
  a.evento(li, 'pointermove', { pointerId: 1, clientX: 250 });
  a.evento(li, 'pointerup', { pointerId: 1, clientX: 250 });
  a.evento(li, 'pointerdown', { button: 0, pointerId: 1, clientX: 0 });
  a.evento(li, 'pointermove', { pointerId: 1, clientX: 3 });
  a.evento(li, 'pointerup', { pointerId: 1, clientX: 3 });
  assert.equal(saindo(li), false);
  assert.equal(li.hasAttribute('data-arrastando'), false);
  assert.equal(li.escritasDeEstilo.includes('transform'), false);
});

test('o script só escreve transform, opacity e variáveis --nv-* no style', () => {
  const a = carregarAviso();
  const ids = [1, 2, 3, 4].map((n) => a.api.mostrar({ texto: `n${n}`, duracao: Infinity }));
  for (const li of a.itens()) { li.largura = 300; li.altura = 64; }
  a.evento(a.caixa(), 'pointerenter', { bubbles: false });
  arrastar(a, a.item(ids[2]), 200);
  arrastar(a, a.item(ids[1]), 30);
  // Guarda as referências antes de limpar: os itens removidos também contam.
  const elementos = [a.caixa(), ...a.itens()];
  a.api.limpar();
  a.clock.avancar(300);
  const escritas = new Set(elementos.flatMap((el) => el.escritasDeEstilo));
  assert.ok(escritas.has('transform') && escritas.has('--nv-desloc'));
  for (const k of escritas) assert.ok(['transform', 'opacity'].includes(k) || k.startsWith('--nv-'), `escreveu ${k}`);
  // Conferência no fonte: toda escrita em .style é transform/opacity ou setProperty('--nv-…').
  const fonte = lerArq('modelos/nuvy-aviso.js');
  const atribuicoes = [...fonte.matchAll(/\.style\.([a-zA-Z]+)\s*=(?!=)/g)].map((m) => m[1]);
  assert.ok(atribuicoes.length > 0);
  for (const p of atribuicoes) assert.ok(['transform', 'opacity'].includes(p), `style.${p}`);
  for (const m of fonte.matchAll(/style\.(setProperty|removeProperty)\(\s*'([^']+)'/g)) assert.match(m[2], /^--nv-/);
  assert.doesNotMatch(fonte, /style\.cssText|setAttribute\(\s*'style'/);
});
