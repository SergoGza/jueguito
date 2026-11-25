/* Liber Vagatorum · vista 2D (rama claude/vista).
 * Una prueba de pantalla: la ciudad dibujada con moñigotes, encima del mismo motor. Las reglas están en rules.js y el
 * motor en engine.js, tal cual: aquí no hay ni una regla, solo se pinta lo que el motor dice y lo que el personaje sabe.
 * Lo único que la vista necesitaba y el motor no daba lo lee ENGINE.vista (solo lee).
 * La pantalla del día es nueva. Las demás (inicio, amanecer, noche, relevo, invierno, final, Recuerdos, ayuda) son las
 * del juguete (app.js), copiadas con cambios mínimos. La partida se guarda aparte de la del juguete. */
(function () {
  const R = window.RULES, E = window.ENGINE, P = R.PARAMS, HU = P.hurto || {}, EV = E.vista || {};
  const VISTA = "v1";
  const LS = { partida: "lvv-partida", historial: "lvv-historial", tema: "lvj-tema", nombre: "lvj-nombre", llaga: "lvv-llaga", tuyos: "lvv-tuyos", cadena: "lvv-cadena", hurto: "lvv-hurto", pista: "lvv-pista" };
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const app = document.getElementById("app");
  const modal = document.getElementById("modal");

  let s = load(LS.partida, null);
  if (s && (!s.v || !s.hoy)) s = null;
  const ui = { pantalla: s && s.fase !== "fin" ? "juego" : "inicio", sel: null, fig: null, toast: null };
  let faseAntes = null;
  let antes = null; // lo que había en la escena la última vez que se pintó (para las animaciones)

  const L = E.L;
  function btn(act, titulo, detalle, opts) {
    const o = opts || {};
    const data = Object.entries(o.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
    return `<button class="btn ${o.cls || ""}" data-act="${act}"${data}${o.disabled ? " disabled" : ""}><span class="t">${o.icono || ""}${esc(titulo)}</span>${detalle ? `<span class="d">${esc(detalle)}</span>` : ""}</button>`;
  }
  const franjaAct = () => E.franja(Math.min(s.t, E.FIN - 1));
  const enEscena = () => s && ui.pantalla === "juego" && (s.fase === "dia" || s.fase === "resultado");
  // cuántos toques de cada clase (van al informe: sirven para ver cuánto se toca para andar y para entender)
  function cuenta(k) { s.vt = s.vt || {}; s.vt[k] = (s.vt[k] || 0) + 1; }

  // ================================================================== el plano
  // Salamanca de 1545, más o menos: el Tormes abajo, el puente romano, la muralla con la Puerta del Río y la de San Pablo,
  // la catedral y las Escuelas junto al río, la Rúa subiendo a la plaza, San Martín pegado a ella, la calle de San Pablo
  // bajando a San Esteban. Coordenadas de la vista (no de las reglas): viewBox 520 × 700.
  const POS = {
    plaza: [292, 108], sanmartin: [130, 150], rua: [212, 262], sanpablo: [428, 228],
    catedral: [138, 398], escuelas: [290, 384], sanesteban: [432, 398],
    puerta: [226, 506], sanpolo: [446, 506],
    ribera: [78, 592], puente: [226, 650], orilla: [338, 598],
  };
  const VB = { x: 0, y: 14, w: 520, h: 690 };
  // quién mira donde avisan enseguida (el sitio lo dicen las reglas, aviso >= 2; el nombre, la descripción del sitio)
  const VIGIA = { puerta: "el portero", escuelas: "el bedel", sanmartin: "el cura" };
  const vigiaDe = (id) => (L[id].aviso >= 2 ? VIGIA[id] || "alguien" : null);
  // la luz de cada franja (prima, tercia, sexta, nona, vísperas, completas): un color que multiplica la escena
  const LUZ = [["#ffe6da", 0.85], ["#ffffff", 0], ["#fffaea", 0.8], ["#fff0d8", 0.85], ["#ffd3ad", 0.85], ["#97a1cc", 0.9]];

  // ------------------------------------------------------------------ moñigotes
  // en el plano, los muñecos van más grandes que dibujados (para que se vean en el móvil): se escalan desde los pies
  const ESC = 1.5;
  const grande = (x, y, svg) => `<g transform="translate(${x} ${y}) scale(${ESC}) translate(${-x} ${-y})">${svg}</g>`;
  // un moñigote: cabeza y cuerpo en trapecio; (x, y) son los pies
  function peg(x, y, o) {
    const k = o.k || 1, h = (o.sent ? 7 : 11) * k, c = o.c;
    let g = `<path d="M${x - 4 * k},${y} L${x + 4 * k},${y} L${x + 2.4 * k},${y - h} L${x - 2.4 * k},${y - h}Z" fill="${c}"${o.borde ? ` stroke="${o.borde}" stroke-width="1.1"` : ""}/>`;
    g += `<circle cx="${x}" cy="${y - h - 3.4 * k}" r="${3.2 * k}" fill="${o.cabeza || c}"${o.borde ? ` stroke="${o.borde}" stroke-width="1.1"` : ""}/>`;
    return g;
  }
  // la gente que da (o la de paso, más clara)
  const gente = (x, y, paso) => peg(x, y, { c: paso ? "var(--f-paso)" : "var(--f-gente)", k: paso ? 0.9 : 1 });
  // un pobre sentado pidiendo, con el cuenco
  function pobre(x, y, c) {
    return peg(x, y, { c: c || "var(--f-pobre)", sent: true }) + `<path d="M${x + 2},${y - 5} L${x + 8},${y - 3}" stroke="${c || "var(--f-pobre)"}" stroke-width="1.6" stroke-linecap="round"/><path d="M${x + 6.5},${y - 3.5} a2.6,2 0 0 0 5,0z" fill="var(--f-cuenco)"/>`;
  }
  // el alguacil (con su vara) y dos corchetes
  function ronda(x, y, alerta) {
    let g = peg(x + 16, y + 2, { c: "var(--f-corchete)" }) + `<path d="M${x + 20},${y + 3} L${x + 20},${y - 22}" stroke="var(--f-corchete)" stroke-width="1.2"/><path d="M${x + 18.5},${y - 21} L${x + 20},${y - 25} L${x + 21.5},${y - 21}z" fill="var(--f-corchete)"/>`;
    g += peg(x + 9, y - 6, { c: "var(--f-corchete)" }) + `<path d="M${x + 13},${y - 5} L${x + 13},${y - 29}" stroke="var(--f-corchete)" stroke-width="1.2"/><path d="M${x + 11.5},${y - 28} L${x + 13},${y - 32} L${x + 14.5},${y - 28}z" fill="var(--f-corchete)"/>`;
    g += peg(x, y, { c: "var(--f-ronda)", k: 1.12 }) + `<path d="M${x - 5},${y - 18.2} h10" stroke="var(--f-ronda)" stroke-width="2"/><rect x="${x - 2.6}" y="${y - 22.8}" width="5.2" height="4" fill="var(--f-ronda)"/>`;
    g += `<path d="M${x - 6},${y + 1} L${x - 6},${y - 21}" stroke="var(--f-vara)" stroke-width="1.6" stroke-linecap="round"/>`;
    if (alerta) g += `<g class="alerta"><circle cx="${x + 2}" cy="${y - 34}" r="7" fill="var(--bad)"/><text x="${x + 2}" y="${y - 30.3}" font-size="11" font-weight="800" fill="#fff" text-anchor="middle">!</text></g>`;
    return g;
  }
  // tú: más grande, con borde claro, el hatillo al hombro; con la llaga, la venda en la pierna
  function yo(x, y) {
    let g = `<ellipse cx="${x}" cy="${y + 1}" rx="8" ry="2.6" fill="var(--accent)" opacity="0.35"/>`;
    g += peg(x, y, { c: "var(--f-yo)", k: 1.25, borde: "var(--surface)" });
    g += `<circle cx="${x + 5.5}" cy="${y - 13}" r="3" fill="var(--f-hatillo)" stroke="var(--surface)" stroke-width="0.8"/>`;
    if (s.llaga) g += `<rect x="${x - 3.6}" y="${y - 3.6}" width="3.4" height="2.6" fill="#fff" stroke="var(--bad)" stroke-width="0.6"/>`;
    return g;
  }
  // uno de los tuyos, con su inicial
  function tuyo(x, y, nombre, pide) {
    const c = nombre === "Pedro" ? "var(--f-pedro)" : "var(--f-cata)";
    let g = pide ? pobre(x, y, c) : peg(x, y, { c });
    const hy = y - (pide ? 7 : 11) - 13;
    g += `<circle cx="${x}" cy="${hy}" r="4.6" fill="${c}"/><text x="${x}" y="${hy + 2.6}" font-size="6.8" font-weight="800" fill="#fff" text-anchor="middle">${esc(nombre[0])}</text>`;
    return g;
  }
  // quien mira y avisa enseguida: el portero, el bedel, el cura (con un ojo encima)
  function vigia(x, y) {
    return peg(x, y, { c: "var(--f-vigia)" }) + `<rect x="${x - 3.4}" y="${y - 19.5}" width="6.8" height="2.6" fill="var(--f-vigia)"/>`
      + `<g transform="translate(${x},${y - 25})"><path d="M-5,0 Q0,-4 5,0 Q0,4 -5,0z" fill="var(--surface)" stroke="var(--f-vigia)" stroke-width="1"/><circle r="1.6" fill="var(--f-vigia)"/></g>`;
  }
  // un vecino asomado a la ventana; si es por ti, en rojo y con el brazo levantado
  function vecino(x, y, mio) {
    const c = mio ? "var(--bad)" : "var(--f-vecino)";
    let g = `<rect x="${x - 6}" y="${y - 6}" width="12" height="11" fill="var(--ventana)" stroke="${c}" stroke-width="${mio ? 1.8 : 1.2}"/>`;
    g += `<circle cx="${x}" cy="${y - 1.4}" r="2.6" fill="${c}"/><path d="M${x - 4},${y + 5} Q${x},${y + 1} ${x + 4},${y + 5}z" fill="${c}"/>`;
    if (mio) g += `<path d="M${x + 3},${y + 1} L${x + 9},${y - 8}" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`;
    return g;
  }
  // el capataz de las obras, con su sombrero y una piedra
  function capataz(x, y) {
    return peg(x, y, { c: "var(--f-capataz)" }) + `<path d="M${x - 5.5},${y - 17.6} h11" stroke="var(--f-capataz)" stroke-width="1.8"/>`
      + `<rect x="${x + 5}" y="${y - 4}" width="6" height="4" fill="var(--bld-line)"/><rect x="${x + 7}" y="${y - 7}" width="5" height="3" fill="var(--bld-line)"/>`;
  }
  // un puesto del mercado (o una tienda de la Rúa)
  function puesto(x, y) {
    return `<rect x="${x - 7}" y="${y - 7}" width="14" height="6" fill="var(--bld)" stroke="var(--bld-line)" stroke-width="0.8"/>`
      + `<path d="M${x - 9},${y - 7} L${x - 6},${y - 13} L${x + 6},${y - 13} L${x + 9},${y - 7}z" fill="var(--toldo)"/><path d="M${x - 3},${y - 13} L${x - 4.5},${y - 7} M${x + 3},${y - 13} L${x + 4.5},${y - 7}" stroke="var(--surface)" stroke-width="1.6"/>`;
  }
  function banderines(x1, y1, x2, y2) {
    let g = `<path d="M${x1},${y1} L${x2},${y2}" stroke="var(--bld-line)" stroke-width="0.8"/>`;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      g += `<path d="M${x - 3},${y} L${x + 3},${y} L${x},${y + 6}z" fill="${i % 2 ? "var(--toldo)" : "var(--f-cata)"}"/>`;
    }
    return g;
  }

  // ------------------------------------------------------------------ edificios
  const casa = (x, y, w, h) => `<rect class="bld" x="${x}" y="${y - h}" width="${w}" height="${h}"/><path class="tejado" d="M${x - 1.5},${y - h} L${x + w / 2},${y - h - 6} L${x + w + 1.5},${y - h}Z"/>`;
  function iglesia(x, y, k) {
    k = k || 1;
    return `<rect class="bld" x="${x}" y="${y - 18 * k}" width="${34 * k}" height="${18 * k}"/><path class="tejado" d="M${x - 1.5},${y - 18 * k} L${x + 17 * k},${y - 27 * k} L${x + 34 * k + 1.5},${y - 18 * k}Z"/>`
      + `<rect class="bld" x="${x + 34 * k}" y="${y - 36 * k}" width="${10 * k}" height="${36 * k}"/><path class="tejado" d="M${x + 34 * k - 1},${y - 36 * k} L${x + 39 * k},${y - 43 * k} L${x + 44 * k + 1},${y - 36 * k}Z"/>`
      + `<path class="cruz" d="M${x + 39 * k},${y - 43 * k} v-6 M${x + 36.5 * k},${y - 46.5 * k} h5"/><path class="hueco" d="M${x + 14 * k},${y} v-7 a3 3 0 0 1 6 0 v7z"/>`;
  }
  // dónde se asoma el vecino en cada sitio y dónde está quien vigila (desplazamientos desde el centro)
  const VENTANA = { plaza: [-36, -42], sanmartin: [-16, -38], rua: [-30, -42], sanpablo: [22, -42], catedral: [-14, -44], escuelas: [-18, -40],
    sanesteban: [-26, -36], puerta: [-34, -36], sanpolo: [34, -36] };
  const DONDE_VIGIA = { puerta: [-44, -6], escuelas: [-46, -6], sanmartin: [-44, -6] };
  function edificio(id, x, y) {
    const b = y - 26; // la línea de las fachadas, detrás de la gente
    switch (id) {
      case "plaza":
        return `<rect class="suelo-plaza" x="${x - 60}" y="${y - 30}" width="120" height="52" rx="3"/>` + casa(x - 58, b - 4, 22, 14) + casa(x - 34, b - 4, 20, 16) + casa(x - 12, b - 4, 22, 14) + casa(x + 12, b - 4, 20, 16) + casa(x + 34, b - 4, 22, 14)
          + `<path class="soportal" d="M${x - 58},${b - 4} h114"/>`;
      case "sanmartin": return iglesia(x - 26, b, 1.05) + casa(x + 24, b, 16, 12);
      case "rua": return casa(x - 52, b, 18, 14) + casa(x - 32, b, 16, 18) + casa(x - 14, b, 18, 13) + casa(x + 20, b, 16, 16) + casa(x + 38, b, 16, 13);
      case "sanpablo": return casa(x - 48, b, 18, 13) + casa(x - 28, b, 16, 15) + casa(x + 14, b, 18, 14) + casa(x + 34, b, 14, 12);
      case "catedral":
        return iglesia(x - 34, b, 1.35)
          // las obras de la catedral nueva: un andamio y piedra
          + `<path class="andamio" d="M${x - 58},${b} v-34 M${x - 46},${b} v-34 M${x - 60},${b - 10} h16 M${x - 60},${b - 22} h16 M${x - 60},${b - 34} h16 M${x - 58},${b} L${x - 46},${b - 22}"/>`;
      case "escuelas":
        return `<rect class="bld" x="${x - 34}" y="${b - 24}" width="68" height="24"/><path class="tejado" d="M${x - 35},${b - 24} l4,-4 l4,4 l4,-4 l4,4 l4,-4 l4,4 l4,-4 l4,4 l4,-4 l4,4 l4,-4 l4,4 l4,-4 l4,4 l4,-4 l4,4 l3,-3 v3z"/>`
          + `<rect class="fachada" x="${x - 12}" y="${b - 22}" width="24" height="16"/><path class="hueco" d="M${x - 4},${b} v-7 a4 4 0 0 1 8 0 v7z"/>`;
      case "sanesteban":
        return iglesia(x - 10, b, 1.15) + `<rect class="bld" x="${x - 48}" y="${b - 22}" width="36" height="22"/><rect class="claustro" x="${x - 42}" y="${b - 17}" width="24" height="13"/>`;
      case "puerta": return casa(x - 50, b + 6, 16, 12) + casa(x + 30, b + 6, 18, 14);
      case "sanpolo": return casa(x + 24, b + 6, 18, 12);
      case "ribera":
        return `<g class="juncos"><path d="M${x - 50},${y + 22} q2,-12 0,-16 M${x - 46},${y + 22} q-2,-10 1,-14 M${x + 44},${y + 22} q2,-12 0,-16 M${x + 48},${y + 22} q-2,-10 1,-13 M${x - 20},${y + 24} q2,-8 0,-11"/></g>`
          + `<g class="acena"><rect x="${x - 26}" y="${y - 50}" width="30" height="16"/><circle cx="${x + 10}" cy="${y - 40}" r="9"/><path d="M${x + 10},${y - 49} v18 M${x + 1},${y - 40} h18"/></g>`;
      case "orilla": return `<g class="juncos"><path d="M${x - 44},${y + 20} q2,-12 0,-16 M${x - 40},${y + 20} q-2,-10 1,-14 M${x + 40},${y + 20} q2,-12 0,-16"/></g>`;
      default: return "";
    }
  }

  // ------------------------------------------------------------------ lo que se sabe de cada sitio
  // aquí: lo que ves ahora; en otro sitio: lo último que viste, con su edad
  function verDe(id) {
    const f = franjaAct();
    if (id === s.lugar && s.t < E.FIN) {
      const e = E.estado(s, id, s.dia, f);
      const ajenos = EV.pobresAjenos ? EV.pobresAjenos(s, id, s.dia, f) : e.pobres;
      return { ahora: true, nivel: 0, gente: e.gente, da: e.da, pobres: ajenos, todosPobres: e.pobres, trabajo: e.trabajo, tuyos: E.tuyosEn(s, id) };
    }
    const m = s.memoria[id];
    if (!m) return null;
    const ed = E.edad(s, m);
    return { ahora: false, nivel: Math.max(1, ed.nivel), edad: ed.txt, gente: m.gente, da: m.da, pobres: m.pobres, todosPobres: m.pobres, trabajo: m.trabajo, tuyos: [] };
  }
  // ahora, antes hoy, ayer o antes: lo de otros días, casi borrado (lo visto caduca, y si no se ve viejo se lee como de ahora)
  const OPAC = [1, 0.5, 0.2, 0.2];
  // dónde viste a la ronda por última vez (si no la ves ahora)
  function rondaUltima() {
    const v = (s.vistas || [])[(s.vistas || []).length - 1];
    if (!v) return null;
    const f = franjaAct();
    const nivel = v.dia === s.dia && v.f === f ? 0.5 : v.dia === s.dia ? 1 : v.dia === s.dia - 1 ? 2 : 3;
    const edad = v.dia === s.dia && v.f === f ? "en esta franja" : v.dia === s.dia ? "a " + E.nombreFranja(v.f).toLowerCase() : v.dia === s.dia - 1 ? "ayer a " + E.nombreFranja(v.f).toLowerCase() : `el día ${v.dia} a ${E.nombreFranja(v.f).toLowerCase()}`;
    return { lugar: v.lugar, op: nivel === 0.5 ? 0.5 : [1, 0.42, 0.3, 0.22][nivel], edad };
  }
  const rondaAqui = () => (s.t < E.FIN ? E.rondaEnTuZona(s) : null);
  const pedidoAqui = (id) => s.pedidoHoy.filter((p) => p.lugar === id).map((p) => R.FRANJAS[p.f].nombre.toLowerCase());
  const TXT_GENTE = (g, id) => `${E.GENTE_TXT[g]}${g >= 1 && L[id].quien ? ` (${L[id].quien})` : ""}`;

  // ------------------------------------------------------------------ la escena
  // Los sitios a los que puedes ir ahora (y si te da tiempo)
  function movimientos() {
    const o = E.opciones(s);
    const m = {};
    for (const mv of o.movs) m[mv.destino] = mv;
    return { o, m };
  }
  // la gente de un sitio, según cuánta hay: 0 nadie; 1 de paso o solo pobres; 2 poca; 3 mucha
  const HUECOS = [[-34, -9], [-8, -11], [16, -8], [-21, -2], [3, -1], [-46, -1], [28, -3]];
  const G = (x, y, svg) => grande(x, y, svg);
  function genteDe(id, x, y, v) {
    let g = "";
    if (!v) return g;
    if (v.gente === 1) {
      if (L[id].quien === "solo pobres") g += G(x - 36, y + 6, pobre(x - 36, y + 6)) + G(x + 30, y, pobre(x + 30, y));
      else g += G(x - 20, y - 4, gente(x - 20, y - 4, true)) + (L[id].dentro ? "" : G(x + 18, y, gente(x + 18, y, true)));
    } else if (v.gente >= 2) {
      const n = v.gente >= 3 ? 7 : 3;
      const orden = n === 7 ? [0, 1, 2, 5, 6, 3, 4] : [0, 4, 2];
      for (let i = 0; i < n; i++) { const [dx, dy] = HUECOS[orden[i]]; g += G(x + dx, y + dy, gente(x + dx, y + dy)); }
    }
    if (v.pobres && L[id].dentro) g += G(x - 50, y + 16, pobre(x - 50, y + 16)) + G(x - 34, y + 19, pobre(x - 34, y + 19));
    return g;
  }
  function escena(mv) {
    const f = franjaAct(), d = E.dia(s);
    const r = rondaAqui();
    const ult = r ? null : rondaUltima();
    let g = `<svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="La ciudad">`;
    // el suelo: fuera y dentro de la muralla
    g += `<rect x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}" class="suelo-fuera" data-fondo="1"/>`;
    g += `<path class="suelo-dentro" data-fondo="1" d="M60,544 L40,420 L46,250 L66,62 L190,36 L402,38 L482,70 L502,250 L494,420 L482,544 Z"/>`;
    // el Tormes y el puente romano
    g += `<path class="rio" d="M0,622 C120,606 200,632 300,620 S450,608 520,622 L520,706 L0,706 Z"/>`;
    g += `<path class="rio-linea" d="M30,660 q14,-5 28,0 t28,0 M360,676 q14,-5 28,0 t28,0 M120,690 q14,-5 28,0 t28,0"/>`;
    g += `<text x="500" y="700" class="rotulo-rio" text-anchor="end">Tormes</text>`;
    g += `<rect class="puente" x="212" y="548" width="28" height="160"/>`;
    for (let yy = 628; yy < 708; yy += 22) g += `<path class="arco" d="M212,${yy + 14} a6,6 0 0 1 0,-12 M240,${yy + 14} a6,6 0 0 0 0,-12"/>`;
    // las calles y los caminos
    const ok = new Set(Object.values(mv.m).filter((x) => x.ok).map((x) => x.destino));
    for (const [a, b] of R.CAMINOS) {
      const [x1, y1] = POS[a], [x2, y2] = POS[b];
      g += `<line class="calle" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }
    // los caminos que salen de donde estás: resaltados; el elegido, más
    for (const [a, b] of R.CAMINOS) {
      if (a !== s.lugar && b !== s.lugar) continue;
      const otro = a === s.lugar ? b : a;
      const [x1, y1] = POS[a], [x2, y2] = POS[b];
      g += `<line class="camino ${ok.has(otro) ? "" : "no"} ${ui.sel === otro ? "sel" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }
    // la muralla y sus dos puertas
    g += `<path class="muralla" d="M212,544 L60,544 L40,420 L46,250 L66,62 L190,36 L402,38 L482,70 L502,250 L494,420 L482,544 L460,544 M432,544 L240,544"/>`;
    for (const gx of [226, 446]) g += `<rect class="torre" x="${gx - 22}" y="${532}" width="10" height="22"/><rect class="torre" x="${gx + 12}" y="${532}" width="10" height="22"/>`;
    // los sitios: edificio, suelo, gente
    let figs = "", rot = "";
    for (const l of R.LUGARES) {
      const id = l.id, [x, y] = POS[id];
      const v = verDe(id);
      const aqui = id === s.lugar;
      const op = v ? OPAC[v.nivel] : 1;
      g += `<g class="sitio${v ? "" : " sin-ver"}" data-lugar="${id}">`;
      g += `<rect class="toque" x="${x - 58}" y="${y - 66}" width="116" height="104" rx="10"/>`;
      g += edificio(id, x, y);
      const cls = aqui ? "escenario aqui" + (r ? " peligro" : "") : ui.sel === id ? "escenario sel" : ok.has(id) ? "escenario vecino" : "escenario";
      g += `<ellipse class="${cls}" cx="${x}" cy="${y + 4}" rx="56" ry="20"/>`;
      g += `</g>`;
      // lo que hay: lo de ahora, entero; lo de antes, más claro según la edad
      let p = "";
      if (L[id].trabajo && v && v.trabajo) p += `<g data-fig="capataz" data-lugar="${id}">${G(x - 54, y - 22, capataz(x - 54, y - 22))}</g>`;
      if (id === "plaza" && E.franjasHurto && E.franjasHurto(s, id, s.dia).includes(f)) p += puesto(x + 34, y - 14) + puesto(x + 50, y - 6) + puesto(x - 50, y - 12);
      else if (s.conHurto && E.franjasHurto && E.franjasHurto(s, id, s.dia).includes(f)) p += puesto(x + 40, y - 12);
      if (d.tipo === "corpus" && (id === "rua" || id === "plaza")) p += banderines(x - 56, y - 50, x + 56, y - 48);
      p += `<g data-fig="gente" data-lugar="${id}">${genteDe(id, x, y, v)}</g>`;
      if (v && v.ahora) {
        v.tuyos.forEach((t, i) => { const tx = x + 14 + i * 18, ty = y + 18; p += `<g data-fig="tuyo" data-lugar="${id}">${G(tx, ty, tuyo(tx, ty, t.nombre, t.pide))}</g>`; });
      }
      figs += `<g class="gente-sitio" data-lugar="${id}" opacity="${op}">${p}</g>`;
      // quien vigila donde avisan enseguida: siempre (lo sabe cualquiera)
      if (vigiaDe(id)) { const [dx, dy] = DONDE_VIGIA[id] || [-44, -6]; figs += `<g data-fig="vigia" data-lugar="${id}">${G(x + dx, y + dy, vigia(x + dx, y + dy))}</g>`; }
      // las quejas: donde te vieron pedir hoy (lo sabes desde cualquier sitio) y, donde estás, las de otro
      const [wx, wy] = VENTANA[id] || [0, -40];
      if (pedidoAqui(id).length) figs += `<g data-fig="queja-mia" data-lugar="${id}" class="queja">${G(x + wx, y + wy, vecino(x + wx, y + wy, true))}</g>`;
      else if (aqui && s.t < E.FIN && E.hayQuejas(s, id)) figs += `<g data-fig="queja" data-lugar="${id}" class="queja">${G(x + wx, y + wy, vecino(x + wx, y + wy, false))}</g>`;
      // la ronda: donde la ves, con la llamada de atención; donde la viste por última vez, más clara
      if (r === id) figs += `<g id="ronda-aqui" data-fig="ronda" data-lugar="${id}">${G(x + 24, y + 6, ronda(x + 24, y + 6, true))}</g>`;
      else if (ult && ult.lugar === id && !(aqui && s.t < E.FIN)) figs += `<g data-fig="ronda-vista" data-lugar="${id}" opacity="${ult.op}">${G(x + 24, y + 6, ronda(x + 24, y + 6, false))}</g>`;
      if (aqui) figs += `<g id="yo" data-fig="yo" data-lugar="${id}">${G(x - 8, y + 20, yo(x - 8, y + 20))}</g>`;
      rot += `<text class="rotulo${aqui ? " aqui" : ""}" data-lugar="${id}" x="${x}" y="${y + 40}" text-anchor="middle">${esc(l.corto)}</text>`;
    }
    g += figs + rot;
    g += `</svg>`;
    // la luz de la franja: una capa que tiñe toda la escena
    const [lc, lo] = LUZ[f];
    g += `<div id="luz" class="v-luz" style="background:${lc};opacity:calc(var(--luz-k) * ${lo})"></div>`;
    return g;
  }

  // ------------------------------------------------------------------ la tarjeta: lo que se lee al tocar
  function linFig(fig, id) {
    const v = verDe(id) || {};
    const pd = E.opciones(s).acc.find((a) => a.id === "pedir");
    switch (fig) {
      case "ronda": {
        const e = E.estado(s, id, s.dia, franjaAct());
        return `La ronda está aquí: si pides, te ve y te detiene${e.da >= 3 ? " (con tanta gente, puede que no te vea)" : ""}.`;
      }
      case "ronda-vista": { const u = rondaUltima(); return u ? `Aquí viste a la ronda por última vez, ${u.edad}.` : ""; }
      case "queja-mia": return `Hoy te han visto pedir aquí (${pedidoAqui(id).join(", ")}).`;
      case "queja": return "Un vecino rezonga: «Otra vez pordioseros por aquí». Hace poco han visto pedir aquí a otro.";
      case "vigia": return `Aquí avisan enseguida a la ronda (${vigiaDe(id)}).`;
      case "capataz": {
        const tr = E.opciones(s).acc.find((a) => a.id === "trabajo");
        return id === s.lugar && tr && tr.ok ? `Las obras cogen peones. Si te cogen, cargas piedra hasta el final de nona por ${P.trabajo.paga} pedazos de pan. Preguntar cuesta 1 rato.` : "Las obras cogían peones.";
      }
      case "tuyo": return (v.tuyos || []).map((t) => `${t.nombre} ${t.pide ? "está pidiendo aquí" : "anda por aquí"}.`).join(" ");
      case "yo": return `Tú: cuerpo ${s.cuerpo} de ${E.cuerpoMax(s)}, ${s.pan} ${s.pan === 1 ? "pedazo" : "pedazos"} de pan${s.conocido ? ", y la ronda ya te conoce la cara" : ""}${s.llaga ? ". Llevas la llaga" : ""}.`;
      case "gente": {
        if (!v.gente) return "";
        if (!v.ahora) return `${E.GENTE_TXT[v.gente][0].toUpperCase() + E.GENTE_TXT[v.gente].slice(1)}${v.pobres && L[id].dentro ? ", con otros pobres pidiendo" : ""}, ${v.edad}.`;
        return pd && pd.ok ? E.previsionPedir(s)[0] || "" : `${TXT_GENTE(v.gente, id)}.`;
      }
      default: return "";
    }
  }
  // lo que recuerdas de un sitio: dónde viste a la ronda, dónde pediste, lo que te contaron
  function recuerdaDe(id) {
    const corto = (d) => E.dia(s, d).fecha.split(" de ")[0];
    const por = (xs) => R.FRANJAS.map((fr, f) => { const ds = [...new Set(xs.filter((x) => x.f === f).map((x) => x.dia))]; return ds.length ? `${fr.nombre.toLowerCase()} (${ds.map(corto).join(", ")})` : ""; }).filter(Boolean).join(" · ");
    const out = [];
    const r = por((s.vistas || []).filter((v) => v.lugar === id));
    if (r) out.push(`Viste aquí a la ronda: ${r}.`);
    const c = (s.contado || []).filter((x) => x.ronda && x.lugar === id);
    if (c.length) out.push(`Te contaron que estaba aquí: ${R.FRANJAS.map((fr, f) => { const xs = c.filter((x) => x.f === f); return xs.length ? `${fr.nombre.toLowerCase()} (${xs.map((x) => `${x.quien}, ${corto(x.dia)}${x.oidas ? ", de oídas" : ""}`).join("; ")})` : ""; }).filter(Boolean).join(" · ")}.`);
    const p = por(s.cronica.filter((x) => (x.tipo === "pedir" || x.tipo === "pillado") && x.anio === s.anio && x.lugar === id).map((x) => ({ f: E.franja(x.t), dia: x.dia })));
    if (p) out.push(`Has pedido aquí: ${p}.`);
    return out;
  }
  function tarjetaSitio(id, mv) {
    const l = L[id], aqui = id === s.lugar;
    const v = verDe(id);
    const m = mv.m[id];
    let h = `<div class="v-tit"><h3>${esc(l.nombre)}</h3>`;
    if (!aqui && m) h += m.ok ? btn("ir", `Ir · ${m.coste} ratos`, "", { cls: "primary ir", data: { id } }) : `<span class="small muted">No te da tiempo</span>`;
    else if (!aqui) { const n = E.DIST[s.lugar][id]; h += `<span class="small muted">A ${n} pasos</span>`; }
    h += `<button class="cerrar" data-act="cerrarTarjeta" aria-label="Cerrar">×</button></div>`;
    if (ui.fig) { const t = linFig(ui.fig, id); if (t) h += `<p class="v-fig">${esc(t)}</p>`; }
    const lin = [];
    if (aqui && s.t < E.FIN) {
      const partes = [TXT_GENTE(v.gente, id)];
      if (v.todosPobres) partes.push("otros pobres pidiendo");
      if (v.trabajo) partes.push("las obras cogen peones");
      if (rondaAqui()) partes.push("la ronda");
      lin.push(`Ahora: ${partes.join(" · ")}.`);
      const o = mv.o;
      const pd = o.acc.find((a) => a.id === "pedir");
      (pd.ok ? E.previsionPedir(s) : [`Pedir: ${pd.porque}.`]).forEach((x) => lin.push(x));
      const tr = o.acc.find((a) => a.id === "trabajo");
      if (tr) lin.push(tr.ok ? `Obras: si te cogen, cargas piedra hasta el final de nona por ${P.trabajo.paga} pedazos de pan. Preguntar cuesta 1 rato.` : `Obras: ${tr.porque}.`);
      const hu = o.acc.find((a) => a.id === "hurtar");
      if (hu) lin.push(hu.ok ? `Hurtar: una hogaza de un puesto, ${HU.gana} pedazos, ${HU.ratos} ratos. Con poca gente hay más ojos sobre ti, pero si gritan puedes correr; con mucha te ven menos, pero si te ven hay manos para sujetarte.` : `Hurtar: ${hu.porque}.`);
      for (const x of E.tuyosEn(s, id)) lin.push(`${x.nombre} ${x.pide ? "está pidiendo aquí" : "anda por aquí"}.`);
      if (E.hayQuejas(s, id)) lin.push("Un vecino rezonga: «Otra vez pordioseros por aquí».");
    } else if (v) {
      const partes = [E.GENTE_TXT[v.gente] + (v.pobres && l.dentro ? ", con otros pobres pidiendo" : "")];
      if (v.trabajo) partes.push("cogían peones");
      lin.push(`Lo viste ${v.edad}: ${partes.join(" · ")}.`);
    } else lin.push("No has estado aquí.");
    const ped = pedidoAqui(id);
    if (ped.length) lin.push(`Hoy te han visto pedir aquí (${ped.join(", ")}).`);
    const u = rondaAqui() ? null : rondaUltima();
    if (u && u.lugar === id && !(aqui && s.t < E.FIN)) lin.push(`Aquí viste a la ronda por última vez, ${u.edad}.`);
    h += `<ul class="v-lin">${lin.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    h += `<p class="small muted v-desc">${esc(E.descLugar(s, id))}</p>`;
    const rec = recuerdaDe(id);
    if (rec.length) h += `<div class="v-rec"><b>Lo que recuerdas de aquí</b>${rec.map((x) => `<p class="small">${esc(x)}</p>`).join("")}</div>`;
    return h;
  }
  // en el móvil la tarjeta va encima de la escena: arriba si el sitio del que habla está en la mitad de abajo, para no
  // taparlo (y la ribera, donde empiezas cada día, está abajo)
  const arriba = (id) => (POS[id] ? POS[id][1] > 330 : true);
  function tarjeta(mv) {
    if (s.fase === "resultado") {
      const u = s.ultimo || { titulo: "", lineas: [] };
      return `<div class="v-tarjeta res ${u.tono}${arriba(s.lugar) ? " arriba" : ""}"><div class="v-tit"><h3>${esc(u.titulo)}</h3></div>${u.lineas.map((x) => `<p>${esc(x)}</p>`).join("")}<div class="btns">${btn("seguir", "Seguir", "", { cls: "primary" })}</div></div>`;
    }
    if (ui.sel && L[ui.sel]) return `<div class="v-tarjeta${arriba(ui.sel) ? " arriba" : ""}">${tarjetaSitio(ui.sel, mv)}</div>`;
    if (!load(LS.pista, false)) return `<div class="v-tarjeta pista${arriba(s.lugar) ? " arriba" : ""}"><p>Toca un sitio para ver lo que sabes de él. Tócalo otra vez para ir.</p></div>`;
    return `<div class="v-tarjeta vacia"></div>`;
  }

  // ------------------------------------------------------------------ cabecera y botones
  const pips = (n, max, tope, cls) => Array.from({ length: max }, (_, i) => `<i class="pip ${cls || ""} ${i < n ? "on" : ""} ${tope != null && i >= tope ? "x" : ""}"></i>`).join("");
  function cabecera() {
    const d = E.dia(s);
    const conBarra = s.fase === "dia" || s.fase === "resultado";
    const f = franjaAct();
    const sub = [d.fecha, s.conCadena && s.quien && s.quien.id !== "mozo" ? s.quien.nombre : "", `${s.anio || 1545}`, d.fiesta && d.tipo !== "domingo" ? d.fiesta : d.tipo === "domingo" ? "domingo" : "", E.mercado(s) ? "mercado" : ""].filter(Boolean).join(" · ");
    const est = [
      `<span class="st${s.cuerpo <= 2 ? " mal" : ""}" data-act="verYo"><small>cuerpo</small>${pips(s.cuerpo, P.cuerpoMax, E.cuerpoMax(s), "cuerpo")}</span>`,
      `<span class="st${s.pan === 0 ? " mal" : ""}"><small>pan</small>${pips(s.pan, P.panMax, null, "pan")}</span>`,
      `<span class="st${s.detenciones ? " mal" : ""}"><small>detenciones</small>${pips(s.detenciones, P.detencionesMax, null, "grillete")}</span>`,
      s.conocido ? `<span class="st mal"><small>te conocen</small><svg viewBox="-8 -5 16 10" class="ico"><path d="M-7,0 Q0,-6 7,0 Q0,6 -7,0z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle r="2.2" fill="currentColor"/></svg></span>` : "",
      s.conHurto && s.buscado && s.buscadoSabe ? `<span class="st mal"><small>te busca la justicia</small><b>${Math.min(HU.buscaDias, s.dia - (s.buscadoDia || s.dia) + 1)}/${HU.buscaDias}</b></span>` : "",
    ].join("");
    let barra = "";
    if (conBarra) {
      barra = `<div class="dia-barra" aria-hidden="true">${R.FRANJAS.map((fr, i) => {
        const ratos = Array.from({ length: R.RATOS }, (_, k) => { const t = i * R.RATOS + k; return `<div class="rato ${t < s.t ? "gastado" : t === s.t ? "ahora" : ""}"></div>`; }).join("");
        return `<div><div class="fr ${i === f && s.t < E.FIN ? "act" : ""}">${fr.nombre}</div><div class="ratos">${ratos}</div></div>`;
      }).join("")}</div>`;
    }
    return `<header class="top v-top"><div class="top-in ancho">
      <div class="top-row">
        <div class="top-title">Día ${s.dia} de ${R.DIAS}<span>${esc(sub)}</span></div>
        <div class="top-btns">${s.fase === "dia" || s.fase === "amanecer" || s.fase === "resultado" ? `<button class="icon-btn" data-act="recuerdo">Recuerdos</button>` : ""}<button class="icon-btn" data-act="ayuda" aria-label="Cómo se juega">?</button><button class="icon-btn" data-act="menu" aria-label="Menú">⋯</button></div>
      </div>
      <div class="v-estado">${est}</div>
      ${barra}
    </div></header>`;
  }
  const RELOJ = `<svg viewBox="-6 -6 12 12" class="ico"><circle r="5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M0,-5 A5,5 0 0 1 0,5 Z" fill="currentColor"/></svg>`;
  function barraAcciones(mv) {
    const o = mv.o;
    const pd = o.acc.find((a) => a.id === "pedir");
    const e = s.t < E.FIN ? E.estado(s, s.lugar, s.dia, E.franja(s.t)) : null;
    const r = rondaAqui();
    const tr = o.acc.find((a) => a.id === "trabajo");
    const mitad = s.t % R.RATOS !== 0;
    let h = `<div class="v-barra">`;
    h += btn("pedir", "Pedir aquí", pd.ok ? `1 franja · ${e.da >= 3 ? "mucha gente" : "poca gente"}${r ? " · ¡ronda!" : ""}${mitad ? " · a mitad" : ""}` : pd.porque, { disabled: !pd.ok, cls: "grande " + (pd.ok ? (r ? "riesgo" : "accion") : ""), icono: pd.ok && mitad ? RELOJ : "" });
    if (tr && tr.ok) h += btn("trabajo", "Pedir trabajo", "1 rato · si te cogen, hasta nona", { cls: "accion" });
    const hu = o.acc.find((a) => a.id === "hurtar");
    if (hu && hu.ok) h += btn("hurtar", "Hurtar una hogaza", `${HU.ratos} ratos · ${e.gente >= 3 ? "mucha gente" : "poca gente"}${r ? " · ¡ronda!" : ""}`, { cls: r ? "riesgo" : "" });
    if (s.t < E.FIN) {
      const f = E.franja(s.t), es = o.acc.find((a) => a.id === "esperar");
      h += btn("esperar", f + 1 < R.FRANJAS.length ? `Esperar a ${R.FRANJAS[f + 1].nombre.toLowerCase()}` : "Esperar a la noche", `${es.coste} ${es.coste === 1 ? "rato" : "ratos"}`);
    }
    h += btn("acabar", "Acabar el día", L[s.lugar].dentro ? "en un portal: ronda de noche" : "dormir en la ribera");
    return h + `</div>`;
  }
  function pantallaDia() {
    const mv = movimientos();
    const bloqueado = s.fase === "resultado" && (s.ultimo || {}).tono === "mal";
    let h = `<div class="v-dia${bloqueado ? " bloqueado" : ""}">` + cabecera();
    // la tarjeta va dos veces: sobre la escena (móvil) y en la columna de la derecha (pantalla ancha); el CSS enseña una
    const t = tarjeta(mv);
    h += `<div class="v-main"><div class="v-escena">${escena(mv)}${ui.toast ? `<p class="v-toast">${esc(ui.toast)}</p>` : ""}${t}</div>`;
    h += `<div class="v-lado">${t}${barraAcciones(mv)}</div></div>`;
    return h + `</div>`;
  }

  // ------------------------------------------------------------------ animaciones (solo se ven; no cambian nada)
  function foto() {
    if (!enEscena()) return null;
    return { lugar: s.lugar, dia: s.dia, anio: s.anio, f: franjaAct(), ronda: rondaAqui(), pan: s.pan, llagaPasadas: s.llagaPasadas || 0 };
  }
  function desliza(el, dx, dy, ms) {
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = `transform ${ms}ms ease-in-out`; el.style.transform = "translate(0px, 0px)"; }));
  }
  function animar(a, b) {
    if (!a || !b || a.dia !== b.dia || a.anio !== b.anio) return;
    const svg = app.querySelector(".v-escena svg");
    if (!svg) return;
    // te mueves: andas de un sitio a otro
    if (a.lugar !== b.lugar && POS[a.lugar] && POS[b.lugar]) desliza(svg.querySelector("#yo"), POS[a.lugar][0] - POS[b.lugar][0], POS[a.lugar][1] - POS[b.lugar][1], 520);
    // la ronda llega adonde estás quieto
    else if (b.ronda && b.ronda === b.lugar && a.ronda !== b.ronda) desliza(svg.querySelector("#ronda-aqui"), 90, -10, 650);
    // cambia la luz
    if (a.f !== b.f) {
      const luz = app.querySelector("#luz");
      if (luz) {
        const [c0, o0] = LUZ[a.f], [c1, o1] = LUZ[b.f];
        luz.style.transition = "none"; luz.style.background = c0; luz.style.opacity = `calc(var(--luz-k) * ${o0})`; luz.getBoundingClientRect();
        requestAnimationFrame(() => requestAnimationFrame(() => { luz.style.transition = "background 900ms, opacity 900ms"; luz.style.background = c1; luz.style.opacity = `calc(var(--luz-k) * ${o1})`; }));
      }
    }
    // te dan pan: se ve caer en el hatillo
    if (b.pan > a.pan && POS[b.lugar]) {
      const [x, y] = POS[b.lugar];
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", x - 6); t.setAttribute("y", y - 14); t.setAttribute("class", "mas-pan"); t.setAttribute("text-anchor", "middle");
      t.textContent = `+${b.pan - a.pan}`;
      svg.appendChild(t);
    }
  }

  // ================================================================== las demás pantallas (como en app.js)
  function pruebasVisibles() { return ["A"]; } // la vista solo dibuja la prueba A (calles)
  function pantallaInicio() {
    const nombre = load(LS.nombre, "");
    const enCurso = s && s.fase !== "fin";
    const hist = load(LS.historial, []);
    let h = `<div class="wrap">
      <h1>Liber Vagatorum</h1>
      <p class="muted">Vista 2D (prueba de pantalla) · motor ${esc(R.version)} · vista ${VISTA}</p>
      <p>El mismo juguete, con la ciudad dibujada en vez de escrita. Las reglas son las mismas.</p>
      <p>Al acabar, contesta las preguntas y manda el informe. Cada partida sirve, aunque mueras el primer día.</p>
      <label class="campo" for="nombre">Tu nombre (para el informe)</label>
      <input type="text" id="nombre" value="${esc(nombre)}" autocomplete="name">
      <div class="btns">
        ${enCurso ? btn("continuar", "Seguir la partida en curso", `${s.conCadena ? `${s.anio} · ` : ""}día ${s.dia}${s.conLlaga ? " · con llaga" : ""}${s.conCadena ? " · varios veranos" : s.conTuyos ? " · con los tuyos" : ""}${s.conHurto ? " · con hurtar" : ""}`, { cls: "primary" }) : ""}
        ${load(LS.llaga, false) ? btn("llagaOnOff", "Llaga activada", "La tendrán las partidas que empieces. Toca para quitarla.", { cls: "activo" }) : btn("llagaOnOff", "Activar llaga", "Fingir. Mejor si ya has jugado sin ella.")}
        ${load(LS.cadena, false) ? "" : load(LS.tuyos, false) ? btn("tuyosOnOff", "Con los tuyos", "Las partidas que empieces los tendrán. Toca para quitarlos.", { cls: "activo" }) : btn("tuyosOnOff", "Jugar con los tuyos", "Dos que bajaron contigo. Mejor si ya has jugado sin ellos.")}
        ${load(LS.cadena, false) ? btn("cadenaOnOff", "Varios veranos", "1545, 1553 y 1557, con los tuyos. Toca para jugar uno solo.", { cls: "activo" }) : btn("cadenaOnOff", "Jugar varios veranos", "1545, 1553 y 1557, con los tuyos.")}
        ${load(LS.hurto, false) ? btn("hurtoOnOff", "Hurtar activado", "Lo tendrán las partidas que empieces. Toca para quitarlo.", { cls: "activo" }) : btn("hurtoOnOff", "Activar hurtar", "Coger pan de un puesto, y la justicia.")}
        ${btn("empezar", "Empezar una partida", "", { data: { id: "A" }, cls: enCurso ? "" : "primary" })}
        ${btn("ayuda", "Cómo se juega", "")}
      </div>`;
    if (hist.length) {
      h += `<div class="panel"><h3>Partidas acabadas en este móvil (vista 2D)</h3><div class="btns">`;
      hist.slice().reverse().forEach((x, i) => {
        const idx = hist.length - 1 - i;
        h += `<div><p class="small" style="margin:6px 0 2px">${esc(x.fecha.slice(0, 16).replace("T", " "))} · ${esc(x.final)}</p>
          <div class="fila-btn">${btn("hDescargar", "Descargar informe", "", { cls: "secundario", data: { i: idx } })}${navigator.share ? btn("hCompartir", "Compartir", "", { cls: "secundario", data: { i: idx } }) : btn("hCopiar", "Copiar", "", { cls: "secundario", data: { i: idx } })}</div></div>`;
      });
      h += `</div></div>`;
    }
    return h + `</div>`;
  }

  const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const ANIOS = (n) => ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"][n] || String(n);
  const PREGON = {
    1553: "En la ribera cuentan que este invierno pregonaron en la plaza una pragmática del rey: al vagabundo sano de más de veinte años ya no lo azotan. La primera vez que lo prenden, a la vergüenza y cuatro años de galeras.",
    "1553h": "En la ribera cuentan que este invierno pregonaron en la plaza una pragmática del rey: al vagabundo sano de más de veinte años ya no lo azotan. La primera vez que lo prenden, a la vergüenza y cuatro años de galeras. Y al ladrón, lo mismo desde el primer hurto. A las mujeres las deja fuera de las galeras, para castigarlas conforme a las leyes: para ellas sigue el verdugo.",
    1557: "El año pasado la cosecha fue mala y el pan está carísimo: en la ciudad la gente da poco desde el primer día. En la ribera cuentan que este invierno se llevaron a galeras a varios mozos.",
  };
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
    let h = cabecera() + `<div class="wrap"><h2>Noche del día ${s.dia}</h2>`;
    h += panelNoche(true);
    h += `<div class="panel res mal"><h2>${esc(TIT(r.tipo))}</h2><p>${esc(r.texto)}</p></div><div class="btns">`;
    for (const id of r.candidatos) {
      const tu = s.tuyos.find((t) => t.id === id);
      h += btn("heredero", `Seguir como ${tu.nombre}`, `cuerpo ${tu.cuerpo}/${P.cuerpoMax} · ${tu.pan} ${tu.pan === 1 ? "pedazo" : "pedazos"} · detenciones ${tu.detenciones}/${P.detencionesMax}`, { cls: r.candidatos.length > 1 ? "" : "primary", data: { id } });
    }
    return h + `</div></div>`;
  }
  function pantallaInvierno() {
    const iv = s.invierno, el = E.esHombre(s);
    let h = cabecera() + `<div class="wrap"><h2>La siega de ${iv.anio}</h2>`;
    if (!iv.relevo) h += panelNoche(false);
    h += `<div class="panel">${iv.lineas.map((x) => `<p>${esc(x)}</p>`).join("")}</div>`;
    const como = { hoz: "Con el jornal de la siega pasas el invierno: llegarás a junio con fuerzas y con algo de pan guardado.",
      espiga: "Con lo que espigaste vas tirando el invierno: llegarás a junio con un poco de pan.",
      nada: `Sin siega, el invierno se hace largo: llegarás a junio ${el ? "flaco" : "flaca"} y sin pan.` }[s.siega.yo];
    const vivos = E.tuyosVivos(s).length;
    h += `<div class="panel"><p>Después de la siega ${vivos ? "volvéis" : "vuelves"} a La Armuña. ${esc(como)}</p><p>Pasan ${ANIOS(iv.siguiente - iv.anio)} años.</p></div>`;
    return h + `<div class="btns">${btn("siguienteVerano", `Bajar a Salamanca en junio de ${iv.siguiente}`, "", { cls: "primary" })}</div></div>`;
  }
  function pantallaAmanecer() {
    const d = E.dia(s);
    let h = cabecera() + `<div class="wrap">`;
    h += `<h2>${esc(d.fecha[0].toUpperCase() + d.fecha.slice(1))}</h2>`;
    if (s.dia === 1 && !s.noche && !s.verano) {
      h += `<p>Eres un mozo de La Armuña. Has bajado a Salamanca porque en tu aldea no queda pan hasta la siega. Duermes en la ribera del Tormes, fuera de la muralla.</p>
        ${s.conTuyos ? `<p>No has bajado solo: contigo vinieron Pedro y Catalina, de tu misma aldea. Duermen en la ribera, como tú.</p>` : ""}
        <p>Desde la orden de pobres del año pasado, en la ciudad está prohibido pedir. Pero el pan está dentro, y no hay otra manera de comer.</p>
        <p><b>Aguanta diez días.</b> El 11 de junio empieza la siega, y en la siega hay trabajo para quien pueda con la hoz.</p>`;
    } else if (s.dia === 1 && !s.noche) h += introVerano();
    if (s.noche) h += `<div class="panel${s.noche.detenido ? " res mal" : ""}"><h3>${s.noche.detenido ? (E.esHombre(s) ? "La noche: detenido" : "La noche: detenida") : "La noche"}</h3>${s.noche.lineas.map((x) => `<p>${esc(x)}</p>`).join("")}<p>Cuerpo: ${s.noche.antes} → <b>${s.noche.despues}</b>.</p></div>`;
    const notas = [];
    if (d.tipo === "domingo") notas.push(`Es domingo${d.fiesta && d.fiesta !== "Domingo" ? " de " + d.fiesta : ""}: no hay obra. Las iglesias se llenan a prima y a tercia; la plaza está tranquila.`);
    if (d.tipo === "corpus") notas.push("Es Corpus Christi: procesión por la Rúa y la plaza a tercia y a sexta, y la ronda va con ella. No hay obra.");
    if (E.mercado(s)) notas.push("Es jueves, día de mercado: la plaza está llena de puestos hasta nona.");
    if (s.dia === E.escasezDesde(s) && s.dia > 1) notas.push("El pan ha subido en la plaza. Desde hoy, la gente da menos.");
    if (s.yaNoBuscan) notas.push("Han pasado tres días de aquello. En la plaza ya han dado otras señas: por las tuyas no pregunta nadie.");
    if (s.lugar === "puerta" && s.cronica.some((c) => c.dia === s.dia - 1 && c.anio === s.anio && c.tipo === "prendido")) notas.push("Después, te sueltan en la Puerta del Río.");
    else if (s.lugar === "puerta" && s.cronica.some((c) => c.dia === s.dia - 1 && c.anio === s.anio && c.tipo === "detenido")) notas.push("Te sueltan al amanecer en la Puerta del Río.");
    else if (L[s.lugar].dentro) notas.push(`Te despiertas en un portal de ${L[s.lugar].nombre}.`);
    else notas.push("Te despiertas en la ribera.");
    h += `<div class="panel">${notas.map((x) => `<p>${esc(x)}</p>`).join("")}</div>`;
    return h + `<div class="btns">${btn("empezarDia", "Empezar el día", "", { cls: "primary" })}</div></div>`;
  }
  function pantallaNoche() {
    let h = cabecera() + `<div class="wrap"><h2>Noche del día ${s.dia}</h2>`;
    if (s.duerme === "carcel") return h + `<div class="panel res mal"><p>Duermes en la cárcel. El pan te lo han quitado.</p></div><div class="btns">${btn("cenar", "Seguir", "", { cls: "primary", data: { n: 0 } })}</div></div>`;
    const donde = s.duerme === "portal" ? `Duermes en un portal de ${L[s.lugar].nombre}, dentro de la muralla.` : `${s.bajaRibera ? (s.bajaDe === "puente" ? "En el puente no se puede dormir: toda la noche pasan carros y el portazguero echa a los que se tumban. Bajas a la ribera. " : "En la orilla no hay donde echarse. Bajas a la ribera. ") : ""}Duermes al raso en la ribera, fuera de la muralla.`;
    const fiebre = s.llaga && s.llaga === s.dia;
    h += `<div class="panel"><p>${esc(donde)}</p><p>Tienes <b>${s.pan}</b> ${s.pan === 1 ? "pedazo" : "pedazos"} de pan. Una ración son 2 pedazos. Puedes guardar hasta ${P.panMax}.</p>${s.trabajoHoy ? `<p>Estás molido del trabajo: −${P.trabajo.cansancio} de cuerpo esta noche.</p>` : ""}</div>`;
    if (E.puedeLlaga(s)) {
      const viejo = s.viejo === 1
        ? "Junto al fuego, un viejo se descubre la pierna: una llaga abierta, en carne viva. «Esta me da de comer. Ranúnculo y sal, un trapo sucio encima, y no dejarla cerrar nunca.»"
        : "El viejo de la llaga duerme a tu lado, con la pierna al aire.";
      h += `<div class="panel"><p>${esc(viejo)}</p></div><div class="btns">${btn("llaga", "Hacerte una llaga como la suya", "no la dejarás cerrar")}</div>`;
    } else if (fiebre) {
      h += `<div class="panel res mal"><p>Te frotas la pierna con ranúnculo y sal hasta que se abre la carne. Arde. El viejo te ata un trapo encima.</p><p>Esta noche, fiebre: −${-P.llaga.cuerpo} de cuerpo.</p></div>`;
    }
    for (const x of s.nocheTuyos || []) {
      h += `<div class="panel">${x.lineas.map((l) => `<p>${esc(l)}</p>`).join("")}${x.dado ? `<p class="small">Le has dado ${x.dado === 1 ? "un pedazo" : x.dado + " pedazos"}.</p>` : ""}</div>`;
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
      h += `<div class="panel res ${fc.hasta > fc.desde ? "bien" : "mal"}"><h2>${esc(tit)}</h2><p>${esc(s.final.texto)}</p></div>`;
      h += `<div class="panel"><h3>Tu gente</h3>${E.resumenCadena(s).map((x) => `<p class="small">${esc(x)}</p>`).join("")}<p class="small muted">En este juguete, la historia de Salamanca acaba en ${R.VERANOS[R.VERANOS.length - 1].anio}.</p></div>`;
    } else {
      h += `<div class="panel res ${s.final.tipo === "siega" ? "bien" : "mal"}"><h2>${esc(TIT(s.final.tipo))}</h2><p>${esc(s.final.texto)}</p><p class="small">Día ${s.final.dia}</p></div>`;
    }
    h += `<div class="panel"><h3>Tu partida</h3>
      <p class="small">Tiempo: moverte ${pct(T.mover)} · pedir ${pct(T.pedir)} · trabajar ${pct(T.trabajar)}${s.conHurto ? ` · hurtar ${pct(T.hurtar)}` : ""} · esperar ${pct(T.esperar + T.perdido)}.</p>
      <p class="small">${T.pasos} ${T.pasos === 1 ? "paso" : "pasos"} · pediste ${T.pedidas} veces (${T.panPedido} pedazos) · llegaste ${T.encuentros} ${T.encuentros === 1 ? "vez" : "veces"} donde estaba la ronda · ${s.detenciones} ${s.detenciones === 1 ? "detención" : "detenciones"}${s.conHurto ? ` · hurtaste ${T.hurtos} ${T.hurtos === 1 ? "vez" : "veces"} (${T.panHurtado} pedazos)` : ""}.</p></div>`;
    h += `<div class="panel"><h3>Unas preguntas</h3><p class="small muted">Van en el informe. Contesta con lo que te salga; no hay respuestas buenas.</p>
      <label class="campo" for="e_plano">¿Qué no supiste leer en el plano? ¿Qué tuviste que tocar para entenderlo?</label><textarea id="e_plano" data-enc="plano">${esc(enc.plano)}</textarea>
      <label class="campo" for="e_dolio">¿Qué decisión te dolió o te costó tomar?</label><textarea id="e_dolio" data-enc="dolio">${esc(enc.dolio)}</textarea>
      <label class="campo" for="e_ir">¿Cómo decidías adónde ir?</label><textarea id="e_ir" data-enc="ir">${esc(enc.ir)}</textarea>
      <label class="campo" for="e_sorpresa">Si la ronda te sorprendió alguna vez, ¿lo sentiste como una mala decisión tuya o como mala suerte?</label><textarea id="e_sorpresa" data-enc="sorpresa">${esc(enc.sorpresa)}</textarea>
      <label class="campo" for="e_sobro">¿Qué sobraba, estorbaba o no entendiste?</label><textarea id="e_sobro" data-enc="sobro">${esc(enc.sobro)}</textarea>
      ${s.conCadena ? `<label class="campo" for="e_cadena">¿Pesó en lo que hacías saber que, si morías con uno de los tuyos al lado, seguirías como él o ella?</label><textarea id="e_cadena" data-enc="cadena">${esc(enc.cadena)}</textarea>` : ""}
      ${s.conHurto ? `<label class="campo" for="e_hurto">¿Cuándo decidiste hurtar, o no hacerlo, y por qué?</label><textarea id="e_hurto" data-enc="hurto">${esc(enc.hurto)}</textarea>` : ""}
      <label class="campo" for="e_otros">Otros comentarios (opcional)</label><textarea id="e_otros" data-enc="otros">${esc(enc.otros)}</textarea>
      <div class="btns" style="margin-top:12px">
        ${navigator.share ? btn("compartir", "Compartir informe", "Elige tu correo y envíalo", { cls: "primary" }) : ""}
        ${btn("correo", "Abrir el correo con el resumen", `Para: ${R.CONFIG.email}. Adjunta el informe descargado.`, { cls: navigator.share ? "" : "primary" })}
        <div class="fila-btn">${btn("descargar", "Descargar", "", { cls: "secundario" })}${btn("copiar", "Copiar", "", { cls: "secundario" })}</div>
      </div></div>`;
    return h + `<div class="btns">${btn("nueva", "Volver al inicio", "Para jugar otra partida")}</div></div>`;
  }

  // ------------------------------------------------------------------ ayuda, Recuerdos y menú
  // lo que se ve en el plano, dibujado (sustituye a la leyenda del mapa)
  function leyenda() {
    const fila = (svg, txt) => `<div class="ley-fila"><svg viewBox="-24 -46 76 54">${svg}</svg><span>${txt}</span></div>`;
    const yoSvg = peg(0, 0, { c: "var(--f-yo)", k: 1.25, borde: "var(--surface)" }) + `<circle cx="5.5" cy="-13" r="3" fill="var(--f-hatillo)"/>`;
    return `<div class="leyenda-v">
      ${fila(yoSvg, "Tú, con el hatillo. Tocas un sitio para ver lo que sabes de él; lo tocas otra vez para ir.")}
      ${fila(ronda(0, 0, true), "La ronda: el alguacil y sus corchetes. Si la ves, con «!». Donde la viste por última vez, más clara.")}
      ${fila(gente(-10, 0) + gente(0, -4) + gente(10, 0), "Gente que da: tres muñecos, poca; siete, mucha. Uno claro, gente de paso que no da.")}
      ${fila(pobre(-6, 0) + pobre(8, 0), "Otros pobres pidiendo: os repartís lo que hay.")}
      ${fila(tuyo(-6, 0, "Pedro", false) + tuyo(10, 0, "Catalina", true), "Los tuyos, cuando coincidís: de pie o pidiendo.")}
      ${fila(vecino(-6, -12, true) + vecino(14, -12, false), "Un vecino asomado: alguien se ha quejado. En rojo, te vieron pedir ahí hoy.")}
      ${fila(vigia(0, 0), "Alguien que mira: ahí avisan enseguida a la ronda.")}
      ${fila(capataz(0, 0), "El capataz: las obras cogen peones.")}
      ${fila(`<g opacity="0.4">${gente(-10, 0) + gente(0, -4) + gente(10, 0)}</g>`, "Lo que no ves ahora, más claro: es de cuando lo viste. Un sitio sin nadie dibujado y con el borde a trazos, no lo has visto.")}
    </div>`;
  }
  function ayudaHtml() {
    const conCadena = s && ui.pantalla === "juego" ? !!s.conCadena : load(LS.cadena, false);
    const conHurto = s && ui.pantalla === "juego" ? !!s.conHurto : load(LS.hurto, false);
    const anio = s && ui.pantalla === "juego" && s.anio ? s.anio : 1545;
    const cal = s && ui.pantalla === "juego" ? E.calendario(s) : R.CALENDARIO;
    const fiestas = cal.filter((d) => d.tipo !== "laborable" || d.mercado).map((d) => (d.tipo === "corpus" ? `El ${d.fecha.split(" ")[0]} ${d.dia} es Corpus Christi` : d.tipo === "laborable" ? `El jueves ${d.dia} hay mercado` : `El ${d.dia}, domingo${d.fiesta && d.fiesta !== "Domingo" ? " de " + d.fiesta : ""}`));
    const fiestasTxt = fiestas.map((x, i) => (i ? x.replace(/^El/, "el") : x)).join("; ") + ".";
    return `<div class="modal-in"><h2>Cómo se juega</h2>
      <p>Eres ${s && ui.pantalla === "juego" && !E.esHombre(s) ? "una pobre" : "un pobre"} de La Armuña, en la Tierra de Salamanca, y has bajado a la ciudad en junio de ${anio}. Desde la orden de pobres ${anio === 1545 ? "del año pasado" : "de 1544"}, pedir en la ciudad está prohibido. Duermes fuera de la muralla, en la ribera; el pan está dentro. <b>Objetivo: aguantar diez días, hasta la siega.</b> En la siega cogen segadores, pero no a cualquiera: quieren brazos que puedan con la hoz.</p>
      <h3>Lo que ves en el plano</h3>${leyenda()}
      <h3>El día</h3><p>Seis franjas, de prima a completas, de seis ratos cada una. Pedir ocupa una franja entera. Al acabar completas cierran las puertas de la muralla: quien se queda dentro duerme en un portal.</p>
      <h3>Moverte</h3><p>Cada paso a un sitio vecino cuesta 2 ratos (tres pasos, una franja). Solo ves el sitio donde estás, y la ronda igual: solo te ve si estáis en el mismo sitio.</p>
      <h3>Lo que ves</h3><p>La gente, los otros pobres y la ronda cambian al empezar cada franja. Lo que viste vale para la franja en que lo viste. En «Recuerdos» tienes dónde y cuándo has visto a la ronda, y dónde has pedido tú.</p>
      <h3>Pedir</h3><p>Solo dentro de la muralla y donde hay gente que dé. Con mucha gente suele caer algo; con poca, muchas veces nada; si hay otros pobres pidiendo, os repartís lo que hay. Desde el día ${P.escasezDesde}, el pan sube y la gente da menos.</p>
      <p>Quien te ve pedir puede avisar a la ronda, y la ronda suele ir luego allí. En la Puerta del Río, las Escuelas y San Martín avisan enseguida; en San Esteban, nadie.</p>
      <h3>La ronda</h3><p>Un alguacil con sus corchetes. Tiene sus costumbres, que no son las mismas cada verano; a veces se desvía, acude adonde le avisan y a sexta se va a comer.</p>
      <p>Si te ve pedir, te detiene (con mucha gente, a veces no te ve). Si llegas a donde está, puede pararte: la primera vez te echa de la ciudad y te queda fichado; si ya te tiene fichado, te detiene. Si estás quieto cuando llega, no te para, pero no pidas delante de ella. Si empiezas a pedir a mitad de franja, puede llegar mientras pides.</p>
      <h3>Detenciones</h3><p>Noche en la cárcel y te quitan el pan. La segunda vez, además, azotes. La tercera, destierro: se acaba la partida. Te pueden detener pidiendo, al llegar a donde está la ronda si ya te tiene fichado, o de noche si duermes dentro de la muralla.</p>
      <p><b>Fichado</b> quiere decir que la ronda ya te conoce la cara (te echó de la ciudad o te detuvo). No es una detención, pero desde entonces, si te para, te detiene.</p>
      <h3>Trabajar</h3><p>Las obras de la catedral cogen peones a prima los días de trabajo. Si te cogen, cargas piedra hasta el final de nona por ${P.trabajo.paga} pedazos de pan.</p>
      <h3>Dormir dentro</h3><p>Ahorra el camino de vuelta, pero de noche también hay ronda.</p>
      <h3>Los tuyos</h3><p>Si juegas con ellos: Pedro y Catalina bajaron contigo de tu aldea. Viven como tú: piden, se esconden de la ronda y duermen en la ribera. Si dormís allí, de noche te cuentan lo que han visto, y el que no ha sacado para cenar te pide pan. Lo que te cuentan queda en «Recuerdos».</p>
      <h3>La noche</h3><p>Una ración son 2 pedazos de pan. Ración entera: +1 de cuerpo. Media: −1. Nada: −2. Puedes guardar hasta ${P.panMax} pedazos. Si el cuerpo llega a 0, mueres.</p>
      ${conCadena ? `<h3>Varios veranos</h3><p>Después de 1545 vienen 1553 y 1557, con años de por medio. Si mueres y uno de los tuyos ha dormido a tu lado esa noche, sigues como él o ella el verano siguiente (si estaban los dos, eliges). Si mueres solo, se acaba. Si te destierran, sigue uno de los tuyos. Lo que sacas en la siega decide cómo llegas al verano siguiente. En «Recuerdos» quedan los veranos anteriores.</p>` : ""}
      ${conHurto ? `<h3>Hurtar</h3><p>En la Plaza y en la Rúa, cuando hay mercado o tienda abierta, puedes coger una hogaza de un puesto: ${HU.gana} pedazos en ${HU.ratos} ratos. No te vigila la ronda de pobres: te ve el dueño o el vecino. Con poca gente te ven más; con mucha, menos. Si te ven con mucha gente, te sujetan allí mismo; con poca, escapas con el pan, pero dan tus señas y la justicia te busca ${HU.buscaDias} días: si en esos días la ronda te para o te encuentra de noche en un portal, te entrega. Si hurtas con la ronda delante, te coge ella.</p>
      <p>La justicia no es la ronda y lleva su cuenta aparte de las detenciones. Te quita lo que llevas y pasas la noche en su cárcel. Lo que viene después te lo dice el alcalde cuando te tiene delante.</p>` : ""}
      <h3>Lo que sabe cualquiera en Salamanca</h3><p>Las iglesias se llenan a la hora de misa (prima) y a vísperas. El mercado de la plaza, por la mañana; los jueves de mercado, hasta nona. Los estudiantes salen a tercia y a nona. A vísperas, la gente pasea por la Rúa. ${esc(fiestasTxt)}</p>
      <h3>Licencias históricas</h3><ul class="small">${R.LICENCIAS.concat(conHurto ? R.LICENCIAS_HURTO.filter((x) => conCadena || !x.startsWith("Desde la pragmática de 1552")) : [], conCadena ? R.LICENCIAS_CADENA : []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="small muted">El plano es un dibujo de la Salamanca de entonces, más o menos: los sitios están donde estaban, pero no a escala.</p>
      <div class="btns">${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div></div>`;
  }
  function recuerdoHtml() {
    const corto = (d) => E.dia(s, d).fecha.split(" de ")[0];
    const vistas = s.vistas || [];
    let h = `<div class="modal-in"><h2>Lo que recuerdas</h2><p class="small muted">No lo llevas escrito: es lo que has visto con tus ojos.</p><h3>Dónde has visto a la ronda</h3>`;
    if (!vistas.length) h += `<p>Todavía no la has visto.</p>`;
    else {
      h += `<ul class="ciudad">`;
      R.FRANJAS.forEach((fr, f) => {
        const porLugar = {};
        vistas.filter((v) => v.f === f).forEach((v) => (porLugar[v.lugar] = porLugar[v.lugar] || []).push(v.dia));
        const items = Object.entries(porLugar).sort((a, b) => b[1].length - a[1].length).map(([l, dias]) => `<b>${esc(L[l].corto)}</b> (${dias.map(corto).join(", ")})`);
        h += `<li><b>${fr.nombre}:</b> ${items.length ? items.join(" · ") : `<span class="muted">no la has visto</span>`}</li>`;
      });
      h += `</ul>`;
    }
    const pedidas = s.cronica.filter((c) => (c.tipo === "pedir" || c.tipo === "pillado") && c.anio === s.anio);
    if (pedidas.length) {
      h += `<h3>Dónde has pedido</h3><ul class="ciudad">`;
      R.FRANJAS.forEach((fr, f) => {
        const porLugar = {};
        pedidas.filter((c) => E.franja(c.t) === f).forEach((c) => { const d = (porLugar[c.lugar] = porLugar[c.lugar] || []); if (!d.includes(c.dia)) d.push(c.dia); });
        const items = Object.entries(porLugar).sort((a, b) => b[1].length - a[1].length).map(([l, dias]) => `<b>${esc(L[l].corto)}</b> (${dias.map(corto).join(", ")})`);
        if (items.length) h += `<li><b>${fr.nombre}:</b> ${items.join(" · ")}</li>`;
      });
      h += `</ul>`;
    }
    const contado = (s.contado || []).filter((x) => x.ronda);
    if (s.conTuyos) {
      h += `<h3>Lo que te han contado</h3>`;
      if (!contado.length) h += `<p>Todavía nadie te ha dicho dónde estaba la ronda.</p>`;
      else {
        h += `<ul class="ciudad">`;
        R.FRANJAS.forEach((fr, f) => {
          const items = contado.filter((x) => x.f === f).map((x) => `<b>${esc(L[x.lugar].corto)}</b> (${esc(x.quien)}, ${corto(x.dia)}${x.oidas ? ", de oídas" : ""})`);
          if (items.length) h += `<li><b>${fr.nombre}:</b> ${items.join(" · ")}</li>`;
        });
        h += `</ul>`;
      }
    }
    const malos = s.cronica.filter((c) => (c.tipo === "echado" || c.tipo === "detenido" || c.tipo === "obras") && c.anio === s.anio);
    if (malos.length) h += `<h3>Dónde te ha parado</h3><ul class="ciudad">${malos.map((c) => `<li>${esc(corto(c.dia))}, ${esc(E.momentoTxt(c.t).split(" ")[0].toLowerCase())}: ${esc(c.texto)}</li>`).join("")}</ul>`;
    for (const a of ((s.cadena || {}).archivo || []).slice().reverse()) {
      const yoMismo = a.quien && s.quien && a.quien.id === s.quien.id;
      const vio = yoMismo ? "tú" : a.quien.nombre;
      const rr = {};
      const pon = (x, quien) => { const k = `${x.f}|${x.lugar}`; (rr[k] = rr[k] || { f: x.f, lugar: x.lugar, dias: new Set(), quien: new Set() }).dias.add(x.dia); rr[k].quien.add(quien); };
      a.vistas.forEach((x) => pon(x, vio));
      a.contado.forEach((x) => pon(x, x.quien));
      if (a.heredero) a.heredero.vistas.forEach((x) => pon(x, a.heredero.id === (s.quien || {}).id ? "tú" : a.heredero.nombre));
      h += `<h3>Verano de ${a.anio}</h3>`;
      const lin = [];
      R.FRANJAS.forEach((fr, f) => {
        const items = Object.values(rr).filter((x) => x.f === f).sort((x, y) => y.dias.size - x.dias.size).map((x) => `<b>${esc(L[x.lugar].corto)}</b> (${x.dias.size} ${x.dias.size === 1 ? "día" : "días"})`);
        if (items.length) lin.push(`<li><b>${fr.nombre}:</b> ${items.join(" · ")}</li>`);
      });
      h += lin.length ? `<p class="small">Dónde se vio a la ronda:</p><ul class="ciudad">${lin.join("")}</ul>` : `<p class="small">Nadie vio a la ronda.</p>`;
      const ped = [];
      R.FRANJAS.forEach((fr, f) => {
        const por = {};
        a.pedidas.filter((x) => x.f === f).forEach((x) => { (por[x.lugar] = por[x.lugar] || new Set()).add(x.dia); });
        const items = Object.entries(por).sort((x, y) => y[1].size - x[1].size).map(([l, ds]) => `<b>${esc(L[l].corto)}</b> (${ds.size} ${ds.size === 1 ? "día" : "días"})`);
        if (items.length) ped.push(`<li><b>${fr.nombre}:</b> ${items.join(" · ")}</li>`);
      });
      if (ped.length) h += `<p class="small">Dónde ${yoMismo ? "pedías" : `pedía ${esc(a.quien.nombre)}`}:</p><ul class="ciudad">${ped.join("")}</ul>`;
    }
    return h + `<div class="btns">${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div></div>`;
  }
  function menuHtml() {
    const enJuego = s && ui.pantalla === "juego" && s.fase !== "fin";
    return `<div class="modal-in"><h2>Menú</h2><div class="menu-list">
      ${btn("ayuda", "Cómo se juega", "")}
      ${btn("tema", "Cambiar tema", "Claro, oscuro o el del móvil")}
      ${btn("inicio", "Ir al inicio", "La partida se guarda")}
      ${enJuego ? btn("abandonar", "Abandonar la partida", "Acaba aquí y puedes mandar el informe") : ""}
      ${btn("cerrar", "Cerrar", "", { cls: "primary" })}
    </div></div>`;
  }
  function abrirModal(html) { modal.innerHTML = html; modal.hidden = false; }
  function cerrarModal() { modal.hidden = true; modal.innerHTML = ""; }

  // ------------------------------------------------------------------ informes
  // el del motor, con lo de la vista delante: cuántos toques y la pregunta del plano
  function informeVista(x) {
    const lin = E.informe(x).split("\n");
    const v = x.vt || {};
    // los pasos de los días acabados y, si la partida se dejó a medio día, los de ese día
    const pasos = E.resumenDias(x).pasos + (x.hoy && !x.porDia.some((d) => d.dia === x.dia && d.anio === x.anio) ? x.hoy.pasos || 0 : 0);
    const extra = [
      `Vista 2D (rama claude/vista, vista ${VISTA}).`,
      `Toques: ir ${v.ir || 0} (con el segundo toque en el sitio ${v.irToque || 0}, con el botón «Ir» ${v.irBoton || 0}) · pasos que contó el motor ${pasos} · abrir un vecino ${v.vecino || 0} · abrir tu sitio ${v.aqui || 0} · abrir otro sitio ${v.otro || 0} · tocar un muñeco ${v.muneco || 0} · cerrar la tarjeta ${v.cerrar || 0} · acciones ${v.accion || 0} · Recuerdos ${x.recuerdaAbierto || 0}.`,
      `Qué no supo leer en el plano: ${(x.encuesta || {}).plano || "—"}`,
    ];
    lin.splice(1, 0, ...extra);
    return lin.join("\n");
  }
  function nombreArchivo(jug, fecha) {
    const limpio = (jug || "anonimo").normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "anonimo";
    return `liber-vista2d-${limpio}-${(fecha || "").slice(0, 16).replace(/[:T]/g, "-")}.txt`;
  }
  function informeActual() {
    return { texto: informeVista(s), nombre: nombreArchivo(s.jugador, s.empezada), resumen: `${s.jugador || "Anónimo"} jugó la vista 2D. Final: ${finalCorto(s)}.` };
  }
  function descargar(texto, nombre) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function compartir(texto, nombre, resumen) {
    try {
      const file = new File([texto], nombre, { type: "text/plain" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: "Liber Vagatorum · informe", text: resumen + " Para: " + R.CONFIG.email });
      else await navigator.share({ title: "Liber Vagatorum · informe", text: texto });
    } catch (e) { if (e && e.name !== "AbortError") abrirModal(`<div class="modal-in"><p>No se ha podido compartir. Prueba a descargar el informe.</p>${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div>`); }
  }
  function copiar(texto) {
    const ok = () => abrirModal(`<div class="modal-in"><p>Informe copiado. Pégalo en un correo a ${esc(R.CONFIG.email)}.</p>${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div>`);
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(ok, () => descargar(texto, "informe.txt"));
    else descargar(texto, "informe.txt");
  }
  function finalCorto(x) {
    if (!x.final) return "sin acabar";
    if (x.final.cadena) return `tu gente, de ${x.final.cadena.desde} a ${x.final.cadena.hasta}`;
    return `${E.FINALES[x.final.tipo] || x.final.tipo}, día ${x.final.dia}`;
  }
  function guardarEnHistorial() {
    if (!s || !s.final || s.enHistorial) return;
    const hist = load(LS.historial, []);
    hist.push({ fecha: s.empezada, final: finalCorto(s), informe: informeVista(s), jugador: s.jugador });
    while (hist.length > 12) hist.shift();
    store(LS.historial, hist);
    s.enHistorial = true;
  }
  function actualizarHistorial() {
    if (!s || !s.enHistorial) return;
    const hist = load(LS.historial, []);
    const x = hist.find((h) => h.fecha === s.empezada);
    if (x) { x.informe = informeVista(s); store(LS.historial, hist); }
  }

  // ------------------------------------------------------------------ acciones
  // tras un resultado que no es malo, lo siguiente que hagas sigue la partida (como pulsar «Seguir»)
  function seguirSiCabe() {
    if (s.fase !== "resultado") return true;
    if ((s.ultimo || {}).tono === "mal") return false;
    E.seguir(s);
    return s.fase === "dia";
  }
  function ir(id, como) {
    if (!seguirSiCabe()) return;
    const mv = E.opciones(s).movs.find((m) => m.destino === id && m.ok);
    if (!mv) return;
    cuenta("ir"); cuenta(como);
    E.mover(s, id); E.comprobarNoche(s);
    ui.sel = null; ui.fig = null;
    if (!load(LS.pista, false)) store(LS.pista, true);
  }
  const conAccion = (fn) => (d) => { if (!seguirSiCabe()) return; cuenta("accion"); ui.sel = null; ui.fig = null; fn(d); };
  const ACC = {
    empezar(d) {
      const nombre = (document.getElementById("nombre") || {}).value || "";
      store(LS.nombre, nombre.trim());
      if (s && s.fase !== "fin" && !confirm("Hay una partida a medias. ¿Empezar otra? La de ahora se perderá.")) return;
      const sem = new URLSearchParams(location.search).get("semilla");
      s = E.nueva("A", nombre.trim(), sem || null, { llaga: load(LS.llaga, false), tuyos: load(LS.tuyos, false), cadena: load(LS.cadena, false), hurto: load(LS.hurto, false) });
      ui.pantalla = "juego"; ui.sel = null; ui.fig = null; antes = null;
    },
    cadenaOnOff() { guardaNombre(); store(LS.cadena, !load(LS.cadena, false)); },
    llagaOnOff() { guardaNombre(); store(LS.llaga, !load(LS.llaga, false)); },
    tuyosOnOff() { guardaNombre(); store(LS.tuyos, !load(LS.tuyos, false)); },
    hurtoOnOff() { guardaNombre(); store(LS.hurto, !load(LS.hurto, false)); },
    heredero(d) { E.elegirHeredero(s, d.id); if (s.fase === "fin") guardarEnHistorial(); },
    siguienteVerano() { E.siguienteVerano(s); },
    continuar() { ui.pantalla = "juego"; },
    empezarDia() { E.empezarJornada(s); ui.sel = null; ui.fig = null; },
    ir(d) { ir(d.id, "irBoton"); },
    pedir: conAccion(() => E.pedir(s)),
    hurtar: conAccion(() => { E.hurtar(s); E.comprobarNoche(s); }),
    trabajo: conAccion(() => E.pedirTrabajo(s)),
    esperar: conAccion(() => { E.esperar(s); E.comprobarNoche(s); }),
    acabar: conAccion(() => { E.acabarDia(s); E.comprobarNoche(s); }),
    seguir() { E.seguir(s); },
    cerrarTarjeta() { cuenta("cerrar"); ui.sel = null; ui.fig = null; },
    verYo() { if (!enEscena()) return "nada"; ui.sel = s.lugar; ui.fig = "yo"; cuenta("muneco"); },
    cenar(d) { E.cenar(s, +d.n || 0); if (s.fase === "fin") guardarEnHistorial(); },
    llaga() { E.hacerLlaga(s); },
    dar(d) { E.darPan(s, d.id, +d.n || 1); },
    nueva() { ui.pantalla = "inicio"; },
    inicio() { cerrarModal(); ui.pantalla = "inicio"; },
    ayuda() { abrirModal(ayudaHtml()); return "modal"; },
    recuerdo() { s.recuerdaAbierto = (s.recuerdaAbierto || 0) + 1; store(LS.partida, s); abrirModal(recuerdoHtml()); return "modal"; },
    menu() { abrirModal(menuHtml()); return "modal"; },
    cerrar() { cerrarModal(); return "modal"; },
    tema() {
      const orden = ["auto", "light", "dark"];
      const t = orden[(orden.indexOf(load(LS.tema, "auto")) + 1) % 3];
      store(LS.tema, t); aplicarTema(); return "modal";
    },
    abandonar() {
      if (!confirm("¿Abandonar la partida? Podrás mandar el informe de lo jugado.")) return "modal";
      cerrarModal();
      s.final = { tipo: "abandona", dia: s.dia, texto: "Abandonas la partida." };
      s.fase = "fin";
      guardarEnHistorial();
    },
    compartir() { actualizarHistorial(); const i = informeActual(); compartir(i.texto, i.nombre, i.resumen); return "nada"; },
    descargar() { actualizarHistorial(); const i = informeActual(); descargar(i.texto, i.nombre); return "nada"; },
    copiar() { actualizarHistorial(); copiar(informeActual().texto); return "nada"; },
    correo() {
      actualizarHistorial();
      const i = informeActual();
      const cuerpo = `${i.resumen}\n\n(Adjunta el informe descargado: ${i.nombre})\n\n` + i.texto.split("== Dónde estuvo la ronda")[0];
      location.href = `mailto:${R.CONFIG.email}?subject=${encodeURIComponent("Liber Vagatorum · vista 2D · informe de " + (s.jugador || "anónimo"))}&body=${encodeURIComponent(cuerpo.slice(0, 6000))}`;
      return "nada";
    },
    hDescargar(d) { const x = load(LS.historial, [])[+d.i]; if (x) descargar(x.informe, nombreArchivo(x.jugador, x.fecha)); return "nada"; },
    hCompartir(d) { const x = load(LS.historial, [])[+d.i]; if (x) compartir(x.informe, nombreArchivo(x.jugador, x.fecha), `${x.jugador || "Anónimo"} · vista 2D · ${x.final}.`); return "nada"; },
    hCopiar(d) { const x = load(LS.historial, [])[+d.i]; if (x) copiar(x.informe); return "nada"; },
  };
  function guardaNombre() {
    const nombre = (document.getElementById("nombre") || {}).value;
    if (nombre != null) store(LS.nombre, nombre.trim()); // que no se pierda lo escrito al repintar
  }
  // tocar la escena: un sitio (o algo dentro de él) lo abre; tocar otra vez el sitio abierto, si es vecino, te lleva
  function tocarEscena(ev) {
    const fig = ev.target.closest("[data-fig]");
    const sitio = ev.target.closest("[data-lugar]");
    if (!sitio) { if (ui.sel || ui.fig) { ui.sel = null; ui.fig = null; return true; } return false; }
    const id = sitio.dataset.lugar;
    if (s.fase === "resultado" && (s.ultimo || {}).tono === "mal") return false;
    const vecino = E.opciones(s).movs.some((m) => m.destino === id && m.ok);
    if (ui.sel === id && vecino && id !== s.lugar) { ir(id, "irToque"); return true; }
    if (!seguirSiCabe()) return true;
    ui.sel = id;
    ui.fig = fig ? fig.dataset.fig : null;
    cuenta(fig && fig.dataset.fig !== "gente" ? "muneco" : id === s.lugar ? "aqui" : vecino ? "vecino" : "otro");
    return true;
  }

  function aplicarTema() {
    const t = load(LS.tema, "auto");
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  function render() {
    let h;
    const dia = enEscena();
    // la llaga: lo que pasa al cruzarte con la ronda lo dice una línea que se va sola
    const f0 = foto();
    ui.toast = f0 && antes && f0.llagaPasadas > antes.llagaPasadas && s.aviso ? s.aviso.texto : null;
    if (!s || ui.pantalla === "inicio") h = pantallaInicio();
    else if (s.fase === "amanecer") h = pantallaAmanecer();
    else if (s.fase === "noche") h = pantallaNoche();
    else if (s.fase === "relevo") h = pantallaRelevo();
    else if (s.fase === "invierno") h = pantallaInvierno();
    else if (s.fase === "fin") h = pantallaFin();
    else h = pantallaDia();
    const ahora = foto();
    document.body.classList.toggle("v-en-dia", !!dia);
    app.innerHTML = h;
    const clave = (ui.pantalla || "") + "|" + (s ? s.fase + "|" + (s.anio || "") + "|" + s.dia : "");
    if (clave !== faseAntes && !dia) window.scrollTo(0, 0);
    faseAntes = clave;
    if (dia) animar(antes, ahora);
    antes = ahora;
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (el && !el.disabled) {
      const fn = ACC[el.dataset.act];
      if (!fn) return;
      const r = fn(Object.assign({}, el.dataset));
      if (r === "nada") return;
      if (r !== "modal") { if (s) store(LS.partida, s); render(); }
      return;
    }
    if (enEscena() && ev.target.closest(".v-escena") && !ev.target.closest(".v-tarjeta, .v-toast")) {
      if (tocarEscena(ev)) { store(LS.partida, s); render(); }
      return;
    }
    if (ev.target === modal) cerrarModal();
  });
  document.addEventListener("input", (ev) => {
    const k = ev.target.dataset && ev.target.dataset.enc;
    if (k && s) { s.encuesta = s.encuesta || {}; s.encuesta[k] = ev.target.value; store(LS.partida, s); }
  });
  aplicarTema();
  render();
  // para las pruebas: dónde cae en la pantalla el centro de un sitio
  function punto(id) {
    const svg = app.querySelector(".v-escena svg");
    if (!svg || !POS[id]) return null;
    const p = svg.createSVGPoint(); p.x = POS[id][0]; p.y = POS[id][1];
    const q = p.matrixTransform(svg.getScreenCTM());
    return { x: q.x, y: q.y };
  }
  window.__LVV = { get s() { return s; }, ui, render, punto, informe: () => (s ? informeVista(s) : "") };
})();
