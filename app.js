/* Wing Weather — Lagoa de Ibiraquera
 * Parâmetros: ver documento "parametros-condicoes-wing" do projeto.
 */

const LOCAL = { latitude: -28.1542, longitude: -48.6514 };
const ATUALIZAR_A_CADA_MIN = 15;

// Limites (em nós) — praticante experiente
const VENTO_MIN_KT = 12;
const VENTO_MAX_KT = 30;
const RAJADA_MAX_KT = 35;
const KMH_POR_NO = 1.852;

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

/** Código WMO -> uma das 4 categorias de céu */
function categoriaCeu(codigo) {
  if (codigo === 0) return 'ensolarado';
  if (codigo === 1 || codigo === 2) return 'nuvemSol';
  if (codigo === 3 || codigo === 45 || codigo === 48) return 'nublado';
  return 'chuva'; // garoa, chuva, pancadas, neve/granizo, trovoada
}

/** Céu bom para velejar? (chuva fraca é aceitável; neblina, chuva forte e trovoada não) */
function ceuBom(codigo) {
  const bons = [0, 1, 2, 3, 51, 53, 55, 56, 57, 61, 80];
  return bons.includes(codigo);
}

/** Vento bom para velejar? (velocidades em km/h vindas da API) */
function ventoBom(velocidadeKmh, rajadaKmh) {
  const kt = velocidadeKmh / KMH_POR_NO;
  const rajadaKt = rajadaKmh / KMH_POR_NO;
  return kt >= VENTO_MIN_KT && kt <= VENTO_MAX_KT && rajadaKt <= RAJADA_MAX_KT;
}

/** Graus (de onde o vento vem) -> índice 0..15 da rosa */
function indiceDirecao(graus) {
  return Math.floor(((graus % 360) + 360 + 11.25) / 22.5) % 16;
}

async function buscarPrevisao() {
  const params = new URLSearchParams({
    latitude: LOCAL.latitude,
    longitude: LOCAL.longitude,
    current: 'wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code',
    wind_speed_unit: 'kmh',
    timezone: 'America/Sao_Paulo',
  });
  const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!resp.ok) throw new Error(`Open-Meteo respondeu ${resp.status}`);
  const dados = await resp.json();
  const c = dados.current;
  return {
    velocidade: c.wind_speed_10m,
    rajada: c.wind_gusts_10m,
    direcao: c.wind_direction_10m,
    codigo: c.weather_code,
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
  };
}

let anguloAtual = 0;

function mostrar(p) {
  // Céu
  const ceu = CEU[categoriaCeu(p.codigo)];
  document.body.className = ceu.classe;
  document.getElementById('icone-ceu').src = ceu.icone;
  document.getElementById('texto-ceu').textContent = ceu.texto;

  // Velocidade
  document.getElementById('texto-velocidade').textContent =
    `VELOCIDADE= ${Math.round(p.velocidade)}km/h`;

  // Bom ou ruim para velejar
  const bom = ventoBom(p.velocidade, p.rajada) && ceuBom(p.codigo);
  document.getElementById('icone-condicao').src = bom ? 'assets/bom.svg' : 'assets/ruim.svg';
  document.getElementById('texto-condicao').textContent = bom ? 'BOM PARA VELEJAR' : 'RUIM PARA VELEJAR';

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

window.addEventListener('resize', ajustarSigla);
document.fonts?.ready.then(ajustarSigla);
atualizar();
setInterval(atualizar, ATUALIZAR_A_CADA_MIN * 60 * 1000);
