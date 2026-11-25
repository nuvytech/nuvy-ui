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
  assert.equal(a.el.querySelectorAll('.nv-letreiro__pausa').length, 1, 'montar de novo não duplica o botão');
});

test('letreiro: botão de pausar/continuar com aria-pressed, fora da faixa que gira', () => {
  const a = carregar(letreiroDom);
  const botao = a.el.querySelector('.nv-letreiro__pausa');
  assert.ok(botao, 'faltou o botão de pausa');
  assert.equal(botao.tagName.toLowerCase(), 'button');
  assert.equal(botao.getAttribute('type'), 'button');
  assert.equal(botao.getAttribute('aria-label'), 'Pausar o letreiro');
  assert.equal(botao.getAttribute('aria-pressed'), 'false');
  assert.equal(botao.parentNode, a.el, 'o botão fica no letreiro, não dentro da faixa');
  assert.equal(a.el.querySelector('.nv-letreiro__faixa').querySelectorAll('button').length, 0);
  a.evento(botao, 'click');
  assert.equal(botao.getAttribute('aria-pressed'), 'true');
  assert.ok(a.el.hasAttribute('data-pausado'));
  a.evento(botao, 'click');
  assert.equal(botao.getAttribute('aria-pressed'), 'false');
  assert.equal(a.el.hasAttribute('data-pausado'), false);
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
  // Dois quadros: no primeiro o navegador ainda desenha a posição de entrada; no segundo ela anda.
  a.clock.quadro();
  assert.ok(nova.hasAttribute('data-entrando'), 'um quadro só pode pular a transição');
  a.clock.quadro();
  assert.equal(nova.hasAttribute('data-entrando'), false);
  a.clock.avancar(250);
  assert.equal(visivelDe(a.el).querySelectorAll('.nv-palavra-gira__palavra').length, 1, 'a velha sai depois do --nv-mov');
  a.clock.avancar(5000);
  assert.equal(palavraAtual(a.el), 'sites', 'volta ao começo');
  assert.equal(leitor.textContent, 'sites', 'o leitor de tela não muda');
});

test('palavra que gira: para sozinha depois das voltas (WCAG 2.2.2), na primeira palavra', () => {
  // 3 palavras x 2 voltas (padrão) = 6 trocas; a 6ª volta para "sites" e para.
  const a = carregar(palavraDom());
  a.clock.avancar(15000);
  a.clock.quadro();
  a.clock.quadro();
  a.clock.avancar(1000);
  assert.equal(palavraAtual(a.el), 'sites');
  assert.ok(a.el.hasAttribute('data-parado'));
  assert.equal(a.clock.pendentes(), 0, 'não sobra intervalo rodando');
  a.clock.avancar(20000);
  assert.equal(palavraAtual(a.el), 'sites');

  // data-voltas="1" para depois de 3 trocas; valor fora da faixa vira o máximo (3).
  const b = carregar((doc) => {
    const r = palavraDom()(doc);
    r.el.setAttribute('data-voltas', '1');
    return r;
  });
  b.clock.avancar(7500);
  assert.ok(b.el.hasAttribute('data-parado'));
  const c = carregar((doc) => {
    const r = palavraDom()(doc);
    r.el.setAttribute('data-voltas', '99');
    return r;
  });
  c.clock.avancar(20000);
  assert.equal(c.el.hasAttribute('data-parado'), false, '3 voltas = 9 trocas = 22,5 s');
  c.clock.avancar(2500);
  assert.ok(c.el.hasAttribute('data-parado'));
});

test('palavra que gira: só gira enquanto está na tela', () => {
  const vistos = [];
  class Observador {
    constructor(cb) { this.cb = cb; this.alvos = new Set(); vistos.push(this); }
    observe(el) { this.alvos.add(el); }
    unobserve(el) { this.alvos.delete(el); }
  }
  const a = carregar(palavraDom(), {}, { IntersectionObserver: Observador });
  assert.equal(a.clock.pendentes(), 0, 'fora da tela não liga o intervalo');
  a.clock.avancar(10000);
  assert.equal(palavraAtual(a.el), 'sites');
  vistos[0].cb([{ target: a.el, isIntersecting: true }]);
  a.clock.avancar(2500);
  assert.equal(palavraAtual(a.el), 'lojas');
  vistos[0].cb([{ target: a.el, isIntersecting: false }]);
  a.clock.avancar(10000);
  assert.equal(palavraAtual(a.el), 'lojas', 'saiu da tela, parou');
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
  assert.equal(r.clock.pendentes(), 0, 'com movimento reduzido nem liga o intervalo');
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
  const mover = (clientX, clientY) => {
    a.evento(a.el, 'pointermove', { pointerType: 'mouse', clientX, clientY });
    a.clock.quadro(); // a escrita sai no próximo quadro, uma só por quadro
  };
  a.evento(a.el, 'pointerenter', { pointerType: 'mouse', bubbles: false });
  assert.ok(a.el.hasAttribute('data-inclinado'), 'o transform só liga ao entrar');
  mover(200, 0);
  assert.equal(graus(a.el, 'y'), 6);
  assert.equal(graus(a.el, 'x'), 6);
  mover(-5000, 9000);
  assert.equal(graus(a.el, 'y'), -6);
  assert.equal(graus(a.el, 'x'), -6);
  mover(100, 50);
  assert.equal(graus(a.el, 'y'), 0);
  mover(150, 25);
  assert.equal(graus(a.el, 'y'), 3);
  assert.equal(graus(a.el, 'x'), 3);
  a.evento(a.el, 'pointerleave', { bubbles: false });
  a.clock.quadro();
  assert.equal(a.el.style.getPropertyValue('--nv-inclina-x'), '0.00deg');
  assert.equal(a.el.style.getPropertyValue('--nv-inclina-y'), '0.00deg');
  assert.ok(a.el.hasAttribute('data-inclinado'), 'segura o transform enquanto volta a 0');
  a.clock.avancar(1000);
  assert.equal(a.el.hasAttribute('data-inclinado'), false, 'parado, sem transform próprio');
  for (const k of a.el.escritasDeEstilo) assert.match(k, /^--nv-inclina-[xy]$/);
});

test('cartão 3D: vários pointermove no mesmo quadro viram uma escrita só (sem ler layout a cada evento)', () => {
  const a = carregar(cartaoDom, { midias: { [FINO]: true } });
  let leituras = 0;
  const original = a.el.getBoundingClientRect.bind(a.el);
  a.el.getBoundingClientRect = () => { leituras++; return original(); };
  a.evento(a.el, 'pointerenter', { pointerType: 'mouse', bubbles: false });
  for (let i = 0; i < 5; i++) a.evento(a.el, 'pointermove', { pointerType: 'mouse', clientX: 40 * i, clientY: 0 });
  assert.equal(a.el.style.getPropertyValue('--nv-inclina-y'), '', 'nada escrito antes do quadro');
  a.clock.quadro();
  assert.equal(leituras, 1, 'o retângulo é lido uma vez, na entrada');
  assert.equal(a.el.escritasDeEstilo.length, 2, 'uma escrita de x e uma de y');
  assert.equal(graus(a.el, 'y'), 3.6, 'vale o último ponto do quadro');
});

test('cartão 3D: sem ponteiro fino, com toque ou com movimento reduzido não inclina', () => {
  const grosso = carregar(cartaoDom);
  grosso.evento(grosso.el, 'pointermove', { pointerType: 'mouse', clientX: 200, clientY: 0 });
  grosso.clock.quadro();
  assert.equal(grosso.el.style.getPropertyValue('--nv-inclina-y'), '');
  const toque = carregar(cartaoDom, { midias: { [FINO]: true } });
  toque.evento(toque.el, 'pointermove', { pointerType: 'touch', clientX: 200, clientY: 0 });
  toque.clock.quadro();
  assert.equal(toque.el.style.getPropertyValue('--nv-inclina-y'), '');
  const red = carregar(cartaoDom, { midias: { [FINO]: true, [REDUZ]: true } });
  red.evento(red.el, 'pointermove', { pointerType: 'mouse', clientX: 200, clientY: 0 });
  red.clock.quadro();
  assert.equal(red.el.style.getPropertyValue('--nv-inclina-y'), '');
  for (const x of [grosso, toque, red]) assert.equal(x.el.hasAttribute('data-inclinado'), false);
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
  assert.match(corpo('.nv-letreiro__pausa'), /display:\s*none/, 'sem giro, o botão de pausa some');
  assert.match(corpo('.nv-borda-viva::before'), /animation:\s*none/);
  assert.match(corpo('.nv-texto-gradiente::before'), /display:\s*none/);
  assert.match(corpo('.nv-palavra-gira__palavra'), /transition:\s*none/);
  assert.match(corpo('.nv-cartao-3d[data-inclinado]'), /transform:\s*none/);
  assert.doesNotMatch(reduzido, /translate|scale/);
});

test('letreiro pausa no hover e no foco; variáveis --nv-letreiro-vel e --nv-borda-cor definidas', () => {
  assert.match(css, /\.nv-letreiro:is\(:hover, :focus-within, \[data-pausado\]\) \.nv-letreiro__faixa\s*\{\s*animation-play-state:\s*paused/);
  assert.match(css, /\.nv-letreiro__pausa:focus-visible\s*\{[^}]*box-shadow:\s*var\(--nv-foco\)/);
  assert.match(css, /@keyframes nv-letreiro\s*\{\s*to\s*\{\s*transform:\s*translateX\(-50%\)/);
  assert.match(css, /\.nv-letreiro\s*\{[^}]*--nv-letreiro-vel:\s*\d+s/);
  assert.match(css, /\.nv-borda-viva\s*\{[^}]*--nv-borda-cor:\s*var\(--primary\)/);
  assert.match(css, /\.nv-borda-viva::before\s*\{[^}]*conic-gradient/);
  // O transform só existe enquanto inclina: parado, o cartão não ganha contexto de empilhamento nem
  // prende filhos position: fixed, e não apaga o transform de outra classe.
  assert.match(css, /\.nv-cartao-3d\[data-inclinado\]\s*\{[^}]*rotateX\(var\(--nv-inclina-x\)\) rotateY\(var\(--nv-inclina-y\)\)/);
  assert.doesNotMatch(css.match(/\.nv-cartao-3d\s*\{[^}]*\}/)[0], /transform/);
  // Sem JS nada some: o letreiro só esconde a sobra depois que o script marcou data-pronto.
  assert.match(css, /\.nv-letreiro\s*\{[^}]*overflow-x:\s*auto/);
});

test('texto em gradiente: as pontas e o meio do caminho com contraste AA no claro e no escuro', () => {
  const m = css.match(/\.nv-texto-gradiente\s*\{[^}]*background-image:\s*linear-gradient\(90deg, var\(--([\w-]+)\), var\(--([\w-]+)\)\)/);
  assert.ok(m, 'o gradiente mudou de formato');
  // O navegador mistura as pontas em sRGB: o meio pode ficar mais claro que as duas, então mede também 25%, 50% e 75%.
  const misturar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  for (const modo of ['claro', 'escuro']) {
    const t = resolver('nuvytech', modo);
    const [ini, fim] = [rgb(t[m[1]]), rgb(t[m[2]])];
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const cor = misturar(ini, fim, p);
      for (const fundo of ['background', 'card']) {
        const r = contraste(cor, rgb(t[fundo]));
        assert.ok(r >= 4.5, `${m[1]}→${m[2]} em ${p * 100}% sobre ${fundo} no ${modo}: ${r.toFixed(2)}`);
      }
    }
  }
});

test('texto em gradiente: no alto contraste do Windows volta à cor do sistema', () => {
  const ini = css.indexOf('@media (forced-colors: active)');
  assert.ok(ini >= 0, 'falta o bloco forced-colors');
  const bloco = regras(css.slice(css.indexOf('{', ini) + 1));
  const corpo = (s) => bloco.find((r) => r.seletor === s)?.corpo ?? '';
  assert.match(corpo('.nv-texto-gradiente'), /background:\s*none/);
  assert.match(corpo('.nv-texto-gradiente'), /-webkit-text-fill-color:\s*currentColor/);
  assert.match(corpo('.nv-texto-gradiente::before'), /display:\s*none/);
});

// ---------- prévia e documentação ----------

test('previa/efeitos.html usa só classes que existem e carrega os arquivos certos', () => {
  const html = lerArq('previa/efeitos.html');
  for (const arq of ['dist/nuvytech/tokens.css', 'dist/nuvytech/layout.css', 'modelos/nuvy-efeitos.js', 'modelos/nuvy-aviso.js', 'modelos/nuvy-numero.js']) {
    assert.ok(html.includes(`../${arq}`), `a prévia não carrega ${arq}`);
  }
  const existentes = new Set([...css.matchAll(/\.(nv-[\w-]+)/g)].map((m) => m[1]));
  const usadas = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  const faltando = [...usadas].filter((c) => !existentes.has(c));
  assert.deepEqual(faltando, []);
  for (const c of CLASSES) assert.ok(usadas.has(c), `a prévia não mostra .${c}`);
  assert.doesNotMatch(html, /innerHTML/);
});

test('docs: efeitos.md e movimento.md existem, estão no README e citam todas as classes', () => {
  const readme = lerArq('README.md');
  assert.match(readme, /docs\/efeitos\.md/);
  assert.match(readme, /docs\/movimento\.md/);
  const efeitos = lerArq('docs/efeitos.md');
  for (const c of CLASSES) assert.ok(efeitos.includes(`.${c}`), `efeitos.md não cita .${c}`);
  assert.match(efeitos, /afterNextRender/);
  const mov = lerArq('docs/movimento.md');
  for (const t of ['--nv-mov-rapido', '--nv-mov`', '--nv-mov-curva', 'prefers-reduced-motion']) assert.ok(mov.includes(t), t);
});

test('texto em gradiente corta o reflexo com overflow: clip (sem rolagem lateral na página)', () => {
  assert.match(css, /\.nv-texto-gradiente\s*\{[^}]*overflow:\s*clip/);
  assert.match(css, /\.nv-botao--brilho\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.nv-borda-viva\s*\{[^}]*overflow:\s*hidden/);
});
