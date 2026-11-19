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

/* ---------- Céu observado por satélite (NOAA GOES-19, via Open-Meteo) ----------
 * De dia, o satélite mede quanta luz do sol chega de fato à lagoa (a cada 10 min).
 * Índice de claridade k = radiação que chega ao chão / radiação no topo da atmosfera.
 *   k alto  → sol aberto; k médio → nuvens com sol; k baixo → céu fechado.
 * Limites iniciais (ajustáveis com observações no local):
 */
const K_ENSOLARADO = 0.62;      // k ≥ 0,62 → ENSOLARADO
const K_NUBLADO = 0.30;         // k < 0,30 → NUBLADO (entre os dois → NUVEM COM SOL)
const SOL_MIN_TOA = 150;        // W/m²; abaixo disso (noite ou sol muito baixo) usa a previsão
const SAT_MAX_ATRASO_MIN = 90;  // dado de satélite mais velho que isso é ignorado

function codigoPorSatelite(sat) {
  if (!sat || sat.toa < SOL_MIN_TOA || sat.idadeMin > SAT_MAX_ATRASO_MIN) return null;
  const k = sat.ghi / sat.toa;
  if (k >= K_ENSOLARADO) return 0; // ensolarado
  if (k >= K_NUBLADO) return 2;    // nuvem com sol
  return 3;                        // nublado
}

/**
 * Céu pela previsão de nuvens (noite ou sem satélite).
 * Usa só as nuvens baixas e médias: nuvens altas e finas deixam o sol aparecer.
 * Nublado = céu praticamente todo coberto (≥ 88%, o "8/8" da meteorologia).
 */
function codigoPorNuvens(p) {
  const opacas = (p.nuvensBaixas !== undefined || p.nuvensMedias !== undefined)
    ? Math.max(p.nuvensBaixas ?? 0, p.nuvensMedias ?? 0)
    : p.nuvens;
  if (opacas === undefined) return 2;
  if (opacas < 25) return 0;   // ensolarado
  if (opacas < 88) return 2;   // nuvem com sol
  return 3;                    // nublado
}

/** Céu quando não está chovendo: satélite primeiro, previsão como reserva */
function ceuSemChuva(p) {
  return codigoPorSatelite(p.satelite) ?? codigoPorNuvens(p);
}

/**
 * Código final do céu:
 * - trovoada (95-99) e neblina (45/48) vêm da previsão e são mantidas;
 * - chuva (61-82) só vira CHUVA com 0,5 mm ou mais previstos;
 * - garoa (51-57) e céu sem chuva (0-3): satélite (de dia) ou nuvens baixas/médias (à noite).
 */
function codigoEfetivo(p) {
  const c = p.codigo;
  if (c >= 95) return c;
  if (c === 45 || c === 48) return c;
  if (c >= 61 && !(p.precipitacao !== undefined && p.precipitacao < CHUVA_MIN_MM)) return c;
  return ceuSemChuva(p);
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
    current: 'wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,precipitation,' +
             'cloud_cover,cloud_cover_low,cloud_cover_mid',
    wind_speed_unit: 'kmh',
    timezone: 'America/Sao_Paulo',
  });
  // cache: 'no-store' → o navegador nunca reaproveita uma resposta antiga da previsão
  const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`Open-Meteo respondeu ${resp.status}`);
  const dados = await resp.json();
  const c = dados.current;
  console.log('Open-Meteo previsão (agora):', c);
  return {
    velocidade: c.wind_speed_10m,
    rajada: c.wind_gusts_10m,
    direcao: c.wind_direction_10m,
    codigo: c.weather_code,
    precipitacao: c.precipitation,
    nuvens: c.cloud_cover,
    nuvensBaixas: c.cloud_cover_low,
    nuvensMedias: c.cloud_cover_mid,
  };
}

/**
 * Última medição do satélite GOES-19 (radiação solar a cada 10 min, ~20 min de atraso).
 * Retorna null se não houver dado; o site então usa só a previsão.
 */
async function buscarSatelite() {
  try {
    const params = new URLSearchParams({
      latitude: LOCAL.latitude,
      longitude: LOCAL.longitude,
      hourly: 'shortwave_radiation,direct_radiation,terrestrial_radiation',
      models: 'satellite_radiation_seamless',
      temporal_resolution: 'native',
      timeformat: 'unixtime',
    });
    const resp = await fetch(`https://satellite-api.open-meteo.com/v1/archive?${params}`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`satélite respondeu ${resp.status}`);
    const dados = await resp.json();
    // a série pode vir como "hourly" ou "minutely_*": pega a que tiver os dados
    const serie = Object.values(dados).find((v) => v && Array.isArray(v.time) && Array.isArray(v.shortwave_radiation));
    if (!serie) return null;
    const agora = Date.now() / 1000;
    for (let i = serie.time.length - 1; i >= 0; i--) {
      const ghi = serie.shortwave_radiation[i];
      const toa = serie.terrestrial_radiation?.[i];
      if (serie.time[i] <= agora && ghi != null && toa != null) {
        const sat = { ghi, toa, direto: serie.direct_radiation?.[i], idadeMin: Math.round((agora - serie.time[i]) / 60) };
        console.log('Satélite (última medição):', sat, 'k =', toa > 0 ? (ghi / toa).toFixed(2) : '-');
        return sat;
      }
    }
    return null;
  } catch (e) {
    console.warn('Satélite indisponível, usando só a previsão:', e);
    return null;
  }
}

async function buscarDados() {
  const [previsao, satelite] = await Promise.all([buscarPrevisao(), buscarSatelite()]);
  return { ...previsao, satelite };
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
    nuvensBaixas: q.has('baixas') ? Number(q.get('baixas')) : undefined,
    nuvensMedias: q.has('medias') ? Number(q.get('medias')) : undefined,
    // &k=0.5 simula a medição do satélite (índice de claridade)
    satelite: q.has('k') ? { ghi: Number(q.get('k')) * 1000, toa: 1000, idadeMin: 20 } : null,
  };
}

let anguloAtual = 0;

function girarSeta() {
  document.getElementById('seta').style.setProperty('--angulo', `${anguloAtual}deg`);
}

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
  // Na abertura a seta fica em 0° (N); ela gira para a direção quando a interface aparece
  if (!document.body.classList.contains('carregando')) girarSeta();

  const sigla = document.getElementById('sigla');
  sigla.textContent = SIGLAS[i];
  ajustarSigla();
}

/** Mantém a sigla com a altura do Figma (556px em tela de 960px) sem passar da largura da tela */
function ajustarSigla() {
  const sigla = document.getElementById('sigla');
  const alturaTela = window.innerHeight;
  const larguraTela = window.innerWidth;
  // Desktop (Figma 1440x960): fonte 1000px; celular (Figma 393x852): fonte 516,6px
  const celular = window.matchMedia('(max-width: 760px)').matches;
  let tamanho = alturaTela * (celular ? 516.6 / 852 : 1000 / 960);
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

let ultimaAtualizacao = 0;

async function atualizar() {
  ultimaAtualizacao = Date.now();
  const demo = lerDemo();
  if (demo) { mostrar(demo); return; }
  try {
    mostrar(await buscarDados());
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
const ATRASO_SETA_MS = 300; // espera um pouco do fade in antes de girar a seta
const GIRO_SETA_MS = 1000;  // mesma duração da transição da seta no style.css
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
  // A seta começa em 0° e gira para a direção do vento logo depois que a interface começa a aparecer
  setTimeout(girarSeta, ATRASO_SETA_MS);
  // Quando a seta para (giro de 1s), a sigla aparece com fade in
  setTimeout(() => document.body.classList.remove('sigla-oculta'), ATRASO_SETA_MS + GIRO_SETA_MS);
  // Remove a abertura depois do fade (o tempo garante a remoção mesmo se o CSS não carregar)
  setTimeout(() => abertura.remove(), 700);
}

/**
 * Atualização a cada 15 minutos.
 * Em vez de confiar só num timer de 15 min (que o navegador congela quando a aba fica
 * em segundo plano ou o celular bloqueia), verificamos a cada 30 s se já passaram 15 min
 * desde a última busca, e também assim que a pessoa volta para a aba.
 */
const INTERVALO_MS = ATUALIZAR_A_CADA_MIN * 60 * 1000;

function atualizarSeVencido() {
  if (document.visibilityState === 'visible' && Date.now() - ultimaAtualizacao >= INTERVALO_MS) {
    atualizar();
  }
}

window.addEventListener('resize', ajustarSigla);
iniciar();
setInterval(atualizarSeVencido, 30 * 1000);
document.addEventListener('visibilitychange', atualizarSeVencido);
// Voltar para a página pelo botão "voltar" pode restaurar uma cópia antiga dela: busca de novo
window.addEventListener('pageshow', (e) => { if (e.persisted) atualizar(); });
