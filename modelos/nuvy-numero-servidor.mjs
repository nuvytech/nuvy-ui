// nuvy-ui — HTML do número animado gerado no servidor (SSR, e-mail, página estática).
// Devolve <span class="nv-numero" ...>texto formatado</span> já escapado; no navegador, nuvy-numero.js
// hidrata sem mudar o texto e só cria as colunas na primeira atualização.
import { formatar, valido } from './nuvy-numero-formato.mjs';

// Controles bidirecionais (U+202A–U+202E e U+2066–U+2069): podem inverter o texto na tela e enganar quem lê.
const BIDI = /[‪-‮⁦-⁩]/g;
const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
const PERIGOSOS = /[&<>"'`]/g;

function escapar(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return texto.replace(BIDI, '').replace(PERIGOSOS, (c) => ENTIDADES[c]);
}

// Para conteúdo entre tags.
export function escaparTexto(valor) {
  return escapar(valor);
}

// Para valor de atributo entre aspas duplas (escapa também aspas simples e crase, por garantia).
export function escaparAtributo(valor) {
  return escapar(valor);
}

// htmlNumero(1234.5, { estilo: 'moeda' }, 'pt-BR')
// Valor que não é número finito (ou texto numérico) sai como texto escapado, sem data-valor.
export function htmlNumero(valor, opcoes = {}, locale = 'pt-BR') {
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  const ok = valido(numero);
  const texto = ok ? formatar(numero, opcoes, locale) : escaparTexto(valor);
  const atributos = [
    'class="nv-numero"',
    `data-valor="${ok ? escaparAtributo(String(numero)) : ''}"`,
    `data-formato="${escaparAtributo(JSON.stringify(opcoes ?? {}))}"`,
  ];
  if (locale !== 'pt-BR') atributos.push(`data-locale="${escaparAtributo(locale)}"`);
  return `<span ${atributos.join(' ')}>${ok ? escaparTexto(texto) : texto}</span>`;
}
