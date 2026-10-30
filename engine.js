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
  const mundo = (s, clave) => hash(`${s.semilla}|${clave}`);
  const tirar = (s, clave) => hash(`${s.semilla}|acc|${s.n++}|${clave}`);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const LL = P.llaga || {};
  const cuerpoMax = (s) => (s.llaga ? LL.cuerpoMax : P.cuerpoMax);

  // ------------------------------------------------------------------ tiempo
  const franja = (t) => Math.min(R.FRANJAS.length - 1, Math.floor(t / R.RATOS));
  const ratoEnFranja = (t) => (t >= FIN ? R.RATOS : t % R.RATOS);
  const nombreFranja = (f) => R.FRANJAS[f].nombre;
  const dia = (s, d) => R.CALENDARIO[(d || s.dia) - 1];

  // ------------------------------------------------------------------ el mundo
  function gente(s, lugar, d, f) {
    const l = L[lugar];
    let g = l.gente[f];
    const mod = R.DIAS_SENALADOS[R.CALENDARIO[d - 1].tipo];
    if (mod && mod[lugar] && mod[lugar][f] != null) g = mod[lugar][f];
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
    if (R.CALENDARIO[d - 1].tipo !== "laborable" && ["catedral", "sanmartin", "sanesteban"].includes(lugar)) p += 0.2;
    return mundo(s, `pobres|${d}|${f}|${lugar}`) < p;
  }
  function estado(s, lugar, d, f) {
    const g = gente(s, lugar, d, f);
    const pobres = hayPobres(s, lugar, d, f);
    const da = g <= 1 ? 1 : Math.max(1, g - (pobres ? 1 : 0)); // gente que de verdad da
    const trabajo = !!L[lugar].trabajo && f === 0 && R.CALENDARIO[d - 1].tipo === "laborable";
    return { gente: g, pobres, da, trabajo };
  }

  // ------------------------------------------------------------------ la ronda
  function rondaFranja(s, d, f) {
    const k = `${d}|${f}`;
    if (k in s.rondas) return s.rondas[k];
    const tipo = R.CALENDARIO[d - 1].tipo;
    const circ = (tipo === "corpus" ? R.RONDA.circuitoCorpus : R.RONDA.circuito)[f];
    let max = 0, donde = null, cuando = -1;
    for (const [l, n] of Object.entries(s.avisos)) {
      const tl = s.avisosT[l] || 0;
      if (n > max || (n === max && n > 0 && tl > cuando)) { max = n; donde = l; cuando = tl; }
    }
    // la ronda aprende: donde te han visto pedir a esta misma hora en varios días, vuelve
    const ap = R.RONDA.aprende;
    let aprendido = null, nmax = 0;
    if (ap) for (const [l, dias] of Object.entries((s.habitos || {})[f] || {})) if (dias.length >= ap.minDias && dias.length > nmax) { nmax = dias.length; aprendido = l; }
    let pos, porque;
    if (donde && mundo(s, `rondaP|${k}`) < R.RONDA.persigue[Math.min(3, max)]) { pos = donde; porque = "aviso"; }
    else if (circ === null) { pos = null; porque = "come"; }
    else if (aprendido && mundo(s, `rondaA|${k}`) < ap.prob) { pos = aprendido; porque = "aprendido"; }
    else if (mundo(s, `rondaD|${k}`) < R.RONDA.desvio) { pos = DENTRO[Math.floor(mundo(s, `rondaL|${k}`) * DENTRO.length)]; porque = "desvío"; }
    else { pos = circ; porque = "recorrido"; }
    s.rondas[k] = pos;
    s.rondasPorque[k] = porque;
    return pos;
  }
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
      conLlaga: !!(opts && opts.llaga), // la llaga se activa al empezar (prueba de fingir)
    };
    empezarDia(s);
    s.noche = null;
    return s;
  }
  function nuevoHoy() {
    return { mover: 0, pedir: 0, trabajar: 0, esperar: 0, perdido: 0, pasos: 0, cruces: 0, libres: 0, pedidas: 0,
      panPedido: 0, panTrabajo: 0, encuentros: 0, paradas: 0, rondaVista: 0, lugares: {} };
  }
  function empezarDia(s) {
    s.t = 0; s.avisos = {}; s.avisosT = {}; s.pedidoHoy = []; s.trabajoHoy = false; s.trabajoPedido = false;
    s.detenidoHoy = null; s.hoy = nuevoHoy(); s.aviso = null; s.fase = "amanecer";
    rondaFranja(s, s.dia, 0);
    observar(s);
  }
  function apunta(s, tipo, texto, datos) {
    s.cronica.push(Object.assign({ dia: s.dia, t: s.t, tipo, texto, lugar: s.lugar }, datos || {}));
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
      for (const d of VECINOS[s.lugar]) {
        movs.push({ id: d, destino: d, tipo: "paso", coste: m.paso, ok: quedan >= m.paso, porque: quedan >= m.paso ? "" : "no te da tiempo" });
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
      if (!e || !e.trabajo) pt = R.CALENDARIO[s.dia - 1].tipo !== "laborable" ? "hoy es fiesta: no hay obra" : "solo cogen peones a prima";
      else if (s.trabajoPedido) pt = "ya has preguntado hoy";
      acc.push({ id: "trabajo", ok: !pt, porque: pt, coste: P.trabajo.pedirRatos });
    }
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
    if (s.t % R.RATOS !== 0) out.push("Empiezas a mitad de franja: la ronda puede llegar mientras pides.");
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
    observar(s);
    apunta(s, "mover", `${L[desde].corto} → ${L[destino].corto}`, { coste: mv.coste, tipoMov: mv.tipo, t: t0 });
    s.aviso = null;
    if (s.t >= FIN) { s.aviso = { texto: `Llegas a ${L[destino].nombre} ya de noche.`, tono: "neutro" }; return true; }
    const r = rondaEnTuZona(s);
    if (r && zonaDe(s, destino) !== zonaAntes) {
      s.hoy.encuentros++;
      // la llaga te protege mientras el alguacil no se haya hecho a ella (LL.protege veces; 0: siempre)
      const cubre = s.llaga && (!LL.protege || (s.llagaPasadas || 0) < LL.protege);
      const p = (s.conocido ? P.pararAlLlegar.conocido : P.pararAlLlegar.desconocido) * (cubre ? LL.parar : 1);
      const donde = r === destino ? "aquí" : `en ${L[r].nombre}`;
      apunta(s, "encuentro", `Llega a ${L[destino].corto} y la ronda está ${donde}.`);
      if (tirar(s, "parar") < p) { parar(s, r); return true; }
      if (cubre) s.llagaPasadas = (s.llagaPasadas || 0) + 1;
      s.aviso = { texto: cubre ? `La ronda está ${donde}. El alguacil te mira la pierna y sigue su camino.` : `La ronda está ${donde}. Pasas sin que te paren.`, tono: "mal" };
    } else if (mv.tipo !== "libre") {
      s.aviso = { texto: `Llegas a ${L[destino].nombre}.`, tono: "neutro" };
    }
    return true;
  }

  function parar(s, r) {
    s.hoy.paradas++;
    const sabia = s.rondasPorque[`${s.dia}|${franja(s.t)}`] === "aprendido";
    const pierna = s.llaga && LL.protege && (s.llagaPasadas || 0) >= LL.protege;
    if (s.conocido) {
      detener(s, "parado", [pierna ? "El alguacil se planta delante: «Otra vez tú, el de la pierna. Esa llaga ya me la sé». Te llevan a la cárcel."
        : sabia ? "El alguacil te reconoce: «Sabía que te encontraría aquí». Te llevan a la cárcel." : "El alguacil te reconoce: ya te tenían visto. Te llevan a la cárcel."]);
      return;
    }
    s.conocido = true;
    const antes = s.lugar;
    pasar(s, 3, "perdido", false);
    s.lugar = "puente";
    observar(s);
    apunta(s, "echado", `Te para la ronda en ${L[antes].corto} y te echan de la ciudad.`);
    resultado(s, "Te para la ronda", [
      // la cuarta vez con la llaga, aunque aún no te tenga fichado, el alguacil ya se la sabe
      pierna ? `En ${L[r].nombre} te para el alguacil: «Otra vez tú, el de la pierna. Esa llaga ya me la sé». Le dices de dónde eres y adónde vas.`
        : sabia ? `En ${L[r].nombre} te para el alguacil: «Sabía que te encontraría aquí». Le dices de dónde eres y adónde vas.` : `En ${L[r].nombre} te para el alguacil. Le dices de dónde eres y adónde vas.`,
      "No te detiene: te acompaña hasta la puerta y te echa al puente. Pierdes media franja.",
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
    if (s.detenciones >= P.detencionesMax) extra.push(`Detención ${s.detenciones} de ${P.detencionesMax}: mañana te sacan de la ciudad con destierro.`);
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
    const r0 = rondaEnTuZona(s);
    const aviso = L[lugar].aviso;
    const avisoPrevio = s.avisos[lugar] || 0;
    if (aviso) {
      s.avisos[lugar] = avisoPrevio + aviso; s.avisosT[lugar] = s.dia * 100 + t0;
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
    const r1zona = r1 && !porTuAviso && zonaDe(s, r1) === zonaDe(s, lugar) ? r1 : null;
    const pP = (e) => P.pillarPidiendo[e.da >= 3 ? 3 : 2] * (s.llaga ? LL.pillar : 1);
    let pillado = null;
    if (r0 && tirar(s, "pillar0") < pP(e0) * seg1 / R.RATOS) pillado = "estaba";
    if (!pillado && r1zona && tirar(s, "pillar1") < pP(estado(s, lugar, s.dia, f0 + 1)) * seg2 / R.RATOS) pillado = "llega";
    const tir = Math.min(6, 1 + Math.floor(tirar(s, "limosna") * 6) + (s.llaga ? LL.limosna : 0));
    const tabla = s.dia >= P.escasezDesde ? P.limosnaEscasez : P.limosna;
    const gana = tabla[e0.da >= 3 ? 3 : 2][tir - 1];
    if (pillado) {
      const donde = r0 && pillado === "estaba" ? r0 : r1zona;
      const l1 = pillado === "llega"
        ? `Estás pidiendo en ${L[lugar].nombre} cuando aparece la ronda${donde !== lugar ? ` por ${L[donde].nombre}` : ""}. Te ve con la mano tendida.`
        : `Pides en ${L[lugar].nombre} con la ronda ${donde === lugar ? "delante" : "en el barrio"}. Te ve.`;
      apunta(s, "pillado", `Empieza a pedir en ${L[lugar].corto}. ${l1}`, { pillado, t: t0 });
      const kp = `${s.dia}|${pillado === "llega" ? f0 + 1 : f0}`;
      const lin = [l1];
      if (s.rondasPorque[kp] === "aprendido") lin.push("«Sabía que te encontraría aquí», dice el alguacil.");
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
    if (r1zona && seg2 > 0) lin.push(`Mientras pedías ha llegado la ronda${r1zona !== lugar ? ` (${L[r1zona].corto})` : ""}, pero no te ha visto.`);
    else if (rFin) lin.push(`Al acabar, ves llegar a la ronda${rFin !== lugar ? ` a ${L[rFin].nombre}` : ""}.${s.rondasPorque[`${s.dia}|${franja(s.t)}`] === "aviso" && rFin === lugar ? " Alguien ha avisado." : ""}`);
    if (aviso === 0) lin.push("Nadie va a avisar.");
    else if (!rFin) lin.push(aviso >= 2 ? "Te han visto, y aquí avisan enseguida." : "Alguien te ha visto.");
    apunta(s, "pedir", `Pide en ${L[lugar].corto} (${GENTE_TXT[e0.da]}): ${gana} ${gana === 1 ? "pedazo" : "pedazos"}.`, { gana, da: e0.da, t: t0 });
    resultado(s, gana ? "Te dan algo" : "Nada", lin, gana ? "bien" : "neutro");
    return true;
  }

  function pedirTrabajo(s) {
    const a = opciones(s).acc.find((x) => x.id === "trabajo");
    if (!a || !a.ok) return false;
    const t0 = s.t;
    s.trabajoPedido = true;
    pasar(s, P.trabajo.pedirRatos, "trabajar", true);
    const p = s.llaga ? 0 : P.trabajo.probPorCuerpo[s.cuerpo] || 0;
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
      const linea = s.llaga ? "El capataz te ve la pierna: «¿Con eso vas a cargar piedra? Vete a pedir, que es lo tuyo.»"
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
    s.aviso = r
      ? { texto: `Empieza ${nombreFranja(franja(s.t)).toLowerCase()}. ${llegadas.length ? "Llega" : "Sigue"} la ronda ${r === s.lugar ? "aquí" : "en " + L[r].nombre}.`, tono: "mal" }
      : { texto: `Empieza ${nombreFranja(franja(s.t)).toLowerCase()}.`, tono: "neutro" };
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
    if (s.bajaRibera) s.lugar = "ribera";
    // en la ribera duerme el viejo de la llaga: cuántas noches lo has tenido al lado
    if (puedeLlaga(s)) s.viejo = (s.viejo || 0) + 1;
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
      if (s.detenciones === 2) { dc += P.carcel.azotes; azotes = true; lin.push("Antes de soltarte, te azotan."); }
    } else {
      comido = clamp(n | 0, 0, Math.min(2, s.pan));
      s.pan -= comido;
      dc += P.cena[comido];
      lin.push(comido === 2 ? "Cenas una ración entera." : comido === 1 ? "Cenas media ración." : "Te acuestas sin cenar.");
      if (s.trabajoHoy) { dc -= P.trabajo.cansancio; lin.push("Estás molido del trabajo."); }
      if (s.duerme === "portal") {
        const rn = riesgoNoche(s);
        const p = P.nocheDentro[rn.nivel][s.conocido ? 1 : 0] * (s.llaga ? LL.noche : 1);
        s.hoy.nocheNivel = rn.nivel;
        if (tirar(s, "noche") < p) {
          detenidoNoche = true;
          s.detenciones++;
          s.conocido = true;
          const pan = s.pan; s.pan = 0;
          lin.push(`De madrugada, la ronda te encuentra durmiendo en un portal de ${L[s.lugar].nombre}. Te llevan a la cárcel${pan ? " y te quitan el pan" : ""}.`);
          // no lo explica el juego: lo dice el alguacil, y solo cuando hay algo que decir
          if (rn.nivel === "vigilada") lin.push("«Ya me han dicho que andabas pidiendo por aquí», dice el alguacil.");
          else if (rn.nivel === "pobres") lin.push("«Venimos a limpiar esto de pordioseros. Tú también vienes», dice el alguacil.");
          apunta(s, "detenido", `Detenido de noche en ${L[s.lugar].corto}. Detención ${s.detenciones} de ${P.detencionesMax}.`, { motivo: "de noche" });
          if (s.detenciones === 2) { dc += P.carcel.azotes; azotes = true; lin.push(`Detención 2 de ${P.detencionesMax}: te azotan. A la tercera, destierro.`); }
          else if (s.detenciones === 1) lin.push(`Detención 1 de ${P.detencionesMax}. A la segunda, azotes; a la tercera, destierro. Ya te tienen fichado.`);
        } else lin.push(`Duermes en un portal de ${L[s.lugar].nombre}. Nadie te molesta.`);
      } else lin.push("Duermes al raso en la ribera.");
    }
    if (s.llaga && s.llaga === s.dia) { dc += LL.cuerpo; lin.push("La llaga te da fiebre toda la noche."); }
    else if (s.llaga && LL.encona && tirar(s, "encona") < LL.encona) { dc -= 1; lin.push("La llaga se te ha enconado: supura y te sube la fiebre."); }
    s.cuerpo = clamp(s.cuerpo + dc, 0, cuerpoMax(s));
    s.porDia.push(Object.assign({ dia: s.dia, modo: s.modo, cuerpoNoche: s.cuerpo, comido, duerme: s.duerme, detenido: s.detenidoHoy || (detenidoNoche ? "de noche" : null) }, s.hoy, { lugares: Object.keys(s.hoy.lugares).length }));
    apunta(s, "noche", `Noche (${DUERME[s.duerme]}${s.hoy.nocheNivel ? ", " + s.hoy.nocheNivel : ""}): come ${comido}, cuerpo ${antes} → ${s.cuerpo}.`);
    s.noche = { lineas: lin, antes, despues: s.cuerpo, dia: s.dia, detenido: s.duerme === "carcel" || detenidoNoche };
    // finales
    if (s.detenciones >= P.detencionesMax) {
      return fin(s, "desterrado", "Te sacan de Salamanca con destierro. Si vuelves, la horca.");
    }
    if (s.cuerpo <= 0) {
      return fin(s, azotes ? "muerto" : "hambre", azotes ? "No aguantas los azotes con el cuerpo tan gastado. Mueres antes del amanecer." : "Mueres de hambre.");
    }
    if (s.dia >= R.DIAS) {
      // la siega: el mayoral mira los brazos antes de dar la hoz
      if (s.llaga) return fin(s, "aguanta", "Al amanecer empieza la siega. El mayoral te ve la pierna y pasa de largo sin mirarte los brazos. Has aguantado, y tu llaga te seguirá dando de comer en la ciudad.");
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
    s.final = { tipo, dia: s.dia, texto };
    s.fase = "fin";
    apunta(s, "fin", texto);
    return true;
  }

  // ------------------------------------------------------------------ informe
  function resumenDias(s) {
    const T = { mover: 0, pedir: 0, trabajar: 0, esperar: 0, perdido: 0, pasos: 0, cruces: 0, libres: 0, pedidas: 0, panPedido: 0, panTrabajo: 0, encuentros: 0, paradas: 0, rondaVista: 0 };
    s.porDia.forEach((d) => Object.keys(T).forEach((k) => (T[k] += d[k] || 0)));
    return T;
  }
  const DUERME = { carcel: "cárcel", portal: "portal", raso: "al raso" };
  const FINALES = { siega: "Llega a la siega y le cogen", aguanta: "Llega a la siega y no le cogen", hambre: "Muere de hambre", muerto: "Muere tras los azotes", desterrado: "Desterrado", abandona: "Abandona" };

  function informe(s) {
    const m = R.MODOS[s.modo];
    const T = resumenDias(s);
    const ratos = T.mover + T.pedir + T.trabajar + T.esperar + T.perdido || 1;
    const pct = (x) => Math.round((100 * x) / ratos) + " %";
    const L2 = [];
    L2.push("LIBER VAGATORUM · EL JUGUETE · INFORME");
    L2.push(`Jugador: ${s.jugador || "anónimo"}`);
    L2.push(`Versión: ${s.v} · ${m.nombre} · semilla ${s.semilla}${s.semillaFija ? " (fija)" : ""}`);
    L2.push(`Empezada: ${s.empezada}`);
    L2.push(`Final: ${s.final ? `${FINALES[s.final.tipo] || s.final.tipo}, día ${s.final.dia}. ${s.final.texto}` : "sin acabar"}`);
    L2.push(`Cuerpo al final: ${s.cuerpo} · detenciones: ${s.detenciones} · llaga: ${!s.conLlaga ? "no activada" : s.llaga ? "activada; se la hizo la noche del día " + s.llaga : "activada; no se la hizo"}`);
    L2.push("");
    L2.push("== Encuesta ==");
    const E = s.encuesta || {};
    L2.push(`1. Qué decisión le dolió o le costó: ${E.dolio || "—"}`);
    L2.push(`2. Cómo decidía adónde ir: ${E.ir || "—"}`);
    L2.push(`3. Si le sorprendió la ronda, mala decisión suya o mala suerte: ${E.sorpresa || "—"}`);
    L2.push(`4. Qué sobraba, estorbaba o no entendió: ${E.sobro || "—"}`);
    L2.push(`5. Otros: ${E.otros || "—"}`);
    L2.push("");
    L2.push("== Para los criterios de la prueba ==");
    L2.push(`Tiempo: moverse ${pct(T.mover)} · pedir ${pct(T.pedir)} · trabajar ${pct(T.trabajar)} · esperar o acabar antes ${pct(T.esperar)} · perdido ${pct(T.perdido)}`);
    if (s.modo === "A") L2.push(`Pasos: ${T.pasos} (${(T.pasos / Math.max(1, s.porDia.length)).toFixed(1)} por día)`);
    else L2.push(`Cruces de barrio: ${T.cruces} (${(T.cruces / Math.max(1, s.porDia.length)).toFixed(1)} por día) · movimientos dentro del barrio: ${T.libres}`);
    L2.push(`Pedir: ${T.pedidas} veces, ${T.panPedido} pedazos · trabajo: ${T.panTrabajo} pedazos`);
    L2.push(`Llegó donde estaba la ronda: ${T.encuentros} veces (le pararon ${T.paradas}) · vio llegar la ronda estando quieto: ${T.rondaVista}`);
    L2.push(`Abrió «Lo que recuerdas»: ${s.recuerdaAbierto || 0} veces · vio la ronda en ${(s.vistas || []).length} franjas`);
    const det = s.cronica.filter((c) => c.tipo === "detenido");
    if (det.length) L2.push("Detenciones: " + det.map((c) => `día ${c.dia}, ${c.motivo}`).join(" · "));
    L2.push("");
    L2.push("== Por día ==");
    L2.push("día | mover | pedir | trabajar | esperar | " + (s.modo === "A" ? "pasos" : "cruces") + " | sitios | pan pedido | pan trabajo | come | duerme | cuerpo | ronda al llegar");
    s.porDia.forEach((d) => {
      L2.push(`${d.dia} | ${d.mover} | ${d.pedir} | ${d.trabajar} | ${d.esperar + d.perdido} | ${s.modo === "A" ? d.pasos : d.cruces} | ${d.lugares} | ${d.panPedido} | ${d.panTrabajo} | ${d.comido} | ${DUERME[d.duerme]}${d.detenido ? " (" + d.detenido + ")" : ""} | ${d.cuerpoNoche} | ${d.encuentros}`);
    });
    L2.push("");
    L2.push("== Crónica ==");
    let diaAct = 0;
    s.cronica.forEach((c) => {
      if (c.dia !== diaAct) { diaAct = c.dia; L2.push(`-- Día ${c.dia} (${R.CALENDARIO[c.dia - 1].fecha}) --`); }
      L2.push(`${momentoTxt(c.t)} · ${c.texto}`);
    });
    L2.push("");
    L2.push("== Dónde estuvo la ronda (el jugador no lo veía) ==");
    for (let d = 1; d <= s.dia; d++) {
      const fila = R.FRANJAS.map((fr, f) => {
        const k = `${d}|${f}`;
        if (!(k in s.rondas)) return `${fr.nombre}: —`;
        const p = s.rondas[k];
        return `${fr.nombre}: ${p ? L[p].corto : "comiendo"}${s.rondasPorque[k] === "aviso" ? " (aviso)" : s.rondasPorque[k] === "aprendido" ? " (tu costumbre)" : ""}`;
      });
      L2.push(`Día ${d}: ` + fila.join(" · "));
    }
    L2.push("");
    L2.push("== Datos en bruto ==");
    L2.push(JSON.stringify({ v: s.v, modo: s.modo, semilla: s.semilla, final: s.final, porDia: s.porDia, encuesta: s.encuesta, rondas: s.rondas, rondasPorque: s.rondasPorque, habitos: s.habitos, vistas: s.vistas, recuerdaAbierto: s.recuerdaAbierto, conLlaga: !!s.conLlaga, llaga: s.llaga || null }));
    return L2.join("\n");
  }

  window.ENGINE = {
    FIN, L, VECINOS, DEL_BARRIO, CRUCES, BARRIO, GENTE_TXT, FINALES,
    franja, ratoEnFranja, nombreFranja, dia, estado, zonaDe, lugaresZona, rondaAhora, rondaEnTuZona, edad,
    nueva, opciones, previsionPedir, mover, pedir, pedirTrabajo, esperar, acabarDia, seguir, comprobarNoche, cenar,
    informe, resumenDias, momentoTxt, riesgoNoche, saberNoche, puedeLlaga, hacerLlaga, cuerpoMax,
    empezarJornada(s) { if (s.fase === "amanecer") { s.fase = "dia"; s.noche = null; } },
  };
})();
