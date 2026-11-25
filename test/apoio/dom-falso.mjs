// DOM falso, pequeno, para rodar os modelos JS em node:vm sem navegador.
// Cobre só o que os modelos usam: elementos, texto, atributos, classes, estilo, eventos com
// propagação, foco, seletores simples (tag, .classe, [atributo], [atributo="valor"], descendente e
// vírgula) e um relógio falso (performance.now, setTimeout, setInterval e requestAnimationFrame).
// innerHTML, outerHTML e insertAdjacentHTML lançam erro: os modelos não podem usar HTML em texto.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const lerArq = (p) => readFileSync(join(RAIZ, p), 'utf8');

class Evento {
  constructor(tipo, dados = {}) {
    this.type = tipo;
    this.bubbles = dados.bubbles ?? true;
    this.defaultPrevented = false;
    this.parado = false;
    Object.assign(this, dados);
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.parado = true; }
}

class Alvo {
  constructor() { this.ouvintes = {}; }
  addEventListener(tipo, fn) { (this.ouvintes[tipo] ||= []).push(fn); }
  removeEventListener(tipo, fn) { this.ouvintes[tipo] = (this.ouvintes[tipo] || []).filter((f) => f !== fn); }
}

class Texto {
  constructor(dono, texto) { this.ownerDocument = dono; this.nodeType = 3; this.data = String(texto); this.parentNode = null; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
  get nextSibling() { return irmao(this, 1); }
  cloneNode() { return new Texto(this.ownerDocument, this.data); }
}

function irmao(no, passo) {
  const pai = no.parentNode;
  if (!pai) return null;
  const i = pai.childNodes.indexOf(no);
  return pai.childNodes[i + passo] ?? null;
}

function proibido(nome) {
  return { get() { throw new Error(`${nome} não pode ser usado`); }, set() { throw new Error(`${nome} não pode ser usado`); } };
}

class Elemento extends Alvo {
  constructor(dono, tag) {
    super();
    this.ownerDocument = dono;
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.atributos = {};
    this.largura = 0;
    this.altura = 0;
    this.capturas = [];
    const escritas = (this.escritasDeEstilo = []);
    const props = {};
    const base = {
      setProperty(k, v) { escritas.push(k); props[k] = String(v); },
      getPropertyValue(k) { return props[k] ?? ''; },
      removeProperty(k) { escritas.push(k); delete props[k]; },
    };
    this.style = new Proxy(base, {
      get(alvo, k) { return k in alvo ? alvo[k] : props[k] ?? ''; },
      set(alvo, k, v) { escritas.push(k); props[k] = String(v); return true; },
    });
    const el = this;
    this.classList = {
      lista() { return (el.atributos.class || '').split(/\s+/).filter(Boolean); },
      add(...cs) { el.atributos.class = [...new Set([...this.lista(), ...cs])].join(' '); },
      remove(...cs) { el.atributos.class = this.lista().filter((c) => !cs.includes(c)).join(' '); },
      contains(c) { return this.lista().includes(c); },
      toggle(c, forcar) {
        const ter = forcar ?? !this.contains(c);
        if (ter) this.add(c); else this.remove(c);
        return ter;
      },
    };
  }
  get className() { return this.atributos.class || ''; }
  set className(v) { this.atributos.class = String(v); }
  get id() { return this.atributos.id || ''; }
  set id(v) { this.atributos.id = String(v); }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null; }
  get firstElementChild() { return this.children[0] ?? null; }
  get nextSibling() { return irmao(this, 1); }
  get nextElementSibling() {
    let n = this.nextSibling;
    while (n && n.nodeType !== 1) n = n.nextSibling;
    return n;
  }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get isConnected() {
    let n = this;
    while (n.parentNode) n = n.parentNode;
    return n === this.ownerDocument.documentElement;
  }
  get offsetWidth() { return this.largura; }
  get offsetHeight() { return this.altura; }
  get offsetParent() { return this.isConnected ? this.parentNode : null; }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(v) {
    for (const n of this.childNodes) n.parentNode = null;
    this.childNodes = [];
    if (v !== '' && v != null) this.appendChild(new Texto(this.ownerDocument, v));
  }
  get tabIndex() { return Number(this.atributos.tabindex ?? -1); }
  set tabIndex(v) { this.atributos.tabindex = String(v); }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  getAttribute(k) { return this.atributos[k] ?? null; }
  removeAttribute(k) { delete this.atributos[k]; }
  hasAttribute(k) { return k in this.atributos; }
  toggleAttribute(k, forcar) {
    const ter = forcar ?? !this.hasAttribute(k);
    if (ter) this.atributos[k] = ''; else delete this.atributos[k];
    return ter;
  }
  appendChild(n) { return this.insertBefore(n, null); }
  append(...ns) { for (const n of ns) this.appendChild(typeof n === 'string' ? new Texto(this.ownerDocument, n) : n); }
  insertBefore(n, ref) {
    if (n.parentNode) n.parentNode.removeChild(n);
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n);
    n.parentNode = this;
    this.ownerDocument.insercoes++;
    return n;
  }
  removeChild(n) {
    const i = this.childNodes.indexOf(n);
    if (i < 0) throw new Error('não é filho');
    this.childNodes.splice(i, 1);
    n.parentNode = null;
    return n;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  contains(n) {
    for (let x = n; x; x = x.parentNode) if (x === this) return true;
    return false;
  }
  cloneNode(fundo) {
    const c = new Elemento(this.ownerDocument, this.tagName);
    c.atributos = { ...this.atributos };
    if (fundo) for (const n of this.childNodes) c.appendChild(n.cloneNode(true));
    return c;
  }
  matches(seletor) { return combina(this, seletor); }
  closest(seletor) {
    for (let x = this; x && x.nodeType === 1; x = x.parentNode) if (combina(x, seletor)) return x;
    return null;
  }
  querySelectorAll(seletor) {
    const achados = [];
    const andar = (el) => {
      for (const f of el.children) {
        if (combina(f, seletor, this)) achados.push(f);
        andar(f);
      }
    };
    andar(this);
    return achados;
  }
  querySelector(seletor) { return this.querySelectorAll(seletor)[0] ?? null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.largura, height: this.altura, right: this.largura, bottom: this.altura }; }
  setPointerCapture(id) { this.capturas.push(id); }
  releasePointerCapture() {}
  hasPointerCapture(id) { return this.capturas.includes(id); }
  focus() {
    const d = this.ownerDocument;
    const antes = d.activeElement;
    if (antes === this) return;
    d.activeElement = this;
    if (antes && antes !== d.body) antes.dispatchEvent(new Evento('focusout', { relatedTarget: this }));
    this.dispatchEvent(new Evento('focusin', { relatedTarget: antes }));
  }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body; }
  dispatchEvent(ev) {
    ev.target = this;
    const caminho = [];
    for (let x = this; x; x = x.parentNode) caminho.push(x);
    if (this.isConnected) caminho.push(this.ownerDocument);
    for (const no of ev.bubbles ? caminho : [this]) {
      ev.currentTarget = no;
      for (const f of [...(no.ouvintes[ev.type] || [])]) f.call(no, ev);
      if (ev.parado) break;
    }
    return !ev.defaultPrevented;
  }
}
for (const nome of ['innerHTML', 'outerHTML']) Object.defineProperty(Elemento.prototype, nome, proibido(nome));
Elemento.prototype.insertAdjacentHTML = () => { throw new Error('insertAdjacentHTML não pode ser usado'); };

// Seletores: lista separada por vírgula; cada um, compostos separados por espaço (descendente).
function combina(el, seletor, raiz = null) {
  return seletor.split(',').some((s) => {
    const partes = s.trim().split(/\s+/);
    if (!composto(el, partes[partes.length - 1])) return false;
    let atual = el.parentNode;
    for (let i = partes.length - 2; i >= 0; i--) {
      while (atual && atual.nodeType === 1 && atual !== raiz && !composto(atual, partes[i])) atual = atual.parentNode;
      if (!atual || atual.nodeType !== 1 || atual === raiz) return false;
      atual = atual.parentNode;
    }
    return true;
  });
}
function composto(el, s) {
  const re = /([a-zA-Z][\w-]*)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;
  let m;
  let usado = 0;
  while ((m = re.exec(s))) {
    usado += m[0].length;
    if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && !el.classList.contains(m[2])) return false;
    if (m[3] && el.id !== m[3]) return false;
    if (m[4] && (!el.hasAttribute(m[4]) || (m[5] !== undefined && el.getAttribute(m[4]) !== m[5]))) return false;
  }
  if (usado !== s.length) throw new Error(`seletor não suportado no DOM falso: ${s}`);
  return true;
}

class Documento extends Alvo {
  constructor() {
    super();
    this.insercoes = 0;
    this.documentElement = new Elemento(this, 'html');
    this.body = new Elemento(this, 'body');
    this.documentElement.appendChild(this.body);
    this.activeElement = this.body;
    this.visibilityState = 'visible';
    this.readyState = 'complete';
  }
  get hidden() { return this.visibilityState === 'hidden'; }
  createElement(tag) { return new Elemento(this, tag); }
  createTextNode(t) { return new Texto(this, t); }
  querySelectorAll(s) { return combina(this.documentElement, s) ? [this.documentElement, ...this.documentElement.querySelectorAll(s)] : this.documentElement.querySelectorAll(s); }
  querySelector(s) { return this.querySelectorAll(s)[0] ?? null; }
  getElementById(id) { return this.querySelector(`#${id}`); }
  dispatchEvent(ev) {
    ev.target = this;
    ev.currentTarget = this;
    for (const f of [...(this.ouvintes[ev.type] || [])]) f.call(this, ev);
    return !ev.defaultPrevented;
  }
}

// Relógio falso: o tempo só anda com avancar(ms).
export function relogio() {
  let agora = 0;
  let seq = 0;
  let timers = [];
  const quadros = [];
  const r = {
    get agora() { return agora; },
    quadrosPedidos: 0,
    now: () => agora,
    setTimeout(fn, ms = 0) { const id = ++seq; timers.push({ id, quando: agora + Math.max(0, ms), fn }); return id; },
    clearTimeout(id) { timers = timers.filter((t) => t.id !== id); },
    setInterval(fn, ms) { const id = ++seq; timers.push({ id, quando: agora + ms, fn, cada: ms }); return id; },
    clearInterval(id) { r.clearTimeout(id); },
    requestAnimationFrame(fn) { r.quadrosPedidos++; quadros.push(fn); return quadros.length; },
    cancelAnimationFrame() {},
    // Roda os quadros pendentes (um "frame").
    quadro() { const fs = quadros.splice(0); for (const f of fs) f(agora); },
    pendentes: () => timers.length,
    avancar(ms) {
      const fim = agora + ms;
      for (;;) {
        timers.sort((a, b) => a.quando - b.quando || a.id - b.id);
        const t = timers[0];
        if (!t || t.quando > fim) break;
        agora = t.quando;
        if (t.cada) t.quando += t.cada; else timers.shift();
        t.fn();
      }
      agora = fim;
    },
  };
  return r;
}

// Monta documento + janela e roda o código do modelo num contexto novo.
export function ambiente({ midias = {}, semRaf = false } = {}) {
  const document = new Documento();
  const clock = relogio();
  const avisosConsole = [];
  const ctx = {
    document,
    performance: { now: clock.now },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    matchMedia: (q) => ({ media: q, matches: Boolean(midias[q]), addEventListener() {}, addListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    console: { warn: (...a) => avisosConsole.push(a.join(' ')), log() {}, error() {} },
    Promise,
    Error,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    Map,
    WeakMap,
    Set,
    Intl,
    Infinity,
    isFinite,
  };
  if (!semRaf) {
    ctx.requestAnimationFrame = clock.requestAnimationFrame;
    ctx.cancelAnimationFrame = clock.cancelAnimationFrame;
  }
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  return {
    ctx,
    document,
    clock,
    avisosConsole,
    rodar(codigo, extra = {}) { Object.assign(ctx, extra); vm.runInContext(codigo, ctx); return ctx; },
    evento(alvo, tipo, dados) { return alvo.dispatchEvent(new Evento(tipo, dados)); },
    novoEvento: (tipo, dados) => new Evento(tipo, dados),
  };
}

// Lista de nós (em profundidade) para procurar coisas no DOM falso.
export function todos(raiz) {
  const lista = [];
  const andar = (n) => { for (const f of n.childNodes || []) { lista.push(f); andar(f); } };
  andar(raiz);
  return lista;
}
