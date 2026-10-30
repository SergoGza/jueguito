// Bots para el juguete: juegan muchas partidas con el motor real (sin navegador) y sacan porcentajes.
// No son personas: sirven para ver si una regla rompe algo (si esconderse gana, si nadie llega), no para fijar la dificultad.
//
// Uso (desde la raíz del repositorio):
//   node herramientas/bot.js [N] [palancas-json]
//   node herramientas/bot.js 1000 '{"PARAMS.pararAlLlegar":{"desconocido":0.3,"conocido":0.4}}'
//
// Bots:
//   escondido  se queda en la ribera todos los días.
//   azar       pulsa cualquier cosa que se pueda pulsar.
//   novato     no conoce la ciudad: entra, va a sitios al azar, pide donde hay gente si no ve la ronda, no repite sitio
//              el mismo día y vuelve a la ribera antes de que cierren.
//   veterano   conoce los horarios de la gente y el recorrido de costumbre de la ronda (lo que aprende un jugador en
//              unas partidas). Elige adónde ir por lo que espera sacar menos el riesgo. Arriesga más.
//   prudente   como el veterano, pero pesa el triple el riesgo de la ronda.
//   dentro-listo   como el veterano, pero duerme siempre dentro de la muralla, buscando un sitio sin quejas que él sepa.
//   dentro-ciego   como el veterano, pero duerme siempre dentro, donde le pille la noche.
// Todos cenan una ración entera si pueden.
const path = require("path");
const RAIZ = path.resolve(__dirname, "..");
const N = +process.argv[2] || 1000;
global.window = {};
require(path.join(RAIZ, "rules.js"));
const pal = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const poner = (o, k, v) => { const ks = k.split("."); let x = o; while (ks.length > 1) x = x[ks.shift()]; x[ks[0]] = v; };
for (const [k, v] of Object.entries(pal)) poner(window.RULES, k, v);
require(path.join(RAIZ, "engine.js"));
const R = window.RULES, E = window.ENGINE, P = R.PARAMS;

// ------------------------------------------------------------------ utilidades
function costes(s, desde) {
  const m = R.MODOS[s.modo];
  const d = { [desde]: 0 }; const q = [desde];
  while (q.length) {
    q.sort((a, b) => d[a] - d[b]);
    const x = q.shift();
    for (const y of E.VECINOS[x]) {
      const c = m.zona === "lugar" ? m.paso : (E.L[x].barrio === E.L[y].barrio ? 0 : m.cruce);
      if (!(y in d) || d[x] + c < d[y]) { d[y] = d[x] + c; q.push(y); }
    }
  }
  return d;
}
function primerPaso(s, destino) {
  const dd = costes(s, destino);
  let best = null;
  for (const mv of E.opciones(s).movs) {
    if (!mv.ok) continue;
    const v = mv.coste + dd[mv.destino];
    if (!best || v < best.v || (v === best.v && dd[mv.destino] < best.r)) best = { v, mv, r: dd[mv.destino] };
  }
  return best && best.mv;
}
function volver(s) {
  if (s.lugar === "ribera") return E.acabarDia(s);
  const mv = primerPaso(s, "ribera");
  const dd = costes(s, "ribera");
  // solo si acerca de verdad (en B, moverse dentro del barrio no acerca)
  if (mv && mv.coste <= E.opciones(s).quedan && dd[mv.destino] < dd[s.lugar]) return E.mover(s, mv.destino);
  return E.acabarDia(s);
}
function genteBase(s, l, d, f) {
  let g = E.L[l].gente[f];
  const mod = R.DIAS_SENALADOS[R.CALENDARIO[d - 1].tipo];
  if (mod && mod[l] && mod[l][f] != null) g = mod[l][f];
  return g;
}

// ------------------------------------------------------------------ bots
function azar(s, rnd) {
  const o = E.opciones(s);
  const ok = o.movs.filter((x) => x.ok).map((x) => ["m", x.destino]).concat(o.acc.filter((x) => x.ok).map((x) => ["a", x.id]));
  const [k, v] = ok[Math.floor(rnd() * ok.length)];
  if (k === "m") E.mover(s, v); else ({ pedir: E.pedir, trabajo: E.pedirTrabajo, esperar: E.esperar, acabar: E.acabarDia })[v](s);
}

function novato(s, rnd, g) {
  const o = E.opciones(s);
  const vuelta = costes(s, s.lugar).ribera;
  if (o.quedan <= vuelta + (R.MODOS[s.modo].zona === "lugar" ? 2 : 0)) return volver(s);
  const r = E.rondaEnTuZona(s);
  const tr = o.acc.find((x) => x.id === "trabajo");
  if (tr && tr.ok) return E.pedirTrabajo(s);
  const pd = o.acc.find((x) => x.id === "pedir");
  const yaAqui = s.pedidoHoy.some((p) => p.lugar === s.lugar);
  if (pd && pd.ok && !r && !yaAqui) return E.pedir(s);
  if (g.libres > 3) return E.esperar(s);
  const cand = o.movs.filter((x) => x.ok && E.L[x.destino].dentro && !(r && E.zonaDe(s, x.destino) === E.zonaDe(s, r)));
  const nuevos = cand.filter((x) => !s.pedidoHoy.some((p) => p.lugar === x.destino));
  const pool = nuevos.length ? nuevos : cand;
  if (pool.length && o.quedan > 6) return E.mover(s, pool[Math.floor(rnd() * pool.length)].destino);
  if (!E.L[s.lugar].dentro) { const mv = primerPaso(s, "puerta"); if (mv) return E.mover(s, mv.destino); }
  return E.esperar(s);
}

function valor(s, l, f, lambda) {
  if (f > 5 || !E.L[l].dentro) return -9;
  const g = genteBase(s, l, s.dia, f);
  if (g < 2) return -9;
  const LT = s.dia >= P.escasezDesde ? P.limosnaEscasez : P.limosna;
  const media = (da) => (da >= 3 ? LT[3] : da === 2 ? LT[2] : [0]).reduce((a, b) => a + b, 0) / (da >= 2 ? 6 : 1);
  const pp = E.L[l].pobres;
  const ev = (1 - pp) * media(g) + pp * media(g - 1);
  const circ = (R.CALENDARIO[s.dia - 1].tipo === "corpus" ? R.RONDA.circuitoCorpus : R.RONDA.circuito)[f];
  let pr = R.RONDA.desvio * E.lugaresZona(s, E.zonaDe(s, l)).filter((x) => E.L[x].dentro).length / 8;
  if (circ && E.zonaDe(s, circ) === E.zonaDe(s, l)) pr += 1 - R.RONDA.desvio;
  if (s.pedidoHoy.some((p) => p.lugar === l)) pr += 0.4;
  return ev - pr * (g >= 3 ? 0.5 : 1) * lambda;
}
// dormir dentro: buscar, con lo que ha visto hoy (dónde pidió y dónde vio pobres), un sitio sin quejas; «ciego» duerme donde le pille
function dormirDentro(s, ciego) {
  if (ciego || !E.L[s.lugar].dentro) return E.L[s.lugar].dentro ? E.acabarDia(s) : volver(s);
  const malo = (l) => E.saberNoche(s, l).filter((x) => !x.startsWith("Que tú sepas")).length;
  if (malo(s.lugar) === 0) return E.acabarDia(s);
  const o = E.opciones(s);
  const mejor = o.movs.filter((mv) => mv.ok && E.L[mv.destino].dentro && mv.coste <= o.quedan).sort((a, b) => malo(a.destino) - malo(b.destino))[0];
  if (mejor && malo(mejor.destino) < malo(s.lugar)) return E.mover(s, mejor.destino);
  return E.acabarDia(s);
}
function veterano(s, rnd, g, lambda, dentro) {
  const o = E.opciones(s);
  const m = R.MODOS[s.modo];
  const f = E.franja(s.t);
  const dr = costes(s, s.lugar);
  if (g.libres > 4) return E.esperar(s);
  if (dentro && E.L[s.lugar].dentro && (o.quedan <= (m.zona === "lugar" ? 4 : 6) || (s.t >= 30 && s.pan >= 2))) return dormirDentro(s, dentro === "ciego");
  if (!dentro || !E.L[s.lugar].dentro) {
    if (o.quedan <= dr.ribera + (m.zona === "lugar" ? 1 : 0) || (s.t >= 30 && s.pan >= 2) || s.pan >= 4) return volver(s);
  }
  const r = E.rondaEnTuZona(s);
  const tr = o.acc.find((x) => x.id === "trabajo");
  if (tr && tr.ok && s.cuerpo >= 4) return E.pedirTrabajo(s);
  const pd = o.acc.find((x) => x.id === "pedir");
  if (pd && pd.ok && !r) {
    const sig = s.t % 6 !== 0 && R.RONDA.circuito[f + 1] && E.zonaDe(s, R.RONDA.circuito[f + 1]) === E.zonaDe(s, s.lugar);
    if (valor(s, s.lugar, f, lambda) > 0.2 && !sig && !s.pedidoHoy.some((p) => p.lugar === s.lugar && E.L[s.lugar].aviso > 0)) return E.pedir(s);
  }
  let best = null;
  for (const l of Object.keys(E.L)) {
    if (!E.L[l].dentro || (r && E.zonaDe(s, l) === E.zonaDe(s, r))) continue;
    const llega = s.t + dr[l];
    if (llega + 6 > E.FIN) continue;
    const v = valor(s, l, E.franja(llega), lambda) - dr[l] / 12;
    if (!best || v > best.v) best = { v, l };
  }
  if (best && best.l !== s.lugar && best.v > 0) { const mv = primerPaso(s, best.l); if (mv) return E.mover(s, mv.destino); }
  return E.esperar(s);
}

const BOTS = {
  escondido: (s) => E.acabarDia(s),
  azar,
  novato,
  veterano: (s, rnd, g) => veterano(s, rnd, g, 1.5),
  prudente: (s, rnd, g) => veterano(s, rnd, g, 3),
  "dentro-listo": (s, rnd, g) => veterano(s, rnd, g, 1.5, "listo"),
  "dentro-ciego": (s, rnd, g) => veterano(s, rnd, g, 1.5, "ciego"),
};

// ------------------------------------------------------------------ partidas
function jugar(modo, bot, sem) {
  let st = 12345 + sem * 7919;
  const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; };
  const s = E.nueva(modo, "bot", String(sem));
  const g = { clave: null, libres: 0 };
  let guard = 0;
  while (s.fase !== "fin" && guard++ < 5000) {
    if (s.fase === "amanecer") { E.empezarJornada(s); continue; }
    if (s.fase === "resultado") { E.seguir(s); continue; }
    if (s.fase === "noche") { E.cenar(s, 2); continue; }
    if (s.t >= E.FIN) { E.comprobarNoche(s); continue; }
    const clave = s.dia * 100 + s.t;
    g.libres = g.clave === clave ? g.libres + 1 : 0; g.clave = clave; // en B, moverse dentro del barrio no gasta tiempo
    BOTS[bot](s, rnd, g);
    E.comprobarNoche(s);
  }
  if (s.fase !== "fin" && process.env.DEPURAR) console.error("atasco", modo, bot, sem, s.dia, s.t, s.lugar, s.fase, s.cronica.slice(-6).map((c) => c.texto));
  return s;
}

const pct = (x, n) => `${Math.round((100 * (x || 0)) / n)}`.padStart(3) + " %";
console.log(`${N} partidas por bot y prueba · versión ${R.version}${Object.keys(pal).length ? " · palancas " + JSON.stringify(pal) : ""}\n`);
console.log("prueba bot           | siega  sin siega | hambre  destierro  azotes | día   cuerpo* | pan/día  moverse  pasos o cruces/día  ronda al llegar/día");
for (const modo of ["A", "B"]) {
  for (const bot of Object.keys(BOTS)) {
    const fin = {}; let dias = 0, cuerpo = 0, llegan = 0, T = null;
    for (let i = 1; i <= N; i++) {
      const s = jugar(modo, bot, i);
      fin[s.final.tipo] = (fin[s.final.tipo] || 0) + 1;
      dias += s.final.dia;
      if (s.final.tipo === "siega" || s.final.tipo === "aguanta") { cuerpo += s.cuerpo; llegan++; }
      const t = E.resumenDias(s);
      if (!T) T = t; else Object.keys(t).forEach((k) => (T[k] += t[k]));
    }
    const ratos = T.mover + T.pedir + T.trabajar + T.esperar + T.perdido || 1;
    const mov = modo === "A" ? T.pasos : T.cruces;
    console.log(`${modo}      ${bot.padEnd(13)} | ${pct(fin.siega, N)}  ${pct(fin.aguanta, N)}     | ${pct(fin.hambre, N)}  ${pct(fin.desterrado, N)}      ${pct(fin.muerto, N)} | ${(dias / N).toFixed(1).padStart(4)}  ${llegan ? (cuerpo / llegan).toFixed(1) : " — "}     | ${((T.panPedido + T.panTrabajo) / dias).toFixed(2).padStart(5)}    ${pct(T.mover, ratos)}   ${(mov / dias).toFixed(1).padStart(4)}                ${(T.encuentros / dias).toFixed(2)}`);
  }
  console.log("");
}
console.log("* cuerpo medio de los que llegan a la siega (con siega o sin ella).");
