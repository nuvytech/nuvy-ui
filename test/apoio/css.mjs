// Leitura do layout.css para os testes de movimento: sem comentários, com atalhos para achar regras.
import { lerArq } from './dom-falso.mjs';

export const css = lerArq('layout/layout.css').replace(/\/\*[\s\S]*?\*\//g, '');

// Trecho do bloco @media (prefers-reduced-motion: reduce) que fica antes da variante lateral.
const ini = css.indexOf('@media (prefers-reduced-motion: reduce)');
export const reduzido = css.slice(ini, css.indexOf('.nv-pagina--lateral {'));

// Todas as regras de nível de topo (fora de @media) como { seletor, corpo }, na ordem do arquivo.
export function regras(texto = css) {
  const saida = [];
  let i = 0;
  while (i < texto.length) {
    const abre = texto.indexOf('{', i);
    if (abre < 0) break;
    const seletor = texto.slice(i, abre).trim();
    let nivel = 1;
    let j = abre + 1;
    while (j < texto.length && nivel > 0) {
      if (texto[j] === '{') nivel++;
      else if (texto[j] === '}') nivel--;
      j++;
    }
    saida.push({ seletor, corpo: texto.slice(abre + 1, j - 1) });
    i = j;
  }
  return saida;
}

// Regras cujo seletor menciona a classe (fora do bloco de movimento reduzido).
export function regrasDe(classe) {
  return regras().filter((r) => !r.seletor.startsWith('@') && r.seletor.includes(classe));
}

// Regras dentro do bloco de movimento reduzido.
export function regrasReduzidas() {
  const corpo = reduzido.slice(reduzido.indexOf('{') + 1);
  return regras(corpo);
}

// Propriedades animadas de uma declaração transition: "opacity 200ms x, transform 200ms x" -> ['opacity','transform'].
export function propsDeTransicao(corpo) {
  const m = corpo.match(/(?:^|[;\s])transition:\s*([^;]+)/);
  if (!m) return [];
  return m[1].split(',').map((p) => p.trim().split(/\s+/)[0]).filter(Boolean);
}
