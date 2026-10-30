// Bots para el juguete: juegan muchas partidas con el motor real (sin navegador) y sacan porcentajes.
// No son personas: sirven para ver si una regla rompe algo (si esconderse gana, si nadie llega), no para fijar la dificultad.
//
// Uso (desde la raíz del repositorio):
//   node herramientas/bot.js [N] [palancas-json]
//   PRUEBAS=A,B node herramientas/bot.js 1000      (también la prueba B)
//   RUTINA=1 node herramientas/bot.js 1000         (el veterano y el prudente no se dan cuenta de que la ronda aprende)
//   LLAGA=1 node herramientas/bot.js 2000          (el veterano con distintas reglas para hacerse la llaga, y comparación por parejas)
//   DESGLOSE=1 ...                                 (detenciones por partida según el motivo)
//   node herramientas/bot.js 1000 '{"PARAMS.pararAlLlegar":{"desconocido":0.3,"conocido":0.4}}'
//
// Bots:
//   escondido  se queda en la ribera todos los días.
//   azar       pulsa cualquier cosa que se pueda pulsar.
//   novato     no conoce la ciudad: entra, va a sitios al azar, pide donde hay gente si no ve la ronda, no repite sitio
//              el mismo día y vuelve a la ribera antes de que cierren, por el camino más corto.
//   veterano   conoce los horarios de la gente y el recorrido de costumbre de la ronda (lo que aprende un jugador en
//              unas partidas). Elige adónde ir por lo que espera sacar menos el riesgo. Arriesga más. No repite sitio y
//              hora cuando ve que la ronda se lo ha aprendido.
//              Sale por la puerta en la que espera menos riesgo (j0.8: hay dos) y no empieza nada que le impida salir
//              antes de que cierren (hasta la j0.7.2 a veces se quedaba dentro sin querer, 1 de cada 9 noches).
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
  const circ = (R.CALENDARIO[s.dia - 1].tipo === "corpus" ? R.RONDA.circuitoCorpus : R.RONDA.circuito)[f];
  let pr = (R.RONDA.desvio * E.lugaresZona(s, E.zonaDe(s, gate)).filter((x) => E.L[x].dentro).length) / DENTRO_N;
  if (circ && E.zonaDe(s, circ) === E.zonaDe(s, gate)) pr += 1 - R.RONDA.desvio;
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
  const LT = s.dia >= P.escasezDesde ? P.limosnaEscasez : P.limosna;
  const sube = s.llaga ? P.llaga.limosna : 0; // con la llaga, la tirada sube
  const media = (da) => (da < 2 ? 0 : [1, 2, 3, 4, 5, 6].reduce((a, t) => a + LT[da >= 3 ? 3 : 2][Math.min(6, t + sube) - 1], 0) / 6);
  const pp = E.L[l].pobres;
  const ev = (1 - pp) * media(g) + pp * media(g - 1);
  const circ = (R.CALENDARIO[s.dia - 1].tipo === "corpus" ? R.RONDA.circuitoCorpus : R.RONDA.circuito)[f];
  let pr = R.RONDA.desvio * E.lugaresZona(s, E.zonaDe(s, l)).filter((x) => E.L[x].dentro).length / 8;
  if (circ && E.zonaDe(s, circ) === E.zonaDe(s, l)) pr += 1 - R.RONDA.desvio;
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
    const sig = s.t % 6 !== 0 && R.RONDA.circuito[f + 1] && E.zonaDe(s, R.RONDA.circuito[f + 1]) === E.zonaDe(s, s.lugar);
    const cabe = dentro || !E.L[s.lugar].dentro || s.t + 6 + salida(s, s.lugar) <= E.FIN; // pedir y aún salir antes de que cierren
    if (cabe && valor(s, s.lugar, f, lambda) > 0.2 && !sig && !s.pedidoHoy.some((p) => p.lugar === s.lugar && E.L[s.lugar].aviso > 0)) return E.pedir(s);
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
  "dentro-listo": (s, rnd, g) => veterano(s, rnd, g, 1.5, "listo"),
  "dentro-ciego": (s, rnd, g) => veterano(s, rnd, g, 1.5, "ciego"),
};

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
const SOLO = process.env.LLAGA ? ["veterano", ...Object.keys(LLAGA)] : null;

// ------------------------------------------------------------------ partidas
function jugar(modo, bot, sem) {
  let st = 12345 + sem * 7919;
  const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; };
  const s = E.nueva(modo, "bot", String(sem), { llaga: !!LLAGA[bot] });
  const g = { clave: null, libres: 0 };
  let guard = 0;
  while (s.fase !== "fin" && guard++ < 5000) {
    if (s.fase === "amanecer") { E.empezarJornada(s); continue; }
    if (s.fase === "resultado") { E.seguir(s); continue; }
    if (s.fase === "noche") { if (LLAGA[bot] && E.puedeLlaga(s) && LLAGA[bot](s)) E.hacerLlaga(s); E.cenar(s, 2); continue; }
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
      finales[bot][i] = { tipo: s.final.tipo, llaga: s.llaga || 0, dia: s.final.dia };
      fin[s.final.tipo] = (fin[s.final.tipo] || 0) + 1;
      dias += s.final.dia;
      if (s.llaga) llagados++;
      if (process.env.DESGLOSE) for (const c of s.cronica) if (c.tipo === "detenido") { const m = c.motivo.startsWith("pidiendo") ? "pidiendo" : c.motivo; (fin.det = fin.det || {})[m] = (fin.det[m] || 0) + 1; }
      if (llega(s)) { cuerpo += s.cuerpo; llegan++; }
      const t = E.resumenDias(s);
      if (!T) T = t; else Object.keys(t).forEach((k) => (T[k] += t[k]));
    }
    const ratos = T.mover + T.pedir + T.trabajar + T.esperar + T.perdido || 1;
    const mov = modo === "A" ? T.pasos : T.cruces;
    console.log(`${modo}      ${bot.padEnd(15)} | ${pct(fin.siega, N)}  ${pct(fin.aguanta, N)}     | ${pct(fin.hambre, N)}  ${pct(fin.desterrado, N)}      ${pct(fin.muerto, N)} | ${(dias / N).toFixed(1).padStart(4)}  ${llegan ? (cuerpo / llegan).toFixed(1) : " — "}     | ${((T.panPedido + T.panTrabajo) / dias).toFixed(2).padStart(5)}    ${pct(T.mover, ratos)}   ${(mov / dias).toFixed(1).padStart(4)}                ${(T.encuentros / dias).toFixed(2)}                | ${pct(llagados, N)}`);
    if (fin.det) console.log("         detenciones por partida: " + Object.entries(fin.det).map(([k, v]) => `${k} ${(v / N).toFixed(2)}`).join(" · "));
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
