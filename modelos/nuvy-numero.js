/* nuvy-ui — número com dígitos que rolam (.nv-numero). Módulo ES, sem dependências além do formatador.
   Carregue: <script type="module" src="nuvy-numero.js"></script> (com nuvy-numero-formato.mjs na mesma pasta).
   Marcação: <span class="nv-numero" data-valor="1234.5" data-formato='{"estilo":"moeda","moeda":"BRL"}'>R$ 1.234,50</span>
   O texto final já vem no HTML (sem JavaScript o número aparece certo). Expõe window.nuvyNumero:
   montar(el), atualizar(el, valor) e grupo(raiz, valores). Todo texto entra por textContent/createTextNode. */
import { partes, formatar, valido } from './nuvy-numero-formato.mjs';

function iniciar() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return; // SSR: nada a fazer
  if (window.nuvyNumero) return;
  const estados = new WeakMap();
  const DIGITO = /^[0-9]$/;
  const reduzido = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const animavel = () => typeof window.requestAnimationFrame === 'function' && reduzido !== null && !reduzido.matches;

  function lerFormato(el) {
    try {
      const o = JSON.parse(el.getAttribute('data-formato') || '{}');
      return o && typeof o === 'object' ? o : {};
    } catch {
      console.warn('nuvy-numero: data-formato não é JSON válido; usando o formato decimal.');
      return {};
    }
  }

  // Tempo de saída: --nv-mov do CSS (padrão 200 ms) + 50 ms de folga.
  function tempoSaida(el) {
    const v = window.getComputedStyle ? window.getComputedStyle(el).getPropertyValue('--nv-mov') : '';
    const ms = parseFloat(v);
    return (Number.isFinite(ms) ? ms : 200) + 50;
  }

  function montar(el) {
    if (!el || estados.has(el)) return estados.get(el);
    const bruto = el.getAttribute('data-valor');
    const numero = bruto === null || bruto.trim() === '' ? NaN : Number(bruto);
    const estado = {
      valor: valido(numero) ? numero : null,
      opcoes: lerFormato(el),
      locale: el.getAttribute('data-locale') || 'pt-BR',
      visual: null, // <span> com as colunas; só existe depois da 1ª atualização (hidratação sem salto)
      nos: new Map(),
    };
    estados.set(el, estado);
    const texto = estado.valor !== null ? formatar(estado.valor, estado.opcoes, estado.locale) : el.textContent.trim();
    if (texto) el.setAttribute('aria-label', texto);
    // Montado pelo cliente (sem texto pronto): já cria as colunas.
    if (!el.textContent.trim() && estado.valor !== null) construir(el, estado, estado.valor);
    return estado;
  }

  function criarNo(parte) {
    if (parte.tipo === 'digito' && DIGITO.test(parte.texto)) {
      const janela = document.createElement('span');
      janela.className = 'nv-numero__janela';
      janela.setAttribute('aria-hidden', 'true');
      const coluna = document.createElement('span');
      coluna.className = 'nv-numero__coluna';
      coluna.setAttribute('aria-hidden', 'true');
      for (let d = 0; d <= 9; d++) {
        const s = document.createElement('span');
        s.appendChild(document.createTextNode(String(d)));
        coluna.appendChild(s);
      }
      janela.appendChild(coluna);
      return { el: janela, coluna };
    }
    const s = document.createElement('span');
    s.className = 'nv-numero__simbolo';
    s.setAttribute('aria-hidden', 'true');
    s.appendChild(document.createTextNode(parte.texto));
    return { el: s, coluna: null };
  }

  function posicionar(no, texto) {
    if (no.coluna) no.coluna.style.transform = `translateY(${-10 * Number(texto)}%)`;
    else if (no.el.textContent !== texto) no.el.textContent = texto;
  }

  // Troca o texto pronto pelas colunas, no valor indicado, sem animar.
  function construir(el, estado, valor) {
    el.textContent = '';
    const leitor = document.createElement('span');
    leitor.className = 'nv-so-leitor';
    leitor.textContent = formatar(valor, estado.opcoes, estado.locale);
    const visual = document.createElement('span');
    visual.className = 'nv-numero__visual';
    visual.setAttribute('aria-hidden', 'true');
    estado.nos = new Map();
    for (const p of partes(valor, estado.opcoes, estado.locale)) {
      const no = criarNo(p);
      posicionar(no, p.texto);
      estado.nos.set(p.chave, no);
      visual.appendChild(no.el);
    }
    el.appendChild(leitor);
    el.appendChild(visual);
    estado.visual = visual;
    estado.leitor = leitor;
  }

  function aplicar(el, estado, valor) {
    const texto = formatar(valor, estado.opcoes, estado.locale);
    el.setAttribute('aria-label', texto);
    if (!animavel()) {
      el.textContent = texto;
      estado.visual = null;
      estado.valor = valor;
      return;
    }
    if (!estado.visual || !el.contains(estado.visual)) construir(el, estado, estado.valor ?? valor);
    estado.leitor.textContent = texto;
    const novas = partes(valor, estado.opcoes, estado.locale);
    const chaves = new Set(novas.map((p) => p.chave));
    const entrando = [];
    // Quem sai: some só com opacidade e escala, e é removido no fim da transição (a largura não anima).
    for (const [chave, no] of estado.nos) {
      if (chaves.has(chave)) continue;
      estado.nos.delete(chave);
      no.el.setAttribute('data-saindo', '');
      const tirar = () => { if (no.el.parentNode) no.el.parentNode.removeChild(no.el); };
      no.el.addEventListener('transitionend', tirar);
      setTimeout(tirar, tempoSaida(el));
    }
    // Quem entra: criado já no dígito final, com data-entrando (invisível); quem fica rola até o novo dígito.
    let cursor = estado.visual.firstChild;
    for (const p of novas) {
      let no = estado.nos.get(p.chave);
      if (!no) {
        no = criarNo(p);
        posicionar(no, p.texto);
        no.el.setAttribute('data-entrando', '');
        estado.nos.set(p.chave, no);
        entrando.push(no);
      }
      while (cursor && cursor.hasAttribute('data-saindo')) cursor = cursor.nextSibling;
      if (cursor === no.el) cursor = cursor.nextSibling;
      else estado.visual.insertBefore(no.el, cursor);
    }
    // Lê a largura para o navegador registrar o estado inicial antes de mudar (senão não há transição).
    void estado.visual.offsetWidth;
    for (const p of novas) posicionar(estado.nos.get(p.chave), p.texto);
    for (const no of entrando) no.el.removeAttribute('data-entrando');
    estado.valor = valor;
  }

  function atualizar(el, valor) {
    const estado = montar(el);
    if (!estado) return;
    if (!valido(valor)) {
      console.warn('nuvy-numero: valor inválido ignorado (use um número finito):', String(valor));
      return;
    }
    aplicar(el, estado, valor);
  }

  // Atualiza vários números no mesmo quadro: o card muda todo junto.
  // valores: lista (na ordem dos .nv-numero da raiz) ou objeto pelo data-nome de cada um.
  function grupo(raiz, valores) {
    if (!raiz || !valores) return;
    const els = Array.prototype.slice.call(raiz.querySelectorAll('.nv-numero'));
    const pares = els.map((el, i) => [el, Array.isArray(valores) ? valores[i] : valores[el.getAttribute('data-nome')]])
      .filter(([, v]) => v !== undefined);
    const rodar = () => { for (const [el, v] of pares) atualizar(el, v); };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(rodar);
    else rodar();
  }

  window.nuvyNumero = { montar, atualizar, grupo };
  const montarTodos = () => Array.prototype.forEach.call(document.querySelectorAll('.nv-numero'), montar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarTodos);
  else montarTodos();
}

iniciar();
