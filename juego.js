/* Liber Vagatorum · juego 2D (rama claude/juego2d).
 * Prototipo de videojuego con moñigotes: cada sitio es una escena de perfil por la que andas sin que pase el tiempo;
 * salir por una salida es el «mover» del motor (2 ratos); lo que haces (pedir, esperar…) cuesta lo de siempre; un mapa
 * (M) para ir lejos. Decidido por Sergio el 25-nov (claude/videojuego-escenas.md).
 * Las reglas están en rules.js y el motor en engine.js, tal cual: aquí no hay ni una regla. La escena se dibuja con
 * Phaser (lib/phaser.min.js, copiado en el repositorio); el HUD, los menús, el mapa y las pantallas son HTML. */
(function () {
  const R = window.RULES, E = window.ENGINE, P = R.PARAMS, HU = P.hurto || {}, TR = P.tretas || {}, M = window.LV_MAPA;
  const VERSION_JUEGO = "g2";
  const LS = { partida: "lvg-partida", historial: "lvg-historial", nombre: "lvj-nombre", llaga: "lvg-llaga", tuyos: "lvg-tuyos", cadena: "lvg-cadena", hurto: "lvg-hurto", tretas: "lvg-tretas", presion: "lvg-presion", tema: "lvj-tema" };
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = (id) => document.getElementById(id);
  const app = $("app"), hud = $("hud"), capa = $("capa"), juegoEl = $("juego"), modal = $("modal");
  const L = E.L;
  function btn(act, titulo, detalle, opts) {
    const o = opts || {};
    const data = Object.entries(o.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
    return `<button class="btn ${o.cls || ""}" data-act="${act}"${data}${o.disabled ? " disabled" : ""}${o.tecla ? ` title="Tecla ${esc(o.tecla)}"` : ""}><span class="t">${o.icono || ""}${esc(titulo)}${o.tecla ? ` <kbd>${esc(o.tecla)}</kbd>` : ""}</span>${detalle ? `<span class="d">${esc(detalle)}</span>` : ""}</button>`;
  }

  let s = load(LS.partida, null);
  if (s && (!s.v || !s.hoy)) s = null;
  // escena: el sitio que se está dibujando (casi siempre, donde estás); x: dónde estás en ella
  const ui = { pantalla: s && s.fase !== "fin" ? "juego" : "inicio", escena: null, x: null, de: null, menu: false, mapa: false, ruta: [], mapaSel: null, viajando: false, sitio: null, hover: null, pose: null };
  const franjaAct = () => E.franja(Math.min(s.t, E.FIN - 1));
  const enDia = () => !!s && ui.pantalla === "juego" && (s.fase === "dia" || s.fase === "resultado");
  const rondaAqui = () => (s.t < E.FIN ? E.rondaEnTuZona(s) : null);
  // lo que se cuenta para el informe: cuánto se anda, cuánto se mira y cuántas veces se usa el mapa
  function cuenta(k, n) { s.jg = s.jg || {}; s.jg[k] = (s.jg[k] || 0) + (n == null ? 1 : n); }

  // ================================================================== las escenas
  // Cada sitio, una escena de perfil. ancho: veces la pantalla. salidas: a cada vecino, por la izquierda, por la derecha
  // o por una puerta al fondo (x: dónde, de 0 a 1). vigia: dónde está quien avisa (si en ese sitio avisan enseguida).
  // ventana: dónde se asoma el vecino. calleja: por dónde se va la ronda (no lleva a ningún sitio vecino: no dice adónde va).
  // ronda, pobres, tuyos: dónde se ponen. Lo dibujado es de la vista, no de las reglas.
  const ESCENAS = {
    ribera: { ancho: 1, fuera: true, salidas: { puente: { lado: "der" } }, pobres: 0.35, tuyos: 0.55 },
    puente: { ancho: 1, fuera: true, salidas: { ribera: { lado: "izq" }, orilla: { lado: "der" }, puerta: { lado: "fondo", x: 0.5, arco: true } }, pobres: 0.25, tuyos: 0.7 },
    orilla: { ancho: 1, fuera: true, salidas: { puente: { lado: "izq" }, sanpolo: { lado: "der" } }, pobres: 0.3, tuyos: 0.62 },
    puerta: { ancho: 1, salidas: { catedral: { lado: "izq" }, puente: { lado: "fondo", x: 0.62, arco: true } }, vigia: 0.76, ventana: 0.24, calleja: 0.9, ronda: 0.42, pobres: 0.12, tuyos: 0.3 },
    catedral: { ancho: 1.3, salidas: { rua: { lado: "izq" }, escuelas: { lado: "der" }, puerta: { lado: "fondo", x: 0.08 } }, ventana: 0.86, calleja: 0.95, ronda: 0.68, pobres: 0.49, tuyos: 0.3, obra: 0.2 },
    escuelas: { ancho: 1.1, salidas: { catedral: { lado: "izq" }, sanesteban: { lado: "der" } }, vigia: 0.42, ventana: 0.8, calleja: 0.16, ronda: 0.66, pobres: 0.28, tuyos: 0.55 },
    rua: { ancho: 1.3, salidas: { catedral: { lado: "der" }, plaza: { lado: "izq" }, sanmartin: { lado: "fondo", x: 0.4 } }, ventana: 0.66, calleja: 0.82, ronda: 0.56, pobres: 0.22, tuyos: 0.72 },
    sanmartin: { ancho: 1, salidas: { rua: { lado: "izq" }, plaza: { lado: "der" } }, vigia: 0.36, ventana: 0.8, calleja: 0.14, ronda: 0.62, pobres: 0.47, tuyos: 0.25 },
    plaza: { ancho: 1.5, salidas: { sanmartin: { lado: "izq" }, sanpablo: { lado: "der" }, rua: { lado: "fondo", x: 0.2 } }, ventana: 0.62, calleja: 0.86, ronda: 0.5, pobres: 0.35, tuyos: 0.72 },
    sanpablo: { ancho: 1.05, salidas: { plaza: { lado: "izq" }, sanesteban: { lado: "der" } }, ventana: 0.5, calleja: 0.3, ronda: 0.62, pobres: 0.2, tuyos: 0.42 },
    sanesteban: { ancho: 1.15, salidas: { escuelas: { lado: "izq" }, sanpolo: { lado: "der" }, sanpablo: { lado: "fondo", x: 0.78 } }, ventana: 0.15, calleja: 0.9, ronda: 0.6, pobres: 0.42, tuyos: 0.25 },
    sanpolo: { ancho: 1, salidas: { sanesteban: { lado: "izq" }, orilla: { lado: "fondo", x: 0.6, arco: true } }, ventana: 0.22, calleja: 0.88, ronda: 0.38, pobres: 0.12, tuyos: 0.78 },
  };
  // las salidas tienen que ser exactamente los caminos de las reglas
  for (const [a, b] of R.CAMINOS) if (!ESCENAS[a].salidas[b] || !ESCENAS[b].salidas[a]) console.error("Falta la salida", a, b);
  for (const [a, e] of Object.entries(ESCENAS)) for (const b of Object.keys(e.salidas)) if (!E.VECINOS[a].includes(b)) console.error("Salida que no es camino", a, b);
  // si sales por la izquierda, entras por la derecha: si no, con la tecla pulsada volverías a salir
  for (const [a, b] of R.CAMINOS) { const la = ESCENAS[a].salidas[b].lado, lb = ESCENAS[b].salidas[a].lado; if (la === lb && la !== "fondo") console.error("Salidas del mismo lado", a, b); }

  // con las tretas: quien vende atrezo en cada sitio (el que dicen las reglas), la panadera o la ventera, y el mesón
  const VENDEDOR = { puerta: { x: 0.21, fig: "mozoArgel" }, escuelas: { x: 0.86, fig: "estPobre" }, plaza: { x: 0.09, fig: "buhonero" }, rua: { x: 0.1, fig: "ropavejero" } };
  const PANADERA = { plaza: 0.82, rua: 0.86, puerta: 0.86 };
  const MESON = { rua: 0.25, plaza: 0.42 };
  const WV = 1280, HV = 720, SUELO = 470, PIES = 600; // la pantalla, la línea de las fachadas y por dónde andas
  const VEL = 400; // px por segundo andando
  const anchoDe = (id) => Math.round(ESCENAS[id].ancho * WV);
  const salidaX = (id, sal) => (sal.lado === "izq" ? 0 : sal.lado === "der" ? anchoDe(id) : Math.round(sal.x * anchoDe(id)));
  // dónde apareces al llegar de otro sitio: en la salida que lleva a él
  function entradaX(id, de) {
    const sal = de && ESCENAS[id].salidas[de];
    if (!sal) return Math.round(anchoDe(id) * (id === "ribera" ? 0.6 : 0.5));
    return sal.lado === "izq" ? 90 : sal.lado === "der" ? anchoDe(id) - 90 : salidaX(id, sal);
  }

  // ------------------------------------------------------------------ textos (los del juguete; ninguno nuevo de reglas)
  const TXT_GENTE = (g, id) => `${E.GENTE_TXT[g]}${g >= 1 && L[id].quien ? ` (${L[id].quien})` : ""}`;
  const VIGIA = { puerta: "el portero", escuelas: "el bedel", sanmartin: "el cura" };
  function linea(tipo, id) {
    const o = E.opciones(s);
    const pd = o.acc.find((a) => a.id === "pedir");
    const f = franjaAct();
    const e = s.t < E.FIN ? E.estado(s, id, s.dia, f) : null;
    switch (tipo) {
      case "ronda": return `La ronda está aquí: si pides, te ve y te detiene${e && e.da >= 3 ? " (con tanta gente, puede que no te vea)" : ""}.`;
      case "queja-mia": return `Hoy te han visto pedir aquí (${M.pedidoAqui(s, id).join(", ")}).`;
      case "queja": return "Un vecino rezonga: «Otra vez pordioseros por aquí». Hace poco han visto pedir aquí a otro.";
      case "vigia": return `Aquí avisan enseguida a la ronda (${VIGIA[id] || "alguien"}).`;
      case "capataz": { const tr = o.acc.find((a) => a.id === "trabajo"); return tr && tr.ok ? `Obras: si te cogen, cargas piedra hasta el final de nona por ${P.trabajo.paga} pedazos de pan. Preguntar cuesta 1 rato.` : `Obras: ${tr ? tr.porque : "hoy no"}.`; }
      case "puesto": { const hu = o.acc.find((a) => a.id === "hurtar"); return hu ? (hu.ok ? `Hurtar: una hogaza de un puesto, ${HU.gana} pedazos, ${HU.ratos} ratos. Con poca gente hay más ojos sobre ti, pero si gritan puedes correr; con mucha te ven menos, pero si te ven hay manos para sujetarte.` : `Hurtar: ${hu.porque}.`) : "Puestos del mercado."; }
      case "pobres": return e && e.da === 2 && e.pobres ? "Hay más pobres pidiendo: os repartís lo que hay. Muchas veces, nada." : "Otros pobres pidiendo.";
      case "gente": {
        if (!L[id].dentro || !pd.ok) return `${TXT_GENTE(e ? e.gente : 0, id)[0].toUpperCase()}${TXT_GENTE(e ? e.gente : 0, id).slice(1)}. Pedir: ${pd.porque}.`;
        return E.previsionPedir(s)[0] || "";
      }
      case "yo": return `Tú: cuerpo ${s.cuerpo} de ${E.cuerpoMax(s)}, ${s.pan} ${s.pan === 1 ? "pedazo" : "pedazos"} de pan${s.conTretas ? `, ${s.blancas} ${s.blancas === 1 ? "blanca" : "blancas"}` : ""}${s.conocido ? ", y la ronda ya te conoce la cara" : ""}${s.llaga ? ". Llevas la llaga" : ""}${s.conTretas && s.puesta ? `. Llevas puest${E.TT[s.puesta].puesta.nombre === "la ropa buena" ? "a" : "as"} ${E.TT[s.puesta].puesta.nombre}` : ""}. (E: qué hacer aquí${s.conTretas ? "; T: tus tretas" : ""})`;
      case "vende": return lineaVende(id);
      case "panadera": { const m = E.mercadoPan(s).compra; return m ? `La panadera vende pan a ${m.precio} blancas el pedazo${m.ok ? " (E para comprar)" : `: ${m.porque}`}.` : "La panadera."; }
      case "ventera": { const m = E.mercadoPan(s).venta; return m ? `La ventera compra pan a ${m.precio === 1 ? "una blanca" : m.precio + " blancas"} el pedazo${m.ok ? " (E para vender)" : `: ${m.porque}`}.` : "La ventera."; }
      case "guarda": return `Un guarda en la puerta: a esta hora no deja pasar a los pobres, ni entrar ni salir. ${E.llaveAbre(s, "puerta") ? "Llevas la ropa buena puesta: no te mira." : E.llaveTxt(s, "puerta")}`;
      case "diputados": return `Los diputados de la parroquia, escribiendo pobres: al que pide le piden la cédula. ${E.llaveAbre(s, "parroquia") ? "Llevas la carta: les enseñarás el sello." : E.llaveTxt(s, "parroquia")}`;
      case "estudio": return `Los alguaciles del Estudio: echan de las Escuelas a los que piden sin ser estudiantes. ${E.llaveAbre(s, "estudio") ? "Llevas el manteo: no te echarán." : E.llaveTxt(s, "estudio")}`;
      case "meson": {
        const n = (s.mesones || {})[id] || 0, po = TR.posada;
        if (n >= po.veces) return "Un mesón. El mesonero ya no te abrirá: «Te dije que no volvieras».";
        return `Un mesón. Si acabas el día aquí, por ${po.blancas} blancas duermes en el pajar y la ronda de noche no entra. Antes del alba te echan por la Puerta del Río.${n === po.veces - 1 ? " La última vez el mesonero te dijo que no quería pobres fijos." : ""}`;
      }
      default: return "";
    }
  }
  // lo que dice quien vende aquí: qué y por cuánto (lo que dice de cada cosa, en el menú de E, al pasar por encima)
  function lineaVende(id) {
    const f = franjaAct(), tienda = E.tiendaAqui(s);
    const items = (TR.lista || []).filter((t) => t.compra && t.compra.lugar === id && t.compra.franjas.includes(f) && !(s.quemadas || []).includes(t.id));
    if (!items.length) return "";
    const partes = items.map((t) => {
      const c = t.compra, x = tienda.find((y) => y.id === t.id);
      const precio = `${c.blancas} blancas${c.pan ? ` o ${c.pan} pedazos de pan` : ""}`;
      if (x) return `${x.rellena ? "pliegos de coplas" : t.nombre} (${precio}${x.ok ? "" : `: ${x.porque}`})`;
      return `${t.nombre} (${s.mazo.includes(t.id) ? "ya la tienes" : "a ti no te vale"})`;
    });
    const algo = tienda.some((x) => x.ok && items.some((t) => t.id === x.id));
    return `${mayus(items[0].compra.quien)} vende ${partes.join(" y ")}.${algo ? " Con E, comprar: te dice para qué sirve." : ""}`;
  }
  const lineaTuyo = (t) => `${t.nombre} ${t.pide ? "está pidiendo aquí" : "anda por aquí"}.`;
  function lineaSalida(id, a) {
    const mv = E.opciones(s).movs.find((m) => m.destino === a);
    const sal = ESCENAS[id].salidas[a];
    const flecha = sal.lado === "izq" ? "← " : sal.lado === "der" ? "" : "↑ ";
    return mv && mv.ok ? `${flecha}${L[a].nombre} · ${mv.coste} ratos${sal.lado === "der" ? " →" : ""}${sal.lado === "fondo" ? " (W o ↑)" : ""}` : `${flecha}${L[a].nombre} · ${mv ? mv.porque : "no te da tiempo"}`;
  }

  // ================================================================== Phaser: el dibujo
  // colores de la vista (no se elige aquí el estilo de arte: son formas y colores planos)
  const CIELO = [0xf2d3c2, 0xd3e4ec, 0xdde9ee, 0xe8dec6, 0xeec39b, 0x8f96b8];
  const LUZ = [0xffe4d6, 0xffffff, 0xfffbef, 0xfff0d9, 0xffd3a6, 0x949ec9];
  const PAREDES = [0xe9ddc4, 0xe2d3b4, 0xdccaa9, 0xeadfca, 0xd9c7a6];
  const TEJADO = 0xb27450, PIEDRA = 0xcdbb95, LINEA = 0x8a7558, OSCURO = 0x3d2f24, VENTANA = 0x4d3e31;
  const PIEL = 0xe0b48a;
  function rng(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const rect = (g, c, x, y, w, h, a) => { g.fillStyle(c, a == null ? 1 : a); g.fillRect(x, y, w, h); };
  const circ = (g, c, x, y, r, a) => { g.fillStyle(c, a == null ? 1 : a); g.fillCircle(x, y, r); };
  const ell = (g, c, x, y, w, h, a) => { g.fillStyle(c, a == null ? 1 : a); g.fillEllipse(x, y, w, h); };
  const poly = (g, c, pts, a) => { g.fillStyle(c, a == null ? 1 : a); g.fillPoints(pts.map(([x, y]) => new Phaser.Geom.Point(x, y)), true); };
  const raya = (g, c, w, x1, y1, x2, y2, a) => { g.lineStyle(w, c, a == null ? 1 : a); g.lineBetween(x1, y1, x2, y2); };
  const media = (g, c, x, y, r) => { g.fillStyle(c, 1); g.beginPath(); g.arc(x, y, r, Math.PI, 0, false); g.closePath(); g.fillPath(); };
  // un hueco con arco (puerta, portal, calleja)
  function hueco(g, c, x, base, w, h) { rect(g, c, x - w / 2, base - h + w / 2, w, h - w / 2); media(g, c, x, base - h + w / 2, w / 2); }

  // ------------------------------------------------------------------ moñigotes: (0, 0) son los pies
  function sombrero(g, t, c) {
    if (t === "ala") { ell(g, c, 0, -80, 34, 7); rect(g, c, -8, -95, 16, 15); }
    else if (t === "chato") { ell(g, c, 0, -80, 26, 6); rect(g, c, -7, -88, 14, 8); }
    else if (t === "bonete") { rect(g, c, -9, -92, 18, 13); rect(g, c, -11, -93, 22, 3); }
    else if (t === "teja") { ell(g, c, 0, -82, 42, 8); ell(g, c, 0, -86, 16, 8); }
    else if (t === "morrion") { media(g, c, 0, -79, 11); ell(g, c, 0, -79, 32, 5); }
    else if (t === "gorro") media(g, c, 0, -78, 10.5);
  }
  // o: tunica, piernas, largo (hasta los pies), capa, golilla, sombrero, sc (color del sombrero), toca (color), capucha (color)
  function persona(g, o) {
    if (o.largo) poly(g, o.tunica, [[-11, -62], [11, -62], [17, 0], [-17, 0]]);
    else {
      rect(g, o.piernas || 0x4a3a2c, -8, -26, 6, 26); rect(g, o.piernas || 0x4a3a2c, 2, -26, 6, 26);
      poly(g, o.tunica, [[-10, -62], [10, -62], [15, -22], [-15, -22]]);
    }
    if (o.capa) poly(g, o.capa, [[-12, -63], [12, -63], [17, -16], [-17, -16]]);
    const brazo = o.capa || o.tunica;
    rect(g, brazo, -15, -60, 5, 28); rect(g, brazo, 10, -60, 5, 28);
    if (o.golilla) ell(g, 0xf3efe6, 0, -63, 24, 7);
    if (o.toca || o.capucha) circ(g, o.toca || o.capucha, 0, -73, 12);
    circ(g, PIEL, 0, -72, o.toca || o.capucha ? 8 : 9.5);
    if (o.sombrero) sombrero(g, o.sombrero, o.sc || 0x2a2420);
  }
  // sentado en el suelo, con la mano tendida y el cuenco
  function sentado(g, o) {
    rect(g, o.piernas || 0x4a3a2c, -6, -10, 30, 10);
    poly(g, o.tunica, [[-14, -48], [2, -48], [6, -6], [-18, -6]]);
    rect(g, o.tunica, 0, -40, 22, 5);
    ell(g, 0x6b4a2a, 27, -39, 15, 7);
    if (o.toca) circ(g, o.toca, -6, -58, 11);
    circ(g, PIEL, -6, -57, o.toca ? 7.5 : 9);
    if (o.parche) rect(g, o.parche, -10, -30, 7, 7);
  }
  const ojo = (g, y) => { ell(g, 0xffffff, 0, y, 22, 12); g.lineStyle(1.6, 0x4a2a5a, 1); g.strokeEllipse(0, y, 22, 12); circ(g, 0x4a2a5a, 0, y, 3.8); };
  // las figuras: cada una devuelve una función que dibuja en un Graphics
  const FIG = {
    // tú: de rojo con el hatillo; con la ropa buena puesta, de paño oscuro; con las cadenas al hombro, se ven
    yo: (pide) => (g) => {
      const ropa = s && s.conTretas && s.puesta === "vergonzante", cadenas = s && s.conTretas && s.puesta === "cautivo";
      const c = ropa ? 0x34425a : 0xb8402e, pi = ropa ? 0x26262e : 0x5a3a2a;
      ell(g, 0xb8402e, 0, 2, 40, 9, 0.25);
      if (pide) { sentado(g, { tunica: c, piernas: pi }); circ(g, 0xc9a15a, -26, -10, 10); if (cadenas) for (let k = 0; k < 5; k++) { g.lineStyle(2.5, 0x8d8d8d, 1); g.strokeEllipse(-12 + k * 7, -30 + k * 3, 8, 5); } return; }
      persona(g, { tunica: c, piernas: pi, golilla: ropa });
      if (ropa) rect(g, 0xb8402e, -10, -26, 20, 4); // el rojo asoma por debajo
      raya(g, 0x7a5a2a, 3, 9, -58, 26, -92); circ(g, 0xc9a15a, 27, -93, 10);
      if (cadenas) for (let k = 0; k < 7; k++) { g.lineStyle(2.5, 0x8d8d8d, 1); g.strokeEllipse(-12 + k * 4, -62 + k * 7, 8, 5); }
      if (s && s.llaga) { rect(g, 0xffffff, -9, -17, 8, 7); g.lineStyle(1.5, 0xb33a2e, 1); g.strokeRect(-9, -17, 8, 7); }
    },
    alguacil: () => (g) => {
      persona(g, { tunica: 0x151212, piernas: 0x151212, golilla: true, sombrero: "ala", sc: 0x151212 });
      rect(g, 0x5a3a1a, 18, -124, 4, 124); circ(g, 0xc9a15a, 20, -126, 5);
    },
    corchete: () => (g) => {
      persona(g, { tunica: 0x4a443f, piernas: 0x3a3430, sombrero: "morrion", sc: 0x9c9a96 });
      rect(g, 0x6b5030, 16, -134, 3, 134); poly(g, 0xbababa, [[17.5, -150], [11, -132], [24, -132]]);
    },
    comun: (c, sombr) => (g) => persona(g, { tunica: c, sombrero: sombr ? "chato" : null, sc: 0x3a2e26 }),
    mujer: (c, toca) => (g) => persona(g, { tunica: c, largo: true, toca: toca || 0xe6dcc8 }),
    compradora: (c) => (g) => { persona(g, { tunica: c, largo: true, toca: 0xe6dcc8 }); ell(g, 0x8a6a3a, 16, -34, 20, 13); raya(g, 0x6a4a2a, 2, 9, -48, 16, -40); },
    estudiante: () => (g) => persona(g, { tunica: 0x2e2c3a, largo: true, sombrero: "bonete", sc: 0x2e2c3a }),
    clerigo: () => (g) => persona(g, { tunica: 0x4a3c33, largo: true, sombrero: "teja", sc: 0x3a2f28 }),
    fraile: () => (g) => persona(g, { tunica: 0xece6d8, largo: true, capa: 0x26211e, capucha: 0x26211e }),
    viajero: (c) => (g) => { persona(g, { tunica: c, sombrero: "ala", sc: 0x5a4a3a }); circ(g, 0x9a7a4a, -14, -56, 11); raya(g, 0x6a4a2a, 3, 15, -70, 22, 0); },
    pobre: (parche) => (g) => sentado(g, { tunica: 0xa8743c, piernas: 0x6b4a2a, parche: parche ? 0x7a5226 : null }),
    tendido: () => (g) => { rect(g, 0xa8743c, -30, -14, 50, 14); circ(g, PIEL, 26, -9, 8); rect(g, 0x6b4a2a, -36, -10, 10, 10); },
    pedro: (pide) => (g) => pide ? sentado(g, { tunica: 0x3d6b98, piernas: 0x2a3a4a }) : persona(g, { tunica: 0x3d6b98, piernas: 0x2a3a4a, sombrero: "chato", sc: 0x22344a }),
    catalina: (pide) => (g) => pide ? sentado(g, { tunica: 0x4c8a47, toca: 0xe9e1cc }) : persona(g, { tunica: 0x4c8a47, largo: true, toca: 0xe9e1cc }),
    portero: () => (g) => { persona(g, { tunica: 0x6b5a3a, piernas: 0x4a3a2a, sombrero: "gorro", sc: 0x4a3a2a }); g.lineStyle(3, 0xc9a15a, 1); g.strokeCircle(16, -30, 5); raya(g, 0xc9a15a, 3, 16, -25, 16, -12); ojo(g, -112); },
    bedel: () => (g) => { persona(g, { tunica: 0x3a2a40, largo: true, sombrero: "bonete", sc: 0x3a2a40 }); raya(g, 0xc9a15a, 4, 12, -36, 24, -76); circ(g, 0xc9a15a, 25, -79, 6); ojo(g, -116); },
    cura: () => (g) => { persona(g, { tunica: 0x1c1918, largo: true, sombrero: "teja", sc: 0x1c1918 }); ojo(g, -110); },
    capataz: () => (g) => { persona(g, { tunica: 0x8a5a2b, piernas: 0x4a3a2a, sombrero: "ala", sc: 0x5a3a1a }); raya(g, 0x6a4a2a, 3, 14, -44, 26, 0); },
    // con las tretas: los que venden (cada uno con lo suyo en la mano) y el mesón
    buhonero: () => (g) => { persona(g, { tunica: 0x7a5a3a, piernas: 0x4a3a2a, sombrero: "chato", sc: 0x3a2e26 }); for (let k = 0; k < 4; k++) rect(g, 0xf4efe2, 12 + k * 3, -58 + k * 4, 16, 20); },
    estPobre: () => (g) => { persona(g, { tunica: 0x4a4458, largo: true, sombrero: "bonete", sc: 0x2e2c3a }); rect(g, 0x6a6474, -6, -40, 10, 10); rect(g, 0xf4efe2, 12, -52, 20, 26); raya(g, 0x2b2118, 2, 30, -70, 22, -50); },
    mozoArgel: () => (g) => { persona(g, { tunica: 0x8a6a4a, piernas: 0x5a4a3a, sombrero: "gorro", sc: 0x9a3a2a }); for (let k = 0; k < 7; k++) { g.lineStyle(2.5, 0x8d8d8d, 1); g.strokeEllipse(12 + (k % 2) * 3, -60 + k * 7, 8, 5); } },
    ropavejero: () => (g) => { persona(g, { tunica: 0x5a4a3a, piernas: 0x3a3028, sombrero: "chato", sc: 0x2a2420 }); poly(g, 0x34425a, [[10, -58], [30, -58], [32, -20], [12, -24]]); poly(g, 0x7a3a3a, [[14, -50], [34, -46], [30, -14], [18, -18]]); },
    panadera: () => (g) => { persona(g, { tunica: 0x8a6a5a, largo: true, toca: 0xf0e8d6 }); rect(g, 0xf0e8d6, -9, -50, 18, 30); ell(g, 0x8a6a3a, 18, -36, 26, 14); for (let k = 0; k < 3; k++) circ(g, 0xc98a44, 9 + k * 9, -44, 5); },
    guarda: () => (g) => { persona(g, { tunica: 0x55603f, piernas: 0x3a3a2a, sombrero: "gorro", sc: 0x8a2a2a }); rect(g, 0x6b5030, 16, -140, 3, 140); poly(g, 0xbababa, [[18, -150], [11, -134], [25, -134]]); poly(g, 0xbababa, [[19, -132], [34, -138], [34, -118], [19, -122]]); },
    diputado: (libro) => (g) => { persona(g, { tunica: 0x3a3048, largo: true, golilla: true, sombrero: "chato", sc: 0x1e1a24 }); if (libro) { rect(g, 0xf4efe2, 6, -52, 30, 20); raya(g, 0x7a6a5a, 2, 21, -52, 21, -32); } else { rect(g, 0xf4efe2, 10, -50, 16, 22); raya(g, 0x2b2118, 2, 30, -68, 22, -48); } },
    algEstudio: () => (g) => { persona(g, { tunica: 0x23324a, largo: true, sombrero: "bonete", sc: 0x1a2232 }); rect(g, 0x5a3a1a, 18, -118, 4, 118); circ(g, 0xc9a15a, 20, -120, 5); },
  };
  const TUNICAS = [0x6f6a5a, 0x7d5e45, 0x5d6b72, 0x8a7a5a, 0x6d5560, 0x5f6e58, 0x86604a];
  const FALDAS = [0x8a5a4a, 0x5f6e58, 0x7a6a8a, 0x8a7a5a, 0x6a5a4a];
  // la gente de cada sitio, según quién es (la de las reglas: «estudiantes», «frailes y devotos»…)
  function genteDe(id, r) {
    const q = L[id].quien || "";
    const c = TUNICAS[Math.floor(r() * TUNICAS.length)], f = FALDAS[Math.floor(r() * FALDAS.length)], x = r();
    if (q.includes("estudiantes")) return x < 0.75 ? FIG.estudiante() : FIG.comun(c, true);
    if (q.includes("frailes")) return x < 0.45 ? FIG.fraile() : x < 0.8 ? FIG.mujer(f) : FIG.comun(c);
    if (q.includes("canónigos")) return x < 0.3 ? FIG.clerigo() : x < 0.7 ? FIG.mujer(f) : FIG.comun(c, true);
    if (q.includes("compradores")) return x < 0.45 ? FIG.compradora(f) : FIG.comun(c, x < 0.7);
    if (q.includes("paso") || q.includes("entra")) return x < 0.6 ? FIG.viajero(c) : FIG.comun(c);
    return x < 0.45 ? FIG.mujer(f) : FIG.comun(c, x < 0.7);
  }

  // ------------------------------------------------------------------ decorados
  function casas(g, x0, x1, r, alto) {
    let x = x0;
    while (x < x1 - 30) {
      const w = Math.min(x1 - x, 120 + Math.floor(r() * 90));
      const h = (alto || 190) + Math.floor(r() * 80), top = SUELO - h;
      rect(g, PAREDES[Math.floor(r() * PAREDES.length)], x, top, w, h);
      g.lineStyle(1.5, LINEA, 0.55); g.strokeRect(x, top, w, h);
      poly(g, TEJADO, [[x - 6, top], [x + w + 6, top], [x + w - 12, top - 22], [x + 12, top - 22]]);
      const n = Math.max(1, Math.floor((w - 20) / 48));
      for (let i = 0; i < n; i++) {
        const wx = x + (w / (n + 1)) * (i + 1) - 11;
        for (let fila = 0; fila < 2; fila++) { const wy = top + 30 + fila * 70; if (wy + 34 < SUELO - 70) rect(g, VENTANA, wx, wy, 22, 32); }
      }
      if (w > 90) hueco(g, OSCURO, x + w * (0.3 + r() * 0.4), SUELO, 34, 64);
      x += w;
    }
  }
  function iglesia(g, x0, x1, torre, alto) {
    const w = x1 - x0, h = alto || 260, top = SUELO - h;
    rect(g, 0xd9cbad, x0, top, w, h); g.lineStyle(2, LINEA, 0.7); g.strokeRect(x0, top, w, h);
    poly(g, 0xc8b693, [[x0 - 8, top], [x1 + 8, top], [(x0 + x1) / 2, top - 70]]);
    circ(g, 0x8a7a64, (x0 + x1) / 2, top + 60, 22); circ(g, 0xd9cbad, (x0 + x1) / 2, top + 60, 14);
    hueco(g, OSCURO, (x0 + x1) / 2, SUELO, 64, 130);
    if (torre) {
      const tx = torre === "der" ? x1 - 10 : x0 - 60;
      rect(g, 0xd2c3a3, tx, top - 120, 70, h + 120); g.lineStyle(2, LINEA, 0.7); g.strokeRect(tx, top - 120, 70, h + 120);
      poly(g, 0xb59f78, [[tx - 6, top - 120], [tx + 76, top - 120], [tx + 35, top - 190]]);
      hueco(g, OSCURO, tx + 35, top - 50, 24, 50);
      raya(g, LINEA, 3, tx + 35, top - 190, tx + 35, top - 214); raya(g, LINEA, 3, tx + 25, top - 204, tx + 45, top - 204);
    }
  }
  // la muralla con una puerta en arco (desde dentro o desde fuera)
  function muralla(g, x0, x1, puertaX, alto) {
    const h = alto || 240, top = SUELO - h;
    rect(g, 0xc9b58c, x0, top, x1 - x0, h); g.lineStyle(2, LINEA, 0.8); g.strokeRect(x0, top, x1 - x0, h);
    for (let x = x0; x < x1; x += 36) rect(g, 0xc9b58c, x, top - 18, 22, 18);
    if (puertaX != null) {
      rect(g, 0xbfa97d, puertaX - 110, top - 60, 50, h + 60); rect(g, 0xbfa97d, puertaX + 60, top - 60, 50, h + 60);
      for (const tx of [puertaX - 110, puertaX + 60]) for (let x = tx; x < tx + 50; x += 20) rect(g, 0xbfa97d, x, top - 76, 12, 16);
      hueco(g, OSCURO, puertaX, SUELO, 110, 170);
    }
  }
  function rio(g, W, y0, y1) {
    rect(g, 0x8fb0b8, 0, y0, W, y1 - y0);
    for (let x = 30; x < W; x += 140) raya(g, 0xb7ccd1, 2, x, (y0 + y1) / 2, x + 50, (y0 + y1) / 2);
  }
  function juncos(g, x, y) { for (let i = 0; i < 5; i++) raya(g, 0x7d8f5a, 3, x + i * 7, y, x + i * 7 + (i % 2 ? 4 : -4), y - 40 - (i % 3) * 10); }
  // el decorado de cada sitio: el fondo, las fachadas y el suelo
  function decorado(g, id, W, r) {
    const fuera = ESCENAS[id].fuera;
    // el suelo
    if (id === "plaza") { rect(g, 0xd8c6a0, 0, SUELO, W, HV - SUELO); for (let x = 0; x < W; x += 90) raya(g, 0xc5b18a, 2, x, SUELO, x - 60, HV); }
    else if (fuera) rect(g, id === "puente" ? 0xbfae8a : 0xc8c096, 0, SUELO, W, HV - SUELO);
    else { rect(g, 0xcdb894, 0, SUELO, W, HV - SUELO); raya(g, 0xb9a47e, 3, 0, SUELO + 2, W, SUELO + 2); }
    switch (id) {
      case "ribera":
        // al fondo la ciudad en lo alto, el río y la ribera; la aceña
        muralla(g, 0, W, null, 120); iglesia(g, W * 0.55, W * 0.68, "der", 150);
        rio(g, W, SUELO - 60, SUELO); rect(g, 0xbdb78c, 0, SUELO, W, 30);
        rect(g, 0xe2d3b4, W * 0.08, SUELO - 140, 120, 90); circ(g, 0x8a7a64, W * 0.08 + 150, SUELO - 60, 46); circ(g, 0xbfae8a, W * 0.08 + 150, SUELO - 60, 32);
        for (let x = 60; x < W; x += 230) juncos(g, x, SUELO + 40 + (x % 3) * 12);
        return;
      case "puente":
        muralla(g, 0, W, salidaX(id, ESCENAS[id].salidas.puerta), 220);
        rio(g, W, HV - 44, HV); rect(g, 0xb3a07c, 0, HV - 74, W, 30); for (let x = 0; x < W; x += 120) rect(g, 0xa69370, x, HV - 84, 60, 12);
        poly(g, 0x9c8c74, [[W * 0.15, PIES + 20], [W * 0.15 + 60, PIES + 20], [W * 0.15 + 50, PIES - 18], [W * 0.15 + 8, PIES - 18]]); // el toro de piedra
        return;
      case "orilla":
        muralla(g, 0, W, null, 230); rio(g, W, HV - 70, HV);
        for (let x = 40; x < W; x += 210) juncos(g, x, HV - 70);
        return;
      case "puerta":
        casas(g, 0, W * 0.48, r); muralla(g, W * 0.48, W, salidaX(id, ESCENAS[id].salidas.puente));
        rect(g, 0xa58a5e, W * 0.76 - 30, SUELO - 90, 60, 90); // la garita del portero
        break;
      case "sanpolo":
        casas(g, 0, W * 0.4, r); muralla(g, W * 0.4, W, salidaX(id, ESCENAS[id].salidas.orilla), 230);
        break;
      case "catedral":
        casas(g, 0, W * 0.32, r); iglesia(g, W * 0.38, W * 0.72, "der", 300); casas(g, W * 0.78, W, r);
        // las obras de la catedral nueva: andamio y piedra
        for (let i = 0; i < 4; i++) raya(g, 0x7a5a3a, 4, W * 0.14 + i * 50, SUELO, W * 0.14 + i * 50, SUELO - 230);
        for (let j = 1; j < 5; j++) raya(g, 0x7a5a3a, 3, W * 0.14 - 10, SUELO - j * 55, W * 0.14 + 160, SUELO - j * 55);
        rect(g, 0xcabb98, W * 0.27, SUELO + 18, 60, 30); rect(g, 0xcabb98, W * 0.27 + 14, SUELO - 4, 40, 22);
        break;
      case "escuelas":
        casas(g, 0, W * 0.28, r); rect(g, 0xdcc89e, W * 0.3, SUELO - 280, W * 0.36, 280); g.lineStyle(2, LINEA, 0.7); g.strokeRect(W * 0.3, SUELO - 280, W * 0.36, 280);
        rect(g, 0xe9d8b0, W * 0.4, SUELO - 260, W * 0.16, 150); for (let k = 0; k < 6; k++) raya(g, 0xb8a27a, 2, W * 0.4 + 10, SUELO - 250 + k * 22, W * 0.56 - 10, SUELO - 250 + k * 22);
        for (let x = W * 0.3; x < W * 0.66; x += 26) poly(g, 0xcdb88c, [[x, SUELO - 280], [x + 26, SUELO - 280], [x + 13, SUELO - 300]]);
        hueco(g, OSCURO, W * 0.48, SUELO, 70, 120); casas(g, W * 0.7, W, r);
        break;
      case "sanmartin":
        casas(g, 0, W * 0.24, r); iglesia(g, W * 0.27, W * 0.55, "der", 240); casas(g, W * 0.62, W, r);
        break;
      case "sanesteban":
        // el claustro y la iglesia del convento
        rect(g, 0xd9cbad, 0, SUELO - 170, W * 0.3, 170); for (let x = 20; x < W * 0.3 - 30; x += 60) hueco(g, 0xb6a37f, x + 25, SUELO - 10, 40, 110);
        iglesia(g, W * 0.33, W * 0.62, "der", 270); casas(g, W * 0.68, W, r);
        break;
      case "plaza":
        // soportales a todo lo largo
        casas(g, 0, W, r, 210);
        rect(g, 0xc9b48a, 0, SUELO - 110, W, 8);
        for (let x = 0; x < W; x += 80) hueco(g, 0x6d5a45, x + 40, SUELO, 56, 100);
        break;
      default: casas(g, 0, W, r);
    }
    // las salidas del fondo que no son puertas de la muralla: una calle que se abre entre las casas
    for (const [a, sal] of Object.entries(ESCENAS[id].salidas)) {
      if (sal.lado !== "fondo" || sal.arco) continue;
      const x = salidaX(id, sal);
      rect(g, 0xbfae8a, x - 50, SUELO - 220, 100, 220); poly(g, 0xcdb894, [[x - 50, SUELO], [x + 50, SUELO], [x + 30, SUELO - 40], [x - 30, SUELO - 40]]);
      rect(g, OSCURO, x - 50, SUELO - 220, 6, 220); rect(g, OSCURO, x + 44, SUELO - 220, 6, 220);
    }
    // la calleja por la que se va la ronda: un callejón estrecho, sin letrero
    if (ESCENAS[id].calleja != null) { const x = ESCENAS[id].calleja * W; rect(g, 0x2c241d, x - 18, SUELO - 150, 36, 150); }
  }
  function letrero(sc, x, y, txt, ancla) {
    return sc.add.text(x, y, txt, { fontFamily: "Georgia, serif", fontSize: "19px", color: "#2b2118", backgroundColor: "#f3e9d3", padding: { x: 8, y: 4 } }).setOrigin(ancla == null ? 0.5 : ancla, 1).setDepth(800);
  }

  // ------------------------------------------------------------------ la escena de Phaser
  let SC = null; // la escena viva
  const teclas = { izq: false, der: false };
  class Calle extends Phaser.Scene {
    constructor() { super("calle"); }
    create() {
      SC = this;
      this.cosas = []; this.objs = []; this.zonas = [];
      this.luz = this.add.rectangle(0, 0, WV, HV, 0xffffff, 1).setOrigin(0).setScrollFactor(0).setDepth(5000).setBlendMode(Phaser.BlendModes.MULTIPLY);
      // si la ronda está en la escena pero fuera de cuadro (las escenas anchas), un aviso en el borde
      this.borde = this.add.container(0, 0).setScrollFactor(0).setDepth(7500).setVisible(false);
      const gb = this.add.graphics(); ell(gb, 0xb33a2e, 0, 0, 70, 42); this.borde.add(gb);
      this.bordeTxt = this.add.text(0, 0, "!", { fontFamily: "system-ui", fontSize: "26px", fontStyle: "bold", color: "#fff" }).setOrigin(0.5);
      this.borde.add(this.bordeTxt);
      this.burbuja = this.add.text(0, 0, "", { fontFamily: "system-ui, sans-serif", fontSize: "19px", color: "#2b2118", backgroundColor: "#fffaf0", padding: { x: 10, y: 6 }, wordWrap: { width: 420 } }).setOrigin(0.5, 1).setDepth(6000).setVisible(false);
      this.input.on("pointerdown", (p, objs) => tocarEscena(p, objs));
      if (enDia()) construir(ui.escena || s.lugar, ui.x);
    }
    update() { mover(); avisoBorde(); }
  }

  // construir la escena de un sitio; x: dónde apareces
  function construir(id, x) {
    if (!SC) return;
    const sc = SC;
    for (const o of sc.objs) o.destroy();
    for (const z of sc.zonas) z.destroy();
    sc.tweens.killAll();
    sc.objs = []; sc.zonas = []; sc.cosas = []; sc.ronda = null;
    ui.escena = id;
    const W = anchoDe(id), f = franjaAct();
    const r = rng(`${s.semilla}|${s.anio}|${id}`);
    sc.cameras.main.setBounds(0, 0, W, HV);
    // el cielo y el decorado
    const g = sc.add.graphics().setDepth(0);
    rect(g, CIELO[f], 0, 0, W, SUELO);
    decorado(g, id, W, r);
    sc.objs.push(g);
    // el luz de la franja
    sc.luz.setFillStyle(LUZ[f], 1);
    // la fachada se toca: lo que sabes de este sitio
    zona(sc, W / 2, (SUELO + 120) / 2, W, SUELO - 120, { tipo: "sitio" }, 1);
    // las salidas: letrero y sitio donde se pasa
    for (const [a, sal] of Object.entries(ESCENAS[id].salidas)) {
      const sx = salidaX(id, sal);
      const lx = sal.lado === "izq" ? 18 : sal.lado === "der" ? W - 18 : sx;
      const t = letrero(sc, lx, sal.lado === "fondo" ? (sal.arco ? SUELO - 190 : SUELO - 230) : SUELO - 20, (sal.lado === "izq" ? "← " : sal.lado === "fondo" ? "↑ " : "") + L[a].corto + (sal.lado === "der" ? " →" : ""), sal.lado === "izq" ? 0 : sal.lado === "der" ? 1 : 0.5);
      sc.objs.push(t);
      const zx = sal.lado === "izq" ? 50 : sal.lado === "der" ? W - 50 : sx;
      sc.cosas.push({ x: zx, radio: 110, tipo: "salida", a, prio: 2 });
      zona(sc, zx, sal.lado === "fondo" ? SUELO - 80 : SUELO + 60, sal.lado === "fondo" ? 120 : 100, sal.lado === "fondo" ? 180 : 260, { tipo: "salida", a }, 900);
    }
    poblar(id);
    // tú
    ui.x = x == null ? entradaX(id, null) : Math.max(30, Math.min(W - 30, x));
    sc.yo = figura(sc, ui.x, PIES, FIG.yo(ui.pose === "pide"), 1.05, PIES + 1);
    sc.yo.setScale(1.05 * FK);
    sc.yo.setDepth(PIES + 5);
    sc.cameras.main.startFollow(sc.yo, true, 0.12, 0.12);
    sc.cameras.main.centerOn(ui.x, HV / 2);
    zonaYo(sc);
    ui.hover = null;
    sc.burbuja.setVisible(false);
    marcaVisita(id);
  }
  // una figura: un Graphics dibujado desde los pies
  const FK = 1.35; // los muñecos, más grandes que dibujados
  function figura(sc, x, y, dibujo, k, prof) {
    const g = sc.add.graphics();
    dibujo(g);
    g.setPosition(x, y).setScale((k || 1) * FK).setDepth(prof == null ? y : prof);
    sc.objs.push(g);
    return g;
  }
  function zona(sc, x, y, w, h, datos, prof) {
    const z = sc.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(prof || y);
    z.setData("cosa", datos);
    sc.zonas.push(z);
    return z;
  }
  function zonaYo(sc) {
    if (sc.zonaYo) sc.zonaYo.destroy();
    sc.zonaYo = sc.add.zone(ui.x, PIES - 66, 80, 150).setInteractive({ useHandCursor: true }).setDepth(9000);
    sc.zonaYo.setData("cosa", { tipo: "yo" });
  }
  // quién hay en la escena: lo que dice el motor de este sitio en esta franja
  function poblar(id) {
    const sc = SC, W = anchoDe(id), e0 = ESCENAS[id];
    const f = franjaAct();
    const v = M.verDe(s, id) || {};
    const r = rng(`${s.semilla}|${s.anio}|${s.dia}|${f}|${id}`);
    const libres = []; // sitios del suelo donde no hay salidas ni gente fija
    const ocupado = [];
    for (const sal of Object.values(e0.salidas)) ocupado.push([salidaX(id, sal) - 90, salidaX(id, sal) + 90]);
    if (e0.vigia != null) ocupado.push([e0.vigia * W - 60, e0.vigia * W + 60]);
    // la ronda: donde estás, la que ves ahora; en la escena de un resultado (te paró y te echó), la que te paró
    const m = s.memoria[id];
    const hayRonda = id === s.lugar && s.t < E.FIN ? rondaAqui() === id : !!(s.fase === "resultado" && m && m.ronda && m.dia === s.dia);
    if (hayRonda) ocupado.push([e0.ronda * W - 50, e0.ronda * W + 160]);
    ocupado.push([e0.pobres * W - 60, e0.pobres * W + 60]);
    // con las tretas y la presión: los que venden, la panadera, el guarda, los diputados y los alguaciles del Estudio
    const fijos = s.t < E.FIN && id === s.lugar ? fijosTretas(id, W, hayRonda) : [];
    for (const fx of fijos) ocupado.push([fx.x - 70, fx.x + (fx.fig2 ? 130 : 70)]);
    const libre = (x) => !ocupado.some(([a, b]) => x > a && x < b);
    for (let x = 120; x < W - 120; x += 58) if (libre(x)) libres.push(x);
    // la gente que da, según cuánta hay; la de paso, andando
    const n = !v.gente ? 0 : v.gente === 1 ? (L[id].quien === "solo pobres" ? 0 : L[id].dentro ? 1 : 2) : v.gente === 2 ? Math.round(2.4 * e0.ancho) : Math.round(5.5 * e0.ancho) + 1;
    const tomados = new Set();
    for (let i = 0; i < n && libres.length; i++) {
      let k = Math.floor(r() * libres.length), intentos = 0;
      while (tomados.has(k) && intentos++ < 20) k = Math.floor(r() * libres.length);
      tomados.add(k);
      const x = libres[k] + Math.floor(r() * 20), y = 528 + Math.floor(r() * 50);
      const fg = figura(sc, x, y, genteDe(id, r), 0.86 + (y - 528) / 400);
      if (v.gente === 1) { // de paso: van de camino
        const dest = x + (r() < 0.5 ? -1 : 1) * (300 + r() * 300);
        sc.tweens.add({ targets: fg, x: Math.max(60, Math.min(W - 60, dest)), duration: 9000 + r() * 5000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      } else if (r() < 0.35) sc.tweens.add({ targets: fg, y: y - 2, duration: 900 + r() * 600, yoyo: true, repeat: -1 });
      sc.cosas.push({ x, radio: 70, tipo: "gente", prio: 0 });
    }
    // en la ribera, solo pobres
    if (id === "ribera") for (let i = 0; i < 3; i++) { const x = W * (0.2 + i * 0.25) + r() * 60, y = 560 + r() * 40; figura(sc, x, y, i === 1 ? FIG.tendido() : FIG.pobre(r() < 0.5)); }
    // los otros pobres pidiendo (sin los tuyos)
    if (v.pobres && L[id].dentro) {
      const px = e0.pobres * W;
      figura(sc, px - 44, 590, FIG.pobre(true)); figura(sc, px + 34, 602, FIG.pobre(false));
      sc.cosas.push({ x: px, radio: 90, tipo: "pobres", prio: 1 }); zona(sc, px, 550, 160, 110, { tipo: "pobres" }, 700);
    }
    // los tuyos, cuando coincidís
    (v.tuyos || []).forEach((t, i) => {
      const tx = e0.tuyos * W + i * 86, ty = 600 + i * 8;
      figura(sc, tx, ty, t.nombre === "Pedro" ? FIG.pedro(t.pide) : FIG.catalina(t.pide));
      const et = sc.add.text(tx, ty - (t.pide ? 100 : 136), t.nombre, { fontFamily: "system-ui, sans-serif", fontSize: "16px", fontStyle: "bold", color: "#fff", backgroundColor: t.nombre === "Pedro" ? "#3d6b98" : "#4c8a47", padding: { x: 6, y: 2 } }).setOrigin(0.5, 1).setDepth(ty + 1);
      sc.objs.push(et);
      sc.cosas.push({ x: tx, radio: 70, tipo: "tuyo", t, prio: 2 }); zona(sc, tx, ty - 66, 80, 140, { tipo: "tuyo", t }, 710);
    });
    // quien avisa enseguida (lo dicen las reglas: aviso 2), siempre a la vista
    if (e0.vigia != null && L[id].aviso >= 2) {
      const vx = e0.vigia * W;
      figura(sc, vx, 548, id === "puerta" ? FIG.portero() : id === "escuelas" ? FIG.bedel() : FIG.cura());
      sc.cosas.push({ x: vx, radio: 90, tipo: "vigia", prio: 1 }); zona(sc, vx, 470, 80, 170, { tipo: "vigia" }, 720);
    }
    // el capataz de las obras, cuando cogen peones
    if (L[id].trabajo && v.trabajo) {
      const cx = e0.obra * W + 170;
      figura(sc, cx, 560, FIG.capataz());
      sc.cosas.push({ x: cx, radio: 90, tipo: "capataz", prio: 2 }); zona(sc, cx, 480, 80, 170, { tipo: "capataz" }, 730);
    }
    for (const fx of fijos) {
      figura(sc, fx.x, 556, fx.fig);
      if (fx.fig2) figura(sc, fx.x + 64, 576, fx.fig2, 0.97);
      const cx = fx.x + (fx.fig2 ? 32 : 0);
      sc.cosas.push({ x: cx, radio: fx.fig2 ? 110 : 85, tipo: fx.tipo, prio: fx.prio || 2 });
      zona(sc, cx, 476, fx.fig2 ? 150 : 80, 170, { tipo: fx.tipo }, 735);
    }
    // el mesón (con las tretas): un tablero colgado y un ramo, como se señalaban las posadas
    if (s.conTretas && TR.posada && MESON[id] != null && TR.posada.en.includes(id)) {
      const mx = MESON[id] * W, my = SUELO - 175;
      const gm = sc.add.graphics().setDepth(4);
      raya(gm, OSCURO, 4, mx - 70, my - 40, mx + 10, my - 40); raya(gm, OSCURO, 3, mx - 60, my - 40, mx - 60, my - 22); raya(gm, OSCURO, 3, mx - 4, my - 40, mx - 4, my - 22);
      rect(gm, 0x8a6a42, mx - 82, my - 22, 100, 34); g2frame(gm, OSCURO, mx - 82, my - 22, 100, 34, 2);
      circ(gm, 0x5f7a3a, mx + 20, my - 30, 13); circ(gm, 0x6f8a44, mx + 28, my - 22, 10);
      sc.objs.push(gm);
      sc.objs.push(sc.add.text(mx - 32, my - 5, "MESÓN", { fontFamily: "Georgia, serif", fontSize: "17px", fontStyle: "bold", color: "#f3e9d3" }).setOrigin(0.5).setDepth(5));
      sc.cosas.push({ x: mx - 30, radio: 80, tipo: "meson", prio: 1 }); zona(sc, mx - 30, my - 5, 110, 50, { tipo: "meson" }, 745);
    }
    // los puestos de la plaza a sus horas (y las tiendas de la Rúa, con hurtar)
    if ((id === "plaza" || (id === "rua" && s.conHurto)) && E.franjasHurto(s, id, s.dia).includes(f)) {
      const xs = id === "plaza" ? [0.3, 0.44, 0.58, 0.72] : [0.3, 0.66];
      for (const fx of xs) {
        const gx = sc.add.graphics().setDepth(515);
        const x = fx * W;
        for (let k = 0; k < 5; k++) rect(gx, k % 2 ? 0xf1e6cf : 0xb5473a, x - 50 + k * 20, SUELO + 2, 20, 26);
        rect(gx, 0x8a6a42, x - 46, SUELO + 28, 92, 34); for (let k = 0; k < 4; k++) ell(gx, 0xc9944e, x - 30 + k * 20, SUELO + 26, 18, 10);
        sc.objs.push(gx);
        sc.cosas.push({ x, radio: 60, tipo: "puesto", prio: 1 });
      }
    }
    // el Corpus: banderines por la Rúa y la plaza
    if (E.dia(s).tipo === "corpus" && (id === "rua" || id === "plaza")) {
      const gb = sc.add.graphics().setDepth(2);
      raya(gb, LINEA, 2, 0, 150, W, 170);
      for (let x = 20; x < W; x += 44) poly(gb, (x / 44) % 2 < 1 ? 0xb5473a : 0xd8b04a, [[x, 150 + (x / W) * 20], [x + 24, 150 + ((x + 24) / W) * 20], [x + 12, 180 + (x / W) * 20]]);
      sc.objs.push(gb);
    }
    // los vecinos asomados: donde te vieron pedir hoy (en rojo) y, si no, donde se ha quejado alguien de otro
    if (e0.ventana != null) {
      const mio = M.pedidoAqui(s, id).length > 0, otro = !mio && s.t < E.FIN && E.hayQuejas(s, id);
      if (mio || otro) {
        const wx = e0.ventana * W, wy = SUELO - 190;
        const gv = sc.add.graphics().setDepth(3);
        rect(gv, 0x3a2e24, wx - 26, wy - 30, 52, 60); g2frame(gv, mio ? 0xb33a2e : 0x7d6b58, wx - 26, wy - 30, 52, 60, mio ? 5 : 3);
        circ(gv, PIEL, wx, wy - 6, 11); rect(gv, mio ? 0x9a3a2e : 0x7d6b58, wx - 16, wy + 6, 32, 24);
        if (mio) { raya(gv, PIEL, 6, wx + 16, wy + 8, wx + 34, wy - 26); circ(gv, PIEL, wx + 35, wy - 28, 6); }
        sc.objs.push(gv);
        sc.cosas.push({ x: wx, radio: 90, tipo: mio ? "queja-mia" : "queja", prio: 2 }); zona(sc, wx, wy, 70, 80, { tipo: mio ? "queja-mia" : "queja" }, 740);
      }
    }
    // la ronda: el alguacil y sus corchetes, con la llamada de atención
    if (hayRonda) ponerRonda(sc, e0.ronda * W);
  }
  function fijosTretas(id, W, hayRonda) {
    const out = [], f = franjaAct(), e0 = ESCENAS[id];
    if (s.conTretas) {
      const v = VENDEDOR[id];
      if (v && (TR.lista || []).some((t) => t.compra && t.compra.lugar === id && t.compra.franjas.includes(f) && !(s.quemadas || []).includes(t.id))) out.push({ x: v.x * W, fig: FIG[v.fig](), tipo: "vende" });
      const pp = TR.pan || {};
      if (PANADERA[id] != null && ((pp.compraEn || {})[id] || []).includes(f)) out.push({ x: PANADERA[id] * W, fig: FIG.panadera(), tipo: "panadera", prio: 1 });
      else if (PANADERA[id] != null && ((pp.ventaEn || {})[id] || []).includes(f)) out.push({ x: PANADERA[id] * W, fig: FIG.panadera(), tipo: "ventera", prio: 1 });
    }
    if (s.conPresion) for (const c of E.cierresActivos(s)) {
      if (c.lugar !== id || c.f !== f) continue;
      if (c.tipo === "puerta") { const sal = Object.values(e0.salidas).find((x) => x.arco); const gx = sal ? salidaX(id, sal) : W / 2; out.push({ x: gx + (id === "puerta" ? -105 : 105), fig: FIG.guarda(), tipo: "guarda", prio: 3 }); }
      else { const est = c.tipo === "estudio"; out.push({ x: e0.ronda * W - (hayRonda ? 200 : 0), fig: est ? FIG.algEstudio() : FIG.diputado(true), fig2: est ? FIG.algEstudio() : FIG.diputado(false), tipo: est ? "estudio" : "diputados", prio: 3 }); }
    }
    return out;
  }
  function g2frame(g, c, x, y, w, h, grosor) { g.lineStyle(grosor, c, 1); g.strokeRect(x, y, w, h); }
  function ponerRonda(sc, x) {
    const grupo = [];
    grupo.push(figura(sc, x, 596, FIG.alguacil(), 1.08));
    grupo.push(figura(sc, x + 74, 572, FIG.corchete(), 0.96));
    grupo.push(figura(sc, x + 128, 608, FIG.corchete(), 1.02));
    const alerta = sc.add.container(x, 596 - 228).setDepth(7000);
    const ga = sc.add.graphics(); circ(ga, 0xb33a2e, 0, 0, 16); alerta.add(ga);
    alerta.add(sc.add.text(0, 1, "!", { fontFamily: "system-ui", fontSize: "24px", fontStyle: "bold", color: "#fff" }).setOrigin(0.5));
    sc.tweens.add({ targets: alerta, y: alerta.y - 8, duration: 450, yoyo: true, repeat: -1 });
    sc.objs.push(alerta);
    grupo.push(alerta);
    sc.ronda = grupo;
    sc.cosas.push({ x: x + 60, radio: 150, tipo: "ronda", prio: 3 });
    const z = zona(sc, x + 60, 500, 220, 240, { tipo: "ronda" }, 750);
    grupo.push(z);
    return grupo;
  }

  function avisoBorde() {
    const sc = SC;
    if (!sc || !sc.borde) return;
    const al = sc.ronda && sc.ronda[0] && sc.ronda[0].active ? sc.ronda[0] : null;
    if (!al || !enDia()) { sc.borde.setVisible(false); return; }
    const v = sc.cameras.main.worldView;
    if (al.x > v.x + 40 && al.x < v.right - 40) { sc.borde.setVisible(false); return; }
    const izq = al.x <= v.x + 40;
    sc.borde.setVisible(true).setPosition(izq ? 34 : WV - 34, 330);
    sc.bordeTxt.setText(izq ? "◀ !" : "! ▶");
  }

  // ------------------------------------------------------------------ andar
  let reloj = 0;
  function mover() {
    const ahora = performance.now(), dt = reloj ? Math.min(100, ahora - reloj) : 16;
    reloj = ahora;
    if (!SC || !SC.yo || !enDia() || bloqueado()) { if (SC && SC.yo) andando(false); return; }
    const W = anchoDe(ui.escena);
    let dir = (teclas.der ? 1 : 0) - (teclas.izq ? 1 : 0);
    if (dir) ui.objetivo = null;
    else if (ui.objetivo) {
      const dx = ui.objetivo.x - ui.x;
      if (Math.abs(dx) < 8) { const o = ui.objetivo; ui.objetivo = null; alLlegar(o); return; }
      dir = Math.sign(dx);
    }
    if (!dir) { andando(false); acercarse(); return; }
    // si te queda un resultado bueno a la vista, andar es seguir
    if (s.fase === "resultado") { seguirResultado(); guardar(); pintar(); if (s.fase !== "dia") return; }
    const antes = ui.x;
    ui.x = Math.max(0, Math.min(W, ui.x + dir * VEL * dt / 1000));
    cuenta("px", Math.abs(ui.x - antes));
    SC.yo.x = ui.x; SC.yo.setScale((dir < 0 ? -1.05 : 1.05) * FK, 1.05 * FK);
    SC.zonaYo.x = ui.x;
    andando(true);
    const sal = ESCENAS[ui.escena].salidas;
    if (ui.soltar) { if (ui.x < 12 || ui.x > W - 12) { ui.x = Math.max(12, Math.min(W - 12, ui.x)); SC.yo.x = ui.x; } acercarse(); return; }
    for (const [a, sl] of Object.entries(sal)) {
      if ((sl.lado === "izq" && dir < 0 && ui.x <= 12) || (sl.lado === "der" && dir > 0 && ui.x >= W - 12)) { salir(a, "borde"); return; }
    }
    acercarse();
  }
  let paso = 0;
  function andando(si) {
    if (!SC.yo) return;
    if (si) { paso += 0.25; SC.yo.y = PIES - Math.abs(Math.sin(paso)) * 4; ui.andaba = true; } else if (ui.andaba) { SC.yo.y = PIES; ui.andaba = false; }
  }
  // lo que sirve para entender sale al acercarte: una línea encima de lo más cercano
  function acercarse() {
    if (!SC || !SC.cosas) return;
    let mejor = null;
    for (const c of SC.cosas) {
      const d = Math.abs(c.x - ui.x);
      if (d <= c.radio && (!mejor || c.prio > mejor.c.prio || (c.prio === mejor.c.prio && d < mejor.d))) mejor = { c, d };
    }
    const c = mejor && mejor.c;
    const clave = c ? `${c.tipo}|${c.x}|${c.a || ""}` : null;
    if (clave === ui.hover) return;
    ui.hover = clave;
    if (!c) { SC.burbuja.setVisible(false); return; }
    const txt = textoDe(c);
    if (!txt) { SC.burbuja.setVisible(false); return; }
    cuenta("cerca_" + c.tipo);
    const alto = c.tipo === "ronda" ? 330 : c.tipo === "salida" ? (ESCENAS[ui.escena].salidas[c.a].lado === "fondo" ? 220 : 330) : c.tipo.startsWith("queja") || c.tipo === "meson" ? 230 : c.tipo === "vigia" || c.tipo === "guarda" ? 330 : 385;
    SC.burbuja.setText(txt).setPosition(Math.max(230, Math.min(anchoDe(ui.escena) - 230, c.x)), alto).setVisible(true);
  }
  function textoDe(c) {
    if (c.tipo === "salida") return lineaSalida(ui.escena, c.a);
    if (c.tipo === "tuyo") return lineaTuyo(c.t);
    return linea(c.tipo, ui.escena);
  }
  const bloqueado = () => ui.menu || ui.mapa || ui.viajando || !modal.hidden || ui.sitio || (s.fase === "resultado" && (s.ultimo || {}).tono === "mal");
  // tocar la escena: un muñeco, una salida, la fachada, tú, o el suelo (andar hasta ahí)
  function tocarEscena(p, objs) {
    if (!enDia()) return;
    if (ui.menu || ui.sitio) { ui.menu = false; ui.sitio = null; pintar(); return; }
    if (bloqueado()) return;
    const z = (objs || []).find((o) => o.getData && o.getData("cosa"));
    const c = z && z.getData("cosa");
    if (c && c.tipo === "yo") { cuenta("menu"); ui.menu = true; pintar(); return; }
    if (c && c.tipo === "salida") { const sl = ESCENAS[ui.escena].salidas[c.a]; ui.objetivo = { x: sl.lado === "izq" ? -50 : sl.lado === "der" ? anchoDe(ui.escena) + 50 : salidaX(ui.escena, sl), salida: c.a }; return; }
    if (c && c.tipo === "sitio" && p.worldY < SUELO) { cuenta("clic_sitio"); ui.sitio = ui.escena; pintar(); return; }
    if (c && c.tipo !== "sitio") {
      cuenta("clic_" + c.tipo);
      const txt = c.tipo === "tuyo" ? lineaTuyo(c.t) : linea(c.tipo, ui.escena);
      SC.burbuja.setText(txt).setPosition(Math.max(230, Math.min(anchoDe(ui.escena) - 230, z.x)), Math.max(140, z.y - z.height / 2 - 10)).setVisible(true);
      ui.hover = "clic";
      return;
    }
    ui.objetivo = { x: Math.max(20, Math.min(anchoDe(ui.escena) - 20, p.worldX)) };
    cuenta("clic_andar");
  }
  function alLlegar(o) {
    if (o.salida) salir(o.salida, ESCENAS[ui.escena].salidas[o.salida].lado === "fondo" ? "puerta" : "borde");
  }
  // la puerta del fondo: con W o ↑ si estás delante
  function puertaDelante() {
    if (!enDia() || bloqueado()) return;
    for (const [a, sl] of Object.entries(ESCENAS[ui.escena].salidas)) if (sl.lado === "fondo" && Math.abs(salidaX(ui.escena, sl) - ui.x) < 70) { salir(a, "puerta"); return; }
  }

  // ================================================================== el motor: salir, hacer, viajar
  function seguirSiCabe() {
    if (s.fase !== "resultado") return true;
    if ((s.ultimo || {}).tono === "mal") return false;
    E.seguir(s);
    return s.fase === "dia";
  }
  // «Seguir» tras un resultado: si la ronda te echó al puente (o te mandó a las obras), apareces donde has acabado
  function seguirResultado() {
    E.seguir(s); ui.pose = null;
    if (!enDia() || !SC) return;
    if (ui.escena !== s.lugar) { construir(s.lugar, entradaX(s.lugar, null)); return; }
    SC.yo.destroy();
    SC.yo = figura(SC, ui.x, PIES, FIG.yo(false), 1.05, PIES + 5);
    SC.cameras.main.startFollow(SC.yo, true, 0.12, 0.12);
  }
  // salir por una salida al sitio vecino: el «mover» del motor (2 ratos)
  function salir(a, como) {
    if (!seguirSiCabe()) { pintar(); return; }
    const mv = E.opciones(s).movs.find((m) => m.destino === a);
    ui.objetivo = null;
    if (!mv || !mv.ok) {
      SC.burbuja.setText(`${L[a].nombre}: ${mv ? mv.porque : "no te da tiempo"}.`).setPosition(Math.max(230, Math.min(anchoDe(ui.escena) - 230, ui.x)), 330).setVisible(true); ui.hover = "aviso";
      const W = anchoDe(ui.escena); ui.x = Math.max(60, Math.min(W - 60, ui.x)); SC.yo.x = ui.x; SC.zonaYo.x = ui.x;
      return;
    }
    const de = s.lugar, antes = foto();
    E.mover(s, a); E.comprobarNoche(s);
    cuenta("salidas"); cuenta("salidas_" + como);
    ui.soltar = teclas.izq || teclas.der;
    llegar(de, a, antes);
  }
  // después de llegar a un sitio (por una salida o en el viaje): se dibuja ese sitio; si pasó algo, sale el resultado
  function llegar(de, a, antes) {
    ui.pose = null; ui.menu = false; ui.sitio = null;
    guardar();
    if (!enDia()) { pintar(); return; }
    construir(a, entradaX(a, de));
    // aparecer por la puerta del fondo: un paso hacia delante
    const sl = ESCENAS[a].salidas[de];
    if (sl && sl.lado === "fondo") { SC.yo.y = SUELO + 30; SC.yo.setScale(0.8 * FK); SC.tweens.add({ targets: SC.yo, y: PIES, scaleX: 1.05 * FK, scaleY: 1.05 * FK, duration: 350 }); }
    luzDesde(antes);
    pintar();
  }
  // lo que había antes de una acción, para animar lo que cambia
  function foto() { return { lugar: s.lugar, f: franjaAct(), dia: s.dia, anio: s.anio, ronda: rondaAqui(), pan: s.pan, llagaPasadas: s.llagaPasadas || 0 }; }
  function luzDesde(a) {
    if (!SC || !a || a.f === franjaAct()) return;
    SC.luz.setFillStyle(LUZ[a.f], 1);
    const c0 = Phaser.Display.Color.ValueToColor(LUZ[a.f]), c1 = Phaser.Display.Color.ValueToColor(LUZ[franjaAct()]);
    SC.tweens.addCounter({ from: 0, to: 100, duration: 1200, onUpdate: (tw) => { const c = Phaser.Display.Color.Interpolate.ColorWithColor(c0, c1, 100, tw.getValue()); SC.luz.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1); } });
    campanas();
  }
  // las acciones del menú (E): las del motor, con su coste de siempre
  // con las tretas: «treta:voto», «comprar:carta:pan:voto» (la treta, cómo pagas y cuál dejas), «poner:cautivo», «quitar», el pan
  const TIENDA = ["comprar", "poner", "quitar", "comprarPan", "venderPan"];
  function hacer(id) {
    if (!seguirSiCabe()) { pintar(); return; }
    const [tipo, arg, mon, olv] = id.split(":");
    const a = tipo === "treta" ? E.tretaAqui(s, arg) : TIENDA.includes(tipo) ? { ok: true } : E.opciones(s).acc.find((x) => x.id === id);
    if (!a || !a.ok) return;
    ui.menu = false; ui.sitio = null;
    cuenta("accion"); cuenta("accion_" + tipo + (arg && tipo !== "comprar" ? "_" + arg : tipo === "comprar" ? "_" + arg : ""));
    const antes = foto();
    if (tipo === "treta") E.pedirCon(s, arg);
    else if (tipo === "comprar") { E.comprar(s, arg, olv || null, mon || null); E.comprobarNoche(s); }
    else if (tipo === "poner") { E.poner(s, arg); E.comprobarNoche(s); }
    else if (tipo === "quitar") { E.quitar(s); E.comprobarNoche(s); }
    else if (tipo === "comprarPan") { E.comprarPan(s); E.comprobarNoche(s); }
    else if (tipo === "venderPan") { E.venderPan(s); E.comprobarNoche(s); }
    else if (id === "pedir") E.pedir(s);
    else if (id === "trabajo") E.pedirTrabajo(s);
    else if (id === "hurtar") { E.hurtar(s); E.comprobarNoche(s); }
    else if (id === "esperar") { E.esperar(s); E.comprobarNoche(s); }
    else if (id === "acabar") { E.acabarDia(s); E.comprobarNoche(s); }
    guardar();
    if (!enDia()) { pintar(); return; }
    // pidiendo, te quedas sentado con el cuenco mientras lees lo que pasó
    ui.pose = (id === "pedir" || tipo === "treta") && s.lugar === antes.lugar && s.t < E.FIN ? "pide" : null;
    const W = anchoDe(s.lugar);
    construir(s.lugar, s.lugar === antes.lugar ? ui.x : entradaX(s.lugar, null));
    void W;
    animarCambios(antes);
    pintar();
  }
  // lo que cambia en la escena tras una acción: la ronda que llega o se va, el pan, la luz
  function animarCambios(a) {
    if (!SC || !a || a.dia !== s.dia || a.lugar !== s.lugar) { luzDesde(a); return; }
    const e0 = ESCENAS[s.lugar], W = anchoDe(s.lugar);
    const ahora = rondaAqui() === s.lugar, antes = a.ronda === s.lugar;
    // la ronda llega al cambiar de franja: entra por la salida del lado de donde venía
    if (ahora && !antes && SC.ronda) {
      const k = `${s.dia}|${Math.max(0, franjaAct() - 1)}`, previo = s.rondas[k];
      const sx = entradaRonda(s.lugar, previo);
      for (const o of SC.ronda) { if (!o.x && o.x !== 0) continue; const dx = o.x - (e0.ronda * W); o.x = sx + dx; SC.tweens.add({ targets: o, x: e0.ronda * W + dx, duration: 1600, ease: "Sine.out" }); }
    }
    // la ronda se va: por la calleja, que no dice adónde
    if (!ahora && antes && e0.calleja != null) {
      const x0 = e0.ronda * W;
      const grupo = [figura(SC, x0, 596, FIG.alguacil(), 1.08), figura(SC, x0 + 74, 572, FIG.corchete(), 0.96), figura(SC, x0 + 128, 608, FIG.corchete(), 1.02)];
      for (const o of grupo) SC.tweens.add({ targets: o, x: e0.calleja * W + (o.x - x0) * 0.3, y: SUELO + 20, alpha: 0, scaleX: 0.7, scaleY: 0.7, duration: 1800, ease: "Sine.in" });
    }
    if (s.pan > a.pan) {
      const t = SC.add.text(ui.x, PIES - 120, `+${s.pan - a.pan}`, { fontFamily: "system-ui", fontSize: "32px", fontStyle: "bold", color: "#2f6b35", stroke: "#fffaf0", strokeThickness: 5 }).setOrigin(0.5).setDepth(7000);
      SC.objs.push(t);
      SC.tweens.add({ targets: t, y: t.y - 60, alpha: 0, duration: 1600 });
    }
    luzDesde(a);
  }
  // por qué salida entra la ronda: la que lleva hacia donde estaba (si comía o no se sabe, por la calleja)
  function entradaRonda(id, previo) {
    const W = anchoDe(id), e0 = ESCENAS[id];
    if (previo && previo !== id) {
      let mejor = null;
      for (const [a, sl] of Object.entries(e0.salidas)) { const d = E.DIST[previo][a]; if (mejor == null || d < mejor.d) mejor = { d, sl }; }
      if (mejor) return mejor.sl.lado === "izq" ? -120 : mejor.sl.lado === "der" ? W + 60 : salidaX(id, mejor.sl);
    }
    return e0.calleja != null ? e0.calleja * W : -120;
  }
  // el mapa: viajar por el camino elegido, paso a paso (mover del motor), parando donde pasa algo
  function viajar() {
    const ruta = ui.ruta.slice();
    if (!ruta.length || !seguirSiCabe()) return;
    const hechos = [s.lugar];
    let parada = null;
    const antes = foto();
    for (const d of ruta) {
      const mv = E.opciones(s).movs.find((m) => m.destino === d);
      if (!mv || !mv.ok) { parada = mv && /guarda/.test(mv.porque) ? "guarda" : "tiempo"; ui.paradaTxt = mv && parada === "guarda" ? `${L[d].nombre}: ${mv.porque}.` : "No te da tiempo de seguir."; break; }
      E.mover(s, d); E.comprobarNoche(s);
      hechos.push(d);
      cuenta("pasos_mapa");
      if (s.fase !== "dia") { parada = s.fase === "resultado" ? "algo" : "noche"; break; }
      if (rondaAqui()) { parada = "ronda"; break; }
    }
    cuenta("viajes");
    if (parada) cuenta("viajes_parados_" + parada);
    guardar();
    ui.viajando = true;
    ui.ruta = [];
    // se ve el camino en el mapa y después apareces en la escena donde has parado
    pintarMapa(hechos[0]);
    const mk = capa.querySelector("#m-yo");
    let i = 0;
    const siguiente = () => {
      i++;
      if (i >= hechos.length || !mk) {
        setTimeout(() => {
          ui.viajando = false; ui.mapa = false;
          const ultimo = hechos[hechos.length - 1], previo = hechos[hechos.length - 2];
          if (hechos.length > 1) llegar(previo, ultimo, antes); else pintar();
          if ((parada === "tiempo" || parada === "guarda") && SC) { SC.burbuja.setText(ui.paradaTxt || "No te da tiempo de seguir.").setPosition(Math.max(230, Math.min(anchoDe(ui.escena) - 230, ui.x)), 330).setVisible(true); ui.hover = "aviso"; }
        }, 250);
        return;
      }
      const [x0, y0] = M.POS[hechos[i - 1]], [x1, y1] = M.POS[hechos[i]];
      mk.style.transition = "none"; mk.style.transform = `translate(${x0 - M.POS[hechos[0]][0]}px, ${y0 - M.POS[hechos[0]][1]}px)`;
      mk.getBoundingClientRect();
      requestAnimationFrame(() => { mk.style.transition = "transform 280ms linear"; mk.style.transform = `translate(${x1 - M.POS[hechos[0]][0]}px, ${y1 - M.POS[hechos[0]][1]}px)`; });
      setTimeout(siguiente, 300);
    };
    setTimeout(siguiente, 150);
  }

  // ================================================================== HTML: HUD, menú, tarjetas, mapa
  const BELL = (cls) => `<svg viewBox="0 0 24 24" class="campana ${cls}"><path d="M12 2c-.6 0-1 .4-1 1v1.1C7.6 4.6 6 7.4 6 10.5V15l-2 2.5V18h16v-.5L18 15v-4.5c0-3.1-1.6-5.9-5-6.4V3c0-.6-.4-1-1-1z"/><circle cx="12" cy="20.5" r="2"/></svg>`;
  const pips = (n, max, tope, cls) => Array.from({ length: max }, (_, i) => `<i class="pip ${cls || ""} ${i < n ? "on" : ""} ${tope != null && i >= tope ? "x" : ""}"></i>`).join("");
  function pintarHud() {
    if (!enDia()) { hud.innerHTML = ""; return; }
    const d = E.dia(s), f = franjaAct();
    const sub = [d.fecha, s.conCadena && s.quien && s.quien.id !== "mozo" ? s.quien.nombre : "", `${s.anio || 1545}`, d.fiesta && d.tipo !== "domingo" ? d.fiesta : d.tipo === "domingo" ? "domingo" : "", E.mercado(s) ? "mercado" : ""].filter(Boolean).join(" · ");
    const bells = R.FRANJAS.map((fr, i) => {
      const cls = s.t >= E.FIN ? "pasada" : i < f ? "pasada" : i === f ? "ahora" : "";
      const ratos = i === f && s.t < E.FIN ? `<span class="ratos-f">${Array.from({ length: R.RATOS }, (_, k) => `<i class="${i * R.RATOS + k < s.t ? "g" : ""}"></i>`).join("")}</span>` : "";
      return `<div class="fr-c ${cls}">${BELL(cls)}<span>${fr.nombre}</span>${ratos}</div>`;
    }).join("");
    hud.innerHTML = `<div class="h-izq"><b>Día ${s.dia} de ${R.DIAS}</b><span>${esc(sub)}</span><span class="h-sitio">${esc(L[ui.escena || s.lugar].nombre)}</span></div>
      <div class="h-campanas" id="campanas">${bells}</div>
      <div class="h-estado">
        <span class="st${s.cuerpo <= 2 ? " mal" : ""}"><small>cuerpo</small>${pips(s.cuerpo, P.cuerpoMax, E.cuerpoMax(s), "cuerpo")}</span>
        <span class="st${s.pan === 0 ? " mal" : ""}"><small>pan</small>${pips(s.pan, P.panMax, null, "pan")}</span>
        <span class="st${s.detenciones ? " mal" : ""}"><small>detenciones</small>${pips(s.detenciones, P.detencionesMax, null, "grillete")}</span>
        ${s.conTretas ? `<span class="st${s.blancas > TR.registro ? " mal" : ""}"><small>blancas</small><b>${s.blancas}</b></span>` : ""}
        ${s.conocido ? `<span class="st mal"><small>te conocen</small></span>` : ""}
        ${s.conHurto && s.buscado && s.buscadoSabe ? `<span class="st mal"><small>te busca la justicia</small><b>${Math.min(HU.buscaDias, s.dia - (s.buscadoDia || s.dia) + 1)}/${HU.buscaDias}</b></span>` : ""}
      </div>
      <div class="h-botones">
        <button class="icon-btn" data-act="menuAcc" title="Qué hacer aquí (E)">Hacer <kbd>E</kbd></button>
        <button class="icon-btn" data-act="mapa" title="Mapa (M)">Mapa <kbd>M</kbd></button>
        <button class="icon-btn" data-act="recuerdo" title="Recuerdos (R)">Recuerdos <kbd>R</kbd></button>
        ${s.conTretas ? `<button class="icon-btn" data-act="tretas" title="Tus tretas (T)">Tretas <kbd>T</kbd></button>` : ""}
        <button class="icon-btn" data-act="ayuda" aria-label="Cómo se juega">?</button>
        <button class="icon-btn" data-act="menu" aria-label="Menú">⋯</button>
      </div>`;
  }
  // cuando cambia la franja, la campana de la nueva suena
  function campanas() {
    setTimeout(() => { const c = hud.querySelector(".fr-c.ahora .campana"); if (c) { c.classList.remove("suena"); void c.getBoundingClientRect(); c.classList.add("suena"); } }, 30);
  }
  const RELOJ = `<svg viewBox="-6 -6 12 12" class="ico"><circle r="5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M0,-5 A5,5 0 0 1 0,5 Z" fill="currentColor"/></svg>`;
  // el menú pequeño de lo que puedes hacer aquí, con la previsión del motor al pasar el ratón
  function menuAcciones() {
    const o = E.opciones(s);
    const f = E.franja(Math.min(s.t, E.FIN - 1)), e = s.t < E.FIN ? E.estado(s, s.lugar, s.dia, f) : null;
    const r = rondaAqui(), mitad = s.t % R.RATOS !== 0;
    const items = [];
    const pd = o.acc.find((a) => a.id === "pedir");
    items.push({ id: "pedir", t: "Pedir aquí", d: pd.ok ? `1 franja · ${e.da >= 3 ? "mucha gente" : "poca gente"}${r ? " · ¡ronda!" : ""}${mitad ? " · a mitad de franja" : ""}` : pd.porque, ok: pd.ok, riesgo: !!r, icono: pd.ok && mitad ? RELOJ : "", prev: pd.ok ? E.previsionPedir(s) : [`Pedir: ${pd.porque}.`] });
    const tr = o.acc.find((a) => a.id === "trabajo");
    if (tr) items.push({ id: "trabajo", t: "Pedir trabajo en las obras", d: tr.ok ? "1 rato · si te cogen, hasta nona" : tr.porque, ok: tr.ok, prev: [tr.ok ? `Obras: si te cogen, cargas piedra hasta el final de nona por ${P.trabajo.paga} pedazos de pan. Preguntar cuesta 1 rato.` : `Obras: ${tr.porque}.`] });
    const hu = o.acc.find((a) => a.id === "hurtar");
    if (hu) items.push({ id: "hurtar", t: "Hurtar una hogaza", d: hu.ok ? `${HU.ratos} ratos · ${e.gente >= 3 ? "mucha gente" : "poca gente"}${r ? " · ¡ronda!" : ""}` : hu.porque, ok: hu.ok, riesgo: !!r, prev: [hu.ok ? `Hurtar: una hogaza de un puesto, ${HU.gana} pedazos, ${HU.ratos} ratos. Con poca gente hay más ojos sobre ti, pero si gritan puedes correr; con mucha te ven menos, pero si te ven hay manos para sujetarte.` : `Hurtar: ${hu.porque}.`] });
    // las tretas: las que llevas, con su previsión (por qué no, si no se puede aquí y ahora)
    if (s.conTretas) {
      for (const a of o.acc.filter((x) => x.id === "treta")) {
        const tt = E.TT[a.treta];
        const tit = a.misa ? "Leer tu carta en misa" : tt.cita ? `${tt.boton} con ${(s.tuyos.find((x) => x.id === (s.cita || {}).id) || {}).nombre || "uno de los tuyos"}` : tt.boton;
        items.push({ id: "treta:" + a.treta, t: tit, d: a.ok ? `${a.coste / R.RATOS === 1 ? "1 franja" : a.coste / R.RATOS + " franjas"}${E.catalogada(s, a.treta) ? " · ya la conocen" : ""}${r ? " · ¡ronda!" : ""}${mitad ? " · a mitad de franja" : ""}` : a.porque, ok: a.ok, riesgo: a.ok && !!r, prev: E.previsionTreta(s, a.treta) });
      }
      if (E.puedeQuitar(s)) items.push({ id: "quitar", t: E.TT[s.puesta].puesta.quitar, d: `${TR.ratos} rato · andarás a paso normal`, ok: true, prev: [`Las escondes en el hatillo. Para volver a pedir con ellas, te las pones otra vez.`] });
      for (const id of s.mazo) if (E.puedePoner(s, id)) { const pu = E.TT[id].puesta; items.push({ id: "poner:" + id, t: `Ponerte ${pu.nombre}`, d: `${TR.ratos} rato${pu.paso ? " · andarás más despacio" : ""}`, ok: true, prev: [pu.noParan ? "Con la ropa buena puesta no pareces pobre: la ronda no te para mientras no te conozca, y el guarda de la puerta no te mira." : `Con ${pu.nombre} puestas andas más despacio.`] }); }
      for (const x of E.tiendaAqui(s)) {
        const que = x.rellena ? "pliegos" : x.nombre;
        const formas = [["blancas", `${x.blancas} blancas`, x.okBl]].concat(x.pan ? [["pan", `${x.pan} ${x.pan === 1 ? "pedazo" : "pedazos"} de pan`, x.okPan]] : []);
        if (!x.ok) { items.push({ id: "nada", t: `Comprar ${que} (${formas.map((f2) => f2[1]).join(" o ")})`, d: x.porque, ok: false, prev: [x.dice] }); continue; }
        for (const [m, precio, ok] of formas) {
          if (!ok) continue;
          if (!x.lleno) items.push({ id: `comprar:${x.id}:${m}:`, t: `Comprar ${que} (${precio})`, d: `${TR.ratos} rato · ${x.quien}`, ok: true, prev: [x.dice] });
          else for (const id of s.mazo) items.push({ id: `comprar:${x.id}:${m}:${id}`, t: `Comprar ${que} (${precio}) y dejar ${E.TT[id].nombre}`, d: `llevas ya ${TR.mazo}`, ok: true, prev: [x.dice, `Llevas ${TR.mazo} tretas como mucho: para esta, dejas ${E.TT[id].nombre}.`] });
        }
      }
      const mp = E.mercadoPan(s);
      if (mp.compra) items.push({ id: "comprarPan", t: "Comprar un pedazo de pan", d: mp.compra.ok ? `${mp.compra.precio} blancas · ${TR.ratos} rato` : mp.compra.porque, ok: mp.compra.ok, prev: [`La panadera vende el pedazo a ${mp.compra.precio} blancas.`] });
      if (mp.venta) items.push({ id: "venderPan", t: "Vender un pedazo de pan a la ventera", d: mp.venta.ok ? `${mp.venta.precio} ${mp.venta.precio === 1 ? "blanca" : "blancas"} · ${TR.ratos} rato` : mp.venta.porque, ok: mp.venta.ok, prev: [`La ventera te compra el pedazo a ${mp.venta.precio === 1 ? "una blanca" : mp.venta.precio + " blancas"}.`] });
    }
    if (s.t < E.FIN) { const es = o.acc.find((a) => a.id === "esperar"); items.push({ id: "esperar", t: f + 1 < R.FRANJAS.length ? `Esperar a ${R.FRANJAS[f + 1].nombre.toLowerCase()}` : "Esperar a la noche", d: `${es.coste} ${es.coste === 1 ? "rato" : "ratos"}`, ok: true, prev: ["Esperar: quieto, la ronda no te para; si llega, la verás."] }); }
    const posadaAqui = s.conTretas && TR.posada && TR.posada.en.includes(s.lugar);
    const prevAcabar = [L[s.lugar].dentro ? "Si acabas el día aquí, dormirás en un portal, dentro de la muralla." : s.lugar === "ribera" ? "Si acabas el día aquí, dormirás al raso en la ribera." : `${s.lugar === "puente" ? "En el puente" : "Aquí"} no se puede dormir: si acabas el día aquí, bajarás a la ribera.`];
    if (posadaAqui) prevAcabar.push(`Aquí hay un mesón: si acabas el día aquí, por ${TR.posada.blancas} blancas duermes en el pajar y la ronda de noche no entra.`);
    if (s.conTretas && s.mazo.includes("vergonzante") && !L[s.lugar].dentro) prevAcabar.push("En la ribera te roban la ropa buena: no duermas con ella fuera de la muralla.");
    items.push({ id: "acabar", t: "Acabar el día", d: posadaAqui ? (s.blancas >= TR.posada.blancas ? `aquí hay mesón: ${TR.posada.blancas} blancas, sin ronda de noche` : "en un portal (el mesón cuesta blancas)") : L[s.lugar].dentro ? "en un portal: ronda de noche" : "dormir en la ribera", ok: true, prev: prevAcabar });
    items.push({ id: "mirar", t: "Mirar este sitio", d: "lo que sabes de aquí", ok: true, prev: [E.descLugar(s, s.lugar)] });
    menuAcciones.items = items;
    return `<div class="j-menu" role="menu"><div class="j-menu-tit">${esc(L[s.lugar].nombre)} <span class="small muted">· Esc para cerrar</span></div>
      <div class="j-menu-lista">${items.map((x, i) => `<button class="j-op${x.ok ? "" : " no"}${x.riesgo ? " riesgo" : ""}" data-act="op" data-id="${x.id}" data-i="${i}"${x.ok ? "" : " disabled"}><kbd>${i + 1}</kbd><span class="t">${x.icono || ""}${esc(x.t)}</span><span class="d">${esc(x.d)}</span></button>`).join("")}</div>
      <div class="j-prev" id="prev">${prevHtml(items[0])}</div></div>`;
  }
  const prevHtml = (x) => (x ? `<ul>${x.prev.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : "");
  // lo que sabes de este sitio (al tocar la fachada o «Mirar este sitio»)
  function tarjetaSitio(id) {
    const v = M.verDe(s, id), lin = [];
    if (id === s.lugar && s.t < E.FIN && v) {
      const partes = [TXT_GENTE(v.gente, id)];
      if (v.todosPobres) partes.push("otros pobres pidiendo");
      if (v.trabajo) partes.push("las obras cogen peones");
      if (rondaAqui()) partes.push("la ronda");
      lin.push(`Ahora: ${partes.join(" · ")}.`);
    }
    if (s.conPresion) for (const c of E.cierresActivos(s).filter((x) => x.lugar === id)) lin.push(`${c.tipo === "puerta" ? "El guarda de la puerta" : c.tipo === "estudio" ? "Los alguaciles del Estudio" : "Los diputados de la parroquia"}, a ${R.FRANJAS[c.f].nombre.toLowerCase()}. ${E.llaveTxt(s, c.tipo)}`);
    if (s.conTretas && MESON[id] != null && TR.posada && TR.posada.en.includes(id)) lin.push(linea("meson", id));
    const rec = M.recuerdaDe(s, id);
    return `<div class="j-carta"><div class="v-tit"><h3>${esc(L[id].nombre)}</h3><button class="cerrar" data-act="cerrarSitio" aria-label="Cerrar">×</button></div>
      ${lin.map((x) => `<p>${esc(x)}</p>`).join("")}<p class="small muted">${esc(E.descLugar(s, id))}</p>
      ${rec.length ? `<div class="v-rec"><b>Lo que recuerdas de aquí</b>${rec.map((x) => `<p class="small">${esc(x)}</p>`).join("")}</div>` : ""}</div>`;
  }
  // el resultado de una acción o de una llegada: los textos del motor
  function cartaResultado() {
    const u = s.ultimo || { titulo: "", lineas: [] };
    return `<div class="j-carta res ${u.tono}"><div class="v-tit"><h3>${esc(u.titulo)}</h3></div>${u.lineas.map((x) => `<p>${esc(x)}</p>`).join("")}
      <div class="btns">${btn("seguir", "Seguir", u.tono === "mal" ? "" : "o sigue andando", { cls: "primary", tecla: "Intro" })}</div></div>`;
  }
  // el mapa (M): lo que sabes de la ciudad; eliges destino y camino
  function pintarMapa(marca) {
    const ruta = ui.ruta;
    const fin = ruta[ruta.length - 1];
    const paso = (E.opciones(s).movs[0] || {}).coste || 2; // con las cadenas puestas se anda más despacio
    const ratos = ruta.length * paso;
    const llega = s.t + ratos;
    const sel = ui.mapaSel;
    let lado = `<div class="v-tit"><h3>Mapa</h3><button class="cerrar" data-act="mapa" aria-label="Cerrar">×</button></div>`;
    if (ui.viajando) lado += `<p>De camino…</p>`;
    else if (!ruta.length) lado += `<p class="small">Toca adónde quieres ir. Para ir por otro camino, toca antes un sitio por el que pasar.</p>`;
    else {
      lado += `<p><b>${esc(L[fin].nombre)}</b> · ${ruta.length} ${ruta.length === 1 ? "paso" : "pasos"}, ${ratos} ratos${llega >= E.FIN ? " · <span class=\"ronda-txt\">no llegas antes de la noche</span>" : ` · llegas a ${E.nombreFranja(E.franja(llega)).toLowerCase()}`}.</p>`;
      lado += `<p class="small">Por: ${ruta.map((x) => esc(L[x].corto)).join(" → ")}</p>`;
      lado += `<p class="small muted">Si por el camino te para la ronda o la ves${s.conPresion ? ", o el guarda no te deja pasar" : ""}, te paras allí.</p>`;
      lado += `<div class="btns">${btn("viajar", "Ir", "", { cls: "primary", tecla: "Intro" })}${btn("borrarRuta", "Borrar el camino", "")}</div>`;
    }
    if (sel && !ui.viajando) {
      const v = M.verDe(s, sel), rec = M.recuerdaDe(s, sel), u = M.rondaUltima(s);
      lado += `<div class="v-rec"><b>${esc(L[sel].nombre)}</b>`;
      if (sel === s.lugar) lado += `<p class="small">Estás aquí.</p>`;
      else if (v) lado += `<p class="small">Lo viste ${esc(v.edad)}: ${esc(E.GENTE_TXT[v.gente])}${v.pobres && L[sel].dentro ? ", con otros pobres pidiendo" : ""}${v.trabajo ? " · cogían peones" : ""}.</p>`;
      else lado += `<p class="small">No has estado aquí.</p>`;
      if (u && u.lugar === sel && !(sel === s.lugar && rondaAqui())) lado += `<p class="small">Aquí viste a la ronda por última vez, ${esc(u.edad)}.</p>`;
      const ped = M.pedidoAqui(s, sel);
      if (ped.length) lado += `<p class="small">Hoy te han visto pedir aquí (${esc(ped.join(", "))}).</p>`;
      if (s.conPresion) for (const c of E.cierresActivos(s).filter((x) => x.lugar === sel)) lado += `<p class="small"><span class="ronda-txt">${c.tipo === "puerta" ? "El guarda de la puerta" : c.tipo === "estudio" ? "Los alguaciles del Estudio" : "Los diputados de la parroquia"}</span>, a ${R.FRANJAS[c.f].nombre.toLowerCase()}. ${esc(E.llaveTxt(s, c.tipo))}</p>`;
      if (s.conTretas && MESON[sel] != null && TR.posada && TR.posada.en.includes(sel)) lado += `<p class="small">Hay un mesón: ${TR.posada.blancas} blancas por el pajar.</p>`;
      lado += rec.map((x) => `<p class="small">${esc(x)}</p>`).join("") + `</div>`;
    }
    if (s.conPresion && E.cierresActivos(s).length && !ui.viajando) lado += `<p class="small muted"><span class="ronda-txt">■</span> G guarda · D diputados · E Estudio, con su hora (relleno, si es ahora).</p>`;
    const h = `<div class="j-mapa"><div class="j-mapa-plano">${M.svg(s, { ruta, marca })}</div><div class="j-mapa-lado">${lado}</div></div>`;
    const viejo = capa.querySelector(".j-mapa");
    if (viejo) viejo.outerHTML = h; else capa.insertAdjacentHTML("beforeend", h);
  }
  function tocarMapa(id) {
    if (ui.viajando) return;
    ui.mapaSel = id;
    if (id === s.lugar) ui.ruta = [];
    else if (ui.ruta.includes(id)) ui.ruta = ui.ruta.slice(0, ui.ruta.indexOf(id) + 1);
    else { const desde = ui.ruta.length ? ui.ruta[ui.ruta.length - 1] : s.lugar; const c = M.camino(desde, id); if (c) ui.ruta = ui.ruta.concat(c); }
    cuenta("mapa_toques");
    pintarMapa();
  }
  // la capa de encima de la escena: menú, tarjeta, resultado o mapa
  function pintarCapa() {
    let h = "";
    if (!enDia()) { capa.innerHTML = ""; return; }
    if (s.fase === "resultado") h += cartaResultado();
    else if (ui.sitio) h += tarjetaSitio(ui.sitio);
    else if (ui.menu) h += menuAcciones();
    if (s.aviso && s.aviso !== ui.avisoUlt) { ui.avisoUlt = s.aviso; if (!/^Llegas a /.test(s.aviso.texto)) { ui.aviso = { texto: s.aviso.texto, tono: s.aviso.tono, hasta: performance.now() + 5000 }; setTimeout(() => { if (enDia() && ui.aviso && performance.now() >= ui.aviso.hasta) { ui.aviso = null; pintarCapa(); } }, 5100); } }
    if (ui.aviso && performance.now() < ui.aviso.hasta && s.fase === "dia") h += `<div class="j-aviso ${ui.aviso.tono || ""}">${esc(ui.aviso.texto)}</div>`;
    h += `<div class="j-teclas">←/→ o A/D andar · clic: ir ahí · W/↑ entrar por la puerta del fondo · E hacer · M mapa · R recuerdos${s.conTretas ? " · T tretas" : ""}</div>`;
    capa.innerHTML = h;
    if (ui.mapa) pintarMapa();
  }

  // ================================================================== pantallas de menú (las del juguete)
  const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const ANIOS = (n) => ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"][n] || String(n);
  const PREGON = {
    1553: "En la ribera cuentan que este invierno pregonaron en la plaza una pragmática del rey: al vagabundo sano de más de veinte años ya no lo azotan. La primera vez que lo prenden, a la vergüenza y cuatro años de galeras.",
    "1553h": "En la ribera cuentan que este invierno pregonaron en la plaza una pragmática del rey: al vagabundo sano de más de veinte años ya no lo azotan. La primera vez que lo prenden, a la vergüenza y cuatro años de galeras. Y al ladrón, lo mismo desde el primer hurto. A las mujeres las deja fuera de las galeras, para castigarlas conforme a las leyes: para ellas sigue el verdugo.",
    1557: "El año pasado la cosecha fue mala y el pan está carísimo: en la ciudad la gente da poco desde el primer día. En la ribera cuentan que este invierno se llevaron a galeras a varios mozos.",
  };
  function cabecera() {
    const d = E.dia(s);
    return `<header class="top"><div class="top-in"><div class="top-row"><div class="top-title">Día ${s.dia} de ${R.DIAS}<span>${esc(d.fecha)} · ${s.anio || 1545}</span></div>
      <div class="top-btns">${s.fase === "amanecer" ? `<button class="icon-btn" data-act="recuerdo">Recuerdos</button>` : ""}<button class="icon-btn" data-act="ayuda">?</button><button class="icon-btn" data-act="menu">⋯</button></div></div>
      <div class="v-estado"><span class="st"><small>cuerpo</small>${pips(s.cuerpo, P.cuerpoMax, E.cuerpoMax(s), "cuerpo")}</span><span class="st"><small>pan</small>${pips(s.pan, P.panMax, null, "pan")}</span><span class="st"><small>detenciones</small>${pips(s.detenciones, P.detencionesMax, null, "grillete")}</span>${s.conTretas ? `<span class="st"><small>blancas</small><b>${s.blancas}</b></span>` : ""}</div></div></header>`;
  }
  function pantallaInicio() {
    const nombre = load(LS.nombre, "");
    const enCurso = s && s.fase !== "fin";
    const hist = load(LS.historial, []);
    let h = `<div class="wrap"><h1>Liber Vagatorum</h1>
      <p class="muted">Juego 2D (prototipo con moñigotes) · motor ${esc(R.version)} · ${VERSION_JUEGO}</p>
      <p>Salamanca en escenas. Andas con las flechas o A y D, o haciendo clic; andar no gasta tiempo. Salir a otro sitio, sí: 2 ratos. Con E, lo que puedes hacer; con M, el mapa; con R, lo que recuerdas.</p>
      <p>Al acabar, contesta las preguntas y manda el informe.</p>
      <label class="campo" for="nombre">Tu nombre (para el informe)</label><input type="text" id="nombre" value="${esc(nombre)}" autocomplete="name">
      <div class="btns">
        ${enCurso ? btn("continuar", "Seguir la partida en curso", `${s.conCadena ? `${s.anio} · ` : ""}día ${s.dia}${s.conTretas ? " · con tretas" : ""}${s.conPresion ? " · con presión" : ""}`, { cls: "primary" }) : ""}
        ${load(LS.llaga, false) ? btn("llagaOnOff", "Llaga activada", "Toca para quitarla.", { cls: "activo" }) : btn("llagaOnOff", "Activar llaga", "Fingir.")}
        ${load(LS.cadena, false) ? "" : load(LS.tuyos, false) ? btn("tuyosOnOff", "Con los tuyos", "Toca para quitarlos.", { cls: "activo" }) : btn("tuyosOnOff", "Jugar con los tuyos", "Dos que bajaron contigo.")}
        ${load(LS.cadena, false) ? btn("cadenaOnOff", "Varios veranos", "1545, 1553 y 1557, con los tuyos. Toca para jugar uno solo.", { cls: "activo" }) : btn("cadenaOnOff", "Jugar varios veranos", "1545, 1553 y 1557, con los tuyos.")}
        ${load(LS.hurto, false) ? btn("hurtoOnOff", "Hurtar activado", "Toca para quitarlo.", { cls: "activo" }) : btn("hurtoOnOff", "Activar hurtar", "Coger pan de un puesto, y la justicia.")}
        ${!P.tretas ? "" : load(LS.tretas, false) ? btn("tretasOnOff", "Tretas activadas", "Toca para quitarlas.", { cls: "activo" }) : btn("tretasOnOff", "Activar tretas", "Maneras de pedir que se aprenden, cuestan y se queman, y las blancas. Trae la llaga.")}
        ${!P.presion ? "" : load(LS.presion, false) ? btn("presionOnOff", "Presión activada", "Toca para quitarla.", { cls: "activo" }) : btn("presionOnOff", "Activar presión", P.presion.modo === "cierres" ? "Un guarda en la puerta por la que más sales, diputados donde más te dan y los alguaciles del Estudio. Mejor con las tretas." : "Corchetes donde más quejas hay y en tu puerta. Mejor con las tretas.")}
        ${btn("empezar", "Empezar una partida", "", { cls: enCurso ? "" : "primary" })}
        ${btn("ayuda", "Cómo se juega", "")}
      </div>`;
    if (hist.length) {
      h += `<div class="panel"><h3>Partidas acabadas aquí (juego 2D)</h3><div class="btns">`;
      hist.slice().reverse().forEach((x, i) => { const idx = hist.length - 1 - i; h += `<div><p class="small" style="margin:6px 0 2px">${esc(x.fecha.slice(0, 16).replace("T", " "))} · ${esc(x.final)}</p><div class="fila-btn">${btn("hDescargar", "Descargar informe", "", { cls: "secundario", data: { i: idx } })}${btn("hCopiar", "Copiar", "", { cls: "secundario", data: { i: idx } })}</div></div>`; });
      h += `</div></div>`;
    }
    return h + `</div>`;
  }
  function introVerano() {
    const q = s.quien || {}, el = q.el !== false;
    const antesV = R.VERANOS[s.verano - 1];
    const p = [`Junio de ${s.anio}. Han pasado ${ANIOS(s.anio - antesV.anio)} años. Otra vez se ha acabado el pan en La Armuña antes de la siega, y otra vez bajas a Salamanca. Duermes en la ribera, fuera de la muralla.`];
    if (q.antes && q.desde === antesV.anio) {
      const lo = q.antesEl ? "lo" : "la";
      const aQ = q.antes.startsWith("el ") ? "Al " + q.antes.slice(3) : "A " + q.antes;
      const que = { galeras: `${aQ} se ${lo} llevaron a galeras`, desterrado: `${aQ} ${lo} desterraron de la ciudad` }[q.antesFin] || `${mayus(q.antes)} murió`;
      p.push(`Eres ${q.nombre}. ${que} en junio de ${antesV.anio}.`);
    }
    const vivos = E.tuyosVivos(s).map((t) => t.nombre);
    p.push(vivos.length ? `Contigo ${vivos.length > 1 ? "bajan" : "baja"} ${vivos.join(" y ")}.` : `Bajas ${el ? "solo" : "sola"}.`);
    const pregon = (s.conHurto && PREGON[s.anio + "h"]) || PREGON[s.anio];
    if (pregon) p.push(pregon);
    if (s.conTretas && (s.pregonInvierno || []).length) p.push(`Y cuentan que en la plaza se pregonó que se prenda a los que piden ${s.pregonInvierno.map((id) => E.TT[id].pregon).join(", a los que piden ")}.`);
    return p.map((x) => `<p>${esc(x)}</p>`).join("") + `<p><b>Aguanta diez días.</b> El 11 de junio empieza la siega${el ? ", y en la siega hay trabajo para quien pueda con la hoz" : ", y en la siega se puede espigar detrás de los segadores"}.</p>`;
  }
  const TIT = (tipo) => ({ siega: "Te cogen para la siega", aguanta: "Aguantas, pero no te cogen", espiga: "Espigas en la siega", hambre: "Mueres de hambre", muerto: "Mueres",
    desterrado: s && E.esHombre(s) ? "Desterrado" : "Desterrada", galeras: "A galeras", ahorcado: "La horca", abandona: "Partida abandonada" }[tipo] || "Fin");
  function panelNoche(mal) {
    if (!s.noche) return "";
    return `<div class="panel${mal || s.noche.detenido ? " res mal" : ""}"><h3>La noche</h3>${s.noche.lineas.map((x) => `<p>${esc(x)}</p>`).join("")}<p>Cuerpo: ${s.noche.antes} → <b>${s.noche.despues}</b>.</p></div>`;
  }
  function pantallaRelevo() {
    const r = s.relevo;
    let h = cabecera() + `<div class="wrap"><h2>Noche del día ${s.dia}</h2>` + panelNoche(true) + `<div class="panel res mal"><h2>${esc(TIT(r.tipo))}</h2><p>${esc(r.texto)}</p></div>`;
    if (P.cadena && P.cadena.relevo === "juega" && s.dia < R.DIAS) h += `<p>Lo que queda de verano lo juegas con quien elijas, desde mañana: con su cuerpo, su pan y sus detenciones.</p>`;
    h += `<div class="btns">`;
    for (const id of r.candidatos) { const tu = s.tuyos.find((t) => t.id === id); h += btn("heredero", `Seguir como ${tu.nombre}`, `cuerpo ${tu.cuerpo}/${P.cuerpoMax} · ${tu.pan} ${tu.pan === 1 ? "pedazo" : "pedazos"} · detenciones ${tu.detenciones}/${P.detencionesMax}`, { cls: r.candidatos.length > 1 ? "" : "primary", data: { id } }); }
    return h + `</div></div>`;
  }
  function pantallaInvierno() {
    const iv = s.invierno, el = E.esHombre(s);
    let h = cabecera() + `<div class="wrap"><h2>La siega de ${iv.anio}</h2>`;
    if (!iv.relevo) h += panelNoche(false);
    h += `<div class="panel">${iv.lineas.map((x) => `<p>${esc(x)}</p>`).join("")}</div>`;
    const como = { hoz: "Con el jornal de la siega pasas el invierno: llegarás a junio con fuerzas y con algo de pan guardado.", espiga: "Con lo que espigaste vas tirando el invierno: llegarás a junio con un poco de pan.", nada: `Sin siega, el invierno se hace largo: llegarás a junio ${el ? "flaco" : "flaca"} y sin pan.` }[s.siega.yo];
    h += `<div class="panel"><p>Después de la siega ${E.tuyosVivos(s).length ? "volvéis" : "vuelves"} a La Armuña. ${esc(como)}</p><p>Pasan ${ANIOS(iv.siguiente - iv.anio)} años.</p></div>`;
    return h + `<div class="btns">${btn("siguienteVerano", `Bajar a Salamanca en junio de ${iv.siguiente}`, "", { cls: "primary" })}</div></div>`;
  }
  // dónde va la ronda el día del Corpus, franja a franja (lo del aviso del juguete, rama claude/tretas)
  function rondaCorpus() {
    const c = R.RONDA.circuitoCorpus || [], fr = (f) => R.FRANJAS[f].nombre.toLowerCase(), partes = [];
    for (let f = 0; f < c.length - 1; f++) {
      if (!c[f]) continue;
      let g = f; while (g + 1 < c.length - 1 && c[g + 1] === c[f]) g++;
      const fs = []; for (let k = f; k <= g; k++) fs.push(fr(k));
      const n = L[c[f]].nombre, art = /^(Plaza|Rúa|Catedral|Puerta|Iglesia|Calle)/.test(n) ? "la " : /^Escuelas/.test(n) ? "las " : "";
      partes.push(`a ${fs.length > 1 ? fs.slice(0, -1).join(", a ") + " y a " + fs[fs.length - 1] : fs[0]}, en ${art}${n}`);
      f = g;
    }
    return partes.join("; ") + "; al anochecer, a cerrar su puerta";
  }
  function pantallaAmanecer() {
    const d = E.dia(s);
    let h = cabecera() + `<div class="wrap"><h2>${esc(d.fecha[0].toUpperCase() + d.fecha.slice(1))}</h2>`;
    if (s.dia === 1 && !s.noche && !s.verano) {
      h += `<p>Eres un mozo de La Armuña. Has bajado a Salamanca porque en tu aldea no queda pan hasta la siega. Duermes en la ribera del Tormes, fuera de la muralla.</p>
        ${s.conTuyos ? `<p>No has bajado solo: contigo vinieron Pedro y Catalina, de tu misma aldea. Duermen en la ribera, como tú.</p>` : ""}
        <p>Desde la orden de pobres del año pasado, en la ciudad está prohibido pedir. Pero el pan está dentro, y no hay otra manera de comer.</p>
        <p><b>Aguanta diez días.</b> El 11 de junio empieza la siega, y en la siega hay trabajo para quien pueda con la hoz.</p>`;
    } else if (s.dia === 1 && !s.noche) h += introVerano();
    if (s.noche) h += `<div class="panel${s.noche.detenido ? " res mal" : ""}"><h3>${s.noche.detenido ? (E.esHombre(s) ? "La noche: detenido" : "La noche: detenida") : "La noche"}</h3>${s.noche.lineas.map((x) => `<p>${esc(x)}</p>`).join("")}<p>Cuerpo: ${s.noche.antes} → <b>${s.noche.despues}</b>.</p></div>`;
    const notas = [];
    const rh = s.relevoHoy;
    if (rh && rh.dia === s.dia && rh.anio === s.anio) { const aQ = rh.antes.startsWith("el ") ? "Al " + rh.antes.slice(3) : "A " + rh.antes; notas.push(`Desde hoy eres ${rh.nombre}. ${rh.tipo === "galeras" ? `${aQ} se lo llevaron a galeras` : rh.tipo === "desterrado" ? `${aQ} ${rh.antesEl ? "lo" : "la"} echaron de la ciudad` : `${mayus(rh.antes)} murió anoche`}; lo que queda de verano es tuyo.`); }
    if (d.tipo === "domingo") notas.push(`Es domingo${d.fiesta && d.fiesta !== "Domingo" ? " de " + d.fiesta : ""}: no hay obra. Las iglesias se llenan a prima y a tercia; la plaza está tranquila.`);
    if (d.tipo === "corpus") notas.push(R.RONDA.circuitoCorpus ? `Es Corpus Christi: hay procesión y la ronda va con ella todo el día: ${rondaCorpus()}. No hay obra.` : "Es Corpus Christi: procesión por la Rúa y la plaza a tercia y a sexta, y la ronda va con ella. No hay obra.");
    if (E.mercado(s)) notas.push("Es jueves, día de mercado: la plaza está llena de puestos hasta nona.");
    if (s.dia === E.escasezDesde(s) && s.dia > 1) notas.push("El pan ha subido en la plaza. Desde hoy, la gente da menos.");
    if (s.conTretas) for (const x of (s.pregon || []).filter((p2) => p2.anio === s.anio && p2.dia === s.dia - 1)) notas.push(`Al amanecer pregonan en la plaza: la orden manda prender a los que piden ${E.TT[x.id].pregon}.`);
    if (s.conTretas && s.cita && s.cita.dia === s.dia) notas.push(`Quedaste con ${(s.tuyos.find((x) => x.id === s.cita.id) || {}).nombre} ${E.citaTxt(s.cita)}.`);
    if (s.conPresion && s.presion.hoy) {
      const fr = (f) => R.FRANJAS[f].nombre.toLowerCase();
      for (const c of (s.presion.hoy.nuevos || []).filter((x) => !x.tipo)) notas.push(`Por la ciudad se dice que el corregidor ha puesto un corchete en ${L[c.lugar].nombre}, a ${fr(c.f)}: allí se quejaban mucho de los pobres.`);
      const QUIEN = { puerta: (c) => `un guarda en ${L[c.lugar].nombre}, a ${fr(c.f)}: no deja pasar a los pobres, ni entrar ni salir`, parroquia: (c) => `a los diputados de la parroquia en ${L[c.lugar].nombre}, a ${fr(c.f)}: andan escribiendo pobres y piden la cédula`, estudio: (c) => `a los alguaciles del Estudio en ${L[c.lugar].nombre}, a ${fr(c.f)}: echan a los que piden sin ser estudiantes` };
      for (const c of s.presion.hoy.nuevos || []) if (c.tipo) notas.push(`Por la ciudad se dice que el corregidor ha puesto ${QUIEN[c.tipo](c)}. ${E.llaveTxt(s, c.tipo)}`);
      for (const { c, antes } of s.presion.hoy.mueve || []) notas.push(c.tipo === "estudio" ? `Los alguaciles del Estudio ya no andan por ${L[antes.lugar].nombre} a ${fr(antes.f)}: desde hoy, a ${fr(c.f)}.` : c.tipo === "puerta" ? `El guarda ya no está en ${L[antes.lugar].nombre} a ${fr(antes.f)}: desde hoy está en ${L[c.lugar].nombre}, a ${fr(c.f)}. «Por ahí salen los pordioseros», le han dicho.` : `Los diputados ya no andan por ${L[antes.lugar].nombre} a ${fr(antes.f)}: desde hoy, por ${L[c.lugar].nombre}, a ${fr(c.f)}. «Ahí es donde les dan», les han dicho.`);
      const pu = s.presion.hoy.puerta, q = s.presion.hoy.quita;
      if (pu) notas.push(`${q ? `Han quitado el corchete de ${L[q.lugar].nombre}. ` : ""}Desde hoy vigila un corchete en ${L[pu.lugar].nombre} a ${fr(pu.f)}: «Ese mozo pasa por aquí todos los días», le han dicho.`);
    }
    if (s.yaNoBuscan) notas.push("Han pasado tres días de aquello. En la plaza ya han dado otras señas: por las tuyas no pregunta nadie.");
    if (s.lugar === "puerta" && s.cronica.some((c) => c.dia === s.dia - 1 && c.anio === s.anio && c.tipo === "prendido")) notas.push("Después, te sueltan en la Puerta del Río.");
    else if (s.lugar === "puerta" && s.cronica.some((c) => c.dia === s.dia - 1 && c.anio === s.anio && c.tipo === "detenido")) notas.push("Te sueltan al amanecer en la Puerta del Río.");
    else if ((s.porDia[s.porDia.length - 1] || {}).duerme === "posada") notas.push("El mesonero te echó antes del alba por la Puerta del Río. Esperas en el puente a que abran.");
    else if (L[s.lugar].dentro) notas.push(`Te despiertas en un portal de ${L[s.lugar].nombre}.`);
    else notas.push("Te despiertas en la ribera.");
    h += `<div class="panel">${notas.map((x) => `<p>${esc(x)}</p>`).join("")}</div>`;
    return h + `<div class="btns">${btn("empezarDia", "Empezar el día", "", { cls: "primary", tecla: "Intro" })}</div></div>`;
  }
  function pantallaNoche() {
    let h = cabecera() + `<div class="wrap"><h2>Noche del día ${s.dia}</h2>`;
    if (s.duerme === "carcel") return h + `<div class="panel res mal"><p>Duermes en la cárcel. El pan${s.conTretas ? " y las blancas" : ""} te lo han quitado.</p></div><div class="btns">${btn("cenar", "Seguir", "", { cls: "primary", data: { n: 0 } })}</div></div>`;
    const donde = s.duerme === "posada" ? `Duermes en el pajar del mesón, en ${L[s.lugar].nombre}. La ronda de noche no entra en las posadas.` : s.duerme === "portal" ? `Duermes en un portal de ${L[s.lugar].nombre}, dentro de la muralla.` : `${s.bajaRibera ? (s.bajaDe === "puente" ? "En el puente no se puede dormir: toda la noche pasan carros y el portazguero echa a los que se tumban. Bajas a la ribera. " : "En la orilla no hay donde echarse. Bajas a la ribera. ") : ""}Duermes al raso en la ribera, fuera de la muralla.`;
    const fiebre = s.llaga && s.llaga === s.dia;
    h += `<div class="panel"><p>${esc(donde)}</p><p>Tienes <b>${s.pan}</b> ${s.pan === 1 ? "pedazo" : "pedazos"} de pan. Una ración son 2 pedazos. Puedes guardar hasta ${P.panMax}.</p>${s.trabajoHoy ? `<p>Estás molido del trabajo: −${P.trabajo.cansancio} de cuerpo esta noche.</p>` : ""}</div>`;
    if (E.puedeLlaga(s)) {
      const viejo = s.viejo === 1 ? "Junto al fuego, un viejo se descubre la pierna: una llaga abierta, en carne viva. «Esta me da de comer. Ranúnculo y sal, un trapo sucio encima, y no dejarla cerrar nunca.»" : "El viejo de la llaga duerme a tu lado, con la pierna al aire.";
      h += `<div class="panel"><p>${esc(viejo)}</p></div><div class="btns">${btn("llaga", "Hacerte una llaga como la suya", "no la dejarás cerrar")}</div>`;
    } else if (fiebre) h += `<div class="panel res mal"><p>Te frotas la pierna con ranúnculo y sal hasta que se abre la carne. Arde. El viejo te ata un trapo encima.</p><p>Esta noche, fiebre: −${-P.llaga.cuerpo} de cuerpo.</p></div>`;
    // las tretas: el mesón, te roban la ropa buena, alguien te ofrece una, quedas con uno de los tuyos para el muerto
    if (s.conTretas) {
      if (s.mesonCerrado) h += `<div class="panel res mal"><p>El mesonero no te abre: «Te dije que no volvieras. Ya he dado parte de ti al alguacil». Duermes en un portal.</p></div>`;
      if (E.puedePosada(s)) h += `<div class="panel"><p>El mesonero te mira de arriba abajo: «${TR.posada.blancas} blancas por el pajar. Aquí la ronda no entra»</p></div><div class="btns">${btn("posada", "Pagar la posada", `${TR.posada.blancas} blancas · te quedan ${s.blancas - TR.posada.blancas}`)}</div>`;
      if (s.robada) h += `<div class="panel res mal"><p>${esc(s.robada)}</p></div>`;
      const of = E.ofertaTxt(s);
      if (of) {
        h += `<div class="panel"><p>${esc(of.dice)}</p></div><div class="btns">`;
        const precio = of.pan || of.blancas ? `paga ${[of.pan ? (of.pan === 1 ? "un pedazo" : of.pan + " pedazos") : "", of.blancas ? of.blancas + " blancas" : ""].filter(Boolean).join(" y ")}` : "gratis";
        if (!of.ok) h += btn("aprender", `Aprender ${of.nombre}`, `${precio}: no te llega`, { disabled: true });
        else if (!of.lleno) h += btn("aprender", `Aprender ${of.nombre}`, precio);
        else for (const id of s.mazo) h += btn("aprender", `Aprender ${of.nombre} y dejar ${E.TT[id].nombre}`, `${precio} · llevas ya ${TR.mazo}`, { data: { o: id } });
        h += `</div>`;
      }
      for (const c of E.citasPosibles(s)) {
        if (s.cita && s.cita.dia === s.dia + 1 && s.cita.id === c.id) { h += `<div class="panel"><p class="small">Has quedado con ${esc(c.nombre)} mañana ${esc(E.citaTxt(s.cita))}, para el muerto.</p></div>`; continue; }
        h += `<div class="btns">${c.lugares.map((l) => btn("quedar", `Quedar con ${c.nombre}: mañana, el muerto en ${L[l].nombre}`, `a ${R.FRANJAS[c.f].nombre.toLowerCase()}`, { data: { id: c.id, l } })).join("")}</div>`;
      }
    }
    for (const x of s.nocheTuyos || []) {
      if (x.lineas.length || x.dado) h += `<div class="panel">${x.lineas.map((l) => `<p>${esc(l)}</p>`).join("")}${x.dado ? `<p class="small">Le has dado ${x.dado === 1 ? "un pedazo" : x.dado + " pedazos"}.</p>` : ""}</div>`;
      const falta = x.presente ? x.pide - x.dado : 0;
      if (falta > 0 && s.pan > 0) h += `<div class="btns">${btn("dar", `Darle un pedazo a ${x.nombre}`, "", { data: { id: x.id, n: 1 } })}${falta >= 2 && s.pan >= 2 ? btn("dar", `Darle dos pedazos a ${x.nombre}`, "una ración entera", { data: { id: x.id, n: 2 } }) : ""}</div>`;
    }
    h += `<div class="btns">`;
    const fx = (n) => { const v = P.cena[n] - (s.trabajoHoy ? P.trabajo.cansancio : 0) + (fiebre ? P.llaga.cuerpo : 0); return `${v >= 0 ? "+" : "−"}${Math.abs(v)} de cuerpo`; };
    if (s.pan >= 2) h += btn("cenar", "Cenar una ración entera", `2 pedazos · ${fx(2)}`, { cls: "primary", data: { n: 2 } });
    if (s.pan >= 1) h += btn("cenar", "Cenar media ración", `1 pedazo · ${fx(1)}${s.pan > 1 ? " · guardas el resto" : ""}`, { data: { n: 1 } });
    h += btn("cenar", s.pan ? "No cenar" : "Acostarte sin cenar", `${fx(0)}${s.pan ? " · guardas el pan" : ""}`, { data: { n: 0 } });
    return h + `</div></div>`;
  }
  function pantallaFin() {
    const T = E.resumenDias(s);
    const ratos = T.mover + T.pedir + T.trabajar + T.esperar + T.perdido + T.hurtar || 1;
    const pct = (x) => Math.round((100 * x) / ratos) + " %";
    const enc = s.encuesta || {};
    let h = cabecera() + `<div class="wrap">`;
    const fc = s.final.cadena;
    if (fc) {
      const tit = fc.hasta > fc.desde ? `Tu gente aguantó de ${fc.desde} a ${fc.hasta}` : `Tu gente no pasó de ${fc.desde}`;
      h += `<div class="panel res ${fc.hasta > fc.desde ? "bien" : "mal"}"><h2>${esc(tit)}</h2><p>${esc(s.final.texto)}</p></div><div class="panel"><h3>Tu gente</h3>${E.resumenCadena(s).map((x) => `<p class="small">${esc(x)}</p>`).join("")}</div>`;
    } else h += `<div class="panel res ${s.final.tipo === "siega" ? "bien" : "mal"}"><h2>${esc(TIT(s.final.tipo))}</h2><p>${esc(s.final.texto)}</p><p class="small">Día ${s.final.dia}</p></div>`;
    h += `<div class="panel"><h3>Tu partida</h3><p class="small">Tiempo: moverte ${pct(T.mover)} · pedir ${pct(T.pedir)} · trabajar ${pct(T.trabajar)}${s.conHurto ? ` · hurtar ${pct(T.hurtar)}` : ""} · esperar ${pct(T.esperar + T.perdido)}.</p>
      <p class="small">${T.pasos} pasos · pediste ${T.pedidas} veces (${T.panPedido} pedazos) · llegaste ${T.encuentros} ${T.encuentros === 1 ? "vez" : "veces"} donde estaba la ronda · ${s.detenciones} ${s.detenciones === 1 ? "detención" : "detenciones"}.</p>${s.conTretas ? `<p class="small">Tretas: ${Object.entries(s.tretasLog || {}).map(([id, x]) => `${E.TT[id].nombre}, ${x.usos || 0} ${x.usos === 1 ? "vez" : "veces"}`).join(" · ") || "no usaste ninguna"}.</p>` : ""}</div>`;
    h += `<div class="panel"><h3>Unas preguntas</h3><p class="small muted">Van en el informe. Contesta con lo que te salga.</p>
      <label class="campo" for="e_plano">¿Qué no supiste leer en las escenas o en el mapa? ¿Andar por las escenas era mirar o un trámite?</label><textarea id="e_plano" data-enc="plano">${esc(enc.plano)}</textarea>
      <label class="campo" for="e_dolio">¿Qué decisión te dolió o te costó tomar?</label><textarea id="e_dolio" data-enc="dolio">${esc(enc.dolio)}</textarea>
      <label class="campo" for="e_ir">¿Cómo decidías adónde ir?</label><textarea id="e_ir" data-enc="ir">${esc(enc.ir)}</textarea>
      <label class="campo" for="e_sorpresa">Si la ronda te sorprendió alguna vez, ¿lo sentiste como una mala decisión tuya o como mala suerte?</label><textarea id="e_sorpresa" data-enc="sorpresa">${esc(enc.sorpresa)}</textarea>
      <label class="campo" for="e_sobro">¿Qué sobraba, estorbaba o no entendiste?</label><textarea id="e_sobro" data-enc="sobro">${esc(enc.sobro)}</textarea>
      ${s.conCadena ? `<label class="campo" for="e_cadena">¿Pesó en lo que hacías saber que, si morías con uno de los tuyos al lado, seguirías como él o ella?</label><textarea id="e_cadena" data-enc="cadena">${esc(enc.cadena)}</textarea>` : ""}
      ${s.conHurto ? `<label class="campo" for="e_hurto">¿Cuándo decidiste hurtar, o no hacerlo, y por qué?</label><textarea id="e_hurto" data-enc="hurto">${esc(enc.hurto)}</textarea>` : ""}
      ${s.conTretas ? `<label class="campo" for="e_tretas">¿Qué tretas usaste, por qué esas y cuáles dejaste? ¿Alguna te pareció que siempre convenía?</label><textarea id="e_tretas" data-enc="tretas">${esc(enc.tretas)}</textarea>` : ""}
      <label class="campo" for="e_otros">Otros comentarios (opcional)</label><textarea id="e_otros" data-enc="otros">${esc(enc.otros)}</textarea>
      <div class="btns" style="margin-top:12px">${btn("correo", "Abrir el correo con el resumen", `Para: ${R.CONFIG.email}. Adjunta el informe descargado.`, { cls: "primary" })}<div class="fila-btn">${btn("descargar", "Descargar", "", { cls: "secundario" })}${btn("copiar", "Copiar", "", { cls: "secundario" })}</div></div></div>`;
    return h + `<div class="btns">${btn("nueva", "Volver al inicio", "")}</div></div>`;
  }
  function ayudaHtml() {
    const conCadena = s && ui.pantalla === "juego" ? !!s.conCadena : load(LS.cadena, false);
    const conHurto = s && ui.pantalla === "juego" ? !!s.conHurto : load(LS.hurto, false);
    const conTretas = s && ui.pantalla === "juego" ? !!s.conTretas : !!P.tretas && load(LS.tretas, false);
    const conPresion = s && ui.pantalla === "juego" ? !!s.conPresion : !!P.presion && load(LS.presion, false);
    const anio = s && ui.pantalla === "juego" && s.anio ? s.anio : 1545;
    const desde = s && ui.pantalla === "juego" ? E.escasezDesde(s) : P.escasezDesde;
    return `<div class="modal-in"><h2>Cómo se juega</h2>
      <p>Eres ${s && ui.pantalla === "juego" && !E.esHombre(s) ? "una pobre" : "un pobre"} de La Armuña, en la Tierra de Salamanca, y has bajado a la ciudad en junio de ${anio}. Desde la orden de pobres ${anio === 1545 ? "del año pasado" : "de 1544"}, pedir en la ciudad está prohibido. Duermes fuera de la muralla, en la ribera; el pan está dentro. <b>Objetivo: aguantar diez días, hasta la siega.</b></p>
      <h3>Los mandos</h3><ul class="small">
        <li><kbd>←</kbd> <kbd>→</kbd> o <kbd>A</kbd> <kbd>D</kbd>: andar. Clic en el suelo: ir ahí. Andar dentro de un sitio no gasta tiempo.</li>
        <li>Las salidas están en los extremos (sales al llegar al borde) o en una puerta al fondo (<kbd>W</kbd> o <kbd>↑</kbd> delante de ella). Salir al sitio de al lado cuesta 2 ratos.</li>
        <li><kbd>E</kbd> o clic en ti: lo que puedes hacer aquí, con lo que sabes antes de hacerlo al pasar el ratón.</li>
        <li><kbd>M</kbd>: el mapa. Tocas adónde ir (y, si quieres, antes un sitio por el que pasar) y vas de una vez: los mismos pasos y ratos, pero si por el camino te para la ronda o la ves, te paras allí.</li>
        <li><kbd>R</kbd>: lo que recuerdas. Al acercarte a alguien o tocarlo, te dice lo que hay; al tocar las casas, lo que sabes del sitio.</li>
        ${conTretas ? `<li><kbd>T</kbd>: tus tretas. Pedir con ellas, comprar y ponerte o quitarte el atrezo, en el menú de <kbd>E</kbd>; aprenderlas, de noche.</li>` : ""}</ul>
      <h3>Quién es quién</h3><ul class="small">
        <li><b>Tú</b>, de rojo, con el hatillo al hombro.</li>
        <li><b>La ronda</b>: el alguacil, de negro, con sombrero de ala y la vara, y dos corchetes con casco y pica. Lleva un «!» encima.</li>
        <li><b>Quien avisa enseguida</b>, con un ojo encima: el portero de la Puerta del Río, el bedel de las Escuelas, el cura de San Martín.</li>
        <li><b>Los otros pobres</b>, sentados en el suelo con el cuenco. <b>Pedro</b> y <b>Catalina</b>, con su nombre encima.</li>
        <li><b>Un vecino asomado</b> a la ventana: alguien se ha quejado. Con el marco rojo y el puño en alto, te vieron pedir ahí hoy.</li>
        <li><b>El capataz</b>, junto al andamio de la catedral, cuando las obras cogen peones. <b>Los puestos</b> de la plaza, a sus horas.</li>
        ${conTretas ? `<li><b>Los que venden</b>, cada uno con lo suyo en la mano y a sus horas: el estudiante pobre de las Escuelas (cartas y manteos), el buhonero de la plaza (coplas), el mozo de Argel de la Puerta del Río (cadenas) y el ropavejero de la Rúa (ropa buena). <b>La panadera</b> de la plaza y la Rúa vende pan; la <b>ventera</b> de la Puerta del Río lo compra. El <b>mesón</b>, con su tablero y su ramo, en la Rúa y en la plaza.</li>` : ""}
        ${conPresion ? `<li><b>El guarda</b> de la puerta, con alabarda y gorro rojo, a su hora. <b>Los diputados de la parroquia</b>, de golilla, con el libro donde escriben pobres. <b>Los alguaciles del Estudio</b>, de azul, con bonete y vara. En el mapa, G, D y E con su hora.</li>` : ""}</ul>
      <h3>El día</h3><p>Seis franjas, de prima a completas, de seis ratos cada una (las campanas de arriba). Pedir ocupa una franja entera. Al acabar completas cierran las puertas de la muralla: quien se queda dentro duerme en un portal.</p>
      <h3>Pedir</h3><p>Solo dentro de la muralla y donde hay gente que dé. Con mucha gente suele caer algo; con poca, muchas veces nada; si hay otros pobres pidiendo, os repartís lo que hay. ${desde <= 1 ? "Este verano el pan está caro desde el primer día y la gente da menos." : `Desde el día ${desde}, el pan sube y la gente da menos.`} Quien te ve pedir puede avisar a la ronda, y la ronda suele ir luego allí.</p>
      <h3>La ronda</h3><p>Tiene sus costumbres, que no son las mismas cada verano; a veces se desvía, acude adonde le avisan y a sexta se va a comer. Si te ve pedir, te detiene (con mucha gente, a veces no te ve). Si llegas a donde está, puede pararte: la primera vez te echa de la ciudad y te queda fichado; si ya te tiene fichado, te detiene. Quieto no te para.</p>
      <h3>Detenciones</h3><p>Noche en la cárcel y te quitan el pan. La segunda vez, además, azotes. La tercera, destierro.</p>
      <h3>La noche</h3><p>Una ración son 2 pedazos de pan. Ración entera: +1 de cuerpo. Media: −1. Nada: −2. Si el cuerpo llega a 0, mueres.</p>
      ${conCadena ? `<h3>Varios veranos</h3><p>Después de 1545 vienen 1553 y 1557. Si mueres y uno de los tuyos ha dormido a tu lado, sigues como él o ella${P.cadena && P.cadena.relevo === "juega" ? ": lo que queda de verano, desde el día siguiente" : " el verano siguiente"}. Si te destierran, sigue uno de los tuyos. Si mueres solo, se acaba.</p>` : ""}
      ${conHurto ? `<h3>Hurtar</h3><p>En la Plaza y en la Rúa, cuando hay puestos, puedes coger una hogaza: ${HU.gana} pedazos en ${HU.ratos} ratos. Te ve el dueño o el vecino; si te ven, te prenden o te buscan ${HU.buscaDias} días.</p>` : ""}
      ${conTretas ? `<h3>Las tretas</h3><p>Maneras de pedir que se aprenden de otros pobres (de noche, en la ribera, siempre hay alguien que enseña una) o se compran de día, en su sitio. Cada una tiene sus sitios, sus horas y su precio, en pan o en blancas; lo que da y lo que arriesga te lo dice quien te la enseña o te la vende. Llevas ${TR.mazo} como mucho: para otra, tienes que dejar una.</p>
      <p>Las blancas se guardan de un día para otro, pero si la ronda te para con muchas encima, te las quita, y si te detienen, también. El pan se compra en la Plaza y en la Rúa y se vende a la ventera de la Puerta del Río, pero no al mismo precio.</p>
      <p>Las tretas se gastan: cada vez que pides con una donde alguien avisa, la queja lleva tu descripción. Cuando la autoridad ya la conoce, la pregona: desde entonces no te dan más que pidiendo sin más, y el alguacil que te para con ella te detiene. Lo pregonado vale para toda tu gente.</p>` : ""}
      ${conTretas && TR.posada ? `<p>En la Rúa y en la Plaza hay mesones: si acabas el día allí, por ${TR.posada.blancas} blancas duermes en el pajar y la ronda de noche no entra. Antes del alba te echan por la Puerta del Río. Los mesoneros no quieren pobres fijos: lo que te dicen, escúchalo.</p>` : ""}
      ${conPresion ? (P.presion.modo === "cierres" ? `<h3>La ciudad se endurece</h3><p>A los pocos días de empezar el verano, el corregidor pone un guarda en una puerta de la muralla, a una hora, que no deja pasar a los pobres, los diputados de la parroquia salen a escribir pobres a una calle, a una hora, y piden la cédula, y los alguaciles del Estudio echan de las Escuelas a los que piden sin ser estudiantes: sin cédula o sin manteo, te echan. No se quedan quietos: van adonde más te ven pasar y adonde más te dan. Cada uno tiene su llave, y se dice al ponerlo: al guarda no le importa quien lleva ropa buena; a los diputados les basta una carta con sello; al Estudio, un manteo de estudiante. Si la usas mucho, te la conocen y te la quitan. Se sabe al amanecer; en el mapa se ven todo el día, con su hora, y en la escena, a su hora.</p>` : `<h3>La ciudad se endurece</h3><p>Durante el verano, el corregidor pone corchetes donde más se quejan de los pobres (de ti, de los tuyos y de los demás) y en la puerta por la que más pasas. Cada corchete vigila un sitio a una hora todos los días: si pides delante te ve, y si llegas te puede parar, como la ronda. De noche no vigilan. Se sabe al amanecer.</p>`) : ""}
      <h3>Licencias históricas</h3><ul class="small">${(conTretas ? R.LICENCIAS.filter((x) => !x.startsWith("La limosna se da en pan")).concat(R.LICENCIAS_TRETAS || []) : R.LICENCIAS).concat(conPresion ? R.LICENCIAS_PRESION || [] : [], conHurto ? R.LICENCIAS_HURTO.filter((x) => conCadena || !x.startsWith("Desde la pragmática de 1552")) : [], conCadena ? R.LICENCIAS_CADENA : []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="small muted">Las escenas y el mapa son dibujos de la Salamanca de entonces, más o menos, sin escala.</p>
      <div class="btns">${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div></div>`;
  }
  function recuerdoHtml() {
    const corto = (d) => E.dia(s, d).fecha.split(" de ")[0];
    const vistas = s.vistas || [];
    let h = `<div class="modal-in"><h2>Lo que recuerdas</h2><p class="small muted">No lo llevas escrito: es lo que has visto con tus ojos. (R o Esc para cerrar)</p><h3>Dónde has visto a la ronda</h3>`;
    if (!vistas.length) h += `<p>Todavía no la has visto.</p>`;
    else {
      h += `<ul class="ciudad">`;
      R.FRANJAS.forEach((fr, f) => { const pl = {}; vistas.filter((v) => v.f === f).forEach((v) => (pl[v.lugar] = pl[v.lugar] || []).push(v.dia)); const it = Object.entries(pl).sort((a, b) => b[1].length - a[1].length).map(([l, ds]) => `<b>${esc(L[l].corto)}</b> (${ds.map(corto).join(", ")})`); h += `<li><b>${fr.nombre}:</b> ${it.length ? it.join(" · ") : `<span class="muted">no la has visto</span>`}</li>`; });
      h += `</ul>`;
    }
    const pedidas = s.cronica.filter((c) => (c.tipo === "pedir" || c.tipo === "pillado" || c.tipo === "treta") && c.anio === s.anio);
    if (pedidas.length) {
      h += `<h3>Dónde has pedido</h3><ul class="ciudad">`;
      R.FRANJAS.forEach((fr, f) => { const pl = {}; pedidas.filter((c) => E.franja(c.t) === f).forEach((c) => { const d = (pl[c.lugar] = pl[c.lugar] || []); if (!d.includes(c.dia)) d.push(c.dia); }); const it = Object.entries(pl).map(([l, ds]) => `<b>${esc(L[l].corto)}</b> (${ds.map(corto).join(", ")})`); if (it.length) h += `<li><b>${fr.nombre}:</b> ${it.join(" · ")}</li>`; });
      h += `</ul>`;
    }
    if (s.conTuyos) {
      const contado = (s.contado || []).filter((x) => x.ronda);
      h += `<h3>Lo que te han contado</h3>`;
      if (!contado.length) h += `<p>Todavía nadie te ha dicho dónde estaba la ronda.</p>`;
      else { h += `<ul class="ciudad">`; R.FRANJAS.forEach((fr, f) => { const it = contado.filter((x) => x.f === f).map((x) => `<b>${esc(L[x.lugar].corto)}</b> (${esc(x.quien)}, ${corto(x.dia)}${x.oidas ? ", de oídas" : ""})`); if (it.length) h += `<li><b>${fr.nombre}:</b> ${it.join(" · ")}</li>`; }); h += `</ul>`; }
    }
    if (s.conPresion) {
      if (s.presion.cierres) { const cs = s.presion.cierres.filter((c) => s.dia >= c.desde); h += `<h3>El guarda, los diputados y el Estudio</h3>${cs.length ? `<ul class="ciudad">${cs.map((c) => `<li><b>${c.tipo === "puerta" ? "El guarda" : c.tipo === "estudio" ? "Los alguaciles del Estudio" : "Los diputados"}</b>: ${esc(L[c.lugar].corto)}, a ${R.FRANJAS[c.f].nombre.toLowerCase()}. <span class="small">${esc(E.llaveTxt(s, c.tipo))}</span></li>`).join("")}</ul>` : `<p>Todavía no han puesto a nadie.</p>`}`; }
      else { const cs = s.presion.corchetes.concat(s.presion.puerta ? [s.presion.puerta] : []); h += `<h3>Dónde vigilan los corchetes</h3>${cs.length ? `<ul class="ciudad">${cs.map((c) => `<li><b>${esc(L[c.lugar].corto)}</b>, a ${R.FRANJAS[c.f].nombre.toLowerCase()} (desde el ${esc(corto(c.dia))})</li>`).join("")}</ul>` : `<p>Todavía no han puesto ninguno.</p>`}`; }
    }
    const malos = s.cronica.filter((c) => (c.tipo === "echado" || c.tipo === "detenido" || c.tipo === "obras") && c.anio === s.anio);
    if (malos.length) h += `<h3>Dónde te ha parado</h3><ul class="ciudad">${malos.map((c) => `<li>${esc(corto(c.dia))}, ${esc(E.momentoTxt(c.t).split(" ")[0].toLowerCase())}: ${esc(c.texto)}</li>`).join("")}</ul>`;
    for (const a of ((s.cadena || {}).archivo || []).slice().reverse()) {
      const rr = {};
      const pon = (x) => { const k = `${x.f}|${x.lugar}`; (rr[k] = rr[k] || { f: x.f, lugar: x.lugar, dias: new Set() }).dias.add(x.dia); };
      a.vistas.forEach(pon); a.contado.forEach(pon); if (a.heredero) a.heredero.vistas.forEach(pon);
      h += `<h3>Verano de ${a.anio}</h3>`;
      const lin = [];
      R.FRANJAS.forEach((fr, f) => { const it = Object.values(rr).filter((x) => x.f === f).map((x) => `<b>${esc(L[x.lugar].corto)}</b> (${x.dias.size} ${x.dias.size === 1 ? "día" : "días"})`); if (it.length) lin.push(`<li><b>${fr.nombre}:</b> ${it.join(" · ")}</li>`); });
      h += lin.length ? `<p class="small">Dónde se vio a la ronda:</p><ul class="ciudad">${lin.join("")}</ul>` : `<p class="small">Nadie vio a la ronda.</p>`;
    }
    return h + `<div class="btns">${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div></div>`;
  }
  function tretasHtml() {
    let h = `<div class="modal-in"><h2>Tus tretas</h2><p class="small muted">Pedir con ellas, comprar y ponerte o quitarte el atrezo, con E en cada sitio. (T o Esc para cerrar)</p>`;
    if (!s.mazo.length && !s.llaga) h += `<p>No sabes ninguna. De noche, en la ribera, siempre hay alguien que enseña una.</p>`;
    const lis = s.mazo.map((id) => {
      const tt = E.TT[id], partes = [];
      if (tt.usos) partes.push(s.usos[id] > 0 ? `${s.usos[id]} ${s.usos[id] === 1 ? "pliego" : "pliegos"}` : "sin pliegos");
      if (s.puesta === id) partes.push(`llevas puest${tt.puesta.nombre === "la ropa buena" ? "a" : "as"} ${tt.puesta.nombre}`);
      if (E.catalogada(s, id)) partes.push(`<span class="ronda-txt">la conocen</span>`);
      if (tt.cita && s.cita && s.cita.dia === s.dia) partes.push(`quedasteis ${esc(E.citaTxt(s.cita))}`);
      return `<li><b>${esc(tt.nombre)}</b>${partes.length ? " · " + partes.map((p2) => (p2.startsWith("<span") ? p2 : esc(p2))).join(" · ") : ""}<br><span class="small muted">${esc(tt.como || "")}</span></li>`;
    });
    if (s.llaga) lis.push(`<li><b>la llaga</b> · en la pierna, para siempre</li>`);
    if (lis.length) h += `<ul class="ciudad">${lis.join("")}</ul><p class="small muted">Llevas ${s.mazo.length} de ${TR.mazo}${s.llaga ? " (la llaga no cuenta)" : ""}. Tienes ${s.blancas} ${s.blancas === 1 ? "blanca" : "blancas"}.</p>`;
    if ((s.quemadas || []).length) h += `<p class="small">Pregonadas para toda tu gente: ${s.quemadas.map((id) => esc(E.TT[id].nombre)).join(", ")}.</p>`;
    if (s.mazo.length && s.fase === "dia") h += `<details class="small"><summary>Dejar una treta</summary><div class="btns">${s.mazo.map((id) => btn("olvidar", `Dejar ${E.TT[id].nombre}`, "", { cls: "secundario", data: { t: id } })).join("")}</div></details>`;
    return h + `<div class="btns">${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div></div>`;
  }
  function menuHtml() {
    const enJuego = s && ui.pantalla === "juego" && s.fase !== "fin";
    return `<div class="modal-in"><h2>Menú</h2><div class="menu-list">${btn("ayuda", "Cómo se juega", "")}${btn("inicio", "Ir al inicio", "La partida se guarda")}${enJuego ? btn("abandonar", "Abandonar la partida", "Acaba aquí y puedes mandar el informe") : ""}${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div></div>`;
  }
  function abrirModal(h) { modal.innerHTML = h; modal.hidden = false; }
  function cerrarModal() { modal.hidden = true; modal.innerHTML = ""; }

  // ------------------------------------------------------------------ informes
  function informeJuego(x) {
    const lin = E.informe(x).split("\n");
    const v = x.jg || {};
    const pasos = E.resumenDias(x).pasos + (x.hoy && !x.porDia.some((d) => d.dia === x.dia && d.anio === x.anio) ? x.hoy.pasos || 0 : 0);
    const seg = Math.round((v.ms || 0) / 1000);
    const cerca = Object.entries(v).filter(([k]) => k.startsWith("cerca_")).map(([k, n]) => `${k.slice(6)} ${n}`).join(", ") || "—";
    const clics = Object.entries(v).filter(([k]) => k.startsWith("clic_")).map(([k, n]) => `${k.slice(5)} ${n}`).join(", ") || "—";
    lin.splice(1, 0,
      `Juego 2D (rama claude/juego2d, ${VERSION_JUEGO}).`,
      `Andar: pasos que contó el motor ${pasos} · por las salidas ${v.salidas || 0} (por el borde ${v.salidas_borde || 0}, por una puerta del fondo ${v.salidas_puerta || 0}) · con el mapa ${v.pasos_mapa || 0} en ${v.viajes || 0} viajes (parados porque te paró o pasó algo ${v.viajes_parados_algo || 0}, porque viste a la ronda ${v.viajes_parados_ronda || 0}, por la noche o el tiempo ${(v.viajes_parados_noche || 0) + (v.viajes_parados_tiempo || 0)}) · mapa abierto ${v.mapa || 0} veces.`,
      `En las escenas: ${seg} s, ${Math.round(v.px || 0)} px andados (unos ${Math.round((v.px || 0) / VEL)} s andando), ${v.visitas || 0} escenas visitadas · al acercarte: ${cerca} · clics: ${clics} · menú de acciones ${v.menu || 0} · acciones ${v.accion || 0} · Recuerdos ${x.recuerdaAbierto || 0}.`,
      `Qué no supo leer en las escenas o en el mapa: ${(x.encuesta || {}).plano || "—"}`);
    return lin.join("\n");
  }
  function marcaVisita(id) { if (!s) return; cuenta("visitas"); ui.desde = ui.desde || performance.now(); void id; }
  setInterval(() => { if (s && enDia() && !document.hidden) { s.jg = s.jg || {}; s.jg.ms = (s.jg.ms || 0) + 1000; } }, 1000);
  const nombreArchivo = (jug, fecha) => `liber-juego2d-${((jug || "anonimo").normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "anonimo")}-${(fecha || "").slice(0, 16).replace(/[:T]/g, "-")}.txt`;
  function finalCorto(x) {
    if (!x.final) return "sin acabar";
    if (x.final.cadena) return `tu gente, de ${x.final.cadena.desde} a ${x.final.cadena.hasta}`;
    return `${E.FINALES[x.final.tipo] || x.final.tipo}, día ${x.final.dia}`;
  }
  function guardarEnHistorial() {
    if (!s || !s.final || s.enHistorial) return;
    const hist = load(LS.historial, []);
    hist.push({ fecha: s.empezada, final: finalCorto(s), informe: informeJuego(s), jugador: s.jugador });
    while (hist.length > 12) hist.shift();
    store(LS.historial, hist);
    s.enHistorial = true;
  }
  function descargar(texto, nombre) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function copiar(texto) {
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(() => abrirModal(`<div class="modal-in"><p>Informe copiado. Pégalo en un correo a ${esc(R.CONFIG.email)}.</p>${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div>`), () => descargar(texto, "informe.txt"));
    else descargar(texto, "informe.txt");
  }

  // ================================================================== acciones de los botones y teclas
  const guardar = () => { if (s) store(LS.partida, s); };
  function guardaNombre() { const n = (document.getElementById("nombre") || {}).value; if (n != null) store(LS.nombre, n.trim()); }
  const ACC = {
    empezar() {
      const nombre = (document.getElementById("nombre") || {}).value || "";
      store(LS.nombre, nombre.trim());
      if (s && s.fase !== "fin" && !confirm("Hay una partida a medias. ¿Empezar otra? La de ahora se perderá.")) return;
      const sem = new URLSearchParams(location.search).get("semilla");
      s = E.nueva("A", nombre.trim(), sem || null, { llaga: load(LS.llaga, false), tuyos: load(LS.tuyos, false), cadena: load(LS.cadena, false), hurto: load(LS.hurto, false), tretas: !!P.tretas && load(LS.tretas, false), presion: !!P.presion && load(LS.presion, false) });
      ui.pantalla = "juego"; ui.escena = null; ui.x = null; ui.ruta = [];
    },
    cadenaOnOff() { guardaNombre(); store(LS.cadena, !load(LS.cadena, false)); },
    llagaOnOff() { guardaNombre(); store(LS.llaga, !load(LS.llaga, false)); },
    tuyosOnOff() { guardaNombre(); store(LS.tuyos, !load(LS.tuyos, false)); },
    hurtoOnOff() { guardaNombre(); store(LS.hurto, !load(LS.hurto, false)); },
    tretasOnOff() { guardaNombre(); store(LS.tretas, !load(LS.tretas, false)); },
    presionOnOff() { guardaNombre(); store(LS.presion, !load(LS.presion, false)); },
    // las tretas, de noche y en «Tus tretas»
    posada() { E.pagarPosada(s); },
    aprender(d) { E.aprender(s, d.o || null); },
    quedar(d) { E.quedar(s, d.id, d.l); },
    olvidar(d) { if (!confirm(`¿Dejar ${E.TT[d.t].nombre}? Para volver a tenerla tendrás que aprenderla o comprarla otra vez.`)) return "modal"; E.olvidar(s, d.t); guardar(); abrirModal(tretasHtml()); if (SC && enDia()) construir(ui.escena, ui.x); pintarHud(); return "modal"; },
    tretas() { if (!s || !s.conTretas) return "nada"; cuenta("tretasAbiertas"); guardar(); abrirModal(tretasHtml()); return "modal"; },
    continuar() { ui.pantalla = "juego"; },
    empezarDia() { E.empezarJornada(s); ui.escena = null; ui.x = null; ui.pose = null; },
    heredero(d) { E.elegirHeredero(s, d.id); if (s.fase === "fin") guardarEnHistorial(); ui.escena = null; },
    siguienteVerano() { E.siguienteVerano(s); ui.escena = null; },
    seguir() { seguirResultado(); },
    op(d) { if (d.id === "mirar") { ui.menu = false; ui.sitio = s.lugar; cuenta("mirar"); return; } hacer(d.id); return "hecho"; },
    menuAcc() { if (!enDia() || (s.fase === "resultado" && (s.ultimo || {}).tono === "mal")) return "nada"; ui.menu = !ui.menu; ui.sitio = null; if (ui.menu) cuenta("menu"); },
    mapa() { if (!enDia() || ui.viajando) return "nada"; ui.mapa = !ui.mapa; ui.menu = false; ui.sitio = null; if (ui.mapa) { cuenta("mapa"); ui.mapaSel = null; } else ui.ruta = []; },
    viajar() { viajar(); return "hecho"; },
    borrarRuta() { ui.ruta = []; },
    cerrarSitio() { ui.sitio = null; },
    cenar(d) { E.cenar(s, +d.n || 0); if (s.fase === "fin") guardarEnHistorial(); },
    llaga() { E.hacerLlaga(s); },
    dar(d) { E.darPan(s, d.id, +d.n || 1); },
    nueva() { ui.pantalla = "inicio"; },
    inicio() { cerrarModal(); ui.pantalla = "inicio"; },
    ayuda() { abrirModal(ayudaHtml()); return "modal"; },
    recuerdo() { if (!s) return "nada"; s.recuerdaAbierto = (s.recuerdaAbierto || 0) + 1; guardar(); abrirModal(recuerdoHtml()); return "modal"; },
    menu() { abrirModal(menuHtml()); return "modal"; },
    cerrar() { cerrarModal(); return "modal"; },
    abandonar() {
      if (!confirm("¿Abandonar la partida? Podrás mandar el informe de lo jugado.")) return "modal";
      cerrarModal(); s.final = { tipo: "abandona", dia: s.dia, texto: "Abandonas la partida." }; s.fase = "fin"; guardarEnHistorial();
    },
    descargar() { descargar(informeJuego(s), nombreArchivo(s.jugador, s.empezada)); return "nada"; },
    copiar() { copiar(informeJuego(s)); return "nada"; },
    correo() {
      const t = informeJuego(s);
      const cuerpo = `${s.jugador || "Anónimo"} jugó el juego 2D. Final: ${finalCorto(s)}.\n\n(Adjunta el informe descargado: ${nombreArchivo(s.jugador, s.empezada)})\n\n` + t.split("== Dónde estuvo la ronda")[0];
      location.href = `mailto:${R.CONFIG.email}?subject=${encodeURIComponent("Liber Vagatorum · juego 2D · informe de " + (s.jugador || "anónimo"))}&body=${encodeURIComponent(cuerpo.slice(0, 6000))}`;
      return "nada";
    },
    hDescargar(d) { const x = load(LS.historial, [])[+d.i]; if (x) descargar(x.informe, nombreArchivo(x.jugador, x.fecha)); return "nada"; },
    hCopiar(d) { const x = load(LS.historial, [])[+d.i]; if (x) copiar(x.informe); return "nada"; },
  };

  // ------------------------------------------------------------------ pintar: escena (Phaser) o pantalla (HTML)
  let juego = null;
  function pintar() {
    const dia = enDia();
    juegoEl.hidden = !dia;
    app.hidden = dia;
    if (dia) {
      if (!juego) {
        juego = new Phaser.Game({ type: Phaser.AUTO, parent: "lienzo", backgroundColor: "#e9dfc9", scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: WV, height: HV }, scene: [Calle], render: { antialias: true }, input: { keyboard: false } });
      } else {
        juego.scale.refresh();
        if (SC && ui.escena == null) construir(s.lugar, null);
      }
      pintarHud(); pintarCapa();
    } else {
      ui.menu = false; ui.mapa = false; ui.sitio = null;
      let h;
      if (!s || ui.pantalla === "inicio") h = pantallaInicio();
      else if (s.fase === "amanecer") h = pantallaAmanecer();
      else if (s.fase === "noche") h = pantallaNoche();
      else if (s.fase === "relevo") h = pantallaRelevo();
      else if (s.fase === "invierno") h = pantallaInvierno();
      else h = pantallaFin();
      app.innerHTML = h;
      window.scrollTo(0, 0);
      ui.escena = null;
    }
  }

  document.addEventListener("click", (ev) => {
    const mapaSitio = ev.target.closest("[data-m-lugar]");
    if (mapaSitio && ui.mapa) { tocarMapa(mapaSitio.dataset.mLugar); return; }
    const el = ev.target.closest("[data-act]");
    if (el && !el.disabled) {
      const fn = ACC[el.dataset.act];
      if (!fn) return;
      const r = fn(Object.assign({}, el.dataset));
      if (r === "nada" || r === "hecho") return;
      if (r !== "modal") { guardar(); pintar(); }
      return;
    }
    if (ev.target === modal) cerrarModal();
  });
  // la previsión del motor al pasar el ratón por el menú
  document.addEventListener("mouseover", (ev) => {
    const op = ev.target.closest(".j-op");
    if (!op || !menuAcciones.items) return;
    const pr = document.getElementById("prev");
    if (pr) pr.innerHTML = prevHtml(menuAcciones.items[+op.dataset.i]);
  });
  document.addEventListener("input", (ev) => {
    const k = ev.target.dataset && ev.target.dataset.enc;
    if (k && s) { s.encuesta = s.encuesta || {}; s.encuesta[k] = ev.target.value; guardar(); }
  });
  // las teclas
  const MOV = { ArrowLeft: "izq", KeyA: "izq", ArrowRight: "der", KeyD: "der" };
  window.addEventListener("keydown", (ev) => {
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    const k = ev.code;
    if (MOV[k]) { teclas[MOV[k]] = true; ev.preventDefault(); return; }
    if (!modal.hidden) { if (k === "Escape" || k === "KeyR" || k === "KeyT") { cerrarModal(); ev.preventDefault(); } return; }
    if (!s) return;
    if (s.fase === "amanecer" && ui.pantalla === "juego" && (k === "Enter" || k === "Space")) { ACC.empezarDia(); guardar(); pintar(); ev.preventDefault(); return; }
    if (!enDia()) return;
    if (k === "ArrowUp" || k === "KeyW") { puertaDelante(); ev.preventDefault(); return; }
    if (k === "Escape") { if (ui.mapa) { ui.mapa = false; ui.ruta = []; } ui.menu = false; ui.sitio = null; pintar(); return; }
    if (s.fase === "resultado") { if (k === "Enter" || k === "Space" || k === "KeyE") { seguirResultado(); guardar(); pintar(); ev.preventDefault(); } return; }
    if (k === "KeyM") { ACC.mapa(); guardar(); pintar(); return; }
    if (ui.mapa) { if (k === "Enter" && ui.ruta.length) viajar(); return; }
    if (k === "KeyR") { ACC.recuerdo(); return; }
    if (k === "KeyT") { ACC.tretas(); return; }
    if (k === "KeyE") { ACC.menuAcc(); pintar(); return; }
    if (ui.menu && /^Digit[1-9]$/.test(k)) { const it = (menuAcciones.items || [])[+k.slice(5) - 1]; if (it && it.ok) { ACC.op({ id: it.id }); if (it.id === "mirar") pintar(); } }
  });
  window.addEventListener("keyup", (ev) => { if (MOV[ev.code]) { teclas[MOV[ev.code]] = false; if (!teclas.izq && !teclas.der) ui.soltar = false; } });
  window.addEventListener("blur", () => { teclas.izq = teclas.der = false; });

  pintar();
  // para las pruebas
  window.__LVG = { get s() { return s; }, ui, pintar, informe: () => (s ? informeJuego(s) : ""), get escena() { return SC; }, anchoDe, ESCENAS, salidaX };
})();
