// El aplicado: un bot que juega lo mejor que sabe usando solo lo que sabe un jugador.
//
// Para qué sirve: los bots de bot.js (novato, veterano…) son el suelo de la dificultad. Este busca el techo: qué saca
// una persona aplicada, que conoce las reglas (como Sergio) y usa todo lo que el juego le enseña, pero nada más.
//
// Lo que sabe (y nada más):
//   - lo que ve en su sitio: la gente, los otros pobres, la ronda, si uno de los tuyos pide ahí, si quedan quejas de otro;
//   - Recuerdos: dónde y cuándo ha visto a la ronda, dónde ha pedido él, lo que le han contado los tuyos;
//   - el esqueleto de la ronda (por la mañana, mercado o misa; a sexta come; a nona y a vísperas, donde hay gente; al
//     anochecer cierra una puerta; el Corpus acompaña la procesión) y las reglas y cifras de rules.js;
//   - de los tuyos, lo que le dicen de noche (qué vieron, si piden, cómo se les ve) y con qué amanecieron.
// Lo que no lee nunca para decidir: la semilla, las costumbres de la ronda de este verano (s.circuito), dónde está la
// ronda si no la ve (s.rondas), por qué ha ido (s.rondasPorque), la gente de los sitios donde no está, ni dónde andan
// los tuyos de día.
//
// Cómo decide: búsqueda hacia delante sobre el motor real. En cada decisión
//   1. saca varios «mundos compatibles»: copias de la partida con otra semilla (otro azar de aquí en adelante), unas
//      costumbres de la ronda sacadas de lo que cree (regla de Bayes sobre lo visto y lo contado), la ronda de esta
//      franja colocada donde podría estar según lo que ve, y los tuyos viviendo su día de nuevo desde el amanecer;
//   2. en cada mundo prueba cada jugada posible y deja que el resto del día lo juegue «el oficio» (una heurística a
//      mano, la misma para todas las jugadas);
//   3. valora cómo amanece al día siguiente con una tabla de valor (probabilidad de acabar bien desde ese estado),
//      calculada antes hacia atrás, del día 10 al 2, con el mismo oficio;
//   4. elige la jugada con mejor media. Las jugadas flojas se descartan pronto para gastar los mundos en las buenas.
//
// Uso (desde la raíz del repositorio):
//   node herramientas/aplicado.js [N]                 un verano de 1545, N partidas (por defecto 200)
//   TUYOS=1 … · LLAGA=1 … · CADENA=1 [SEXO=mujer] …   las mismas variantes que bot.js
//   OFICIO=1 …                                        solo la heurística, sin búsqueda (para comparar)
//   AGUANTA=0.9                                       cuánto vale llegar a la siega sin hoz (con hoz vale 1)
//   MUNDOS=8                                          mundos por ronda de la búsqueda (más = mejor y más lento)
//   DAR=nadie                                         no se plantea dar pan a los tuyos (por defecto lo valora cada noche)
//   PROCESOS=2                                        reparte las partidas entre varios procesos
//   DESDE=1                                           primera semilla (las semillas son 1…N, como en bot.js)
//   SEMILLA=37 CRONICA=1 …                            una sola partida, con su crónica y lo que pensó en cada jugada
//   JSON=fichero.json                                 guarda los agregados (para el informe)
// Para medir qué sostiene el resultado (quitan una pieza al oficio; pensadas para usar con OFICIO=1):
//   CIEGO=1         no aprende las costumbres de la ronda: juega todo el verano con el esqueleto y nada más
//   VIDENTE=1       las sabe desde el primer día (lee lo que el jugador no ve: solo para medir cuánto vale saber)
//   SIN_MIEDO=1     no cuenta con dónde puede estar la ronda: solo la esquiva cuando la ve
//   ALINEA=nunca|siempre   pide siempre nada más llegar, o siempre esperando a que empiece la franja
//   VETA=sanpablo,escuelas  no pide en esos sitios
//   OIDOS=0         no hace caso de lo que le cuentan los tuyos
const path = require("path");
const fs = require("fs");
const RAIZ = path.resolve(__dirname, "..");
global.window = {};
require(path.join(RAIZ, "rules.js"));
// palancas en PAL (un JSON, como el tercer argumento de bot.js): PAL='{"PARAMS.hurto.escalera":"dos"}'
if (process.env.PAL) for (const [k, v] of Object.entries(JSON.parse(process.env.PAL))) { const ks = k.split("."); let x = window.RULES; while (ks.length > 1) x = x[ks.shift()]; x[ks[0]] = v; }
require(path.join(RAIZ, "engine.js"));
const R = window.RULES, E = window.ENGINE, P = R.PARAMS;
// prototipo de hurto (rama claude/hurto-prototipo): HURTO=nunca|apuro|grave|hambre|siempre activa las reglas de hurto y
// dice cuándo hurta el oficio (solo con OFICIO=1: la búsqueda no sabe valorar el hurto). SIN_TABLA=1 se salta la tabla
// de valor (el oficio solo la usa para decidir si cena con un pedazo), para medir muchas variantes deprisa.
const HC = require("./hurto-comun.js")(R, E);
const LL = P.llaga, AP = R.RONDA.aprende, PERS = R.RONDA.persigue, DESVIO = R.RONDA.desvio;
const FIN = E.FIN, FR = R.RATOS, NF = R.FRANJAS.length, PASO = R.MODOS.A.paso;

const CFG = {
  tuyos: !!process.env.TUYOS || !!process.env.CADENA, llaga: !!process.env.LLAGA, cadena: !!process.env.CADENA,
  mujer: process.env.SEXO === "mujer",
  soloOficio: !!process.env.OFICIO,
  uAguanta: process.env.AGUANTA != null ? +process.env.AGUANTA : 0.9,
  mundos: +process.env.MUNDOS || 8,
  dar: process.env.DAR || "busca",
};

// ------------------------------------------------------------------ la ciudad, de memoria
const mas = (o, k, n) => { o[k] = (o[k] || 0) + (n == null ? 1 : n); };
const LUG = R.LUGARES.map((l) => l.id);
const DENTRO = LUG.filter((l) => E.L[l].dentro);
const PUERTAS = E.PUERTAS;
const AFUERA = Object.fromEntries(PUERTAS.map((g) => [g, E.VECINOS[g].find((v) => !E.L[v].dentro)]));
const D = E.DIST; // pasos entre sitios
const SAL = Object.fromEntries(DENTRO.map((l) => [l, Math.min(...PUERTAS.map((g) => D[l][g] + 1))])); // pasos hasta estar fuera
const IGLESIAS = ["catedral", "sanmartin", "sanesteban"];
const CLAVE = ["manana", "manana", null, "nona", "visperas", "cierra"];
const COST = R.RONDA.costumbres;
const VERANO_DE = Object.fromEntries(R.VERANOS.map((v) => [v.anio, v]));
const ULTIMO = R.VERANOS.length - 1;

function azar(txt) {
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// lo que se espera sacar pidiendo: la media de la tabla de limosna según la gente que da
const MEDIA = {};
function media(da, esc, ll) {
  if (da < 2) return 0;
  const k = (esc ? 100 : 0) + (ll ? 10 : 0) + (da >= 3 ? 3 : 2);
  if (MEDIA[k] != null) return MEDIA[k];
  const T = (esc ? P.limosnaEscasez : P.limosna)[da >= 3 ? 3 : 2];
  let a = 0;
  for (let t = 1; t <= 6; t++) a += T[Math.min(6, t + (ll ? LL.limosna : 0)) - 1];
  return (MEDIA[k] = a / 6);
}
function genteBase(l, tipo, f) {
  let g = E.L[l].gente[f];
  const m = R.DIAS_SENALADOS[tipo];
  if (m && m[l] && m[l][f] != null) g = m[l][f];
  return g;
}
// por tipo de día: en cada franja y sitio, lo que se espera sacar sin haberlo visto (la gente varía y puede haber pobres)
const GAN = {};
function ganancias(tipo, esc, ll) {
  const k = `${tipo}|${esc ? 1 : 0}|${ll ? 1 : 0}`;
  if (GAN[k]) return GAN[k];
  const out = [];
  for (let f = 0; f < NF; f++) {
    out[f] = {};
    for (const l of DENTRO) {
      const b = genteBase(l, tipo, f);
      const pp = Math.min(1, E.L[l].pobres + (tipo !== "laborable" && IGLESIAS.includes(l) ? 0.2 : 0));
      let g = 0, mucha = 0;
      for (const [dg, pg] of [[-1, 0.15], [0, 0.75], [1, 0.1]]) {
        const x = Math.max(1, Math.min(3, b + dg));
        g += pg * ((1 - pp) * media(x, esc, ll) + pp * media(x <= 1 ? 1 : Math.max(1, x - 1), esc, ll));
        if (x >= 3) mucha += pg * (1 - pp);
      }
      out[f][l] = { g, mucha };
    }
  }
  return (GAN[k] = out);
}

// ------------------------------------------------------------------ lo que sabe de la ronda
// Mis quejas: las que he provocado yo pidiendo hoy, tal como estarán al acabar la franja f (antes de que bajen).
// La ronda de la franja f+1 va donde más haya (si empatan, la más reciente).
function misQuejas(s, f) {
  const v = {}, fp = {}, tt = {};
  const ph = s.pedidoHoy;
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i];
    if (p.f > f) break;
    const a = E.L[p.lugar].aviso;
    if (!a) continue;
    if (v[p.lugar] != null) v[p.lugar] = Math.max(0, v[p.lugar] - (p.f - fp[p.lugar]));
    v[p.lugar] = (v[p.lugar] || 0) + a; fp[p.lugar] = p.f; tt[p.lugar] = i;
  }
  let n = 0, donde = null, cu = -1;
  for (const l in v) {
    v[l] = Math.max(0, v[l] - (f - fp[l]));
    if (v[l] > n || (v[l] === n && n > 0 && tt[l] > cu)) { n = v[l]; donde = l; cu = tt[l]; }
  }
  return { donde, n, v };
}
// dónde me ha aprendido la ronda a cada hora (lo veo en Recuerdos: «dónde has pedido»)
function misCostumbres(s) {
  const out = [null, null, null, null, null, null];
  const h = s.habitos;
  if (!h) return out;
  for (const f in h) {
    let n = 0;
    for (const l in h[f]) {
      // los días «-1» son los que un malsín le ha contado al alguacil: no lo sé hasta que me entero (s._ms)
      let k = h[f][l].length;
      if (!s._ms) for (const x of h[f][l]) if (x === -1) k--;
      if (k >= AP.minDias && k > n) { n = k; out[f] = l; }
    }
  }
  return out;
}

// Lo que cree de las costumbres de este verano: para cada hueco (mañana, nona, vísperas, puerta que cierra), una
// probabilidad por sitio. Sale de lo que ha visto y de lo que le han contado, con la regla de Bayes.
function nuevoSaber(s) {
  const B = { obs: { manana: [], nona: [], visperas: [], cierra: [] }, vistasN: 0, contadoN: 0, apuntado: {}, hoy: [], dia: 0, previo: {} };
  // en la cadena, la ronda se inclina hacia donde me vio pedir el verano pasado y la puerta por la que pasaba
  const h = s.huella, re = (P.cadena || {}).reaccion || 0;
  for (const k of Object.keys(COST)) {
    B.previo[k] = {};
    const fs_ = k === "manana" ? [0, 1] : k === "nona" ? [3] : k === "visperas" ? [4] : [];
    for (const l of COST[k]) B.previo[k][l] = 1 + (h ? re * (k === "cierra" ? (h.puertas[l] || 0) : fs_.reduce((a, f) => a + ((h.pide[f] || {})[l] || 0), 0)) : 0);
  }
  if (process.env.VIDENTE) { const c = s.circuito, real = { manana: c[0], nona: c[3], visperas: c[4], cierra: c[5] }; for (const k in real) for (const l of COST[k]) B.previo[k][l] = l === real[k] ? 1 : 1e-9; }
  creer(B);
  return B;
}
function creer(B) {
  B.post = {};
  for (const k of Object.keys(COST)) {
    const w = {};
    let tot = 0;
    for (const c of COST[k]) {
      let p = B.previo[k][c];
      for (const o of B.obs[k]) {
        // probabilidad de que la ronda esté donde miró, si su costumbre a esa hora es c
        let pr = o.pc * (o.l === o.T ? 1 : 0) + (1 - o.pc) * (o.pa * (o.l === o.A ? 1 : 0) + (1 - o.pa) * (DESVIO / DENTRO.length + (1 - DESVIO) * (o.l === c ? 1 : 0)));
        if (o.oidas) pr = P.tuyos.oidasCierto * pr + (1 - P.tuyos.oidasCierto) * (1 - pr) / (DENTRO.length - 1);
        p *= o.vio ? pr : 1 - pr;
      }
      w[c] = p; tot += p;
    }
    for (const c of COST[k]) w[c] = tot > 0 ? w[c] / tot : 1 / COST[k].length;
    B.post[k] = w;
  }
  // probabilidad de que la ronda esté en un sitio a cada franja por costumbre o por desvío (sin quejas ni lo aprendido)
  const tabla = (corpus) => {
    const t = [];
    for (let f = 0; f < NF; f++) {
      const k = CLAVE[f];
      if (corpus && f < 5) { const c = R.RONDA.circuitoCorpus[f]; t[f] = {}; for (const l of DENTRO) t[f][l] = DESVIO / DENTRO.length + (1 - DESVIO) * (l === c ? 1 : 0); continue; }
      if (!k) { t[f] = null; continue; }
      t[f] = {};
      for (const l of DENTRO) t[f][l] = DESVIO / DENTRO.length + (1 - DESVIO) * (B.post[k][l] || 0);
    }
    return t;
  };
  B.rho = tabla(false); B.rhoCorpus = tabla(true);
}
// Mirar: apunta lo que ve en su sitio (la ronda está o no; la gente; los pobres) y lo que hay nuevo en Recuerdos.
function mirar(s, B) {
  if (B.dia !== s.dia || B.anio !== s.anio) { B.dia = s.dia; B.anio = s.anio; B.hoy = []; }
  let cambio = false;
  const apunta = (d, f, l, vio, extra) => {
    const k = CLAVE[f];
    if (!k || (E.dia(s, d).tipo === "corpus" && f < 5) || process.env.CIEGO || process.env.VIDENTE) return;
    B.obs[k].push(Object.assign({ l, vio, pc: 0, T: null, pa: 0, A: null }, extra));
    cambio = true;
  };
  if (s.fase === "dia" && s.t < FIN) {
    const f = E.franja(s.t), kk = `${s.dia}|${f}|${s.lugar}`;
    const r = E.rondaEnTuZona(s);
    if (r) { s._rv = s.dia * 10 + f; s._rl = s.lugar; }
    if (!B.apuntado[kk]) {
      B.apuntado[kk] = 1;
      if (E.L[s.lugar].dentro) {
        // por qué podría estar aquí aparte de su costumbre: mis quejas de la franja anterior o lo que me ha aprendido
        const q = f > 0 ? misQuejas(s, f - 1) : { n: 0 };
        const A = misCostumbres(s)[f];
        apunta(s.dia, f, s.lugar, !!r, { pc: q.n > 0 ? PERS[Math.min(3, q.n)] : 0, T: q.donde, pa: A ? AP.prob : 0, A });
        const e = E.estado(s, s.lugar, s.dia, f);
        const tuyo = s.conTuyos && E.tuyosEn(s, s.lugar).some((x) => x.pide);
        B.hoy.push({ f, l: s.lugar, gente: e.gente, pobres: e.pobres, tuyo, ronda: !!r });
      }
    }
  }
  // si uno de los tuyos me ha vendido, me entero esa noche en la ribera («dicen que lo vieron hablando con el alguacil»)
  if (s.fase === "noche" && (s.nocheTuyos || []).some((x) => !x.presente && x.lineas.some((l) => l.includes("alguacil")))) s._ms = true;
  // lo que me han contado los tuyos (está en Recuerdos)
  const c = s.contado || [];
  for (let i = B.contadoN; i < c.length; i++) if (process.env.OIDOS !== "0" && COST[CLAVE[c[i].f] || "x"]) apunta(c[i].dia, c[i].f, c[i].lugar, !!c[i].ronda, { oidas: !!c[i].oidas });
  B.contadoN = c.length;
  if (cambio) creer(B);
}

// ------------------------------------------------------------------ el oficio (la heurística de base)
// Una sola regla: de todo lo que puede hacer (pedir aquí ahora, esperar a que empiece la franja, ir a otro sitio a pedir),
// elige lo que más pan espera sacar por el tiempo que cuesta, menos lo que arriesga. Y sale antes de que cierren.
const KAPPA = 0.35, WT = 0.03, UMBRAL = 0.1;
const VETA = (process.env.VETA || "").split(",");
const valorPan = (pan) => (pan < 2 ? 1 : pan < 4 ? 0.55 : 0);
const galerasHoy = (s) => !!s.conCadena && E.esHombre(s) && !!(VERANO_DE[s.anio] || {}).galeras;
function costeDetencion(s) {
  if (galerasHoy(s)) return 30;
  return s.detenciones >= 2 ? 30 : s.detenciones === 1 ? 9 : 6;
}
// lo que cuesta que te pare la ronda al llegar, por la probabilidad de que lo haga si está
function costeParada(s) {
  if (s.buscado) return P.hurto.pararBuscado * 30; // le buscan por ladrón: que le paren es que le prendan
  if (s.llaga && (!LL.protege || (s.llagaPasadas || 0) < LL.protege)) return 0.05;
  const ras = !!s.conCadena, conoce = s.conocido || (ras && !!s.azotado);
  if (ras && !E.esHombre(s)) return (conoce ? P.pararAlLlegar.conocido : P.pararAlLlegar.desconocido) * (conoce ? 2.5 : 1);
  if (conoce) return P.pararAlLlegar.conocido * costeDetencion(s);
  if (ras && !s.llaga && s.cuerpo >= (P.cadena.obrasForzadas || 99)) return P.pararAlLlegar.desconocido * 4;
  return P.pararAlLlegar.desconocido * 1.5;
}
function contexto(s, K) {
  const f = E.franja(s.t), d = s.dia, tipo = E.dia(s, d).tipo;
  const cx = { s, d, f, t: s.t, aqui: s.lugar, tipo, G: ganancias(tipo, E.escasez(s, d), !!s.llaga), rho0: tipo === "corpus" ? K.rhoCorpus : K.rho,
    av: {}, hab: misCostumbres(s), vista: null, cpar: costeParada(s), cdet: costeDetencion(s) };
  const r = E.rondaEnTuZona(s);
  cx.rondaAqui = !!r;
  if (r) { cx.vista = s.lugar; s._rv = d * 10 + f; s._rl = s.lugar; } else if (s._rv === d * 10 + f) cx.vista = s._rl;
  return cx;
}
const quejas = (cx, f) => (f < 0 ? { n: 0, v: {} } : cx.av[f] || (cx.av[f] = misQuejas(cx.s, f)));
// probabilidad de que la ronda esté en un sitio a una franja, con lo que sé
function prRonda(cx, l, f2) {
  if (f2 >= NF || !E.L[l].dentro) return 0;
  if (f2 === cx.f) {
    if (cx.vista) return l === cx.vista ? 1 : 0; // la he visto en esta franja: sé dónde está
    if (l === cx.aqui) return 0;
  }
  if (process.env.SIN_MIEDO) return 0;
  const q = quejas(cx, f2 - 1);
  const pc = q.n > 0 ? PERS[Math.min(3, q.n)] : 0;
  const c0 = cx.rho0[f2];
  let resto = 0;
  if (c0) { const A = cx.hab[f2]; resto = A ? AP.prob * (l === A ? 1 : 0) + (1 - AP.prob) * c0[l] : c0[l]; }
  return pc * (l === q.donde ? 1 : 0) + (1 - pc) * resto;
}
// riesgo de que la ronda llegue a un sitio la franja siguiente mientras pido en él (si viene por la queja que acabo
// de provocar, llega cuando ya termino y no me pilla)
function prLlegaPidiendo(cx, l, fb) {
  const f2 = fb + 1;
  if (f2 >= NF) return 0;
  const q = quejas(cx, fb);
  const a = E.L[l].aviso, antes = q.v[l] || 0, mio = antes + a;
  let n = q.n, T = q.donde;
  if (a && mio >= n) { n = mio; T = l; }
  const pc = n > 0 ? PERS[Math.min(3, n)] : 0;
  const c0 = cx.rho0[f2];
  let resto = 0;
  if (c0) { const A = cx.hab[f2]; resto = A ? AP.prob * (l === A ? 1 : 0) + (1 - AP.prob) * c0[l] : c0[l]; }
  return (T === l && antes > 0 ? pc : 0) + (1 - pc) * resto;
}
// caminos desde donde estoy, pesando el tiempo y el riesgo de toparme con la ronda en cada sitio por el que paso
function caminos(cx) {
  const coste = {}, llega = {}, primero = {}, hecho = {}, riesgo = {};
  for (const l of LUG) coste[l] = Infinity;
  coste[cx.aqui] = 0; llega[cx.aqui] = cx.t; riesgo[cx.aqui] = 0;
  for (;;) {
    let u = null;
    for (const l of LUG) if (!hecho[l] && coste[l] < Infinity && (u === null || coste[l] < coste[u])) u = l;
    if (u === null) break;
    hecho[u] = 1;
    const tau = llega[u] + PASO;
    if (tau > FIN) continue;
    for (const v of E.VECINOS[u]) {
      if (hecho[v]) continue;
      const r = tau < FIN ? prRonda(cx, v, E.franja(tau)) : 0;
      const c = coste[u] + PASO * WT + r * cx.cpar;
      if (c < coste[v]) { coste[v] = c; llega[v] = tau; primero[v] = u === cx.aqui ? v : primero[u]; riesgo[v] = riesgo[u] + r * cx.cpar; }
    }
  }
  return { coste, llega, primero, riesgo };
}
// las ocasiones de pedir: dónde y cuándo (al llegar o esperando a que empiece la franja), de mejor a peor.
// «dentro»: también las que ya no dejan salir antes de que cierren (habrá que dormir en un portal).
function ocasiones(cx, C, dentro) {
  const s = cx.s, out = [];
  const vp = valorPan(s.pan);
  if (vp <= 0) return out;
  const eAqui = E.L[cx.aqui].dentro ? E.estado(s, cx.aqui, cx.d, cx.f) : null;
  for (const l of DENTRO) {
    if (VETA.includes(l)) continue;
    const ta = l === cx.aqui ? cx.t : C.llega[l];
    if (ta == null || C.coste[l] === Infinity) continue;
    const sig = (Math.floor(ta / FR) + 1) * FR;
    for (const tb of ta % FR === 0 || process.env.ALINEA === "nunca" ? [ta] : process.env.ALINEA === "siempre" ? [sig] : [ta, sig]) {
      const fb = E.franja(tb);
      if (tb + FR > FIN) continue;
      const sale = tb + FR + PASO * SAL[l] <= FIN; // pedir y aún salir antes de que cierren
      if (!dentro && !sale) continue;
      let g, mucha;
      if (l === cx.aqui && tb === cx.t) {
        if (cx.rondaAqui || eAqui.da < 2) continue;
        // ahí pide o acaba de pedir otro: vendrá la ronda
        if (E.hayQuejas(s, l) || (s.conTuyos && E.tuyosEn(s, l).some((x) => x.pide))) continue;
        g = media(eAqui.da, E.escasez(s, cx.d), !!s.llaga); mucha = eAqui.da >= 3 ? 1 : 0;
      } else {
        g = cx.G[fb][l].g * (1 - prRonda(cx, l, fb)); mucha = cx.G[fb][l].mucha;
      }
      if (g <= 0) continue;
      const seg2 = tb + FR - (fb + 1) * FR;
      const rb = seg2 > 0 ? prLlegaPidiendo(cx, l, fb) * (1 - 0.5 * mucha) * seg2 / FR : 0;
      const neto = g * vp - rb * cx.cdet - C.riesgo[l]; // lo que espera sacar menos lo que arriesga
      if (!dentro && neto <= UMBRAL) continue;
      out.push({ v: neto - KAPPA * (tb + FR - cx.t) / FR, neto, l, tb, ta, sale }); // entre las que valen la pena, la que antes rinde
    }
  }
  out.sort((a, b) => b.v - a.v);
  return out;
}
// por qué puerta salir: la de menos riesgo que aún dé tiempo
function salida(cx, C) {
  let mejor = null;
  for (const g of PUERTAS) {
    const tg = g === cx.aqui ? cx.t : C.llega[g];
    if (tg == null || tg + PASO > FIN) continue;
    const c = g === cx.aqui ? 0 : C.coste[g];
    if (!mejor || c < mejor.c) mejor = { c, g };
  }
  return mejor && mejor.g;
}
// Seguir un encargo (ir a un sitio a pedir, salir por una puerta, ir a dormir a un portal). Devuelve la jugada, o null
// si el encargo se ha acabado o ya no se puede cumplir (entonces hay que volver a pensar).
function encargo(s, cx, C) {
  const m = s._meta;
  if (!m) return null;
  s._meta = null;
  if (m.dia !== cx.d || s.hoy.paradas !== m.par || s.detenidoHoy) return null; // es de otro día o me han parado: ya no vale
  if (cx.vista && !m.vista && cx.aqui !== m.l) return null;   // acabo de ver a la ronda: lo pienso otra vez
  if (m.tipo === "salir") {
    if (!E.L[cx.aqui].dentro) return { a: "acabar" };
    const tg = cx.aqui === m.g ? cx.t : C.llega[m.g];
    if (tg == null || tg + PASO > FIN) return null;
    s._meta = m;
    return { a: "mover", d: cx.aqui === m.g ? AFUERA[m.g] : C.primero[m.g] };
  }
  if (cx.aqui !== m.l) {
    if (C.llega[m.l] == null || C.coste[m.l] === Infinity) return null;
    s._meta = m;
    return { a: "mover", d: C.primero[m.l] };
  }
  if (m.tipo === "dormir") return { a: "acabar" };
  // tipo «ir»: ya estoy; si toca, espero a que empiece la franja, y pido
  if (m.alin && cx.t % FR !== 0 && cx.t + FR <= FIN) { s._meta = m; return { a: "esperar" }; }
  if (cx.rondaAqui || cx.t + FR > FIN || E.estado(s, cx.aqui, cx.d, cx.f).da < 2) return null;
  if (E.hayQuejas(s, cx.aqui) || (s.conTuyos && E.tuyosEn(s, cx.aqui).some((x) => x.pide))) return null; // ahí pide o acaba de pedir otro
  return { a: "pedir" };
}
// El oficio por su cuenta. Devuelve una jugada: { a: "pedir" | "esperar" | "acabar" | "trabajo" | "mover", d: destino }
function oficioLibre(s, cx, C) {
  const oc = ocasiones(cx, C, false);
  if (oc.length) {
    const o = oc[0];
    if (o.l !== cx.aqui) return { a: "mover", d: C.primero[o.l], plan: { tipo: "ir", l: o.l, alin: o.tb !== o.ta } };
    return o.tb === cx.t ? { a: "pedir" } : { a: "esperar" };
  }
  if (!E.L[cx.aqui].dentro) return { a: "acabar" };
  const g = salida(cx, C);
  if (!g) return { a: "acabar" }; // ya no llega: duerme donde está
  return { a: "mover", d: cx.aqui === g ? AFUERA[g] : C.primero[g], plan: { tipo: "salir", g } };
}
function oficio(s, K) {
  const cx = contexto(s, K), C = caminos(cx);
  return encargo(s, cx, C) || oficioLibre(s, cx, C);
}
function ejecutar(s, j) {
  if (j.a === "hurtar") return E.hurtar(s);
  if (j.a === "restituir") return E.restituir(s);
  if (j.a === "mover") return E.mover(s, j.d);
  if (j.a === "pedir") return E.pedir(s);
  if (j.a === "esperar") return E.esperar(s);
  if (j.a === "trabajo") return E.pedirTrabajo(s);
  return E.acabarDia(s);
}

// ------------------------------------------------------------------ el valor de amanecer así
// V[verano][día][clave]: lo que vale amanecer ese día con ese cuerpo, ese pan, esas detenciones… jugando el oficio desde
// ahí (en un verano suelto: 1 si acaba con hoz, AGUANTA si llega sin ella, 0 si no llega; en la cadena: la
// probabilidad de que el que juega llegue a la siega del último verano). Se calcula hacia atrás, del día 10 al 1 y
// del último verano al primero, con partidas de un día.
const V = {};
const conoce = (s) => s.conocido || (!!s.conCadena && !!s.azotado);
const clase = (s) => (s.detenciones >= 2 ? 3 : s.detenciones === 1 ? 2 : conoce(s) ? 1 : 0);
const llagaDe = (s) => (!s.llaga ? 0 : LL.protege && (s.llagaPasadas || 0) >= LL.protege ? 2 : 1);
function bitsTuyos(s) { let b = 0; for (const t of s.tuyos || []) if (t.estado === "vive") b |= t.el ? 1 : 2; return b; }
const cola = (s) => (s.conCadena ? `|${E.esHombre(s) ? 1 : 0}|${bitsTuyos(s)}` : "");
function claveAlba(s) {
  return `${Math.max(1, Math.min(6, s.cuerpo))}|${Math.min(4, s.pan)}|${clase(s)}|${E.L[s.lugar].dentro ? 1 : 0}|${llagaDe(s)}${cola(s)}`;
}
function utilidad(s) {
  const t = s.final.tipo;
  if (s.conCadena) return (t === "siega" || t === "espiga" || t === "aguanta") && s.verano >= ULTIMO ? 1 : 0;
  return t === "siega" ? 1 : t === "aguanta" ? CFG.uAguanta : 0;
}
function valorAlba(s) {
  const Vd = (V[s.verano] || {})[s.dia];
  if (!Vd) return 0.5;
  const v = Vd[claveAlba(s)];
  return v == null ? 0.5 : v;
}
// al acabar un verano de la cadena: lo que vale empezar el siguiente como quedas después de la siega
function valorInvierno(s) {
  const Vd = (V[s.verano + 1] || {})[1];
  if (!Vd) return 0.3;
  const ini = P.cadena.inicio[s.siega.yo] || P.cadena.inicio.nada;
  const cl = s.detenciones >= 2 ? 3 : s.detenciones === 1 ? 2 : s.azotado ? 1 : 0;
  const v = Vd[`${ini.cuerpo}|${ini.pan}|${cl}|0|0${cola(s)}`];
  return v == null ? 0.3 : v;
}
// la cena: cuánto comer. Con la tabla de valor, lo que deje mejor amanecer; sin ella, todo lo que haya.
function cenaBase(s) {
  const max = Math.min(2, s.pan);
  if (s.duerme === "carcel" || max === 0) return 0;
  if (max === 2) return 2;
  const tras = (n) => Math.min(E.cuerpoMax(s), s.cuerpo + P.cena[n] - (s.trabajoHoy ? P.trabajo.cansancio : 0) + (s.azotesHoy ? P.carcel.azotes * s.azotesHoy : 0) + (s.llaga && s.llaga === s.dia ? LL.cuerpo : 0));
  if (tras(0) <= 0) return 1;
  const Vd = (V[s.verano] || {})[s.dia + 1];
  if (!Vd || s.dia >= R.DIAS) return 1;
  const val = (n) => { const c = tras(n); return c <= 0 ? 0 : Vd[`${Math.min(6, c)}|${s.pan - n}|${clase(s)}|${s.duerme === "portal" ? 1 : 0}|${llagaDe(s)}${cola(s)}`] || 0; };
  return val(0) > val(1) + 1e-9 ? 0 : 1;
}

// ------------------------------------------------------------------ copias y simulación
// una copia ligera de la partida: sin la crónica ni lo que no hace falta para seguir jugando
function podar(s) {
  const o = Object.assign({}, s);
  o.cronica = []; o.porDia = []; o.vistas = []; o.contado = []; o.ultimo = null; o.noche = null; o.aviso = null; o.encuesta = {};
  const hoy = `${s.dia}|`;
  for (const k of ["rondas", "rondasPorque", "rondasQuien", "rondasContado", "tuyosAqui"]) {
    if (!s[k]) continue;
    o[k] = {};
    for (const x in s[k]) if (x.startsWith(hoy)) o[k][x] = s[k][x];
  }
  if (s.cadena) o.cadena = { vidas: [], anales: [], archivo: [] };
  if (s.heredados) o.heredados = [];
  if (s.tuyos) o.tuyos = s.tuyos.map((t) => Object.assign({}, t, { vistas: t.vistas.filter((v) => s.dia - v.dia <= 3) }));
  return o;
}
const copia = (s) => JSON.parse(JSON.stringify(s));
function herederoBase(s) {
  const c = s.relevo.candidatos.map((id) => s.tuyos.find((t) => t.id === id));
  c.sort((a, b) => b.cuerpo - a.cuerpo || a.detenciones - b.detenciones);
  return c[0].id;
}
// avanza una copia con el oficio hasta que amanezca otro día, acabe el verano o acabe la partida; devuelve lo que vale
function simular(w, K, d0, y0) {
  for (let guard = 0; guard < 600; guard++) {
    const fz = w.fase;
    if (fz === "fin") return utilidad(w);
    if (fz === "invierno") return valorInvierno(w);
    if (fz === "relevo") { E.elegirHeredero(w, herederoBase(w)); continue; }
    if (fz === "resultado") { E.seguir(w); continue; }
    if (fz === "amanecer") { if (w.dia !== d0 || w.verano !== y0) return valorAlba(w); E.empezarJornada(w); continue; }
    if (fz === "noche") { E.cenar(w, cenaBase(w)); continue; }
    if (w.t >= FIN) { E.comprobarNoche(w); continue; }
    ejecutar(w, oficio(w, K));
  }
  return 0;
}

// ------------------------------------------------------------------ construir la tabla de valor
const CACHE = path.join(__dirname, ".cache");
const TABLA = 1; // súbelo si cambias el oficio: la tabla guardada deja de valer
const VM = +process.env.VM || (CFG.cadena ? 40 : 100), VP = +process.env.VP || 200; // partidas por casilla y amaneceres de muestra
function firma() {
  const txt = JSON.stringify([R.version, P, R.RONDA, R.LUGARES.map((l) => [l.id, l.gente, l.pobres, l.aviso]), R.CAMINOS, R.VERANOS, R.DIAS_SENALADOS,
    KAPPA, WT, UMBRAL, CFG.tuyos, CFG.llaga, CFG.cadena, CFG.cadena ? 0 : CFG.uAguanta, TABLA, VM, VP]);
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
// empezar un verano de la cadena como se quiera: se monta el invierno anterior y se deja que el motor haga el resto
function empezarVerano(y, el, sem, yo, det, azot, bits, clases) {
  const s = E.nueva("A", "v", sem, { cadena: CFG.cadena, tuyos: CFG.tuyos, llaga: CFG.llaga, mujer: !el, hurto: HC.activo });
  if (y === 0) return s;
  s.verano = y - 1; s.anio = R.VERANOS[y - 1].anio;
  s.detenciones = det; s.azotado = azot;
  s.tuyos = s.tuyos.filter((t) => bits & (t.el ? 1 : 2));
  s.siega = { yo, tuyos: clases };
  s.fase = "invierno"; s.invierno = {};
  E.siguienteVerano(s);
  return s;
}
function construirAnio(y, sexos, M, NP, avisa) {
  const llagas = CFG.llaga ? [0, 1, 2] : [0];
  const combos = CFG.cadena ? [0, 1, 2, 3] : [null];
  const Vy = (V[y] = V[y] || {});
  // 1. partidas del oficio para tener amaneceres naturales (lo que sabe, las costumbres que le han cogido, los tuyos)
  const fotos = {};
  for (const el of sexos) {
    fotos[el] = {};
    const rnd = azar(`fotos|${y}|${el}`);
    for (let i = 0; i < NP; i++) {
      const alta = el ? "hoz" : "espiga";
      const det = rnd() < 0.7 ? 0 : rnd() < 0.67 ? 1 : 2;
      const bits = y === 0 ? 3 : rnd() < 0.5 ? 3 : rnd() < 0.4 ? 1 : rnd() < 0.67 ? 2 : 0;
      const s = empezarVerano(y, el, `f${y}${el ? "h" : "m"}${i}`, rnd() < 0.7 ? alta : "nada", det, det === 2 || (!el && rnd() < 0.2), bits,
        { pedro: rnd() < 0.6 ? "hoz" : "nada", catalina: rnd() < 0.6 ? "espiga" : "nada" });
      const B = nuevoSaber(s);
      for (let g = 0; g < 4000; g++) {
        const fz = s.fase;
        if (fz === "fin" || fz === "invierno" || fz === "relevo") break;
        if (fz === "amanecer") {
          if (s.dia >= 2) (fotos[el][s.dia] = fotos[el][s.dia] || []).push({ txt: JSON.stringify(podar(s)), K: { rho: B.rho, rhoCorpus: B.rhoCorpus }, bits: bitsTuyos(s) });
          E.empezarJornada(s); continue;
        }
        if (fz === "resultado") { E.seguir(s); continue; }
        if (fz === "noche") { mirar(s, B); if (CFG.cadena) darTodos(s); E.cenar(s, cenaBase(s)); continue; }
        if (s.t >= FIN) { E.comprobarNoche(s); continue; }
        mirar(s, B); ejecutar(s, oficio(s, B)); mirar(s, B);
      }
    }
  }
  // 2. del día 10 al 2: en cada amanecer, cambiar cuerpo, pan, detenciones, sitio, llaga y los tuyos que quedan, y jugar un día
  for (let d = R.DIAS; d >= 2; d--) {
    const Vd = (Vy[d] = Vy[d] || {});
    for (const el of sexos) for (const bits of combos) {
      const todas = fotos[el][d] || [];
      const lista = bits == null ? todas : todas.filter((x) => (x.bits & bits) === bits);
      if (!lista.length) continue;
      const col = CFG.cadena ? `|${el ? 1 : 0}|${bits}` : "";
      for (const ll of llagas) for (let cu = 1; cu <= (ll ? LL.cuerpoMax : 6); cu++) for (let pan = 0; pan <= 4; pan++) for (let cl = 0; cl < 4; cl++) for (let loc = 0; loc < 2; loc++) {
        let sum = 0;
        for (let i = 0; i < M; i++) {
          const ft = lista[i % lista.length];
          const w = JSON.parse(ft.txt);
          w.cuerpo = cu; w.pan = pan; w.detenciones = cl === 3 ? 2 : cl === 2 ? 1 : 0; w.conocido = cl > 0; if (CFG.cadena) w.azotado = cl === 3;
          w.lugar = loc ? DENTRO[i % DENTRO.length] : "ribera";
          w.llaga = ll ? d - 1 : 0; w.llagaPasadas = ll === 2 ? LL.protege : 0;
          if (bits != null) for (const t of w.tuyos) if (t.estado === "vive" && !(bits & (t.el ? 1 : 2))) t.estado = "muerto";
          sum += simular(w, ft.K, d, y);
        }
        Vd[`${cu}|${pan}|${cl}|${loc}|${ll}${col}`] = sum / M;
      }
    }
    if (avisa) avisa(y, d);
  }
  // 3. el primer día de los veranos siguientes de la cadena (para valorar cómo se acaba el anterior)
  if (y > 0) {
    const V1 = (Vy[1] = Vy[1] || {});
    const rnd = azar(`uno|${y}`);
    for (const el of sexos) for (const bits of combos) for (const yo of [el ? "hoz" : "espiga", "nada"]) for (let cl = 0; cl < 4; cl++) {
      let sum = 0;
      const ini = P.cadena.inicio[yo];
      for (let i = 0; i < 2 * M; i++) {
        const s = empezarVerano(y, el, `u${y}${i}`, yo, cl === 3 ? 2 : cl === 2 ? 1 : 0, cl === 3 || cl === 1, bits,
          { pedro: rnd() < 0.6 ? "hoz" : "nada", catalina: rnd() < 0.6 ? "espiga" : "nada" });
        sum += simular(s, nuevoSaber(s), 1, y);
      }
      V1[`${ini.cuerpo}|${ini.pan}|${cl}|0|0|${el ? 1 : 0}|${bits}`] = sum / (2 * M);
    }
  }
  return Vy;
}
const fichV = () => path.join(CACHE, `valor-${CFG.cadena ? "cadena" : CFG.tuyos ? "tuyos" : "verano"}${CFG.llaga ? "-llaga" : ""}${CFG.cadena ? "" : CFG.mujer ? "-mujer" : ""}-${firma()}.json`);
// carga la tabla de valor, o la construye y la guarda (en la cadena, los dos sexos a la vez en dos procesos)
async function cargarV(avisa) {
  const f = fichV();
  if (fs.existsSync(f)) { Object.assign(V, JSON.parse(fs.readFileSync(f, "utf8"))); return; }
  fs.mkdirSync(CACHE, { recursive: true });
  if (!CFG.cadena) construirAnio(0, [!CFG.mujer], VM, VP, avisa);
  else {
    const { fork } = require("child_process");
    const tmp = f + ".tmp";
    for (let y = ULTIMO; y >= 0; y--) {
      fs.writeFileSync(tmp, JSON.stringify(V));
      const partes = await Promise.all([true, false].map((el) => new Promise((ok, mal) => {
        const h = fork(__filename, [], { env: Object.assign({}, process.env, { VY: String(y), VSEXO: el ? "h" : "m", VTMP: tmp }) });
        h.on("message", ok); h.on("error", mal);
      })));
      V[y] = {};
      for (const pt of partes) for (const d in pt) V[y][d] = Object.assign(V[y][d] || {}, pt[d]);
      if (avisa) avisa(y, 1);
    }
    fs.unlinkSync(tmp);
  }
  fs.writeFileSync(f, JSON.stringify(V));
}
// (solo para construir la tabla en la cadena) darles lo que piden guardándose la ración, para que haya amaneceres con los tuyos vivos
function darTodos(s) {
  for (const x of s.nocheTuyos || []) {
    if (!x.presente || !x.pide) continue;
    const n = Math.min(x.pide, s.pan - 2);
    if (n > 0) E.darPan(s, x.id, n);
  }
}

// ------------------------------------------------------------------ mundos compatibles con lo que sé
// Un mundo es una copia de la partida en la que todo lo que no sé está sacado de nuevo:
//   - otra semilla: otro azar de aquí en adelante (gente, pobres, desvíos de la ronda, limosna, paradas);
//   - las costumbres de la ronda, sacadas de lo que creo;
//   - la ronda de esta franja y los tuyos, viviendo el día de nuevo desde anoche con esa semilla y esas costumbres
//     (un «fantasma»: se repite la noche pasada y se deja pasar el día sin mí), y solo valen si casan con lo que veo.
// Lo que veo ahora (la gente y los pobres de mi sitio, si la ronda está, si uno de los tuyos pide aquí, si quedan
// quejas de otro) se respeta; lo demás del estado real del motor no pasa a la copia.
function sacarCostumbres(B, rng) {
  const una = (k) => { let x = rng(); for (const c of COST[k]) { x -= B.post[k][c]; if (x < 0) return c; } return COST[k][COST[k].length - 1]; };
  const m = una("manana");
  return [m, m, null, una("nona"), una("visperas"), una("cierra")];
}
function casa(s, B, sem, f, noche) {
  const falso = { semilla: sem, verano: s.verano, anio: s.anio, conTuyos: false };
  for (const o of B.hoy) {
    const ahora = !noche && o.f === f;
    if (!ahora && !(o.l === s.lugar && (noche || s.t >= 4 * FR))) continue; // lo de antes solo importa donde voy a dormir
    const e = E.estado(falso, o.l, s.dia, o.f);
    if (ahora && e.gente !== o.gente) return false;
    if (!(o.pobres && o.tuyo) && e.pobres !== o.pobres) return false;
  }
  return true;
}
function fantasma(s, B, sem, circ, f) {
  const vis = B.vis;
  let g;
  if (vis.tipo === "nueva") g = E.nueva("A", "g", sem, { llaga: CFG.llaga, tuyos: CFG.tuyos, cadena: CFG.cadena, mujer: CFG.mujer });
  else {
    g = JSON.parse(vis.txt); g.semilla = sem;
    if (vis.tipo === "cenar") { g.circuito = circ; E.cenar(g, vis.n); } else E.siguienteVerano(g);
  }
  if (g.fase !== "amanecer" || g.dia !== s.dia || g.verano !== s.verano) return null;
  g.circuito = circ;
  E.empezarJornada(g);
  // lo que he pedido hoy lo sé; si alguno me vendió anoche no lo sé: en el fantasma, lo que salga
  g.habitos = g.habitos || {};
  for (const ff in s.habitos || {}) for (const l in s.habitos[ff]) if (s.habitos[ff][l].includes(s.dia)) {
    const dias = ((g.habitos[ff] = g.habitos[ff] || {})[l] = g.habitos[ff][l] || []);
    if (!dias.includes(s.dia)) dias.push(s.dia);
  }
  g._inj = {};
  for (let i = 0; i < f; i++) {
    if (i === f - 1) {
      // mis quejas de la franja anterior: la ronda de ahora las ha tenido en cuenta
      const q = misQuejas(s, f - 1).v;
      for (const l in q) if (q[l] > 0) { g.avisos[l] = (g.avisos[l] || 0) + q[l]; g.avisosT[l] = s.dia * 100 + FIN; g._inj[l] = q[l]; }
    }
    E.esperar(g);
  }
  return g;
}
function mundo(s, B, baseTxt, rng) {
  const d = s.dia, noche = s.fase !== "dia", f = noche ? NF - 1 : E.franja(s.t), k = `${d}|${f}`;
  const aqui = !noche && E.rondaEnTuZona(s) ? s.lugar : null;
  const vista = aqui || (!noche && s._rv === d * 10 + f ? s._rl : null);
  let sem, circ, g = null;
  for (let i = 0; i < 40; i++) {
    circ = sacarCostumbres(B, rng);
    for (let j = 0; j < 300; j++) {
      sem = "m" + Math.floor(rng() * 1e9);
      if (!casa(s, B, sem, f, noche)) continue;
      // el primer día del verano la ronda de prima sale de la semilla: que su mañana sea la que he sacado
      if (!noche && B.vis.tipo !== "cenar" && E.recorridoVerano({ semilla: sem, verano: s.verano, anio: s.anio, huella: s.huella })[0] !== circ[0]) continue;
      break;
    }
    if (noche) break;
    g = fantasma(s, B, sem, circ, f);
    if (!g) continue;
    const pos = g.rondas[k];
    if (vista ? pos === vista : !B.hoy.some((o) => o.f === f && o.l === pos)) break;
    if (i === 39) g.rondas[k] = vista; // no ha habido manera: la pongo donde la veo (o en ningún sitio)
  }
  const w = JSON.parse(baseTxt);
  w.semilla = sem; w.circuito = circ; w.n = 0;
  if (noche || !g) { w.rondas = {}; w.rondasPorque = {}; w.rondasQuien = {}; w.rondasContado = {}; return w; }
  w.rondas = { [k]: g.rondas[k] }; w.rondasPorque = { [k]: g.rondasPorque[k] || "recorrido" };
  w.rondasQuien = g.rondasQuien || {}; w.rondasContado = g.rondasContado || {};
  if (!s.conTuyos) return w;
  // los tuyos, como les ha ido en el fantasma; en mi sitio, lo que veo
  w.tuyos = g.tuyos; w.tuyosF = g.tuyosF;
  if (!s._ms) { w.habitos = g.habitos; w.malsinado = g.malsinado || null; }
  const ta = (g.tuyosAqui || {})[k] || {};
  const veo = E.tuyosEn(s, s.lugar).map((x) => ({ id: s.tuyos.find((t) => t.nombre === x.nombre).id, pide: x.pide }));
  for (const l in ta) ta[l] = ta[l].filter((x) => l !== s.lugar && !veo.some((v) => v.id === x.id));
  if (veo.length) { ta[s.lugar] = veo; for (const v of veo) { const tu = w.tuyos.find((t) => t.id === v.id); if (tu && tu.estado === "vive" && !tu.detenido) tu.lugar = s.lugar; } }
  w.tuyosAqui = { [k]: ta };
  // las quejas: las mías (las sé) y las de los tuyos del fantasma; en mi sitio, lo que oigo
  const mias = misQuejas(s, f).v;
  w.avisos = {}; w.avisosT = {};
  for (const l in g.avisos) { const x = g.avisos[l] - Math.max(0, (g._inj[l] || 0) - 1); if (x > 0) { w.avisos[l] = x; w.avisosT[l] = g.avisosT[l] || 0; } }
  for (const l in mias) if (mias[l] > 0) { w.avisos[l] = (w.avisos[l] || 0) + mias[l]; w.avisosT[l] = s.avisosT[l] || d * 100 + s.t; }
  if (!s.pedidoHoy.some((p) => p.lugar === s.lugar)) {
    if (E.hayQuejas(s, s.lugar)) { if (!w.avisos[s.lugar]) { w.avisos[s.lugar] = 1; w.avisosT[s.lugar] = d * 100 + s.t; } }
    else if (w.avisos[s.lugar]) { delete w.avisos[s.lugar]; delete w.avisosT[s.lugar]; }
  }
  return w;
}

// ------------------------------------------------------------------ la búsqueda
// las jugadas que se prueban de día
function jugadas(s, B) {
  const cx = contexto(s, B), C = caminos(cx);
  const out = [], visto = {};
  const pon = (j) => { const k = j.a + "|" + (j.d || "") + "|" + (j.meta ? j.meta.tipo + (j.meta.l || j.meta.g) + (j.meta.alin ? "a" : "") : ""); if (!visto[k]) { visto[k] = 1; j.k = k; out.push(j); } };
  const dentro = E.L[cx.aqui].dentro;
  // la titular: lo que haría el oficio por su cuenta
  out.push(Object.assign(oficioLibre(s, cx, C), { k: "oficio" }));
  // pedir aquí, esperar a la franja, o ir a pedir a otro sitio (al llegar o esperando allí): las mejores según el oficio
  let n = 0;
  for (const o of ocasiones(cx, C, true)) {
    if (n >= 7) break;
    if (o.l === cx.aqui) pon(o.tb === cx.t ? { a: "pedir" } : { a: "esperar" });
    else pon({ a: "mover", d: C.primero[o.l], meta: { tipo: "ir", l: o.l, alin: o.tb !== o.ta } });
    n++;
  }
  // salir por cada puerta
  if (dentro) for (const g of PUERTAS) {
    const tg = g === cx.aqui ? cx.t : C.llega[g];
    if (tg != null && tg + PASO <= FIN) pon({ a: "mover", d: cx.aqui === g ? AFUERA[g] : C.primero[g], meta: { tipo: "salir", g } });
  }
  // dar el día por acabado: fuera, bajar a la ribera; dentro, dormir en este portal o en uno más tranquilo
  if (!dentro || cx.t >= 3 * FR) pon({ a: "acabar" });
  if (cx.t >= 3 * FR) for (const l of ["sanpolo", "sanpablo"]) if (l !== cx.aqui && C.llega[l] != null) pon({ a: "mover", d: C.primero[l], meta: { tipo: "dormir", l } });
  // las obras
  if (E.L[cx.aqui].trabajo && cx.f === 0 && cx.tipo === "laborable" && !s.trabajoPedido && !s.llaga && !(s.conCadena && !E.esHombre(s))) pon({ a: "trabajo" });
  return out;
}
// Prueba cada jugada en varios mundos (los mismos para todas). La primera es la «titular»: la que haría el oficio.
// Otra jugada solo la desbanca si le gana con claridad en los mismos mundos (diferencia media mayor que Z veces su
// error típico): con pocos mundos, la mejor media sale muchas veces de la suerte y no de la jugada.
const Z = process.env.Z != null ? +process.env.Z : 1.7, DELTA = 0.002;
function carrera(cands, nMundos, hazMundo, prueba, traza) {
  const tit = { c: cands[0], v: [] };
  let retan = cands.slice(1).map((c) => ({ c, v: [] }));
  const txt = [];
  const dif = (r) => { let a = 0, b = 0; const n = r.v.length; for (let i = 0; i < n; i++) { const d = r.v[i] - tit.v[i]; a += d; b += d * d; } const m = a / n; return { m, et: Math.sqrt(Math.max(0, b / n - m * m) / Math.max(1, n - 1)) }; };
  let i0 = 0;
  for (const [n, queda] of [[nMundos, 3], [nMundos, 1], [2 * nMundos, 1]]) {
    for (let i = i0; i < i0 + n; i++) {
      if (!txt[i]) txt[i] = JSON.stringify(hazMundo());
      tit.v[i] = prueba(JSON.parse(txt[i]), tit.c);
      for (const r of retan) r.v[i] = prueba(JSON.parse(txt[i]), r.c);
    }
    i0 += n;
    for (const r of retan) r.d = dif(r);
    retan.sort((a, b) => b.d.m - a.d.m);
    if (traza) { traza[tit.c.k] = `${(tit.v.reduce((a, b) => a + b, 0) / tit.v.length).toFixed(3)} (${tit.v.length})`; for (const r of retan) traza[r.c.k] = `${r.d.m >= 0 ? "+" : ""}${r.d.m.toFixed(3)}±${r.d.et.toFixed(3)} (${r.v.length})`; }
    retan = retan.filter((r) => r.d.m > 0).slice(0, queda);
    if (!retan.length) return tit.c;
  }
  const r = retan[0];
  return r.d.m > DELTA && r.d.m > Z * r.d.et ? r.c : tit.c;
}
const CNT = {}; // cuántas veces piensa y cuántas se aparta del oficio (para el informe)
function pensarDia(s, B, rng, traza) {
  const cands = jugadas(s, B);
  if (cands.length === 1) return cands[0];
  const base = JSON.stringify(podar(s)), d0 = s.dia, y0 = s.verano;
  const j = carrera(cands, CFG.mundos, () => mundo(s, B, base, rng), (w, c) => {
    w._meta = c.meta ? Object.assign({ dia: d0, par: w.hoy.paradas, vista: w._rv === d0 * 10 + E.franja(w.t) }, c.meta) : null;
    ejecutar(w, c);
    return simular(w, B, d0, y0);
  }, traza);
  mas(CNT, "piensa de día");
  if (cands.some((c) => c.a === "trabajo")) mas(CNT, "podía pedir trabajo");
  if (j.k !== "oficio") {
    const t = j.a === "trabajo" ? "pide trabajo" : j.a === "acabar" ? (E.L[s.lugar].dentro ? "se queda a dormir dentro" : "acaba el día fuera") : j.a === "pedir" ? "pide aquí ya" : j.a === "esperar" ? "espera a la franja"
      : j.meta.tipo === "dormir" ? "va a dormir a un portal" : j.meta.tipo === "salir" ? "sale por otra puerta o antes" : "va a pedir a otro sitio";
    mas(CNT, "se aparta de día: " + t);
  }
  return j;
}
// de noche: cuánto dar a cada uno de los tuyos, si hacerse la llaga y cuánto cenar
function pensarNoche(s, B, rng, traza) {
  const piden = (s.nocheTuyos || []).filter((x) => x.presente && x.pide > 0);
  let repartos = [[]];
  if (CFG.dar !== "nadie") for (const x of piden) {
    const sig = [];
    for (const r of repartos) for (const n of [...new Set([0, 1, x.pide])]) sig.push(r.concat([{ id: x.id, n }]));
    repartos = sig;
  }
  const cands = [];
  for (const r of repartos) {
    const dado = r.reduce((a, x) => a + x.n, 0);
    if (dado > s.pan) continue;
    const queda = s.pan - dado, max = Math.min(2, queda);
    for (const ll of E.puedeLlaga(s) ? [false, true] : [false]) for (const n of s.duerme === "carcel" || max !== 1 ? [max] : [1, 0])
      cands.push({ dar: r, llaga: ll, cena: s.duerme === "carcel" ? 0 : n, k: `dar ${r.map((x) => x.id[0] + x.n).join(",") || "-"} · ${ll ? "llaga" : "-"} · cena ${n}` });
  }
  if (cands.length === 1) return cands[0];
  // la titular: no dar, no hacerse la llaga y cenar lo que diga el oficio
  const nb = cenaBase(s);
  const it = cands.findIndex((c) => !c.llaga && c.cena === nb && c.dar.every((x) => !x.n));
  cands.unshift(cands.splice(Math.max(0, it), 1)[0]);
  const base = JSON.stringify(podar(s)), d0 = s.dia, y0 = s.verano;
  const tit = cands[0];
  const c = carrera(cands, 2 * CFG.mundos, () => mundo(s, B, base, rng), (w, c) => {
    for (const x of c.dar) if (x.n) E.darPan(w, x.id, x.n);
    if (c.llaga) E.hacerLlaga(w);
    E.cenar(w, c.cena);
    return simular(w, B, d0, y0);
  }, traza);
  mas(CNT, "piensa de noche");
  if (c.llaga) mas(CNT, "se aparta de noche: se hace la llaga");
  if (c.dar.some((x) => x.n)) mas(CNT, "se aparta de noche: da pan");
  if (c.cena !== tit.cena && !c.dar.some((x) => x.n)) mas(CNT, c.cena < tit.cena ? "se aparta de noche: ayuna con un pedazo" : "se aparta de noche: cena el pedazo");
  return c;
}
// a quién seguir: el que deje mejor empezado el verano siguiente
function pensarRelevo(s, B, rng, traza) {
  const hb = herederoBase(s);
  const cands = [hb].concat(s.relevo.candidatos.filter((id) => id !== hb)).map((id) => ({ id, k: id }));
  if (cands.length === 1) return cands[0].id;
  const base = JSON.stringify(podar(s));
  const id = carrera(cands, 2 * CFG.mundos, () => { const w = JSON.parse(base); w.semilla = "m" + Math.floor(rng() * 1e9); w.circuito = sacarCostumbres(B, rng); w.rondas = {}; w.rondasPorque = {}; return w; }, (w, c) => {
    E.elegirHeredero(w, c.id);
    return simular(w, B, -1, -1);
  }, traza).id;
  mas(CNT, "elige heredero");
  if (id !== hb) mas(CNT, "se aparta: elige al de menos cuerpo");
  return id;
}

// ------------------------------------------------------------------ una partida
function jugar(sem, ver) {
  const s = E.nueva("A", "aplicado", String(sem), { llaga: CFG.llaga, tuyos: CFG.tuyos, cadena: CFG.cadena, mujer: CFG.mujer, hurto: HC.activo });
  const rng = azar(`aplicado|${sem}`);
  const busca = !CFG.soloOficio;
  let B = nuevoSaber(s);
  B.vis = { tipo: "nueva" };
  s._veranos = [];
  const dice = (txt, traza) => { if (ver) ver(s, txt, traza); };
  for (let guard = 0; s.fase !== "fin" && guard < 20000; guard++) {
    const fz = s.fase;
    if (fz === "relevo") {
      s._veranos.push({ anio: s.anio, quien: s.quien.id, fin: s.relevo.tipo, dia: s.dia });
      const tr = ver ? {} : null;
      const id = busca ? pensarRelevo(s, B, rng, tr) : herederoBase(s);
      dice(`relevo: sigue ${id}`, tr);
      E.elegirHeredero(s, id);
      continue;
    }
    if (fz === "invierno") {
      s._veranos.push({ anio: s.anio, quien: s.quien.id, fin: (s.invierno.relevo ? "heredero:" : "") + s.siega.yo, dia: s.dia });
      const vis = { tipo: "invierno", txt: JSON.stringify(podar(s)) };
      E.siguienteVerano(s);
      B = nuevoSaber(s); B.vis = vis;
      continue;
    }
    if (fz === "amanecer") { E.empezarJornada(s); continue; }
    if (fz === "resultado") {
      if (s.ultimo && s.ultimo.lineas.some((l) => l.includes("me han contado"))) s._ms = true; // lo dice el alguacil
      E.seguir(s); continue;
    }
    if (fz === "noche") {
      mirar(s, B);
      let n;
      if (busca) {
        const tr = ver ? {} : null;
        const c = pensarNoche(s, B, rng, tr);
        for (const x of c.dar) if (x.n) E.darPan(s, x.id, x.n);
        if (c.llaga) E.hacerLlaga(s);
        n = c.cena;
        if (n === 0 && s.pan >= 1 && s.duerme !== "carcel") (s._ayunos = s._ayunos || []).push(s.dia);
        dice(`noche: ${c.k}`, tr);
      } else { n = cenaBase(s); if (n === 0 && s.pan >= 1 && s.duerme !== "carcel") (s._ayunos = s._ayunos || []).push(s.dia); }
      if ((s.final || {}).tipo == null) B.vis = { tipo: "cenar", txt: JSON.stringify(podar(s)), n };
      E.cenar(s, n);
      continue;
    }
    if (s.t >= FIN) { E.comprobarNoche(s); continue; }
    mirar(s, B);
    let j = null;
    if (busca) {
      if (s._meta) { const cx = contexto(s, B); j = encargo(s, cx, caminos(cx)); }
      if (!j) {
        const tr = ver ? {} : null;
        j = pensarDia(s, B, rng, tr);
        // lo elegido se sigue sin volver a pensar hasta que se cumple o cambia algo (me paran, veo a la ronda)
        const m = j.meta || j.plan;
        s._meta = m ? Object.assign({ dia: s.dia, par: s.hoy.paradas, vista: s._rv === s.dia * 10 + E.franja(s.t) }, m) : null;
        dice(`piensa: ${j.k}`, tr);
      }
    } else {
      j = HC.decidir(s); // si la política de hurto dice que ahora toca, hurta o va a hurtar; si no, el oficio
      if (j) s._meta = null; else j = oficio(s, B);
    }
    ejecutar(s, j);
    mirar(s, B);
  }
  if (s.conCadena) s._veranos.push({ anio: s.anio, quien: s.quien.id, fin: "FIN:" + s.final.tipo, dia: s.final.dia });
  return s;
}

// ------------------------------------------------------------------ cuentas
function contar(A, s) {
  mas(A, "n");
  mas(A.fin, s.final.tipo);
  const T = E.resumenDias(s), nd = s.porDia.length;
  mas(A, "dias", nd); mas(A, "pan", T.panPedido + T.panTrabajo); mas(A, "pedidas", T.pedidas); mas(A, "encuentros", T.encuentros); mas(A, "paradas", T.paradas);
  mas(A, "ratosMover", T.mover); mas(A, "ratos", T.mover + T.pedir + T.trabajar + T.esperar + T.perdido); mas(A, "pasos", T.pasos);
  if (["siega", "aguanta", "espiga"].includes(s.final.tipo)) { mas(A, "llegan"); mas(A, "cuerpoLlegan", s.cuerpo); }
  if (s.llaga) { mas(A, "llagados"); mas(A.llagaDia, s.llaga); }
  for (const d of s.porDia) {
    if (d.duerme === "portal") mas(A, "nochesDentro");
    if (d.duerme !== "carcel") mas(A.cena, d.comido);
    if (d.panTrabajo) mas(A, "diasTrabajo");
  }
  // (lo que sigue mira dónde estuvo de verdad la ronda: es para el informe, el bot no lo veía)
  let dado = 0;
  const pon = (k) => { mas(A.casos, k); const x = (A.semillas[k] = A.semillas[k] || []); if (x.length < 8 && !x.includes(+s.semilla)) x.push(+s.semilla); };
  if (s._ayunos) { mas(A, "ayunos", s._ayunos.length); pon("ayuna con un pedazo guardado"); }
  const ult = s.porDia[s.porDia.length - 1];
  if (ult && ult.dia === R.DIAS && !s.conCadena) { mas(A.ultima, ult.duerme); if (ult.duerme !== "raso" && s.final.tipo === "siega") pon("última noche dentro o en la cárcel, y siega"); }
  for (const c of s.cronica) {
    if (c.tipo === "encuentro") mas(A.encF, E.franja(c.t));
    if ((c.tipo === "echado" || c.tipo === "detenido" || c.tipo === "obras") && c.motivo !== "de noche" && !s.conCadena) {
      const k = `${c.dia}|${E.franja(c.t) + (c.motivo === "pidiendo, llegó la ronda" ? 1 : 0)}`, pq = s.rondasPorque[k];
      mas(A.porque, pq === "aprendido" ? ((s.rondasQuien || {})[k] === "tú" ? ((s.rondasContado || {})[k] ? "por lo que contó un malsín" : "por mi costumbre") : "por la costumbre de uno de los tuyos") : pq === "aviso" ? (s.pedidoHoy && s.conTuyos ? "por una queja (mía o de los tuyos)" : "por una queja mía") : pq === "desvío" ? "por un desvío" : "por su recorrido");
    }
    if (c.tipo === "noche" && c.texto.includes("portal")) mas(A.portal, c.lugar);
    if (c.tipo === "detenido" && c.motivo === "de noche") mas(A.portalDet, c.lugar);
    if (c.tipo === "pedir" || c.tipo === "pillado") {
      const f = E.franja(c.t), punto = c.t % FR === 0, sig = s.conCadena ? undefined : s.rondas[`${c.dia}|${f + 1}`];
      if (c.tipo === "pillado") { mas(A.pillado, `${punto ? "en punto" : "a media franja"}, ${c.pillado === "llega" ? "llega la ronda" : "la ronda estaba"}`); if (punto) pon("pillado pidiendo en punto"); }
      else {
        dado += c.gana;
        if (!s.conCadena && E.L[c.lugar].aviso && f < NF - 1) {
          mas(A.tras, "pide donde avisan");
          if (sig === c.lugar) { mas(A.tras, "la ronda va allí la franja siguiente"); if (punto) pon("pide en punto, la ronda llega al acabar y no pasa nada"); }
        }
        if (!s.conCadena && punto && sig === c.lugar && s.rondasPorque[`${c.dia}|${f + 1}`] !== "aviso") pon("pide en punto y la ronda llega por su cuenta al acabar");
      }
    }
  }
  mas(A, "panPerdido", dado - T.panPedido);
  for (const c of s.cronica) {
    if (c.tipo === "detenido") mas(A.det, c.motivo.startsWith("pidiendo") ? "pidiendo" : c.motivo);
    else if (c.tipo === "echado") mas(A.det, c.texto.includes("azotan") ? "azotada en la calle" : "echado");
    else if (c.tipo === "obras") mas(A.det, "a las obras");
    else if (c.tipo === "pedir" || c.tipo === "pillado") {
      const f = E.franja(c.t);
      mas(A.pide, `${c.lugar}|${f}`); mas(A.pideF, f);
      if (c.t % FR === 0) mas(A, "alineadas");
      if (c.tipo === "pedir") { mas(A.pideDa, c.da); mas(A.panDa, c.da, c.gana); }
    } else if (c.tipo === "mover") {
      const m = /^(Puerta|Pta\. S\. Pablo) → (Puente|Orilla)$/.exec(c.texto);
      if (m) mas(A.sale, `${m[1] === "Puerta" ? "puerta" : "sanpolo"}|${E.franja(c.t)}`);
      const e = /^(Puente|Orilla) → (Puerta|Pta\. S\. Pablo)$/.exec(c.texto);
      if (e) mas(A.entra, `${e[2] === "Puerta" ? "puerta" : "sanpolo"}|${E.franja(c.t)}`);
    } else if (c.tipo === "dar") mas(A, "panDado", c.n);
    else if (c.tipo === "trabajo" && c.texto.startsWith("Le cogen")) mas(A, "trabajos");
  }
  if (s.tuyos) {
    for (const tu of s.tuyos) mas(A.tuyos, `${tu.nombre}:${tu.estado}`);
    if (s.malsinado) mas(A, "malsinado");
  }
  if (s.conCadena) {
    const fc = s.final.cadena;
    mas(A.hasta, fc.hasta);
    if (utilidad(s)) mas(A, "completa");
    for (const v of s._veranos) mas(A.veranos, `${v.anio}|${v.quien}|${v.fin}`);
    for (const y of new Set(s._veranos.map((v) => v.anio))) mas(A.juega, `${y}|${s._veranos.find((v) => v.anio === y).quien}`);
  }
}
const nuevaCuenta = () => ({ fin: {}, det: {}, pide: {}, pideF: {}, pideDa: {}, panDa: {}, sale: {}, entra: {}, cena: {}, llagaDia: {}, tuyos: {}, hasta: {}, veranos: {}, juega: {},
  casos: {}, semillas: {}, ultima: {}, encF: {}, portal: {}, portalDet: {}, pillado: {}, tras: {}, cnt: {}, porque: {} });
function sumar(a, b) { for (const k in b) { if (typeof b[k] === "object") { a[k] = a[k] || {}; sumar(a[k], b[k]); } else a[k] = (a[k] || 0) + b[k]; } return a; }
function tanda(desde, hasta) {
  const A = nuevaCuenta();
  for (let i = desde; i <= hasta; i++) {
    const s = jugar(i);
    contar(A, s);
    HC.cuenta((A.hurto = A.hurto || HC.nueva()), s);
    // semillas de muestra para el informe
    const t = "final: " + (s.conCadena ? (utilidad(s) ? "completa" : "acaba en " + s.final.cadena.hasta + ", " + s.final.tipo) : s.final.tipo);
    (A.semillas[t] = A.semillas[t] || []).length < 8 && A.semillas[t].push(i);
  }
  A.cnt = Object.assign({}, CNT);
  return A;
}
function pinta(A, nombre) {
  const N = A.n, pc = (x, n) => `${Math.round((100 * (x || 0)) / (n || N))}`.padStart(3) + " %";
  const f = A.fin;
  console.log("bot             | siega  sin siega | hambre  destierro  azotes | día   cuerpo* | pan/día  moverse  pasos/día  ronda al llegar/día | llaga");
  console.log(`${nombre.padEnd(15)} | ${pc(f.siega)}  ${pc((f.aguanta || 0) + (f.espiga || 0))}     | ${pc(f.hambre)}  ${pc((f.desterrado || 0) + (f.galeras || 0))}      ${pc(f.muerto)} | ${(A.dias / N).toFixed(1).padStart(4)}  ${A.llegan ? (A.cuerpoLlegan / A.llegan).toFixed(1) : " — "}     | ${(A.pan / A.dias).toFixed(2).padStart(5)}    ${pc(A.ratosMover, A.ratos)}   ${(A.pasos / A.dias).toFixed(1).padStart(4)}       ${(A.encuentros / A.dias).toFixed(2)}                | ${pc(A.llagados)}`);
  console.log(`  finales: ${Object.entries(f).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v).trim()}`).join(" · ")}`);
  console.log(`  por partida: pide ${(A.pedidas / N).toFixed(1)} veces (${pc(A.alineadas, A.pedidas).trim()} al empezar la franja) · llega donde está la ronda ${(A.encuentros / N).toFixed(2)} · ${Object.entries(A.det).map(([k, v]) => `${k} ${(v / N).toFixed(2)}`).join(" · ")}`);
  console.log(`  noches en un portal ${((A.nochesDentro || 0) / N).toFixed(2)} · cenas: entera ${pc(A.cena[2], A.dias).trim()}, media ${pc(A.cena[1], A.dias).trim()}, nada ${pc(A.cena[0], A.dias).trim()} · días en las obras ${((A.trabajos || 0) / N).toFixed(2)}`);
  const lug = (l) => E.L[l].corto, fr = (f) => R.FRANJAS[f].nombre.toLowerCase();
  const top = (o, n, f) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(f).join(" · ");
  console.log(`  dónde pide: ${top(A.pide, 8, ([k, v]) => `${lug(k.split("|")[0])} a ${fr(k.split("|")[1])} ${pc(v, A.pedidas).trim()}`)}`);
  console.log(`  a qué hora pide: ${R.FRANJAS.map((x, f) => `${fr(f)} ${pc(A.pideF[f], A.pedidas).trim()}`).join(" · ")} · con mucha gente ${pc(A.pideDa[3], A.pedidas).trim()} · pan que no le cabe ${((A.panPerdido || 0) / N).toFixed(1)} por partida`);
  console.log(`  entra: ${top(A.entra, 4, ([k, v]) => `${lug(k.split("|")[0])} a ${fr(k.split("|")[1])} ${(v / A.dias).toFixed(2)}/día`)} · sale: ${top(A.sale, 6, ([k, v]) => `${lug(k.split("|")[0])} a ${fr(k.split("|")[1])} ${(v / A.dias).toFixed(2)}/día`)}`);
  console.log(`  se cruza con la ronda a: ${R.FRANJAS.map((x, f) => `${fr(f)} ${((A.encF[f] || 0) / N).toFixed(2)}`).join(" · ")} (por partida)`);
  if (Object.keys(A.portal).length) console.log(`  portales: ${top(A.portal, 5, ([k, v]) => `${lug(k)} ${(v / N).toFixed(2)} noches (${A.portalDet[k] || 0} detenciones)`)}${Object.keys(A.ultima).length ? ` · la última noche: ${Object.entries(A.ultima).map(([k, v]) => `${k} ${pc(v).trim()}`).join(", ")}` : ""}`);
  if (Object.keys(A.pillado).length) console.log(`  le pillan pidiendo: ${Object.entries(A.pillado).map(([k, v]) => `${k} ${v}`).join(" · ")} (veces en total)`);
  if (A.tras["pide donde avisan"]) console.log(`  después de pedir donde avisan, la ronda va allí la franja siguiente ${pc(A.tras["la ronda va allí la franja siguiente"], A.tras["pide donde avisan"]).trim()} de las veces`);
  if (Object.keys(A.porque).length) console.log(`  cuando la ronda le para o le detiene de día, estaba allí: ${Object.entries(A.porque).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / N).toFixed(2)}`).join(" · ")} (por partida)`);
  if (A.ayunos) console.log(`  ayuna con un pedazo guardado ${(A.ayunos / N).toFixed(2)} noches por partida`);
  if (Object.keys(A.cnt).length) console.log(`  la búsqueda: ${Object.entries(A.cnt).map(([k, v]) => `${k} ${(v / N).toFixed(2)}`).join(" · ")} (por partida)`);
  if (Object.keys(A.semillas).length) console.log(`  semillas de muestra: ${Object.entries(A.semillas).map(([k, v]) => `${k}: ${v.join(", ")}`).join(" · ")}`);
  if (A.llagados) console.log(`  llaga: se la hace el ${pc(A.llagados).trim()}; noche: ${Object.entries(A.llagaDia).map(([k, v]) => `${k}: ${pc(v).trim()}`).join(" · ")}`);
  if (Object.keys(A.tuyos).length) console.log(`  los tuyos al final: ${Object.entries(A.tuyos).sort().map(([k, v]) => `${k} ${pc(v).trim()}`).join(" · ")} · pan dado ${((A.panDado || 0) / N).toFixed(1)} · malsinado ${pc(A.malsinado).trim()}`);
  if (Object.keys(A.hasta).length) {
    const ys = R.VERANOS.map((v) => v.anio);
    console.log(`  CADENA: tu gente acaba en ${ys.map((y) => `${y} ${pc(A.hasta[y]).trim()}`).join(" · ")} · el que juega llega a la siega de ${ys[ys.length - 1]}: ${pc(A.completa).trim()}`);
    for (const y of ys) {
      const jg = Object.entries(A.juega).filter(([k]) => k.startsWith(y + "|"));
      const ny = jg.reduce((a, [, v]) => a + v, 0);
      if (!ny) continue;
      console.log(`  ${y}: lo juegan ${pc(ny).trim()} (${jg.map(([k, v]) => `${k.split("|")[1]} ${pc(v, ny).trim()}`).join(", ")}) → ${Object.entries(A.veranos).filter(([k]) => k.startsWith(y + "|")).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.split("|").slice(1).join(":")} ${pc(v, ny).trim()}`).join(" · ")}`);
    }
  }
}

module.exports = { R, E, P, CFG, V, DENTRO, PUERTAS, azar, nuevoSaber, creer, mirar, oficio, ejecutar, simular, podar, copia, cenaBase, valorAlba, utilidad, claveAlba, herederoBase, contexto, caminos, ocasiones, misQuejas, misCostumbres, media, ganancias, cargarV, construirAnio, jugar, mundo, jugadas, tanda, contar, nuevaCuenta, sumar, pinta };

if (require.main === module) (async () => {
  const N = +process.argv[2] || 200, desde = +process.env.DESDE || 1;
  const variante = `${CFG.cadena ? "la cadena" : "un verano"}${CFG.cadena ? (CFG.mujer ? ", empieza la moza" : ", empieza el mozo") : ""}${CFG.tuyos && !CFG.cadena ? ", con los tuyos" : ""}${CFG.llaga ? ", con la llaga" : ""}`;
  const nombre = CFG.soloOficio ? "oficio" : "aplicado";
  if (process.env.VY) {
    // un proceso que construye la tabla de un verano para un sexo
    Object.assign(V, JSON.parse(fs.readFileSync(process.env.VTMP, "utf8")));
    process.send(construirAnio(+process.env.VY, [process.env.VSEXO === "h"], VM, VP, null), () => process.exit(0));
    return;
  }
  const t0 = Date.now();
  if (!process.env.SIN_TABLA) await cargarV(process.send ? null : (y, d) => process.stderr.write(`  tabla de valor: ${R.VERANOS[y].anio}, día ${d} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`));
  if (process.env.SEMILLA) {
    // una partida a la vista: qué pensó en cada jugada y la crónica
    const lineas = [];
    const s = jugar(process.env.SEMILLA, (s, txt, tr) => lineas.push(`${s.conCadena ? s.anio + " · " : ""}día ${s.dia} ${E.momentoTxt(s.t)} · en ${E.L[s.lugar].corto} · cuerpo ${s.cuerpo}, pan ${s.pan} · ${txt}${tr ? "   [" + Object.entries(tr).map(([k, v]) => `${k}: ${v}`).join(" · ") + "]" : ""}`));
    if (process.env.PIENSA) console.log(lineas.join("\n") + "\n");
    console.log(`Semilla ${process.env.SEMILLA} · ${variante} · ${nombre} · acaba: ${s.final.tipo}, día ${s.final.dia}${s.conCadena ? " de " + s.anio : ""}`);
    let d = 0, a = 0;
    for (const c of s.cronica) { if (c.dia !== d || c.anio !== a) { d = c.dia; a = c.anio; console.log(`-- ${s.conCadena ? a + " · " : ""}día ${d}`); } console.log(`${E.momentoTxt(c.t)} · ${c.texto}`); }
    const cv = s.circuito;
    console.log(`Costumbres de la ronda${s.conCadena ? " el último verano" : ""} (el bot no las veía): mañana ${cv[0]}, nona ${cv[3]}, vísperas ${cv[4]}, cierra ${cv[5]}`);
    return;
  }
  if (process.send) { process.send(tanda(desde, desde + N - 1)); return; }
  const np = Math.max(1, +process.env.PROCESOS || 1);
  const acaba = (A) => {
    console.log(`${N} partidas (semillas ${desde} a ${desde + N - 1}) · versión ${R.version} · ${variante} · AGUANTA=${CFG.uAguanta} · MUNDOS=${CFG.mundos} · ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
    pinta(A, nombre);
    if (HC.activo) console.log(HC.linea(A.hurto, { bot: nombre, variante: process.env.VAR || "base" }));
    HC.guarda(A.hurto, { bot: nombre, variante: process.env.VAR || "base" });
    if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(A));
  };
  if (np === 1) return acaba(tanda(desde, desde + N - 1));
  const { fork } = require("child_process");
  const A = nuevaCuenta();
  let faltan = np;
  const trozo = Math.ceil(N / np);
  for (let i = 0; i < np; i++) {
    const d = desde + i * trozo, n = Math.min(trozo, desde + N - d);
    const h = fork(__filename, [String(n)], { env: Object.assign({}, process.env, { DESDE: String(d), PROCESOS: "1" }) });
    h.on("message", (X) => { for (const k in X.semillas) A.semillas[k] = (A.semillas[k] || []).concat(X.semillas[k]).sort((a, b) => a - b).slice(0, 8); delete X.semillas; sumar(A, X); if (--faltan === 0) acaba(A); });
  }
})();
