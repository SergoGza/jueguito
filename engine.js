/* Liber Vagatorum · el juguete. Motor: estado y reglas, sin pantalla.
 * El tiempo va en ratos (6 por franja, 36 por día). El mundo solo cambia al empezar cada franja: la gente, los otros
 * pobres y la ronda. Lo que ves vale para la franja en que lo ves.
 * Todo el azar sale de la semilla: el mundo (gente, pobres, ronda) es el mismo en las dos pruebas con la misma semilla;
 * las tiradas de tus acciones van aparte. */
(function () {
  const R = window.RULES;
  const P = R.PARAMS;
  const FIN = R.RATOS * R.FRANJAS.length;
  const L = Object.fromEntries(R.LUGARES.map((l) => [l.id, l]));
  const DENTRO = R.LUGARES.filter((l) => l.dentro).map((l) => l.id);
  const VECINOS = Object.fromEntries(R.LUGARES.map((l) => [l.id, []]));
  R.CAMINOS.forEach(([a, b]) => { VECINOS[a].push(b); VECINOS[b].push(a); });
  const BARRIO = Object.fromEntries(R.BARRIOS.map((b) => [b.id, b]));
  const DEL_BARRIO = Object.fromEntries(R.BARRIOS.map((b) => [b.id, R.LUGARES.filter((l) => l.barrio === b.id).map((l) => l.id)]));
  // barrios vecinos y por dónde se llega a cada uno: { barrio: [{ barrio, desde, llegada }] }
  const CRUCES = Object.fromEntries(R.BARRIOS.map((b) => [b.id, []]));
  R.CAMINOS.forEach(([a, b]) => {
    const ba = L[a].barrio, bb = L[b].barrio;
    if (ba === bb) return;
    if (!CRUCES[ba].some((c) => c.barrio === bb)) CRUCES[ba].push({ barrio: bb, desde: a, llegada: b });
    if (!CRUCES[bb].some((c) => c.barrio === ba)) CRUCES[bb].push({ barrio: ba, desde: b, llegada: a });
  });

  // ------------------------------------------------------------------ azar determinista
  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    let t = (h + 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // el primer verano usa la semilla tal cual; los siguientes de la cadena, la semilla y el año (j0.11)
  const mundo = (s, clave) => hash(`${s.semilla}${s.verano ? "|v" + s.anio : ""}|${clave}`);
  const tirar = (s, clave) => hash(`${s.semilla}|acc|${s.n++}|${clave}`);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const LL = P.llaga || {};
  const CA = P.cadena || {};
  const HU = P.hurto || {}; // hurtar y la horca (j0.12; se activa al empezar)
  const TR = P.tretas || {}; // las tretas (rama claude/tretas; se activan al empezar)
  const TT = Object.fromEntries((TR.lista || []).map((t) => [t.id, t]));
  const PR = P.presion || {}; // la ciudad se endurece (prototipo, rama claude/tretas; se activa al empezar)
  const cuerpoMax = (s) => (s.llaga ? LL.cuerpoMax : P.cuerpoMax);

  // ------------------------------------------------------------------ tiempo
  const franja = (t) => Math.min(R.FRANJAS.length - 1, Math.floor(t / R.RATOS));
  const ratoEnFranja = (t) => (t >= FIN ? R.RATOS : t % R.RATOS);
  const nombreFranja = (f) => R.FRANJAS[f].nombre;
  // cada verano tiene su calendario (j0.11); las partidas sin año son de 1545
  const VERANO = Object.fromEntries((R.VERANOS || []).map((v) => [v.anio, v]));
  // (una partida guardada antes de la j0.13 en 1552 sigue con el verano que ocupa su lugar, 1553)
  const verano = (s) => VERANO[(s && s.anio) || 1545] || (s && s.verano != null && (R.VERANOS || [])[s.verano]) || { anio: 1545, calendario: R.CALENDARIO };
  const calendario = (s) => verano(s).calendario || R.CALENDARIO;
  const dia = (s, d) => calendario(s)[(d || s.dia) - 1];
  const escasezDesde = (s) => verano(s).escasezDesde || P.escasezDesde;
  const escasez = (s, d) => d >= escasezDesde(s);
  // los rasgos de hombre y mujer van con la cadena
  const rasgos = (s) => !!s.conCadena;
  const esHombre = (s) => !s.quien || s.quien.el !== false;
  const galeras = (s, el) => rasgos(s) && el && !!verano(s).galeras;
  // jueves de mercado (j0.13): un día laborable con la plaza llena hasta nona. En Corpus no hay mercado.
  const mercado = (s, d) => { const x = dia(s, d); return !!x.mercado && x.tipo === "laborable"; };
  // los cambios de gente de ese día: los del tipo de día y, si es jueves de mercado, los del mercado
  function senalados(s, d) {
    const a = R.DIAS_SENALADOS[dia(s, d).tipo];
    return mercado(s, d) ? [a, R.DIAS_SENALADOS.mercado] : [a];
  }
  function genteDelDia(s, lugar, d, f) {
    let g = L[lugar].gente[f];
    for (const mod of senalados(s, d)) if (mod && mod[lugar] && mod[lugar][f] != null) g = mod[lugar][f];
    return g;
  }
  // el texto de un sitio ese verano (j0.13: San Esteban cambia con Soto)
  const descLugar = (s, lugar) => ((verano(s).desc || {})[lugar]) || L[lugar].desc;

  // ------------------------------------------------------------------ el mundo
  function gente(s, lugar, d, f) {
    const l = L[lugar];
    let g = genteDelDia(s, lugar, d, f);
    if (l.dentro) {
      const r = mundo(s, `gente|${d}|${f}|${lugar}`);
      if (r < 0.15) g -= 1;
      else if (r > 0.9) g += 1;
      g = clamp(g, 1, 3);
    }
    return g;
  }
  function hayPobres(s, lugar, d, f) {
    const l = L[lugar];
    if (!l.dentro) return false;
    let p = l.pobres;
    if (dia(s, d).tipo !== "laborable" && ["catedral", "sanmartin", "sanesteban"].includes(lugar)) p += 0.2;
    return mundo(s, `pobres|${d}|${f}|${lugar}`) < p;
  }
  function estado(s, lugar, d, f, excluir) {
    const g = gente(s, lugar, d, f);
    const pobres = hayPobres(s, lugar, d, f) || (!!s.conTuyos && (P.tuyos || {}).mundo !== false && tuyoPide(s, lugar, d, f, excluir));
    const da = g <= 1 ? 1 : Math.max(1, g - (pobres ? 1 : 0)); // gente que de verdad da
    const trabajo = !!L[lugar].trabajo && f === 0 && dia(s, d).tipo === "laborable";
    return { gente: g, pobres, da, trabajo };
  }

  // ------------------------------------------------------------------ la ronda
  // las costumbres de la ronda este verano: cada partida saca las suyas de la semilla (j0.9)
  // en la cadena (j0.11), desde el segundo verano las costumbres se inclinan hacia donde la ronda te vio pedir el verano
  // anterior a esas horas y hacia la puerta por la que más pasabas (s.huella)
  function recorridoVerano(s) {
    const c = R.RONDA.costumbres, h = s.huella;
    const elige = (k, fs) => {
      const r = mundo(s, `costumbre|${k}`);
      if (!h) return c[k][Math.floor(r * c[k].length)];
      const w = c[k].map((l) => 1 + (CA.reaccion || 0) * (k === "cierra" ? (h.puertas[l] || 0) : fs.reduce((a, f) => a + ((h.pide[f] || {})[l] || 0), 0)));
      let x = r * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return c[k][i]; }
      return c[k][c[k].length - 1];
    };
    const manana = elige("manana", [0, 1]);
    return [manana, manana, null, elige("nona", [3]), elige("visperas", [4]), elige("cierra", [])];
  }
  function circuitoDia(s, d) {
    // partidas empezadas antes de la j0.9 siguen con el recorrido fijo
    if (!s.circuito) s.circuito = s.v === R.version ? recorridoVerano(s) : R.RONDA.circuitoAntiguo.slice();
    if (dia(s, d).tipo !== "corpus") return s.circuito;
    return R.RONDA.circuitoCorpus.map((l, f) => (f === 5 ? s.circuito[5] : l));
  }
  function rondaFranja(s, d, f) {
    const k = `${d}|${f}`;
    if (k in s.rondas) return s.rondas[k];
    const circ = circuitoDia(s, d)[f];
    let max = 0, donde = null, cuando = -1;
    for (const [l, n] of Object.entries(s.avisos)) {
      const tl = s.avisosT[l] || 0;
      if (n > max || (n === max && n > 0 && tl > cuando)) { max = n; donde = l; cuando = tl; }
    }
    // la ronda aprende: donde te han visto pedir a esta misma hora en varios días, vuelve
    const ap = R.RONDA.aprende;
    let aprendido = null, nmax = 0, quien = null, contado = false;
    if (ap) {
      const gente_ = [{ q: "tú", h: s.habitos }].concat((s.tuyos || []).filter((tu) => tu.estado === "vive").map((tu) => ({ q: tu.id, h: tu.habitos })));
      for (const { q, h } of gente_) for (const [l, dias] of Object.entries((h || {})[f] || {})) if (dias.length >= ap.minDias && dias.length > nmax) { nmax = dias.length; aprendido = l; quien = q; contado = dias.includes(-1); }
    }
    let pos, porque;
    if (donde && mundo(s, `rondaP|${k}`) < R.RONDA.persigue[Math.min(3, max)]) { pos = donde; porque = "aviso"; }
    else if (circ === null) { pos = null; porque = "come"; }
    else if (aprendido && mundo(s, `rondaA|${k}`) < ap.prob) { pos = aprendido; porque = "aprendido"; }
    else if (mundo(s, `rondaD|${k}`) < R.RONDA.desvio) { pos = DENTRO[Math.floor(mundo(s, `rondaL|${k}`) * DENTRO.length)]; porque = "desvío"; }
    else { pos = circ; porque = "recorrido"; }
    s.rondas[k] = pos;
    s.rondasPorque[k] = porque;
    if (porque === "aprendido") { (s.rondasQuien = s.rondasQuien || {})[k] = quien; if (contado) (s.rondasContado = s.rondasContado || {})[k] = true; }
    return pos;
  }
  // quedan quejas en un sitio en el que tú no has pedido hoy: alguien (uno de los tuyos) pidió ahí hace poco
  const hayQuejas = (s, l) => (s.avisos[l] || 0) > 0 && !s.pedidoHoy.some((p) => p.lugar === l);
  // la ronda estaba ahí por una costumbre tuya (no de los tuyos)
  const esTuCostumbre = (s, k) => s.rondasPorque[k] === "aprendido" && ((s.rondasQuien || {})[k] || "tú") === "tú";
  const rondaAhora = (s) => (s.t >= FIN ? null : s.rondas[`${s.dia}|${franja(s.t)}`]);

  // ------------------------------------------------------------------ lo que ves
  const zonaDe = (s, lugar) => (R.MODOS[s.modo].zona === "barrio" ? L[lugar].barrio : lugar);
  const lugaresZona = (s, z) => (R.MODOS[s.modo].zona === "barrio" ? DEL_BARRIO[z] : [z]);
  function rondaEnTuZona(s) {
    const r = rondaAhora(s);
    return r && zonaDe(s, r) === zonaDe(s, s.lugar) ? r : null;
  }
  function observar(s) {
    if (s.t >= FIN) return;
    const f = franja(s.t), r = rondaAhora(s);
    const zona = lugaresZona(s, zonaDe(s, s.lugar));
    if (r && zona.includes(r)) {
      s.vistas = s.vistas || [];
      if (!s.vistas.some((v) => v.dia === s.dia && v.f === f)) s.vistas.push({ dia: s.dia, f, lugar: r });
    }
    for (const id of zona) {
      const e = estado(s, id, s.dia, f);
      s.memoria[id] = { dia: s.dia, f, gente: e.gente, pobres: e.pobres, da: e.da, trabajo: e.trabajo, ronda: r === id };
    }
    s.hoy.lugares[s.lugar] = 1;
  }
  function edad(s, m) {
    if (!m) return { txt: "sin ver", nivel: 3 };
    if (m.dia === s.dia && m.f === franja(s.t) && s.t < FIN) return { txt: "en esta franja", nivel: 0 };
    if (m.dia === s.dia) return { txt: "a " + nombreFranja(m.f).toLowerCase(), nivel: 1 };
    if (m.dia === s.dia - 1) return { txt: "ayer a " + nombreFranja(m.f).toLowerCase(), nivel: 2 };
    return { txt: `el día ${m.dia} a ${nombreFranja(m.f).toLowerCase()}`, nivel: 2 };
  }
  const GENTE_TXT = ["nadie", "nadie que dé", "poca gente", "mucha gente"];

  // ------------------------------------------------------------------ partida
  function nueva(modo, jugador, semilla, opts) {
    const s = {
      v: R.version, modo, jugador: jugador || "", semilla: String(semilla || Math.floor(Math.random() * 1e9)), semillaFija: !!semilla,
      empezada: new Date().toISOString(),
      dia: 1, t: 0, fase: "amanecer", lugar: "ribera",
      cuerpo: P.cuerpoInicial, pan: P.panInicial, detenciones: 0, conocido: false,
      avisos: {}, avisosT: {}, rondas: {}, rondasPorque: {}, memoria: {}, pedidoHoy: [], vistas: [], recuerdaAbierto: 0,
      trabajoHoy: false, trabajoPedido: false, detenidoHoy: null, duerme: null,
      n: 0, final: null, ultimo: null, aviso: null, noche: null,
      cronica: [], hoy: null, porDia: [], encuesta: {},
      conLlaga: !!(opts && (opts.llaga || (opts.tretas && modo === "A" && !!P.tretas))), // la llaga se activa al empezar (prueba de fingir); con las tretas, también
      conTuyos: !!(opts && (opts.tuyos || opts.cadena)) && modo === "A", // los tuyos se activan al empezar (j0.10); solo en la prueba A
      conCadena: !!(opts && opts.cadena) && modo === "A", // varios veranos (j0.11), siempre con los tuyos
      conHurto: !!(opts && opts.hurto) && modo === "A" && !!P.hurto, // hurtar y la horca (j0.12; se activa al empezar); solo en la prueba A
      hurtos: 0, oreja: false, buscado: false, ropa: false,
      verano: 0, anio: R.VERANOS ? R.VERANOS[0].anio : 1545,
      // quién eres: el mozo de La Armuña; en la cadena, después, el heredero (los bots pueden empezar con una moza)
      quien: opts && opts.mujer ? { id: "moza", nombre: "la moza", el: false } : { id: "mozo", nombre: "el mozo", el: true },
    };
    if (s.conTuyos) s.tuyos = (TU.quienes || []).map(nuevoTuyo);
    if (s.conCadena) { s.cadena = { vidas: [], anales: [], archivo: [] }; s.quienVerano = Object.assign({}, s.quien); }
    if (opts && opts.tretas && modo === "A" && P.tretas) iniciarTretas(s); // las tretas (rama claude/tretas)
    if (opts && opts.presion && modo === "A" && P.presion) iniciarPresion(s); // la ciudad se endurece (prototipo)
    s.circuito = recorridoVerano(s);
    empezarDia(s);
    s.noche = null;
    return s;
  }
  function nuevoHoy() {
    return { mover: 0, pedir: 0, trabajar: 0, esperar: 0, perdido: 0, hurtar: 0, pasos: 0, cruces: 0, libres: 0, pedidas: 0,
      panPedido: 0, panTrabajo: 0, panHurtado: 0, hurtos: 0, encuentros: 0, paradas: 0, rondaVista: 0, lugares: {} };
  }
  function empezarDia(s) {
    s.t = 0; s.avisos = {}; s.avisosT = {}; s.pedidoHoy = []; s.trabajoHoy = false; s.trabajoPedido = false;
    s.detenidoHoy = null; s.hoy = nuevoHoy(); s.aviso = null; s.fase = "amanecer"; s.azotesHoy = 0;
    s.hurtadoHoy = []; s.penaHurto = null;
    if (s.conTretas) { s.puesta = null; s.oferta = null; s.robada = null; } // de noche te quitas el atrezo
    if (s.conPresion) presionAmanecer(s); // los corchetes nuevos de hoy
    // las señas caducan: a los tantos días dejan de buscarte (si sabías que te buscaban, te enteras al amanecer)
    s.yaNoBuscan = false;
    if (HU.buscaDias && s.buscado && s.dia - (s.buscadoDia || 0) >= HU.buscaDias) { s.buscado = false; s.yaNoBuscan = !!s.buscadoSabe; }
    if (!s.buscado) { s.buscadoSabe = false; s.buscadoPor = null; }
    if (HU.buscaDias) for (const tu of s.tuyos || []) if (tu.buscado && s.dia - (tu.buscadoDia || 0) >= HU.buscaDias) tu.buscado = false;
    rondaFranja(s, s.dia, 0);
    if (s.conTuyos) { tuyosAmanecer(s); for (const tu of s.tuyos) tuyoFranja(s, tu, s.dia, 0); s.tuyosF = 0; }
    observar(s);
  }
  function apunta(s, tipo, texto, datos) {
    s.cronica.push(Object.assign({ anio: s.anio, dia: s.dia, t: s.t, tipo, texto, lugar: s.lugar }, datos || {}));
  }
  const momentoTxt = (t) => (t >= FIN ? "noche" : `${nombreFranja(franja(t))} ${ratoEnFranja(t) + 1}/${R.RATOS}`);

  // pasa el tiempo; si te quedas quieto, ves cómo cambia la franja en tu zona
  function pasar(s, ratos, que, quieto) {
    const llegadas = [];
    for (let i = 0; i < ratos && s.t < FIN; i++) {
      s.t++;
      s.hoy[que]++;
      if (s.t % R.RATOS === 0 && s.t < FIN) {
        const f = s.t / R.RATOS;
        rondaFranja(s, s.dia, f);
        for (const l of Object.keys(s.avisos)) { s.avisos[l]--; if (s.avisos[l] <= 0) delete s.avisos[l]; }
        if (s.conTuyos) { for (const tu of s.tuyos) tuyoFranja(s, tu, s.dia, f); s.tuyosF = f; }
        if (quieto) {
          observar(s);
          const r = rondaEnTuZona(s);
          if (r) { llegadas.push(r); s.hoy.rondaVista++; }
        }
      }
    }
    return llegadas;
  }

  function guardarPan(s, n) {
    const antes = s.pan;
    s.pan = Math.min(P.panMax, s.pan + n);
    return n - (s.pan - antes); // lo que no cabe
  }

  // ------------------------------------------------------------------ qué puedes hacer
  function opciones(s) {
    const m = R.MODOS[s.modo];
    const quedan = FIN - s.t;
    const movs = [];
    if (m.zona === "lugar") {
      // con las muletas o las cadenas puestas se anda más despacio (tretas)
      const paso = m.paso + (s.conTretas ? pesaPuesta(s) : 0);
      for (const d of VECINOS[s.lugar]) {
        movs.push({ id: d, destino: d, tipo: "paso", coste: paso, ok: quedan >= paso, porque: quedan >= paso ? "" : "no te da tiempo" });
      }
    } else {
      const b = L[s.lugar].barrio;
      for (const d of DEL_BARRIO[b]) if (d !== s.lugar) movs.push({ id: d, destino: d, tipo: "libre", coste: 0, ok: true, porque: "" });
      for (const c of CRUCES[b]) {
        movs.push({ id: c.llegada, destino: c.llegada, barrio: c.barrio, tipo: "cruce", coste: m.cruce, ok: quedan >= m.cruce, porque: quedan >= m.cruce ? "" : "no te da tiempo" });
      }
    }
    const f = franja(s.t);
    const e = s.t < FIN ? estado(s, s.lugar, s.dia, f) : null;
    const acc = [];
    let porque = "";
    if (!L[s.lugar].dentro) porque = "fuera de la muralla nadie da";
    else if (!e || e.da < 2) porque = e && e.gente >= 2 && e.pobres ? "hay más pobres que gente que dé" : "aquí ahora no hay gente que dé";
    else if (quedan < R.RATOS) porque = "no te da tiempo antes de que acabe el día";
    acc.push({ id: "pedir", ok: !porque, porque, coste: R.RATOS });
    if (L[s.lugar].trabajo) {
      let pt = "";
      if (rasgos(s) && !esHombre(s)) pt = "en las obras no cogen mujeres";
      else if (!e || !e.trabajo) pt = dia(s).tipo !== "laborable" ? "hoy es fiesta: no hay obra" : "solo cogen peones a prima";
      else if (s.trabajoPedido) pt = "ya has preguntado hoy";
      acc.push({ id: "trabajo", ok: !pt, porque: pt, coste: P.trabajo.pedirRatos });
    }
    if (puedeRestituir(s)) acc.push({ id: "restituir", ok: true, porque: "", coste: HU.sagrado.ratos });
    if (s.conHurto && (dondeHurto()[s.lugar] || []).length) acc.push({ id: "hurtar", ok: puedeHurtar(s), porque: puedeHurtar(s) ? "" : "aquí ahora no hay qué coger", coste: HU.ratos });
    if (s.conTretas) for (const id of s.mazo) { const x = tretaAqui(s, id); acc.push({ id: "treta", treta: id, ok: x.ok, porque: x.porque, coste: x.coste || R.RATOS, misa: !!x.misa }); }
    acc.push({ id: "esperar", ok: quedan > 0, porque: quedan > 0 ? "" : "", coste: quedan > 0 ? R.RATOS - (s.t % R.RATOS) : 0 });
    acc.push({ id: "acabar", ok: true, porque: "", coste: quedan });
    return { movs, acc, quedan };
  }

  // lo que se sabe antes de pedir, en palabras (sin cifras)
  function previsionPedir(s) {
    const f = franja(s.t), e = estado(s, s.lugar, s.dia, f);
    const out = [];
    if (e.da >= 3) out.push("Mucha gente: suele caer algo, a veces dos pedazos.");
    else if (e.da === 2) out.push(e.pobres ? "Hay más pobres pidiendo: os repartís lo que hay. Muchas veces, nada." : "Poca gente: muchas veces, nada.");
    const r = rondaEnTuZona(s);
    if (r) {
      const salvo = e.da >= 3 ? " (con tanta gente, puede que no te vea)" : "";
      out.push(r === s.lugar ? `La ronda está aquí: si pides, te ve y te detiene${salvo}.` : `La ronda está en ${L[r].nombre} y vigila todo el barrio: si pides en cualquier sitio de él, te ve y te detiene${salvo}.`);
    }
    const a = L[s.lugar].aviso;
    if (a === 0) out.push("Aquí nadie avisa a la ronda.");
    else if (a >= 2) out.push("Aquí avisan enseguida a la ronda.");
    else out.push("Si te ven pedir, alguien puede avisar a la ronda.");
    if (s.pedidoHoy.some((p) => p.lugar === s.lugar)) out.push("Ya te han visto pedir aquí hoy.");
    else if (hayQuejas(s, s.lugar)) out.push("Hace poco han visto pedir aquí a otro.");
    if (s.t % R.RATOS !== 0) out.push("Empiezas a mitad de franja: la ronda puede llegar mientras pides.");
    // con la presión: el corchete de este sitio, ahora o a la franja siguiente (se sabe: lo pregonaron)
    if (s.conPresion && corcheteEn(s, s.lugar, f)) out.push("Aquí vigila un corchete a esta hora: si pides, te ve.");
    else if (s.conPresion && s.t % R.RATOS !== 0 && corcheteEn(s, s.lugar, f + 1)) out.push(`A ${nombreFranja(Math.min(f + 1, R.FRANJAS.length - 1)).toLowerCase()} vigila aquí un corchete: si empiezas ahora, te verá acabar.`);
    return out;
  }

  // ------------------------------------------------------------------ acciones
  function resultado(s, titulo, lineas, tono) {
    s.ultimo = { titulo, lineas, tono: tono || "neutro" };
    s.fase = "resultado";
  }

  function mover(s, destino) {
    const o = opciones(s);
    const mv = o.movs.find((x) => x.destino === destino);
    if (!mv || !mv.ok) return false;
    const zonaAntes = zonaDe(s, s.lugar);
    const desde = s.lugar, t0 = s.t;
    if (mv.tipo === "paso") s.hoy.pasos++;
    else if (mv.tipo === "cruce") s.hoy.cruces++;
    else s.hoy.libres++;
    pasar(s, mv.coste, "mover", false);
    s.lugar = destino;
    // por qué puerta pasas (j0.11: la ronda se acuerda el verano siguiente)
    const g = PUERTAS.includes(desde) && !L[destino].dentro ? desde : PUERTAS.includes(destino) && !L[desde].dentro ? destino : null;
    if (g) { const ds = ((s.salidas = s.salidas || {})[g] = s.salidas[g] || []); if (!ds.includes(s.dia)) ds.push(s.dia); }
    // con la presión: por qué puerta y a qué hora pasas (al salir, cuando dejas la puerta; al entrar, cuando llegas)
    if (g && s.conPresion) { const fc = PUERTAS.includes(desde) && !L[destino].dentro ? franja(t0) : franja(Math.min(s.t, FIN - 1)); const k = `${g}|${fc}`; s.presion.cruces[k] = (s.presion.cruces[k] || 0) + 1; }
    observar(s);
    apunta(s, "mover", `${L[desde].corto} → ${L[destino].corto}`, { coste: mv.coste, tipoMov: mv.tipo, t: t0 });
    s.aviso = null;
    if (s.t >= FIN) { s.aviso = { texto: `Llegas a ${L[destino].nombre} ya de noche.`, tono: "neutro" }; return true; }
    // con la presión, si no está la ronda puede haber un corchete vigilando aquí a esta hora
    const rr0 = rondaEnTuZona(s);
    const corch = !rr0 && !!s.conPresion && L[destino].dentro && corcheteEn(s, destino, franja(s.t));
    const r = rr0 || (corch ? destino : null);
    if (r && (corch || zonaDe(s, destino) !== zonaAntes)) {
      s.hoy.encuentros++;
      if (corch) s.hoy.corchetes = (s.hoy.corchetes || 0) + 1;
      // la llaga te protege mientras el alguacil no se haya hecho a ella (LL.protege veces; 0: siempre)
      const cubre = s.llaga && (!LL.protege || (s.llagaPasadas || 0) < LL.protege);
      // al que buscan por ladrón, la ronda lo para más (y la llaga no le tapa las señas)
      let p = s.buscado ? HU.pararBuscado : (s.conocido ? P.pararAlLlegar.conocido : P.pararAlLlegar.desconocido) * (cubre ? LL.parar : 1);
      if (s.conTretas && noTeParan(s)) p = 0; // bien vestido no pareces pobre (tretas)
      const donde = r === destino ? "aquí" : `en ${L[r].nombre}`;
      apunta(s, "encuentro", corch ? `Llega a ${L[destino].corto} y hay un corchete.` : `Llega a ${L[destino].corto} y la ronda está ${donde}.`, corch ? { corchete: true } : undefined);
      if (tirar(s, "parar") < p) {
        parar(s, r);
        // el que para es un corchete, no el alguacil (lo demás, igual)
        if (corch && s.ultimo) s.ultimo.lineas = s.ultimo.lineas.map((x) => x.replace("te para el alguacil", "te para un corchete").replace("El alguacil te reconoce", "El corchete te reconoce").replace("El alguacil se planta delante", "El corchete se planta delante"));
        return true;
      }
      if (cubre) s.llagaPasadas = (s.llagaPasadas || 0) + 1;
      s.aviso = { texto: corch ? (cubre ? "Hay un corchete aquí. Te mira la pierna y no te dice nada." : "Hay un corchete aquí, vigilando. Pasas sin que te pare.") : cubre ? `La ronda está ${donde}. El alguacil te mira la pierna y sigue su camino.` : `La ronda está ${donde}. Pasas sin que te paren.`, tono: "mal" };
    } else if (mv.tipo !== "libre") {
      s.aviso = { texto: `Llegas a ${L[destino].nombre}.`, tono: "neutro" };
    }
    return true;
  }

  // con las tretas: antes, si llevas atrezo, el alguacil puede descubrirte; después, si llevas muchas blancas, te las quita
  function parar(s, r) {
    if (s.conTretas && !s.buscado && descubrir(s, r)) return;
    pararBase(s, r);
    if (s.conTretas) registro(s);
  }
  function pararBase(s, r) {
    s.hoy.paradas++;
    const kf = `${s.dia}|${franja(s.t)}`;
    const sabia = esTuCostumbre(s, kf);
    const pierna = s.llaga && LL.protege && (s.llagaPasadas || 0) >= LL.protege;
    // lo que dice el alguacil: si ya se sabe la llaga y además te esperaba por tu costumbre, dice las dos cosas
    const contado = sabia && (s.rondasContado || {})[kf];
    const dice = pierna && sabia ? `«Otra vez tú, el de la pierna. Esa llaga ya me la sé, y ${contado ? "ya me han contado dónde pides" : "sabía que te encontraría aquí"}»`
      : pierna ? "«Otra vez tú, el de la pierna. Esa llaga ya me la sé»"
      : sabia ? (contado ? "«Ya me han contado dónde pides»" : "«Sabía que te encontraría aquí»") : null;
    // con la cadena (j0.11): a la mujer no la detiene: la echa, y si ya la conoce, la azota y la echa; al que azotaron
    // otro verano le mira la espalda (es como si le conociera); al hombre sano que no conoce lo manda a las obras sin paga
    // al que buscan por ladrón no lo para la ronda de pobres: lo prende la justicia (hombre o mujer)
    if (s.buscado) { prender(s, "le reconoce la ronda", [`En ${L[r].nombre} te para el alguacil. Te mira despacio: ${senas(s)}.`]); return; }
    const mujer = rasgos(s) && !esHombre(s);
    // la espalda azotada (con la cadena) y la oreja cortada se leen aunque no te conozcan la cara
    const espalda = !s.conocido && ((rasgos(s) && !!s.azotado) || (!!s.oreja && (HU.oreja || {}).conoce));
    if ((s.conocido || espalda) && !mujer) {
      detener(s, "parado", [espalda && s.oreja ? `En ${L[r].nombre} te para el alguacil. Te aparta el pelo y te ve la oreja: «A ti ya te ha leído la justicia». Te llevan a la cárcel.`
        : espalda ? `En ${L[r].nombre} te para el alguacil. Te levanta la camisa y te mira la espalda: «Tú ya has pasado por mis manos». Te llevan a la cárcel.`
        : pierna ? `El alguacil se planta delante: ${dice}. Te llevan a la cárcel.`
        : dice ? `El alguacil te reconoce: ${dice}. Te llevan a la cárcel.` : "El alguacil te reconoce: ya te tenían visto. Te llevan a la cárcel."]);
      return;
    }
    // con el brazo atado (tretas) te ve impedido: no te manda a las obras
    if (rasgos(s) && !mujer && !s.llaga && !(s.conTretas && s.puesta === "atado") && s.cuerpo >= (CA.obrasForzadas || 99)) { obrasForzadas(s, r, dice); return; }
    const azota = mujer && (s.conocido || espalda); // a la mujer que ya conoce, azotes (pregunta 12, opción B)
    const conocia = s.conocido;
    s.conocido = true;
    const antes = s.lugar;
    pasar(s, 3, "perdido", false);
    s.lugar = "puente";
    observar(s);
    if (azota) { s.azotesHoy = (s.azotesHoy || 0) + 1; s.azotado = true; }
    apunta(s, "echado", azota ? `Te para la ronda en ${L[antes].corto}, te azotan y te echan de la ciudad.` : `Te para la ronda en ${L[antes].corto} y te echan de la ciudad.`);
    if (azota) {
      resultado(s, "Te para la ronda", [
        conocia ? `En ${L[r].nombre} te para el alguacil y te reconoce: «¿Otra vez tú? Te dije que no volvieras».` : `En ${L[r].nombre} te para el alguacil. Te baja el cuello de la camisa y te mira la espalda: «Tú ya has pasado por mis manos».`,
        "Te azotan allí mismo, a la vista de todos, y te echan por la puerta al puente. Pierdes media franja.",
        "La espalda te arde.",
      ], "mal");
      return;
    }
    if (mujer) {
      resultado(s, "Te para la ronda", [
        dice ? `En ${L[r].nombre} te para el alguacil: ${dice}. Le dices de dónde eres y adónde vas.` : `En ${L[r].nombre} te para el alguacil. Le dices de dónde eres y adónde vas.`,
        "No te detiene: te acompaña hasta la puerta y te echa al puente. Pierdes media franja.",
        "Ya te conoce la cara.",
      ], "mal");
      return;
    }
    resultado(s, "Te para la ronda", [
      // la cuarta vez con la llaga, aunque aún no te tenga fichado, el alguacil ya se la sabe
      dice ? `En ${L[r].nombre} te para el alguacil: ${dice}. Le dices de dónde eres y adónde vas.` : `En ${L[r].nombre} te para el alguacil. Le dices de dónde eres y adónde vas.`,
      "No te detiene: te acompaña hasta la puerta y te echa al puente. Pierdes media franja.",
      "Ya te conoce la cara. Si vuelve a pararte, te lleva a la cárcel.",
    ], "mal");
  }
  // el hombre sano al que para la ronda sin conocerle: a las obras, sin paga, hasta la noche (j0.11)
  function obrasForzadas(s, r, dice) {
    s.conocido = true;
    const antes = s.lugar;
    apunta(s, "obras", `Le para la ronda en ${L[antes].corto} y le manda a las obras sin paga.`);
    s.lugar = "catedral";
    pasar(s, FIN - s.t, "perdido", false);
    s.lugar = "ribera";
    s.trabajoHoy = true; // acaba molido, como el que trabaja
    resultado(s, "Te para la ronda", [
      `En ${L[r].nombre} te para el alguacil${dice ? `: ${dice}` : ""}. Te mira los brazos: «Mozo sano y sin oficio. A las obras, que trabajo hay».`,
      "Te tienen cargando piedra en las obras de la catedral hasta completas, sin paga. Al anochecer te echan por la Puerta del Río y bajas a la ribera.",
      "Ya te conoce la cara. Si vuelve a pararte, te lleva a la cárcel.",
    ], "mal");
  }

  function detener(s, motivo, lineas) {
    s.detenciones++;
    s.conocido = true;
    s.detenidoHoy = motivo;
    const pan = s.pan;
    s.pan = 0;
    apunta(s, "detenido", `Detenido (${motivo}) en ${L[s.lugar].corto}. Detención ${s.detenciones} de ${P.detencionesMax}.`, { motivo });
    s.hoy.perdido += FIN - s.t;
    s.t = FIN;
    const extra = [];
    if (pan) extra.push(`Te quitan el pan (${pan} ${pan === 1 ? "pedazo" : "pedazos"}).`);
    if (s.conTretas) quitarTodo(s, extra);
    // desde la pragmática de 1552 (en el juego, desde el verano de 1553), al hombre lo mandan a galeras (j0.11);
    // con la vergüenza, como dice la pragmática, y a la primera (j0.13)
    if (galeras(s, esHombre(s))) { s.galeras = true; extra.push(`${s.detenciones === 1 ? "Es la primera vez que te prenden, y basta. " : ""}El alcalde no te manda azotar: a la vergüenza y cuatro años de galeras, como manda la pragmática a los vagabundos. Mañana te sacan a la vergüenza y sales con la cadena de galeotes.`); }
    else if (s.detenciones >= P.detencionesMax) extra.push(`Detención ${s.detenciones} de ${P.detencionesMax}: mañana te sacan de la ciudad con destierro.`);
    else if (s.detenciones === 2) extra.push(`Detención 2 de ${P.detencionesMax}: esta noche te azotan. A la tercera, destierro.`);
    else extra.push(`Detención 1 de ${P.detencionesMax}: pasas la noche en la cárcel y mañana te sueltan en la puerta. A la segunda, azotes; a la tercera, destierro.`);
    resultado(s, "Te detienen", lineas.concat(extra), "mal");
  }

  function pedir(s) {
    const o = opciones(s);
    const a = o.acc.find((x) => x.id === "pedir");
    if (!a || !a.ok) return false;
    const t0 = s.t, f0 = franja(t0), lugar = s.lugar;
    const e0 = estado(s, lugar, s.dia, f0);
    // con la presión, un corchete que vigila aquí a esta hora te ve como la ronda
    const c0 = !!s.conPresion && corcheteEn(s, lugar, f0);
    const r0 = rondaEnTuZona(s) || (c0 ? lugar : null);
    const aviso = L[lugar].aviso;
    const avisoPrevio = s.avisos[lugar] || 0;
    if (aviso) {
      s.avisos[lugar] = avisoPrevio + aviso; s.avisosT[lugar] = s.dia * 100 + t0;
      if (s.conPresion) sumaQueja(s, lugar, f0, aviso);
      // lo que la autoridad aprende de ti: dónde y a qué hora te han visto pedir
      s.habitos = s.habitos || {};
      const h = (s.habitos[f0] = s.habitos[f0] || {});
      const dias = (h[lugar] = h[lugar] || []);
      if (!dias.includes(s.dia)) dias.push(s.dia);
    }
    s.pedidoHoy.push({ lugar, f: f0 });
    s.hoy.pedidas++;
    const seg1 = Math.min(R.RATOS, (f0 + 1) * R.RATOS - t0), seg2 = R.RATOS - seg1;
    pasar(s, R.RATOS, "pedir", true);
    const k1 = `${s.dia}|${f0 + 1}`;
    const r1 = seg2 > 0 ? s.rondas[k1] : null;
    // si la ronda viene por el aviso que acabas de provocar, llega cuando ya terminas: no te pilla esta vez
    const porTuAviso = r1 === lugar && s.rondasPorque[k1] === "aviso" && avisoPrevio === 0;
    const c1 = !!s.conPresion && seg2 > 0 && corcheteEn(s, lugar, f0 + 1);
    const r1zona = r1 && !porTuAviso && zonaDe(s, r1) === zonaDe(s, lugar) ? r1 : c1 ? lugar : null;
    const pP = (e) => P.pillarPidiendo[e.da >= 3 ? 3 : 2] * (s.llaga ? LL.pillar : 1);
    let pillado = null;
    if (r0 && tirar(s, "pillar0") < pP(e0) * seg1 / R.RATOS) pillado = "estaba";
    if (!pillado && r1zona && tirar(s, "pillar1") < pP(estado(s, lugar, s.dia, f0 + 1)) * seg2 / R.RATOS) pillado = "llega";
    // al desorejado la gente le ve la oreja (si la palanca lo dice): le dan menos
    const tir = clamp(1 + Math.floor(tirar(s, "limosna") * 6) + (s.llaga ? LL.limosna : 0) - (s.oreja ? (HU.oreja || {}).limosna || 0 : 0), 1, 6);
    const tabla = escasez(s, s.dia) ? P.limosnaEscasez : P.limosna;
    const gana = tabla[e0.da >= 3 ? 3 : 2][tir - 1];
    if (pillado) {
      const donde = r0 && pillado === "estaba" ? r0 : r1zona;
      const corch = (pillado === "estaba" ? c0 && !rondaEnTuZona(s) : c1 && !(r1 && !porTuAviso && zonaDe(s, r1) === zonaDe(s, lugar)));
      const l1 = corch ? (pillado === "llega" ? `Estás pidiendo en ${L[lugar].nombre} cuando llega el corchete que vigila allí a esa hora. Te ve con la mano tendida.` : `Pides en ${L[lugar].nombre} delante del corchete que vigila allí. Te ve.`)
        : pillado === "llega"
        ? `Estás pidiendo en ${L[lugar].nombre} cuando aparece la ronda${donde !== lugar ? ` por ${L[donde].nombre}` : ""}. Te ve con la mano tendida.`
        : `Pides en ${L[lugar].nombre} con la ronda ${donde === lugar ? "delante" : "en el barrio"}. Te ve.`;
      apunta(s, "pillado", `Empieza a pedir en ${L[lugar].corto}. ${l1}`, { pillado, t: t0 });
      const kp = `${s.dia}|${pillado === "llega" ? f0 + 1 : f0}`;
      const lin = [l1];
      if (esTuCostumbre(s, kp)) lin.push((s.rondasContado || {})[kp] ? "«Ya me han contado dónde pides», dice el alguacil." : "«Sabía que te encontraría aquí», dice el alguacil.");
      if (s.buscado) { lin.push(`El alguacil te mira despacio: ${senas(s)}.`); prender(s, "pidiendo, le reconoce la ronda", lin); return true; }
      lin.push("Pedir está prohibido en la ciudad desde la orden de pobres.");
      detener(s, pillado === "llega" ? "pidiendo, llegó la ronda" : "pidiendo delante de la ronda", lin);
      return true;
    }
    const sobra = gana ? guardarPan(s, gana) : 0;
    s.hoy.panPedido += gana - sobra;
    const lin = [];
    if (gana === 0) lin.push(`Pides en ${L[lugar].nombre}. No te dan nada.`);
    else if (s.llaga) lin.push(`Pides en ${L[lugar].nombre} con la pierna al aire. Te dan ${gana === 1 ? "un pedazo de pan" : gana + " pedazos de pan"}, sin mirarte a la cara.`);
    else lin.push(`Pides en ${L[lugar].nombre}. Te dan ${gana === 1 ? "un pedazo de pan" : gana + " pedazos de pan"}.`);
    if (sobra) lin.push(`No te cabe todo en el hatillo: se pierde${sobra === 1 ? " un pedazo" : "n " + sobra + " pedazos"}.`);
    const rFin = rondaEnTuZona(s);
    if (r1zona && seg2 > 0) lin.push(c1 && !(r1 && !porTuAviso && zonaDe(s, r1) === zonaDe(s, lugar)) ? "Mientras pedías ha llegado el corchete que vigila aquí, pero no te ha visto." : `Mientras pedías ha llegado la ronda${r1zona !== lugar ? ` (${L[r1zona].corto})` : ""}, pero no te ha visto.`);
    else if (rFin) lin.push(`Al acabar, ves llegar a la ronda${rFin !== lugar ? ` a ${L[rFin].nombre}` : ""}.${s.rondasPorque[`${s.dia}|${franja(s.t)}`] === "aviso" && rFin === lugar ? " Alguien ha avisado." : ""}`);
    if (aviso === 0) lin.push("Nadie va a avisar.");
    else if (!rFin) lin.push(aviso >= 2 ? "Te han visto, y aquí avisan enseguida." : "Alguien te ha visto.");
    apunta(s, "pedir", `Pide en ${L[lugar].corto} (${GENTE_TXT[e0.da]}): ${gana} ${gana === 1 ? "pedazo" : "pedazos"}.`, { gana, da: e0.da, t: t0 });
    resultado(s, gana ? "Te dan algo" : "Nada", lin, gana ? "bien" : "neutro");
    return true;
  }

  // ------------------------------------------------------------------ hurtar y la horca (j0.12)
  // Lo castiga la justicia, no la ronda de pobres. Quien te ve es el dueño o el vecino; si te ven, o te cogen allí
  // mismo o escapas y te buscan por tus señas (y entonces cualquier encuentro con la ronda es con la justicia).
  // La pena es una escalera aparte de las detenciones por pedir, y lo que deja se lleva en el cuerpo.
  // Las palancas que no se eligieron (olla, ropa, oreja, restituir…) siguen en rules.js para los bots; están apagadas.
  const dondeHurto = () => (HU.donde || {})[HU.que] || {};
  // lo que te dice el alguacil cuando te reconoce: por las señas que dio quien te vio, o por lo que contó quien te vendió
  const senas = (s) => (s.buscadoPor === "malsin" ? "«A ti te conozco yo de oídas: alargas la mano en los puestos. A ti te busca la justicia»" : "«Tú eres el de las señas. A ti te busca la justicia»");
  // en qué franjas se puede hurtar en un sitio ese día: los jueves de mercado, la plaza tiene puestos hasta nona (j0.13)
  function franjasHurto(s, lugar, d) {
    const fs = dondeHurto()[lugar] || [];
    const m = mercado(s, d || s.dia) ? ((HU.mercado || {})[HU.que] || {})[lugar] : null;
    return m ? fs.concat(m) : fs;
  }
  function puedeHurtar(s) {
    if (!s.conHurto || s.fase === "noche" || s.t + HU.ratos > FIN) return false;
    const f = franja(s.t), fs = franjasHurto(s, s.lugar);
    if (!fs.includes(f)) return false;
    if (HU.que === "ropa") return !s.ropa;
    if (HU.que === "hogaza") return estado(s, s.lugar, s.dia, f).gente >= 2; // hay mercado o tienda abierta
    return true;
  }
  // probabilidad de que te vean (sin la ronda delante): la gente, si ya has hurtado ahí hoy y, si la palanca lo dice,
  // la necesidad extrema (los vecinos miran a otro lado)
  function probVisto(s, lugar, f) {
    let p = HU.que === "hogaza" ? HU.visto[HU.ojos][estado(s, lugar, s.dia, f).gente >= 3 ? 3 : 2] : HU.vistoFijo[HU.que];
    p *= HU.riesgo;
    if ((s.hurtadoHoy || []).includes(lugar)) p *= HU.repite;
    if (HU.necesidad && s.cuerpo <= HU.necesidad.cuerpo) p *= HU.necesidad.visto;
    return Math.min(1, p);
  }
  // lo que le toca al ladrón la vez n que lo prenden
  // (o es la persona: tú o uno de los tuyos; se le apunta el peldaño en o.hurtos)
  const marcada = (o) => (HU.espaldaQue === "verdugo" ? !!o.verdugo : !!o.azotado);
  function penaHurto(s, el, n, o) {
    if (HU.galeras1552 && galeras(s, el) && !(HU.galeras1552 === "segunda" && n < 2)) return "galeras";
    const esc = (!el && HU.escaleraMujer) || HU.escaleras[HU.escalera];
    // si la palanca lo dice, el alcalde lee la espalda azotada venga de donde venga: al que ya azotó la ronda de
    // pobres por pedir, el primer hurto le cuenta como segundo
    //   espalda: true    → «gasta el aviso»: el primer hurto ya le cuenta como segundo
    //   espalda: "acorta" → conserva el aviso, pero azotes ya lleva: después de la vergüenza viene la horca
    //   espaldaQue: "todas" (cualquier azote, también los varazos de la calle a la mujer) o "verdugo" (solo los de cárcel o justicia)
    if (HU.espalda === true && o && marcada(o) && n < 2) { n = 2; o.hurtos = 2; o.espaldaLeida = true; }
    if (HU.espalda === "acorta" && o && marcada(o)) { const corta = esc.filter((x) => x !== "azotes"); if (corta.length < esc.length) o.espaldaLeida = true; return corta[Math.min(n, corta.length) - 1]; }
    return esc[Math.min(n, esc.length) - 1];
  }
  // lo que el cuerpo le dice al alcalde (si la justicia no tiene más memoria que el cuerpo): la oreja cortada dice que ya
  // pasaste por ese peldaño; la espalda azotada (si la palanca lo dice), que el aviso ya lo tuviste
  function peldanoDelCuerpo(o, el) {
    const esc = (!el && HU.escaleraMujer) || HU.escaleras[HU.escalera];
    if (o.oreja && esc.includes("oreja")) return esc.indexOf("oreja") + 1;
    if (HU.espalda === true && marcada(o)) return 1;
    return 0;
  }
  function prender(s, motivo, lineas) {
    s.hurtos = (s.hurtos || 0) + 1; s.buscado = false; s.conocido = true;
    if (HU.cuenta) s.detenciones++;
    s.detenidoHoy = "ladrón: " + motivo;
    const lleva = s.pan > 0 || s.ropa;
    s.pan = 0; s.ropa = false;
    const pena = (s.penaHurto = penaHurto(s, esHombre(s), s.hurtos, s));
    apunta(s, "prendido", `Prendido por ladrón (${motivo}) en ${L[s.lugar].corto}: ${pena}.`, { motivo, pena });
    s.hoy.perdido += FIN - s.t;
    s.t = FIN;
    const extra = [];
    if (lleva) extra.push("Te quitan lo que llevas.");
    if (s.conTretas) quitarTodo(s, extra);
    if (pena === "galeras") { s.galeras = true; extra.push("El alcalde no manda azotarte: a la vergüenza y cuatro años de galeras, como manda la pragmática. Mañana sales con la cadena de galeotes."); }
    else if (pena === "horca") extra.push(s.oreja ? "Te llevan a la cárcel de la justicia. El alcalde te mira la espalda y la oreja y no pregunta más: la horca."
      : "Te llevan a la cárcel de la justicia. El alcalde te manda levantar la camisa, te mira la espalda y no pregunta más: la horca.");
    else if (pena === "oreja") extra.push("Te llevan a la cárcel de la justicia. Mañana, en el rollo, azotes y la oreja.");
    else if (pena === "verguenza") extra.push("Te llevan a la cárcel de la justicia. Mañana te sacan a la vergüenza.");
    else extra.push("Te llevan a la cárcel de la justicia. Mañana te sacan a la vergüenza y te azotan por las calles.");
    resultado(s, "Te prenden por ladrón", lineas.concat(extra), "mal");
  }
  // la noche en la cárcel del que han prendido por ladrón: lo que cuesta de cuerpo y lo que deja
  function penaNoche(o, lin) {
    const pena = o.penaHurto;
    // la vergüenza sola: paseado en un asno con el pregonero delante, sin azotes; no deja marca en el cuerpo
    // lo que viene después lo dice el alcalde: al limpio, «el verdugo»; al que ya lleva azotes (de lo que sea), «la soga»
    if (pena === "verguenza") {
      const soga = HU.espalda === "acorta" && marcada(o);
      if (lin) lin.push("Por la mañana te sacan a la vergüenza: en un asno, con las manos atadas y el pregonero delante diciendo tu hurto por las calles acostumbradas. "
        + (soga ? "Antes de soltarte, el alcalde te levanta la camisa: «Azotes ya llevas. A la segunda, la soga»." : "«A la segunda, el verdugo», dice el alcalde."));
      return { dc: 0, azotes: false };
    }
    if (pena === "azotes") { o.azotado = true; o.verdugo = true; if (lin) lin.push("Por la mañana te sacan a la vergüenza, en un asno, con el pregonero delante diciendo tu hurto, y el verdugo te azota por las calles. «A la tercera, la soga», dice el alcalde."); return { dc: P.carcel.azotes, azotes: true }; }
    if (pena === "oreja") { o.azotado = true; o.verdugo = true; o.oreja = true; if (lin) lin.push("Por la mañana, en el rollo de la plaza, te azotan y el verdugo te corta una oreja, para que se te conozca."); return { dc: P.carcel.azotes, azotes: true }; }
    if (pena === "horca") { o.horca = true; if (lin) lin.push("No hay más que oír. Mañana, la horca."); }
    return { dc: 0, azotes: false };
  }
  function hurtar(s) {
    if (s.fase !== "dia" || !puedeHurtar(s)) return false;
    const t0 = s.t, f0 = franja(t0), lugar = s.lugar;
    const e0 = estado(s, lugar, s.dia, f0);
    const r0 = rondaEnTuZona(s) || (s.conPresion && corcheteEn(s, lugar, f0) ? lugar : null); // con la presión, el corchete también
    const pv = probVisto(s, lugar, f0);
    const ctx = { f: f0, cuerpo: s.cuerpo, panAntes: s.pan, gente: e0.gente >= 3 ? "mucha" : "poca", ronda: !!r0 }; // para el informe
    s.hoy.hurtos++;
    s.hurtosVerano = (s.hurtosVerano || 0) + 1;
    s.hurtadoHoy.push(lugar);
    // quedan voces en el sitio: la ronda acude
    if (L[lugar].dentro && HU.aviso) { s.avisos[lugar] = (s.avisos[lugar] || 0) + HU.aviso; s.avisosT[lugar] = s.dia * 100 + t0; if (s.conPresion) sumaQueja(s, lugar, f0, HU.aviso); }
    pasar(s, HU.ratos, "hurtar", true);
    const que = HU.que === "ropa" ? "una camisa y unas calzas" : HU.que === "olla" ? "la olla del fuego" : "una hogaza";
    const coger = () => {
      if (HU.que === "ropa") { s.ropa = true; return 0; }
      const sobra = guardarPan(s, HU.gana);
      s.hoy.panHurtado += HU.gana - sobra;
      return HU.gana - sobra;
    };
    // con la ronda delante, te coge ella
    if (r0 && tirar(s, "hurtoRonda") < HU.rondaDelante[e0.gente >= 3 ? 3 : 2]) {
      apunta(s, "hurto", `Hurta en ${L[lugar].corto} con la ronda delante.`, Object.assign({ visto: "ronda", t: t0 }, ctx));
      prender(s, "hurtando delante de la ronda", [`Alargas la mano en ${L[lugar].nombre} con la ronda delante. El alguacil te coge del brazo antes de que la escondas.`]);
      return true;
    }
    // la necesidad extrema: sin ella te habrían visto igual, pero con el cuerpo así el dueño mira a otro lado
    const nec = HU.necesidad && s.cuerpo <= HU.necesidad.cuerpo && HU.necesidad.visto > 0;
    const pvSin = nec ? Math.min(1, pv / HU.necesidad.visto) : pv;
    const rv = tirar(s, "hurtoVisto");
    if (rv < pv) {
      // «gente»: con mucha gente te sujetan allí mismo; con poca, nadie te alcanza y te buscan
      const coge = HU.siVisto === "prendido" || (HU.siVisto === "gente" && e0.gente >= 3) || (HU.siVisto === "mixto" && tirar(s, "hurtoCoge") < HU.prendido);
      if (coge) {
        apunta(s, "hurto", `Hurta en ${L[lugar].corto}: le ven y le cogen.`, Object.assign({ visto: "prendido", t: t0 }, ctx));
        prender(s, "hurtando", [`Coges ${que} en ${L[lugar].nombre}. «¡Al ladrón!». Te sujetan entre dos antes de que des tres pasos y te entregan a la justicia.`]);
        return true;
      }
      // escapas con lo hurtado, pero te han visto la cara: desde ahora te buscan
      s.buscado = true; s.buscadoDia = s.dia; s.buscadoSabe = true; s.buscadoPor = "visto";
      const gana = coger();
      apunta(s, "hurto", `Hurta en ${L[lugar].corto}: le ven y escapa.`, Object.assign({ visto: "huye", gana, t: t0 }, ctx));
      resultado(s, "Te han visto", [`Coges ${que} en ${L[lugar].nombre}. «¡Al ladrón!». Corres y no te alcanzan.`, "Te han visto la cara. Darán tus señas a la justicia, y unos días te buscarán por ellas."], "mal");
      return true;
    }
    const gana = coger();
    if (rv < pvSin) {
      apunta(s, "hurto", `Hurta en ${L[lugar].corto}: le ven y miran a otro lado.`, Object.assign({ visto: "perdona", gana, t: t0 }, ctx));
      resultado(s, "Vuelve la cabeza", [`Coges ${que} en ${L[lugar].nombre}. El panadero te ha visto la mano. Te mira las costillas y vuelve la cabeza.`], "bien");
      return true;
    }
    apunta(s, "hurto", `Hurta en ${L[lugar].corto}: nadie le ve.`, Object.assign({ visto: "no", gana, t: t0 }, ctx));
    resultado(s, "Nadie te ve", [`Coges ${que} en ${L[lugar].nombre} y te la metes bajo la ropa. Nadie grita.`], "bien");
    return true;
  }

  // restituir (palanca apagada en la j0.12; quedó para los bots): si te buscan y la palanca lo dice, en San Esteban un fraile habla por ti con el
  // dueño; devuelves lo que cogiste y la parte perdona. Solo vale antes de que te prenda la justicia.
  function puedeRestituir(s) {
    const SG = HU.sagrado;
    if (SG && SG.veces && (s.restituidoVerano || 0) >= SG.veces) return false; // el fraile responde por ti un número de veces cada verano
    return !!(s.conHurto && SG && s.buscado && s.fase === "dia" && s.lugar === SG.lugar && s.pan >= SG.devuelve && s.t + SG.ratos <= FIN);
  }
  function restituir(s) {
    if (!puedeRestituir(s)) return false;
    const SG = HU.sagrado, t0 = s.t;
    pasar(s, SG.ratos, "esperar", true);
    s.pan -= SG.devuelve; s.buscado = false; s.restituido = (s.restituido || 0) + 1; s.restituidoVerano = (s.restituidoVerano || 0) + 1;
    apunta(s, "restituye", `Restituye en ${L[s.lugar].corto}: devuelve ${SG.devuelve} pedazos y la parte perdona.`, { t: t0 });
    resultado(s, "Restituyes", ["Un fraile te oye en la portería. «Lo que tomaste con hambre no fue hurto ante Dios; ante el alcalde, sí». Va él a hablar con el dueño, le lleva el pan que traes y vuelve: la parte perdona. Ya no te buscan."], "bien");
    return true;
  }

  function pedirTrabajo(s) {
    const a = opciones(s).acc.find((x) => x.id === "trabajo");
    if (!a || !a.ok) return false;
    const t0 = s.t;
    s.trabajoPedido = true;
    pasar(s, P.trabajo.pedirRatos, "trabajar", true);
    const sinOreja = s.oreja && (HU.oreja || {}).siega === false; // al desorejado no le dan obra (si la palanca lo dice)
    const p = s.llaga || sinOreja ? 0 : P.trabajo.probPorCuerpo[s.cuerpo] || 0;
    if (tirar(s, "trabajo") < p) {
      const hasta = P.trabajo.hasta * R.RATOS;
      pasar(s, hasta - s.t, "trabajar", true);
      const sobra = guardarPan(s, P.trabajo.paga);
      s.hoy.panTrabajo += P.trabajo.paga - sobra;
      s.trabajoHoy = true;
      apunta(s, "trabajo", "Le cogen de peón en las obras.", { t: t0 });
      const lin = [
        "Te cogen de peón en las obras de la catedral. Cargas piedra hasta el final de nona.",
        `Te pagan en pan: ${P.trabajo.paga} pedazos. Acabas molido.`,
        "Mientras trabajas, la ronda no te molesta.",
      ];
      if (sobra) lin.push(`No te cabe todo en el hatillo: se pierde${sobra === 1 ? " un pedazo" : "n " + sobra + " pedazos"}.`);
      resultado(s, "Trabajas", lin, "bien");
    } else {
      apunta(s, "trabajo", "No le cogen en las obras.", { t: t0 });
      // con el cuerpo bajo, el capataz lo dice a su manera; las reglas no
      const linea = sinOreja ? "El capataz te ve la oreja: «Ladrones en mi obra, no»."
        : s.llaga ? "El capataz te ve la pierna: «¿Con eso vas a cargar piedra? Vete a pedir, que es lo tuyo.»"
        : s.cuerpo <= 3 ? "El capataz te mira de arriba abajo: «Tus brazos no me valen, muchacho.»" : "El capataz elige a otros. Hoy sobran brazos.";
      resultado(s, "No te cogen", [linea], "neutro");
    }
    return true;
  }

  function esperar(s) {
    if (s.t >= FIN) return false;
    const n = R.RATOS - (s.t % R.RATOS);
    const llegadas = pasar(s, n, "esperar", true);
    apunta(s, "esperar", `Espera en ${L[s.lugar].corto} hasta ${s.t >= FIN ? "la noche" : nombreFranja(franja(s.t)).toLowerCase()}.`, { t: s.t - n });
    if (s.t >= FIN) { s.aviso = null; return true; }
    const r = rondaEnTuZona(s);
    const ch = !r && !!s.conPresion && corcheteEn(s, s.lugar, franja(s.t));
    s.aviso = r
      ? { texto: `Empieza ${nombreFranja(franja(s.t)).toLowerCase()}. ${llegadas.length ? "Llega" : "Sigue"} la ronda ${r === s.lugar ? "aquí" : "en " + L[r].nombre}.`, tono: "mal" }
      : ch ? { texto: `Empieza ${nombreFranja(franja(s.t)).toLowerCase()}. Aquí vigila un corchete a esta hora.`, tono: "mal" }
      : { texto: `Empieza ${nombreFranja(franja(s.t)).toLowerCase()}.`, tono: "neutro" };
    return true;
  }

  // ------------------------------------------------------------------ las tretas (rama claude/tretas)
  // Maneras de pedir que se aprenden de otros pobres (de noche, en la ribera) o se compran (de día, en su sitio).
  // Cuestan (pan, blancas, andar despacio, riesgo), dan pan o blancas y se queman: cada vez que pides con una donde
  // alguien avisa, la queja lleva tu descripción; con bastantes señas la autoridad la cataloga: deja de dar más que pedir
  // sin más, y el alguacil que te para con ella te detiene. Lo catalogado se pregona y vale para toda tu gente.
  // Las blancas se guardan de un día para otro, pero si la ronda te para con muchas encima, te las quita.
  // Sin el botón de las tretas nada de esto se toca: el motor juega igual que sin ellas (y sin gastar tiradas).
  function iniciarTretas(s) {
    Object.assign(s, { conTretas: true, blancas: 0, mazo: [], usos: {}, puesta: null, senasTreta: {}, catalogadas: [], quemadas: [],
      votoSitios: [], misa: false, muertoSitios: [], oferta: null, ofrecidas: [], cita: null, robada: null, tretasLog: {}, pregon: [], pregonInvierno: [] });
  }
  const catalogada = (s, id) => (s.catalogadas || []).includes(id) || (s.quemadas || []).includes(id);
  const logTreta = (s, id) => (s.tretasLog[id] = s.tretasLog[id] || { usos: 0, pan: 0, blancas: 0, pillado: 0, descubierta: 0 });
  function puedeUsarla(s, t) {
    if (t.quien === "hombre") return esHombre(s);
    if (t.quien === "mujer") return !esHombre(s);
    if (t.quien === "tuyo") return !!s.conTuyos && tuyosVivos(s).length > 0;
    return true;
  }
  const pesaPuesta = (s) => { const t = s.puesta && TT[s.puesta]; return (t && t.puesta && t.puesta.paso) || 0; };
  const noTeParan = (s) => { const t = s.puesta && TT[s.puesta]; return !!(t && t.puesta && t.puesta.noParan) && !s.conocido && !s.buscado; };
  const esMisa = (s, t) => !!t.misa && !s.misa && s.lugar === t.misa.lugar && s.t < FIN && franja(s.t) === t.misa.f && t.misa.tipos.includes(dia(s).tipo);
  const nombreTuyo = (s, id) => ((s.tuyos || []).find((x) => x.id === id) || {}).nombre || "";
  const conTuyo = (txt, s, id) => String(txt || "").split("{tuyo}").join(nombreTuyo(s, id) || "el otro");
  const citaTxt = (c) => `a ${nombreFranja(c.f).toLowerCase()} en ${L[c.lugar].nombre}`;
  const cosas = (pan, bl) => [pan ? (pan === 1 ? "un pedazo de pan" : `${pan} pedazos de pan`) : "", bl ? (bl === 1 ? "una blanca" : `${bl} blancas`) : ""].filter(Boolean).join(" y ");
  // el tuyo con quien quedaste, si está aquí
  function tuyoDeCita(s) {
    const c = s.cita;
    if (!c) return null;
    const tu = (s.tuyos || []).find((x) => x.id === c.id);
    return tu && tu.estado === "vive" && !tu.detenido && tu.lugar === s.lugar ? tu : null;
  }
  // si puedes pedir con una treta aquí y ahora; si no, por qué (para «Antes de actuar»)
  function tretaAqui(s, id) {
    const t = TT[id];
    if (!t || !s.conTretas || !s.mazo.includes(id)) return { ok: false, porque: "" };
    if (!puedeUsarla(s, t)) return { ok: false, porque: t.quien === "mujer" ? "es cosa de mujeres" : t.quien === "hombre" ? "a una mujer no la creen" : "no tienes con quién" };
    if (t.usos && !(s.usos[id] > 0)) return { ok: false, porque: t.sinUsos || "se te ha acabado" };
    if (s.fase !== "dia" || s.t >= FIN) return { ok: false, porque: "ya es de noche" };
    const misa = esMisa(s, t);
    const ratos = (misa ? 1 : t.franjas || 1) * R.RATOS;
    if (!misa && !t.lugares.includes(s.lugar)) return { ok: false, porque: `aquí no; sí en ${listaY(t.lugares.map((l) => L[l].nombre))}` };
    if (FIN - s.t < ratos) return { ok: false, porque: "no te da tiempo antes de que acabe el día" };
    const f = franja(s.t), e = estado(s, s.lugar, s.dia, f);
    if (t.gente && !t.gente.includes(e.gente)) return { ok: false, porque: e.gente > Math.max(...t.gente) ? "con tanta gente, te sujetarían" : "aquí ahora no pasa nadie" };
    if (e.da < (t.minDa || 2)) return { ok: false, porque: (t.minDa || 2) >= 3 && e.da >= 2 ? "hace falta mucha gente" : e.gente >= 2 && e.pobres ? "hay más pobres que gente que dé" : "aquí ahora no hay gente que dé" };
    if (t.unaVez === "sitio" && s.muertoSitios.includes(s.lugar)) return { ok: false, porque: "aquí ya lo hicisteis este verano" };
    if (t.cita) {
      const c = s.cita;
      if (!c || c.dia !== s.dia) return { ok: false, porque: "hay que quedar la noche antes" };
      if (c.lugar !== s.lugar || c.f !== f) return { ok: false, porque: `quedasteis ${citaTxt(c)}` };
      if (!tuyoDeCita(s)) return { ok: false, porque: `${nombreTuyo(s, c.id)} no ha venido` };
    }
    return { ok: true, porque: "", coste: ratos, misa };
  }
  // lo que se sabe de una treta antes de usarla, en palabras (lo dijo quien te la enseñó)
  function previsionTreta(s, id) {
    const t = TT[id], x = tretaAqui(s, id), out = [];
    const nom = t.nombre.charAt(0).toUpperCase() + t.nombre.slice(1);
    if (!x.ok) return [`${nom}: ${x.porque}.`];
    if (x.misa) out.push("Es día de misa en la catedral: si lees tu carta ahora, sacas en una mañana lo de una semana. Una vez por verano.");
    else out.push(`${nom}: ${t.mitadTuyo ? "mucho de una vez, en blancas, a medias" : t.moneda === "blancas" ? "lo que te den, en blancas" : t.moneda === "mitad" ? "dos franjas tendida, y te dan pan y blancas" : "más pan que pidiendo sin más"}.`);
    if (catalogada(s, id)) out.push(`La gente ya conoce ${t.nombre}: te dan como a cualquiera, y si la ronda te la ve, te detiene.`);
    if (t.sitioNuevo) out.push(s.votoSitios.includes(s.lugar) ? "Ya pediste para la cera en esta calle: el vecino se acuerda." : "Aquí no has pedido para la cera este verano.");
    if (t.sinHuir) out.push("Tendido no puedes huir: si llega la ronda, te coge.");
    if (t.avisoExtra && !t.justicia) out.push("El corro se oye de lejos: avisarán a la ronda.");
    if (t.justicia) out.push("El que da por miedo va a la justicia: te buscarán por tus señas.");
    if (t.puesta && t.puesta.paso && s.puesta !== id) out.push(`Te pondrás ${t.puesta.nombre}: andarás más despacio hasta que te las quites.`);
    return out;
  }
  // pedir con una treta: como pedir, con lo que la treta cambia
  function pedirCon(s, id) {
    const x = tretaAqui(s, id);
    if (!x.ok) return false;
    const t = TT[id], cat = catalogada(s, id), misa = !!x.misa;
    const t0 = s.t, f0 = franja(t0), lugar = s.lugar, ratos = x.coste;
    const e0 = estado(s, lugar, s.dia, f0);
    const r0 = rondaEnTuZona(s) || (s.conPresion && corcheteEn(s, lugar, f0) ? lugar : null); // con la presión, el corchete también
    const tuyo = t.cita ? tuyoDeCita(s) : null;
    const repite = !!t.sitioNuevo && s.votoSitios.includes(lugar);
    const lg = logTreta(s, id);
    const como = conTuyo(t.como, s, tuyo && tuyo.id);
    // las quejas: las del sitio (dobles si repites calle con el voto) y las que trae la treta
    const aviso = L[lugar].aviso * (repite && t.repite ? t.repite.aviso : 1) + (t.avisoExtra || 0);
    const avisoPrevio = s.avisos[lugar] || 0;
    if (aviso) {
      s.avisos[lugar] = avisoPrevio + aviso; s.avisosT[lugar] = s.dia * 100 + t0;
      if (s.conPresion) sumaQueja(s, lugar, f0, aviso);
      s.habitos = s.habitos || {};
      const h = (s.habitos[f0] = s.habitos[f0] || {});
      const dias = (h[lugar] = h[lugar] || []);
      if (!dias.includes(s.dia)) dias.push(s.dia);
    }
    s.pedidoHoy.push({ lugar, f: f0 });
    s.hoy.pedidas++;
    s.hoy.tretas = (s.hoy.tretas || 0) + 1;
    lg.usos++;
    if (t.puesta) s.puesta = id; // te la pones para pedir y la llevas puesta hasta que te la quites
    if (t.usos) s.usos[id]--;
    pasar(s, ratos, "pedir", true);
    // ¿te ve la ronda? Tramo a tramo de franja, como al pedir. Tendido (la parida, el muerto) no puedes huir.
    let pillado = null, quien = null;
    for (let a = t0, i = 0; a < t0 + ratos && !pillado; i++) {
      const fi = franja(a), b = Math.min(t0 + ratos, (fi + 1) * R.RATOS), len = b - a;
      let rr;
      if (i === 0) rr = r0;
      else {
        const k = `${s.dia}|${fi}`, rk = s.rondas[k];
        // si viene por la queja que acabas de provocar, llega cuando ya terminas (si terminas en ese tramo)
        const porTuAviso = rk === lugar && s.rondasPorque[k] === "aviso" && avisoPrevio === 0 && b >= t0 + ratos && len < R.RATOS;
        rr = rk && !porTuAviso && zonaDe(s, rk) === zonaDe(s, lugar) ? rk : s.conPresion && corcheteEn(s, lugar, fi) ? lugar : null;
      }
      if (rr) {
        const e = estado(s, lugar, s.dia, fi);
        const ver = t.puesta && t.puesta.pillar ? t.puesta.pillar[e.da >= 3 ? 3 : 2] : 1;
        const p = t.sinHuir ? 1 : P.pillarPidiendo[e.da >= 3 ? 3 : 2] * (s.llaga ? LL.pillar : 1) * ver;
        if (tirar(s, `tretaPillar${i}`) < p * len / R.RATOS) { pillado = i === 0 ? "estaba" : "llega"; quien = rr; }
      }
      a = b;
    }
    // lo que te dan: una tirada por franja (o las de la treta), con lo que suma la treta
    const tabla = escasez(s, s.dia) ? P.limosnaEscasez : P.limosna;
    const combo = !cat && t.combo ? Object.entries(t.combo).reduce((n, [k, v]) => n + (s.mazo.includes(k) && !catalogada(s, k) ? v : 0), 0) : 0;
    const bonus = cat ? 0 : (t.bonus || 0) + (t.sitioNuevo && !repite ? t.sitioNuevo : 0) + combo;
    const n = misa ? t.misa.tiradas : (t.tiradas || t.franjas || 1);
    const tir = [];
    for (let i = 0; i < n; i++) {
      const e = t.franjas > 1 && !misa ? estado(s, lugar, s.dia, Math.min(R.FRANJAS.length - 1, f0 + i)) : e0;
      const d6 = clamp(1 + Math.floor(tirar(s, `treta${i}`) * 6) + (s.llaga ? LL.limosna : 0) + bonus - (s.oreja ? (HU.oreja || {}).limosna || 0 : 0), 1, 6);
      let g = e.da >= 2 ? tabla[e.da >= 3 ? 3 : 2][d6 - 1] : 0;
      if (t.nuncaCero) g = Math.max(1, g);
      tir.push(g);
    }
    // las señas: la queja lleva tu descripción (más donde más avisan); si te pillan con ella, más
    const senasAntes = s.senasTreta[id] || 0;
    if (t.fingir) s.senasTreta[id] = senasAntes + L[lugar].aviso + (repite && t.repite ? t.repite.senas || 0 : 0) + (pillado ? TR.senas : 0);
    if (pillado) {
      lg.pillado++;
      const l1 = pillado === "llega"
        ? `Estás pidiendo en ${L[lugar].nombre}, ${como}, cuando aparece la ronda${quien !== lugar ? ` por ${L[quien].nombre}` : ""}.`
        : `Pides en ${L[lugar].nombre}, ${como}, con la ronda ${quien === lugar ? "delante" : "en el barrio"}. Te ve.`;
      const lin = [l1];
      if (t.sinHuir) lin.push(tuyo ? `${tuyo.nombre} no puede levantarse sin descubriros. El alguacil le toma el pulso: «Este muerto está muy vivo».` : "Tendida no puedes correr. El alguacil te levanta la sábana: debajo no hay más que trapos.");
      apunta(s, "pillado", `Empieza a pedir con ${t.nombre} en ${L[lugar].corto}. ${l1}`, { pillado, t: t0, treta: id });
      if (tuyo) { detenerTuyo(s, tuyo, "el muerto fingido", franja(Math.min(s.t, FIN - 1)), lugar); tuyo.cita = null; s.cita = null; }
      if (t.fingir && !cat && s.senasTreta[id] >= TR.catalogo) catalogar(s, id, lin);
      if (s.buscado) { lin.push(`El alguacil te mira despacio: ${senas(s)}.`); prender(s, "pidiendo, le reconoce la ronda", lin); return true; }
      if (t.justicia) { lin.push("«Esto no es pedir: es quitar con un cuchillo», dice el alguacil. No te lleva a la cárcel de los pobres: te entrega a la justicia."); prender(s, "pidiendo con un cuchillo", lin); return true; }
      lin.push(t.fingir ? "Pedir está prohibido en la ciudad desde la orden de pobres, y fingir es peor." : "Pedir está prohibido en la ciudad desde la orden de pobres, y vender coplas sin licencia también.");
      detener(s, `pidiendo con ${t.nombre}`, lin);
      return true;
    }
    // el reparto: en pan, en blancas, o la mitad; el muerto, a medias con el tuyo (él en pan, tú en blancas)
    const total = tir.reduce((a, b) => a + b, 0);
    let pan = 0, bl = 0, panTuyo = 0;
    if (t.mitadTuyo) { panTuyo = Math.floor(total / 2); bl = (total - panTuyo) * TR.blancasPedazo; }
    else if (t.moneda === "pan") pan = total;
    else if (t.moneda === "blancas") bl = total * TR.blancasPedazo;
    else if (t.moneda === "mitad") { pan = tir[0]; bl = (total - tir[0]) * TR.blancasPedazo; }
    if (t.blancasExtra) bl += t.blancasExtra;
    const sobra = pan ? guardarPan(s, pan) : 0;
    s.blancas += bl;
    s.hoy.panPedido += pan - sobra;
    s.hoy.blancasGanadas = (s.hoy.blancasGanadas || 0) + bl;
    lg.pan += pan - sobra; lg.blancas += bl;
    if (t.sitioNuevo && !repite) s.votoSitios.push(lugar);
    if (misa) s.misa = true;
    if (t.unaVez === "sitio") s.muertoSitios.push(lugar);
    if (t.justicia) { s.buscado = true; s.buscadoDia = s.dia; s.buscadoSabe = true; s.buscadoPor = "visto"; } // te ha visto la cara quien te dio
    const lin = [];
    if (misa) lin.push(`En la misa de prima, el cura te deja leer tu carta al acabar el sermón. Al salir, en la puerta, la gente te llena la mano: ${cosas(pan, bl) || "nada"}.`);
    else if (!pan && !bl && !panTuyo) lin.push(`Pides en ${L[lugar].nombre}, ${como}. No te dan nada.`);
    else lin.push(`Pides en ${L[lugar].nombre}, ${como}. ${t.franjas > 1 ? "En las dos franjas te dan" : "Te dan"} ${tuyo ? cosas(0, (pan + panTuyo) * TR.blancasPedazo + bl) + " para el entierro" : cosas(pan, bl)}.`);
    if (tuyo) {
      const cabe = Math.min(panTuyo, P.panMax - tuyo.pan);
      tuyo.pan += cabe; tuyo.cita = null; s.cita = null;
      if (panTuyo) lin.push(`La mitad es de ${tuyo.nombre}, que con ella se compra pan. Tú te quedas ${bl === 1 ? "una blanca" : bl + " blancas"}.`);
    }
    if (sobra) lin.push(`No te cabe todo en el hatillo: se pierde${sobra === 1 ? " un pedazo" : "n " + sobra + " pedazos"}.`);
    if (t.justicia && (pan || bl)) lin.push("Te han visto bien la cara. Darán tus señas a la justicia, y unos días te buscarán por ellas.");
    if (cat) lin.push("La gente ya conoce esa: te dan como a cualquiera.");
    if (repite) lin.push("«¿Otra vez la cera?», rezonga un vecino.");
    if (t.fingir && !cat) {
      if (s.senasTreta[id] >= TR.catalogo) catalogar(s, id, lin);
      else if (s.senasTreta[id] >= TR.catalogo - 1 && senasAntes < TR.catalogo - 1) lin.push("Un vecino se te queda mirando: «A ese lo he visto yo antes».");
    }
    const rFin = rondaEnTuZona(s);
    if (rFin) lin.push(`Al acabar, ves llegar a la ronda${rFin !== lugar ? ` a ${L[rFin].nombre}` : ""}.${s.rondasPorque[`${s.dia}|${franja(Math.min(s.t, FIN - 1))}`] === "aviso" && rFin === lugar ? " Alguien ha avisado." : ""}`);
    if (aviso === 0) lin.push("Nadie va a avisar.");
    else if (!rFin) lin.push(aviso >= 2 ? "Te han visto, y avisarán a la ronda." : "Alguien te ha visto.");
    apunta(s, "treta", `Pide con ${t.nombre} en ${L[lugar].corto} (${GENTE_TXT[e0.da]}): ${pan} ${pan === 1 ? "pedazo" : "pedazos"}, ${bl} blancas${misa ? ", en misa" : ""}.`, { treta: id, gana: total, pan: pan - sobra, panBruto: pan, blancas: bl, da: e0.da, t: t0, misa });
    resultado(s, pan || bl || panTuyo ? "Te dan algo" : "Nada", lin, pan || bl || panTuyo ? "bien" : "neutro");
    return true;
  }
  // la autoridad cataloga la treta: desde ahora no da más que pedir sin más, y el alguacil que te la ve te detiene;
  // a la mañana siguiente la pregonan
  function catalogar(s, id, lin) {
    if (catalogada(s, id)) return;
    s.catalogadas.push(id);
    s.pregon.push({ id, anio: s.anio, dia: s.dia });
    logTreta(s, id).catalogada = `${s.conCadena ? s.anio + ", " : ""}día ${s.dia}`;
    apunta(s, "catalogo", `La autoridad cataloga ${TT[id].nombre}.`);
    if (lin) lin.push("Oyes a un vecino: «Esa ya la conozco. Se lo diré al alguacil».");
  }
  // te para la ronda llevando atrezo: puede descubrirte (fingir es peor que pedir: cárcel). Te quita el atrezo.
  const DESCUBRE = {
    atado: ["«Estira ese brazo», te dice. Lo estiras. Te quita las muletas.", "Ni te pregunta: te quita las muletas. «Esa ya me la sé»."],
    cautivo: ["Te pregunta por el baño de Argel, por el nombre de tu amo, por la galera en que remabas. No sabes qué decir. Te quita las cadenas.", "Te mira las cadenas y se ríe: «Esa ya me la sé». Te las quita."],
    carta: ["Te pide la carta y mira el sello al sol: «Este sello no lo ha puesto ningún obispo». Se la queda.", "Te pide la carta y ni la lee: «Esa ya me la sé». Se la queda."],
    vergonzante: ["Te mira la ropa y luego las manos: «Buen paño para tan malas uñas».", "«Esa ya me la sé: harapos debajo del buen paño»."],
  };
  function descubrir(s, r) {
    const p = s.puesta && TT[s.puesta];
    let id = null, pr = 0;
    if (p && p.puesta && (p.puesta.descubre || catalogada(s, p.id))) { id = p.id; pr = catalogada(s, id) ? 1 : p.puesta.descubre; }
    else if (s.mazo.includes("carta") && TT.carta && TT.carta.descubreParar) { id = "carta"; pr = catalogada(s, "carta") ? 1 : TT.carta.descubreParar; }
    if (!id || tirar(s, `descubre|${id}`) >= pr) return false;
    s.hoy.paradas++;
    const cat = catalogada(s, id);
    s.senasTreta[id] = (s.senasTreta[id] || 0) + TR.senas;
    logTreta(s, id).descubierta++;
    olvidarTreta(s, id, true); // te quita el atrezo
    const lin = [`En ${L[r].nombre} te para el alguacil. ${(DESCUBRE[id] || ["Te quita lo que llevas.", "«Esa ya me la sé»."])[cat ? 1 : 0]}`];
    if (!cat && s.senasTreta[id] >= TR.catalogo) catalogar(s, id, lin);
    lin.push("Fingir para pedir es peor que pedir: te lleva a la cárcel.");
    apunta(s, "fingidor", `La ronda le descubre ${TT[id].nombre} en ${L[s.lugar].corto}.`);
    detener(s, "fingidor", lin);
    return true;
  }
  // te para la ronda (sin detenerte) con muchas blancas encima: te las quita
  function registro(s) {
    if (s.detenidoHoy || s.fase !== "resultado" || !s.ultimo || !(s.blancas > TR.registro)) return;
    const n = s.blancas; s.blancas = 0;
    s.ultimo.lineas.push(`Te registra y te encuentra las blancas: «Mucho dinero para un pobre». Se las queda: ${n}.`);
    s.blancasQuitadas = (s.blancasQuitadas || 0) + n;
    apunta(s, "registro", `La ronda le quita ${n} blancas.`);
  }
  // te detienen o te prenden: también te quitan las blancas y el atrezo que lleves puesto
  function quitarTodo(s, lin) {
    if (s.blancas) { lin.push(`Te quitan las blancas (${s.blancas}).`); s.blancasQuitadas = (s.blancasQuitadas || 0) + s.blancas; s.blancas = 0; }
    s.puesta = null;
  }
  function olvidarTreta(s, id, quitada) {
    if (!s.mazo.includes(id)) return false;
    s.mazo = s.mazo.filter((x) => x !== id);
    if (s.puesta === id) s.puesta = null;
    delete s.usos[id];
    if (TT[id].cita) { s.cita = null; for (const tu of s.tuyos || []) tu.cita = null; }
    if (!quitada) apunta(s, "olvida", `Deja ${TT[id].nombre}.`);
    return true;
  }
  function olvidar(s, id) { return (s.fase === "dia" || s.fase === "noche") && olvidarTreta(s, id); }
  // al anochecer: te quitas el atrezo; en la ribera te roban la ropa buena; y alguien te ofrece una treta
  function tretasAnochecer(s) {
    s.puesta = null; s.robada = null; s.oferta = null;
    if (s.duerme === "raso" && s.mazo.includes("vergonzante") && TT.vergonzante.ribera === "roban") {
      olvidarTreta(s, "vergonzante", true);
      s.robada = "De madrugada, alguien te quita de debajo de la cabeza la ropa buena. En la ribera, el buen paño dura una noche.";
      apunta(s, "robada", "Le roban la ropa buena en la ribera.");
    }
    if (s.duerme === "raso") s.oferta = ofertaNoche(s);
  }
  // cada noche en la ribera, alguien te ofrece una treta de las que puedes usar (la primera noche, la del voto)
  function ofertaNoche(s) {
    const maestro = (t) => (t.aprende.quien !== "tuyo" ? true : tuyosVivos(s).some((tu) => juntos(s, tu)));
    const xs = (TR.lista || []).filter((t) => t.aprende && !s.mazo.includes(t.id) && !(s.quemadas || []).includes(t.id) && puedeUsarla(s, t) && maestro(t));
    if (!xs.length) return null;
    const primera = xs.find((t) => t.primera && !s.ofrecidas.includes(t.id));
    const nuevas = xs.filter((t) => !s.ofrecidas.includes(t.id));
    const pool = nuevas.length ? nuevas : xs;
    const t = primera || pool[Math.floor(mundo(s, `oferta|${s.dia}`) * pool.length)];
    if (!s.ofrecidas.includes(t.id)) s.ofrecidas.push(t.id);
    const tu = t.aprende.quien === "tuyo" ? tuyosVivos(s).find((x) => juntos(s, x)) : null;
    return { id: t.id, tuyo: tu ? tu.id : null };
  }
  function ofertaTxt(s) {
    const o = s.oferta;
    if (!o) return null;
    const t = TT[o.id];
    return { id: o.id, nombre: t.nombre, pan: t.aprende.pan || 0, blancas: t.aprende.blancas || 0, dice: conTuyo(t.aprende.dice, s, o.tuyo),
      ok: s.pan >= (t.aprende.pan || 0) && s.blancas >= (t.aprende.blancas || 0), lleno: s.mazo.length >= TR.mazo };
  }
  function aprender(s, olvidarId) {
    const o = s.oferta;
    if (s.fase !== "noche" || !o) return false;
    const t = TT[o.id], pr = t.aprende;
    if (s.pan < (pr.pan || 0) || s.blancas < (pr.blancas || 0)) return false;
    if (s.mazo.length >= TR.mazo && !(olvidarId && olvidarTreta(s, olvidarId))) return false;
    s.pan -= pr.pan || 0; s.blancas -= pr.blancas || 0;
    s.mazo.push(t.id);
    if (t.usos) s.usos[t.id] = t.usos;
    const lg = logTreta(s, t.id);
    if (!lg.desde) lg.desde = `${s.conCadena ? s.anio + ", " : ""}día ${s.dia}`;
    s.oferta = null;
    apunta(s, "aprende", `Aprende ${t.nombre}${pr.pan || pr.blancas ? ` (paga ${cosas(pr.pan || 0, pr.blancas || 0)})` : ""}.`);
    return true;
  }
  // lo que se vende aquí y ahora (lo pregonado ya no lo vende nadie)
  function tiendaAqui(s) {
    if (!s.conTretas || s.fase !== "dia" || s.t >= FIN) return [];
    const f = franja(s.t), out = [];
    for (const t of TR.lista || []) {
      const c = t.compra;
      if (!c || c.lugar !== s.lugar || !c.franjas.includes(f) || (s.quemadas || []).includes(t.id) || !puedeUsarla(s, t)) continue;
      const tiene = s.mazo.includes(t.id);
      const rellena = tiene && !!t.usos && !(s.usos[t.id] > 0);
      if (tiene && !rellena) continue;
      let porque = "";
      if (s.blancas < c.blancas) porque = `no tienes ${c.blancas} blancas`;
      else if (FIN - s.t < TR.ratos) porque = "no te da tiempo";
      out.push({ id: t.id, nombre: t.nombre, blancas: c.blancas, usos: t.usos || 0, rellena, ok: !porque, lleno: !tiene && s.mazo.length >= TR.mazo, porque, quien: c.quien, dice: c.dice });
    }
    return out;
  }
  function comprar(s, id, olvidarId) {
    const x = tiendaAqui(s).find((y) => y.id === id);
    if (!x || !x.ok) return false;
    if (x.lleno && !(olvidarId && olvidarTreta(s, olvidarId))) return false;
    const t = TT[id];
    s.blancas -= x.blancas;
    if (!x.rellena) s.mazo.push(id);
    if (t.usos) s.usos[id] = t.usos;
    const lg = logTreta(s, id);
    if (!lg.desde) lg.desde = `${s.conCadena ? s.anio + ", " : ""}día ${s.dia}`;
    lg.compras = (lg.compras || 0) + 1;
    pasar(s, TR.ratos, "esperar", true);
    apunta(s, "compra", `Compra ${t.nombre} en ${L[s.lugar].corto} (${x.blancas} blancas).`);
    s.aviso = { texto: `Pagas ${x.blancas} blancas a ${x.quien}. ${x.rellena ? `Tienes otra vez ${t.nombre}.` : `Ya tienes ${t.nombre}.`}`, tono: "bien" };
    return true;
  }
  // el pan también se compra (caro) y se vende (barato)
  function mercadoPan(s) {
    if (!s.conTretas || s.fase !== "dia" || s.t >= FIN) return {};
    const f = franja(s.t), pp = TR.pan || {}, out = {};
    if (((pp.compraEn || {})[s.lugar] || []).includes(f)) {
      const precio = escasez(s, s.dia) ? pp.compraEscasez : pp.compra;
      out.compra = { precio, ok: s.blancas >= precio && s.pan < P.panMax, porque: s.pan >= P.panMax ? "no te cabe más" : s.blancas < precio ? `no tienes ${precio} blancas` : "" };
    }
    if (((pp.ventaEn || {})[s.lugar] || []).includes(f)) out.venta = { precio: pp.venta, ok: s.pan > 0, porque: s.pan > 0 ? "" : "no tienes pan" };
    return out;
  }
  function comprarPan(s) {
    const m = mercadoPan(s).compra;
    if (!m || !m.ok) return false;
    s.blancas -= m.precio; s.pan++;
    s.hoy.panComprado = (s.hoy.panComprado || 0) + 1;
    pasar(s, TR.ratos, "esperar", true);
    apunta(s, "panCompra", `Compra un pedazo de pan en ${L[s.lugar].corto} (${m.precio} blancas).`);
    s.aviso = { texto: `Compras un pedazo de pan por ${m.precio} blancas.`, tono: "neutro" };
    return true;
  }
  function venderPan(s) {
    const m = mercadoPan(s).venta;
    if (!m || !m.ok) return false;
    s.pan--; s.blancas += m.precio;
    s.hoy.panVendido = (s.hoy.panVendido || 0) + 1;
    pasar(s, TR.ratos, "esperar", true);
    apunta(s, "panVenta", `Vende un pedazo de pan en ${L[s.lugar].corto} (${m.precio} ${m.precio === 1 ? "blanca" : "blancas"}).`);
    s.aviso = { texto: `La ventera te compra un pedazo de pan por ${m.precio === 1 ? "una blanca" : m.precio + " blancas"}.`, tono: "neutro" };
    return true;
  }
  // quitarte las muletas o las cadenas (la ropa buena, no: la llevas todo el día)
  function puedeQuitar(s) { const t = s.puesta && TT[s.puesta]; return !!(s.conTretas && s.fase === "dia" && s.t + TR.ratos <= FIN && t && t.puesta && t.puesta.quitar); }
  function quitar(s) {
    if (!puedeQuitar(s)) return false;
    const t = TT[s.puesta];
    s.puesta = null;
    pasar(s, TR.ratos, "esperar", true);
    apunta(s, "quita", `Se quita ${t.puesta.nombre}.`);
    s.aviso = { texto: `Te quitas ${t.puesta.nombre} y las escondes en el hatillo.`, tono: "neutro" };
    return true;
  }
  // el muerto fingido: de noche, en la ribera, quedas con uno de los tuyos para el día siguiente
  function citasPosibles(s) {
    const t = TT.muerto;
    if (!s.conTretas || !t || s.fase !== "noche" || !s.mazo.includes("muerto") || s.dia >= R.DIAS || !puedeUsarla(s, t)) return [];
    return tuyosVivos(s).filter((tu) => juntos(s, tu)).map((tu) => ({ id: tu.id, nombre: tu.nombre, lugares: t.lugares, f: t.cita.f }));
  }
  function quedar(s, id, lugar) {
    const c = citasPosibles(s).find((x) => x.id === id);
    if (!c || !c.lugares.includes(lugar)) return false;
    s.cita = { id, dia: s.dia + 1, f: c.f, lugar };
    for (const tu of s.tuyos) tu.cita = tu.id === id ? { dia: s.dia + 1, f: c.f, lugar } : null;
    apunta(s, "cita", `Queda con ${c.nombre} para mañana ${citaTxt(s.cita)}.`);
    return true;
  }
  // entre veranos: lo catalogado se pregona y queda quemado para toda tu gente; las blancas no pasan el invierno
  function tretasInvierno(s) {
    s.pregonInvierno = s.catalogadas.filter((id) => !s.quemadas.includes(id));
    for (const id of s.pregonInvierno) s.quemadas.push(id);
    for (const tu of s.tuyos || []) tu.cita = null;
    Object.assign(s, { catalogadas: [], senasTreta: {}, votoSitios: [], misa: false, muertoSitios: [], ofrecidas: [], cita: null, puesta: null, oferta: null, robada: null, blancas: 0 });
  }

  // ------------------------------------------------------------------ la ciudad se endurece (prototipo, rama claude/tretas)
  // Decidido por Sergio (23-nov): no solo aprender antes, sino ir cerrando los sitios seguros durante el verano. Cada
  // mañana desde el día PR.desde el corregidor pone un corchete en el sitio y la hora con más quejas acumuladas (las tuyas,
  // las de los tuyos y las de otros pobres), y desde el día PR.puerta.desde uno en la puerta y la hora por la que más
  // pasas (se mueve si cambias). Un corchete vigila su sitio a su hora todos los días: si pides delante te ve, y si
  // llegas te puede parar, como la ronda. No va de noche. Se sabe: lo pregonan al amanecer.
  function iniciarPresion(s) {
    s.conPresion = true;
    s.presion = { q: {}, cruces: {}, corchetes: [], puerta: null, hoy: null, otrosHasta: 0, historia: [] };
  }
  function corcheteEn(s, l, f) {
    if (!s.conPresion || f == null || f < 0 || f >= R.FRANJAS.length) return false;
    const p = s.presion;
    return p.corchetes.some((c) => c.lugar === l && c.f === f) || (!!p.puerta && p.puerta.lugar === l && p.puerta.f === f);
  }
  function sumaQueja(s, l, f, n) { if (!n || !L[l].dentro) return; const k = `${l}|${f}`; s.presion.q[k] = (s.presion.q[k] || 0) + n; }
  function presionAmanecer(s) {
    const p = s.presion;
    p.hoy = { nuevos: [], puerta: null, quita: null };
    // las quejas de los otros pobres de los días pasados: donde pidieron y había gente, lo que avisa el sitio
    for (let d = p.otrosHasta + 1; d < s.dia; d++) {
      for (const l of DENTRO) for (let f = 0; f < R.FRANJAS.length; f++) if (L[l].aviso && genteDelDia(s, l, d, f) >= 2 && hayPobres(s, l, d, f)) sumaQueja(s, l, f, L[l].aviso * (PR.otros || 0));
      p.otrosHasta = d;
    }
    if (s.dia >= (PR.desde || 99)) {
      for (let i = 0; i < (PR.porDia || 0) && p.corchetes.length < (PR.max || 0); i++) {
        let mejor = null;
        for (const [k, n] of Object.entries(p.q)) {
          const [l, fs] = k.split("|"), f = +fs;
          if (n < (PR.umbral || 1) || !(PR.franjas || []).includes(f) || p.corchetes.some((c) => c.lugar === l && c.f === f)) continue;
          const v = n + mundo(s, `corchete|${s.dia}|${k}`) * 0.5; // los empates los decide el mundo
          if (!mejor || v > mejor.v) mejor = { v, l, f, n };
        }
        if (!mejor) break;
        const c = { lugar: mejor.l, f: mejor.f, dia: s.dia, quejas: mejor.n };
        p.corchetes.push(c); p.hoy.nuevos.push(c);
        apunta(s, "corchete", `Ponen un corchete en ${L[c.lugar].corto} a ${nombreFranja(c.f).toLowerCase()} (${c.quejas} quejas).`);
      }
    }
    const PP = PR.puerta;
    if (PP && s.dia >= PP.desde) {
      let mejor = null;
      for (const [k, n] of Object.entries(p.cruces)) {
        if (n < PP.min) continue;
        const [l, fs] = k.split("|"), v = n + mundo(s, `corcheteP|${s.dia}|${k}`) * 0.5;
        if (!mejor || v > mejor.v) mejor = { v, l, f: +fs, n };
      }
      const antes = p.puerta;
      if (mejor && (!antes || antes.lugar !== mejor.l || antes.f !== mejor.f)) {
        p.puerta = { lugar: mejor.l, f: mejor.f, dia: s.dia, veces: mejor.n };
        p.hoy.puerta = p.puerta; p.hoy.quita = antes;
        p.historia.push(p.puerta);
        apunta(s, "corchete", `Ponen un corchete en ${L[mejor.l].corto} a ${nombreFranja(mejor.f).toLowerCase()} (ha pasado por ahí ${mejor.n} veces)${antes ? `; quitan el de ${L[antes.lugar].corto}` : ""}.`);
      }
    }
  }
  // la posada (con las tretas): lo que dan las blancas y no el pan. Dormir dentro sin la ronda de noche.
  function puedePosada(s) {
    const po = TR.posada;
    return !!(s.conTretas && po && s.fase === "noche" && s.duerme === "portal" && po.en.includes(s.lugar) && s.blancas >= po.blancas);
  }
  function pagarPosada(s) {
    if (!puedePosada(s)) return false;
    s.blancas -= TR.posada.blancas;
    s.duerme = "posada";
    apunta(s, "posada", `Paga la posada en ${L[s.lugar].corto} (${TR.posada.blancas} blancas).`);
    return true;
  }

  function acabarDia(s) {
    s.hoy.esperar += FIN - s.t;
    s.t = FIN;
    apunta(s, "acabar", `Da el día por acabado en ${L[s.lugar].corto}.`);
    return true;
  }

  // después de un resultado o cuando se acaba el tiempo
  function seguir(s) {
    s.ultimo = null;
    if (s.final) { s.fase = "fin"; return; }
    if (s.t >= FIN) { irANoche(s); return; }
    s.fase = "dia";
  }
  function comprobarNoche(s) { if (s.fase === "dia" && s.t >= FIN) irANoche(s); }
  function irANoche(s) {
    s.fase = "noche";
    s.duerme = s.detenidoHoy ? "carcel" : (L[s.lugar].dentro ? "portal" : "raso");
    // en el puente no se duerme: fuera de la muralla, se duerme en la ribera
    s.bajaRibera = !s.detenidoHoy && !L[s.lugar].dentro && s.lugar !== "ribera";
    s.bajaDe = s.bajaRibera ? s.lugar : null;
    if (s.bajaRibera) s.lugar = "ribera";
    // en la ribera duerme el viejo de la llaga: cuántas noches lo has tenido al lado
    if (puedeLlaga(s)) s.viejo = (s.viejo || 0) + 1;
    if (s.conTuyos) tuyosAnochecer(s);
    if (s.conTretas) tretasAnochecer(s);
  }

  // la llaga: de noche en la ribera, una vez y para siempre. Te la enseña el viejo; lo que cuesta no lo dice nadie.
  function puedeLlaga(s) { return !!P.llaga && !!s.conLlaga && s.fase === "noche" && s.duerme === "raso" && !s.llaga; }
  function hacerLlaga(s) {
    if (!puedeLlaga(s)) return false;
    s.llaga = s.dia;
    apunta(s, "llaga", "Se hace una llaga en la pierna, como el viejo.");
    return true;
  }

  // la noche dentro de la muralla: dónde ha habido quejas hoy en tu zona (la tuya o la de otros pobres)
  function riesgoNoche(s) {
    const zona = lugaresZona(s, zonaDe(s, s.lugar));
    const vigilada = s.pedidoHoy.some((p) => zona.includes(p.lugar));
    let pobres = 0;
    for (const l of zona) {
      if (!L[l].dentro) continue;
      let k = 0;
      for (let f = 0; f < R.FRANJAS.length; f++) if (estado(s, l, s.dia, f).pobres) k++;
      pobres = Math.max(pobres, k);
    }
    const nivel = vigilada ? "vigilada" : pobres >= P.nochePobresFranjas ? "pobres" : "tranquila";
    return { nivel, vigilada, pobres };
  }
  // lo que sabe el jugador de su sitio para dormir (sin cifras): solo lo que vio
  function saberNoche(s, lugar) {
    const l = lugar || s.lugar;
    if (!L[l].dentro) return [];
    const zona = lugaresZona(s, zonaDe(s, l));
    const out = [];
    if (s.pedidoHoy.some((p) => zona.includes(p.lugar))) out.push(zona.length > 1 ? "Hoy te vieron pedir en este barrio: los vecinos se habrán quejado." : "Hoy te vieron pedir aquí: los vecinos se habrán quejado.");
    const vistos = zona.filter((id) => { const m = s.memoria[id]; return m && m.dia === s.dia && m.pobres; });
    if (vistos.length) out.push(`Hoy has visto otros pobres pidiendo ${zona.length > 1 ? "en este barrio" : "aquí"}: la ronda de noche también va a por ellos.`);
    if (!out.length) out.push("Que tú sepas, aquí nadie se ha quejado hoy.");
    return out;
  }

  function cenar(s, n) {
    if (s.fase !== "noche") return false;
    const lin = [];
    const antes = s.cuerpo;
    let dc = 0, comido = 0, detenidoNoche = false, azotes = false;
    if (s.duerme === "carcel") {
      lin.push("Pasas la noche en la cárcel. Te dan un mendrugo.");
      dc += P.carcel.cuerpo;
      const lleva = TU.devuelve && (s.tuyos || []).find((tu) => tu.estado === "vive" && !tu.detenido && (tu.debe || 0) > 0 && tu.pan >= 1);
      if (lleva) { lleva.pan--; lleva.debe--; dc += 1; lin.push(`${lleva.nombre} te ha traído un pedazo de pan a la cárcel.`); }
      if (s.galeras) lin.push("Mañana sales con la cadena de galeotes, camino del mar.");
      else if (s.penaHurto) { const x = penaNoche(s, lin); dc += x.dc; azotes = azotes || x.azotes; }
      else if (s.detenciones === 2) { dc += P.carcel.azotes; azotes = true; s.azotado = true; s.verdugo = true; lin.push("Antes de soltarte, te azotan."); }
    } else {
      comido = clamp(n | 0, 0, Math.min(2, s.pan));
      s.pan -= comido;
      dc += P.cena[comido];
      lin.push(comido === 2 ? "Cenas una ración entera." : comido === 1 ? "Cenas media ración." : "Te acuestas sin cenar.");
      if (s.trabajoHoy) { dc -= P.trabajo.cansancio; lin.push("Estás molido del trabajo."); }
      if (s.duerme === "posada") lin.push(`Duermes en el pajar del mesón, en ${L[s.lugar].nombre}. La ronda de noche no entra en las posadas.`);
      else if (s.duerme === "portal") {
        const rn = riesgoNoche(s);
        const p = P.nocheDentro[rn.nivel][s.conocido ? 1 : 0] * (s.llaga ? LL.noche : 1);
        s.hoy.nocheNivel = rn.nivel;
        if (tirar(s, "noche") < p) {
          detenidoNoche = true;
          const ladron = !!s.buscado; // al que buscan por ladrón, la ronda de noche lo entrega a la justicia
          if (!ladron || HU.cuenta) s.detenciones++;
          s.conocido = true;
          const pan = s.pan; s.pan = 0;
          lin.push(`De madrugada, la ronda te encuentra durmiendo en un portal de ${L[s.lugar].nombre}. Te llevan a la cárcel${pan ? " y te quitan el pan" : ""}.`);
          if (s.conTretas) quitarTodo(s, lin);
          if (ladron) {
            s.hurtos = (s.hurtos || 0) + 1; s.buscado = false; s.ropa = false;
            s.penaHurto = penaHurto(s, esHombre(s), s.hurtos, s);
            lin.push(`El alguacil te acerca el farol a la cara: ${senas(s)}.`);
            apunta(s, "prendido", `Prendido por ladrón (de noche) en ${L[s.lugar].corto}: ${s.penaHurto}.`, { motivo: "de noche", pena: s.penaHurto });
            if (s.penaHurto === "galeras") { s.galeras = true; lin.push("Por la mañana el alcalde te condena a la vergüenza y a cuatro años de galeras, como manda la pragmática."); }
            else { const x = penaNoche(s, lin); dc += x.dc; azotes = azotes || x.azotes; }
          } else {
          // no lo explica el juego: lo dice el alguacil, y solo cuando hay algo que decir
          if (rn.nivel === "vigilada") lin.push("«Ya me han dicho que andabas pidiendo por aquí», dice el alguacil.");
          else if (rn.nivel === "pobres") lin.push("«Venimos a limpiar esto de pordioseros. Tú también vienes», dice el alguacil.");
          apunta(s, "detenido", `Detenido de noche en ${L[s.lugar].corto}. Detención ${s.detenciones} de ${P.detencionesMax}.`, { motivo: "de noche" });
          if (galeras(s, esHombre(s))) { s.galeras = true; lin.push(`Por la mañana el alcalde te condena a la vergüenza y a cuatro años de galeras, como manda la pragmática a los vagabundos${s.detenciones === 1 ? ". Basta la primera vez" : ""}.`); }
          else if (s.detenciones === 2) { dc += P.carcel.azotes; azotes = true; s.azotado = true; s.verdugo = true; lin.push(`Detención 2 de ${P.detencionesMax}: te azotan. A la tercera, destierro.`); }
          else if (s.detenciones === 1) lin.push(`Detención 1 de ${P.detencionesMax}. A la segunda, azotes; a la tercera, destierro. Ya te tienen fichado.`);
          }
        } else lin.push(`Duermes en un portal de ${L[s.lugar].nombre}. Nadie te molesta.`);
      } else lin.push("Duermes al raso en la ribera.");
      if (s.conTretas && s.robada) lin.push(s.robada);
    }
    if (s.azotesHoy) { dc += P.carcel.azotes * s.azotesHoy; azotes = true; lin.push("La espalda te arde de los azotes."); } // la mujer azotada por la calle (j0.11)
    if (s.llaga && s.llaga === s.dia) { dc += LL.cuerpo; lin.push("La llaga te da fiebre toda la noche."); }
    else if (s.llaga && LL.encona && tirar(s, "encona") < LL.encona) { dc -= 1; lin.push("La llaga se te ha enconado: supura y te sube la fiebre."); }
    s.cuerpo = clamp(s.cuerpo + dc, 0, cuerpoMax(s));
    // (palanca apagada) con quién has dormido la última noche que has dormido libre: es quien te ve ahorcar si la palanca dice «anoche»
    if (s.conTuyos && s.duerme !== "carcel") s.conQuien = (s.tuyos || []).filter((tu) => juntos(s, tu)).map((tu) => tu.id);
    if (s.conTuyos) { tuyosNoche(s, lin); s.nocheTuyos = null; }
    if (s.conTretas) { s.hoy.blancas = s.blancas; s.oferta = null; }
    s.porDia.push(Object.assign({ anio: s.anio, dia: s.dia, modo: s.modo, cuerpoNoche: s.cuerpo, comido, duerme: s.duerme, detenido: s.detenidoHoy || (detenidoNoche ? "de noche" : null) }, s.hoy, { lugares: Object.keys(s.hoy.lugares).length }));
    apunta(s, "noche", `Noche (${DUERME[s.duerme]}${s.hoy.nocheNivel ? ", " + s.hoy.nocheNivel : ""}): come ${comido}, cuerpo ${antes} → ${s.cuerpo}.`);
    s.noche = { lineas: lin, antes, despues: s.cuerpo, dia: s.dia, detenido: s.duerme === "carcel" || detenidoNoche };
    // finales
    if (s.horca) return acaba(s, "ahorcado", "Al amanecer te sacan de la cárcel a la horca, fuera de la puerta, con el pregonero delante. Te ahorcan a la vista de todos.");
    if (s.galeras) {
      return acaba(s, "galeras", "Al amanecer te sacan de la cárcel a la vergüenza y después con la cadena de galeotes, camino del mar. Cuatro años al remo.");
    }
    if (s.detenciones >= P.detencionesMax) {
      return acaba(s, "desterrado", "Te sacan de Salamanca con destierro. Si vuelves, la horca.");
    }
    if (s.cuerpo <= 0) {
      return acaba(s, azotes ? "muerto" : "hambre", azotes ? "No aguantas los azotes con el cuerpo tan gastado. Mueres antes del amanecer." : "Mueres de hambre.");
    }
    if (s.dia >= R.DIAS && s.conCadena) return finVerano(s);
    if (s.dia >= R.DIAS) {
      // la siega: el mayoral mira los brazos antes de dar la hoz
      if (s.llaga) return fin(s, "aguanta", "Al amanecer empieza la siega. El mayoral te ve la pierna y pasa de largo sin mirarte los brazos. Has aguantado, y tu llaga te seguirá dando de comer en la ciudad.");
      if (s.oreja && (HU.oreja || {}).siega === false) return fin(s, "aguanta", "Al amanecer empieza la siega. El mayoral te ve la oreja y pasa de largo: «A un ladrón no le doy yo una hoz». Has aguantado, pero no te quiere nadie.");
      const p = P.siega.probPorCuerpo[s.cuerpo] || 0;
      if (tirar(s, "siega") < p) return fin(s, "siega", "Al amanecer empieza la siega. El mayoral te mira los brazos y te da una hoz. Unas semanas comerás de tu trabajo; después, otra vez a la ribera.");
      return fin(s, "aguanta", "Al amanecer empieza la siega. El mayoral te mira y pasa de largo: «Tus brazos no me valen, muchacho». Has aguantado, pero no te quiere nadie.");
    }
    if (s.duerme === "carcel" || detenidoNoche) s.lugar = "puerta";
    s.dia++;
    empezarDia(s);
    return true;
  }

  function fin(s, tipo, texto) {
    if (s.conTuyos) texto += " " + finTuyos(s, tipo);
    s.final = { tipo, dia: s.dia, texto };
    s.fase = "fin";
    apunta(s, "fin", texto);
    return true;
  }

  // ------------------------------------------------------------------ la cadena de veranos (j0.11)
  // Si mueres con uno de los tuyos durmiendo a tu lado, sigues como él el verano siguiente (si estaban los dos, eliges);
  // si mueres solo, se acaba. El destierro y las galeras no son morir: sigue uno de los tuyos, el que elijas. El resto
  // del verano pasa sin jugarlo: los que quedan llegan a la siega como están. La siega decide cómo pasas el invierno.
  const ultimoVerano = () => (R.VERANOS || [{}]).length - 1;
  const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const FIN_CORTO = {
    hambre: () => "muere de hambre", muerto: () => "muere después de los azotes", galeras: () => "a galeras",
    desterrado: (el) => (el ? "desterrado" : "desterrada"), malsino: () => "te vende al alguacil",
    ahorcado: (el) => (el ? "ahorcado" : "ahorcada"),
  };
  // lo que queda de cada verano en la cuenta de tu gente
  function anal(s, texto) { if (s.cadena) s.cadena.anales.push({ anio: s.anio, texto }); }
  function analFin(s, nombre, el, tipo, d) { anal(s, `${mayus(nombre)}: ${FIN_CORTO[tipo] ? FIN_CORTO[tipo](el) : tipo} el ${d} de junio.`); }
  // un tuyo ha dormido donde tú esta noche (la ribera o el mismo portal; en la cárcel se muere solo)
  const juntos = (s, tu) => s.duerme !== "carcel" && tu.estado === "vive" && tu.durmio === s.duerme && tu.lugar === s.lugar;
  // la siega: al hombre, el mayoral le mira los brazos (y la pierna); la mujer espiga si se tiene en pie
  function siegaDe(el, cuerpo, llaga, r, oreja) {
    if (el && llaga) return "nada";
    if (el && oreja && (HU.oreja || {}).siega === false) return "nada"; // al desorejado no le dan hoz (si la palanca lo dice)
    return r < (P.siega.probPorCuerpo[cuerpo] || 0) ? (el ? "hoz" : "espiga") : "nada";
  }
  function textoSiega(res, el, llaga, oreja) {
    if (res === "hoz") return "Al amanecer empieza la siega. El mayoral te mira los brazos y te da una hoz. Siegas hasta agosto y comes de tu trabajo.";
    if (res === "espiga") return "Al amanecer empieza la siega. Vas detrás de los segadores espigando lo que se les cae, como las demás mujeres.";
    if (!el) return "Al amanecer empieza la siega. No te tienes en pie para espigar de sol a sol.";
    if (llaga) return "Al amanecer empieza la siega. El mayoral te ve la pierna y pasa de largo sin mirarte los brazos.";
    if (oreja && (HU.oreja || {}).siega === false) return "Al amanecer empieza la siega. El mayoral te ve la oreja y pasa de largo: «A un ladrón no le doy yo una hoz».";
    return "Al amanecer empieza la siega. El mayoral te mira y pasa de largo: «Tus brazos no me valen, muchacho».";
  }
  const SIEGA_CORTO = { hoz: "siega con hoz", espiga: "espiga", nada: "sin siega" };
  function siegaTuyos(s, lin) {
    const out = {};
    for (const tu of tuyosVivos(s)) {
      tu.malsinaManana = false; // se acaba el verano: vuelven a la aldea
      const res = siegaDe(tu.el, tu.cuerpo, false, mundo(s, `siega|${tu.id}`), tu.oreja);
      out[tu.id] = res;
      lin.push(res === "hoz" ? `A ${tu.nombre} le dan una hoz.` : res === "espiga" ? `${tu.nombre} espiga.` : tu.el ? `A ${tu.nombre} el mayoral no lo quiere.` : `${tu.nombre} no está para espigar.`);
      anal(s, `${tu.nombre}: ${SIEGA_CORTO[res]}.`);
    }
    return out;
  }
  // se acaba tu personaje: destierro, galeras o muerte. Sigue uno de los tuyos o se acaba la cadena.
  function acaba(s, tipo, texto) {
    if (!s.conCadena) return fin(s, tipo, texto);
    const muere = tipo === "muerto" || tipo === "hambre";
    const vivos = tuyosVivos(s).filter((tu) => !tu.malsinaManana);
    // la horca: según la palanca, mueres solo (se acaba la cadena) o sigue uno de los tuyos que quede libre
    const horca = tipo === "ahorcado";
    const cands = muere ? vivos.filter((tu) => juntos(s, tu))
      : horca ? (HU.horca === "acompanado" ? vivos.filter((tu) => !tu.detenido) : HU.horca === "anoche" ? vivos.filter((tu) => !tu.detenido && (!s.conQuien || s.conQuien.includes(tu.id))) : []) : vivos;
    const nombres = (xs) => listaY(xs.map((t) => t.nombre));
    let cola;
    // ahorcado mueres solo: los tuyos que quedan libres pueden estar entre la gente, pero no heredan
    const miran = vivos.filter((tu) => !tu.detenido);
    if (horca) cola = cands.length ? `${nombres(cands)} ${cands.length > 1 ? "están" : "está"} entre la gente, al pie de la horca.`
      : miran.length ? `${nombres(miran)} ${miran.length > 1 ? "están" : "está"} entre la gente. No ${miran.length > 1 ? "pueden" : "puede"} acercarse.` : "Entre la gente que mira no hay nadie que te conozca.";
    else if (muere) cola = cands.length ? `${nombres(cands)} ${cands.length > 1 ? "estaban" : "estaba"} contigo.` : "Nadie te ha visto morir.";
    else if (tipo === "desterrado") cola = vivos.length ? `${nombres(vivos)} se ${vivos.length > 1 ? "quedan" : "queda"} en la ribera.` : `Te vas ${esHombre(s) ? "solo" : "sola"}.`;
    else cola = vivos.length ? `${nombres(vivos)} te ${vivos.length > 1 ? "ven" : "ve"} pasar desde el puente.` : "Nadie te ve salir.";
    texto = `${texto} ${cola}`;
    analFin(s, s.quien.nombre, esHombre(s), tipo, s.dia);
    s.cadena.vidas.push({ id: s.quien.id, nombre: s.quien.nombre, el: esHombre(s), anio: s.anio, dia: s.dia, tipo, acompanado: muere || horca ? cands.length > 0 : null });
    if (!cands.length) return finCadena(s, tipo, texto);
    if (s.verano >= ultimoVerano()) { anal(s, `Sigue ${nombres(cands)}.`); return finCadena(s, tipo, texto); }
    for (const tu of tuyosVivos(s)) tu.malsinaManana = false; // ya no hay a quién vender
    s.relevo = { tipo, texto, candidatos: cands.map((t) => t.id) };
    s.fase = "relevo";
    apunta(s, "relevo", texto);
    return true;
  }
  // los días que faltan para la siega, sin ti: los tuyos viven con las mismas reglas y nadie les da pan. Si el que
  // ha de seguir se va, sigue el otro con la misma regla (muere acompañado, o le destierran o le mandan a galeras);
  // si no queda nadie, se acaba la cadena. Devuelve false si se acaba.
  function restoDelVerano(s, lin) {
    if (s.dia < R.DIAS) lin.push("Pasan los días que faltan para la siega.");
    s.duerme = null; s.lugar = "ribera";
    while (s.dia < R.DIAS) {
      s.dia++;
      s.avisos = {}; s.avisosT = {}; s.pedidoHoy = []; s.nocheTuyos = []; s.panAntesReparto = 0;
      tuyosAmanecer(s);
      for (let f = 0; f < R.FRANJAS.length; f++) {
        rondaFranja(s, s.dia, f);
        if (f > 0) for (const l of Object.keys(s.avisos)) { s.avisos[l]--; if (s.avisos[l] <= 0) delete s.avisos[l]; }
        for (const tu of s.tuyos) tuyoFranja(s, tu, s.dia, f);
      }
      for (const tu of tuyosVivos(s)) {
        tu.duerme = tu.detenido ? "carcel" : L[tu.lugar].dentro ? "portal" : "raso"; tu.durmio = tu.duerme;
        if (!L[tu.lugar].dentro && tu.lugar !== "ribera") tu.lugar = "ribera";
      }
      const her = s.tuyos.find((t) => t.id === s.heredero);
      const donde = { durmio: her.durmio, lugar: her.lugar };
      const antes = tuyosVivos(s);
      tuyosNoche(s, []);
      // los otros que se van esos días
      for (const t of antes) {
        if (t === her || t.estado === "vive") continue;
        const lt = t.el ? "lo" : "la";
        lin.push(t.estado === "muerto" ? `El día ${s.dia} muere ${t.nombre}.` : t.estado === "ahorcado" ? `El día ${s.dia} ahorcan a ${t.nombre}.` : t.estado === "galeras" ? `El día ${s.dia} a ${t.nombre} ${lt} mandan a galeras.` : `El día ${s.dia} a ${t.nombre} ${lt} destierran de la ciudad.`);
      }
      if (her.estado === "vive") continue;
      const lo = her.el ? "lo" : "la";
      const otros = tuyosVivos(s);
      const muere = her.estado === "muerto";
      const horca = her.estado === "ahorcado";
      const sigue = muere ? otros.filter((t) => donde.durmio !== "carcel" && t.durmio === donde.durmio && t.lugar === donde.lugar)
        : horca ? (HU.horca === "acompanado" || HU.horca === "anoche" ? otros.filter((t) => !t.detenido) : []) : otros;
      lin.push(horca ? `El día ${s.dia} ahorcan a ${her.nombre}${sigue.length ? `; ${sigue[0].nombre} estaba entre la gente` : ""}.` : muere ? `El día ${s.dia} muere ${her.nombre}${sigue.length ? `; ${sigue[0].nombre} estaba con ${her.el ? "él" : "ella"}` : ", sin nadie al lado"}.`
        : her.estado === "galeras" ? `El día ${s.dia} a ${her.nombre} ${lo} mandan a galeras.` : `El día ${s.dia} a ${her.nombre} ${lo} destierran de la ciudad.`);
      if (!sigue.length) { finCadena(s, her.estado === "muerto" ? "hambre" : her.estado, lin.join(" "), her.nombre); return false; }
      s.heredero = sigue[0].id;
      anal(s, `Sigue ${sigue[0].nombre}.`);
    }
    return true;
  }
  // sigues como uno de los tuyos: su cuerpo, su pan, sus detenciones y su espalda. Lo que vio va a Recuerdos.
  function heredar(s, tu, tipo) {
    const antes = s.quien;
    s.vistasHeredero = { id: tu.id, nombre: tu.nombre, vistas: tu.vistas.map((v) => Object.assign({}, v)) };
    s.quien = { id: tu.id, nombre: tu.nombre, el: tu.el, manera: tu.manera, desde: s.anio, antes: antes.nombre, antesEl: antes.el !== false, antesFin: tipo };
    s.cuerpo = tu.cuerpo; s.pan = tu.pan; s.detenciones = tu.detenciones; s.azotado = !!tu.azotado; s.verdugo = !!tu.verdugo;
    s.llaga = 0; s.llagaPasadas = 0; s.galeras = false; s.trabajoHoy = false; s.conocido = false;
    s.hurtos = tu.hurtos || 0; s.oreja = !!tu.oreja; s.buscado = false; s.ropa = false; s.horca = false; s.penaHurto = null; s.hurtosVerano = 0; s.conQuien = null; s.restituidoVerano = 0;
    if (s.conTretas) { s.blancas = 0; s.puesta = null; s.cita = null; } // lo que sabías lo sabe tu gente; las blancas eran tuyas
    s.heredados = (s.heredados || []).concat([{ id: tu.id, nombre: tu.nombre, manera: tu.manera, anio: s.anio, detenciones: tu.detenciones, recibido: tu.recibido, negadas: tu.negadas, noches: tu.noches, hurtosHechos: tu.hurtosHechos || 0 }]);
    s.tuyos = s.tuyos.filter((t) => t.id !== tu.id);
  }
  function elegirHeredero(s, id) {
    if (s.fase !== "relevo" || !s.relevo || !s.relevo.candidatos.includes(id)) return false;
    const tipo = s.relevo.tipo;
    const tu0 = s.tuyos.find((t) => t.id === id);
    s.relevo = null;
    anal(s, `Sigue ${tu0.nombre}.`);
    apunta(s, "relevo", `Sigue ${tu0.nombre}.`);
    s.heredero = id;
    const lin = [];
    if (!restoDelVerano(s, lin)) return true;
    const tu = s.tuyos.find((t) => t.id === s.heredero);
    if (tu.id !== id) lin.push(`Sigues como ${tu.nombre}.`);
    heredar(s, tu, tipo);
    s.heredero = null;
    // la siega: llegáis como estáis
    const res = siegaDe(esHombre(s), s.cuerpo, false, mundo(s, `siega|${tu.id}`), s.oreja);
    lin.push(textoSiega(res, esHombre(s), false, s.oreja));
    anal(s, `${tu.nombre}: ${SIEGA_CORTO[res]}.`);
    s.siega = { yo: res, tuyos: siegaTuyos(s, lin) };
    s.invierno = { anio: s.anio, siguiente: R.VERANOS[s.verano + 1].anio, lineas: lin, relevo: true };
    s.fase = "invierno";
    return true;
  }
  // se acaba el verano en la siega (has llegado)
  function finVerano(s) {
    const lin = [];
    const res = siegaDe(esHombre(s), s.cuerpo, !!s.llaga, tirar(s, "siega"), s.oreja);
    lin.push(textoSiega(res, esHombre(s), !!s.llaga, s.oreja));
    anal(s, `${mayus(s.quien.nombre)}: ${SIEGA_CORTO[res]}.`);
    const tuyos = siegaTuyos(s, lin);
    if (s.verano >= ultimoVerano()) return finCadena(s, { hoz: "siega", espiga: "espiga", nada: "aguanta" }[res], lin.join(" "));
    s.siega = { yo: res, tuyos };
    s.invierno = { anio: s.anio, siguiente: R.VERANOS[s.verano + 1].anio, lineas: lin };
    s.fase = "invierno";
    apunta(s, "siega", lin.join(" "));
    return true;
  }
  // lo de este verano pasa a Recuerdos marcado con su año (y, para el informe, dónde estuvo la ronda)
  function archivarVerano(s) {
    const pedidas = s.cronica.filter((c) => c.anio === s.anio && (c.tipo === "pedir" || c.tipo === "pillado" || c.tipo === "treta")).map((c) => ({ dia: c.dia, f: franja(c.t), lugar: c.lugar }));
    s.cadena.archivo.push({
      anio: s.anio, quien: Object.assign({}, s.quienVerano || s.quien),
      vistas: (s.vistas || []).slice(), contado: (s.contado || []).filter((x) => x.ronda),
      // cuántas cosas te contaron (solo las de la ronda pasan a Recuerdos; el informe suma toda la cadena)
      nContado: (s.contado || []).length, nOidas: (s.contado || []).filter((x) => x.oidas).length, heredero: s.vistasHeredero || null, pedidas,
      circuito: (s.circuito || []).slice(), rondas: s.rondas, rondasPorque: s.rondasPorque,
    });
    s.vistasHeredero = null;
  }
  // después del invierno: los años que pasan hasta el verano siguiente y cómo llega cada uno
  function siguienteVerano(s) {
    if (s.fase !== "invierno" || !s.siega) return false;
    archivarVerano(s);
    // la ronda se acuerda de dónde te vio pedir y de por qué puerta pasabas
    const pide = {}, puertas = {};
    for (const [f, ls] of Object.entries(s.habitos || {})) for (const [l, dias] of Object.entries(ls)) (pide[f] = pide[f] || {})[l] = dias.length;
    for (const [g, dias] of Object.entries(s.salidas || {})) puertas[g] = dias.length;
    s.huella = { pide, puertas };
    const ini = CA.inicio;
    s.verano++;
    s.anio = R.VERANOS[s.verano].anio;
    if (s.llaga) s.llaga = -1; // la llaga sigue abierta; se la hizo otro verano
    const yo = ini[s.siega.yo] || ini.nada;
    s.cuerpo = Math.min(cuerpoMax(s), yo.cuerpo); s.pan = yo.pan;
    // con ropa hurtada, el invierno se pasa mejor (palanca apagada)
    if (s.ropa && HU.ropa) { s.cuerpo = Math.min(cuerpoMax(s), s.cuerpo + HU.ropa.cuerpo); s.pan = Math.min(P.panMax, s.pan + HU.ropa.pan); }
    s.ropa = false; s.buscado = false; s.hurtosVerano = 0; s.penaHurto = null; s.horca = false; s.conQuien = null; s.restituidoVerano = 0;
    if (s.conTretas) tretasInvierno(s);
    if (s.conPresion) iniciarPresion(s); // la ciudad vuelve a empezar: los corchetes son de cada verano
    if (HU.memoria === "cuerpo") { s.hurtos = peldanoDelCuerpo(s, esHombre(s)); for (const tu of tuyosVivos(s)) tu.hurtos = peldanoDelCuerpo(tu, tu.el); }
    for (const tu of tuyosVivos(s)) {
      const x = ini[s.siega.tuyos[tu.id]] || ini.nada;
      Object.assign(tu, { cuerpo: x.cuerpo, pan: x.pan, conocido: false, lugar: "ribera", habitos: {}, vistas: [], detenido: null, quieto: false,
        avisado: false, malsinaManana: false, ultimaNegada: false, hoy: null, ayer: null, galeras: false, obrasHoy: false, trabajoHoy: false, trabajaHasta: null,
        buscado: false, penaHurto: null });
    }
    Object.assign(s, {
      dia: 1, lugar: "ribera", conocido: false, llagaPasadas: 0, viejo: 0, galeras: false,
      avisos: {}, avisosT: {}, rondas: {}, rondasPorque: {}, rondasQuien: {}, rondasContado: {}, memoria: {}, pedidoHoy: [], vistas: [],
      contado: [], habitos: {}, salidas: {}, tuyosAqui: {}, nocheTuyos: null, siega: null, invierno: null, relevo: null,
      quienVerano: Object.assign({}, s.quien),
    });
    s.circuito = recorridoVerano(s);
    empezarDia(s);
    s.noche = null;
    apunta(s, "verano", `Empieza el verano de ${s.anio}.`);
    return true;
  }
  function finCadena(s, tipo, texto, quien) {
    s.final = { tipo, dia: s.dia, texto, cadena: { desde: R.VERANOS[0].anio, hasta: s.anio, quien: quien || s.quien.nombre, vivos: tuyosVivos(s).map((t) => t.nombre) } };
    s.fase = "fin";
    apunta(s, "fin", texto);
    return true;
  }

  // ------------------------------------------------------------------ los tuyos (j0.10)
  // Dos que bajaron contigo de La Armuña. Viven con tus mismas reglas, a escala de franja: cada franja, o andan (hasta
  // tres pasos) o piden en un sitio. Lo que ven es lo que hay; lo que sacan es la misma tabla; la ronda los para, los
  // detiene y les aprende las costumbres igual que a ti. De noche, si dormís los dos en la ribera, te cuentan lo que
  // vieron y, si no han sacado para cenar, te piden. Su azar sale del mundo (la semilla), no de tus tiradas.
  const TU = P.tuyos || {};
  const FUERA = R.LUGARES.filter((l) => !l.dentro).map((l) => l.id);
  const PUERTAS = DENTRO.filter((l) => VECINOS[l].some((v) => !L[v].dentro));
  const DIST = {}, SIG = {}; // pasos entre sitios y el siguiente paso del camino más corto
  for (const a of Object.keys(L)) {
    DIST[a] = { [a]: 0 }; SIG[a] = {};
    const q = [a];
    while (q.length) {
      const x = q.shift();
      for (const y of VECINOS[x]) if (!(y in DIST[a])) { DIST[a][y] = DIST[a][x] + 1; SIG[a][y] = x === a ? y : SIG[a][x]; q.push(y); }
    }
  }
  // pasos que cuesta salir de la muralla desde un sitio de dentro, y por qué puerta
  const salidaDe = (l, evitar) => {
    let mejor = null;
    for (const g of PUERTAS) {
      const d = DIST[l][g] + 1 + (evitar && evitar.includes(g) ? 10 : 0);
      if (!mejor || d < mejor.d) mejor = { d, g };
    }
    return mejor;
  };
  const genteBase = genteDelDia;
  const tuyosVivos = (s) => (s.tuyos || []).filter((t) => t.estado === "vive");
  function tuyoPide(s, lugar, d, f, excluir) {
    const a = (s.tuyosAqui || {})[`${d}|${f}`];
    return !!a && (a[lugar] || []).some((x) => x.pide && x.id !== excluir);
  }
  // quién de los tuyos está en un sitio en la franja de ahora (para la pantalla)
  function tuyosEn(s, lugar) {
    if (!s.conTuyos || s.t >= FIN) return [];
    const a = (s.tuyosAqui || {})[`${s.dia}|${franja(s.t)}`] || {};
    return (a[lugar] || []).map((x) => ({ nombre: s.tuyos.find((t) => t.id === x.id).nombre, pide: x.pide }));
  }
  function nuevoTuyo(q) {
    return Object.assign({}, q, { cuerpo: TU.cuerpo, pan: TU.pan, detenciones: 0, conocido: false, lugar: "ribera", habitos: {},
      vistas: [], estado: "vive", detenido: null, quieto: false, negadas: 0, avisado: false, malsinaManana: false, ultimaNegada: false,
      confianza: (TU.confianza || {}).inicial || 2, recibido: 0, noches: 0, hoy: null, ayer: null, fin: null,
      azotado: false, galeras: false, obrasHoy: false, trabajoHoy: false, trabajaHasta: null, durmio: null,
      hurtos: 0, oreja: false, buscado: false, penaHurto: null, horca: false });
  }
  // cuando un tuyo se va (muere, destierro, galeras o te vende), queda en la cuenta de tu gente
  function tuyoSeVa(s, tu, tipo, d, como) {
    tu.estado = tipo; tu.fin = { tipo, dia: d, anio: s.anio };
    if (s.cadena) analFin(s, tu.nombre, tu.el, como || tipo, d);
  }
  function tuyosAmanecer(s) {
    for (const tu of s.tuyos) {
      if (tu.estado !== "vive") continue;
      if (tu.malsinaManana) {
        // va al alguacil: le cuenta dónde pides y a qué horas. La ronda se las aprende de golpe.
        const ap = R.RONDA.aprende;
        s.habitos = s.habitos || {};
        for (const f of Object.keys(s.habitos)) for (const l of Object.keys(s.habitos[f])) {
          const dias = s.habitos[f][l];
          while (dias.length < ap.minDias) dias.push(-1); // -1: contado por un malsín
        }
        s.malsinado = { por: tu.nombre, dia: s.dia };
        // si la palanca lo dice, cuenta también lo que has hurtado este verano: desde hoy te buscan
        // (tú no lo sabes hasta que te lo dicen en la ribera esa noche, o hasta que te para el alguacil)
        if (s.conHurto && HU.malsinar && (s.hurtosVerano || 0) > 0) {
          if (!s.buscado) { s.buscadoSabe = false; s.buscadoPor = "malsin"; }
          s.buscado = true; s.buscadoDia = s.dia; s.malsinado.hurto = true;
        }
        tuyoSeVa(s, tu, "malsino", s.dia);
        apunta(s, "tuyos", `${tu.nombre} va al alguacil y le cuenta dónde pides.`);
        continue;
      }
      if (tu.detenido) { tu.lugar = "puerta"; tu.detenido = null; }
      tu.obrasHoy = false; tu.trabajoHoy = false; tu.trabajaHasta = null; tu.azotesHoy = 0; tu.penaHurto = null; tu.hurtoHoy = false;
      tu.hoy = { log: [], pide: [], lugares: {}, encuentros: 0 };
      tu.quieto = !L[tu.lugar].dentro && tu.cuerpo <= TU.quieto;
    }
  }
  // un tuyo hace su franja: entrar, salir, pedir o ir a otro sitio
  function tuyoFranja(s, tu, d, f) {
    if (tu.estado !== "vive" || tu.detenido || tu.quieto || !tu.hoy || tu.obrasHoy) return;
    const rnd = (k) => mundo(s, `tuyo|${tu.id}|${d}|${f}|${k}`);
    // trabaja de peón hasta el final de nona: la ronda no le molesta (j0.11)
    if (tu.trabajaHasta != null && f <= tu.trabajaHasta) { tu.hoy.lugares[tu.lugar] = 1; return; }
    const rf = s.rondas[`${d}|${f}`];
    // con la presión, los corchetes vigilan también a los tuyos
    const vigila = (l) => rf === l || (!!s.conPresion && corcheteEn(s, l, f));
    const prudente = tu.manera === "prudente";
    const vio = (ff, l) => tu.vistas.some((v) => v.f === ff && v.lugar === l && d - v.dia <= 3); // la ha visto ahí a esa hora hace poco
    const habito = (ff, l) => (((tu.habitos[ff] || {})[l]) || []).some((x) => x !== d);  // ya pidió ahí a esa hora otro día
    const pidioHoy = (l) => tu.hoy.pide.some((p) => p.lugar === l);
    const marcar = (l, pide) => { const k = `${d}|${f}`; const a = ((s.tuyosAqui = s.tuyosAqui || {})[k] = s.tuyosAqui[k] || {}); (a[l] = a[l] || []).push({ id: tu.id, pide }); };
    // andar hacia un sitio, como mucho n pasos; ve cada sitio de dentro por el que pasa y puede toparse con la ronda
    const andar = (destino, n) => {
      let i = 0;
      while (tu.lugar !== destino && i < n) {
        const sig = SIG[tu.lugar][destino];
        tu.lugar = sig; i++;
        if (!L[sig].dentro) continue;
        tu.hoy.lugares[sig] = 1;
        const hay = vigila(sig);
        tu.hoy.log.push({ f, lugar: sig, ronda: rf === sig });
        if (hay) {
          if (rf === sig) tu.vistas.push({ dia: d, f, lugar: sig }); // un corchete no es la ronda: no lo cuenta como tal
          tu.hoy.encuentros++;
          if (rnd(`parar|${i}`) < (tu.buscado ? HU.pararBuscado : tu.conocido ? P.pararAlLlegar.conocido : P.pararAlLlegar.desconocido)) {
            if (tu.buscado) { prenderTuyo(s, tu, "al llegar", f, sig); return "detenido"; }
            // con la cadena (j0.11): a la mujer la echa, y si ya la conoce, la azota; al azotado le mira la espalda; al
            // hombre sano, a las obras
            const mujer = rasgos(s) && !tu.el;
            const espalda = rasgos(s) && !tu.conocido && tu.azotado;
            if (mujer || (!tu.conocido && !espalda)) {
              const azota = mujer && (tu.conocido || espalda);
              tu.conocido = true;
              if (azota) { tu.azotesHoy = (tu.azotesHoy || 0) + 1; tu.azotado = true; tu.lugar = "puente"; tu.hoy.log.push({ f, lugar: sig, tipo: "azotada" }); return "echado"; }
              if (!mujer && rasgos(s) && tu.cuerpo >= (CA.obrasForzadas || 99)) {
                tu.obrasHoy = true; tu.lugar = "ribera"; tu.hoy.log.push({ f, lugar: sig, tipo: "obras" });
                return "obras";
              }
              tu.lugar = "puente"; tu.hoy.log.push({ f, lugar: sig, tipo: "echado" }); return "echado";
            }
            detenerTuyo(s, tu, "al llegar", f, sig);
            return "detenido";
          }
        }
      }
      return tu.lugar === destino ? "llega" : "anda";
    };
    const pedirAqui = () => {
      const l = tu.lugar, e = estado(s, l, d, f, tu.id);
      marcar(l, true);
      if (vigila(l) && rnd("pillar") < P.pillarPidiendo[e.da >= 3 ? 3 : 2]) { if (tu.buscado) prenderTuyo(s, tu, "pidiendo", f, l); else detenerTuyo(s, tu, "pidiendo", f, l); return; }
      if (L[l].aviso && TU.mundo !== false) {
        s.avisos[l] = (s.avisos[l] || 0) + L[l].aviso; s.avisosT[l] = d * 100 + f * R.RATOS;
        if (s.conPresion) sumaQueja(s, l, f, L[l].aviso);
        const h = (tu.habitos[f] = tu.habitos[f] || {}); const dias = (h[l] = h[l] || []); if (!dias.includes(d)) dias.push(d);
      }
      const tir = 1 + Math.floor(rnd("limosna") * 6);
      const tabla = escasez(s, d) ? P.limosnaEscasez : P.limosna;
      const gana = e.da >= 2 ? tabla[e.da >= 3 ? 3 : 2][tir - 1] : 0;
      tu.pan = Math.min(P.panMax, tu.pan + gana);
      tu.hoy.pide.push({ f, lugar: l, gana });
      tu.hoy.log.push({ f, lugar: l, tipo: "pide", gana, ronda: rf === l });
    };
    // el prudente no pide donde ha visto la ronda hace poco a esa hora, ni repite sitio y hora, ni pide dos veces donde
    // avisan, y a vísperas solo pide donde luego pueda salir antes de que cierren
    const buenoPrudente = (ff, l) => !vio(ff, l) && !habito(ff, l) && !(pidioHoy(l) && L[l].aviso) && (ff !== 4 || salidaDe(l).d <= 3);
    // ¿le toca pedir? cada uno tiene su cupo; la que se arriesga no pide dos franjas seguidas
    const cupo = tu.hoy.pide.length < (tu.pideMax || 9);
    const tocaPedir = cupo && (prudente || !tu.hoy.pide.some((p) => p.f === f - 1));
    // un paso y pedir en esta misma franja
    const cercaYPedir = () => {
      if (!tocaPedir) return false;
      const n = 1;
      let mejor = null;
      for (const l of DENTRO) {
        if (l === tu.lugar || DIST[tu.lugar][l] > n || genteBase(s, l, d, f) < 2) continue;
        if (prudente ? !buenoPrudente(f, l) : pidioHoy(l)) continue;
        const v = prudente ? genteBase(s, l, d, f) + (L[l].aviso === 0 ? 1 : 0) - L[l].aviso * 0.3 + rnd(`cerca|${l}`) * 0.5 : rnd(`cerca|${l}`) * 3;
        if (!mejor || v > mejor.v) mejor = { v, l };
      }
      if (!mejor) return false;
      const r = andar(mejor.l, n);
      if (r !== "llega") return true;
      if (!vigila(tu.lugar) && estado(s, tu.lugar, d, f, tu.id).da >= 2) pedirAqui(); else marcar(tu.lugar, false);
      return true;
    };
    // adónde ir para pedir la franja siguiente
    const destino = () => {
      const f2 = f + 1;
      const cands = DENTRO.filter((l) => l !== tu.lugar && DIST[tu.lugar][l] <= 3 && genteBase(s, l, d, f2) >= 2);
      let mejor = null;
      for (const l of cands) {
        let v;
        if (prudente) {
          if (!buenoPrudente(f2, l)) continue;
          v = genteBase(s, l, d, f2) + (L[l].aviso === 0 ? 1 : 0) - L[l].aviso * 0.3 - DIST[tu.lugar][l] * 0.1 + rnd(`dest|${l}`) * 0.5;
        } else {
          v = (tu.hoy.lugares[l] ? 0 : 1) + rnd(`dest|${l}`) * 3; // va a cualquier sitio con gente, mejor si no ha estado hoy
        }
        if (!mejor || v > mejor.v) mejor = { v, l };
      }
      return mejor && mejor.l;
    };
    // el muerto fingido (tretas): si has quedado con él, va adonde quedasteis y espera allí a la hora
    if (s.conTretas && tu.cita && tu.cita.dia === d && f <= tu.cita.f) {
      const r = andar(tu.cita.lugar, 3);
      if (r !== "detenido" && r !== "echado" && r !== "obras" && tu.estado === "vive" && !tu.detenido && L[tu.lugar].dentro) marcar(tu.lugar, false);
      return;
    }
    // hurtar (j0.12): la que se arriesga, cuando pasa hambre y no tiene para cenar, hurta donde hay qué coger,
    // con las mismas reglas que tú: la pueden ver, coger o buscar
    if (s.conHurto && HU.tuyosHurtan && HU.que !== "ropa" && !prudente && !tu.hurtoHoy && tu.cuerpo <= HU.tuyosCuerpo && tu.pan < 2 && f >= 1 && f <= 4
      && L[tu.lugar].dentro && !vigila(tu.lugar) && genteBase(s, tu.lugar, d, f) >= 2) {
      tu.hurtoHoy = true; tu.hurtosHechos = (tu.hurtosHechos || 0) + 1;
      marcar(tu.lugar, false);
      let pv = (HU.que === "hogaza" ? HU.visto[HU.ojos][genteBase(s, tu.lugar, d, f) >= 3 ? 3 : 2] : HU.vistoFijo[HU.que]) * HU.riesgo;
      const pvSin = pv;
      if (HU.necesidad && tu.cuerpo <= HU.necesidad.cuerpo) pv *= HU.necesidad.visto;
      if (HU.aviso && TU.mundo !== false) { s.avisos[tu.lugar] = (s.avisos[tu.lugar] || 0) + HU.aviso; s.avisosT[tu.lugar] = d * 100 + f * R.RATOS; if (s.conPresion) sumaQueja(s, tu.lugar, f, HU.aviso); }
      const rv = rnd("hurtoVisto");
      if (rv < pv) {
        if (HU.siVisto === "prendido" || (HU.siVisto === "gente" && genteBase(s, tu.lugar, d, f) >= 3) || (HU.siVisto === "mixto" && rnd("hurtoCoge") < HU.prendido)) { prenderTuyo(s, tu, "hurtando", f, tu.lugar); return; }
        tu.buscado = true; tu.buscadoDia = d;
        tu.pan = Math.min(P.panMax, tu.pan + HU.gana);
        tu.hoy.log.push({ f, lugar: tu.lugar, tipo: "hurto", visto: true });
        return;
      }
      tu.pan = Math.min(P.panMax, tu.pan + HU.gana);
      tu.hoy.log.push({ f, lugar: tu.lugar, tipo: "hurto", visto: false, perdona: rv < pvSin });
      return;
    }
    // con la cadena (j0.11), el hombre que ha dormido dentro y tiene las obras a un paso pide trabajo a prima
    if (rasgos(s) && tu.el && f === 0 && dia(s, d).tipo === "laborable" && L[tu.lugar].dentro && DIST[tu.lugar].catedral <= 1 && tu.cuerpo >= 4) {
      const r = andar("catedral", 1);
      if (r !== "llega") return;
      if (rnd("obras") < (P.trabajo.probPorCuerpo[tu.cuerpo] || 0)) {
        tu.trabajaHasta = P.trabajo.hasta - 1; tu.trabajoHoy = true; tu.pan = Math.min(P.panMax, tu.pan + P.trabajo.paga);
        tu.hoy.lugares.catedral = 1;
        tu.hoy.log.push({ f, lugar: "catedral", tipo: "trabajo" });
        return;
      }
    }
    // la última franja: salir de la muralla antes de que cierren
    if (f === R.FRANJAS.length - 1) {
      if (!L[tu.lugar].dentro) { andar("ribera", 3); return; }
      const evitar = prudente ? PUERTAS.filter((g) => vio(f, g)) : [];
      const sal = salidaDe(tu.lugar, evitar);
      if (sal.d > 3) { marcar(tu.lugar, false); return; } // no le da tiempo: dormirá en un portal
      const r = andar(sal.g, 3);
      if (r === "llega") andar(VECINOS[sal.g].find((v) => !L[v].dentro), 1);
      return;
    }
    // el prudente, cuando ya ha pedido lo suyo, se recoge: sale de la muralla y se queda en la ribera
    if (prudente && !cupo) {
      if (!L[tu.lugar].dentro) { andar("ribera", 3); return; }
      const sal = salidaDe(tu.lugar, PUERTAS.filter((g) => vio(f, g)));
      const r = andar(sal.g, 3);
      if (r === "llega" && DIST[tu.lugar][sal.g] === 0 && sal.d - 1 < 3) andar(VECINOS[sal.g].find((v) => !L[v].dentro), 1);
      if (L[tu.lugar].dentro && tu.estado === "vive" && !tu.detenido) marcar(tu.lugar, false);
      return;
    }
    // fuera de la muralla: entrar y pedir enseguida, o hacia donde pedirá la franja siguiente
    if (!L[tu.lugar].dentro) {
      if (cercaYPedir()) return;
      const dest = destino() || "catedral";
      andar(dest, 3);
      if (L[tu.lugar].dentro && tu.estado === "vive" && !tu.detenido) marcar(tu.lugar, false);
      return;
    }
    // dentro: pedir aquí o ir a otro sitio
    const e = estado(s, tu.lugar, d, f, tu.id);
    const puede = e.da >= 2 && !vigila(tu.lugar);
    let pide;
    if (prudente) pide = tocaPedir && puede && buenoPrudente(f, tu.lugar);
    else pide = tocaPedir && puede && !pidioHoy(tu.lugar);
    if (pide) { pedirAqui(); return; }
    if (cercaYPedir()) return;
    // el prudente, a vísperas, si no pide, se acerca a una puerta para salir a tiempo
    if (prudente && f === R.FRANJAS.length - 2) { const sal = salidaDe(tu.lugar, PUERTAS.filter((g) => vio(f + 1, g))); andar(sal.g, 3); marcar(tu.lugar, false); return; }
    const dest = destino();
    if (dest) { const r = andar(dest, 3); if (r === "llega" || r === "anda") marcar(tu.lugar, false); }
    else marcar(tu.lugar, false);
  }
  function detenerTuyo(s, tu, motivo, f, lugar) {
    tu.detenciones++; tu.conocido = true; tu.pan = 0; tu.detenido = motivo;
    if (galeras(s, tu.el)) tu.galeras = true; // desde la pragmática de 1552 (en el juego, 1553), el hombre detenido va a galeras (j0.11)
    tu.hoy.log.push({ f, lugar, tipo: "detenido", motivo });
  }
  // a uno de los tuyos lo prenden por ladrón: la misma escalera que a ti
  function prenderTuyo(s, tu, motivo, f, lugar) {
    tu.hurtos = (tu.hurtos || 0) + 1; tu.buscado = false; tu.conocido = true; tu.pan = 0; tu.detenido = "ladrón: " + motivo;
    if (HU.cuenta) tu.detenciones++;
    tu.penaHurto = penaHurto(s, tu.el, tu.hurtos, tu);
    if (tu.penaHurto === "galeras") tu.galeras = true;
    tu.hoy.log.push({ f, lugar, tipo: "detenido", motivo: "ladrón" });
  }
  // al llegar la noche: terminar su día y preparar lo que te cuentan
  function tuyosAnochecer(s) {
    const d = s.dia;
    for (let f = (s.tuyosF == null ? -1 : s.tuyosF) + 1; f < R.FRANJAS.length; f++) {
      rondaFranja(s, d, f);
      for (const l of Object.keys(s.avisos)) { s.avisos[l]--; if (s.avisos[l] <= 0) delete s.avisos[l]; }
      for (const tu of s.tuyos) tuyoFranja(s, tu, d, f);
      s.tuyosF = f;
    }
    const conmigo = s.duerme === "raso";
    const nt = [];
    for (const tu of s.tuyos) {
      if (tu.estado !== "vive") {
        if (tu.fin && tu.fin.dia === d && tu.estado === "malsino" && conmigo) {
          const lineas = [`${tu.nombre} no ha vuelto a la ribera. Dicen que ${tu.el ? "lo" : "la"} vieron hablando con el alguacil.`];
          // si contó también lo que has hurtado, en la ribera se sabe: desde ahora sabes que te buscan
          if (s.malsinado && s.malsinado.hurto && s.malsinado.dia === d && s.malsinado.por === tu.nombre) {
            lineas.push(`${tu.nombre} sabía lo del pan que cogiste. Si lo ha contado, te andarán buscando.`);
            if (s.buscado) s.buscadoSabe = true;
          }
          nt.push({ id: tu.id, nombre: tu.nombre, presente: false, lineas });
        }
        continue;
      }
      tu.duerme = tu.detenido ? "carcel" : L[tu.lugar].dentro ? "portal" : "raso";
      tu.durmio = tu.duerme;
      if (!L[tu.lugar].dentro && tu.lugar !== "ribera") tu.lugar = "ribera";
      const presente = conmigo && tu.duerme === "raso";
      const x = { id: tu.id, nombre: tu.nombre, presente, lineas: [], pide: 0, dado: 0, cuerpo: tu.cuerpo };
      if (!presente) { if (conmigo) x.lineas.push(`${tu.nombre} no ha vuelto a la ribera.`); nt.push(x); continue; }
      tu.noches++;
      if (tu.ayer) { x.lineas.push(tu.ayer); tu.ayer = null; }
      const rel = relatoTuyo(s, tu);
      x.relato = rel.lineas; x.items = rel.items;
      // el cuerpo se le nota por grados (j0.11): con 3, flaco; con 2, muy flaco; con 1, no se tiene en pie
      const a = tu.el ? "o" : "a";
      const grado = tu.cuerpo <= 1 ? "no se tiene en pie" : tu.cuerpo === 2 ? `se ${tu.el ? "le" : "la"} ve muy flac${a}` : tu.cuerpo === 3 ? `se ${tu.el ? "le" : "la"} ve flac${a}` : "";
      x.iPide = x.lineas.length; // lo que cuenta va antes de lo que pide
      if (tu.pan < 2) {
        x.pide = Math.min(TU.pide || 2, 2 - tu.pan);
        x.lineas.push(tu.pan === 0 ? `${tu.nombre} no ha sacado nada para cenar${grado ? ` y ${grado}` : ""}. Te pide pan.` : `${tu.nombre} solo tiene un pedazo${grado ? ` y ${grado}` : ""}. Te pide otro.`);
        // «¿Tampoco hoy?» solo si la última vez que te pidió se lo negaste teniendo pan
        if (TU.trato === "malsinar" && tu.avisado && tu.cuerpo <= TU.malsinarCuerpo) x.lineas.push(tu.ultimaNegada ? `${tu.nombre} te mira: «¿Tampoco hoy?».` : `${tu.nombre} te mira: «Acuérdate de lo que te dije».`);
      } else if (grado) x.lineas.push(tu.cuerpo <= 1 ? `${tu.nombre} no se tiene en pie.` : `A ${tu.nombre} se ${tu.el ? "le" : "la"} ve ${tu.cuerpo === 2 ? "muy " : ""}flac${a}.`);
      if (TU.devuelve && (tu.debe || 0) > 0 && s.pan < 2 && tu.pan >= 2) {
        tu.pan--; tu.debe--; s.pan++;
        x.lineas.push(`${tu.nombre} te da un pedazo: «Hoy por ti».`);
        apunta(s, "tuyos", `${tu.nombre} le da un pedazo.`);
      }
      // con trueque, la noche que te pide no cuenta nada hasta que le des
      if (TU.trueque && x.pide > 0) x.lineas.unshift(`${tu.nombre} no te cuenta nada: primero te pide pan.`);
      else contar(s, x);
      nt.push(x);
    }
    s.nocheTuyos = nt;
    s.panAntesReparto = s.pan;
  }
  // lo que cuenta, en sus palabras: lo que vio, cómo le fue y, a veces, algo que le han dicho
  function relatoTuyo(s, tu) {
    const d = s.dia, fr = (f) => R.FRANJAS[f].nombre.toLowerCase();
    const conf = TU.trato === "confianza" ? tu.confianza : 9;
    if (conf <= 0) return { lineas: [`${tu.nombre} no te cuenta nada.`], items: [] };
    const frases = [], items = [], sin = [];
    for (let f = 0; f < R.FRANJAS.length; f++) {
      const sinF = [];
      for (const g of tu.hoy.log.filter((x) => x.f === f)) {
        if (g.tipo === "pide") frases.push(`A ${fr(f)} pedí en ${L[g.lugar].nombre}: ${g.gana ? (g.gana === 1 ? "un pedazo" : g.gana + " pedazos") : "nada"}.`);
        else if (g.tipo === "echado") frases.push(`A ${fr(f)} me paró el alguacil en ${L[g.lugar].nombre} y me echó de la ciudad.`);
        else if (g.tipo === "detenido") frases.push(`A ${fr(f)} me cogió la ronda en ${L[g.lugar].nombre}.`);
        else if (g.tipo === "azotada") frases.push(`A ${fr(f)} me paró el alguacil en ${L[g.lugar].nombre}, me azotaron allí mismo y me echó de la ciudad.`);
        else if (g.tipo === "obras") frases.push(`A ${fr(f)} me paró el alguacil en ${L[g.lugar].nombre} y me mandó a cargar piedra a las obras hasta la noche, sin paga.`);
        else if (g.tipo === "trabajo") frases.push(`A ${fr(f)} me cogieron de peón en las obras: ${P.trabajo.paga} pedazos.`);
        else if (g.tipo === "hurto") frases.push(`A ${fr(f)} cogí pan de un puesto en ${L[g.lugar].nombre}. ` + (g.visto ? "Me vieron la cara: me andarán buscando." : g.perdona ? "El panadero me vio. Me miró y se volvió para otro lado." : "No me vio nadie."));
        else if (g.ronda) frases.push(`A ${fr(f)} vi la ronda en ${L[g.lugar].nombre}.`);
        else if (!sinF.includes(g.lugar)) sinF.push(g.lugar);
        if (!["echado", "detenido", "obras", "azotada"].includes(g.tipo)) items.push({ dia: d, f, lugar: g.lugar, ronda: !!g.ronda });
      }
      const sinR = sinF.filter((l) => !tu.hoy.log.some((x) => x.f === f && x.lugar === l && (x.tipo || x.ronda)));
      if (sinR.length) sin.push(`${listaY(sinR.map((l) => L[l].corto))} (${fr(f)})`);
    }
    if (sin.length) frases.push(`Sin ronda: ${sin.join(", ")}.`);
    let fin = frases, it = items;
    if (conf === 1) { fin = frases.filter((_, i) => i % 2 === 0); it = items.filter((_, i) => i % 2 === 0); } // trato «confianza»: cuenta la mitad
    const out = fin.length ? [`${tu.nombre}: «${fin.join(" ")}»`] : [`${tu.nombre} no tiene nada que contar.`];
    // algo que le han dicho otros pobres (puede estar mal)
    if (conf > 1 && mundo(s, `oidas|${tu.id}|${d}`) < TU.oidas) {
      const ff = [0, 1, 3, 4, 5][Math.floor(mundo(s, `oidasF|${tu.id}|${d}`) * 5)], real = s.rondas[`${d}|${ff}`];
      if (real) {
        const cierto = mundo(s, `oidasC|${tu.id}|${d}`) < TU.oidasCierto;
        const otros = DENTRO.filter((l) => l !== real);
        const dicho = cierto ? real : otros[Math.floor(mundo(s, `oidasL|${tu.id}|${d}`) * otros.length)];
        if (tu.hoy.log.some((g) => g.f === ff && g.lugar === dicho)) return { lineas: out, items: it }; // eso lo vio él: no hace falta que se lo digan
        out.push(`Dice que le han dicho que a ${fr(ff)} la ronda andaba por ${L[dicho].nombre}.`);
        it.push({ dia: d, f: ff, lugar: dicho, ronda: true, oidas: true });
      }
    }
    return { lineas: out, items: it };
  }
  const listaY = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
  // te lo cuenta: sus palabras van a la noche y lo que vio, a Recuerdos
  function contar(s, x) {
    if (x.contado) return;
    x.contado = true;
    if (TU.trueque && x.pide > 0) x.lineas = x.lineas.filter((l) => !l.endsWith("primero te pide pan."));
    x.lineas.splice(x.iPide != null ? x.iPide : x.lineas.length, 0, ...x.relato);
    s.contado = s.contado || [];
    for (const it of x.items) s.contado.push(Object.assign({ quien: x.nombre }, it));
  }
  function darPan(s, id, n) {
    if (s.fase !== "noche" || !s.nocheTuyos) return false;
    const x = s.nocheTuyos.find((y) => y.id === id && y.presente);
    if (!x || n <= 0 || n > s.pan || x.dado + n > x.pide) return false;
    const tu = s.tuyos.find((t) => t.id === id);
    s.pan -= n; tu.pan += n; tu.recibido += n; x.dado += n; tu.debe = (tu.debe || 0) + n;
    contar(s, x);
    apunta(s, "dar", `Da ${n === 1 ? "un pedazo" : n + " pedazos"} a ${tu.nombre}.`, { quien: id, n });
    return true;
  }
  // lo que cuenta al día siguiente aquel de los tuyos al que prendieron por ladrón: cómo fue y lo que le dijo el alcalde
  function cuentaPena(tu, como, soga) {
    const pena = tu.penaHurto;
    if (pena === "oreja") return `${tu.nombre} vuelve con un trapo atado a la cabeza: «${como}. Me han azotado y me han cortado la oreja».`;
    if (pena === "azotes") return `${tu.nombre}: «${como}. Me han sacado a la vergüenza y me ha azotado el verdugo. El alcalde dice que a la tercera, la soga».`;
    if (pena === "verguenza") return `${tu.nombre}: «${como}. Me han sacado a la vergüenza en un asno, con el pregonero delante. El alcalde ${soga ? "me levantó la camisa: que azotes ya llevo, y que a la segunda, la soga" : "dice que a la segunda, el verdugo"}».`;
    return `${tu.nombre}: «${como}».`; // galeras u horca: no vuelve a contarlo
  }
  // la noche de los tuyos: cenan lo suyo y lo que les diste, duermen donde les pilla, y deciden si te venden
  function tuyosNoche(s, lin) {
    const d = s.dia;
    for (const tu of s.tuyos) {
      if (tu.estado !== "vive") continue;
      const x = (s.nocheTuyos || []).find((y) => y.id === tu.id) || {};
      const antes = tu.cuerpo;
      let dc = 0, azotes = false;
      if (tu.azotesHoy) { dc += P.carcel.azotes * tu.azotesHoy; azotes = true; } // azotada por la calle (j0.11)
      if (tu.duerme === "carcel") {
        dc += P.carcel.cuerpo;
        if (tu.penaHurto) {
          const soga = HU.espalda === "acorta" && marcada(tu); // antes de la pena de hoy: si ya llevaba azotes
          if (!tu.galeras) { const x = penaNoche(tu, null); dc += x.dc; azotes = azotes || x.azotes; }
          tu.ayer = cuentaPena(tu, tu.detenido === "ladrón: hurtando" ? "Me cogieron con el pan en la mano" : "Me paró el alguacil: me buscaban por el pan que cogí", soga);
        } else {
        if (tu.detenciones === 2 && !tu.galeras) { dc += P.carcel.azotes; azotes = true; tu.azotado = true; tu.verdugo = true; }
        tu.ayer = `${tu.nombre}: «Ayer me cogió la ronda${azotes ? " y me azotaron" : ""}. He pasado la noche en la cárcel».`;
        }
      } else {
        const come = Math.min(2, tu.pan);
        tu.pan -= come; dc += P.cena[come];
        if (tu.obrasHoy || tu.trabajoHoy) dc -= P.trabajo.cansancio; // molido de cargar piedra (j0.11)
        if (tu.duerme === "portal") {
          const pidio = tu.hoy && tu.hoy.pide.some((p) => p.lugar === tu.lugar);
          let k = 0; for (let f = 0; f < R.FRANJAS.length; f++) if (estado(s, tu.lugar, d, f, tu.id).pobres) k++;
          const nivel = pidio ? "vigilada" : k >= P.nochePobresFranjas ? "pobres" : "tranquila";
          if (mundo(s, `tuyoNoche|${tu.id}|${d}`) < P.nocheDentro[nivel][tu.conocido ? 1 : 0]) {
            const ladron = !!tu.buscado;
            if (!ladron || HU.cuenta) tu.detenciones++;
            tu.conocido = true; tu.pan = 0; tu.durmio = "carcel";
            let ayerLadron = null;
            if (ladron) {
              const soga = HU.espalda === "acorta" && marcada(tu);
              tu.hurtos = (tu.hurtos || 0) + 1; tu.buscado = false; tu.penaHurto = penaHurto(s, tu.el, tu.hurtos, tu);
              if (tu.penaHurto === "galeras") tu.galeras = true; else { const x = penaNoche(tu, null); dc += x.dc; azotes = azotes || x.azotes; }
              ayerLadron = cuentaPena(tu, "Anoche la ronda me sacó de un portal. Me buscaban por el pan que cogí", soga);
            } else if (galeras(s, tu.el)) tu.galeras = true;
            else if (tu.detenciones === 2) { dc += P.carcel.azotes; azotes = true; tu.azotado = true; tu.verdugo = true; }
            tu.ayer = ayerLadron || `${tu.nombre}: «Anoche la ronda me sacó de un portal${azotes ? " y me azotaron" : ""}».`;
            tu.lugar = "puerta";
          } else tu.ayer = `${tu.nombre}: «Anoche dormí en un portal de ${L[tu.lugar].nombre}».`;
        }
      }
      // si le negaste pan teniéndolo y pasa hambre: la primera vez te avisa; luego puede venderte
      // la última vez que te pidió, ¿se lo negaste teniendo pan? (para lo que te dice la próxima vez)
      if (x.presente && x.pide > 0) tu.ultimaNegada = x.dado === 0 && s.panAntesReparto >= 1;
      if (x.presente && x.pide > 0 && x.dado === 0 && s.panAntesReparto >= 1) {
        tu.negadas++;
        if (TU.trato === "malsinar" && antes <= TU.malsinarCuerpo) {
          if (!tu.avisado) { tu.avisado = true; lin.push(`${tu.nombre}, antes de dormirse: «Tengo hambre, y el alguacil da pan al que le cuenta cosas».`); }
          else if (mundo(s, `malsinar|${tu.id}|${d}`) < TU.malsinar) tu.malsinaManana = true;
        }
        if (TU.trato === "confianza") tu.confianza = Math.max(0, tu.confianza - 1);
      } else if (x.presente && x.dado > 0 && TU.trato === "confianza") tu.confianza = Math.min((TU.confianza || {}).max || 3, tu.confianza + 1);
      tu.cuerpo = clamp(tu.cuerpo + dc, 0, P.cuerpoMax);
      const lo = tu.el ? "lo" : "la";
      if (tu.horca) {
        tuyoSeVa(s, tu, "ahorcado", d);
        if (x.presente || s.duerme === "raso") lin.push(`A ${tu.nombre} ${lo} han condenado a la horca por ladr${tu.el ? "ón" : "ona"}. Mañana ${lo} ahorcan.`);
      } else if (tu.galeras) {
        tuyoSeVa(s, tu, "galeras", d);
        if (x.presente || s.duerme === "raso") lin.push(`A ${tu.nombre} ${lo} han condenado a galeras. Mañana sale con la cadena de galeotes. No volverás a ver${lo}.`);
      } else if (tu.detenciones >= P.detencionesMax) {
        tuyoSeVa(s, tu, "desterrado", d);
        if (x.presente || s.duerme === "raso") lin.push(`A ${tu.nombre} ${lo} han desterrado de la ciudad. No volverás a ver${lo}.`);
      } else if (tu.cuerpo <= 0) {
        tuyoSeVa(s, tu, "muerto", d, azotes ? "muerto" : "hambre");
        if (s.duerme === "raso" && tu.duerme === "raso") lin.push(`${tu.nombre} no se ha despertado.`);
      }
    }
  }

  // qué ha sido de los tuyos al acabar: con quién llegas a la siega, o si mueres acompañado o solo
  function finTuyos(s, tipo) {
    const vivos = s.tuyos.filter((t) => t.estado === "vive");
    const otros = s.tuyos.filter((t) => t.estado !== "vive").map((t) => {
      const f = t.fin || {};
      if (t.estado === "muerto") return `${t.nombre} murió el día ${f.dia}`;
      if (t.estado === "desterrado") return `a ${t.nombre} ${t.el ? "lo" : "la"} desterraron el día ${f.dia}`;
      if (t.estado === "galeras") return `a ${t.nombre} ${t.el ? "lo" : "la"} mandaron a galeras el día ${f.dia}`;
      if (t.estado === "ahorcado") return `a ${t.nombre} ${t.el ? "lo" : "la"} ahorcaron el día ${f.dia}`;
      return `${t.nombre} te vendió al alguacil el día ${f.dia}`;
    });
    const resto = otros.length ? ` ${otros.join("; ").replace(/^./, (c) => c.toUpperCase())}.` : "";
    if (tipo === "siega" || tipo === "aguanta") {
      if (!vivos.length) return `Llegas solo a la siega.${resto}`;
      return `Llegáis a la siega tú y ${vivos.map((t) => t.nombre).join(" y ")}.${resto}`;
    }
    if (tipo === "desterrado") return vivos.length ? `${vivos.map((t) => t.nombre).join(" y ")} se ${vivos.length > 1 ? "quedan" : "queda"} en la ribera.${resto}` : `Te vas solo.${resto}`;
    if (tipo === "ahorcado") {
      const miran = vivos.filter((t) => !t.detenido);
      return miran.length ? `${miran.map((t) => t.nombre).join(" y ")} ${miran.length > 1 ? "están" : "está"} entre la gente. No ${miran.length > 1 ? "pueden" : "puede"} acercarse.${resto}` : `Entre la gente que mira no hay nadie que te conozca.${resto}`;
    }
    const contigo = vivos.filter((t) => s.duerme === "raso" && t.duerme === "raso");
    if (contigo.length) return `${contigo.map((t) => t.nombre).join(" y ")} ${contigo.length > 1 ? "estaban" : "estaba"} contigo.${resto}`;
    return `Mueres solo.${resto}`;
  }
  // ------------------------------------------------------------------ informe
  function resumenDias(s) {
    const T = { mover: 0, pedir: 0, trabajar: 0, esperar: 0, perdido: 0, hurtar: 0, pasos: 0, cruces: 0, libres: 0, pedidas: 0, panPedido: 0, panTrabajo: 0, panHurtado: 0, hurtos: 0, encuentros: 0, paradas: 0, rondaVista: 0 };
    s.porDia.forEach((d) => Object.keys(T).forEach((k) => (T[k] += d[k] || 0)));
    return T;
  }
  const DUERME = { carcel: "cárcel", portal: "portal", raso: "al raso", posada: "posada" };
  const FINALES = { ahorcado: "Ahorcado", siega: "Llega a la siega y le cogen", aguanta: "Llega a la siega y no le cogen", espiga: "Llega a la siega y espiga", hambre: "Muere de hambre", muerto: "Muere tras los azotes", desterrado: "Desterrado", galeras: "Condenado a galeras", abandona: "Abandona" };
  // lo que queda de tu gente, verano a verano (j0.11)
  function resumenCadena(s) {
    if (!s.cadena) return [];
    const out = [];
    for (const v of R.VERANOS) {
      const xs = s.cadena.anales.filter((a) => a.anio === v.anio).map((a) => a.texto);
      if (xs.length) out.push(`${v.anio}: ${xs.join(" ")}`);
    }
    return out;
  }

  function informe(s) {
    const m = R.MODOS[s.modo];
    const T = resumenDias(s);
    const ratos = T.mover + T.pedir + T.trabajar + T.esperar + T.perdido + T.hurtar || 1;
    const pct = (x) => Math.round((100 * x) / ratos) + " %";
    const L2 = [];
    const cad = !!s.conCadena;
    const fechaDe = (anio, d) => ((VERANO[anio || 1545] || {}).calendario || R.CALENDARIO)[d - 1].fecha;
    L2.push("LIBER VAGATORUM · EL JUGUETE · INFORME");
    L2.push(`Jugador: ${s.jugador || "anónimo"}`);
    L2.push(`Versión: ${s.v} · ${m.nombre} · semilla ${s.semilla}${s.semillaFija ? " (fija)" : ""}`);
    L2.push(`Empezada: ${s.empezada}`);
    if (cad && s.final && s.final.cadena) L2.push(`Final: tu gente, de ${s.final.cadena.desde} a ${s.final.cadena.hasta}. El último, ${s.final.cadena.quien}: ${(FINALES[s.final.tipo] || s.final.tipo).toLowerCase()}, día ${s.final.dia} de ${s.final.cadena.hasta}. ${s.final.texto}`);
    else L2.push(`Final: ${s.final ? `${FINALES[s.final.tipo] || s.final.tipo}, día ${s.final.dia}${cad ? " de " + s.anio : ""}. ${s.final.texto}` : "sin acabar"}`);
    L2.push(`Cuerpo al final: ${s.cuerpo} · detenciones: ${s.detenciones} · llaga: ${!s.conLlaga ? "no activada" : s.llaga < 0 ? "activada; se la hizo otro verano" : s.llaga ? "activada; se la hizo la noche del día " + s.llaga : "activada; no se la hizo"} · los tuyos: ${s.conTuyos ? "activados" : "no activados"} · varios veranos: ${cad ? `activado (va por ${s.anio}, juega ${s.quien.nombre})` : "no activado"} · hurtar: ${s.conHurto ? "activado" : "no activado"}${s.conTretas ? " · tretas: activadas" : ""}${s.conPresion ? " · presión: activada" : ""}`);
    L2.push("");
    L2.push("== Encuesta ==");
    const E = s.encuesta || {};
    L2.push(`1. Qué decisión le dolió o le costó: ${E.dolio || "—"}`);
    L2.push(`2. Cómo decidía adónde ir: ${E.ir || "—"}`);
    L2.push(`3. Si le sorprendió la ronda, mala decisión suya o mala suerte: ${E.sorpresa || "—"}`);
    L2.push(`4. Qué sobraba, estorbaba o no entendió: ${E.sobro || "—"}`);
    L2.push(`5. Otros: ${E.otros || "—"}`);
    if (cad) L2.push(`6. Si pesó saber que seguiría como uno de los tuyos: ${E.cadena || "—"}`);
    if (s.conHurto) L2.push(`${cad ? 7 : 6}. Cuándo decidió hurtar, o no hacerlo, y por qué: ${E.hurto || "—"}`);
    if (s.conTretas) L2.push(`${6 + (cad ? 1 : 0) + (s.conHurto ? 1 : 0)}. Qué tretas usó, por qué esas y cuáles dejó: ${E.tretas || "—"}`);
    L2.push("");
    if (cad) {
      L2.push("== La cadena ==");
      resumenCadena(s).forEach((x) => L2.push(x));
      for (const h of s.heredados || []) L2.push(`Heredó a ${h.nombre} (${h.manera}) en ${h.anio}: le había dado ${h.recibido} pedazos, se lo negó ${h.negadas} ${h.negadas === 1 ? "vez" : "veces"}, ${h.noches} noches juntos, llegó con ${h.detenciones} ${h.detenciones === 1 ? "detención" : "detenciones"}.`);
      L2.push("");
    }
    L2.push("== Para los criterios de la prueba ==");
    L2.push(`Tiempo: moverse ${pct(T.mover)} · pedir ${pct(T.pedir)} · trabajar ${pct(T.trabajar)} · esperar o acabar antes ${pct(T.esperar)} · perdido ${pct(T.perdido)}${s.conHurto ? ` · hurtar ${pct(T.hurtar)}` : ""}`);
    if (s.modo === "A") L2.push(`Pasos: ${T.pasos} (${(T.pasos / Math.max(1, s.porDia.length)).toFixed(1)} por día)`);
    else L2.push(`Cruces de barrio: ${T.cruces} (${(T.cruces / Math.max(1, s.porDia.length)).toFixed(1)} por día) · movimientos dentro del barrio: ${T.libres}`);
    L2.push(`Pedir: ${T.pedidas} veces, ${T.panPedido} pedazos · trabajo: ${T.panTrabajo} pedazos${s.conHurto ? ` · hurtar: ${T.hurtos} ${T.hurtos === 1 ? "vez" : "veces"}, ${T.panHurtado} pedazos` : ""}`);
    L2.push(`Llegó donde estaba la ronda: ${T.encuentros} veces (le pararon ${T.paradas}) · vio llegar la ronda estando quieto: ${T.rondaVista}`);
    // con la cadena, lo de los veranos anteriores está en el archivo (siguienteVerano vacía vistas y contado)
    const archivo = cad ? s.cadena.archivo : [];
    const vistasTodas = archivo.reduce((n, a) => n + (a.vistas || []).length, 0) + (s.vistas || []).length;
    L2.push(`Abrió «Lo que recuerdas»: ${s.recuerdaAbierto || 0} veces · vio la ronda en ${vistasTodas} franjas`);
    const det = s.cronica.filter((c) => c.tipo === "detenido");
    if (det.length) L2.push("Detenciones: " + det.map((c) => `día ${c.dia}${cad ? " de " + c.anio : ""}, ${c.motivo}`).join(" · "));
    L2.push("");
    if (s.conHurto) {
      L2.push("== Hurtar y la horca ==");
      const hs = s.cronica.filter((c) => c.tipo === "hurto");
      const VIO = { no: "nadie le ve", perdona: "le ven y miran a otro lado", huye: "le ven y escapa (le buscan)", prendido: "le ven y le cogen", ronda: "le coge la ronda" };
      if (!hs.length) L2.push("No hurtó.");
      for (const c of hs) L2.push(`${cad ? c.anio + " · " : ""}día ${c.dia}, ${nombreFranja(c.f).toLowerCase()}, ${L[c.lugar].corto}: cuerpo ${c.cuerpo}, ${c.panAntes} ${c.panAntes === 1 ? "pedazo" : "pedazos"} encima, ${c.gente} gente${c.ronda ? ", la ronda delante" : ""} · ${VIO[c.visto] || c.visto}`);
      const pr = s.cronica.filter((c) => c.tipo === "prendido");
      const PENA = { verguenza: "a la vergüenza", azotes: "vergüenza y azotes", oreja: "azotes y oreja", horca: "la horca", galeras: "galeras" };
      if (pr.length) L2.push("Prendido por ladrón: " + pr.map((c) => `${cad ? c.anio + ", " : ""}día ${c.dia} (${c.motivo}): ${PENA[c.pena] || c.pena}`).join(" · "));
      if (s.malsinado && s.malsinado.hurto) L2.push(`${s.malsinado.por} contó también sus hurtos al alguacil el día ${s.malsinado.dia}.`);
      if (s.conTuyos) for (const tu of s.tuyos.concat(s.heredados || [])) if (tu.hurtosHechos) L2.push(`${tu.nombre} hurtó ${tu.hurtosHechos} ${tu.hurtosHechos === 1 ? "vez" : "veces"}.`);
      L2.push("");
    }
    if (s.conTretas) {
      L2.push("== Tretas ==");
      L2.push(`Blancas al final: ${s.blancas} · le quitó la ronda: ${s.blancasQuitadas || 0} · lleva: ${s.mazo.map((id) => TT[id].nombre).join(", ") || "ninguna"}`);
      for (const [id, x] of Object.entries(s.tretasLog)) L2.push(`${TT[id].nombre}: desde ${x.desde || "—"}${x.compras ? ` (comprada ${x.compras} ${x.compras === 1 ? "vez" : "veces"})` : ""} · la usó ${x.usos} ${x.usos === 1 ? "vez" : "veces"}: ${x.pan} pedazos y ${x.blancas} blancas · le pillaron con ella ${x.pillado} · le descubrió la ronda ${x.descubierta}${x.catalogada ? ` · catalogada (${x.catalogada})` : ""}`);
      if (s.quemadas.length) L2.push(`Pregonadas en veranos anteriores: ${s.quemadas.map((id) => TT[id].nombre).join(", ")}`);
      const cuenta = (tipo) => s.cronica.filter((c) => c.tipo === tipo).length;
      L2.push(`Pan comprado: ${cuenta("panCompra")} · pan vendido: ${cuenta("panVenta")} · ofertas en la ribera: ${cuenta("aprende")} aceptadas · le robaron la ropa buena: ${cuenta("robada")}`);
      L2.push("");
    }
    if (s.conPresion) {
      L2.push("== La ciudad se endurece ==");
      const cs = s.cronica.filter((c) => c.tipo === "corchete");
      L2.push(cs.length ? cs.map((c) => `${cad ? c.anio + ", " : ""}día ${c.dia}: ${c.texto}`).join(" · ") : "No pusieron corchetes.");
      const enc = s.cronica.filter((c) => c.tipo === "encuentro" && c.corchete).length;
      L2.push(`Llegó donde vigilaba un corchete: ${enc} ${enc === 1 ? "vez" : "veces"}${s.conTretas ? ` · noches en la posada: ${s.cronica.filter((c) => c.tipo === "posada").length}` : ""}`);
      L2.push("");
    }
    if (s.conTuyos) {
      L2.push("== Los tuyos ==");
      for (const tu of s.tuyos) {
        const fd = `el día ${(tu.fin || {}).dia}${cad ? " de " + (tu.fin || {}).anio : ""}`;
        const est = { ahorcado: `ahorcado ${fd}`, vive: `vive, cuerpo ${tu.cuerpo}`, muerto: `murió ${fd}`, desterrado: `desterrado ${fd}`, galeras: `a galeras ${fd}`, malsino: `te malsinó ${fd}` }[tu.estado];
        L2.push(`${tu.nombre} (${tu.manera}): ${est} · detenciones ${tu.detenciones} · noches juntos ${tu.noches} · pan que le diste ${tu.recibido} · se lo negaste ${tu.negadas} ${tu.negadas === 1 ? "vez" : "veces"}${tu.avisado ? " · te avisó de que te vendería" : ""}`);
      }
      const c = s.contado || [];
      const nC = archivo.reduce((n, a) => n + (a.nContado != null ? a.nContado : (a.contado || []).length), 0) + c.length;
      const nR = archivo.reduce((n, a) => n + (a.contado || []).length, 0) + c.filter((x) => x.ronda).length;
      const nO = archivo.reduce((n, a) => n + (a.nOidas || 0), 0) + c.filter((x) => x.oidas).length;
      L2.push(`Te contaron ${nC} cosas (${nR} con la ronda; ${nO} de oídas)${s.malsinado ? ` · te malsinó ${s.malsinado.por} el día ${s.malsinado.dia}` : ""}`);
      L2.push("");
    }
    L2.push("== Por día ==");
    L2.push((cad ? "año | " : "") + "día | mover | pedir | trabajar | esperar | " + (s.modo === "A" ? "pasos" : "cruces") + " | sitios | pan pedido | pan trabajo | " + (s.conHurto ? "pan hurtado | " : "") + (s.conTretas ? "tretas | blancas | " : "") + "come | duerme | cuerpo | ronda al llegar");
    s.porDia.forEach((d) => {
      L2.push(`${cad ? d.anio + " | " : ""}${d.dia} | ${d.mover} | ${d.pedir} | ${d.trabajar} | ${d.esperar + d.perdido} | ${s.modo === "A" ? d.pasos : d.cruces} | ${d.lugares} | ${d.panPedido} | ${d.panTrabajo} | ${s.conHurto ? (d.panHurtado || 0) + " | " : ""}${s.conTretas ? (d.tretas || 0) + " | " + (d.blancas || 0) + " | " : ""}${d.comido} | ${DUERME[d.duerme]}${d.detenido ? " (" + d.detenido + ")" : ""} | ${d.cuerpoNoche} | ${d.encuentros}`);
    });
    L2.push("");
    L2.push("== Crónica ==");
    let diaAct = 0, anioAct = null;
    s.cronica.forEach((c) => {
      if (c.dia !== diaAct || c.anio !== anioAct) { diaAct = c.dia; anioAct = c.anio; L2.push(`-- ${cad ? c.anio + " · " : ""}Día ${c.dia} (${fechaDe(c.anio, c.dia)}) --`); }
      L2.push(`${momentoTxt(c.t)} · ${c.texto}`);
    });
    L2.push("");
    L2.push("== Dónde estuvo la ronda (el jugador no lo veía) ==");
    const veranos = (cad ? s.cadena.archivo : []).concat([{ anio: s.anio, circuito: circuitoDia(s, 1), rondas: s.rondas, rondasPorque: s.rondasPorque, hasta: s.dia }]);
    for (const v of veranos) {
      const cv = v.circuito;
      L2.push(`${cad ? v.anio + ". " : ""}Costumbres de este verano: por la mañana, ${L[cv[0]].nombre}; a nona, ${L[cv[3]].nombre}; a vísperas, ${L[cv[4]].nombre}; al anochecer cierra la ${L[cv[5]].nombre}.`);
      for (let d = 1; d <= (v.hasta || R.DIAS); d++) {
        if (!R.FRANJAS.some((fr, f) => `${d}|${f}` in v.rondas)) continue;
        const fila = R.FRANJAS.map((fr, f) => {
          const k = `${d}|${f}`;
          if (!(k in v.rondas)) return `${fr.nombre}: —`;
          const p = v.rondas[k];
          return `${fr.nombre}: ${p ? L[p].corto : "comiendo"}${v.rondasPorque[k] === "aviso" ? " (aviso)" : v.rondasPorque[k] === "aprendido" ? " (tu costumbre)" : ""}`;
        });
        L2.push(`Día ${d}: ` + fila.join(" · "));
      }
    }
    L2.push("");
    L2.push("== Datos en bruto ==");
    L2.push(JSON.stringify(Object.assign({ v: s.v, modo: s.modo, semilla: s.semilla, circuito: s.circuito, conTuyos: !!s.conTuyos,
      tuyos: s.conTuyos ? s.tuyos.map((tu) => ({ id: tu.id, estado: tu.estado, fin: tu.fin, cuerpo: tu.cuerpo, detenciones: tu.detenciones, noches: tu.noches, recibido: tu.recibido, negadas: tu.negadas, avisado: tu.avisado })) : null,
      final: s.final, porDia: s.porDia, encuesta: s.encuesta, rondas: s.rondas, rondasPorque: s.rondasPorque, habitos: s.habitos, vistas: s.vistas, recuerdaAbierto: s.recuerdaAbierto, conLlaga: !!s.conLlaga, llaga: s.llaga || null },
      s.conTretas ? { tretas: { blancas: s.blancas, mazo: s.mazo, log: s.tretasLog, quemadas: s.quemadas, catalogadas: s.catalogadas, quitadas: s.blancasQuitadas || 0 } } : {},
      cad ? { cadena: { anio: s.anio, quien: s.quien, anales: s.cadena.anales, vidas: s.cadena.vidas, heredados: s.heredados || [], circuitos: s.cadena.archivo.map((a) => ({ anio: a.anio, circuito: a.circuito })) } } : {})));
    return L2.join("\n");
  }

  window.ENGINE = {
    FIN, L, VECINOS, DEL_BARRIO, CRUCES, BARRIO, GENTE_TXT, FINALES,
    franja, ratoEnFranja, nombreFranja, dia, estado, zonaDe, lugaresZona, rondaAhora, rondaEnTuZona, edad,
    nueva, opciones, previsionPedir, mover, pedir, pedirTrabajo, esperar, acabarDia, seguir, comprobarNoche, cenar, circuitoDia,
    informe, resumenDias, momentoTxt, riesgoNoche, saberNoche, puedeLlaga, hacerLlaga, cuerpoMax,
    darPan, tuyosEn, tuyosVivos, hayQuejas, DIST, PUERTAS,
    // hurtar y la horca (j0.12)
    puedeHurtar, hurtar, probVisto, penaHurto, puedeRestituir, restituir, franjasHurto,
    // la cadena de veranos (j0.11)
    calendario, escasez, escasezDesde, esHombre, elegirHeredero, siguienteVerano, resumenCadena, recorridoVerano,
    // jueves de mercado y textos de cada verano (j0.13)
    mercado, genteDelDia, descLugar, verano,
    // las tretas (rama claude/tretas)
    TT, tretaAqui, previsionTreta, pedirCon, catalogada, puedeUsarla, ofertaTxt, aprender, olvidar, tiendaAqui, comprar, mercadoPan,
    comprarPan, venderPan, puedeQuitar, quitar, citasPosibles, quedar, citaTxt,
    // la ciudad se endurece (prototipo) y la posada
    corcheteEn, puedePosada, pagarPosada,
    empezarJornada(s) { if (s.fase === "amanecer") { s.fase = "dia"; s.noche = null; } },
  };
})();
