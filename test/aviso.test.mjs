import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerArq } from './apoio/dom-falso.mjs';
import { carregarAviso, esperar } from './apoio/aviso.mjs';
import { css, reduzido, regras, regrasReduzidas, propsDeTransicao } from './apoio/css.mjs';
import { resolver, rgb, misturaOklab } from '../scripts/verificar.mjs';
import { contraste } from '../scripts/cor.mjs';

test('cria a região "Avisos" com duas regiões vivas (educada e assertiva)', () => {
  const a = carregarAviso();
  a.api.mostrar('Olá');
  const caixa = a.caixa();
  assert.equal(caixa.getAttribute('role'), 'region');
  assert.equal(caixa.getAttribute('aria-label'), 'Avisos');
  assert.equal(a.regiao('polite').getAttribute('aria-live'), 'polite');
  assert.equal(a.regiao('assertive').getAttribute('aria-live'), 'assertive');
  for (const n of ['polite', 'assertive']) assert.ok(a.regiao(n).classList.contains('nv-so-leitor'));
});

test('cria a caixa e as regiões vivas já na carga, antes do primeiro aviso', () => {
  const a = carregarAviso();
  assert.ok(a.caixa(), 'a caixa devia existir antes de qualquer aviso');
  assert.equal(a.regiao('polite').getAttribute('aria-live'), 'polite');
  assert.equal(a.regiao('assertive').getAttribute('aria-live'), 'assertive');
  assert.equal(a.itens().length, 0);
});

test('primeiro anúncio espera as regiões vivas recém-criadas; fica o último de cada nível', () => {
  const a = carregarAviso({ recemCarregada: true });
  const primeiro = a.api.sucesso('primeiro');
  a.api.sucesso('segundo');
  a.api.erro('falhou');
  assert.equal(a.regiao('polite').textContent, '', 'escrever na hora seria perdido pelo leitor de tela');
  assert.equal(a.regiao('assertive').textContent, '');
  assert.equal(a.itens().length, 3, 'o aviso aparece na tela na hora');
  a.clock.avancar(100);
  assert.equal(a.regiao('polite').textContent, 'segundo');
  assert.equal(a.regiao('assertive').textContent, 'falhou');
  a.api.fechar(primeiro); // abre vaga: o 4º aviso iria para a fila, sem anúncio
  a.api.sucesso('terceiro');
  assert.equal(a.regiao('polite').textContent, 'terceiro', 'depois de prontas, anuncia na hora');
});

test('reaproveita a .nv-avisos que já existe na página', () => {
  let existente;
  const a = carregarAviso({}, (doc) => {
    existente = doc.createElement('div');
    existente.className = 'nv-avisos';
    existente.setAttribute('aria-label', 'Mensagens');
    doc.body.appendChild(existente);
  });
  a.api.sucesso('Salvo');
  assert.equal(a.document.querySelectorAll('.nv-avisos').length, 1);
  assert.equal(existente.getAttribute('aria-label'), 'Mensagens');
  assert.equal(existente.getAttribute('role'), 'region');
});

test('5 avisos: 3 na tela e 2 na fila; fechar um puxa o próximo', () => {
  const a = carregarAviso();
  const ids = [1, 2, 3, 4, 5].map((n) => a.api.mostrar({ texto: `Aviso ${n}`, duracao: Infinity }));
  assert.equal(a.itens().length, 3);
  // O mais novo fica em primeiro, com índice 0.
  assert.equal(a.itens()[0].textContent.includes('Aviso 3'), true);
  assert.equal(a.itens()[0].style.getPropertyValue('--nv-indice'), '0');
  assert.equal(a.itens()[2].style.getPropertyValue('--nv-indice'), '2');
  a.api.fechar(ids[0]);
  assert.equal(a.item(ids[0]).hasAttribute('data-saindo'), true);
  assert.ok(a.item(ids[3]), 'o 4º devia ter entrado');
  a.clock.avancar(300);
  assert.equal(a.item(ids[0]), null);
  assert.equal(a.itens().length, 3);
  // Fechar um que está na fila só o tira da fila.
  a.api.fechar(ids[4]);
  a.api.fechar(ids[1]);
  a.clock.avancar(300);
  assert.equal(a.item(ids[4]), null);
  assert.equal(a.itens().length, 2);
});

test('cada aviso é um li.nv-aviso.nv-aviso--tipo com botão "Fechar aviso" e ação opcional', () => {
  const a = carregarAviso();
  let clicou = 0;
  const id = a.api.erro('Falhou', { titulo: 'Nota 12', acao: { rotulo: 'Tentar de novo', aoClicar: () => clicou++ } });
  const li = a.item(id);
  assert.equal(li.tagName, 'LI');
  assert.ok(li.classList.contains('nv-aviso') && li.classList.contains('nv-aviso--erro'));
  assert.equal(li.getAttribute('data-tipo'), 'erro');
  const fechar = li.querySelector('.nv-aviso__fechar');
  assert.equal(fechar.getAttribute('aria-label'), 'Fechar aviso');
  assert.equal(fechar.type, 'button');
  const acao = li.querySelector('.nv-aviso__acao');
  assert.equal(acao.textContent, 'Tentar de novo');
  a.evento(acao, 'click');
  assert.equal(clicou, 1);
  assert.ok(li.hasAttribute('data-saindo'));
  // Tipo desconhecido vira info; fechar pelo botão.
  const id2 = a.api.mostrar({ texto: 'x', tipo: 'qualquer' });
  assert.equal(a.item(id2).getAttribute('data-tipo'), 'info');
  a.evento(a.item(id2).querySelector('.nv-aviso__fechar'), 'click');
  assert.ok(a.item(id2).hasAttribute('data-saindo'));
});

test('ação que lança erro não quebra: avisa no console e fecha', () => {
  const a = carregarAviso();
  const id = a.api.mostrar({ texto: 'x', acao: { rotulo: 'Ir', aoClicar: () => { throw new Error('ops'); } } });
  a.evento(a.item(id).querySelector('.nv-aviso__acao'), 'click');
  assert.equal(a.avisosConsole.length, 1);
  assert.ok(a.item(id).hasAttribute('data-saindo'));
});

test('erro vai para a região assertiva e sucesso para a educada', () => {
  const a = carregarAviso();
  a.api.erro('Não salvou');
  assert.equal(a.regiao('assertive').textContent, 'Não salvou');
  assert.equal(a.regiao('polite').textContent, '');
  a.api.sucesso({ titulo: 'Pronto', texto: 'Salvo' });
  assert.equal(a.regiao('polite').textContent, 'Pronto. Salvo');
  a.api.atencao('Vence amanhã');
  assert.equal(a.regiao('assertive').textContent, 'Vence amanhã');
});

test('"<b>x</b>" aparece como texto, sem virar tag', () => {
  const a = carregarAviso();
  const id = a.api.mostrar({ titulo: '<img src=x onerror=alert(1)>', texto: '<b>x</b>' });
  const li = a.item(id);
  assert.equal(li.querySelector('.nv-aviso__texto').textContent, '<b>x</b>');
  assert.equal(li.querySelector('.nv-aviso__titulo').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(li.querySelectorAll('b').length + li.querySelectorAll('img').length, 0);
});

test('Alt+A leva o foco ao aviso mais novo; Esc fecha e devolve o foco', () => {
  const a = carregarAviso();
  const campo = a.document.createElement('input');
  a.document.body.appendChild(campo);
  campo.focus();
  a.api.mostrar({ texto: 'velho', duracao: Infinity });
  const novo = a.api.mostrar({ texto: 'novo', duracao: Infinity });
  const velho = a.novoEvento('keydown', { key: 't', code: 'KeyT', altKey: true });
  a.document.dispatchEvent(velho);
  assert.equal(velho.defaultPrevented, false, 'Alt+T é do menu Ferramentas do Firefox');
  const ev = a.novoEvento('keydown', { key: 'å', code: 'KeyA', altKey: true });
  a.document.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, true);
  assert.equal(a.document.activeElement, a.item(novo));
  assert.ok(a.caixa().hasAttribute('data-expandido'), 'a pilha abre com o foco');
  a.evento(a.item(novo), 'keydown', { key: 'Escape' });
  assert.ok(a.item(novo).hasAttribute('data-saindo'));
  assert.equal(a.document.activeElement, campo);
  assert.equal(a.caixa().hasAttribute('data-expandido'), false);
  // Alt+A sem nenhum aviso não faz nada.
  const b = carregarAviso();
  const ev2 = b.novoEvento('keydown', { key: 'a', altKey: true });
  b.document.dispatchEvent(ev2);
  assert.equal(ev2.defaultPrevented, false);
});

test('fechar id que não existe não lança; limpar tira tudo', () => {
  const a = carregarAviso();
  assert.doesNotThrow(() => a.api.fechar('nao-existe'));
  assert.doesNotThrow(() => a.api.fechar(undefined));
  for (let i = 0; i < 5; i++) a.api.mostrar(`n${i}`);
  a.api.limpar();
  a.clock.avancar(300);
  assert.equal(a.itens().length, 0);
});

test('sem innerHTML nem insertAdjacentHTML no fonte', () => {
  assert.doesNotMatch(lerArq('modelos/nuvy-aviso.js'), /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
});

// ---------- promessa ----------

test('promessa: começa em carregando, sem tempo, e devolve a mesma promise', async () => {
  const a = carregarAviso();
  let resolver;
  const p = new Promise((r) => { resolver = r; });
  const volta = a.api.promessa(p, { carregando: 'Enviando…', sucesso: (n) => `Nota ${n} enviada` });
  assert.equal(volta, p);
  const li = a.itens()[0];
  assert.equal(li.getAttribute('data-tipo'), 'carregando');
  assert.equal(li.getAttribute('aria-busy'), 'true');
  assert.equal(a.clock.pendentes(), 0, 'carregando não pode ter temporizador');
  a.clock.avancar(60000);
  assert.equal(li.hasAttribute('data-saindo'), false);
  resolver(1042);
  await esperar();
  assert.equal(a.itens()[0], li, 'o mesmo li devia ser reaproveitado');
  assert.equal(li.getAttribute('data-tipo'), 'sucesso');
  assert.equal(li.hasAttribute('aria-busy'), false);
  assert.equal(li.querySelector('.nv-aviso__texto').textContent, 'Nota 1042 enviada');
  assert.equal(a.regiao('polite').textContent, 'Nota 1042 enviada');
  // Agora o tempo começa a contar.
  a.clock.avancar(5000);
  assert.ok(li.hasAttribute('data-saindo'));
});

test('promessa: rejeitar com Error("segredo interno") não põe o segredo na tela', async () => {
  const a = carregarAviso();
  const p = Promise.reject(new Error('segredo interno'));
  const volta = a.api.promessa(p, { erro: 'Não foi possível enviar.' });
  await assert.rejects(volta);
  await esperar();
  const li = a.itens()[0];
  assert.equal(li.getAttribute('data-tipo'), 'erro');
  assert.equal(li.querySelector('.nv-aviso__texto').textContent, 'Não foi possível enviar.');
  assert.doesNotMatch(a.caixa().textContent, /segredo/);
  assert.equal(a.regiao('assertive').textContent, 'Não foi possível enviar.');
});

test('promessa: função que lança, ou devolve objeto, vira "Algo deu errado."', async () => {
  const a = carregarAviso();
  a.api.promessa(Promise.resolve(1), { sucesso: () => { throw new Error('stack aqui'); } });
  a.api.promessa(Promise.reject(new Error('x')), { erro: (e) => e }).catch(() => {});
  a.api.promessa(Promise.reject(new Error('y'))).catch(() => {});
  await esperar();
  for (const li of a.itens()) assert.equal(li.querySelector('.nv-aviso__texto').textContent, 'Algo deu errado.');
  assert.doesNotMatch(a.caixa().textContent, /stack|Error|object/);
});

// ---------- CSS ----------

const pilha = regras().filter((r) => /nv-avisos__lista|nv-aviso__|nv-aviso--carregando/.test(r.seletor));

test('CSS da pilha: só transform e opacity animam, com as durações dos tokens', () => {
  assert.ok(pilha.length >= 6);
  for (const r of pilha) {
    for (const p of propsDeTransicao(r.corpo).filter((x) => x !== 'none')) assert.ok(['transform', 'opacity'].includes(p), `${r.seletor} anima ${p}`);
    const t = r.corpo.match(/transition:\s*([^;]+)/);
    if (t && t[1].trim() !== 'none') assert.match(t[1], /var\(--nv-mov(-rapido)?\)/, r.seletor);
  }
  assert.match(css, /@keyframes nv-gira\s*\{\s*to\s*\{\s*transform:\s*rotate/);
  assert.match(css, /\.nv-aviso--carregando::before\s*\{[^}]*animation:\s*nv-gira calc\(var\(--nv-mov\)/);
  assert.match(css, /\[data-arrastando\]\s*\{[^}]*transition:\s*none/);
  assert.match(css, /@starting-style\s*\{\s*\.nv-avisos \.nv-avisos__lista > \.nv-aviso\s*\{/);
  assert.match(css, /\.nv-avisos \.nv-avisos__lista > \.nv-aviso\s*\{[^}]*touch-action:\s*pan-y/);
});

test('CSS da pilha: movimento reduzido zera o deslocamento e o anel vira pontos parados', () => {
  const red = regrasReduzidas();
  const aviso = red.find((r) => r.seletor.includes('.nv-avisos[data-expandido] .nv-avisos__lista > .nv-aviso'));
  assert.ok(aviso, 'falta a regra da pilha no movimento reduzido');
  assert.match(aviso.corpo, /transform:\s*none/);
  assert.match(aviso.corpo, /transition-property:\s*opacity/);
  const anel = red.find((r) => r.seletor === '.nv-aviso--carregando::before');
  assert.match(anel.corpo, /animation:\s*none/);
  assert.match(reduzido, /\.nv-avisos \.nv-avisos__lista > \.nv-aviso\s*\{\s*transform:\s*none/);
});

test('CSS da pilha: botões com :focus-visible e alvo de toque de 44px', () => {
  assert.match(css, /\.nv-aviso__fechar:focus-visible[^{]*\{[^}]*box-shadow:\s*var\(--nv-foco\)/);
  assert.match(css, /\.nv-aviso__acao:focus-visible/);
  const controle = Number(css.match(/--nv-controle:\s*(\d+)px/)[1]);
  assert.ok(controle >= 44);
  const fechar = regras().find((r) => r.seletor === '.nv-aviso__fechar').corpo;
  for (const p of ['width', 'height', 'min-width', 'min-height']) assert.match(fechar, new RegExp(`(^|[;\\s])${p}:\\s*var\\(--nv-controle\\)`));
  assert.match(regras().find((r) => r.seletor === '.nv-aviso__acao').corpo, /min-height:\s*var\(--nv-controle\)/);
});

test('contraste do texto de cada tipo sobre o fundo do aviso ≥ 4.5 no claro e no escuro', () => {
  const tipos = { info: 'info', sucesso: 'success', atencao: 'warning', perigo: 'destructive' };
  for (const [nome, token] of Object.entries(tipos)) {
    const m = css.match(new RegExp(`--nv-${nome}-fundo:\\s*color-mix\\(in oklab, var\\(--${token}\\) (\\d+)%, var\\(--card\\)\\)`));
    assert.ok(m, `--nv-${nome}-fundo mudou de formato`);
    for (const modo of ['claro', 'escuro']) {
      const t = resolver('nuvytech', modo);
      const fg = rgb(t[token]);
      const fundo = misturaOklab(fg, rgb(t.card), Number(m[1]) / 100);
      const r = contraste(fg, fundo);
      assert.ok(r >= 4.5, `${nome} no ${modo}: ${r.toFixed(2)}`);
    }
  }
});

test('pilha aberta: --nv-altura-aberta na caixa e ponte ::before para o mouse não cair nos vãos', () => {
  const a = carregarAviso();
  for (const t of ['um', 'dois', 'três']) a.item(a.api.mostrar({ texto: t, duracao: Infinity })).altura = 60;
  a.evento(a.caixa(), 'pointerenter', { bubbles: false });
  assert.ok(a.caixa().hasAttribute('data-expandido'));
  // 3 avisos de 60 px com 2 vãos de 8 px.
  assert.equal(a.caixa().style.getPropertyValue('--nv-altura-aberta'), '196px');
  const ponte = regras().find((r) => r.seletor === '.nv-avisos[data-expandido]::before');
  assert.ok(ponte, 'falta a ponte da pilha aberta');
  assert.match(ponte.corpo, /height:\s*var\(--nv-altura-aberta/);
  assert.match(ponte.corpo, /z-index:\s*-1/);
  assert.match(ponte.corpo, /bottom:\s*0/);
});
