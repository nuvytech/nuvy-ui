// Carrega o nuvy-aviso.js num DOM falso e dá atalhos para os testes da pilha de avisos.
import { ambiente, lerArq } from './dom-falso.mjs';

const codigo = lerArq('modelos/nuvy-aviso.js');

// antes(document): monta o HTML da página antes do script carregar.
// Por padrão o relógio anda o atraso do primeiro anúncio, como numa página já aberta há um tempo;
// { recemCarregada: true } pula isso para testar o atraso.
export function carregarAviso(opcoes = {}, antes) {
  const { recemCarregada, ...resto } = opcoes;
  const amb = ambiente(resto);
  if (antes) antes(amb.document);
  amb.rodar(codigo);
  if (!recemCarregada) amb.clock.avancar(100);
  const api = amb.ctx.nuvyAviso;
  const caixa = () => amb.document.querySelector('.nv-avisos');
  const itens = () => (caixa() ? caixa().querySelectorAll('li') : []);
  const item = (id) => itens().find((li) => li.getAttribute('data-id') === String(id)) ?? null;
  const regiao = (nivel) => caixa().querySelector(`[data-anuncio="${nivel}"]`);
  return { ...amb, api, caixa, itens, item, regiao };
}

// Espera as promessas pendentes (microtarefas) terminarem.
export const esperar = () => new Promise((r) => setImmediate(r));
