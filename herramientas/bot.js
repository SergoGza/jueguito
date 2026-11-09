// Bots para el juguete: juegan muchas partidas con el motor real (sin navegador) y sacan porcentajes.
// No son personas: sirven para ver si una regla rompe algo (si esconderse gana, si nadie llega), no para fijar la dificultad.
//
// Uso (desde la raíz del repositorio):
//   node herramientas/bot.js [N] [palancas-json]
//   PRUEBAS=A,B node herramientas/bot.js 1000      (también la prueba B)
//   RUTINA=1 node herramientas/bot.js 1000         (el veterano y el prudente no se dan cuenta de que la ronda aprende)
//   LLAGA=1 node herramientas/bot.js 2000          (el veterano con distintas reglas para hacerse la llaga, y comparación por parejas)
//   DESGLOSE=1 ...                                 (detenciones por partida según el motivo)
//   BOTS=veterano,prudente ...                     (solo esos bots)
//   CIERRA=1 ...                                   (por separado, los veranos en que la ronda cierra cada puerta)
//   TUYOS=1 ...                                    (con los tuyos, Pedro y Catalina; j0.10)
//     DAR=todos|nadie|ojos|hambre|generoso         cómo les da pan el bot de noche (por defecto, todos):
//                                                  todos, lo que piden guardándose su ración; ojos, solo a Catalina, la
//                                                  que más ve; hambre, primero al más flaco; generoso, lo que piden aunque
//                                                  se quede sin cenar
//     OIDOS=0                                      el bot no usa lo que le cuentan para aprender la ronda
//   CADENA=1 ...                                   (varios veranos, 1545, 1552 y 1557, con los tuyos y los rasgos; j0.11)
//     HEREDERO=cuerpo|pedro|catalina               a quién elige el bot cuando puede elegir (por defecto, el de más cuerpo)
//     SEXO=mujer                                   el bot empieza como una moza (solo para medir los rasgos)
//   node herramientas/bot.js 1000 '{"PARAMS.pararAlLlegar":{"desconocido":0.3,"conocido":0.4}}'
//
// Bots:
//   escondido  se queda en la ribera todos los días.
//   azar       pulsa cualquier cosa que se pueda pulsar.
//   novato     no conoce la ciudad: entra, va a sitios al azar, pide donde hay gente si no ve la ronda, no repite sitio
//              el mismo día y vuelve a la ribera antes de que cierren, por el camino más corto.
//   veterano   conoce los horarios de la gente y el esqueleto de las costumbres de la ronda (por la mañana, donde hay
//              mercado o misa; a sexta come; a nona y a vísperas, donde hay gente; al anochecer cierra una puerta), y
//              aprende las de este verano de lo que ve, como quien mira Recuerdos (desde la j0.9 cambian en cada partida;
//              hasta la j0.8 se sabía el recorrido fijo). Elige adónde ir por lo que espera sacar menos el riesgo.
//              Arriesga más. No repite sitio y hora cuando ve que la ronda se lo ha aprendido.
//              Sale por la puerta en la que espera menos riesgo (j0.8: hay dos) y no empieza nada que le impida salir
//              antes de que cierren (hasta la j0.7.2 a veces se quedaba dentro sin querer, 1 de cada 9 noches).
//   prudente   como el veterano, pero pesa el triple el riesgo de la ronda.
//   osado      como el veterano, pero pesa un tercio el riesgo de la ronda (j0.11).
//   vidente    como el veterano, pero sabe las costumbres de este verano desde el primer día (techo de lo que da saber).
//   memorioso  como el veterano, pero cree que la ronda sigue el recorrido fijo de hasta la j0.8 y no aprende (el que
//              se lo sabía de memoria).
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

// ------------------------------------------------------------------ lo que sabe de la ronda
// Devuelve, para una franja, dónde cree que estará la ronda por costumbre: { sitio: probabilidad } ({} si come).
// s._sabe: "sabe" (las de este verano), "viejo" (el recorrido fijo de hasta la j0.8) o "aprende" (del esqueleto y lo visto).
const CLAVE = ["manana", "manana", null, "nona", "visperas", "cierra"];
const CORPUS_VIEJO = ["plaza", "rua", "rua", "rua", "plaza", "puerta"];
function cree(s, d, f) {
  if (f > 5) return {};
  const corpus = E.dia(s, d).tipo === "corpus";
  if (s._sabe === "viejo") { const l = (corpus ? CORPUS_VIEJO : R.RONDA.circuitoAntiguo)[f]; return l ? { [l]: 1 } : {}; }
  if (s._sabe === "sabe") { const l = E.circuitoDia(s, d)[f]; return l ? { [l]: 1 } : {}; }
  if (corpus && f < 5) return { [R.RONDA.circuitoCorpus[f]]: 1 }; // la procesión se conoce
  const k = CLAVE[f];
  if (!k) return {};
  const cand = R.RONDA.costumbres[k];
  // probabilidad de ver la ronda en un sitio si es su costumbre (sin desviarse) o si no lo es (por un desvío)
  const si = 1 - R.RONDA.desvio + R.RONDA.desvio / DENTRO_N, no = R.RONDA.desvio / DENTRO_N;
  const w = {};
  for (const c of cand) {
    let p = 1;
    for (const o of (s._obs || {})[k] || []) p *= o.vio ? (o.lugar === c ? si : no) : (o.lugar === c ? 1 - si : 1 - no);
    w[c] = p;
  }
  const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  for (const c of cand) w[c] /= tot;
  return w;
}
// probabilidad de que la ronda esté en la zona de un sitio a una franja, según lo que cree el bot (sin contar avisos)
function probRonda(s, l, d, f) {
  const z = E.zonaDe(s, l);
  let pr = (R.RONDA.desvio * E.lugaresZona(s, z).filter((x) => E.L[x].dentro).length) / DENTRO_N;
  for (const [c, p] of Object.entries(cree(s, d, f))) if (E.zonaDe(s, c) === z) pr += (1 - R.RONDA.desvio) * p;
  return pr;
}
// lo que le cuentan los tuyos: lo apunta como si lo hubiera visto (con OIDOS=0, no)
function apuntarContado(s) {
  const c = s.contado || [];
  for (let i = s._contadoN || 0; i < c.length; i++) {
    const x = c[i], k = CLAVE[x.f];
    if (process.env.OIDOS === "0" || !k || (E.dia(s, x.dia).tipo === "corpus" && x.f < 5)) continue;
    if (!R.RONDA.costumbres[k].includes(x.lugar)) continue;
    ((s._obs = s._obs || {})[k] = s._obs[k] || []).push({ lugar: x.lugar, vio: x.ronda });
  }
  s._contadoN = c.length;
}
// de noche: cuánto pan da a cada uno de los tuyos
function repartir(s) {
  const pol = process.env.DAR || "todos";
  if (pol === "nadie" || !s.nocheTuyos) return;
  let pide = s.nocheTuyos.filter((x) => x.presente && x.pide > 0);
  if (pol === "ojos") pide = pide.filter((x) => x.id === "catalina");
  if (pol === "hambre") pide.sort((a, b) => a.cuerpo - b.cuerpo);
  for (const x of pide) {
    const guarda = pol === "generoso" ? 0 : s.cuerpo <= 4 ? 2 : 1;
    const n = Math.min(x.pide, s.pan - guarda);
    if (n > 0) E.darPan(s, x.id, n);
  }
}
// lo que ve: en cada franja, si la ronda está o no donde está él (solo cuenta en los sitios de costumbre posibles)
function apuntarVisto(s) {
  if (s.t >= E.FIN || s.fase !== "dia" || !E.L[s.lugar].dentro) return;
  const f = E.franja(s.t), k = CLAVE[f];
  if (!k || E.dia(s).tipo === "corpus" && f < 5) return;
  const clave = `${s.dia}|${f}|${s.lugar}`;
  s._vistoK = s._vistoK || {};
  if (s._vistoK[clave]) return;
  s._vistoK[clave] = 1;
  if (!R.RONDA.costumbres[k].includes(s.lugar)) return;
  // si vino por un aviso suyo, no cuenta como costumbre
  const porque = s.rondasPorque[`${s.dia}|${f}`];
  const vio = !!E.rondaEnTuZona(s);
  if (vio && porque === "aviso" && s.pedidoHoy.length) return;
  ((s._obs = s._obs || {})[k] = s._obs[k] || []).push({ lugar: s.lugar, vio });
}

// ------------------------------------------------------------------ utilidades
// las puertas: sitios de dentro con un vecino de fuera (la del Río y, desde la j0.8, la de San Pablo)
const PUERTAS = Object.keys(E.L).filter((l) => E.L[l].dentro && E.VECINOS[l].some((v) => !E.L[v].dentro));
const DENTRO_N = Object.keys(E.L).filter((l) => E.L[l].dentro).length;
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
// ratos que cuesta salir de la muralla desde un sitio de dentro: llegar a una puerta y dar un paso fuera
function salida(s, l) {
  const m = R.MODOS[s.modo], d = costes(s, l);
  return Math.min(...PUERTAS.map((g) => d[g])) + (m.zona === "lugar" ? m.paso : m.cruce);
}
// lo que sabe el veterano del riesgo en una puerta a una hora: el recorrido de costumbre, los desvíos y lo que la ronda le ha aprendido
function riesgoPuerta(s, gate, t) {
  if (t >= E.FIN) return 0;
  const f = E.franja(t);
  let pr = probRonda(s, gate, s.dia, f);
  if ((((s.habitos || {})[f] || {})[gate] || []).length >= R.RONDA.aprende.minDias) pr += R.RONDA.aprende.prob;
  return pr;
}
function volver(s) {
  if (s.lugar === "ribera") return E.acabarDia(s);
  // dentro de la muralla y lejos de una puerta: el que conoce la ronda elige por cuál salir; el novato («ciego»), la más cercana
  if (E.L[s.lugar].dentro && !PUERTAS.includes(s.lugar) && !s._ciego) {
    const m = R.MODOS[s.modo], dd = costes(s, s.lugar), fuera = m.zona === "lugar" ? m.paso : m.cruce;
    let mejor = null;
    for (const g of PUERTAS) {
      const llega = s.t + dd[g];
      if (llega + fuera > E.FIN) continue;
      const v = riesgoPuerta(s, g, llega) * 3 + dd[g] / 12;
      if (!mejor || v < mejor.v) mejor = { v, g };
    }
    if (mejor) { const mv = primerPaso(s, mejor.g); if (mv) return E.mover(s, mv.destino); }
  }
  const mv = primerPaso(s, "ribera");
  const dd = costes(s, "ribera");
  // solo si acerca de verdad (en B, moverse dentro del barrio no acerca)
  if (mv && mv.coste <= E.opciones(s).quedan && dd[mv.destino] < dd[s.lugar]) return E.mover(s, mv.destino);
  return E.acabarDia(s);
}
function genteBase(s, l, d, f) {
  let g = E.L[l].gente[f];
  const mod = R.DIAS_SENALADOS[E.dia(s, d).tipo];
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
  s._ciego = true;
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
  const LT = E.escasez(s, s.dia) ? P.limosnaEscasez : P.limosna;
  const sube = s.llaga ? P.llaga.limosna : 0; // con la llaga, la tirada sube
  const media = (da) => (da < 2 ? 0 : [1, 2, 3, 4, 5, 6].reduce((a, t) => a + LT[da >= 3 ? 3 : 2][Math.min(6, t + sube) - 1], 0) / 6);
  const pp = E.L[l].pobres;
  const ev = (1 - pp) * media(g) + pp * media(g - 1);
  let pr = probRonda(s, l, s.dia, f);
  if (s.pedidoHoy.some((p) => p.lugar === l)) pr += 0.4;
  // la ronda aprende: el veterano y el prudente se dan cuenta (lo ven en Recuerdos) y no repiten sitio y hora;
  // con RUTINA=1 no se dan cuenta
  const ap = R.RONDA.aprende;
  if (ap && !process.env.RUTINA) { const h = ((s.habitos || {})[f] || {})[l]; if (h && h.length >= ap.minDias - 1) pr += ap.prob * (h.length >= ap.minDias ? 1 : 0.5); }
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
    const margen = E.L[s.lugar].dentro ? salida(s, s.lugar) : dr.ribera;
    if (o.quedan <= margen + (m.zona === "lugar" ? 1 : 0) || (s.t >= 30 && s.pan >= 2) || s.pan >= 4) return volver(s);
  }
  const r = E.rondaEnTuZona(s);
  const tr = o.acc.find((x) => x.id === "trabajo");
  if (tr && tr.ok && s.cuerpo >= 4 && !s.llaga) return E.pedirTrabajo(s);
  const pd = o.acc.find((x) => x.id === "pedir");
  if (pd && pd.ok && !r) {
    const sig = s.t % 6 !== 0 && f < 5 && probRonda(s, s.lugar, s.dia, f + 1) > 0.5; // la ronda suele llegar aquí la franja siguiente
    const cabe = dentro || !E.L[s.lugar].dentro || s.t + 6 + salida(s, s.lugar) <= E.FIN; // pedir y aún salir antes de que cierren
    const ajeno = E.hayQuejas(s, s.lugar) || E.tuyosEn(s, s.lugar).some((x) => x.pide); // ahí pide o ha pedido otro: vendrá la ronda
    if (cabe && !ajeno && valor(s, s.lugar, f, lambda) > 0.2 && !sig && !s.pedidoHoy.some((p) => p.lugar === s.lugar && E.L[s.lugar].aviso > 0)) return E.pedir(s);
  }
  let best = null;
  for (const l of Object.keys(E.L)) {
    if (!E.L[l].dentro || (r && E.zonaDe(s, l) === E.zonaDe(s, r))) continue;
    const llega = s.t + dr[l];
    if (llega + 6 > E.FIN) continue;
    if (!dentro && llega + 6 + salida(s, l) > E.FIN) continue;
    const v = valor(s, l, E.franja(llega), lambda) - dr[l] / 12;
    if (!best || v > best.v) best = { v, l };
  }
  if (best && best.l !== s.lugar && best.v > 0) { const mv = primerPaso(s, best.l); if (mv) return E.mover(s, mv.destino); }
  // esperar una franja entera solo si después aún se puede salir
  if (!dentro && E.L[s.lugar].dentro && (f + 1) * 6 + salida(s, s.lugar) > E.FIN) return volver(s);
  return E.esperar(s);
}

const BOTS = {
  escondido: (s) => E.acabarDia(s),
  azar,
  novato,
  veterano: (s, rnd, g) => veterano(s, rnd, g, 1.5),
  prudente: (s, rnd, g) => veterano(s, rnd, g, 3),
  osado: (s, rnd, g) => veterano(s, rnd, g, 0.5),
  "dentro-listo": (s, rnd, g) => veterano(s, rnd, g, 1.5, "listo"),
  "dentro-ciego": (s, rnd, g) => veterano(s, rnd, g, 1.5, "ciego"),
  vidente: (s, rnd, g) => veterano(s, rnd, g, 1.5),
  memorioso: (s, rnd, g) => veterano(s, rnd, g, 1.5),
};
const SABE = { vidente: "sabe", memorioso: "viejo" }; // los demás aprenden

// la llaga: cuándo se la hace el bot (de noche, en la ribera). Juegan como el veterano.
//   llaga-dN     la primera noche en la ribera desde el día N, pase lo que pase.
//   llaga-apurado  solo cuando va mal: desde el día 4, con el cuerpo a 2 o menos o con dos detenciones,
//                  y si la fiebre no le mata esa noche.
const sobrevive = (s) => s.cuerpo + P.cena[Math.min(2, s.pan)] + P.llaga.cuerpo - (s.trabajoHoy ? P.trabajo.cansancio : 0) > 0;
const LLAGA = {
  "llaga-d1": (s) => s.dia >= 1,
  "llaga-d3": (s) => s.dia >= 3,
  "llaga-d5": (s) => s.dia >= 5,
  "llaga-d7": (s) => s.dia >= 7,
  "llaga-apurado": (s) => s.dia >= 4 && (s.cuerpo <= 2 || s.detenciones >= 2) && sobrevive(s),
};
for (const k of Object.keys(LLAGA)) BOTS[k] = BOTS.veterano;
const SOLO = process.env.BOTS ? process.env.BOTS.split(",") : process.env.LLAGA ? ["veterano", ...Object.keys(LLAGA)] : null;

// ------------------------------------------------------------------ partidas
function jugar(modo, bot, sem) {
  let st = 12345 + sem * 7919;
  const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; };
  const s = E.nueva(modo, "bot", String(sem), { llaga: !!LLAGA[bot], tuyos: !!process.env.TUYOS, cadena: !!process.env.CADENA, mujer: process.env.SEXO === "mujer" });
  s._sabe = SABE[bot] || "aprende";
  s._veranos = []; // lo que le pasa en cada verano al que juega (para medir la cadena)
  const g = { clave: null, libres: 0 };
  let guard = 0;
  while (s.fase !== "fin" && guard++ < 20000) {
    if (s.fase === "relevo") {
      const pol = process.env.HEREDERO || "cuerpo";
      const cands = s.relevo.candidatos.map((id) => s.tuyos.find((t) => t.id === id));
      const elegido = cands.find((t) => t.id === pol) || cands.slice().sort((a, b) => b.cuerpo - a.cuerpo || a.detenciones - b.detenciones)[0];
      s._veranos.push({ anio: s.anio, quien: s.quien.id, el: E.esHombre(s), fin: s.relevo.tipo, dia: s.dia });
      E.elegirHeredero(s, elegido.id);
      continue;
    }
    if (s.fase === "invierno") {
      if (!s.invierno.relevo) s._veranos.push({ anio: s.anio, quien: s.quien.id, el: E.esHombre(s), fin: s.siega.yo, dia: s.dia });
      s._heredado = s.invierno.relevo ? { anio: s.anio, quien: s.quien.id, siega: s.siega.yo } : null;
      if (s._heredado) s._veranos.push({ anio: s.anio, quien: s.quien.id, el: E.esHombre(s), fin: "heredero:" + s.siega.yo, dia: s.dia });
      E.siguienteVerano(s);
      s._obs = {}; s._vistoK = {}; s._contadoN = 0; // las costumbres de la ronda son otras: vuelve a aprenderlas
      continue;
    }
    if (s.fase === "amanecer") { E.empezarJornada(s); continue; }
    if (s.fase === "resultado") { E.seguir(s); continue; }
    if (s.fase === "noche") { repartir(s); apuntarContado(s); if (LLAGA[bot] && E.puedeLlaga(s) && LLAGA[bot](s)) E.hacerLlaga(s); E.cenar(s, 2); continue; }
    if (s.t >= E.FIN) { E.comprobarNoche(s); continue; }
    const clave = s.dia * 100 + s.t;
    g.libres = g.clave === clave ? g.libres + 1 : 0; g.clave = clave; // en B, moverse dentro del barrio no gasta tiempo
    apuntarVisto(s);
    BOTS[bot](s, rnd, g);
    apuntarVisto(s);
    E.comprobarNoche(s);
  }
  if (s.fase !== "fin" && process.env.DEPURAR) console.error("atasco", modo, bot, sem, s.dia, s.t, s.lugar, s.fase, s.cronica.slice(-6).map((c) => c.texto));
  if (s.conCadena && s.final) {
    // si la cadena se acaba en los días sin jugar (muere o se va el que había de seguir), es del heredero
    const ult = s._veranos[s._veranos.length - 1];
    const enResto = ult && ult.anio === s.anio && ult.quien === s.quien.id && s.final.cadena && s.final.cadena.quien !== s.quien.nombre;
    if (enResto) s._veranos.push({ anio: s.anio, quien: s.final.cadena.quien.toLowerCase(), fin: "heredero:" + s.final.tipo, dia: s.final.dia });
    else if (!(ult && ult.anio === s.anio && ult.quien === s.quien.id && s.cadena.vidas.length && s.cadena.vidas[s.cadena.vidas.length - 1].anio === s.anio && ["hambre", "muerto", "desterrado", "galeras"].includes(ult.fin)))
      s._veranos.push({ anio: s.anio, quien: s.quien.id, el: E.esHombre(s), fin: s.final.tipo, dia: s.final.dia });
  }
  return s;
}

// ------------------------------------------------------------------ la cadena (CADENA=1)
const CAD = {}; // bot → agregados
function sumarCadena(bot, s) {
  const C = (CAD[bot] = CAD[bot] || { n: 0, hasta: {}, completa: 0, sigue: 0, vidas: 0, anios: {}, tuyos: {}, juega: {}, heredero: {} });
  C.n++;
  const fc = s.final.cadena || { hasta: s.anio };
  C.hasta[fc.hasta] = (C.hasta[fc.hasta] || 0) + 1;
  if (["siega", "espiga", "aguanta"].includes(s.final.tipo) && fc.hasta === R.VERANOS[R.VERANOS.length - 1].anio) C.completa++;
  if (/^Sigue /.test(s.cadena.anales.slice(-1)[0].texto)) C.sigue++;
  C.vidas += s.cadena.vidas.length + (["siega", "espiga", "aguanta"].includes(s.final.tipo) ? 1 : 0);
  for (const v of s._veranos) {
    const A = (C.anios[v.anio] = C.anios[v.anio] || { fin: {}, quien: {}, n: 0 });
    const k = `${v.quien}:${v.fin}`;
    A.fin[k] = (A.fin[k] || 0) + 1;
  }
  // cuántas cadenas juegan cada verano y con quién
  for (const y of new Set(s._veranos.map((v) => v.anio))) {
    const A = C.anios[y];
    A.n++;
    const q = s._veranos.find((v) => v.anio === y).quien;
    A.quien[q] = (A.quien[q] || 0) + 1;
  }
  for (const h of s.heredados || []) C.heredero[`${h.id}@${h.anio}`] = (C.heredero[`${h.id}@${h.anio}`] || 0) + 1;
  // qué fue de los tuyos (los que no heredaste)
  for (const tu of s.tuyos) { const k = `${tu.nombre}:${tu.estado}${tu.fin ? "@" + tu.fin.anio : ""}`; C.tuyos[k] = (C.tuyos[k] || 0) + 1; }
}
function informeCadena(bot) {
  const C = CAD[bot];
  if (!C) return;
  const ys = R.VERANOS.map((v) => v.anio);
  console.log(`         CADENA (${C.n}): tu gente acaba en ${ys.map((y) => `${y} ${pct(C.hasta[y], C.n).trim()}`).join(" · ")} · llega a la siega de ${ys[ys.length - 1]} el que juega ${pct(C.completa, C.n).trim()} (+${pct(C.sigue, C.n).trim()} muere acompañado ese verano) · vidas jugadas por cadena ${(C.vidas / C.n).toFixed(2)}`);
  for (const y of ys) {
    const A = C.anios[y];
    if (!A) continue;
    const quien = Object.entries(A.quien).map(([q, n]) => `${q} ${pct(n, A.n).trim()}`).join(", ");
    const fins = Object.entries(A.fin).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${pct(n, A.n).trim()}`).join(" · ");
    console.log(`         ${y}: lo juegan ${pct(A.n, C.n).trim()} de las cadenas (${quien}) → ${fins}`);
  }
  if (Object.keys(C.heredero).length) console.log(`         herederos: ${Object.entries(C.heredero).sort().map(([k, n]) => `${k} ${pct(n, C.n).trim()}`).join(" · ")}`);
  console.log(`         los tuyos al final: ${Object.entries(C.tuyos).sort().map(([k, n]) => `${k} ${pct(n, C.n).trim()}`).join(" · ")}`);
}

const pct = (x, n) => `${Math.round((100 * (x || 0)) / n)}`.padStart(3) + " %";
console.log(`${N} partidas por bot y prueba · versión ${R.version}${Object.keys(pal).length ? " · palancas " + JSON.stringify(pal) : ""}\n`);
console.log("prueba bot             | siega  sin siega | hambre  destierro  azotes | día   cuerpo* | pan/día  moverse  pasos o cruces/día  ronda al llegar/día | llaga");
// por defecto solo la prueba A (el núcleo desde el 30 de octubre de 2026); PRUEBAS=A,B para las dos
const llega = (s) => s.final.tipo === "siega" || s.final.tipo === "aguanta";
const finales = {}; // bot → semilla → partida (para comparar por parejas con la misma semilla)
for (const modo of (process.env.PRUEBAS || "A").split(",")) {
  for (const bot of SOLO || Object.keys(BOTS)) {
    const fin = {}; let dias = 0, cuerpo = 0, llegan = 0, llagados = 0, T = null;
    finales[bot] = [];
    for (let i = 1; i <= N; i++) {
      const s = jugar(modo, bot, i);
      if (s.conCadena) sumarCadena(bot, s);
      finales[bot][i] = { tipo: s.final.tipo, llaga: s.llaga || 0, dia: s.final.dia };
      if (process.env.CIERRA) { const c = s.circuito[5]; const x = ((fin.cierra = fin.cierra || {})[c] = fin.cierra[c] || { n: 0, llega: 0 }); x.n++; if (llega(s)) x.llega++; }
      fin[s.final.tipo] = (fin[s.final.tipo] || 0) + 1;
      dias += s.final.dia;
      if (s.llaga) llagados++;
      if (process.env.DESGLOSE) for (const c of s.cronica) if (c.tipo === "detenido") { const m = c.motivo.startsWith("pidiendo") ? "pidiendo" : c.motivo; (fin.det = fin.det || {})[m] = (fin.det[m] || 0) + 1; }
      if (llega(s)) { cuerpo += s.cuerpo; llegan++; }
      if (s.tuyos) {
        const Tt = (fin.tuyos = fin.tuyos || { vivos: {}, fin: {}, malsina: 0, contado: 0, dado: 0, sabia: 0, contadoAlg: 0 });
        for (const tu of s.tuyos) {
          const k = `${tu.nombre}:${tu.estado}`; Tt.fin[k] = (Tt.fin[k] || 0) + 1;
          if (tu.estado === "malsino") Tt.malsina++;
          Tt.dado += tu.recibido;
        }
        Tt.contado += (s.contado || []).length;
        for (const c of s.cronica) if (c.tipo === "detenido" || c.tipo === "echado") { const k = `${c.dia}|${E.franja(c.t)}`; if ((s.rondasContado || {})[k]) Tt.contadoAlg++; }
      }
      const t = E.resumenDias(s);
      if (!T) T = t; else Object.keys(t).forEach((k) => (T[k] += t[k]));
    }
    const ratos = T.mover + T.pedir + T.trabajar + T.esperar + T.perdido || 1;
    const mov = modo === "A" ? T.pasos : T.cruces;
    console.log(`${modo}      ${bot.padEnd(15)} | ${pct(fin.siega, N)}  ${pct(fin.aguanta, N)}     | ${pct(fin.hambre, N)}  ${pct(fin.desterrado, N)}      ${pct(fin.muerto, N)} | ${(dias / N).toFixed(1).padStart(4)}  ${llegan ? (cuerpo / llegan).toFixed(1) : " — "}     | ${((T.panPedido + T.panTrabajo) / dias).toFixed(2).padStart(5)}    ${pct(T.mover, ratos)}   ${(mov / dias).toFixed(1).padStart(4)}                ${(T.encuentros / dias).toFixed(2)}                | ${pct(llagados, N)}`);
    if (fin.cierra) console.log("         llega según la puerta que cierra la ronda: " + Object.entries(fin.cierra).map(([k, x]) => `${E.L[k].corto} ${pct(x.llega, x.n).trim()} (${x.n})`).join(" · "));
    if (fin.tuyos) {
      const Tt = fin.tuyos, orden = Object.entries(Tt.fin).sort();
      console.log(`         los tuyos al final: ${orden.map(([k, v]) => `${k} ${pct(v, N).trim()}`).join(" · ")}`);
      console.log(`         por partida: pan dado ${(Tt.dado / N).toFixed(1)} · cosas contadas ${(Tt.contado / N).toFixed(0)} · malsinadas ${(Tt.malsina / N).toFixed(2)} · paradas por lo que contó un malsín ${(Tt.contadoAlg / N).toFixed(2)}`);
    }
    if (fin.det) console.log("         detenciones por partida: " + Object.entries(fin.det).map(([k, v]) => `${k} ${(v / N).toFixed(2)}`).join(" · "));
    informeCadena(bot);
  }
  console.log("");
  // por parejas: en las semillas en que el bot se hizo la llaga, qué le pasó y qué le pasó al veterano (que no se la hace)
  if (finales.veterano && Object.keys(LLAGA).some((b) => finales[b])) {
    console.log("Por parejas (misma semilla), solo las partidas en que el bot se hizo la llaga:");
    console.log("bot             | partidas | llega con llaga | el veterano llega | el veterano siega");
    for (const b of Object.keys(LLAGA)) {
      if (!finales[b]) continue;
      let n = 0, a = 0, v = 0, vs = 0;
      for (let i = 1; i <= N; i++) {
        const x = finales[b][i];
        if (!x.llaga) continue;
        n++;
        if (x.tipo === "siega" || x.tipo === "aguanta") a++;
        const y = finales.veterano[i];
        if (y.tipo === "siega" || y.tipo === "aguanta") v++;
        if (y.tipo === "siega") vs++;
      }
      console.log(`${b.padEnd(15)} | ${String(n).padStart(8)} | ${n ? pct(a, n) : "  —  "}           | ${n ? pct(v, n) : "  —  "}             | ${n ? pct(vs, n) : "  —  "}`);
    }
    console.log("");
  }
}
console.log("* cuerpo medio de los que llegan a la siega (con siega o sin ella).");
