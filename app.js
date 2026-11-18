/* Wing Weather — Lagoa de Ibiraquera
 * Parâmetros: ver documento "parametros-condicoes-wing" do projeto.
 */

const LOCAL = { latitude: -28.1542, longitude: -48.6514 };
const ATUALIZAR_A_CADA_MIN = 15; // checa a condição atual a cada 15 minutos

// Limites (em nós) — praticante experiente
const KMH_POR_NO = 1.852;
const RAJADA_MAX_KT = 35;

// 4 níveis de condição (0 = melhor, 3 = pior)
const NIVEIS = [
  { texto: 'ÓTIMO PARA VELEJAR',   icone: 'assets/bom.svg' },
  { texto: 'BOM PARA VELEJAR',     icone: 'assets/bom.svg' },
  { texto: 'RUIM PARA VELEJAR',    icone: 'assets/ruim.svg' },
  { texto: 'PÉSSIMO PARA VELEJAR', icone: 'assets/ruim.svg' },
];
const OTIMO = 0, BOM = 1, RUIM = 2, PESSIMO = 3;

// Rosa dos ventos de 16 pontos (siglas em português)
const SIGLAS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];

// Céu: 4 categorias para exibição
const CEU = {
  ensolarado: { texto: 'ENSOLARADO',    icone: 'assets/sunny.svg',        classe: 'ceu-ensolarado' },
  nuvemSol:   { texto: 'NUVEM COM SOL', icone: 'assets/cloudy-sunny.svg', classe: 'ceu-nuvem-sol' },
  nublado:    { texto: 'NUBLADO',       icone: 'assets/cloud.svg',        classe: 'ceu-nublado' },
  chuva:      { texto: 'CHUVA',         icone: 'assets/rainy.svg',        classe: 'ceu-chuva' },
};

/** Chuva mínima (mm) para considerar que está chovendo de verdade */
const CHUVA_MIN_MM = 0.5;

/** Céu pela cobertura de nuvens (usado quando não há chuva de verdade) */
function codigoPorNuvens(nuvens) {
  if (nuvens === undefined) return 3;
  if (nuvens < 25) return 0;   // ensolarado
  if (nuvens < 75) return 2;   // nuvem com sol
  return 3;                    // nublado
}

/**
 * Corrige o código do modelo:
 * - garoa (51-57) nunca vira CHUVA: o céu segue a cobertura de nuvens;
 * - chuva (61-82) só vira CHUVA com 0,5 mm ou mais previstos;
 * - trovoada (95-99) é sempre mantida, por segurança.
 */
function codigoEfetivo(p) {
  const c = p.codigo;
  if (c >= 95) return c;
  if (c >= 51 && c <= 57) return codigoPorNuvens(p.nuvens);
  if (c >= 61 && p.precipitacao !== undefined && p.precipitacao < CHUVA_MIN_MM) {
    return codigoPorNuvens(p.nuvens);
  }
  return c;
}

/** Código WMO -> uma das 4 categorias de céu */
function categoriaCeu(codigo) {
  if (codigo === 0) return 'ensolarado';
  if (codigo === 1 || codigo === 2) return 'nuvemSol';
  if (codigo === 3 || codigo === 45 || codigo === 48) return 'nublado';
  return 'chuva'; // garoa, chuva, pancadas, neve/granizo, trovoada
}

/**
 * Nível do céu (código já corrigido):
 * ótimo = ensolarado, nuvem com sol; bom = nublado;
 * ruim = chuva (fraca, moderada ou forte) e neblina; péssimo = trovoada.
 */
function nivelCeu(codigo) {
  if (codigo >= 95) return PESSIMO;
  if (codigo <= 2) return OTIMO;
  if (codigo === 3) return BOM;
  return RUIM; // 45/48 neblina, chuva 61-82, neve/granizo
}

/**
 * Nível do vento (velocidades em km/h vindas da API, faixas em nós):
 * ótimo 15-22 kt; bom 12-15 ou 22-30 kt; ruim 8-12 kt;
 * péssimo < 8 kt, > 30 kt ou rajada > 35 kt.
 */
function nivelVento(velocidadeKmh, rajadaKmh) {
  const kt = velocidadeKmh / KMH_POR_NO;
  const rajadaKt = rajadaKmh / KMH_POR_NO;
  if (rajadaKt > RAJADA_MAX_KT) return PESSIMO;
  if (kt < 8 || kt > 30) return PESSIMO;
  if (kt < 12) return RUIM;
  if (kt >= 15 && kt <= 22) return OTIMO;
  return BOM;
}

/** Graus (de onde o vento vem) -> índice 0..15 da rosa */
function indiceDirecao(graus) {
  return Math.floor(((graus % 360) + 360 + 11.25) / 22.5) % 16;
}

async function buscarPrevisao() {
  const params = new URLSearchParams({
    latitude: LOCAL.latitude,
    longitude: LOCAL.longitude,
    current: 'wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,precipitation,cloud_cover',
    wind_speed_unit: 'kmh',
    timezone: 'America/Sao_Paulo',
  });
  const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!resp.ok) throw new Error(`Open-Meteo respondeu ${resp.status}`);
  const dados = await resp.json();
  const c = dados.current;
  console.log('Open-Meteo (agora):', c);
  return {
    velocidade: c.wind_speed_10m,
    rajada: c.wind_gusts_10m,
    direcao: c.wind_direction_10m,
    codigo: c.weather_code,
    precipitacao: c.precipitation,
    nuvens: c.cloud_cover,
  };
}

/** Modo demonstração: ?demo&vel=25&raj=30&dir=45&cod=2 */
function lerDemo() {
  const q = new URLSearchParams(location.search);
  if (!q.has('demo')) return null;
  return {
    velocidade: Number(q.get('vel') ?? 25),
    rajada: Number(q.get('raj') ?? q.get('vel') ?? 30),
    direcao: Number(q.get('dir') ?? 45),
    codigo: Number(q.get('cod') ?? 0),
    precipitacao: q.has('chuva') ? Number(q.get('chuva')) : undefined,
    nuvens: q.has('nuvens') ? Number(q.get('nuvens')) : undefined,
  };
}

let anguloAtual = 0;

function mostrar(p) {
  const codigo = codigoEfetivo(p);

  // Céu
  const ceu = CEU[categoriaCeu(codigo)];
  for (const c of Object.values(CEU)) document.body.classList.remove(c.classe);
  document.body.classList.add(ceu.classe);
  document.getElementById('icone-ceu').src = ceu.icone;
  document.getElementById('texto-ceu').textContent = ceu.texto;

  // Velocidade
  document.getElementById('texto-velocidade').textContent =
    `VELOCIDADE= ${Math.round(p.velocidade)}km/h`;

  // Condição: vale o pior entre vento e céu
  const nivel = NIVEIS[Math.max(nivelVento(p.velocidade, p.rajada), nivelCeu(codigo))];
  document.getElementById('icone-condicao').src = nivel.icone;
  document.getElementById('texto-condicao').textContent = nivel.texto;

  // Direção: seta gira para o ponto da rosa (0° = N) pelo caminho mais curto
  const i = indiceDirecao(p.direcao);
  const alvo = i * 22.5;
  let delta = ((alvo - anguloAtual) % 360 + 540) % 360 - 180;
  anguloAtual += delta;
  document.getElementById('seta').style.setProperty('--angulo', `${anguloAtual}deg`);

  const sigla = document.getElementById('sigla');
  sigla.textContent = SIGLAS[i];
  ajustarSigla();
}

/** Mantém a sigla com a altura do Figma (556px em tela de 960px) sem passar da largura da tela */
function ajustarSigla() {
  const sigla = document.getElementById('sigla');
  const alturaTela = window.innerHeight;
  const larguraTela = window.innerWidth;
  let tamanho = alturaTela * (1000 / 960);
  sigla.style.fontSize = `${tamanho}px`;
  const largura = sigla.getBoundingClientRect().width;
  const limite = larguraTela * 0.92;
  if (largura > limite) {
    tamanho *= limite / largura;
    sigla.style.fontSize = `${tamanho}px`;
  }
}

function mostrarErro() {
  document.getElementById('texto-ceu').textContent = 'SEM DADOS';
  document.getElementById('texto-condicao').textContent = 'TENTE MAIS TARDE';
}

async function atualizar() {
  const demo = lerDemo();
  if (demo) { mostrar(demo); return; }
  try {
    mostrar(await buscarPrevisao());
  } catch (e) {
    console.error(e);
    mostrarErro();
  }
}

/**
 * Abertura: os ícones do céu aparecem em sequência (ciclo de 1600ms).
 * A página só aparece depois de pelo menos um ciclo completo E com os dados prontos,
 * terminando sempre no fim de um ciclo; depois a interface surge com fade in.
 */
const CICLO_ABERTURA_MS = 1600;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function iniciar() {
  const inicio = performance.now();
  await Promise.all([atualizar(), document.fonts?.ready]);
  ajustarSigla();

  const decorrido = performance.now() - inicio;
  const fim = Math.max(1, Math.ceil(decorrido / CICLO_ABERTURA_MS)) * CICLO_ABERTURA_MS;
  await esperar(fim - decorrido);

  const abertura = document.getElementById('abertura');
  abertura.classList.add('saindo');
  document.body.classList.remove('carregando');
  abertura.addEventListener('transitionend', () => abertura.remove(), { once: true });
}

window.addEventListener('resize', ajustarSigla);
iniciar();
setInterval(atualizar, ATUALIZAR_A_CADA_MIN * 60 * 1000);
