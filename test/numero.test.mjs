import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as formato from '../modelos/nuvy-numero-formato.mjs';
import { ambiente, lerArq, todos } from './apoio/dom-falso.mjs';
import { css, reduzido, regrasDe, regrasReduzidas, propsDeTransicao } from './apoio/css.mjs';

const { partes, formatar } = formato;
const REDUZ = '(prefers-reduced-motion: reduce)';

// O modelo é um módulo ES; no vm trocamos o import pelo formatador já carregado.
const fonte = lerArq('modelos/nuvy-numero.js');
const codigo = fonte.replace(/^import \{ partes, formatar, valido \} from '\.\/nuvy-numero-formato\.mjs';$/m, 'const { partes, formatar, valido } = __formato;');

function carregar(opcoes) {
  assert.notEqual(codigo, fonte, 'a linha de import do formatador mudou; ajuste o teste');
  const amb = ambiente(opcoes);
  amb.rodar(codigo, { __formato: formato });
  return amb;
}

function numero(amb, attrs = {}, texto = '') {
  const el = amb.document.createElement('span');
  el.className = 'nv-numero';
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (texto) el.textContent = texto;
  amb.document.body.appendChild(el);
  return el;
}

const colunas = (el) => todos(el).filter((n) => n.nodeType === 1 && n.classList.contains('nv-numero__coluna'));

test('partes: ordem dos dígitos e símbolos, e chaves estáveis entre 1234 e 1235', () => {
  const a = partes(1234);
  const b = partes(1235);
  assert.deepEqual(a.map((p) => p.texto).join(''), formatar(1234));
  assert.deepEqual(a.map((p) => p.tipo), ['digito', 'simbolo', 'digito', 'digito', 'digito']);
  assert.deepEqual(a.map((p) => p.chave), b.map((p) => p.chave));
  assert.deepEqual(a.map((p) => p.chave), ['i3', 'g3', 'i2', 'i1', 'i0']);
  // Só a unidade muda.
  const mudou = a.filter((p, i) => p.texto !== b[i].texto).map((p) => p.chave);
  assert.deepEqual(mudou, ['i0']);
  // Moeda com centavos: a vírgula é "d", os centavos f0/f1 e o símbolo da moeda um "s:".
  const m = partes(1234.5, { estilo: 'moeda' });
  assert.equal(m.map((p) => p.texto).join(''), formatar(1234.5, { estilo: 'moeda' }));
  assert.ok(m.some((p) => p.chave === 'd'));
  assert.ok(m.some((p) => p.chave === 'f1'));
  assert.ok(m.some((p) => p.chave.startsWith('s:currency')));
  // 99 -> 100: as chaves que ficam continuam iguais (i0, i1) e só entra i2.
  const novas = partes(100).map((p) => p.chave).filter((c) => !partes(99).some((p) => p.chave === c));
  assert.deepEqual(novas, ['i2']);
});

test('formato inválido não quebra: cai no decimal', () => {
  assert.equal(formatar(1, { estilo: 'moeda', moeda: 'XX!' }), formatar(1));
  assert.equal(formatar(0.5, { estilo: 'porcentagem' }), '50%');
  assert.equal(formatar(1234, { agrupar: false }), '1234');
});

test('montar (no cliente): uma coluna por dígito, tudo aria-hidden, texto formatado no .nv-so-leitor e sem aria-label', () => {
  const amb = carregar();
  const el = numero(amb, { 'data-valor': '1234.5', 'data-formato': '{"estilo":"moeda"}' });
  amb.ctx.nuvyNumero.montar(el);
  const esperado = formatar(1234.5, { estilo: 'moeda' });
  // aria-label num <span> genérico não é confiável (ARIA 1.2): quem fala é o .nv-so-leitor.
  assert.equal(el.hasAttribute('aria-label'), false);
  const cols = colunas(el);
  assert.equal(cols.length, partes(1234.5, { estilo: 'moeda' }).filter((p) => p.tipo === 'digito').length);
  for (const c of cols) {
    assert.equal(c.getAttribute('aria-hidden'), 'true');
    assert.equal(c.parentNode.getAttribute('aria-hidden'), 'true');
    assert.equal(c.children.length, 10);
  }
  assert.equal(el.querySelector('.nv-numero__visual').getAttribute('aria-hidden'), 'true');
  assert.equal(el.querySelector('.nv-so-leitor').textContent, esperado);
  // A unidade (último dígito: 0 do "50" de centavos) fica na posição certa.
  assert.equal(cols[cols.length - 1].style.transform, 'translateY(0%)');
  assert.equal(cols[0].style.transform, 'translateY(-10%)');
});

test('atualizar: só a coluna que mudou rola e o leitor recebe o texto novo', () => {
  const amb = carregar();
  const el = numero(amb, { 'data-valor': '1234' });
  const { nuvyNumero } = amb.ctx;
  nuvyNumero.montar(el);
  const antes = colunas(el);
  nuvyNumero.atualizar(el, 1235);
  const depois = colunas(el);
  assert.equal(depois.length, antes.length);
  for (let i = 0; i < antes.length; i++) assert.equal(depois[i], antes[i], 'a coluna foi recriada');
  assert.equal(depois[3].style.transform, 'translateY(-50%)');
  assert.equal(el.hasAttribute('aria-label'), false);
  assert.equal(el.querySelector('.nv-so-leitor').textContent, formatar(1235));
});

test('100 -> 99: o dígito que sai fica com data-saindo e só é removido depois da transição', () => {
  const amb = carregar();
  const el = numero(amb, { 'data-valor': '100' });
  amb.ctx.nuvyNumero.montar(el);
  amb.ctx.nuvyNumero.atualizar(el, 99);
  const visual = el.querySelector('.nv-numero__visual');
  const saindo = visual.children.filter((n) => n.hasAttribute('data-saindo'));
  assert.equal(saindo.length, 1);
  assert.equal(colunas(el).length, 3);
  amb.clock.avancar(300); // --nv-mov (200) + 50 de folga
  assert.equal(colunas(el).length, 2);
  assert.equal(visual.children.filter((n) => n.hasAttribute('data-entrando')).length, 0);
});

test('valor inválido (NaN, Infinity, texto) é ignorado com aviso e o DOM não muda', () => {
  const amb = carregar();
  const el = numero(amb, { 'data-valor': '42' }, '42');
  amb.ctx.nuvyNumero.montar(el);
  const insercoes = amb.document.insercoes;
  for (const v of [NaN, Infinity, '43', undefined]) amb.ctx.nuvyNumero.atualizar(el, v);
  assert.equal(el.textContent, '42');
  assert.equal(amb.document.insercoes, insercoes);
  assert.equal(amb.avisosConsole.length, 4);
});

test('data-formato que não é JSON gera aviso e usa o decimal', () => {
  const amb = carregar();
  const el = numero(amb, { 'data-valor': '1234', 'data-formato': '{quebrado' });
  amb.ctx.nuvyNumero.montar(el);
  assert.equal(el.querySelector('.nv-so-leitor').textContent, formatar(1234));
  assert.equal(amb.avisosConsole.length, 1);
});

test('movimento reduzido: atualizar só troca o textContent, sem colunas', () => {
  const amb = carregar({ midias: { [REDUZ]: true } });
  const el = numero(amb, { 'data-valor': '10' }, '10');
  amb.ctx.nuvyNumero.atualizar(el, 11);
  assert.equal(el.textContent, '11');
  assert.equal(el.childNodes.length, 1);
  assert.equal(el.childNodes[0].nodeType, 3);
  assert.equal(colunas(el).length, 0);
  assert.equal(el.hasAttribute('aria-label'), false);
});

test('sem innerHTML: o fonte não usa HTML em texto (o DOM falso também lança se usar)', () => {
  for (const arq of ['modelos/nuvy-numero.js', 'modelos/nuvy-numero-formato.mjs']) {
    assert.doesNotMatch(lerArq(arq), /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  }
});

test('CSS: a coluna anima só transform com var(--nv-mov), tem regra de movimento reduzido e tabular-nums', () => {
  const [coluna] = regrasDe('.nv-numero__coluna').filter((r) => r.seletor === '.nv-numero__coluna');
  assert.ok(coluna, 'falta a regra .nv-numero__coluna');
  assert.deepEqual(propsDeTransicao(coluna.corpo), ['transform']);
  assert.match(coluna.corpo, /var\(--nv-mov\)/);
  for (const r of regrasDe('.nv-numero')) {
    for (const p of propsDeTransicao(r.corpo)) assert.ok(['transform', 'opacity'].includes(p), `${r.seletor} anima ${p}`);
  }
  assert.ok(regrasReduzidas().some((r) => r.seletor.includes('.nv-numero__coluna') && /transition:\s*none/.test(r.corpo)));
  assert.match(reduzido, /\.nv-numero__coluna/);
  assert.match(css, /\.nv-numero\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
});
