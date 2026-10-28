// El bot de las simulaciones. Lo usan sim.js, calib.js, ingresos.js, ninostats.js y dados.js.
// Políticas: "azar" (elige al azar), "prudente" (ganancia esperada menos riesgo) y "egoista" (prudente que nunca da de comer al niño).
// BOT=viejo reproduce el bot de la v0.3b, con sus dos fallos (probar el examen con cualquier dado y «trabajar» sin que le
// contraten solo para que le vean) y gastando siempre el dado más alto. (Con las reglas de la v0.4 ya no da las cifras de
// la v0.3b, porque las reglas han cambiado; sirve para comparar bots sobre las mismas reglas.)
// RED=no hace que el bot no se junte con nadie y DELATAR=no, que no delate nunca (para medir cuánto aporta cada cosa).
// LISTA=no hace que no entre nunca en la lista de pobres (v0.4b); por defecto entra si puede.
// Ganchos opcionales (cuarto argumento de jugar) para medir sin copiar el bot: amanecer(s), treta(s, v),
// franja({ s, libres, opciones, vmax, best, bs }), accion({ s, el, dado, v, o }), finFranjas(s).
module.exports = (E, R) => { const P = R.PARAMS;
const VIEJO = process.env.BOT === "viejo";
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
  if (!pv) return { t: 0, tb: 0, det: 0, alg: 0, ben: 0 };
  const g = E.grupoEfecto(s, sid, acc);
  let t = 0, tb = 0, det = 0, alg = 0, ben = 0;
  pv.forEach((f) => {
    const ef = R.EFECTOS[g][R.CATEGORIA[f.testigo]];
    t += (ef.t * f.caras.length) / 6; tb += (ef.tb * f.caras.length) / 6;
    if (R.CATEGORIA[f.testigo] === "Autoridad") { alg += f.caras.length / 6; if (acc === "hurtar") det += f.caras.length / 6; }
    if (R.CATEGORIA[f.testigo] === "Beneficencia") ben += f.caras.length / 6;
  });
  return { t, tb, det, alg, ben };
}

// con quién se junta el bot: con quien más relación tiene de su lado de la muralla (para llegar pronto a 2, que da techo);
// si no tiene a nadie así, con alguien nuevo
function contactoRed(s) {
  const lado = s.fuera ? "fuera" : "dentro";
  const cs = E.contactosDisponibles(s).filter((c) => c.lado === lado && c.rel < 4).sort((a, b) => b.rel - a.rel);
  return cs.length ? cs[0] : null;
}
// valor de subir la relación con c (null = alguien nuevo) menos el riesgo de dejarle señalado esa noche
function valorRed(s, op, c, r) {
  if (process.env.RED === "no") return -1;
  const rel = c ? c.rel : 0;
  const lado = c ? c.lado : op.sitio === "puente" ? "fuera" : "dentro";
  let val = rel <= 1 ? 1.5 : rel === 2 ? 0.8 : 0.3; // con 2, techo cada noche; con 3, pan si te falta
  if (lado !== (s.fuera ? "fuera" : "dentro")) val *= 0.4; // no podrá dormir con esa persona
  if (s.dia >= R.CALENDARIO.length) val *= 0.3; // último día: la relación ya casi no sirve
  const peso = s.tb >= 4 ? 4 : s.tb >= 2 ? 2 : 1;
  const pVende = Math.max(0, P.interrogaBase - (rel + 1)) / 6;
  const pInterroga = (s.dia >= P.escaladaDesde ? 2 : 1) / 6 + r.alg; // al azar, o seguro si os ve un alguacil
  return val - Math.min(1, pInterroga) * pVende * 2 * peso;
}

// lo que vale seguir en la lista: la ración de esta noche (si aún no te han borrado) y las de los días que tardarías en volver
function valorLista(s) { return E.precioPan(s) * Math.min(3, R.CALENDARIO.length - s.dia + 1); }

// lo que el bot espera sacar de una acción con el dado v (en monedas o su equivalente)
function ganancia(s, op, v, r) {
  const fr = E.sitio(op.sitio).franjas[s.franja];
  switch (op.accion) {
    case "pedir": {
      const g = fr.pedirDa === "racion" ? (v >= fr.umbral ? 2.5 : 0) : E.monedasPedir(s, op.sitio, v);
      // en la lista, pedir es una apuesta: si te ven la beneficencia, el cura o un alguacil, te borran
      return E.licencia(s) && !VIEJO ? g - (r.ben + r.alg) * valorLista(s) : g;
    }
    case "cumplir": return s.hoy.cumplido ? -1 : E.precioPan(s);
    case "trabajar": return v + E.pj(s).modJornal >= P.jornalUmbral ? 3 : 0;
    case "lavar": return v >= P.lavarUmbral ? 2 : 0;
    case "hurtar": return 2.5 - r.det * 20;
    case "descansar": return s.cuerpo < 9 && v >= P.descansarUmbral ? 1.5 : 0;
    case "curarse": return s.cuerpo <= 2 || E.licencia(s) ? -50 : s.cuerpo <= 6 && v >= P.curarUmbral ? 2 : 0;
    case "examen": return process.env.LISTA === "no" ? -1 : VIEJO || v >= (E.pj(s).difExamen || 99) ? 6 : -1;
    case "juntarse": return valorRed(s, op, op.contacto, r);
    case "compartir": return s.raciones > 1 ? 0.6 : -1;
    case "delatar": {
      if (process.env.DELATAR === "no") return -1;
      if (VIEJO) return 1;
      // 2 monedas, menos lo que vale la persona que pierdes: a quien da techo o pan no se le vende
      const c = op.contacto;
      return !c ? -1 : 1 - (c.rel >= 2 ? 1.5 : c.rel === 1 ? 0.4 : 0);
    }
    case "cruzar": return s.fuera ? 1 : -1;
  }
  return 0;
}

// lo que de verdad da la acción con el dado v: sirve para gastar el dado más bajo que rinde lo mismo que el más alto
function rinde(s, op, v) {
  const fr = E.sitio(op.sitio).franjas[s.franja];
  switch (op.accion) {
    case "pedir": return fr.pedirDa === "racion" ? (v >= fr.umbral ? 1 : 0) : E.monedasPedir(s, op.sitio, v);
    case "trabajar": return v + E.pj(s).modJornal >= P.jornalUmbral ? 1 : 0;
    case "lavar": return v >= P.lavarUmbral ? 1 : 0;
    case "hurtar": { const ev = Math.min(6, v + (E.modsDe(s.dia, op.sitio, s.franja).modHurtar || 0)); return R.HURTAR_DADO[ev - 1]; }
    case "descansar": return v >= P.descansarUmbral ? 1 : 0;
    case "curarse": return v >= P.curarUmbral ? 1 : 0;
    case "examen": return v >= (E.pj(s).difExamen || 99) ? 1 : 0;
    default: return 1; // juntarse, compartir, delatar y cumplir: el bot gasta el dado más bajo
  }
}

function jugar(personaje, seed, politica, hooks) {
  const H = hooks || {};
  const rnd = mkRnd(seed * 7 + 3);
  const s = E.nuevaPartida({ jugador: "sim", personaje, seed });
  let pasos = 0, enFranjas = false;
  while (!s.final) {
    if (++pasos > 500) throw new Error("bucle infinito en fase " + s.fase);
    check(s, "fase " + s.fase + " día " + s.dia);
    if (enFranjas && s.fase !== "franja") { enFranjas = false; if (H.finFranjas) H.finFranjas(s); }
    if (s.fase === "amanecer") {
      if (s.hoy.favor && !s.hoy.favor.respondido) E.responderFavor(s, politica === "azar" ? rnd() < 0.5 : s.raciones >= 2);
      if (!s.hoy.forzado && s.dados.length > 1) {
        const best = s.dados.map((d, i) => [d.v, i]).sort((a, b) => b[0] - a[0])[0];
        // FINGIR: nunca (por defecto: fingir sale a cuenta casi nunca), auto (el mozo, con 5+), siempre, o un número (finge si su mejor dado llega a ese valor)
        const F = process.env.FINGIR || "nunca";
        const quiere = politica === "azar" ? rnd() < 0.3 : F === "nunca" ? false : F === "siempre" ? true : F === "auto" ? (E.pj(s).forastero && !E.pj(s).impedido && best[0] >= 5) : best[0] >= +F;
        if (quiere) { E.fingir(s, best[1], E.pj(s).tretaOficio || pick(R.TRETAS, rnd).nombre); if (H.treta) H.treta(s, best[0]); }
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
      if (!s.hoy.forzado && H.amanecer) H.amanecer(s);
      E.empezarFranjas(s);
      enFranjas = s.fase === "franja";
    } else if (s.fase === "franja") {
      const libres = s.dados.map((d, i) => [d, i]).filter(([d]) => !d.usado);
      const sitios = E.sitiosDisponibles(s).filter((x) => x.ok);
      let opciones = [];
      sitios.forEach((st) => E.accionesEn(s, st.id).filter((a) => a.ok).forEach((a) => opciones.push({ sitio: st.id, accion: a.id, a })));
      const vmax = libres.length ? Math.max(...libres.map(([d]) => d.v)) : 0;
      if (!opciones.length || (politica === "azar" && rnd() < 0.1)) { if (H.franja) H.franja({ s, libres, opciones, vmax, best: null, bs: -1e9 }); E.pasarFranja(s); continue; }
      let el;
      if (politica === "azar") {
        el = pick(opciones, rnd);
        if (H.franja) H.franja({ s, libres, opciones, vmax, best: el, bs: null });
      } else {
        // prudente: puntúa ganancia esperada menos riesgo
        let best = null, bs = -1e9;
        opciones.forEach((op) => {
          if (op.accion === "juntarse") op.contacto = contactoRed(s);
          if (op.accion === "delatar" && !VIEJO) op.contacto = E.contactosDisponibles(s).filter((c) => !(s.nino && s.nino.con === c.id)).sort((a, b) => a.rel - b.rel)[0] || null;
          const r = riesgo(s, op.sitio, op.accion);
          const g = ganancia(s, op, vmax, r);
          const peso = s.tb >= 4 ? 4 : s.tb >= 2 ? 2 : 1;
          let sc = g - r.t * (s.termo >= 1 ? 2 : 1) - r.tb * peso;
          // si no te contratan, no pasa nada: quién te vea no cuenta
          if (!VIEJO && (op.accion === "trabajar" || op.accion === "lavar") && g <= 0) sc = 0;
          op.r = r; op.g = g; op.sc = sc;
          if (sc > bs) { bs = sc; best = op; }
        });
        if (H.franja) H.franja({ s, libres, opciones, vmax, best, bs });
        if (bs <= 0.2 && !(best && best.accion === "cruzar" && s.fuera)) { E.pasarFranja(s); continue; }
        el = best;
      }
      const ac = el.a;
      let dado = null;
      if (ac.dado) {
        if (politica === "azar") dado = pick(libres, rnd)[1];
        else {
          const orden = libres.slice().sort((a, b) => b[0].v - a[0].v);
          dado = orden[0][1];
          if (!VIEJO) {
            // el dado más bajo que rinde lo mismo que el más alto
            const tope = rinde(s, el, orden[0][0].v);
            for (let k = orden.length - 1; k > 0; k--) if (rinde(s, el, orden[k][0].v) >= tope) { dado = orden[k][1]; break; }
          }
        }
      }
      let contacto = null;
      if (ac.red) {
        if (el.accion === "delatar") contacto = !VIEJO && politica !== "azar" && el.contacto ? el.contacto.id : pick(E.contactosDisponibles(s), rnd).id;
        else if (el.accion === "juntarse" && politica !== "azar") contacto = el.contacto ? el.contacto.id : "nuevo";
        else contacto = E.contactosDisponibles(s).length && rnd() < 0.7 ? pick(E.contactosDisponibles(s), rnd).id : "nuevo";
      }
      const eleccion = { sitio: el.sitio, accion: el.accion, dado, contacto };
      const rolls = E.tirar(s, eleccion);
      let o = E.resolver(s, eleccion, rolls);
      if (s.rumores > 0 && o.testigo && (o.dTB > 0 || o.dT > 0)) { E.gastarRumor(s); rolls.w = E.d6(s); o = E.resolver(s, eleccion, rolls); eleccion.rumorGastado = true; }
      if (H.accion) H.accion({ s, el, dado, v: dado !== null ? s.dados[dado].v : null, o });
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
      const falta = Math.max(0, nec + (s.nino && s.nino.con ? 1 : 0) - s.raciones - E.racionLista(s));
      const compra = Math.min(falta + (politica === "azar" ? 0 : (s.monedas - op.coste >= pan * (falta + 2) ? 1 : 0)), Math.floor((s.monedas - op.coste) / pan));
      const comeNino = politica === "azar" ? rnd() < 0.5 : politica === "egoista" ? false : (s.nino ? s.nino.cuerpo <= 2 || s.cuerpo >= 5 : true);
      E.dormir(s, { dormir: op.id, compra: Math.max(0, compra), comeNino });
      if (s.termo !== -2) s._examen = false;
    } else if (s.fase === "autoridad") {
      E.siguienteDia(s);
      if (s.termo !== -2) s._examen = false;
    } else throw new Error("fase desconocida " + s.fase);
  }
  if (enFranjas && H.finFranjas) H.finFranjas(s);
  check(s, "final");
  const txt = E.informe(s);
  if (!txt.includes("DATOS PARA ANALIZAR")) throw new Error("informe");
  return s;
}

return { jugar, riesgo, ganancia, rinde, check, contactoRed }; };
