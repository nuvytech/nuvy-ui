/* nuvy-efeitos.js: a parte em JavaScript dos efeitos de movimento do layout.css (código próprio da NuvyTech,
   sem dependência). Carregue com <script src="nuvy-efeitos.js" defer></script>.

   - .nv-letreiro: duplica a faixa (cópia escondida do leitor de tela) para o giro sem emenda.
   - .nv-palavra-gira[data-palavras='["sites","lojas"]']: troca a palavra a cada 2,5 s.
   - .nv-cartao-3d: inclina até 6° seguindo o mouse (só com ponteiro fino).
   - .nv-botao--brilho: marca data-visto quando o botão aparece na tela (o brilho passa uma vez).

   Nada aqui usa innerHTML: o texto entra por textContent e a cópia do letreiro por cloneNode.
   Com prefers-reduced-motion: reduce a palavra não troca, o cartão não inclina e o CSS para o resto.
   Em páginas montadas depois (Angular), chame nuvyEfeitos.montar(elemento). */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const INTERVALO_PALAVRA = 2500; // ms entre uma palavra e outra
  const INCLINACAO_MAX = 6; // graus, para cada eixo
  const FOLGA_SAIDA = 50; // ms além do --nv-mov antes de remover a palavra que saiu

  const montados = new WeakSet();
  const midia = (q) => (typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false);
  const reduzido = () => midia('(prefers-reduced-motion: reduce)');
  const ponteiroFino = () => midia('(pointer: fine)');
  const proximoQuadro = (fn) =>
    typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(fn) : fn();

  function duracaoMov(el) {
    const v = window.getComputedStyle ? window.getComputedStyle(el).getPropertyValue('--nv-mov') : '';
    const ms = parseFloat(v);
    return Number.isFinite(ms) && ms >= 0 ? ms : 200;
  }

  // ---------- letreiro ----------

  function letreiro(el) {
    const trilho = el.querySelector('.nv-letreiro__trilho');
    if (!trilho) return;
    const faixa = document.createElement('div');
    faixa.className = 'nv-letreiro__faixa';
    el.insertBefore(faixa, trilho);
    faixa.appendChild(trilho);
    // A cópia só fecha o laço visual: fora do leitor de tela, sem foco e sem ids repetidos.
    const copia = trilho.cloneNode(true);
    copia.setAttribute('aria-hidden', 'true');
    copia.setAttribute('inert', '');
    copia.removeAttribute('id');
    for (const n of copia.querySelectorAll('[id]')) n.removeAttribute('id');
    for (const n of copia.querySelectorAll('a, button, input, select, textarea, [tabindex]')) n.setAttribute('tabindex', '-1');
    faixa.appendChild(copia);
    el.setAttribute('data-pronto', '');
  }

  // ---------- palavra que gira ----------

  function lerPalavras(el) {
    let lista;
    try {
      lista = JSON.parse(el.getAttribute('data-palavras') || '[]');
    } catch (e) {
      lista = null;
    }
    if (!Array.isArray(lista)) {
      console.warn('nuvy-efeitos: data-palavras precisa ser uma lista JSON, ex.: ["sites","lojas"]');
      return [];
    }
    return lista.filter((p) => typeof p === 'string' && p.trim() !== '').map((p) => p.trim());
  }

  function palavraGira(el) {
    const palavras = lerPalavras(el);
    if (palavras.length < 2) return;
    // O leitor de tela ouve só a primeira palavra, uma vez; a troca visual fica escondida dele.
    el.setAttribute('aria-live', 'off');
    const leitor = document.createElement('span');
    leitor.className = 'nv-so-leitor';
    leitor.textContent = palavras[0];
    const visivel = document.createElement('span');
    visivel.className = 'nv-palavra-gira__visivel';
    visivel.setAttribute('aria-hidden', 'true');
    const novaPalavra = (texto) => {
      const s = document.createElement('span');
      s.className = 'nv-palavra-gira__palavra';
      s.textContent = texto;
      return s;
    };
    let atual = novaPalavra(palavras[0]);
    visivel.appendChild(atual);
    el.textContent = '';
    el.appendChild(leitor);
    el.appendChild(visivel);

    let indice = 0;
    let parado = false; // mouse em cima: espera para ler
    el.addEventListener('pointerenter', () => { parado = true; });
    el.addEventListener('pointerleave', () => { parado = false; });

    const relogio = setInterval(() => {
      if (el.isConnected === false) {
        clearInterval(relogio);
        return;
      }
      if (parado || document.hidden || reduzido()) return;
      indice = (indice + 1) % palavras.length;
      const velha = atual;
      const nova = novaPalavra(palavras[indice]);
      nova.setAttribute('data-entrando', '');
      velha.setAttribute('data-saindo', '');
      visivel.appendChild(nova);
      atual = nova;
      el.setAttribute('data-indice', String(indice));
      proximoQuadro(() => nova.removeAttribute('data-entrando'));
      setTimeout(() => velha.remove(), duracaoMov(el) + FOLGA_SAIDA);
    }, INTERVALO_PALAVRA);
  }

  // ---------- cartão 3D ----------

  const limitar = (v) => (Number.isFinite(v) ? Math.max(-INCLINACAO_MAX, Math.min(INCLINACAO_MAX, v)) : 0);

  function cartao3d(el) {
    const inclinar = (x, y) => {
      el.style.setProperty('--nv-inclina-x', `${x.toFixed(2)}deg`);
      el.style.setProperty('--nv-inclina-y', `${y.toFixed(2)}deg`);
    };
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !ponteiroFino() || reduzido()) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = (e.clientX - r.left) / r.width - 0.5; // -0,5 (esquerda) a 0,5 (direita)
      const y = (e.clientY - r.top) / r.height - 0.5;
      inclinar(limitar(-y * 2 * INCLINACAO_MAX), limitar(x * 2 * INCLINACAO_MAX));
    });
    el.addEventListener('pointerleave', () => inclinar(0, 0));
  }

  // ---------- botão com brilho ----------

  let observador = null;
  function brilho(el) {
    if (typeof window.IntersectionObserver !== 'function') {
      el.setAttribute('data-visto', '');
      return;
    }
    if (!observador) {
      observador = new window.IntersectionObserver((entradas) => {
        for (const en of entradas) {
          if (!en.isIntersecting) continue;
          en.target.setAttribute('data-visto', '');
          observador.unobserve(en.target);
        }
      });
    }
    observador.observe(el);
  }

  // ---------- montagem ----------

  const EFEITOS = [
    ['.nv-letreiro', letreiro],
    ['.nv-palavra-gira', palavraGira],
    ['.nv-cartao-3d', cartao3d],
    ['.nv-botao--brilho', brilho],
  ];

  function montar(raiz) {
    const base = raiz || document;
    for (const [seletor, ligar] of EFEITOS) {
      const lista = Array.prototype.slice.call(base.querySelectorAll(seletor));
      if (base.matches && base.matches(seletor)) lista.unshift(base);
      for (const el of lista) {
        if (montados.has(el)) continue;
        montados.add(el);
        ligar(el);
      }
    }
  }

  window.nuvyEfeitos = { montar };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => montar());
  else montar();
})();
