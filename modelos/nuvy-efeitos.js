/* nuvy-efeitos.js: a parte em JavaScript dos efeitos de movimento do layout.css (código próprio da NuvyTech,
   sem dependência). Carregue com <script src="nuvy-efeitos.js" defer></script>.

   - .nv-letreiro: duplica a faixa (cópia escondida do leitor de tela) para o giro sem emenda e põe um botão
     de pausar/continuar (vale no celular e no teclado, não só com o mouse em cima).
   - .nv-palavra-gira[data-palavras='["sites","lojas"]']: troca a palavra a cada 2,5 s e para sozinha depois de
     data-voltas voltas (padrão 2, no máximo 3), sempre na primeira palavra.
   - .nv-cartao-3d: inclina até 6° seguindo o mouse (só com ponteiro fino).
   - .nv-botao--brilho: marca data-visto quando o botão aparece na tela (o brilho passa uma vez).

   Nada aqui usa innerHTML: o texto entra por textContent e a cópia do letreiro por cloneNode.
   Com prefers-reduced-motion: reduce a palavra não troca, o cartão não inclina e o CSS para o resto.
   A palavra só tem relógio ligado quando está na tela, com a aba visível e sem movimento reduzido.
   Em páginas montadas depois (Angular), chame nuvyEfeitos.montar(elemento). */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const INTERVALO_PALAVRA = 2500; // ms entre uma palavra e outra
  const VOLTAS_PADRAO = 2; // voltas completas da lista antes de parar
  const VOLTAS_MAX = 3;
  const INCLINACAO_MAX = 6; // graus, para cada eixo
  const FOLGA_SAIDA = 50; // ms além do --nv-mov antes de remover a palavra que saiu

  const montados = new WeakSet();
  const consulta = (q) => (typeof window.matchMedia === 'function' ? window.matchMedia(q) : null);
  const midia = (q) => {
    const m = consulta(q);
    return m ? Boolean(m.matches) : false;
  };
  const reduzido = () => midia('(prefers-reduced-motion: reduce)');
  const ponteiroFino = () => midia('(pointer: fine)');
  const proximoQuadro = (fn) =>
    typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(fn) : fn();
  const ouvirJanela = (tipo, fn, ligar) => {
    if (ligar && typeof window.addEventListener === 'function') window.addEventListener(tipo, fn, { passive: true, capture: true });
    if (!ligar && typeof window.removeEventListener === 'function') window.removeEventListener(tipo, fn, { capture: true });
  };

  function duracaoMov(el) {
    const v = window.getComputedStyle ? window.getComputedStyle(el).getPropertyValue('--nv-mov') : '';
    const ms = parseFloat(v);
    return Number.isFinite(ms) && ms >= 0 ? ms : 200;
  }

  // ---------- quem está na tela (um IntersectionObserver para todos) ----------

  let observador = null;
  const aoAparecer = new WeakMap(); // elemento -> fn(visivel); a fn devolve true para parar de observar

  function observarTela(el, fn) {
    if (typeof window.IntersectionObserver !== 'function') {
      fn(true);
      return;
    }
    if (!observador) {
      observador = new window.IntersectionObserver((entradas) => {
        for (const en of entradas) {
          const f = aoAparecer.get(en.target);
          if (f && f(Boolean(en.isIntersecting)) === true) {
            aoAparecer.delete(en.target);
            observador.unobserve(en.target);
          }
        }
      });
    }
    aoAparecer.set(el, fn);
    observador.observe(el);
  }

  function esquecerTela(el) {
    if (!observador || !aoAparecer.has(el)) return;
    aoAparecer.delete(el);
    observador.unobserve(el);
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

    // Pausar e continuar (WCAG 2.2.2): o hover não existe no celular e a lista pode não ter nada focável.
    // O rótulo fica fixo e o estado vai no aria-pressed, como pede um botão de alternar.
    const botao = document.createElement('button');
    botao.setAttribute('type', 'button');
    botao.className = 'nv-letreiro__pausa';
    botao.setAttribute('aria-label', 'Pausar o letreiro');
    botao.setAttribute('aria-pressed', 'false');
    botao.addEventListener('click', () => {
      const pausado = !el.hasAttribute('data-pausado');
      el.toggleAttribute('data-pausado', pausado);
      botao.setAttribute('aria-pressed', String(pausado));
    });
    el.appendChild(botao);
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

  function lerVoltas(el) {
    const n = parseInt(el.getAttribute('data-voltas') || '', 10);
    return Number.isInteger(n) && n >= 1 ? Math.min(n, VOLTAS_MAX) : VOLTAS_PADRAO;
  }

  // Cada palavra montada registra aqui a função que liga ou desliga o relógio dela.
  const palavrasVivas = new Set();
  const reavaliarPalavras = () => { for (const f of Array.from(palavrasVivas)) f(); };
  document.addEventListener('visibilitychange', reavaliarPalavras);
  const preferencia = consulta('(prefers-reduced-motion: reduce)');
  if (preferencia && typeof preferencia.addEventListener === 'function') preferencia.addEventListener('change', reavaliarPalavras);

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
    let trocas = 0;
    const totalTrocas = palavras.length * lerVoltas(el); // termina de volta na primeira palavra
    let relogio = null;
    let naTela = true;
    let mouseEmCima = false; // espera a pessoa ler

    function trocar() {
      indice = (indice + 1) % palavras.length;
      const velha = atual;
      const nova = novaPalavra(palavras[indice]);
      nova.setAttribute('data-entrando', '');
      velha.setAttribute('data-saindo', '');
      visivel.appendChild(nova);
      atual = nova;
      el.setAttribute('data-indice', String(indice));
      // Dois quadros: no primeiro o navegador calcula o estilo com data-entrando (invisível, abaixo);
      // só no segundo o atributo sai, e aí a transição de entrada acontece. Com um quadro só ela não roda.
      proximoQuadro(() => proximoQuadro(() => nova.removeAttribute('data-entrando')));
      setTimeout(() => velha.remove(), duracaoMov(el) + FOLGA_SAIDA);
    }

    function desligar() {
      if (relogio === null) return;
      clearInterval(relogio);
      relogio = null;
    }

    function reavaliar() {
      if (el.isConnected === false) {
        desligar();
        palavrasVivas.delete(reavaliar);
        esquecerTela(el);
        return;
      }
      if (trocas >= totalTrocas) {
        desligar();
        palavrasVivas.delete(reavaliar);
        esquecerTela(el);
        el.setAttribute('data-parado', '');
        return;
      }
      const deveRodar = naTela && !mouseEmCima && !document.hidden && !reduzido();
      if (deveRodar && relogio === null) relogio = setInterval(passo, INTERVALO_PALAVRA);
      else if (!deveRodar) desligar();
    }

    function passo() {
      // Confere de novo a cada passo: nem todo navegador avisa a mudança de aba ou de preferência.
      if (el.isConnected === false || document.hidden || reduzido()) {
        reavaliar();
        return;
      }
      trocar();
      trocas++;
      if (trocas >= totalTrocas) reavaliar();
    }

    el.addEventListener('pointerenter', () => { mouseEmCima = true; reavaliar(); });
    el.addEventListener('pointerleave', () => { mouseEmCima = false; reavaliar(); });
    palavrasVivas.add(reavaliar);
    if (typeof window.IntersectionObserver === 'function') naTela = false; // espera o observador dizer
    observarTela(el, (v) => {
      naTela = v;
      reavaliar();
    });
    reavaliar();
  }

  // ---------- cartão 3D ----------

  const limitar = (v) => (Number.isFinite(v) ? Math.max(-INCLINACAO_MAX, Math.min(INCLINACAO_MAX, v)) : 0);

  function cartao3d(el) {
    let retangulo = null; // lido uma vez por entrada, com o cartão ainda reto
    let alvo = null; // [x, y] da próxima escrita
    let pedido = false;
    let soltar = null;

    const escrever = () => {
      pedido = false;
      if (!alvo) return;
      el.style.setProperty('--nv-inclina-x', `${alvo[0].toFixed(2)}deg`);
      el.style.setProperty('--nv-inclina-y', `${alvo[1].toFixed(2)}deg`);
      alvo = null;
    };
    // Junta as escritas num quadro: vários pointermove entre dois quadros viram uma escrita só.
    const inclinar = (x, y) => {
      alvo = [x, y];
      if (pedido) return;
      pedido = true;
      proximoQuadro(escrever);
    };
    const esquecer = () => { retangulo = null; }; // rolou a página: o retângulo guardado ficou velho
    const pode = (e) => e.pointerType !== 'touch' && ponteiroFino() && !reduzido();

    const comecar = () => {
      if (soltar !== null) {
        clearTimeout(soltar);
        soltar = null;
      }
      if (!el.hasAttribute('data-inclinado')) retangulo = null;
      if (!retangulo) retangulo = el.getBoundingClientRect();
      el.setAttribute('data-inclinado', '');
      ouvirJanela('scroll', esquecer, true);
      ouvirJanela('resize', esquecer, true);
    };

    el.addEventListener('pointerenter', (e) => {
      if (pode(e)) comecar();
    });
    el.addEventListener('pointermove', (e) => {
      if (!pode(e)) return;
      if (!retangulo || !el.hasAttribute('data-inclinado')) comecar();
      const r = retangulo;
      if (!r.width || !r.height) return;
      const x = (e.clientX - r.left) / r.width - 0.5; // -0,5 (esquerda) a 0,5 (direita)
      const y = (e.clientY - r.top) / r.height - 0.5;
      inclinar(limitar(-y * 2 * INCLINACAO_MAX), limitar(x * 2 * INCLINACAO_MAX));
    });
    el.addEventListener('pointerleave', () => {
      if (!el.hasAttribute('data-inclinado')) return;
      inclinar(0, 0);
      retangulo = null;
      ouvirJanela('scroll', esquecer, false);
      ouvirJanela('resize', esquecer, false);
      // Depois de voltar a 0, tira o transform: parado, o cartão não fica com transform próprio
      // (não briga com o transform de outra classe nem prende filhos position: fixed).
      soltar = setTimeout(() => {
        soltar = null;
        el.removeAttribute('data-inclinado');
      }, duracaoMov(el) + FOLGA_SAIDA);
    });
  }

  // ---------- botão com brilho ----------

  function brilho(el) {
    observarTela(el, (visivel) => {
      if (!visivel) return false;
      el.setAttribute('data-visto', '');
      return true; // uma vez só
    });
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
