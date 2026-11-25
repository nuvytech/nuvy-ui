import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambiente, lerArq } from './apoio/dom-falso.mjs';
import { css, reduzido, regras, regrasReduzidas, propsDeTransicao } from './apoio/css.mjs';
import { resolver, rgb } from '../scripts/verificar.mjs';
import { contraste } from '../scripts/cor.mjs';

const codigo = lerArq('modelos/nuvy-efeitos.js');
const REDUZ = '(prefers-reduced-motion: reduce)';
const FINO = '(pointer: fine)';
const CLASSES = ['nv-letreiro', 'nv-borda-viva', 'nv-botao--brilho', 'nv-texto-gradiente', 'nv-palavra-gira', 'nv-cartao-3d'];

// Monta o HTML de teste com createElement (o DOM falso não aceita innerHTML, de propósito).
function carregar(montarDom, opcoes = {}, extra = {}) {
  const amb = ambiente(opcoes);
  const els = montarDom(amb.document);
  amb.rodar(codigo, extra);
  return { ...amb, ...els, api: amb.ctx.nuvyEfeitos };
}
function criar(doc, tag, classe, texto) {
  const el = doc.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function letreiroDom(doc) {
  const el = criar(doc, 'div', 'nv-letreiro');
  el.setAttribute('aria-label', 'Clientes');
  const trilho = criar(doc, 'ul', 'nv-letreiro__trilho');
  trilho.id = 'clientes';
  for (const nome of ['Padaria Sol', 'Oficina Lua']) {
    const li = criar(doc, 'li');
    const a = criar(doc, 'a', '', nome);
    a.setAttribute('href', '#');
    li.appendChild(a);
    trilho.appendChild(li);
  }
  el.appendChild(trilho);
  doc.body.appendChild(el);
  return { el, trilho };
}

function palavraDom(palavras = '["sites","lojas","apps"]') {
  return (doc) => {
    const el = criar(doc, 'span', 'nv-palavra-gira', 'sites');
    el.setAttribute('data-palavras', palavras);
    doc.body.appendChild(el);
    return { el };
  };
}
const visivelDe = (el) => el.querySelector('.nv-palavra-gira__visivel');
const palavraAtual = (el) => visivelDe(el).querySelectorAll('.nv-palavra-gira__palavra').filter((p) => !p.hasAttribute('data-saindo'))[0].textContent;

// ---------- letreiro ----------

test('letreiro: a cópia tem aria-hidden, inert, o mesmo texto e nada focável ou com id repetido', () => {
  const a = carregar(letreiroDom);
  const faixa = a.el.querySelector('.nv-letreiro__faixa');
  assert.ok(faixa, 'faltou a faixa');
  const trilhos = faixa.querySelectorAll('.nv-letreiro__trilho');
  assert.equal(trilhos.length, 2);
  const [original, copia] = trilhos;
  assert.equal(original, a.trilho);
  assert.equal(original.hasAttribute('aria-hidden'), false);
  assert.equal(copia.getAttribute('aria-hidden'), 'true');
  assert.ok(copia.hasAttribute('inert'));
  assert.equal(copia.textContent, original.textContent);
  assert.equal(copia.hasAttribute('id'), false);
  for (const link of copia.querySelectorAll('a')) assert.equal(link.getAttribute('tabindex'), '-1');
  assert.ok(a.el.hasAttribute('data-pronto'));
  // Montar de novo não duplica.
  a.api.montar();
  a.api.montar(a.el);
  assert.equal(a.el.querySelectorAll('.nv-letreiro__trilho').length, 2);
});

test('letreiro sem trilho é ignorado sem erro', () => {
  const a = carregar((doc) => {
    const el = criar(doc, 'div', 'nv-letreiro', 'só texto');
    doc.body.appendChild(el);
    return { el };
  });
  assert.equal(a.el.hasAttribute('data-pronto'), false);
  assert.equal(a.el.textContent, 'só texto');
});

// ---------- palavra que gira ----------

test('palavra que gira: leitor ouve só a 1ª palavra, aria-live=off, troca a cada 2,5 s', () => {
  const a = carregar(palavraDom());
  assert.equal(a.el.getAttribute('aria-live'), 'off');
  const leitor = a.el.querySelector('.nv-so-leitor');
  assert.equal(leitor.textContent, 'sites');
  assert.equal(visivelDe(a.el).getAttribute('aria-hidden'), 'true');
  assert.equal(palavraAtual(a.el), 'sites');
  a.clock.avancar(2499);
  assert.equal(palavraAtual(a.el), 'sites');
  a.clock.avancar(1);
  assert.equal(palavraAtual(a.el), 'lojas');
  const nova = visivelDe(a.el).querySelectorAll('.nv-palavra-gira__palavra').at(-1);
  assert.ok(nova.hasAttribute('data-entrando'));
  a.clock.quadro();
  assert.equal(nova.hasAttribute('data-entrando'), false);
  a.clock.avancar(250);
  assert.equal(visivelDe(a.el).querySelectorAll('.nv-palavra-gira__palavra').length, 1, 'a velha sai depois do --nv-mov');
  a.clock.avancar(5000);
  assert.equal(palavraAtual(a.el), 'sites', 'volta ao começo');
  assert.equal(leitor.textContent, 'sites', 'o leitor de tela não muda');
});

test('palavra que gira: parada com a aba escondida, com movimento reduzido e com o mouse em cima', () => {
  const a = carregar(palavraDom());
  a.document.visibilityState = 'hidden';
  a.clock.avancar(10000);
  assert.equal(palavraAtual(a.el), 'sites');
  a.document.visibilityState = 'visible';
  a.evento(a.el, 'pointerenter', { bubbles: false });
  a.clock.avancar(10000);
  assert.equal(palavraAtual(a.el), 'sites');
  a.evento(a.el, 'pointerleave', { bubbles: false });
  a.clock.avancar(2500);
  assert.equal(palavraAtual(a.el), 'lojas');

  const r = carregar(palavraDom(), { midias: { [REDUZ]: true } });
  r.clock.avancar(20000);
  assert.equal(palavraAtual(r.el), 'sites');
  assert.equal(r.el.hasAttribute('data-indice'), false);
});

test('palavra que gira: JSON ruim avisa e não mexe; uma palavra só não gira', () => {
  const a = carregar(palavraDom('sites,lojas'));
  assert.equal(a.avisosConsole.length, 1);
  assert.equal(a.el.textContent, 'sites');
  const b = carregar(palavraDom('["sites", 3, ""]'));
  assert.equal(b.el.textContent, 'sites');
  assert.equal(b.el.hasAttribute('aria-live'), false);
  assert.equal(b.clock.pendentes(), 0);
});

test('palavra que gira: palavra com "<b>" entra como texto', () => {
  const a = carregar(palavraDom('["<b>a</b>","<img src=x onerror=alert(1)>"]'));
  a.clock.avancar(2500);
  assert.equal(palavraAtual(a.el), '<img src=x onerror=alert(1)>');
  assert.equal(a.el.querySelectorAll('img').length + a.el.querySelectorAll('b').length, 0);
});

// ---------- cartão 3D ----------

function cartaoDom(doc) {
  const el = criar(doc, 'div', 'nv-cartao nv-cartao-3d', 'Plano');
  el.largura = 200;
  el.altura = 100;
  doc.body.appendChild(el);
  return { el };
}
const graus = (el, eixo) => parseFloat(el.style.getPropertyValue(`--nv-inclina-${eixo}`));

test('cartão 3D: inclina no máximo ±6° com mouse e volta a 0 ao sair', () => {
  const a = carregar(cartaoDom, { midias: { [FINO]: true } });
  a.evento(a.el, 'pointermove', { pointerType: 'mouse', clientX: 200, clientY: 0 });
  assert.equal(graus(a.el, 'y'), 6);
  assert.equal(graus(a.el, 'x'), 6);
  a.evento(a.el, 'pointermove', { pointerType: 'mouse', clientX: -5000, clientY: 9000 });
  assert.equal(graus(a.el, 'y'), -6);
  assert.equal(graus(a.el, 'x'), -6);
  a.evento(a.el, 'pointermove', { pointerType: 'mouse', clientX: 100, clientY: 50 });
  assert.equal(graus(a.el, 'y'), 0);
  a.evento(a.el, 'pointermove', { pointerType: 'mouse', clientX: 150, clientY: 25 });
  assert.equal(graus(a.el, 'y'), 3);
  assert.equal(graus(a.el, 'x'), 3);
  a.evento(a.el, 'pointerleave', { bubbles: false });
  assert.equal(a.el.style.getPropertyValue('--nv-inclina-x'), '0.00deg');
  assert.equal(a.el.style.getPropertyValue('--nv-inclina-y'), '0.00deg');
  for (const k of a.el.escritasDeEstilo) assert.match(k, /^--nv-inclina-[xy]$/);
});

test('cartão 3D: sem ponteiro fino, com toque ou com movimento reduzido não inclina', () => {
  const grosso = carregar(cartaoDom);
  grosso.evento(grosso.el, 'pointermove', { pointerType: 'mouse', clientX: 200, clientY: 0 });
  assert.equal(grosso.el.style.getPropertyValue('--nv-inclina-y'), '');
  const toque = carregar(cartaoDom, { midias: { [FINO]: true } });
  toque.evento(toque.el, 'pointermove', { pointerType: 'touch', clientX: 200, clientY: 0 });
  assert.equal(toque.el.style.getPropertyValue('--nv-inclina-y'), '');
  const red = carregar(cartaoDom, { midias: { [FINO]: true, [REDUZ]: true } });
  red.evento(red.el, 'pointermove', { pointerType: 'mouse', clientX: 200, clientY: 0 });
  assert.equal(red.el.style.getPropertyValue('--nv-inclina-y'), '');
});

// ---------- botão com brilho ----------

test('botão com brilho: data-visto quando entra na tela (uma vez) e na hora sem IntersectionObserver', () => {
  const vistos = [];
  class Observador {
    constructor(cb) { this.cb = cb; this.alvos = new Set(); vistos.push(this); }
    observe(el) { this.alvos.add(el); }
    unobserve(el) { this.alvos.delete(el); }
  }
  const dom = (doc) => {
    const el = criar(doc, 'button', 'nv-botao nv-botao--brilho', 'Começar');
    doc.body.appendChild(el);
    return { el };
  };
  const a = carregar(dom, {}, { IntersectionObserver: Observador });
  assert.equal(a.el.hasAttribute('data-visto'), false);
  const obs = vistos[0];
  obs.cb([{ target: a.el, isIntersecting: false }]);
  assert.equal(a.el.hasAttribute('data-visto'), false);
  obs.cb([{ target: a.el, isIntersecting: true }]);
  assert.ok(a.el.hasAttribute('data-visto'));
  assert.equal(obs.alvos.size, 0, 'para de observar depois da primeira vez');
  const b = carregar(dom);
  assert.ok(b.el.hasAttribute('data-visto'));
});

test('sem innerHTML no fonte; a cópia é por cloneNode e o texto por textContent', () => {
  // Tira os comentários: o cabeçalho explica que não usa innerHTML.
  const semComentario = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(semComentario, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
  assert.match(codigo, /cloneNode\(true\)/);
  assert.match(codigo, /textContent = /);
});

// ---------- CSS ----------

const doEfeito = regras().filter((r) => CLASSES.some((c) => r.seletor.includes(c)));
const keyframes = Object.fromEntries(
  [...css.matchAll(/@keyframes ([\w-]+)\s*\{/g)].map((m) => {
    const ini = m.index + m[0].length;
    let nivel = 1;
    let j = ini;
    while (nivel > 0) nivel += css[j] === '{' ? 1 : css[j] === '}' ? -1 : 0, j++;
    return [m[1], css.slice(ini, j - 1)];
  }),
);

test('CSS dos efeitos: transições só de transform e opacity, com os tokens de duração', () => {
  assert.ok(doEfeito.length >= 15);
  for (const r of doEfeito) {
    for (const p of propsDeTransicao(r.corpo).filter((x) => x !== 'none')) {
      assert.ok(['transform', 'opacity'].includes(p), `${r.seletor} anima ${p}`);
    }
    const t = r.corpo.match(/(?:^|[;\s])transition:\s*([^;]+)/);
    if (t && t[1].trim() !== 'none') assert.match(t[1], /var\(--nv-mov(-rapido)?\)/, r.seletor);
    const anim = r.corpo.match(/(?:^|[;\s])animation:\s*([^;]+)/);
    if (anim && anim[1].trim() !== 'none') assert.match(anim[1], /var\(--nv-(mov|letreiro-vel)\)/, `${r.seletor}: duração fora dos tokens`);
  }
});

test('CSS dos efeitos: as animações usadas só mexem em transform e opacity', () => {
  const usadas = new Set(doEfeito.flatMap((r) => [...r.corpo.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1])).filter((n) => n !== 'none'));
  assert.deepEqual([...usadas].sort(), ['nv-gira', 'nv-letreiro', 'nv-reluz', 'nv-reluz-de-novo']);
  for (const nome of usadas) {
    const props = [...keyframes[nome].matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
    for (const p of props) assert.ok(['transform', 'opacity'].includes(p), `${nome} anima ${p}`);
  }
});

test('nenhum @keyframes do layout anima width, height, top, left ou background-position', () => {
  assert.ok(Object.keys(keyframes).length >= 8);
  for (const [nome, corpo] of Object.entries(keyframes)) {
    assert.doesNotMatch(corpo, /(^|[\s;{])(width|height|top|left|right|bottom|background-position|background)\s*:/, nome);
  }
});

test('cada efeito tem regra no movimento reduzido, sem deslocar nem escalar', () => {
  const red = regrasReduzidas();
  for (const c of CLASSES) assert.ok(red.some((r) => r.seletor.includes(c)), `falta ${c} no movimento reduzido`);
  const corpo = (s) => red.find((r) => r.seletor.split(',').map((x) => x.trim()).includes(s))?.corpo ?? '';
  assert.match(corpo('.nv-letreiro[data-pronto] .nv-letreiro__faixa'), /animation:\s*none/);
  assert.match(corpo('.nv-letreiro[data-pronto]'), /overflow-x:\s*auto/);
  assert.match(corpo(".nv-letreiro__trilho[aria-hidden='true']"), /display:\s*none/);
  assert.match(corpo('.nv-borda-viva::before'), /animation:\s*none/);
  assert.match(corpo('.nv-texto-gradiente::before'), /display:\s*none/);
  assert.match(corpo('.nv-palavra-gira__palavra'), /transition:\s*none/);
  assert.match(corpo('.nv-cartao-3d'), /transform:\s*none/);
  assert.doesNotMatch(reduzido, /translate|scale/);
});

test('letreiro pausa no hover e no foco; variáveis --nv-letreiro-vel e --nv-borda-cor definidas', () => {
  assert.match(css, /\.nv-letreiro:is\(:hover, :focus-within\) \.nv-letreiro__faixa\s*\{\s*animation-play-state:\s*paused/);
  assert.match(css, /@keyframes nv-letreiro\s*\{\s*to\s*\{\s*transform:\s*translateX\(-50%\)/);
  assert.match(css, /\.nv-letreiro\s*\{[^}]*--nv-letreiro-vel:\s*\d+s/);
  assert.match(css, /\.nv-borda-viva\s*\{[^}]*--nv-borda-cor:\s*var\(--primary\)/);
  assert.match(css, /\.nv-borda-viva::before\s*\{[^}]*conic-gradient/);
  assert.match(css, /\.nv-cartao-3d\s*\{[^}]*rotateX\(var\(--nv-inclina-x\)\) rotateY\(var\(--nv-inclina-y\)\)/);
  // Sem JS nada some: o letreiro só esconde a sobra depois que o script marcou data-pronto.
  assert.match(css, /\.nv-letreiro\s*\{[^}]*overflow-x:\s*auto/);
});

test('texto em gradiente: as duas pontas com contraste AA no claro e no escuro', () => {
  const m = css.match(/\.nv-texto-gradiente\s*\{[^}]*background-image:\s*linear-gradient\(90deg, var\(--([\w-]+)\), var\(--([\w-]+)\)\)/);
  assert.ok(m, 'o gradiente mudou de formato');
  for (const modo of ['claro', 'escuro']) {
    const t = resolver('nuvytech', modo);
    for (const cor of [m[1], m[2]]) {
      for (const fundo of ['background', 'card']) {
        const r = contraste(rgb(t[cor]), rgb(t[fundo]));
        assert.ok(r >= 4.5, `${cor} sobre ${fundo} no ${modo}: ${r.toFixed(2)}`);
      }
    }
  }
});
