/* Liber Vagatorum · juego 2D (rama claude/juego2d): el mapa (tecla M).
 * Es el plano de la vista 2D (vista.js), con lo que sabes de cada sitio: lo de ahora, lo de antes más claro, la ronda
 * donde la viste por última vez, quién avisa y dónde te vieron pedir. Aquí además se dibuja el camino que eliges.
 * Solo dibuja: no tiene ni una regla. */
window.LV_MAPA = (function () {
  const R = window.RULES, E = window.ENGINE, EV = E.vista || {};
  const L = E.L;
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const POS = {
    plaza: [292, 108], sanmartin: [130, 150], rua: [212, 262], sanpablo: [428, 228],
    catedral: [138, 398], escuelas: [290, 384], sanesteban: [432, 398],
    puerta: [226, 506], sanpolo: [446, 506],
    ribera: [78, 592], puente: [226, 650], orilla: [338, 598],
  };
  const VB = { x: 0, y: 14, w: 520, h: 690 };
  const VIGIA = { puerta: "el portero", escuelas: "el bedel", sanmartin: "el cura" };
  const vigiaDe = (id) => (L[id].aviso >= 2 ? VIGIA[id] || "alguien" : null);

  // ------------------------------------------------------------------ moñigotes del plano (los de la vista 2D)
  const ESC = 1.5;
  const G = (x, y, svg) => `<g transform="translate(${x} ${y}) scale(${ESC}) translate(${-x} ${-y})">${svg}</g>`;
  function peg(x, y, o) {
    const k = o.k || 1, h = (o.sent ? 7 : 11) * k, c = o.c;
    let g = `<path d="M${x - 4 * k},${y} L${x + 4 * k},${y} L${x + 2.4 * k},${y - h} L${x - 2.4 * k},${y - h}Z" fill="${c}"${o.borde ? ` stroke="${o.borde}" stroke-width="1.1"` : ""}/>`;
    g += `<circle cx="${x}" cy="${y - h - 3.4 * k}" r="${3.2 * k}" fill="${o.cabeza || c}"${o.borde ? ` stroke="${o.borde}" stroke-width="1.1"` : ""}/>`;
    return g;
  }
  const gente = (x, y, paso) => peg(x, y, { c: paso ? "var(--f-paso)" : "var(--f-gente)", k: paso ? 0.9 : 1 });
  const pobre = (x, y, c) => peg(x, y, { c: c || "var(--f-pobre)", sent: true }) + `<path d="M${x + 2},${y - 5} L${x + 8},${y - 3}" stroke="${c || "var(--f-pobre)"}" stroke-width="1.6" stroke-linecap="round"/><path d="M${x + 6.5},${y - 3.5} a2.6,2 0 0 0 5,0z" fill="var(--f-cuenco)"/>`;
  function ronda(x, y) {
    let g = peg(x + 16, y + 2, { c: "var(--f-corchete)" }) + `<path d="M${x + 20},${y + 3} L${x + 20},${y - 22}" stroke="var(--f-corchete)" stroke-width="1.2"/>`;
    g += peg(x + 9, y - 6, { c: "var(--f-corchete)" }) + `<path d="M${x + 13},${y - 5} L${x + 13},${y - 29}" stroke="var(--f-corchete)" stroke-width="1.2"/>`;
    g += peg(x, y, { c: "var(--f-ronda)", k: 1.12 }) + `<path d="M${x - 5},${y - 18.2} h10" stroke="var(--f-ronda)" stroke-width="2"/><rect x="${x - 2.6}" y="${y - 22.8}" width="5.2" height="4" fill="var(--f-ronda)"/>`;
    return g + `<path d="M${x - 6},${y + 1} L${x - 6},${y - 21}" stroke="var(--f-vara)" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  function yo(x, y, llaga) {
    let g = `<ellipse cx="${x}" cy="${y + 1}" rx="8" ry="2.6" fill="var(--accent)" opacity="0.35"/>` + peg(x, y, { c: "var(--f-yo)", k: 1.25, borde: "var(--surface)" });
    g += `<circle cx="${x + 5.5}" cy="${y - 13}" r="3" fill="var(--f-hatillo)" stroke="var(--surface)" stroke-width="0.8"/>`;
    if (llaga) g += `<rect x="${x - 3.6}" y="${y - 3.6}" width="3.4" height="2.6" fill="#fff" stroke="var(--bad)" stroke-width="0.6"/>`;
    return g;
  }
  const vigia = (x, y) => peg(x, y, { c: "var(--f-vigia)" }) + `<rect x="${x - 3.4}" y="${y - 19.5}" width="6.8" height="2.6" fill="var(--f-vigia)"/>`
    + `<g transform="translate(${x},${y - 25})"><path d="M-5,0 Q0,-4 5,0 Q0,4 -5,0z" fill="var(--surface)" stroke="var(--f-vigia)" stroke-width="1"/><circle r="1.6" fill="var(--f-vigia)"/></g>`;
  function vecino(x, y, mio) {
    const c = mio ? "var(--bad)" : "var(--f-vecino)";
    let g = `<rect x="${x - 6}" y="${y - 6}" width="12" height="11" fill="var(--ventana)" stroke="${c}" stroke-width="${mio ? 1.8 : 1.2}"/><circle cx="${x}" cy="${y - 1.4}" r="2.6" fill="${c}"/><path d="M${x - 4},${y + 5} Q${x},${y + 1} ${x + 4},${y + 5}z" fill="${c}"/>`;
    if (mio) g += `<path d="M${x + 3},${y + 1} L${x + 9},${y - 8}" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`;
    return g;
  }
  const capataz = (x, y) => peg(x, y, { c: "var(--f-capataz)" }) + `<path d="M${x - 5.5},${y - 17.6} h11" stroke="var(--f-capataz)" stroke-width="1.8"/><rect x="${x + 5}" y="${y - 4}" width="6" height="4" fill="var(--bld-line)"/>`;
  const puesto = (x, y) => `<rect x="${x - 7}" y="${y - 7}" width="14" height="6" fill="var(--bld)" stroke="var(--bld-line)" stroke-width="0.8"/><path d="M${x - 9},${y - 7} L${x - 6},${y - 13} L${x + 6},${y - 13} L${x + 9},${y - 7}z" fill="var(--toldo)"/>`;

  // ------------------------------------------------------------------ edificios del plano
  const casa = (x, y, w, h) => `<rect class="bld" x="${x}" y="${y - h}" width="${w}" height="${h}"/><path class="tejado" d="M${x - 1.5},${y - h} L${x + w / 2},${y - h - 6} L${x + w + 1.5},${y - h}Z"/>`;
  function iglesia(x, y, k) {
    k = k || 1;
    return `<rect class="bld" x="${x}" y="${y - 18 * k}" width="${34 * k}" height="${18 * k}"/><path class="tejado" d="M${x - 1.5},${y - 18 * k} L${x + 17 * k},${y - 27 * k} L${x + 34 * k + 1.5},${y - 18 * k}Z"/>`
      + `<rect class="bld" x="${x + 34 * k}" y="${y - 36 * k}" width="${10 * k}" height="${36 * k}"/><path class="tejado" d="M${x + 34 * k - 1},${y - 36 * k} L${x + 39 * k},${y - 43 * k} L${x + 44 * k + 1},${y - 36 * k}Z"/>`
      + `<path class="cruz" d="M${x + 39 * k},${y - 43 * k} v-6 M${x + 36.5 * k},${y - 46.5 * k} h5"/>`;
  }
  const VENTANA = { plaza: [-36, -42], sanmartin: [-16, -38], rua: [-30, -42], sanpablo: [22, -42], catedral: [-14, -44], escuelas: [-18, -40], sanesteban: [-26, -36], puerta: [-34, -36], sanpolo: [34, -36] };
  const DONDE_VIGIA = { puerta: [-44, -6], escuelas: [-46, -6], sanmartin: [-44, -6] };
  function edificio(id, x, y) {
    const b = y - 26;
    switch (id) {
      case "plaza": return `<rect class="suelo-plaza" x="${x - 60}" y="${y - 30}" width="120" height="52" rx="3"/>` + casa(x - 58, b - 4, 22, 14) + casa(x - 34, b - 4, 20, 16) + casa(x - 12, b - 4, 22, 14) + casa(x + 12, b - 4, 20, 16) + casa(x + 34, b - 4, 22, 14);
      case "sanmartin": return iglesia(x - 26, b, 1.05) + casa(x + 24, b, 16, 12);
      case "rua": return casa(x - 52, b, 18, 14) + casa(x - 32, b, 16, 18) + casa(x - 14, b, 18, 13) + casa(x + 20, b, 16, 16) + casa(x + 38, b, 16, 13);
      case "sanpablo": return casa(x - 48, b, 18, 13) + casa(x - 28, b, 16, 15) + casa(x + 14, b, 18, 14) + casa(x + 34, b, 14, 12);
      case "catedral": return iglesia(x - 34, b, 1.35) + `<path class="andamio" d="M${x - 58},${b} v-34 M${x - 46},${b} v-34 M${x - 60},${b - 10} h16 M${x - 60},${b - 22} h16 M${x - 60},${b - 34} h16"/>`;
      case "escuelas": return `<rect class="bld" x="${x - 34}" y="${b - 24}" width="68" height="24"/><rect class="fachada" x="${x - 12}" y="${b - 22}" width="24" height="16"/>`;
      case "sanesteban": return iglesia(x - 10, b, 1.15) + `<rect class="bld" x="${x - 48}" y="${b - 22}" width="36" height="22"/><rect class="claustro" x="${x - 42}" y="${b - 17}" width="24" height="13"/>`;
      case "puerta": return casa(x - 50, b + 6, 16, 12) + casa(x + 30, b + 6, 18, 14);
      case "sanpolo": return casa(x + 24, b + 6, 18, 12);
      case "ribera": return `<g class="juncos"><path d="M${x - 50},${y + 22} q2,-12 0,-16 M${x - 46},${y + 22} q-2,-10 1,-14 M${x + 44},${y + 22} q2,-12 0,-16"/></g><g class="acena"><rect x="${x - 26}" y="${y - 50}" width="30" height="16"/><circle cx="${x + 10}" cy="${y - 40}" r="9"/></g>`;
      case "orilla": return `<g class="juncos"><path d="M${x - 44},${y + 20} q2,-12 0,-16 M${x + 40},${y + 20} q2,-12 0,-16"/></g>`;
      default: return "";
    }
  }

  // ------------------------------------------------------------------ lo que se sabe de cada sitio
  const franjaAct = (s) => E.franja(Math.min(s.t, E.FIN - 1));
  function verDe(s, id) {
    const f = franjaAct(s);
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
  const OPAC = [1, 0.5, 0.2, 0.2];
  function rondaUltima(s) {
    const v = (s.vistas || [])[(s.vistas || []).length - 1];
    if (!v) return null;
    const f = franjaAct(s);
    const ahora = v.dia === s.dia && v.f === f;
    const edad = ahora ? "en esta franja" : v.dia === s.dia ? "a " + E.nombreFranja(v.f).toLowerCase() : v.dia === s.dia - 1 ? "ayer a " + E.nombreFranja(v.f).toLowerCase() : `el día ${v.dia} a ${E.nombreFranja(v.f).toLowerCase()}`;
    return { lugar: v.lugar, op: ahora ? 0.5 : v.dia === s.dia ? 0.42 : v.dia === s.dia - 1 ? 0.3 : 0.22, edad };
  }
  const rondaAqui = (s) => (s.t < E.FIN ? E.rondaEnTuZona(s) : null);
  const pedidoAqui = (s, id) => s.pedidoHoy.filter((p) => p.lugar === id).map((p) => R.FRANJAS[p.f].nombre.toLowerCase());
  function recuerdaDe(s, id) {
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
  // el camino más corto entre dos sitios (por los vecinos; a igualdad, el primero que se encuentra)
  function camino(a, b) {
    if (a === b) return [];
    const prev = { [a]: null }, cola = [a];
    while (cola.length) {
      const x = cola.shift();
      for (const v of E.VECINOS[x]) if (!(v in prev)) { prev[v] = x; cola.push(v); }
    }
    if (!(b in prev)) return null;
    const out = [];
    for (let x = b; x !== a; x = prev[x]) out.unshift(x);
    return out;
  }

  // ------------------------------------------------------------------ el plano
  // o: { ruta: [sitios], marca: sitio donde dibujarte (por defecto, donde estás) }
  function svg(s, o) {
    o = o || {};
    const f = franjaAct(s), d = E.dia(s);
    const r = rondaAqui(s);
    const ult = r ? null : rondaUltima(s);
    const ruta = o.ruta || [];
    const enRuta = new Set(ruta);
    const marca = o.marca || s.lugar;
    let g = `<svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa de Salamanca">`;
    g += `<rect x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}" class="suelo-fuera"/>`;
    g += `<path class="suelo-dentro" d="M60,544 L40,420 L46,250 L66,62 L190,36 L402,38 L482,70 L502,250 L494,420 L482,544 Z"/>`;
    g += `<path class="rio" d="M0,622 C120,606 200,632 300,620 S450,608 520,622 L520,706 L0,706 Z"/>`;
    g += `<text x="500" y="700" class="rotulo-rio" text-anchor="end">Tormes</text>`;
    g += `<rect class="puente" x="212" y="548" width="28" height="160"/>`;
    for (const [a, b] of R.CAMINOS) { const [x1, y1] = POS[a], [x2, y2] = POS[b]; g += `<line class="calle" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }
    // el camino elegido
    const tramo = [s.lugar].concat(ruta);
    for (let i = 0; i + 1 < tramo.length; i++) { const [x1, y1] = POS[tramo[i]], [x2, y2] = POS[tramo[i + 1]]; g += `<line class="m-ruta" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }
    g += `<path class="muralla" d="M212,544 L60,544 L40,420 L46,250 L66,62 L190,36 L402,38 L482,70 L502,250 L494,420 L482,544 L460,544 M432,544 L240,544"/>`;
    for (const gx of [226, 446]) g += `<rect class="torre" x="${gx - 22}" y="532" width="10" height="22"/><rect class="torre" x="${gx + 12}" y="532" width="10" height="22"/>`;
    let figs = "", rot = "";
    for (const l of R.LUGARES) {
      const id = l.id, [x, y] = POS[id];
      const v = verDe(s, id);
      const aqui = id === s.lugar;
      const fin = ruta.length && id === ruta[ruta.length - 1];
      g += `<g class="sitio${v ? "" : " sin-ver"}" data-m-lugar="${id}"><rect class="toque" x="${x - 58}" y="${y - 66}" width="116" height="104" rx="10"/>${edificio(id, x, y)}`;
      g += `<ellipse class="escenario${aqui ? " aqui" : fin ? " sel" : enRuta.has(id) ? " vecino" : ""}" cx="${x}" cy="${y + 4}" rx="56" ry="20"/></g>`;
      let p = "";
      if (L[id].trabajo && v && v.trabajo) p += G(x - 54, y - 22, capataz(x - 54, y - 22));
      if (id === "plaza" && E.franjasHurto(s, id, s.dia).includes(f)) p += puesto(x + 34, y - 14) + puesto(x + 50, y - 6) + puesto(x - 50, y - 12);
      if (v) {
        if (v.gente === 1) p += L[id].quien === "solo pobres" ? G(x - 36, y + 6, pobre(x - 36, y + 6)) + G(x + 30, y, pobre(x + 30, y)) : G(x - 20, y - 4, gente(x - 20, y - 4, true));
        else if (v.gente >= 2) { const H = [[-34, -9], [-8, -11], [16, -8], [-46, -1], [28, -3], [-21, -2], [3, -1]]; const n = v.gente >= 3 ? 7 : 3; for (let i = 0; i < n; i++) { const [dx, dy] = H[n === 7 ? i : [0, 6, 2][i]]; p += G(x + dx, y + dy, gente(x + dx, y + dy)); } }
        if (v.pobres && l.dentro) p += G(x - 50, y + 16, pobre(x - 50, y + 16)) + G(x - 34, y + 19, pobre(x - 34, y + 19));
      }
      figs += `<g data-m-lugar="${id}" opacity="${v ? OPAC[v.nivel] : 1}">${p}</g>`;
      if (vigiaDe(id)) { const [dx, dy] = DONDE_VIGIA[id]; figs += G(x + dx, y + dy, vigia(x + dx, y + dy)); }
      const [wx, wy] = VENTANA[id] || [0, -40];
      if (pedidoAqui(s, id).length) figs += G(x + wx, y + wy, vecino(x + wx, y + wy, true));
      if (r === id) figs += G(x + 24, y + 6, ronda(x + 24, y + 6));
      else if (ult && ult.lugar === id && !(aqui && s.t < E.FIN)) figs += `<g opacity="${ult.op}">${G(x + 24, y + 6, ronda(x + 24, y + 6))}</g>`;
      if (id === marca) figs += `<g id="m-yo">${G(x - 8, y + 20, yo(x - 8, y + 20, s.llaga))}</g>`;
      const n = ruta.indexOf(id);
      rot += `<text class="rotulo${aqui ? " aqui" : ""}" data-m-lugar="${id}" x="${x}" y="${y + 40}" text-anchor="middle">${esc(l.corto)}${n >= 0 ? ` · ${n + 1}` : ""}</text>`;
    }
    return g + figs + rot + `</svg>`;
  }

  return { svg, POS, verDe, rondaUltima, recuerdaDe, camino, pedidoAqui, vigiaDe, franjaAct, rondaAqui };
})();
