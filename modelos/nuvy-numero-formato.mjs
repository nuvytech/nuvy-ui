// nuvy-ui — formatação do número animado (.nv-numero). Puro: não usa DOM, roda no navegador e no Node.
// partes(valor, opcoes, locale) quebra o número formatado em dígitos e símbolos, cada um com uma chave
// estável por posição (contada a partir da casa das unidades), para que o mesmo dígito não seja remontado
// quando o número muda (1234 -> 1235 só mexe na coluna das unidades).

const ESTILOS = { decimal: 'decimal', moeda: 'currency', porcentagem: 'percent' };
const SINAIS = { auto: 'auto', sempre: 'always', nunca: 'never', 'exceto-zero': 'exceptZero' };

// Converte as opções em português (as do data-formato) para Intl.NumberFormat. Chave desconhecida é ignorada.
export function opcoesIntl(opcoes = {}) {
  const o = opcoes && typeof opcoes === 'object' ? opcoes : {};
  const intl = { style: ESTILOS[o.estilo] || 'decimal' };
  if (intl.style === 'currency') intl.currency = typeof o.moeda === 'string' ? o.moeda : 'BRL';
  const casa = (v) => (Number.isInteger(v) && v >= 0 && v <= 20 ? v : undefined);
  if (casa(o.casas) !== undefined) intl.minimumFractionDigits = intl.maximumFractionDigits = o.casas;
  if (casa(o.minCasas) !== undefined) intl.minimumFractionDigits = o.minCasas;
  if (casa(o.maxCasas) !== undefined) intl.maximumFractionDigits = o.maxCasas;
  if (SINAIS[o.sinal]) intl.signDisplay = SINAIS[o.sinal];
  if (o.agrupar === false) intl.useGrouping = false;
  return intl;
}

// Formatador com rede de segurança: moeda ou casas inválidas caem no formato decimal simples.
function formatador(opcoes, locale) {
  try {
    return new Intl.NumberFormat(locale, opcoesIntl(opcoes));
  } catch {
    return new Intl.NumberFormat('pt-BR');
  }
}

export const valido = (v) => typeof v === 'number' && Number.isFinite(v);

// Texto completo, igual ao que o leitor de tela lê (aria-label).
export function formatar(valor, opcoes = {}, locale = 'pt-BR') {
  return formatador(opcoes, locale).format(valor);
}

// [{ tipo: 'digito' | 'simbolo', texto, chave }]. Inteiros: i0 (unidade), i1 (dezena)...; decimais: f0, f1...
// Separador de milhar: g + a casa à esquerda dele (g3 fica entre o milhar e a centena). Vírgula: d.
// Outros símbolos (R$, %, sinal, espaço): s:<tipo>:<ordem>.
export function partes(valor, opcoes = {}, locale = 'pt-BR') {
  const lista = formatador(opcoes, locale).formatToParts(valor);
  const totalInteiros = lista.filter((p) => p.type === 'integer').reduce((n, p) => n + p.value.length, 0);
  let inteirosVistos = 0;
  let decimaisVistos = 0;
  const contagem = {};
  const saida = [];
  for (const p of lista) {
    if (p.type === 'integer' || p.type === 'fraction') {
      for (const ch of p.value) {
        if (p.type === 'integer') {
          inteirosVistos++;
          saida.push({ tipo: 'digito', texto: ch, chave: `i${totalInteiros - inteirosVistos}` });
        } else {
          saida.push({ tipo: 'digito', texto: ch, chave: `f${decimaisVistos++}` });
        }
      }
    } else if (p.type === 'group') {
      saida.push({ tipo: 'simbolo', texto: p.value, chave: `g${totalInteiros - inteirosVistos}` });
    } else if (p.type === 'decimal') {
      saida.push({ tipo: 'simbolo', texto: p.value, chave: 'd' });
    } else {
      const n = (contagem[p.type] = (contagem[p.type] ?? -1) + 1);
      saida.push({ tipo: 'simbolo', texto: p.value, chave: `s:${p.type}:${n}` });
    }
  }
  return saida;
}
