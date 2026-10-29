/* Liber Vagatorum · el juguete. Pantallas y botones. Las reglas están en rules.js y el motor en engine.js. */
(function () {
  const R = window.RULES, E = window.ENGINE, P = R.PARAMS;
  const LS = { partida: "lvj-partida", historial: "lvj-historial", tema: "lvj-tema", nombre: "lvj-nombre" };
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const app = document.getElementById("app");
  const modal = document.getElementById("modal");

  let s = load(LS.partida, null);
  if (s && (!s.v || !s.hoy)) s = null;
  const ui = { pantalla: s && s.fase !== "fin" ? "juego" : "inicio", pestana: "acciones" };
  let faseAntes = null;
  let instalar = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); instalar = e; });

  // ------------------------------------------------------------------ piezas
  const L = E.L;
  const gtxt = (g, l) => `${E.GENTE_TXT[g]}${g >= 1 && l.quien ? ` (${l.quien})` : ""}`;
  function btn(act, titulo, detalle, opts) {
    const o = opts || {};
    const data = Object.entries(o.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
    return `<button class="btn ${o.cls || ""}" data-act="${act}"${data}${o.disabled ? " disabled" : ""}><span class="t">${esc(titulo)}</span>${detalle ? `<span class="d">${esc(detalle)}</span>` : ""}</button>`;
  }
  function memTxt(m, l) {
    if (!m) return "";
    const partes = [l.dentro ? (m.da < 2 && m.gente >= 2 && m.pobres ? `${E.GENTE_TXT[m.gente]}, pero más pobres que gente que dé` : E.GENTE_TXT[m.gente] + (m.pobres && m.da >= 2 ? ", con otros pobres pidiendo" : "")) : E.GENTE_TXT[m.gente]];
    if (m.trabajo) partes.push("cogen peones");
    if (m.ronda) partes.push("la ronda");
    return partes.join(" · ");
  }
  const franjaAct = () => E.franja(Math.min(s.t, E.FIN - 1));

  function cabecera(ancho) {
    const d = E.dia(s), m = R.MODOS[s.modo];
    const f = franjaAct();
    const chips = [
      `<div class="chip${s.cuerpo <= 2 ? " alerta" : ""}">Cuerpo<b>${s.cuerpo}/${P.cuerpoMax}</b></div>`,
      `<div class="chip${s.pan === 0 ? " alerta" : ""}">Pan<b>${s.pan}</b>pedazos</div>`,
      `<div class="chip${s.conocido ? " alerta" : ""}">Ronda<b>${s.conocido ? "te conoce" : "no te conoce"}</b></div>`,
      `<div class="chip${s.detenciones ? " alerta" : ""}">Detenciones<b>${s.detenciones}/${P.detencionesMax}</b></div>`,
    ].join("");
    let barra = "";
    if (s.fase === "dia" || s.fase === "resultado") {
      barra = `<div class="dia-barra" aria-hidden="true">${R.FRANJAS.map((fr, i) => {
        const ratos = Array.from({ length: R.RATOS }, (_, k) => {
          const t = i * R.RATOS + k;
          return `<div class="rato ${t < s.t ? "gastado" : t === s.t ? "ahora" : ""}"></div>`;
        }).join("");
        return `<div><div class="fr ${i === f && s.t < E.FIN ? "act" : ""}">${fr.nombre}</div><div class="ratos">${ratos}</div></div>`;
      }).join("")}</div>`;
      barra += `<p class="small muted" style="margin:4px 0 0">${s.t >= E.FIN ? "Ya es de noche." : `${R.FRANJAS[f].nombre} (${R.FRANJAS[f].hora}), rato ${E.ratoEnFranja(s.t) + 1} de ${R.RATOS}. Quedan ${E.FIN - s.t} ratos hasta que cierren la puerta.`}</p>`;
    }
    return `<header class="top"><div class="top-in${ancho ? " ancho" : ""}">
      <div class="top-row">
        <div class="top-title">Día ${s.dia} de ${R.DIAS} · ${esc(d.fecha)}<span>${esc(m.nombre)}${d.fiesta && d.tipo !== "domingo" ? " · " + esc(d.fiesta) : ""}</span></div>
        <div class="estado">${chips}</div>
        <div class="top-btns"><button class="icon-btn" data-act="ayuda" aria-label="Cómo se juega">?</button>
        <button class="icon-btn" data-act="menu" aria-label="Menú">⋯</button></div>
      </div>
      ${barra}
    </div></header>`;
  }

  // ------------------------------------------------------------------ mapa
  function mapa(o) {
    const modoB = R.MODOS[s.modo].zona === "barrio";
    const posibles = new Set((o ? o.movs : []).filter((m) => m.ok).map((m) => m.destino));
    let g = `<svg viewBox="0 0 360 320" aria-hidden="true" role="img">`;
    // río y puente
    g += `<path d="M0,296 C60,286 120,304 180,294 S300,286 360,296 L360,320 L0,320Z" fill="var(--river)"/>`;
    g += `<path d="M20,306 q12,-4 24,0 t24,0 M250,308 q12,-4 24,0 t24,0" fill="none" stroke="var(--river-line)" stroke-width="1"/>`;
    g += `<text x="300" y="316" font-size="10" fill="var(--river-line)" font-style="italic">Tormes</text>`;
    g += `<rect x="172" y="262" width="16" height="58" fill="var(--g1)" stroke="var(--wall)" stroke-width="1"/>`;
    // barrios (prueba B)
    if (modoB) {
      for (const b of R.BARRIOS) {
        const ls = E.DEL_BARRIO[b.id].map((id) => L[id]);
        const x0 = Math.min(...ls.map((l) => l.x)) - 26, x1 = Math.max(...ls.map((l) => l.x)) + 26;
        const y0 = Math.min(...ls.map((l) => l.y)) - 24, y1 = Math.max(...ls.map((l) => l.y)) + 28;
        const mio = b.id === L[s.lugar].barrio;
        // la ronda vigila todo su barrio: si la ves ahora en él, se pinta el barrio entero
        const vigilado = E.DEL_BARRIO[b.id].some((id) => { const m = s.memoria[id]; return m && m.ronda && E.edad(s, m).nivel === 0; });
        g += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="16" fill="${vigilado ? "var(--bad-bg)" : "var(--barrio)"}" stroke="${vigilado ? "var(--bad)" : mio ? "var(--accent)" : "var(--line)"}" stroke-width="${mio || vigilado ? 2 : 1}" stroke-dasharray="${mio || vigilado ? "" : "4 3"}"/>`;
        if (vigilado) g += `<text x="${x1 - 8}" y="${y1 - 6}" font-size="9.5" fill="var(--bad)" font-weight="700" text-anchor="end">vigilado</text>`;
        g += `<text x="${x0 + 8}" y="${y0 + 12}" font-size="9.5" fill="var(--muted)" font-weight="700">${esc(b.nombre)}</text>`;
      }
    }
    // muralla
    g += `<path d="M166,240 L34,236 L16,130 L28,30 L330,20 L346,150 L332,238 L194,240" fill="none" stroke="var(--wall)" stroke-width="4" stroke-linejoin="round"/>`;
    // caminos
    for (const [a, b] of R.CAMINOS) {
      const la = L[a], lb = L[b];
      const cruce = la.barrio !== lb.barrio;
      g += `<line x1="${la.x}" y1="${la.y}" x2="${lb.x}" y2="${lb.y}" stroke="var(--muted)" stroke-width="${modoB && !cruce ? 1 : 1.6}" stroke-dasharray="${modoB && !cruce ? "2 3" : ""}" opacity="0.7"/>`;
    }
    // sitios
    const pedidos = {};
    s.pedidoHoy.forEach((p) => (pedidos[p.lugar] = (pedidos[p.lugar] || 0) + 1));
    for (const l of R.LUGARES) {
      const m = s.memoria[l.id], ed = E.edad(s, m);
      const op = [1, 0.75, 0.5, 0.35][ed.nivel];
      const fill = m ? `var(--g${Math.max(0, Math.min(3, l.dentro ? m.da : 0))})` : "var(--surface)";
      const aqui = l.id === s.lugar;
      g += `<g class="nodo" data-mapa="${l.id}">`;
      g += `<circle cx="${l.x}" cy="${l.y}" r="18" fill="transparent"/>`;
      if (aqui) g += `<circle cx="${l.x}" cy="${l.y}" r="16" fill="none" stroke="var(--accent)" stroke-width="3"/>`;
      else if (posibles.has(l.id)) g += `<circle cx="${l.x}" cy="${l.y}" r="15" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 2"/>`;
      g += `<circle cx="${l.x}" cy="${l.y}" r="10" fill="${fill}" fill-opacity="${m ? op : 1}" stroke="var(--wall)" stroke-width="1.2" stroke-dasharray="${m ? "" : "3 2"}"/>`;
      if (m && m.pobres && l.dentro) g += `<circle cx="${l.x - 4}" cy="${l.y + 4}" r="1.6" fill="var(--ink)" opacity="${op}"/><circle cx="${l.x + 1}" cy="${l.y + 5}" r="1.6" fill="var(--ink)" opacity="${op}"/><circle cx="${l.x + 5}" cy="${l.y + 2}" r="1.6" fill="var(--ink)" opacity="${op}"/>`;
      if (m && m.ronda) g += `<path d="M${l.x + 10},${l.y - 20} l7,7 l-7,7 l-7,-7z" fill="var(--bad)" opacity="${op}"/><text x="${l.x + 10}" y="${l.y - 10}" font-size="8" fill="#fff" text-anchor="middle" font-weight="700" opacity="${op}">R</text>`;
      if (pedidos[l.id]) g += `<ellipse cx="${l.x - 13}" cy="${l.y - 12}" rx="6" ry="3.6" fill="none" stroke="var(--bad)" stroke-width="1.2"/><circle cx="${l.x - 13}" cy="${l.y - 12}" r="1.6" fill="var(--bad)"/>`;
      if (aqui) g += `<circle cx="${l.x}" cy="${l.y}" r="3.5" fill="var(--accent)"/>`;
      g += `<text x="${l.x}" y="${l.y + 24}" font-size="10" text-anchor="middle" fill="var(--ink)" font-weight="${aqui ? 700 : 400}">${esc(l.corto)}</text>`;
      g += `</g>`;
    }
    g += `</svg>`;
    const ley = `<div class="leyenda" aria-hidden="true"><span><i style="background:var(--g3)"></i>mucha gente</span><span><i style="background:var(--g2)"></i>poca</span><span><i style="background:var(--g1)"></i>nadie que dé</span><span><i style="border-style:dashed"></i>sin ver</span><span style="color:var(--bad)">◆ ronda</span><span style="color:var(--bad)">◉ te vieron pedir hoy</span><span>Lo claro es lo visto hace rato.</span></div>`;
    return `<div class="mapa">${g}${ley}</div>`;
  }

  // ------------------------------------------------------------------ pantallas
  function pantallaInicio() {
    const nombre = load(LS.nombre, "");
    const enCurso = s && s.fase !== "fin";
    const hist = load(LS.historial, []);
    let h = `<div class="wrap">
      <h1>Liber Vagatorum</h1>
      <p class="muted">El juguete · versión ${esc(R.version)}</p>
      <p>Una prueba mínima del juego: un mendigo, el hambre y la ronda. Nada más: ni compañeros, ni tretas, ni exámenes.</p>
      <p>Hay dos versiones de la ciudad, A y B. Solo cambia cómo te mueves y cuánto ves. Si puedes, juega las dos y manda el informe de cada una al acabar.</p>
      <label class="campo" for="nombre">Tu nombre (para el informe)</label>
      <input type="text" id="nombre" value="${esc(nombre)}" autocomplete="name">
      <div class="btns">
        ${enCurso ? btn("continuar", "Seguir la partida en curso", `${R.MODOS[s.modo].nombre} · día ${s.dia}`, { cls: "primary" }) : ""}
        ${btn("empezar", "Empezar la prueba A · calles", R.MODOS.A.resumen, { data: { id: "A" } })}
        ${btn("empezar", "Empezar la prueba B · barrios", R.MODOS.B.resumen, { data: { id: "B" } })}
        ${btn("ayuda", "Cómo se juega", "")}
      </div>`;
    if (hist.length) {
      h += `<div class="panel"><h3>Partidas acabadas en este móvil</h3><div class="btns">`;
      hist.slice().reverse().forEach((x, i) => {
        const idx = hist.length - 1 - i;
        h += `<div><p class="small" style="margin:6px 0 2px">${esc(x.fecha.slice(0, 16).replace("T", " "))} · ${esc(x.modo)} · ${esc(x.final)}</p>
          <div class="fila-btn">${btn("hDescargar", "Descargar informe", "", { cls: "secundario", data: { i: idx } })}${navigator.share ? btn("hCompartir", "Compartir", "", { cls: "secundario", data: { i: idx } }) : btn("hCopiar", "Copiar", "", { cls: "secundario", data: { i: idx } })}</div></div>`;
      });
      h += `</div></div>`;
    }
    h += `</div>`;
    return h;
  }

  function pantallaAmanecer() {
    const d = E.dia(s);
    let h = cabecera() + `<div class="wrap">`;
    h += `<h2>${esc(d.fecha[0].toUpperCase() + d.fecha.slice(1))}</h2>`;
    if (s.dia === 1 && !s.noche) {
      h += `<p>Eres un mozo de La Armuña. Has bajado a Salamanca porque en tu aldea no queda pan hasta la siega. Duermes en la ribera del Tormes, fuera de la muralla.</p>
        <p>Desde la orden de pobres del año pasado, en la ciudad está prohibido pedir. Pero el pan está dentro, y no hay otra manera de comer.</p>
        <p><b>Aguanta diez días.</b> El 11 de junio empieza la siega, y en la siega hay trabajo para quien pueda con la hoz.</p>`;
    }
    if (s.noche) {
      h += `<div class="panel"><h3>La noche</h3>${s.noche.lineas.map((x) => `<p>${esc(x)}</p>`).join("")}<p>Cuerpo: ${s.noche.antes} → <b>${s.noche.despues}</b>.</p></div>`;
    }
    const notas = [];
    if (d.tipo === "domingo") notas.push("Es domingo: no hay obra. Las iglesias se llenan a prima y a tercia; la plaza está tranquila.");
    if (d.tipo === "corpus") notas.push("Es Corpus Christi: procesión por la Rúa y la plaza a tercia y a sexta, y la ronda va con ella. No hay obra.");
    if (s.dia === P.escasezDesde) notas.push("El pan ha subido en la plaza. Desde hoy, la gente da menos.");
    if (s.lugar === "puerta" && s.cronica.some((c) => c.dia === s.dia - 1 && c.tipo === "detenido")) notas.push("Te sueltan al amanecer en la Puerta del Río.");
    else if (L[s.lugar].dentro) notas.push(`Te despiertas en un portal de ${L[s.lugar].nombre}.`);
    else notas.push("Te despiertas en la ribera.");
    h += `<div class="panel">${notas.map((x) => `<p>${esc(x)}</p>`).join("")}</div>`;
    h += `<div class="btns">${btn("empezarDia", "Empezar el día", "", { cls: "primary" })}${s.dia > 1 ? btn("recuerdo", "Lo que recuerdas", "Dónde y cuándo has visto a la ronda", { cls: "secundario" }) : ""}</div></div>`;
    return h;
  }

  function panelAqui(o) {
    const l = L[s.lugar], f = franjaAct();
    let h = `<div class="panel"><h2>${esc(l.nombre)}</h2><p class="small muted">${esc(E.BARRIO[l.barrio].nombre)}${l.dentro ? "" : " · fuera de la muralla"}</p><p class="small">${esc(l.desc)}</p>`;
    if (s.t < E.FIN) {
      const zona = E.lugaresZona(s, E.zonaDe(s, s.lugar));
      const r = E.rondaEnTuZona(s);
      h += `<h3>Lo que ves ahora</h3><ul class="vivo">`;
      for (const id of zona) {
        const e = E.estado(s, id, s.dia, f), li = L[id];
        const partes = [gtxt(e.gente, li)];
        if (e.pobres) partes.push("otros pobres pidiendo");
        if (e.trabajo) partes.push("las obras cogen peones");
        if (r === id) partes.push(`<span class="ronda-txt">la ronda</span>`);
        h += `<li>${zona.length > 1 ? `<b>${esc(li.corto)}${id === s.lugar ? " (aquí)" : ""}:</b> ` : ""}${partes.map((p) => (p.startsWith("<span") ? p : esc(p))).join(" · ")}</li>`;
      }
      h += `</ul>`;
      if (!r) h += `<p class="small">No ves a la ronda${zona.length > 1 ? " en el barrio" : " aquí"}.</p>`;
      else if (zona.length > 1) h += `<p class="small ronda-txt">La ronda está en ${esc(L[r].nombre)} y vigila todo el barrio.</p>`;
      const vistos = s.pedidoHoy.filter((p) => p.lugar === s.lugar);
      if (vistos.length) h += `<p class="small ronda-txt">Hoy te han visto pedir aquí (${vistos.map((p) => R.FRANJAS[p.f].nombre.toLowerCase()).join(", ")}).</p>`;
    }
    return h + `</div>`;
  }

  function panelAcciones(o) {
    let h = `<div class="panel"><h3>Qué haces</h3>`;
    const pd = o.acc.find((a) => a.id === "pedir");
    if (pd.ok) h += `<ul class="prev">${E.previsionPedir(s).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    h += `<div class="btns">`;
    h += btn("pedir", "Pedir aquí", pd.ok ? "1 franja" : pd.porque, { disabled: !pd.ok, cls: pd.ok && E.rondaEnTuZona(s) ? "riesgo" : "" });
    const tr = o.acc.find((a) => a.id === "trabajo");
    if (tr) h += btn("trabajo", "Pedir trabajo en las obras", tr.ok ? `Si te cogen, cargas piedra hasta el final de nona por ${P.trabajo.paga} pedazos de pan. Preguntar cuesta 1 rato.` : tr.porque, { disabled: !tr.ok });
    const es = o.acc.find((a) => a.id === "esperar");
    if (s.t < E.FIN) {
      const f = E.franja(s.t);
      const sig = f + 1 < R.FRANJAS.length ? `Esperar a ${R.FRANJAS[f + 1].nombre.toLowerCase()}` : "Esperar a que anochezca";
      h += btn("esperar", sig, `${es.coste} ${es.coste === 1 ? "rato" : "ratos"}. Quieto, la ronda no te para; si llega, la verás.`);
    }
    h += btn("acabar", "Acabar el día aquí", L[s.lugar].dentro ? "Dormirás en un portal, dentro de la muralla: la ronda de noche puede encontrarte." : s.lugar === "ribera" ? "Dormirás al raso en la ribera." : "En el puente no se puede dormir: bajarás a la ribera.");
    h += `</div></div>`;
    return h;
  }

  function panelMover(o) {
    const modoB = R.MODOS[s.modo].zona === "barrio";
    let h = `<div class="panel"><h3>Adónde vas</h3><div class="btns">`;
    for (const mv of o.movs) {
      const l = L[mv.destino], m = s.memoria[mv.destino];
      const visto = m ? `visto ${E.edad(s, m).txt}: ${memTxt(m, l)}` : "sin ver";
      if (mv.tipo === "libre") h += btn("mover", `Ir a ${l.nombre}`, `Mismo barrio, sin gastar tiempo.`, { data: { id: mv.destino } });
      else if (mv.tipo === "cruce") h += btn("mover", `Cruzar a ${E.BARRIO[mv.barrio].nombre}`, mv.ok ? `1 franja. Llegas a ${l.nombre}. ${E.BARRIO[mv.barrio].dentro ? "" : "Fuera de la muralla."}` : mv.porque, { data: { id: mv.destino }, disabled: !mv.ok });
      else h += btn("mover", `Ir a ${l.nombre}`, mv.ok ? `${mv.coste} ratos · ${visto}` : mv.porque, { data: { id: mv.destino }, disabled: !mv.ok });
    }
    h += `</div>${modoB ? `<p class="small muted">Lo que hay en los otros barrios solo lo sabes de cuando estuviste.</p>` : ""}</div>`;
    return h;
  }

  function panelCiudad() {
    let h = `<div class="panel"><h3>La ciudad: lo que sabes</h3><ul class="ciudad">`;
    const zona = s.t < E.FIN ? new Set(E.lugaresZona(s, E.zonaDe(s, s.lugar))) : new Set();
    for (const b of R.BARRIOS) {
      h += `<li class="barrio">${esc(b.nombre)}${b.dentro ? "" : " (fuera de la muralla)"}</li>`;
      for (const id of E.DEL_BARRIO[b.id]) {
        const l = L[id], m = s.memoria[id], ed = E.edad(s, m);
        const ped = s.pedidoHoy.filter((p) => p.lugar === id).length;
        const txt = zona.has(id) ? `${memTxt(m, l)} · lo ves ahora` : m ? `${memTxt(m, l)} · visto ${ed.txt}` : "sin ver";
        h += `<li class="${ed.nivel >= 2 && !zona.has(id) ? "viejo" : ""}"><b>${esc(l.corto)}</b>${id === s.lugar ? " (estás aquí)" : ""}: ${esc(txt)}${ped ? ` · <span class="ronda-txt">hoy te vieron pedir</span>` : ""}</li>`;
      }
    }
    return h + `</ul></div>`;
  }

  // En el móvil, todo en una columna. En pantalla mediana, el mapa a la izquierda y a la derecha una pestaña
  // («Qué haces» o «La ciudad»). En pantalla ancha, tres columnas: mapa, qué haces y la ciudad.
  function pantallaDia() {
    const o = E.opciones(s);
    const p = ui.pestana === "ciudad" ? "ciudad" : "acciones";
    let h = cabecera(true) + `<div class="juego pestana-${p}">`;
    h += `<div class="col-mapa">${s.aviso ? `<p class="aviso ${s.aviso.tono || ""}">${esc(s.aviso.texto)}</p>` : ""}${mapa(o)}<div class="btns">${btn("recuerdo", "Lo que recuerdas", "Dónde y cuándo has visto a la ronda", { cls: "secundario" })}</div></div>`;
    h += `<nav class="pestanas" aria-label="Paneles">
      <button class="pestana${p === "acciones" ? " act" : ""}" data-act="pestana" data-id="acciones">Qué haces</button>
      <button class="pestana${p === "ciudad" ? " act" : ""}" data-act="pestana" data-id="ciudad">La ciudad</button></nav>`;
    // «Adónde vas» va con «Qué haces» en el móvil y con las pestañas; en pantalla ancha, junto a «La ciudad»
    h += `<div class="pn pn-acciones">${panelAqui(o)}${panelAcciones(o)}<div class="mover-estrecho">${panelMover(o)}</div></div>`;
    h += `<div class="pn pn-ciudad"><div class="mover-ancho">${panelMover(o)}</div>${panelCiudad()}</div>`;
    return h + `</div>`;
  }

  function pantallaResultado() {
    const u = s.ultimo || { titulo: "", lineas: [] };
    return cabecera() + `<div class="wrap"><div class="panel res ${u.tono}"><h2>${esc(u.titulo)}</h2>${u.lineas.map((x) => `<p>${esc(x)}</p>`).join("")}</div>
      <div class="btns">${btn("seguir", "Seguir", "", { cls: "primary" })}</div></div>`;
  }

  function pantallaNoche() {
    let h = cabecera() + `<div class="wrap"><h2>Noche del día ${s.dia}</h2>`;
    if (s.duerme === "carcel") {
      h += `<div class="panel res mal"><p>Duermes en la cárcel. El pan te lo han quitado.</p></div><div class="btns">${btn("cenar", "Seguir", "", { cls: "primary", data: { n: 0 } })}</div></div>`;
      return h;
    }
    const donde = s.duerme === "portal" ? `Duermes en un portal de ${L[s.lugar].nombre}, dentro de la muralla. La ronda de noche puede encontrarte${s.conocido ? ", y ya te conoce" : ""}.` : `${s.bajaRibera ? "En el puente no se puede dormir: toda la noche pasan carros y el portazguero echa a los que se tumban. Bajas a la ribera. " : ""}Duermes al raso en la ribera, fuera de la muralla.`;
    h += `<div class="panel"><p>${esc(donde)}</p><p>Tienes <b>${s.pan}</b> ${s.pan === 1 ? "pedazo" : "pedazos"} de pan. Una ración son 2 pedazos. Puedes guardar hasta ${P.panMax}.</p>${s.trabajoHoy ? `<p>Estás molido del trabajo: −${P.trabajo.cansancio} de cuerpo esta noche.</p>` : ""}</div><div class="btns">`;
    const fx = (n) => { const v = P.cena[n] - (s.trabajoHoy ? P.trabajo.cansancio : 0); return `${v >= 0 ? "+" : "−"}${Math.abs(v)} de cuerpo`; };
    if (s.pan >= 2) h += btn("cenar", "Cenar una ración entera", `2 pedazos · ${fx(2)}`, { cls: "primary", data: { n: 2 } });
    if (s.pan >= 1) h += btn("cenar", "Cenar media ración", `1 pedazo · ${fx(1)}${s.pan > 1 ? " · guardas el resto" : ""}`, { data: { n: 1 } });
    h += btn("cenar", s.pan ? "No cenar" : "Acostarte sin cenar", `${fx(0)}${s.pan ? " · guardas el pan" : ""}`, { data: { n: 0 } });
    return h + `</div></div>`;
  }

  function pantallaFin() {
    const T = E.resumenDias(s);
    const ratos = T.mover + T.pedir + T.trabajar + T.esperar + T.perdido || 1;
    const pct = (x) => Math.round((100 * x) / ratos) + " %";
    const enc = s.encuesta || {};
    const tit = { siega: "Te cogen para la siega", aguanta: "Aguantas, pero no te cogen", hambre: "Mueres de hambre", muerto: "Mueres", desterrado: "Desterrado", abandona: "Partida abandonada" }[s.final.tipo] || "Fin";
    let h = cabecera() + `<div class="wrap"><div class="panel res ${s.final.tipo === "siega" ? "bien" : "mal"}"><h2>${tit}</h2><p>${esc(s.final.texto)}</p><p class="small">Día ${s.final.dia} · ${esc(R.MODOS[s.modo].nombre)}</p></div>`;
    h += `<div class="panel"><h3>Tu partida</h3>
      <p class="small">Tiempo: moverte ${pct(T.mover)} · pedir ${pct(T.pedir)} · trabajar ${pct(T.trabajar)} · esperar ${pct(T.esperar + T.perdido)}.</p>
      <p class="small">${s.modo === "A" ? `${T.pasos} ${T.pasos === 1 ? "paso" : "pasos"}` : `${T.cruces} ${T.cruces === 1 ? "cruce" : "cruces"} de barrio`} · pediste ${T.pedidas} veces (${T.panPedido} pedazos) · llegaste ${T.encuentros} ${T.encuentros === 1 ? "vez" : "veces"} donde estaba la ronda · ${s.detenciones} ${s.detenciones === 1 ? "detención" : "detenciones"}.</p></div>`;
    h += `<div class="panel"><h3>Cinco preguntas</h3><p class="small muted">Van en el informe. Contesta con lo que te salga; no hay respuestas buenas.</p>
      <label class="campo" for="e_dolio">¿Qué decisión te dolió o te costó tomar?</label><textarea id="e_dolio" data-enc="dolio">${esc(enc.dolio)}</textarea>
      <label class="campo" for="e_ir">¿Cómo decidías adónde ir?</label><textarea id="e_ir" data-enc="ir">${esc(enc.ir)}</textarea>
      <label class="campo" for="e_sorpresa">Si la ronda te sorprendió alguna vez, ¿lo sentiste como una mala decisión tuya o como mala suerte?</label><textarea id="e_sorpresa" data-enc="sorpresa">${esc(enc.sorpresa)}</textarea>
      <label class="campo" for="e_sobro">¿Qué sobraba, estorbaba o no entendiste?</label><textarea id="e_sobro" data-enc="sobro">${esc(enc.sobro)}</textarea>
      <label class="campo" for="e_otros">Otros comentarios (opcional)</label><textarea id="e_otros" data-enc="otros">${esc(enc.otros)}</textarea>
      <div class="btns" style="margin-top:12px">
        ${navigator.share ? btn("compartir", "Compartir informe", "Elige tu correo y envíalo", { cls: "primary" }) : ""}
        ${btn("correo", "Abrir el correo con el resumen", `Para: ${R.CONFIG.email}. Adjunta el informe descargado.`, { cls: navigator.share ? "" : "primary" })}
        <div class="fila-btn">${btn("descargar", "Descargar", "", { cls: "secundario" })}${btn("copiar", "Copiar", "", { cls: "secundario" })}</div>
      </div></div>`;
    h += `<div class="btns">${btn("nueva", "Volver al inicio", "Para jugar otra partida o la otra prueba")}</div></div>`;
    return h;
  }

  // ------------------------------------------------------------------ ayuda y menú
  function ayudaHtml() {
    const modo = s && ui.pantalla === "juego" ? s.modo : null;
    const mover = [];
    if (!modo || modo === "A") mover.push(`<p><b>Prueba A · calles.</b> Cada paso a un sitio vecino cuesta 2 ratos (tres pasos, una franja). Solo ves el sitio donde estás, y la ronda igual: solo te ve si estáis en el mismo sitio.</p>`);
    if (!modo || modo === "B") mover.push(`<p><b>Prueba B · barrios.</b> Dentro de tu barrio te mueves sin gastar tiempo y lo ves entero. Pasar a un barrio vecino cuesta una franja. La ronda ve igual que tú: todo su barrio.</p>`);
    return `<div class="modal-in"><h2>Cómo se juega</h2>
      <p>Eres un pobre forastero en Salamanca, en junio de 1545. Desde la orden de pobres del año pasado, pedir en la ciudad está prohibido. Duermes fuera de la muralla, en la ribera; el pan está dentro. <b>Objetivo: aguantar diez días, hasta la siega.</b> En la siega cogen segadores, pero no a cualquiera: quieren brazos que puedan con la hoz.</p>
      <h3>El día</h3><p>Seis franjas, de prima a completas, de seis ratos cada una. Pedir ocupa una franja entera. Al acabar completas cierran la puerta de la muralla: quien se queda dentro duerme en un portal.</p>
      <h3>Moverte</h3>${mover.join("")}
      <h3>Lo que ves</h3><p>La gente, los otros pobres y la ronda cambian al empezar cada franja. Lo que viste vale para la franja en que lo viste. En el mapa, lo visto hace rato se ve más claro. En «Lo que recuerdas» tienes dónde y cuándo has visto a la ronda.</p>
      <h3>Pedir</h3><p>Solo dentro de la muralla y donde hay gente que dé. Con mucha gente suele caer algo; con poca, muchas veces nada; si hay otros pobres pidiendo, os repartís lo que hay. Desde el día ${P.escasezDesde}, el pan sube y la gente da menos.</p>
      <p>Quien te ve pedir puede avisar a la ronda, y la ronda suele ir luego allí. En la puerta, las Escuelas y San Martín avisan enseguida; en San Esteban, nadie.</p>
      <h3>La ronda</h3><p>Un alguacil con sus corchetes. Tiene un recorrido de costumbre, a veces se desvía, acude adonde le avisan y a sexta se va a comer.</p>
      <p>Si te ve pedir, te detiene (con mucha gente, a veces no te ve). Si llegas a donde está, puede pararte: la primera vez te echa de la ciudad; si ya te conoce, te detiene. Si estás quieto cuando llega, no te para, pero no pidas delante de ella. Si empiezas a pedir a mitad de franja, puede llegar mientras pides.</p>
      <h3>Detenciones</h3><p>Noche en la cárcel y te quitan el pan. La segunda vez, además, azotes. La tercera, destierro: se acaba la partida.</p>
      <h3>Trabajar</h3><p>Las obras de la catedral cogen peones a prima los días de trabajo. Si te cogen, cargas piedra hasta el final de nona por ${P.trabajo.paga} pedazos de pan.</p>
      <h3>La noche</h3><p>Una ración son 2 pedazos de pan. Ración entera: +1 de cuerpo. Media: −1. Nada: −2. Puedes guardar hasta ${P.panMax} pedazos. Si el cuerpo llega a 0, mueres.</p>
      <h3>Lo que sabe cualquiera en Salamanca</h3><p>Las iglesias se llenan a la hora de misa (prima) y a vísperas. El mercado de la plaza, por la mañana. Los estudiantes salen a tercia y a nona. A vísperas, la gente pasea por la Rúa. El jueves 4 es Corpus Christi; el 7, domingo.</p>
      <h3>Licencias históricas</h3><ul class="small">${R.LICENCIAS.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="btns">${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div></div>`;
  }
  // lo que el mozo recuerda: no lo lleva escrito, lo ha visto con sus ojos
  function recuerdoHtml() {
    const corto = (d) => R.CALENDARIO[d - 1].fecha.split(" de ")[0];
    const vistas = s.vistas || [];
    let h = `<div class="modal-in"><h2>Lo que recuerdas</h2><p class="small muted">No lo llevas escrito: es lo que has visto con tus ojos.</p><h3>Dónde has visto a la ronda</h3>`;
    if (!vistas.length) h += `<p>Todavía no la has visto.</p>`;
    else {
      h += `<ul class="ciudad">`;
      R.FRANJAS.forEach((fr, f) => {
        const porLugar = {};
        vistas.filter((v) => v.f === f).forEach((v) => (porLugar[v.lugar] = porLugar[v.lugar] || []).push(v.dia));
        const items = Object.entries(porLugar).sort((a, b) => b[1].length - a[1].length)
          .map(([l, dias]) => `<b>${esc(L[l].corto)}</b> (${dias.map(corto).join(", ")})`);
        h += `<li><b>${fr.nombre}:</b> ${items.length ? items.join(" · ") : `<span class="muted">no la has visto</span>`}</li>`;
      });
      h += `</ul>`;
    }
    const malos = s.cronica.filter((c) => c.tipo === "echado" || c.tipo === "detenido");
    if (malos.length) {
      h += `<h3>Dónde te ha parado</h3><ul class="ciudad">${malos.map((c) => `<li>${esc(corto(c.dia))}, ${esc(E.momentoTxt(c.t).split(" ")[0].toLowerCase())}: ${esc(c.texto)}</li>`).join("")}</ul>`;
    }
    return h + `<div class="btns">${btn("cerrar", "Cerrar", "", { cls: "primary" })}</div></div>`;
  }
  function menuHtml() {
    const enJuego = s && ui.pantalla === "juego" && s.fase !== "fin";
    return `<div class="modal-in"><h2>Menú</h2><div class="menu-list">
      ${btn("ayuda", "Cómo se juega", "")}
      ${btn("tema", "Cambiar tema", "Claro, oscuro o el del móvil")}
      ${instalar ? btn("instalar", "Instalar en el móvil", "") : ""}
      ${btn("inicio", "Ir al inicio", "La partida se guarda")}
      ${enJuego ? btn("abandonar", "Abandonar la partida", "Acaba aquí y puedes mandar el informe") : ""}
      ${btn("cerrar", "Cerrar", "", { cls: "primary" })}
    </div></div>`;
  }
  function abrirModal(html) { modal.innerHTML = html; modal.hidden = false; }
  function cerrarModal() { modal.hidden = true; modal.innerHTML = ""; }

  // ------------------------------------------------------------------ informes
  function nombreArchivo(jug, fecha, modo) {
    const limpio = (jug || "anonimo").normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "anonimo";
    return `liber-${modo || ""}-${limpio}-${(fecha || "").slice(0, 16).replace(/[:T]/g, "-")}.txt`;
  }
  function informeActual() {
    const texto = E.informe(s);
    const fin = s.final ? `${E.FINALES[s.final.tipo] || s.final.tipo}, día ${s.final.dia}` : "sin acabar";
    return { texto, nombre: nombreArchivo(s.jugador, s.empezada, s.modo), resumen: `${s.jugador || "Anónimo"} jugó la ${R.MODOS[s.modo].nombre}. Final: ${fin}.` };
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
  function guardarEnHistorial() {
    if (!s || !s.final || s.enHistorial) return;
    const hist = load(LS.historial, []);
    hist.push({ fecha: s.empezada, modo: R.MODOS[s.modo].nombre, final: `${E.FINALES[s.final.tipo] || s.final.tipo}, día ${s.final.dia}`, informe: E.informe(s), jugador: s.jugador });
    while (hist.length > 12) hist.shift();
    store(LS.historial, hist);
    s.enHistorial = true;
  }
  function actualizarHistorial() {
    if (!s || !s.enHistorial) return;
    const hist = load(LS.historial, []);
    const x = hist.find((h) => h.fecha === s.empezada);
    if (x) { x.informe = E.informe(s); store(LS.historial, hist); }
  }

  // ------------------------------------------------------------------ acciones
  const ACC = {
    empezar(d) {
      const nombre = (document.getElementById("nombre") || {}).value || "";
      store(LS.nombre, nombre.trim());
      if (s && s.fase !== "fin" && !confirm("Hay una partida a medias. ¿Empezar otra? La de ahora se perderá.")) return;
      const sem = new URLSearchParams(location.search).get("semilla");
      s = E.nueva(d.id === "B" ? "B" : "A", nombre.trim(), sem || null);
      ui.pantalla = "juego";
    },
    continuar() { ui.pantalla = "juego"; },
    pestana(d) { ui.pestana = d.id === "ciudad" ? "ciudad" : "acciones"; render(); return "modal"; },
    empezarDia() { E.empezarJornada(s); },
    mover(d) { E.mover(s, d.id); E.comprobarNoche(s); },
    pedir() { E.pedir(s); },
    trabajo() { E.pedirTrabajo(s); },
    esperar() { E.esperar(s); E.comprobarNoche(s); },
    acabar() { E.acabarDia(s); E.comprobarNoche(s); },
    seguir() { E.seguir(s); },
    cenar(d) { E.cenar(s, +d.n || 0); if (s.fase === "fin") guardarEnHistorial(); },
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
    instalar() { if (instalar) { instalar.prompt(); instalar = null; } cerrarModal(); },
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
      const cuerpo = `${i.resumen}\n\n(Adjunta el informe descargado: ${i.nombre})\n\n` + i.texto.split("== Crónica ==")[0];
      location.href = `mailto:${R.CONFIG.email}?subject=${encodeURIComponent("Liber Vagatorum · informe de " + (s.jugador || "anónimo") + " · " + R.MODOS[s.modo].nombre)}&body=${encodeURIComponent(cuerpo.slice(0, 1800))}`;
      return "nada";
    },
    hDescargar(d) { const x = load(LS.historial, [])[+d.i]; if (x) descargar(x.informe, nombreArchivo(x.jugador, x.fecha, "")); return "nada"; },
    hCompartir(d) { const x = load(LS.historial, [])[+d.i]; if (x) compartir(x.informe, nombreArchivo(x.jugador, x.fecha, ""), `${x.jugador || "Anónimo"} · ${x.modo} · ${x.final}.`); return "nada"; },
    hCopiar(d) { const x = load(LS.historial, [])[+d.i]; if (x) copiar(x.informe); return "nada"; },
  };

  function aplicarTema() {
    const t = load(LS.tema, "auto");
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  function render() {
    let h;
    if (!s || ui.pantalla === "inicio") h = pantallaInicio();
    else if (s.fase === "amanecer") h = pantallaAmanecer();
    else if (s.fase === "resultado") h = pantallaResultado();
    else if (s.fase === "noche") h = pantallaNoche();
    else if (s.fase === "fin") h = pantallaFin();
    else h = pantallaDia();
    app.innerHTML = h;
    const hdr = app.querySelector(".top");
    document.documentElement.style.setProperty("--hdr", (hdr ? hdr.offsetHeight : 0) + "px");
    const clave = (ui.pantalla || "") + "|" + (s ? s.fase + "|" + s.dia : "");
    if (clave !== faseAntes) { window.scrollTo(0, 0); faseAntes = clave; }
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (el && !el.disabled) {
      const fn = ACC[el.dataset.act];
      if (!fn) return;
      const r = fn(Object.assign({}, el.dataset));
      if (r === "nada") return;
      if (r !== "modal") { if (s) store(LS.partida, s); render(); window.scrollTo(0, 0); }
      return;
    }
    const nodo = ev.target.closest("[data-mapa]");
    if (nodo && s && s.fase === "dia") {
      const o = E.opciones(s);
      const mv = o.movs.find((m) => m.destino === nodo.dataset.mapa && m.ok);
      if (mv) { E.mover(s, mv.destino); E.comprobarNoche(s); store(LS.partida, s); render(); window.scrollTo(0, 0); }
      return;
    }
    if (ev.target === modal) cerrarModal();
  });
  document.addEventListener("input", (ev) => {
    const k = ev.target.dataset && ev.target.dataset.enc;
    if (k && s) { s.encuesta = s.encuesta || {}; s.encuesta[k] = ev.target.value; store(LS.partida, s); }
  });

  window.addEventListener("resize", () => {
    const hdr = app.querySelector(".top");
    if (hdr) document.documentElement.style.setProperty("--hdr", hdr.offsetHeight + "px");
  });
  aplicarTema();
  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  window.__LV = { get s() { return s; }, ui, render };
})();
