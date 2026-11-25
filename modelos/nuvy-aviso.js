/* nuvy-ui — pilha de avisos flutuantes (toast). Script comum, sem dependências.
   Carregue: <script src="nuvy-aviso.js" defer></script>. Expõe window.nuvyAviso:
     mostrar(opcoes) -> id   opcoes: { titulo, texto, tipo, duracao, acao: { rotulo, aoClicar } }
     sucesso(texto, opcoes), erro(texto, opcoes), atencao(texto, opcoes)
     promessa(promise, { carregando, sucesso, erro }) -> a mesma promise
     fechar(id), limpar()
   tipo: info (padrão), sucesso, atencao, erro. duracao em ms (padrão 5000; Infinity fica até fechar).
   Até 3 avisos na tela; o resto espera na fila. Alt+T leva o foco ao aviso mais novo; Esc fecha o aviso
   focado e devolve o foco para onde estava. Arrastar para o lado dispensa. O tempo para enquanto a pilha
   está aberta (mouse ou foco), durante o arraste e com a aba escondida, e continua de onde parou.
   Todo texto entra por textContent: nada de HTML vindo de fora. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.nuvyAviso) return;

  const TIPOS = ['info', 'sucesso', 'atencao', 'erro', 'carregando'];
  const ASSERTIVOS = ['erro', 'atencao'];
  const MAX_VISIVEIS = 3;
  const DURACAO_PADRAO = 5000;
  const VAO = 8; // espaço entre avisos com a pilha aberta (px)
  const ARRASTE_MINIMO = 5; // abaixo disso é toque, não arraste (px)
  const ARRASTE_FRACAO = 0.45; // passou de 45% da largura: dispensa
  const ARRASTE_VELOCIDADE = 0.11; // ou foi rápido (px/ms): dispensa
  const FALHA = 'Algo deu errado.';
  const PADROES = { carregando: 'Carregando…', sucesso: 'Pronto.', erro: FALHA };

  const agora = () => (window.performance && performance.now ? performance.now() : Date.now());
  const registros = new Map(); // id -> registro
  let visiveis = []; // registros na tela, do mais novo para o mais velho
  const fila = []; // registros esperando vaga
  let seq = 0;
  let caixa = null;
  let lista = null;
  const anuncio = {};
  let focoAnterior = null;
  let ponteiroDentro = false;
  let focoDentro = false;

  // ---------- estrutura ----------

  function garantirCaixa() {
    if (caixa && caixa.isConnected) return;
    caixa = document.querySelector('.nv-avisos');
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.className = 'nv-avisos';
      document.body.appendChild(caixa);
    }
    caixa.setAttribute('role', 'region');
    if (!caixa.getAttribute('aria-label')) caixa.setAttribute('aria-label', 'Avisos');
    // Duas regiões vivas só para o leitor de tela: educada (info, sucesso) e assertiva (erro, atenção).
    for (const nivel of ['polite', 'assertive']) {
      let r = caixa.querySelector(`[data-anuncio="${nivel}"]`);
      if (!r) {
        r = document.createElement('div');
        r.className = 'nv-so-leitor';
        r.setAttribute('data-anuncio', nivel);
        r.setAttribute('aria-live', nivel);
        r.setAttribute('aria-atomic', 'true');
        caixa.insertBefore(r, caixa.firstChild);
      }
      anuncio[nivel] = r;
    }
    lista = caixa.querySelector('.nv-avisos__lista');
    if (!lista) {
      lista = document.createElement('ol');
      lista.className = 'nv-avisos__lista';
      caixa.appendChild(lista);
    }
    caixa.addEventListener('pointerenter', () => { ponteiroDentro = true; atualizarAberta(); });
    caixa.addEventListener('pointerleave', () => { ponteiroDentro = false; atualizarAberta(); });
    caixa.addEventListener('focusin', (e) => {
      if (!focoDentro && e.relatedTarget && !caixa.contains(e.relatedTarget)) focoAnterior = e.relatedTarget;
      focoDentro = true;
      atualizarAberta();
    });
    caixa.addEventListener('focusout', (e) => {
      if (e.relatedTarget && caixa.contains(e.relatedTarget)) return;
      focoDentro = false;
      atualizarAberta();
    });
    caixa.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const li = e.target && e.target.closest ? e.target.closest('.nv-aviso') : null;
      if (!li) return;
      e.preventDefault();
      fechar(li.getAttribute('data-id'));
    });
  }

  function anunciar(reg) {
    const nivel = ASSERTIVOS.includes(reg.tipo) ? 'assertive' : 'polite';
    const r = anuncio[nivel];
    r.textContent = '';
    const s = document.createElement('span');
    s.textContent = [reg.titulo, reg.texto].filter(Boolean).join('. ');
    r.appendChild(s);
  }

  function texto(v) {
    return typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  }

  function duracaoDe(v) {
    return v === Infinity || (typeof v === 'number' && v > 0 && Number.isFinite(v)) ? v : DURACAO_PADRAO;
  }

  function criarItem(reg) {
    const li = document.createElement('li');
    li.setAttribute('data-id', reg.id);
    li.setAttribute('tabindex', '-1');
    const titulo = document.createElement('p');
    titulo.className = 'nv-aviso__titulo';
    const corpo = document.createElement('p');
    corpo.className = 'nv-aviso__texto';
    li.appendChild(titulo);
    li.appendChild(corpo);
    if (reg.acao) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nv-aviso__acao';
      b.textContent = reg.acao.rotulo;
      b.addEventListener('click', (e) => {
        try {
          reg.acao.aoClicar(e);
        } catch (erro) {
          console.warn('nuvy-aviso: a ação do aviso falhou.', erro);
        }
        fechar(reg.id);
      });
      li.appendChild(b);
    }
    const fecharBotao = document.createElement('button');
    fecharBotao.type = 'button';
    fecharBotao.className = 'nv-aviso__fechar';
    fecharBotao.setAttribute('aria-label', 'Fechar aviso');
    const x = document.createElement('span');
    x.setAttribute('aria-hidden', 'true');
    x.textContent = '×';
    fecharBotao.appendChild(x);
    fecharBotao.addEventListener('click', () => fechar(reg.id));
    li.appendChild(fecharBotao);
    reg.el = li;
    reg.titEl = titulo;
    reg.corpoEl = corpo;
    pintar(reg);
    ligarArraste(reg);
  }

  // Aplica tipo e textos do registro no <li>.
  function pintar(reg) {
    reg.el.className = `nv-aviso nv-aviso--${reg.tipo}`;
    reg.el.setAttribute('data-tipo', reg.tipo);
    reg.titEl.textContent = reg.titulo;
    reg.titEl.hidden = !reg.titulo;
    reg.corpoEl.textContent = reg.texto;
    if (reg.tipo === 'carregando') reg.el.setAttribute('aria-busy', 'true');
    else reg.el.removeAttribute('aria-busy');
  }

  // ---------- pilha ----------

  function reorganizar() {
    let desloc = 0;
    visiveis.forEach((reg, i) => {
      reg.el.style.setProperty('--nv-indice', String(i));
      reg.el.style.setProperty('--nv-desloc', `${desloc}px`);
      desloc += (reg.el.offsetHeight || 0) + VAO;
    });
  }

  function atualizarAberta() {
    const aberta = ponteiroDentro || focoDentro;
    if (caixa) caixa.toggleAttribute('data-expandido', aberta);
    if (aberta) reorganizar();
    sincronizarTempos();
  }

  function entrar(reg) {
    visiveis.unshift(reg);
    lista.insertBefore(reg.el, lista.firstChild);
    reorganizar();
    anunciar(reg);
    reg.restante = reg.duracao;
    sincronizarTempos();
  }

  function puxarDaFila() {
    while (visiveis.length < MAX_VISIVEIS && fila.length) entrar(fila.shift());
  }

  // ---------- tempo ----------

  const pausado = (reg) =>
    (caixa && caixa.hasAttribute('data-expandido')) || document.visibilityState === 'hidden' || reg.arrastando;

  function parar(reg) {
    if (reg.timer === null) return;
    clearTimeout(reg.timer);
    reg.timer = null;
    reg.restante -= agora() - reg.inicio;
  }

  function correr(reg) {
    if (reg.timer !== null || reg.saindo || reg.restante === Infinity) return;
    reg.inicio = agora();
    // O setTimeout só acorda; quem decide é o tempo medido (o navegador atrasa timers em aba escondida).
    reg.timer = setTimeout(() => {
      reg.timer = null;
      reg.restante -= agora() - reg.inicio;
      if (reg.restante <= 0) fechar(reg.id);
      else correr(reg);
    }, Math.max(0, reg.restante));
  }

  function sincronizarTempos() {
    for (const reg of visiveis) {
      if (pausado(reg)) parar(reg);
      else correr(reg);
    }
  }

  document.addEventListener('visibilitychange', sincronizarTempos);

  // ---------- arraste para dispensar ----------

  function ligarArraste(reg) {
    const li = reg.el;
    let inicio = null;
    li.addEventListener('pointerdown', (e) => {
      if (reg.saindo || (e.button !== undefined && e.button !== 0)) return;
      if (e.target && e.target.closest && e.target.closest('button, a, input, select, textarea')) return;
      inicio = { x: e.clientX, t: agora(), id: e.pointerId, dx: 0, movendo: false };
      if (li.setPointerCapture && e.pointerId !== undefined) li.setPointerCapture(e.pointerId);
    });
    li.addEventListener('pointermove', (e) => {
      if (!inicio) return;
      const dx = e.clientX - inicio.x;
      inicio.dx = dx;
      if (!inicio.movendo && Math.abs(dx) < ARRASTE_MINIMO) return;
      if (!inicio.movendo) {
        inicio.movendo = true;
        reg.arrastando = true;
        li.setAttribute('data-arrastando', '');
        sincronizarTempos();
      }
      const largura = li.offsetWidth || 1;
      li.style.transform = `translateX(${dx}px)`;
      li.style.opacity = String(Math.max(0, 1 - Math.abs(dx) / largura));
    });
    const soltar = (cancelou) => (e) => {
      if (!inicio) return;
      const { movendo, t } = inicio;
      const dx = cancelou ? 0 : e.clientX - inicio.x;
      inicio = null;
      if (!movendo) return; // foi só um toque
      reg.arrastando = false;
      li.removeAttribute('data-arrastando');
      const largura = li.offsetWidth || 1;
      const velocidade = Math.abs(dx) / Math.max(1, agora() - t);
      if (!cancelou && (Math.abs(dx) >= largura * ARRASTE_FRACAO || velocidade > ARRASTE_VELOCIDADE)) {
        li.style.transform = `translateX(${dx < 0 ? -largura : largura}px)`;
        li.style.opacity = '0';
        fechar(reg.id);
      } else {
        li.style.transform = '';
        li.style.opacity = '';
        sincronizarTempos();
      }
    };
    li.addEventListener('pointerup', soltar(false));
    li.addEventListener('pointercancel', soltar(true));
  }

  // ---------- API ----------

  function mostrar(opcoes) {
    const o = typeof opcoes === 'string' ? { texto: opcoes } : opcoes && typeof opcoes === 'object' ? opcoes : {};
    garantirCaixa();
    const reg = {
      id: String(++seq),
      tipo: TIPOS.includes(o.tipo) ? o.tipo : 'info',
      titulo: texto(o.titulo),
      texto: texto(o.texto),
      duracao: duracaoDe(o.duracao),
      restante: 0,
      inicio: 0,
      timer: null,
      saindo: false,
      arrastando: false,
      acao: o.acao && typeof o.acao.aoClicar === 'function' && texto(o.acao.rotulo) ? { rotulo: texto(o.acao.rotulo), aoClicar: o.acao.aoClicar } : null,
    };
    criarItem(reg);
    registros.set(reg.id, reg);
    if (visiveis.length < MAX_VISIVEIS) entrar(reg);
    else fila.push(reg);
    return reg.id;
  }

  const atalho = (tipo) => (t, opcoes) =>
    mostrar(typeof t === 'object' && t !== null ? { ...t, tipo } : { ...(opcoes || {}), texto: t, tipo });

  function tempoSaida(el) {
    const v = window.getComputedStyle ? window.getComputedStyle(el).getPropertyValue('--nv-mov') : '';
    const ms = parseFloat(v);
    return (Number.isFinite(ms) ? ms : 200) + 50;
  }

  function fechar(id) {
    const reg = registros.get(String(id));
    if (!reg || reg.saindo) return;
    const naFila = fila.indexOf(reg);
    if (naFila >= 0) {
      fila.splice(naFila, 1);
      registros.delete(reg.id);
      return;
    }
    reg.saindo = true;
    parar(reg);
    const tinhaFoco = reg.el.contains(document.activeElement);
    visiveis = visiveis.filter((r) => r !== reg);
    reg.el.setAttribute('data-saindo', '');
    let feito = false;
    const tirar = () => {
      if (feito) return;
      feito = true;
      registros.delete(reg.id);
      if (reg.el.parentNode) reg.el.parentNode.removeChild(reg.el);
    };
    reg.el.addEventListener('transitionend', (e) => { if (e.target === reg.el) tirar(); });
    setTimeout(tirar, tempoSaida(reg.el));
    // O foco estava no aviso que saiu: volta para onde estava antes (ou para o próximo aviso).
    if (tinhaFoco) {
      const volta = focoAnterior && focoAnterior.isConnected ? focoAnterior : null;
      focoAnterior = null;
      if (volta && volta.focus) volta.focus();
      else if (visiveis[0]) visiveis[0].el.focus();
      else {
        focoDentro = false;
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      }
    }
    puxarDaFila();
    reorganizar();
    atualizarAberta();
  }

  function limpar() {
    fila.splice(0).forEach((r) => registros.delete(r.id));
    visiveis.slice().forEach((r) => fechar(r.id));
  }

  // Mensagem da promessa: texto, ou função (do resultado/erro) que devolve texto. Nunca mostra o erro cru.
  function mensagem(m, valor, padrao) {
    if (typeof m === 'function') {
      try {
        const r = m(valor);
        return typeof r === 'string' && r ? r : FALHA;
      } catch {
        return FALHA;
      }
    }
    return typeof m === 'string' && m ? m : padrao;
  }

  function trocar(id, tipo, txt) {
    const reg = registros.get(id);
    if (!reg || reg.saindo) return;
    reg.tipo = tipo;
    reg.texto = txt;
    reg.duracao = DURACAO_PADRAO;
    reg.restante = reg.duracao;
    pintar(reg);
    if (visiveis.includes(reg)) {
      anunciar(reg);
      sincronizarTempos();
    }
  }

  function promessa(p, opcoes) {
    const o = opcoes || {};
    const id = mostrar({ tipo: 'carregando', titulo: o.titulo, texto: mensagem(o.carregando, undefined, PADROES.carregando), duracao: Infinity });
    Promise.resolve(p).then(
      (v) => trocar(id, 'sucesso', mensagem(o.sucesso, v, PADROES.sucesso)),
      (e) => trocar(id, 'erro', mensagem(o.erro, e, PADROES.erro)),
    );
    return p;
  }

  // Alt+T: foco no aviso mais novo.
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || !(e.code === 'KeyT' || (typeof e.key === 'string' && e.key.toLowerCase() === 't'))) return;
    const novo = visiveis[0];
    if (!novo) return;
    e.preventDefault();
    if (!caixa.contains(document.activeElement)) focoAnterior = document.activeElement;
    novo.el.focus();
  });

  window.nuvyAviso = {
    mostrar,
    sucesso: atalho('sucesso'),
    erro: atalho('erro'),
    atencao: atalho('atencao'),
    promessa,
    fechar,
    limpar,
  };
})();
