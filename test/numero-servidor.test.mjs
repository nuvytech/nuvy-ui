import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as formato from '../modelos/nuvy-numero-formato.mjs';
import { htmlNumero, escaparTexto, escaparAtributo } from '../modelos/nuvy-numero-servidor.mjs';
import { ambiente, lerArq, todos } from './apoio/dom-falso.mjs';

const codigo = lerArq('modelos/nuvy-numero.js').replace(
  /^import \{ partes, formatar, valido \} from '\.\/nuvy-numero-formato\.mjs';$/m,
  'const { partes, formatar, valido } = __formato;',
);
function carregar(opcoes) {
  const amb = ambiente(opcoes);
  amb.rodar(codigo, { __formato: formato });
  return amb;
}
const colunas = (el) => todos(el).filter((n) => n.nodeType === 1 && n.classList.contains('nv-numero__coluna'));

test('htmlNumero: "<img onerror>" sai escapado, sem nenhuma tag além do span', () => {
  const html = htmlNumero('<img src=x onerror=alert(1)>');
  assert.equal((html.match(/</g) || []).length, 2, html); // só <span ...> e </span>
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /data-valor=""/);
});

test('htmlNumero: número formatado, data-formato em JSON escapado e locale só quando muda', () => {
  const html = htmlNumero(1234.5, { estilo: 'moeda' });
  assert.ok(html.startsWith('<span class="nv-numero" data-valor="1234.5" '));
  assert.match(html, /data-formato="\{&quot;estilo&quot;:&quot;moeda&quot;\}"/);
  assert.ok(html.endsWith(`>${formato.formatar(1234.5, { estilo: 'moeda' })}</span>`));
  assert.doesNotMatch(html, /data-locale/);
  assert.match(htmlNumero(1, {}, 'en-US'), /data-locale="en-US"/);
  assert.match(htmlNumero('42'), /data-valor="42"[^>]*>42</);
  assert.match(htmlNumero(1, null), /data-formato="\{\}"/);
  // Opção com aspas não fecha o atributo.
  assert.doesNotMatch(htmlNumero(1, { moeda: '"><script>' }), /"><script>/);
});

test('escapar: aspas, crase e os cinco caracteres de HTML', () => {
  assert.equal(escaparTexto(`& < > " ' \``), '&amp; &lt; &gt; &quot; &#39; &#96;');
  assert.equal(escaparAtributo(`a"b'c\`d`), 'a&quot;b&#39;c&#96;d');
  assert.equal(escaparTexto(null), '');
  assert.equal(escaparAtributo(undefined), '');
  assert.equal(escaparTexto(12), '12');
});

test('escapar: remove os controles bidirecionais U+202E e U+2066', () => {
  assert.equal(escaparTexto('abc‮def'), 'abcdef');
  assert.equal(escaparAtributo('x⁦y⁩z‪'), 'xyz');
  assert.doesNotMatch(htmlNumero('1‮0'), /[‪-‮⁦-⁩]/);
});

test('grupo: três números atualizados num único requestAnimationFrame', () => {
  const amb = carregar();
  const raiz = amb.document.createElement('div');
  for (const [nome, v] of [['a', '1'], ['b', '2'], ['c', '3']]) {
    const el = amb.document.createElement('span');
    el.className = 'nv-numero';
    el.setAttribute('data-nome', nome);
    el.setAttribute('data-valor', v);
    el.textContent = v;
    raiz.appendChild(el);
  }
  amb.document.body.appendChild(raiz);
  amb.ctx.nuvyNumero.grupo(raiz, { a: 10, b: 20, c: 30 });
  assert.equal(amb.clock.quadrosPedidos, 1);
  assert.equal(raiz.children[0].textContent, '1', 'mudou antes do quadro');
  amb.clock.quadro();
  assert.deepEqual(raiz.children.map((el) => el.getAttribute('aria-label')), ['10', '20', '30']);
  // Também aceita lista, na ordem.
  amb.ctx.nuvyNumero.grupo(raiz, [7, 8, 9]);
  amb.clock.quadro();
  assert.equal(amb.clock.quadrosPedidos, 2);
  assert.deepEqual(raiz.children.map((el) => el.getAttribute('aria-label')), ['7', '8', '9']);
});

test('grupo sem requestAnimationFrame atualiza na hora', () => {
  const amb = carregar({ semRaf: true });
  const raiz = amb.document.createElement('div');
  const el = amb.document.createElement('span');
  el.className = 'nv-numero';
  raiz.appendChild(el);
  amb.ctx.nuvyNumero.grupo(raiz, [5]);
  assert.equal(el.textContent, '5');
});

test('hidratação: montar não mexe no texto do servidor; as colunas só nascem na 1ª atualização', () => {
  const amb = carregar();
  const html = htmlNumero(1234.5, { estilo: 'moeda' });
  const texto = formato.formatar(1234.5, { estilo: 'moeda' });
  // Monta o mesmo elemento que o navegador criaria a partir do HTML do servidor.
  const el = amb.document.createElement('span');
  el.className = 'nv-numero';
  el.setAttribute('data-valor', '1234.5');
  el.setAttribute('data-formato', '{"estilo":"moeda"}');
  el.textContent = texto;
  amb.document.body.appendChild(el);
  assert.ok(html.includes(`>${texto}<`));
  const insercoes = amb.document.insercoes;
  amb.ctx.nuvyNumero.montar(el);
  assert.equal(el.textContent, texto);
  assert.equal(amb.document.insercoes, insercoes);
  assert.equal(colunas(el).length, 0);
  assert.equal(el.getAttribute('aria-label'), texto);
  amb.ctx.nuvyNumero.atualizar(el, 1300);
  assert.ok(colunas(el).length > 0);
  assert.equal(el.getAttribute('aria-label'), formato.formatar(1300, { estilo: 'moeda' }));
});
