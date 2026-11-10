// Prototipo de hurtar y la horca (rama claude/hurto-prototipo): lo que comparten bot.js y aplicado.js.
//   - la política: cuándo hurta el bot (HURTO=nunca|apuro|grave|hambre|siempre);
//   - las cuentas de cada tanda y la línea que se guarda (JSONL=fichero).
// No decide nada del juego: las reglas y sus palancas están en rules.js (PARAMS.hurto) y en engine.js.
//
// Políticas (el bot juega como siempre y, cuando la política dice que sí, va a hurtar en vez de pedir):
//   nunca    con las reglas de hurto puestas, no hurta (la referencia)
//   apuro    solo en necesidad extrema: sin ración para esta noche y con el cuerpo a 2 o menos
//   grave    sin ración para esta noche y con el cuerpo a 3 o menos
//   hambre   desde sexta, siempre que no tenga la ración de esta noche (con cualquier cuerpo)
//   siempre  siempre que le quepa lo hurtado: hurta en vez de pedir
// Con «ropa» (lo hurtado no es pan, es para el invierno): apuro = desde el día 8, quien no espera hoz (cuerpo a 3 o
// menos, mujer o con llaga); grave = desde el día 8, cualquiera; hambre = desde el día 9; siempre = cuanto antes.
const fs = require("fs");
module.exports = function (R, E) {
  const P = R.PARAMS, HU = P.hurto, PASO = R.MODOS.A.paso, FIN = E.FIN, FR = R.RATOS;
  const POL = process.env.HURTO || "";
  const activo = !!POL;
  const mas = (o, k, n) => { o[k] = (o[k] || 0) + (n == null ? 1 : n); };
  const salir = (l) => (E.L[l].dentro ? Math.min(...E.PUERTAS.map((g) => E.DIST[l][g] + 1)) * PASO : 0);
  const genteBase = (s, l, f) => {
    let g = E.L[l].gente[f];
    const mod = R.DIAS_SENALADOS[E.dia(s, s.dia).tipo];
    if (mod && mod[l] && mod[l][f] != null) g = mod[l][f];
    return g;
  };
  function quiere(s) {
    if (!s.conHurto || !POL || POL === "nunca") return false;
    if (HU.que === "ropa") {
      if (s.ropa) return false;
      if (POL === "siempre") return true;
      if (POL === "hambre") return s.dia >= 9;
      if (POL === "grave") return s.dia >= 8;
      if (POL === "apuro") return s.dia >= 8 && (s.cuerpo <= 3 || !E.esHombre(s) || !!s.llaga);
      return false;
    }
    if (s.pan + HU.gana > P.panMax) return false; // no le cabe
    if (POL === "siempre") return true;
    if (POL === "hambre") return s.pan < 2 && s.t >= 2 * FR;
    if (POL === "grave") return s.pan < 2 && s.cuerpo <= 3;
    if (POL === "apuro") return s.pan < 2 && s.cuerpo <= 2;
    return false;
  }
  // el sitio donde antes puede hurtar, dejando tiempo para salir de la muralla después
  function destino(s) {
    let best = null;
    for (const [l, frs] of Object.entries(HU.donde[HU.que])) {
      if ((s.hurtadoHoy || []).includes(l)) continue;
      let tb = s.t + E.DIST[s.lugar][l] * PASO;
      while (tb < FIN) {
        const f = E.franja(tb);
        if (frs.includes(f) && (HU.que !== "hogaza" || genteBase(s, l, f) >= 2)) break;
        tb = (Math.floor(tb / FR) + 1) * FR;
      }
      if (tb + HU.ratos + salir(l) > FIN) continue;
      if (!best || tb < best.tb) best = { l, tb };
    }
    return best;
  }
  // la jugada del bot si le toca hurtar o ir a hurtar; null si sigue con lo suyo
  function decidir(s) {
    // si le buscan y se puede restituir (palanca sagrado), en cuanto tiene con qué va a San Esteban y devuelve
    const SG = HU.sagrado;
    if (s.conHurto && SG && s.buscado && s.pan >= SG.devuelve && E.L[s.lugar].dentro) {
      if (E.puedeRestituir(s)) return { a: "restituir" };
      if (s.lugar !== SG.lugar && s.t + E.DIST[s.lugar][SG.lugar] * PASO + SG.ratos + salir(SG.lugar) <= FIN) {
        let sig = null;
        for (const v of E.VECINOS[s.lugar]) if (sig === null || E.DIST[v][SG.lugar] < E.DIST[sig][SG.lugar]) sig = v;
        return { a: "mover", d: sig };
      }
    }
    if (!quiere(s)) return null;
    if (E.rondaEnTuZona(s)) return null; // con la ronda delante, no
    if (E.puedeHurtar(s) && !(s.hurtadoHoy || []).includes(s.lugar)) return { a: "hurtar" }; // no repite sitio el mismo día
    const d = destino(s);
    if (!d) return null;
    if (d.l === s.lugar) return { a: "esperar" };
    let sig = null;
    for (const v of E.VECINOS[s.lugar]) if (sig === null || E.DIST[v][d.l] < E.DIST[sig][d.l]) sig = v;
    return { a: "mover", d: sig };
  }
  function hacer(s, j) {
    if (j.a === "hurtar") return E.hurtar(s);
    if (j.a === "restituir") return E.restituir(s);
    if (j.a === "mover") return E.mover(s, j.d);
    return E.esperar(s);
  }

  // ------------------------------------------------------------------ cuentas
  const ULT = R.VERANOS[R.VERANOS.length - 1].anio;
  const LLEGA = ["siega", "aguanta", "espiga"];
  const nueva = () => ({ n: 0, fin: {}, hasta: {}, visto: {}, pena: {}, motivo: {}, vidas: {}, tuyos: {}, penaAnio: {}, hurtoAnio: {} });
  function cuenta(A, s) {
    mas(A, "n");
    const t = s.final.tipo;
    mas(A.fin, t);
    if (LLEGA.includes(t)) { mas(A, "llega"); mas(A, "cuerpoLlega", s.cuerpo); }
    if (t === "siega") mas(A, "hoz");
    let dias = 0, pan = 0, panH = 0, det = 0;
    for (const d of s.porDia) { dias++; pan += (d.panPedido || 0) + (d.panTrabajo || 0) + (d.panHurtado || 0); panH += d.panHurtado || 0; }
    mas(A, "dias", dias); mas(A, "pan", pan); mas(A, "panHurtado", panH);
    let h = 0;
    for (const c of s.cronica) {
      if (c.tipo === "hurto") { h++; mas(A.visto, c.visto); mas(A.hurtoAnio, c.anio); }
      else if (c.tipo === "prendido") { mas(A, "prendidos"); mas(A.pena, c.pena); mas(A.motivo, c.motivo.startsWith("hurtando") ? "en el acto" : "buscado"); mas(A.penaAnio, `${c.anio}|${c.pena}`); }
      else if (c.tipo === "detenido") det++;
      else if (c.tipo === "restituye") mas(A, "restituye");
    }
    mas(A, "hurtos", h); mas(A, "detenciones", det);
    if (h) mas(A, "conHurto");
    if (s.oreja) mas(A, "orejaFinal");
    if (s.buscado) mas(A, "buscadoFinal");
    if (s.malsinado && s.malsinado.hurto) mas(A, "malsinadoHurto");
    for (const tu of s.tuyos || []) { mas(A.tuyos, tu.estado); if (tu.oreja) mas(A.tuyos, "oreja"); if (tu.hurtos) mas(A.tuyos, "prendidos", tu.hurtos); }
    if (s.conCadena) {
      const fc = s.final.cadena || { hasta: s.anio };
      mas(A.hasta, fc.hasta);
      if (LLEGA.includes(t) && fc.hasta === ULT) mas(A, "completa");
      if (fc.hasta === ULT) mas(A, "gente");
      for (const v of s.cadena.vidas) mas(A.vidas, v.tipo);
      mas(A, "nVidas", s.cadena.vidas.length + (LLEGA.includes(t) ? 1 : 0));
      if (t === "ahorcado") mas(A, "cadenaAcabaEnHorca");
    }
  }
  const pc = (x, n) => (n ? Math.round((1000 * (x || 0)) / n) / 10 : 0);
  // lo que se guarda de una tanda
  function registro(A, extra) {
    const N = A.n || 1, H = A.hurtos || 0;
    const r = Object.assign({ n: A.n, politica: POL || "sin hurto", cadena: !!process.env.CADENA, sexo: process.env.SEXO || "hombre", tuyos: !!process.env.TUYOS || !!process.env.CADENA, dar: process.env.DAR || "", escenario: process.env.ESC || "" }, extra, {
      llega: pc(A.llega, N), hoz: pc(A.hoz, N),
      hambre: pc(A.fin.hambre, N), destierro: pc(A.fin.desterrado, N), azotes: pc(A.fin.muerto, N), galeras: pc(A.fin.galeras, N), ahorcado: pc(A.fin.ahorcado, N),
      cuerpoLlega: A.llega ? +(A.cuerpoLlega / A.llega).toFixed(2) : null,
      panDia: +(A.pan / (A.dias || 1)).toFixed(2), panHurtadoDia: +((A.panHurtado || 0) / (A.dias || 1)).toFixed(2),
      hurtosPartida: +(H / N).toFixed(2), partidasConHurto: pc(A.conHurto, N),
      limpio: pc(A.visto.no, H), huye: pc(A.visto.huye, H), cogido: pc((A.visto.prendido || 0) + (A.visto.ronda || 0), H),
      prendidosPartida: +((A.prendidos || 0) / N).toFixed(3), prendidoBuscado: +((A.motivo.buscado || 0) / N).toFixed(3),
      penas: Object.fromEntries(Object.entries(A.pena).map(([k, v]) => [k, +(v / N).toFixed(3)])),
      detencionesPartida: +((A.detenciones || 0) / N).toFixed(2),
      orejaFinal: pc(A.orejaFinal, N), malsinadoHurto: pc(A.malsinadoHurto, N), restituyePartida: +((A.restituye || 0) / N).toFixed(3),
      tuyos: Object.fromEntries(Object.entries(A.tuyos).map(([k, v]) => [k, +(v / N).toFixed(3)])),
    });
    if (process.env.CADENA) Object.assign(r, {
      completa: pc(A.completa, N), gente: pc(A.gente, N), hasta: Object.fromEntries(Object.entries(A.hasta).map(([k, v]) => [k, pc(v, N)])),
      vidas: Object.fromEntries(Object.entries(A.vidas).map(([k, v]) => [k, +(v / N).toFixed(3)])), vidasCadena: +((A.nVidas || 0) / N).toFixed(2),
      cadenaAcabaEnHorca: pc(A.cadenaAcabaEnHorca, N),
      penaAnio: Object.fromEntries(Object.entries(A.penaAnio).map(([k, v]) => [k, +(v / N).toFixed(3)])),
      hurtoAnio: Object.fromEntries(Object.entries(A.hurtoAnio).map(([k, v]) => [k, +(v / N).toFixed(2)])),
    });
    return r;
  }
  function linea(A, extra) {
    const r = registro(A, extra);
    const penas = Object.entries(r.penas).map(([k, v]) => `${k} ${v}`).join(", ") || "ninguna";
    let t = `         HURTO (${r.politica}): llega ${r.llega} % (con hoz ${r.hoz} %) · hambre ${r.hambre} · destierro ${r.destierro} · azotes ${r.azotes} · galeras ${r.galeras} · ahorcado ${r.ahorcado} · pan/día ${r.panDia} (hurtado ${r.panHurtadoDia})`
      + `\n         hurtos por partida ${r.hurtosPartida} (hurta alguna vez el ${r.partidasConHurto} %): nadie le ve ${r.limpio} %, le ven y escapa ${r.huye} %, le cogen ${r.cogido} % · prendido por ladrón ${r.prendidosPartida} por partida (${r.prendidoBuscado} porque le buscaban) · penas por partida: ${penas} · acaba desorejado ${r.orejaFinal} %`;
    if (r.cadena) t += `\n         cadena: completa ${r.completa} % · su gente llega a ${ULT} ${r.gente} % · la cadena se acaba en la horca ${r.cadenaAcabaEnHorca} % · vidas: ${Object.entries(r.vidas).map(([k, v]) => `${k} ${v}`).join(", ")}`;
    return t;
  }
  function guarda(A, extra) {
    if (!process.env.JSONL) return;
    fs.appendFileSync(process.env.JSONL, JSON.stringify(registro(A, extra)) + "\n");
  }
  return { POL, activo, quiere, destino, decidir, hacer, nueva, cuenta, registro, linea, guarda };
};
