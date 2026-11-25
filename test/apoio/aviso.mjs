// Carrega o nuvy-aviso.js num DOM falso e dá atalhos para os testes da pilha de avisos.
import { ambiente, lerArq } from './dom-falso.mjs';

const codigo = lerArq('modelos/nuvy-aviso.js');

export function carregarAviso(opcoes) {
  const amb = ambiente(opcoes);
  amb.rodar(codigo);
  const api = amb.ctx.nuvyAviso;
  const caixa = () => amb.document.querySelector('.nv-avisos');
  const itens = () => (caixa() ? caixa().querySelectorAll('li') : []);
  const item = (id) => itens().find((li) => li.getAttribute('data-id') === String(id)) ?? null;
  const regiao = (nivel) => caixa().querySelector(`[data-anuncio="${nivel}"]`);
  return { ...amb, api, caixa, itens, item, regiao };
}

// Espera as promessas pendentes (microtarefas) terminarem.
export const esperar = () => new Promise((r) => setImmediate(r));
