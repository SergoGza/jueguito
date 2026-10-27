// Simulación masiva del motor: invariantes y equilibrio aproximado.
const path = require("path").join(__dirname, "..") + "/";
globalThis.RULES = require(path + "rules.js");
const E = require(path + "engine.js");
const R = globalThis.RULES;
const P = R.PARAMS;

function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
function mkRnd(seed) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function check(s, where) {
  const bad = [];
  if (s.cuerpo < 0 || s.cuerpo > 10) bad.push("cuerpo " + s.cuerpo);
  if (s.monedas < 0) bad.push("monedas " + s.monedas);
  if (s.raciones < 0) bad.push("raciones " + s.raciones);
  if (s.termo < -3 || s.termo > 3) bad.push("termo " + s.termo);
  if (s.tb < 0 || s.tb > P.tbMax) bad.push("tb " + s.tb);
  if (s.rumores < 0) bad.push("rumores " + s.rumores);
  if (!s.detenciones && s.termo > P.techoSinDetencion) bad.push("termo " + s.termo + " sin detención previa");
  if (s.nino && (s.nino.cuerpo < 0 || s.nino.cuerpo > P.ninoMax)) bad.push("niño " + s.nino.cuerpo);
  if (s.nino && s.nino.perdido && s.nino.con) bad.push("niño perdido y con alguien");
  if (s.termo === -2 && E.pj(s).forastero) bad.push("forastero con licencia");
  if (s.termo === -2 && !s._examen) bad.push("licencia sin examen");
  if (bad.length) throw new Error(where + ": " + bad.join(", "));
}

// valor esperado de riesgo de una acción en un sitio (heurística prudente)
function riesgo(s, sid, acc) {
  const pv = E.previewTestigos(s, sid, acc);
  if (!pv) return { t: 0, tb: 0, det: 0 };
  const g = E.grupoEfecto(s, sid, acc);
  let t = 0, tb = 0, det = 0;
  pv.forEach((f) => {
    const ef = R.EFECTOS[g][R.CATEGORIA[f.testigo]];
    t += (ef.t * f.caras.length) / 6; tb += (ef.tb * f.caras.length) / 6;
    if (acc === "hurtar" && R.CATEGORIA[f.testigo] === "Autoridad") det += f.caras.length / 6;
  });
  return { t, tb, det };
}

function jugar(personaje, seed, politica) {
  const rnd = mkRnd(seed * 7 + 3);
  const s = E.nuevaPartida({ jugador: "sim", personaje, seed });
  let pasos = 0;
  while (!s.final) {
    if (++pasos > 500) throw new Error("bucle infinito en fase " + s.fase);
    check(s, "fase " + s.fase + " día " + s.dia);
    if (s.fase === "amanecer") {
      if (s.hoy.favor && !s.hoy.favor.respondido) E.responderFavor(s, politica === "azar" ? rnd() < 0.5 : s.raciones >= 2);
      if (!s.hoy.forzado && s.dados.length > 1) {
        const best = s.dados.map((d, i) => [d.v, i]).sort((a, b) => b[0] - a[0])[0];
        // FINGIR: nunca (por defecto: fingir sale a cuenta casi nunca), auto (el mozo, con 5+), siempre, o un número (finge si su mejor dado llega a ese valor)
        const F = process.env.FINGIR || "nunca";
        const quiere = politica === "azar" ? rnd() < 0.3 : F === "nunca" ? false : F === "siempre" ? true : F === "auto" ? (E.pj(s).forastero && !E.pj(s).impedido && best[0] >= 5) : best[0] >= +F;
        if (quiere) E.fingir(s, best[1], E.pj(s).tretaOficio || pick(R.TRETAS, rnd).nombre);
      }
      if (s.nino && !s.nino.perdido) {
        const cuid = E.puedeCuidar(s);
        if (politica === "azar") {
          if (E.ninoConmigo(s) && cuid.length && rnd() < 0.2) E.dejarNino(s, pick(cuid, rnd).id);
          else if (s.nino.con && rnd() < 0.3) E.recogerNino(s);
        } else {
          if (E.ninoConmigo(s) && cuid.length && s.tb >= 4) E.dejarNino(s, cuid.sort((a, b) => b.rel - a.rel)[0].id);
          else if (s.nino.con && s.tb <= 2) E.recogerNino(s);
        }
      }
      E.empezarFranjas(s);
    } else if (s.fase === "franja") {
      const libres = s.dados.map((d, i) => [d, i]).filter(([d]) => !d.usado);
      const sitios = E.sitiosDisponibles(s).filter((x) => x.ok);
      let opciones = [];
      sitios.forEach((st) => E.accionesEn(s, st.id).filter((a) => a.ok).forEach((a) => opciones.push({ sitio: st.id, accion: a.id, a })));
      if (!opciones.length || (politica === "azar" && rnd() < 0.1)) { E.pasarFranja(s); continue; }
      let el;
      if (politica === "azar") {
        el = pick(opciones, rnd);
      } else {
        // prudente: puntúa ganancia esperada menos riesgo
        const vmax = libres.length ? Math.max(...libres.map(([d]) => d.v)) : 0;
        let best = null, bs = -1e9;
        opciones.forEach((op) => {
          const r = riesgo(s, op.sitio, op.accion);
          let g = 0;
          const fr = E.sitio(op.sitio).franjas[s.franja];
          if (op.accion === "pedir") g = fr.pedirDa === "racion" ? (vmax >= fr.umbral ? 2.5 : 0) : E.monedasPedir(s, op.sitio, vmax);
          if (op.accion === "trabajar") g = vmax + E.pj(s).modJornal >= P.jornalUmbral ? 3 : 0;
          if (op.accion === "lavar") g = vmax >= P.lavarUmbral ? 2 : 0;
          if (op.accion === "hurtar") g = 2.5 - r.det * 20;
          if (op.accion === "descansar") g = s.cuerpo < 9 && vmax >= P.descansarUmbral ? 1.5 : 0;
          if (op.accion === "curarse") g = s.cuerpo <= 2 || E.licencia(s) ? -50 : s.cuerpo <= 6 && vmax >= P.curarUmbral ? 2 : 0;
          if (op.accion === "examen") g = 6;
          if (op.accion === "preguntar") g = vmax >= P.preguntarUmbral ? 0.8 : 0;
          if (op.accion === "compartir") g = s.raciones > 1 ? 0.6 : -1;
          if (op.accion === "delatar") g = 1;
          if (op.accion === "cruzar") g = s.fuera ? 1 : -1;
          const peso = s.tb >= 4 ? 4 : s.tb >= 2 ? 2 : 1;
          const sc = g - r.t * (s.termo >= 1 ? 2 : 1) - r.tb * peso;
          if (sc > bs) { bs = sc; best = op; }
        });
        if (bs <= 0.2 && !(best && best.accion === "cruzar" && s.fuera)) { E.pasarFranja(s); continue; }
        el = best;
      }
      const ac = el.a;
      let dado = null;
      if (ac.dado) {
        dado = politica === "azar" ? pick(libres, rnd)[1] : libres.sort((a, b) => b[0].v - a[0].v)[0][1];
      }
      const eleccion = { sitio: el.sitio, accion: el.accion, dado, contacto: ac.red ? (el.accion === "delatar" ? pick(E.contactosDisponibles(s), rnd).id : (E.contactosDisponibles(s).length && rnd() < 0.7 ? pick(E.contactosDisponibles(s), rnd).id : "nuevo")) : null };
      const rolls = E.tirar(s, eleccion);
      let o = E.resolver(s, eleccion, rolls);
      if (s.rumores > 0 && o.testigo && (o.dTB > 0 || o.dT > 0)) { E.gastarRumor(s); rolls.w = E.d6(s); o = E.resolver(s, eleccion, rolls); eleccion.rumorGastado = true; }
      if (el.accion === "examen" && o.fijarT === -2) s._examen = true;
      E.aplicar(s, eleccion, o);
      if (s.termo !== -2) s._examen = false;
    } else if (s.fase === "castigo") {
      E.aplicarCastigo(s, rnd() < 0.5 ? "marca" : "trabajo");
      if (s.termo !== -2) s._examen = false;
    } else if (s.fase === "noche") {
      if (!s.hoy.forzado) { s._dados = (s._dados || 0) + s.dados.length; s._sinUsar = (s._sinUsar || []).concat(s.dados.filter((d) => !d.usado).map((d) => d.v)); }
      const ops = E.opcionesNoche(s).filter((x) => x.ok);
      let op;
      if (politica === "azar") op = pick(ops, rnd);
      else op = ops.filter((x) => !x.peligro).sort((a, b) => (b.c - b.coste * 0.3 - b.riesgo * 0.5) - (a.c - a.coste * 0.3 - a.riesgo * 0.5))[0] || ops[0];
      const pan = E.precioPan(s);
      const nec = E.racionesNecesarias(s);
      const falta = Math.max(0, nec + (s.nino && s.nino.con ? 1 : 0) - s.raciones);
      const compra = Math.min(falta + (politica === "azar" ? 0 : (s.monedas - op.coste >= pan * (falta + 2) ? 1 : 0)), Math.floor((s.monedas - op.coste) / pan));
      const comeNino = politica === "azar" ? rnd() < 0.5 : politica === "egoista" ? false : (s.nino ? s.nino.cuerpo <= 2 || s.cuerpo >= 5 : true);
      E.dormir(s, { dormir: op.id, compra: Math.max(0, compra), comeNino });
      if (s.termo !== -2) s._examen = false;
    } else if (s.fase === "autoridad") {
      E.siguienteDia(s);
      if (s.termo !== -2) s._examen = false;
    } else throw new Error("fase desconocida " + s.fase);
  }
  check(s, "final");
  const txt = E.informe(s);
  if (!txt.includes("DATOS PARA ANALIZAR")) throw new Error("informe");
  return s;
}

const N = +process.argv[2] || 2000;
for (const politica of ["azar", "prudente"]) {
  console.log(`\n=== política: ${politica} (${N} partidas por personaje) ===`);
  for (const p of R.PERSONAJES) {
    const fin = {}; let dias = 0, monedas = 0, detenc = 0, ac = 0, cuerpoFin = 0, sobrevivenMon = 0, nSob = 0, red = 0, ninoPerd = 0, ninoCon = 0;
    for (let i = 0; i < N; i++) {
      const s = jugar(p.id, i + 1, politica);
      fin[s.final.tipo] = (fin[s.final.tipo] || 0) + 1;
      dias += s.final.dia;
      detenc += s.diario.filter((d) => d.castigo).length;
      ac += s.final.acompanado ? 1 : 0;
      red += s.contactos.filter((c) => !c.estado).length;
      if (s.nino) { if (s.nino.perdido) ninoPerd++; else if (s.nino.con) ninoCon++; }
      if (s.final.tipo === "Sobrevive") { nSob++; cuerpoFin += s.cuerpo; sobrevivenMon += s.monedas; }
    }
    const pct = (k) => ((100 * (fin[k] || 0)) / N).toFixed(0) + "%";
    console.log(`${p.nombre.padEnd(28)} sobrevive ${pct("Sobrevive")} · horca ${pct("Horca")} · muerte ${pct("Muerte")} · recogido ${pct("Recogido")} · día medio ${(dias / N).toFixed(1)} · detenciones/partida ${(detenc / N).toFixed(2)} · acompañado ${((100 * ac) / N).toFixed(0)}% · red viva ${(red / N).toFixed(1)}${nSob ? ` · al sobrevivir: cuerpo ${(cuerpoFin / nSob).toFixed(1)}, monedas ${(sobrevivenMon / nSob).toFixed(1)}` : ""}${p.nino ? ` · niño perdido ${((100 * ninoPerd) / N).toFixed(0)}%, con otra persona ${((100 * ninoCon) / N).toFixed(0)}%` : ""}`);
  }
}
