/* Liber Vagatorum — interfaz del prototipo. JavaScript sin dependencias. */
(function () {
  "use strict";
  const R = window.RULES, E = window.ENGINE, P = R.PARAMS;
  const LS = { partida: "lv_partida", historial: "lv_historial", catalogo: "lv_catalogo", jugador: "lv_jugador", tema: "lv_tema", intro: "lv_intro" };

  // ---------------------------------------------------------------- almacenamiento
  function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  function borrar(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }

  let s = load(LS.partida, null);
  if (s && (!s.v || s.v !== R.version)) s.versionAntigua = true;
  const ui = { pantalla: "inicio", sitio: null, accion: null, dado: null, contacto: "nuevo", pend: null, treta: null, dadoTreta: null, noche: null, compra: null, nocheRes: null, castigoRes: null, menu: false };
  let ultimaVista = "";
  let promptInstalar = null;

  function persistir() {
    if (!s) return;
    save(LS.partida, s);
    const glob = load(LS.catalogo, []);
    let cambio = false;
    s.catalogo.forEach((c) => { if (!glob.some((g) => g.treta === c.treta && g.partida === c.partida)) { glob.push(c); cambio = true; } });
    if (cambio) save(LS.catalogo, glob);
    if (s.final && !s.archivada) archivar();
  }

  function archivar() {
    const h = load(LS.historial, []);
    const i = h.findIndex((x) => x.id === s.id);
    const item = { id: s.id, jugador: s.jugador, personaje: E.pj(s).nombre, final: s.final, fecha: s.fin || new Date().toISOString(), informe: E.informe(s) };
    if (i >= 0) h[i] = item; else h.unshift(item);
    save(LS.historial, h.slice(0, 30));
    s.archivada = true;
    save(LS.partida, s);
  }

  // ---------------------------------------------------------------- utilidades
  const esc = (t) => String(t === null || t === undefined ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sg = (n) => (n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0");
  const clasif = (t) => R.CLASIF[String(t)];
  const plural = (n, a, b) => n + " " + (n === 1 ? a : b);

  function aplicarTema() {
    const t = load(LS.tema, null);
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }

  function resetUI() {
    Object.assign(ui, { sitio: null, accion: null, dado: null, contacto: "nuevo", pend: null, treta: null, dadoTreta: null, noche: null, compra: null, comeNino: true });
  }

  // ---------------------------------------------------------------- ayudas
  const AYUDA_METRO = {
    cuerpo: ["Cuerpo", "Tu salud y tu fuerza, de 0 a 10. Cada mañana decide cuántos dados tiras: 9-10, cinco; 7-8, cuatro; 5-6, tres; 3-4, dos; 1-2, uno. A 0, mueres. Dormir al raso cuesta 1 cada noche. Bajo techo no lo pierdes, pero no se recupera solo: sube descansando sin que te vean (con dado 3 o más) o curándote en el hospital. Baja con el hambre, el raso, las fiebres, los robos y los azotes."],
    monedas: ["Monedas", "Para comprar pan y pagar el mesón (cuesta una ración más 2 monedas). Ojo: un pobre con dinero es sospechoso. Con más de 4 monedas encima, si te ven pedir un alguacil o la beneficencia, te tienen por fingidor (+1); si duermes al raso, te pueden robar la mitad y pegarte; y si te detienen, te lo quitan todo."],
    raciones: ["Raciones", "Cada noche comes una; si llevas a tu hijo, él también come una. Si te falta, pierdes 2 de cuerpo por cada ración que falte. Se compran de noche al precio del pan de ese día, que va subiendo. Solo puedes guardar 2 de una noche a otra: lo que sobre se pierde, así que mejor compártelo. La sopa del convento y las sobras del mercado dan raciones."],
    rumores: ["Rumores", "Lo que te cuentan otros pobres. Cuando te vea un testigo, puedes gastar un rumor para repetir el dado de testigo (sabías por dónde pasaba la ronda)."],
    termo: ["Termómetro", "Cómo te clasifica la autoridad, de −3 a +3. Hacia arriba: +1 sospechoso, +2 vagabundo, +3 reincidente (solo si ya te han detenido alguna vez: antes no pasas de +2). Hacia abajo: −1 pobre conocido, −2 con licencia (solo con el examen del cura, y solo naturales) y −3 recogido (te encierran y la partida acaba; solo pasa en el hospital). Sin licencia no bajas de −1. El termómetro no mata solo: decide el castigo si te detienen."],
    tb: ["Te buscan", `Cuánto te tiene fichado la justicia. Cuando llega a ${P.tbMax}, te detienen. El castigo depende del termómetro: con 0 o menos, reprensión; con +1, azotes; con +2, trabajo forzado o marca; con +3, la horca. Después de cada detención ya te conocen: empieza en el número de veces que te han detenido (hasta 3).`],
    muralla: ["La muralla", "El puente y el arrabal están fuera de la muralla; el resto de sitios, dentro. Para pasar de un lado a otro tienes que cruzar la puerta en el puente, donde la guardia vigila a los forasteros. Si la autoridad cierra la puerta, sin licencia no entras. Para dormir en el arrabal tienes que estar fuera."],
    red: ["Tu red", "Los pobres que conoces. Compartir o preguntar sube la relación; negar comida a quien te la pide, la baja. Con relación 2: puedes dormir con esa persona (si vive de tu lado de la muralla), te encubre si te ve hurtar y, si mueres, no mueres solo. Con relación 3: si te falta pan, te da una ración. Pero la autoridad interroga a tu gente: con relación baja, te venden. Y enferman, desaparecen o mueren. Solo puedes delatar a alguien de tu red, y lo pierdes."],
    hospital: ["Hospital", "Solo admite enfermos (cuerpo 5 o menos). Cada vez que te curan o duermes allí, te apuntan en el libro. A la tercera, te recogen: entras en la institución y la partida acaba."],
    nino: ["Tu hijo", R.AYUDA.find((x) => x[0] === "Tu hijo (viuda)")[1]],
    licencia: ["Licencia", "Con el termómetro en −2 tienes licencia para pedir: el cura te la da si apruebas el examen (solo naturales). La pierdes en cuanto el termómetro sube de −2, por ejemplo si un alguacil te ve hacer algo sospechoso. Para recuperarla, otro examen."],
    treta: ["Treta", "La has preparado al amanecer. Durante todo el día pides con ella: si su calidad es 4 o más y no está catalogada, te dan una moneda más, y te tienen por impedido. Pero si te ve la beneficencia o el cura, tiran un dado: si iguala o supera la calidad (más 1 si está catalogada), te descubren."],
  };

  function abrirModal(html) {
    const m = document.getElementById("modal");
    m.innerHTML = `<div class="modal-in" role="dialog" aria-modal="true">${html}<button class="btn primary" data-act="cerrarModal">Cerrar</button></div>`;
    m.hidden = false;
  }
  function cerrarModal() { const m = document.getElementById("modal"); m.hidden = true; m.innerHTML = ""; }

  function htmlAyuda() {
    let h = `<h2>Cómo se juega</h2>`;
    R.AYUDA.forEach(([t, d]) => { h += `<h3>${esc(t)}</h3><p>${esc(d)}</p>`; });
    h += `<h3>Quién te puede ver</h3><table class="t">`;
    Object.keys(R.TESTIGO_DESC).filter((k) => k !== "Vecinos (la víctima)").forEach((k) => { h += `<tr><td><b>${esc(k)}</b></td><td>${esc(R.TESTIGO_DESC[k])}</td></tr>`; });
    h += `</table><h3>Las acciones</h3><table class="t">`;
    Object.values(R.ACCIONES).forEach((a) => { h += `<tr><td><b>${esc(a.nombre)}</b></td><td>${esc(a.desc)}</td></tr>`; });
    h += `<tr><td><b>Fingir</b></td><td>Solo al amanecer. Gastas un dado y su valor es la calidad de la treta para todo el día.</td></tr></table>`;
    h += `<h3>Los sitios</h3><table class="t">`;
    R.SITIOS.forEach((x) => { h += `<tr><td><b>${esc(x.nombre)}</b></td><td>${esc(x.desc)}</td></tr>`; });
    h += `</table>`;
    return h;
  }

  function htmlRed() {
    if (!s || !s.contactos.length) return `<h2>Tu red</h2><p>Todavía no conoces a nadie. Compartir o preguntar en el convento, la ribera o el mesón te pone en contacto con otros pobres.</p><p class="muted small">${esc(AYUDA_METRO.red[1])}</p>`;
    let h = `<h2>Tu red</h2><table class="t"><tr><th>Persona</th><th>Relación</th><th>Estado</th></tr>`;
    s.contactos.forEach((c) => {
      const est = c.estado ? { muerto: "Ha muerto", traidor: "Te vendió", delatado: "Lo delataste" }[c.estado] : (c.ausenteHasta && c.ausenteHasta >= s.dia ? (c.ausenteMotivo === "enfermo" ? "Enfermo" : "Detenido") + " hasta el día " + c.ausenteHasta : (c.lado === "fuera" ? "Vive en el arrabal" : "Vive en la ciudad"));
      h += `<tr><td>${c.estado ? "<s>" + esc(c.nombre) + "</s>" : esc(c.nombre)}</td><td>${c.estado ? "—" : c.rel}</td><td>${esc(est)}</td></tr>`;
    });
    return h + `</table><p class="muted small">${esc(AYUDA_METRO.red[1])}</p>`;
  }

  // ---------------------------------------------------------------- vistas comunes
  function vTop() {
    const fr = s.fase === "franja" ? " · " + R.FRANJAS[s.franja] : s.fase === "amanecer" ? " · amanecer" : ["noche", "castigo", "autoridad"].includes(s.fase) ? " · noche" : "";
    return `<header class="top"><div class="top-in">
      <div class="top-row"><span class="top-title">Día ${s.dia} de ${R.CALENDARIO.length}${fr}</span>
        <button class="icon-btn" data-act="ayuda" aria-label="Cómo se juega">?</button>
        <button class="icon-btn" data-act="menu" aria-label="Menú">☰</button></div>
      ${s.fase === "fin" ? "" : vEstado()}
    </div></header>`;
  }

  function vEstado() {
    const nec = E.racionesNecesarias(s);
    const dadosMan = E.dadosPorCuerpo(s.cuerpo);
    let termo = "";
    const techo = E.techo(s);
    for (let t = -3; t <= 3; t++) termo += `<span class="${t === s.termo ? "on" : ""} ${t > techo ? "cerrado" : ""}" ${t > techo ? 'title="Solo si ya te han detenido"' : ""}>${t > 0 ? "+" + t : t === 0 ? "0" : "−" + Math.abs(t)}</span>`;
    let pips = "";
    for (let i = 1; i <= P.tbMax; i++) pips += `<span class="pip ${i <= s.tb ? "on" : ""}"></span>`;
    const b = [];
    b.push(`<span class="badge" data-act="metro" data-k="muralla">${s.fuera ? "Fuera de la muralla" : "Dentro de la muralla"}</span>`);
    if (s.nino) {
      const n = s.nino, cuida = n.con ? s.contactos.find((c) => c.id === n.con) : null;
      if (n.perdido) b.push(`<span class="badge mal" data-act="metro" data-k="nino">Se han llevado a tu hijo</span>`);
      else b.push(`<span class="badge ${n.cuerpo <= 2 ? "mal" : ""}" data-act="metro" data-k="nino">Tu hijo: cuerpo ${n.cuerpo} de ${P.ninoMax}${cuida ? ", con " + esc(cuida.nombre.split(" ")[0]) : ""}</span>`);
    }
    if (E.licencia(s)) b.push(`<span class="badge bien" data-act="metro" data-k="licencia">Con licencia</span>`);
    if (s.marca) b.push(`<span class="badge mal" data-act="metro" data-k="termo">Marcado</span>`);
    if (s.treta) b.push(`<span class="badge" data-act="metro" data-k="treta">Treta: ${esc(s.treta.nombre)} (${s.treta.calidad})${s.treta.catalogada ? ", catalogada" : ""}</span>`);
    if (s.venganza) b.push(`<span class="badge mal" data-act="metro" data-k="red">Alguien quiere vengarse</span>`);
    if (s.tf > 0) b.push(`<span class="badge mal">Trabajo forzado: ${plural(s.tf, "día", "días")}</span>`);
    if (s.detenciones) b.push(`<span class="badge mal" data-act="metro" data-k="tb">Te conocen: ${plural(s.detenciones, "detención", "detenciones")}</span>`);
    if (s.apuntes) b.push(`<span class="badge mal" data-act="metro" data-k="hospital">Apuntado en el hospital: ${s.apuntes} de ${P.hospitalVeces}</span>`);
    if (s.monedas > P.dineroUmbral) b.push(`<span class="badge mal" data-act="metro" data-k="monedas">Llevas demasiado dinero encima</span>`);
    const red = E.contactosDisponibles(s);
    b.push(`<span class="badge" data-act="red">Red: ${red.length ? red.map((c) => esc(c.nombre.split(" ")[0]) + " " + c.rel).join(", ") : "nadie"}${s.contactos.length > red.length ? " (+" + (s.contactos.length - red.length) + " que no están)" : ""}</span>`);
    return `<div class="estado">
        <button class="chip ${s.cuerpo <= 2 ? "alerta" : ""}" data-act="metro" data-k="cuerpo">Cuerpo<b>${s.cuerpo}</b>${dadosMan} dados</button>
        <button class="chip" data-act="metro" data-k="monedas">Monedas<b>${s.monedas}</b>pan a ${E.precioPan(s)}</button>
        <button class="chip ${s.raciones < nec ? "alerta" : ""}" data-act="metro" data-k="raciones">Raciones<b>${s.raciones}</b>${E.ninoConmigo(s) ? "coméis" : "comes"} ${nec}</button>
        <button class="chip" data-act="metro" data-k="rumores">Rumores<b>${s.rumores}</b>repiten testigo</button>
      </div>
      <div class="fila-metro" data-act="metro" data-k="termo"><span class="lbl">Termómetro</span><div class="termo">${termo}</div><span class="termo-lbl">${esc(clasif(s.termo))}</span></div>
      <div class="fila-metro" data-act="metro" data-k="tb"><span class="lbl">Te buscan</span><div class="pips">${pips}</div><span class="termo-lbl">${s.tb} de ${P.tbMax}</span></div>
      <div class="badges">${b.join("")}</div>`;
  }

  function dadosHtml(sel, clic) {
    return `<div class="dados">${s.dados.map((d, i) => `<button class="dado ${d.usado ? "usado" : ""} ${sel === i ? "sel" : ""}" ${d.usado || !clic ? "disabled" : `data-act="${clic}" data-i="${i}"`} aria-label="Dado ${d.v}">${d.v}</button>`).join("")}</div>`;
  }

  function cambiosHtml(a, b) {
    const items = [["monedas", "Monedas"], ["raciones", "Raciones"], ["cuerpo", "Cuerpo"], ["termo", "Termómetro"], ["tb", "Te buscan"], ["rumores", "Rumores"]];
    const out = [];
    items.forEach(([k, l]) => {
      const d = b[k] - a[k];
      if (!d) return;
      const bueno = k === "termo" || k === "tb" ? d < 0 : d > 0;
      out.push(`<span class="cambio ${bueno ? "mas" : "menos"}">${l} ${sg(d)}${k === "termo" ? " → " + esc(clasif(b.termo)) : ""}</span>`);
    });
    if (a.termo !== -2 && b.termo === -2) out.push(`<span class="cambio mas">Consigues la licencia</span>`);
    if (a.termo === -2 && b.termo !== -2 && b.termo !== -3) out.push(`<span class="cambio menos">Pierdes la licencia</span>`);
    if (typeof a.nino === "number" && b.nino === "perdido") out.push(`<span class="cambio menos">Se llevan a tu hijo</span>`);
    else if (typeof a.nino === "number" && typeof b.nino === "number" && a.nino !== b.nino) out.push(`<span class="cambio ${b.nino > a.nino ? "mas" : "menos"}">Tu hijo ${sg(b.nino - a.nino)}</span>`);
    if (a.ninoCon !== b.ninoCon && b.nino !== "perdido") out.push(`<span class="cambio">${b.ninoCon ? "El niño se queda con otra persona" : "El niño vuelve contigo"}</span>`);
    if (a.fuera !== b.fuera) out.push(`<span class="cambio">${b.fuera ? "Ahora estás fuera de la muralla" : "Ahora estás dentro de la muralla"}</span>`);
    return out.length ? `<div class="cambios">${out.join("")}</div>` : `<p class="muted small">Nada cambia.</p>`;
  }

  // ---------------------------------------------------------------- pantallas sin partida
  function vInicio() {
    const nombre = load(LS.jugador, "");
    let cont = "";
    if (s && !s.final) {
      cont = `<div class="card aviso"><h3>Tienes una partida a medias</h3><p>${esc(s.jugador)} · ${esc(E.pj(s).nombre)} · día ${s.dia}.</p>
        ${s.versionAntigua ? `<p class="small">Se empezó con otra versión del juego: puede fallar. Mejor empieza una nueva.</p>` : ""}
        <button class="btn primary" data-act="continuar">Continuar</button>
        <button class="btn secundario" data-act="abandonarDesdeInicio">Abandonarla y mandar su informe</button></div>`;
    } else if (s && s.final) {
      cont = `<div class="card"><p>Tu última partida acabó: ${esc(s.final.tipo)} el día ${s.final.dia}.</p><button class="btn secundario" data-act="verFinal">Ver el final y el informe</button></div>`;
    }
    const iosHint = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;
    return `<main class="wrap">
      <h1>Liber Vagatorum</h1>
      <p class="muted">Prototipo jugable · versión ${esc(R.version)}</p>
      <p>Salamanca, junio de 1545. Eres pobre. La autoridad acaba de decidir quién merece limosna y quién es un vagabundo. Tienes diez días para no acabar en la horca, muerto de hambre o encerrado.</p>
      <p class="muted small">Es un prototipo para probar las reglas: no hay dibujos ni música. Al final te pediré tres respuestas cortas y te daré un informe para mandárselo a Sergio.</p>
      ${cont}
      <label class="campo" for="nombre">¿Cómo te llamas?</label>
      <input type="text" id="nombre" maxlength="40" autocomplete="name" placeholder="Tu nombre o apodo" value="${esc(nombre)}">
      <p class="muted small">Solo sirve para saber quién ha jugado. Se guarda en este dispositivo y va en el informe.</p>
      <button class="btn primary" data-act="empezar">Empezar una partida nueva</button>
      <button class="btn secundario" data-act="ayuda">Cómo se juega</button>
      <button class="btn secundario" data-act="historial">Partidas jugadas en este dispositivo</button>
      ${promptInstalar ? `<button class="btn secundario" data-act="instalar">Instalar en el móvil</button>` : ""}
      ${iosHint ? `<p class="muted small">En iPhone: botón Compartir → «Añadir a pantalla de inicio» para tenerlo como una app.</p>` : ""}
      <div class="pie"><button class="link" data-act="tema">Cambiar tema claro/oscuro</button></div>
    </main>`;
  }

  function vPersonaje() {
    return `<main class="wrap"><h2>Elige quién eres</h2>
      <p class="muted">Cada uno vive la misma ciudad de forma distinta. Tu origen y tu cuerpo deciden qué puedes hacer.</p>
      ${R.PERSONAJES.map((p) => `<div class="card"><h3>${esc(p.nombre)}</h3>
        <p class="muted small">${esc(p.origen)} · ${esc(p.cuerpoTipo)}</p>
        <p>${esc(p.resumen)}</p>
        <ul class="lista small">${p.claves.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        <button class="btn primary" data-act="elegirPj" data-id="${p.id}">Jugar con este personaje</button></div>`).join("")}
      <button class="btn secundario" data-act="inicio">Volver</button></main>`;
  }

  function vHistorial() {
    const h = load(LS.historial, []);
    return `<main class="wrap"><h2>Partidas jugadas aquí</h2>
      ${h.length ? h.map((x, i) => `<div class="card"><p><b>${esc(x.jugador)}</b> · ${esc(x.personaje)}</p>
        <p class="muted small">${esc(new Date(x.fecha).toLocaleString("es-ES"))} · ${esc(x.final.tipo)} el día ${x.final.dia}</p>
        <div class="fila-btns"><button class="btn" data-act="hCompartir" data-i="${i}">Compartir</button><button class="btn" data-act="hDescargar" data-i="${i}">Descargar</button><button class="btn" data-act="hCorreo" data-i="${i}">Correo</button></div></div>`).join("") : `<p>Todavía no hay ninguna.</p>`}
      <button class="btn secundario" data-act="inicio">Volver</button></main>`;
  }

  // ---------------------------------------------------------------- amanecer
  function vAmanecer() {
    const c = E.cal(s.dia);
    const aut = E.resumenAutoridad(s, s.dia);
    const pe = E.pregonExpulsion(s.dia);
    let h = `<h2>${esc(c.fecha)}</h2><p>${esc(c.que)} <span class="muted">Pan a ${c.pan} la ración.</span></p>`;
    if (pe) h += `<p class="small"><b>${esc(pe)}</b>${E.pj(s).forastero ? " Eres forastero: ese día no te pueden ver dentro de la muralla sin licencia." : ""}</p>`;
    if (s.dia === 1 && !load(LS.intro, false)) {
      h += `<div class="card aviso"><h3>Cómo va un día</h3><ol class="lista small">
        <li>Al amanecer ves tus dados. Cada acción del día gasta uno y su valor es lo bien que te sale.</li>
        <li>Hay cinco franjas. En cada una eliges sitio y acción. Antes de hacerlo verás quién te puede ver y qué te pasaría.</li>
        <li>Por la noche eliges dónde dormir y compras pan.</li>
        <li>Mientras duermes, la autoridad mueve ficha según lo que vio. Lo verás al amanecer.</li></ol>
        <p class="small">Toca cualquier marcador de arriba para ver qué significa. El botón «?» abre la ayuda completa.</p>
        <button class="btn secundario" data-act="introVista">Entendido</button></div>`;
    }
    h += `<div class="card"><h3>Lo que ha hecho la autoridad</h3>${aut.length ? `<ul class="lista">${aut.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="muted">Nada que se vea.</p>`}</div>`;
    if (s.hoy.suceso) h += `<div class="card ${s.hoy.suceso.id === "cofradia" ? "bueno" : s.hoy.suceso.id === "nada" ? "" : "aviso"}"><h3>${esc(s.hoy.suceso.titulo)}</h3><p>${esc(s.hoy.suceso.txt)}</p></div>`;
    s.hoy.eventos.filter((x) => !(s.hoy.suceso && x.startsWith(s.hoy.suceso.titulo)) && !(s.hoy.favor && x.startsWith(s.hoy.favor.nombre + " te pide"))).forEach((x) => { h += `<div class="card aviso"><p>${esc(x)}</p></div>`; });
    if (s.hoy.favor) {
      const f = s.hoy.favor;
      if (!f.respondido) h += `<div class="card aviso"><h3>${esc(f.nombre)} te pide algo de comer</h3>
        <p class="small">Si le das una ración, vuestra relación sube (+1). Si no, baja (−1). Si empiezas el día sin contestar, cuenta como que no. Tienes ${plural(s.raciones, "ración", "raciones")}.</p>
        <div class="fila-btns"><button class="btn" data-act="favor" data-d="1" ${s.raciones < 1 ? "disabled" : ""}>Darle una ración</button><button class="btn" data-act="favor" data-d="0">No darle nada</button></div></div>`;
      else h += `<div class="card"><p>${esc(f.txt)}</p></div>`;
    }
    if (s.nino) h += cardNino();
    if (s.hoy.forzado) {
      h += `<button class="btn primary" data-act="empezarDia">Pasar el día en el trabajo forzado</button>`;
      return h;
    }
    const libres = s.dados.filter((d) => !d.usado).length;
    h += `<div class="card"><h3>Tus dados de hoy</h3>${dadosHtml(null, null)}
      <p class="small">Tienes ${plural(s.dados.length, "dado", "dados")} para cinco franjas: cada acción gasta uno. Piensa dónde va cada valor: un 6 rinde mucho pidiendo en misa; un 1 no te da nada al pedir.</p></div>`;
    if (!s.treta && libres > 0) {
      h += `<div class="card"><h3>¿Fingir hoy? <span class="muted small">(opcional)</span></h3>
        <p class="small">Gastas un dado en preparar una treta. Su valor es la calidad de la treta para todo el día: si es 4 o más, cada petición te da una moneda más, y te tienen por impedido. Si te ve la beneficencia o el cura, tiran un dado: si iguala o supera la calidad, te descubren (+2, Te buscan +2).</p>
        <p class="paso">1. Elige la treta</p>
        ${R.TRETAS.map((t) => { const cat = E.catalogada(s, t.nombre); const of = E.pj(s).tretaOficio === t.nombre;
          return `<button class="btn ${ui.treta === t.nombre ? "sel" : ""}" data-act="treta" data-t="${esc(t.nombre)}"><span class="t">${esc(t.nombre)}${of ? " (+1: es tu oficio)" : ""}</span><span class="d">${esc(t.desc)}</span>${cat ? `<span class="no">Catalogada por la autoridad: rinde menos y te pillan antes.</span>` : ""}</button>`; }).join("")}
        ${ui.treta ? `<p class="paso">2. Elige el dado que gastas</p>${dadosHtml(ui.dadoTreta, "dadoTreta")}
          <button class="btn primary" data-act="fingir" ${ui.dadoTreta === null ? "disabled" : ""}>Fingir${ui.dadoTreta !== null ? " con el " + s.dados[ui.dadoTreta].v : ""}</button>` : ""}
      </div>`;
    } else if (s.treta) {
      h += `<div class="card bueno"><p>Hoy finges: <b>${esc(s.treta.nombre)}</b>, calidad ${s.treta.calidad}${s.treta.catalogada ? " (catalogada)" : ""}. Todas tus peticiones de hoy serán con esta treta.</p></div>`;
    }
    h += `<button class="btn primary" data-act="empezarDia">Empezar el día: prima</button>`;
    return h;
  }

  function cardNino() {
    const n = s.nino;
    if (n.perdido) return `<div class="card malo"><h3>Tu hijo</h3><p>${esc(n.motivo)}</p></div>`;
    const estado = `Su cuerpo: <b>${n.cuerpo} de ${P.ninoMax}</b>${n.cuerpo <= P.ninoDebil ? " — muy débil: dentro de la muralla, el cura se lo puede llevar" : n.cuerpo <= 2 ? " — está flojo" : ""}.`;
    if (n.con) {
      const c = s.contactos.find((x) => x.id === n.con);
      return `<div class="card"><h3>Tu hijo está con ${esc(c.nombre)}</h3><p class="small">${estado} Allí duerme bajo techo y come. Cada noche le das a ${esc(c.nombre.split(" ")[0])} una ración o su precio; si no puedes, la relación baja. Mientras no está contigo, la limosna rinde menos. Si se llevan a ${esc(c.nombre.split(" ")[0])}, lo pierdes.</p>
        <button class="btn" data-act="recogerNino">Recogerlo: hoy va contigo</button></div>`;
    }
    const cuid = E.puedeCuidar(s);
    let h = `<div class="card ${n.cuerpo <= 2 ? "aviso" : ""}"><h3>Tu hijo va contigo</h3><p class="small">${estado} Come cada noche. Con él al lado, la limosna en moneda rinde +${P.ninoPedir}. Si te detienen, se lo llevan, salvo que alguien de tu red se quede con él.</p>`;
    if (cuid.length) {
      h += `<p class="small">Puedes dejarlo hoy con alguien de tu red (relación 2 o más). Le darás cada noche una ración o su precio.</p>`;
      cuid.forEach((c) => { h += `<button class="btn" data-act="dejarNino" data-id="${c.id}"><span class="t">Dejarlo con ${esc(c.nombre)}</span><span class="d">Relación ${c.rel}</span></button>`; });
    } else h += `<p class="muted small">No tienes a nadie de confianza (relación 2 o más) con quien dejarlo.</p>`;
    return h + `</div>`;
  }

  // ---------------------------------------------------------------- franja
  function vFranja() {
    const fr = R.FRANJAS[s.franja];
    const libres = s.dados.filter((d) => !d.usado).length;
    let h = `<h2>${esc(fr)}</h2><p class="muted">${esc(R.FRANJA_DESC[fr])}</p>
      <p class="small">Dados que te quedan: ${libres ? "" : "ninguno"}</p>${libres ? dadosHtml(null, null) : ""}`;
    if (!libres) h += `<div class="card aviso"><p>No te quedan dados: solo puedes cruzar la puerta (no gasta dado) o dejar pasar el día.</p></div>`;
    const sitios = E.sitiosDisponibles(s);
    if (!ui.sitio) {
      h += `<p class="paso">1. ¿Adónde vas?</p><p class="muted small">Moverte entre sitios es gratis${s.fuera ? ", pero estás fuera de la muralla" : ""}.</p>`;
      sitios.forEach((x) => {
        h += `<button class="btn" data-act="sitio" data-id="${x.id}" ${x.ok ? "" : "disabled"}><span class="t">${esc(x.nombre)}</span><span class="d">${esc(x.texto)}</span>${x.notas.map((n) => `<span class="n">${esc(n)}</span>`).join("")}${x.ok ? "" : `<span class="no">${esc(x.motivo)}</span>`}</button>`;
      });
    } else {
      const x = sitios.find((y) => y.id === ui.sitio);
      h += `<p class="paso">1. Sitio</p><div class="btn sel"><span class="t">${esc(x.nombre)}</span><span class="d">${esc(x.texto)}</span>${x.notas.map((n) => `<span class="n">${esc(n)}</span>`).join("")}</div>
        <button class="link" data-act="cambiarSitio">Cambiar de sitio</button>`;
      const acciones = E.accionesEn(s, ui.sitio);
      if (!ui.accion) {
        h += `<p class="paso">2. ¿Qué haces?</p>`;
        acciones.forEach((a) => {
          h += `<button class="btn" data-act="accion" data-id="${a.id}" ${a.ok ? "" : "disabled"}><span class="t">${esc(a.nombre)}${a.dado ? "" : " · no gasta dado"}</span><span class="d">${esc(a.desc)}</span>${a.aviso && a.ok ? `<span class="n">${esc(a.aviso)}</span>` : ""}${a.ok ? "" : `<span class="no">${esc(a.motivo)}</span>`}</button>`;
        });
      } else {
        const a = acciones.find((y) => y.id === ui.accion);
        h += `<p class="paso">2. Acción</p><div class="btn sel"><span class="t">${esc(a.nombre)}</span><span class="d">${esc(a.desc)}</span>${a.aviso ? `<span class="n">${esc(a.aviso)}</span>` : ""}</div>
          <button class="link" data-act="cambiarAccion">Cambiar de acción</button>`;
        const pv = E.previewTestigos(s, ui.sitio, ui.accion);
        if (pv) {
          h += `<p class="paso">Quién te puede ver aquí</p><p class="muted small">Se tira un dado de testigo. Según lo que salga:</p><table class="t">`;
          pv.forEach((f) => { h += `<tr><td class="caras">${f.caras.length === 1 ? f.caras[0] : f.caras[0] + "-" + f.caras[f.caras.length - 1]}</td><td><b>${esc(f.testigo)}</b>: ${esc(f.efecto)}</td></tr>`; });
          h += `</table>`;
          if (s.venganza) h += `<p class="small" style="color:var(--bad)">Si te ve otro pobre, puede ser el que delataste: te delatará (Te buscan +2).</p>`;
        } else h += `<p class="muted small">Esta acción no tira dado de testigo.</p>`;
        if (a.red) {
          h += `<p class="paso">3. ${ui.accion === "delatar" ? "¿A quién delatas?" : "¿Con quién?"}</p>`;
          if (ui.accion !== "delatar") h += `<button class="btn ${ui.contacto === "nuevo" ? "sel" : ""}" data-act="contacto" data-id="nuevo"><span class="t">Con alguien nuevo</span></button>`;
          E.contactosDisponibles(s).forEach((c) => { h += `<button class="btn ${ui.contacto === c.id ? "sel" : ""}" data-act="contacto" data-id="${c.id}"><span class="t">${esc(c.nombre)}</span><span class="d">Relación ${c.rel}${ui.accion === "delatar" ? " · lo perderás" : ""}</span></button>`; });
        }
        if (a.dado) {
          h += `<p class="paso">${a.red ? "4" : "3"}. ¿Qué dado usas?</p>`;
          s.dados.forEach((d, i) => {
            if (d.usado) return;
            h += `<button class="btn ${ui.dado === i ? "sel" : ""}" data-act="dado" data-i="${i}"><span class="opcion-dado"><span class="dado mini">${d.v}</span><span>${esc(E.ganancia(s, ui.sitio, ui.accion, d.v) || "")}</span></span></button>`;
          });
        }
        const listo = !a.dado || ui.dado !== null;
        h += `<button class="btn primary" data-act="hacer" ${listo ? "" : "disabled"}>${listo ? "Hacerlo" : "Elige un dado"}</button>`;
      }
    }
    h += `<div class="fila-btns"><button class="btn secundario" data-act="pasar">No hacer nada en ${esc(fr.toLowerCase())}</button><button class="btn secundario" data-act="acabarDia">Acabar el día</button></div>`;
    return h;
  }

  function vResultado() {
    const { eleccion, o, antes, despues } = ui.pend;
    const st = E.sitio(eleccion.sitio);
    let h = `<h2>${esc(R.FRANJAS[s.franja])}: ${esc(R.ACCIONES[eleccion.accion].nombre.toLowerCase())}</h2><p class="muted">${esc(st.nombre)}</p>`;
    h += `<div class="card ${o.detenido ? "malo" : ""}">`;
    if (o.v) h += `<p class="small">Tu dado: <span class="dado mini">${o.v}</span>${o.w ? ` · dado de testigo: <span class="dado mini">${o.w}</span>` : ""}${o.x ? ` · dado extra: <span class="dado mini">${o.x}</span>` : ""}</p>`;
    else if (o.w) h += `<p class="small">Dado de testigo: <span class="dado mini">${o.w}</span></p>`;
    h += `<p class="grande">${esc(o.resultado)}</p>`;
    o.lineas.forEach((l) => { h += `<p>${esc(l)}</p>`; });
    h += cambiosHtml(antes, despues) + `</div>`;
    if (o.testigo && s.rumores > 0 && !eleccion.rumorGastado) {
      h += `<button class="btn secundario" data-act="rumor">Gastar un rumor y repetir el dado de testigo (tienes ${s.rumores})</button>`;
    }
    h += `<button class="btn primary" data-act="seguir">${o.detenido ? (E.pj(s).id === "viuda" ? "Te llevan detenida" : "Te llevan detenido") : "Seguir"}</button>`;
    return h;
  }

  // ---------------------------------------------------------------- castigo, noche y autoridad
  function vCastigo() {
    const c = E.castigoPendiente(s);
    let h = "";
    if (ui.nocheRes) h += vNocheResumen();
    h += `<h2>Te han detenido</h2><div class="card malo"><p>${esc(c.motivo)}</p>
      <p>Tu termómetro está en <b>${sg(c.termo)} (${esc(c.clasificacion)})</b>. El castigo es: <b>${esc(c.texto)}</b>.</p></div>`;
    if (c.eleccion) {
      h += `<p>Eliges tú:</p>
        <button class="btn" data-act="castigo" data-e="trabajo"><span class="t">Trabajo forzado</span><span class="d">${P.tfDias} días sin acciones, −1 de cuerpo cada día. No necesitas comer.</span></button>
        <button class="btn" data-act="castigo" data-e="marca"><span class="t">Marca</span><span class="d">Sigues libre, pero el termómetro ya no bajará de +1. Otra detención, y estarás más cerca de la horca.</span></button>`;
    } else h += `<button class="btn primary" data-act="castigo" data-e="">${c.termo >= 3 ? "Seguir" : "Aceptar el castigo"}</button>`;
    return h;
  }

  function vNoche() {
    const ops = E.opcionesNoche(s);
    const pan = E.precioPan(s), nec = E.racionesNecesarias(s);
    if (!ui.noche || !ops.some((x) => x.id === ui.noche && x.ok)) ui.noche = (ops.find((x) => x.ok && !x.peligro) || ops.find((x) => x.ok) || {}).id || null;
    const op = ops.find((x) => x.id === ui.noche);
    const coste = op ? op.coste : 0;
    const maxCompra = Math.max(0, Math.floor((s.monedas - coste) / pan));
    if (ui.compra === null) ui.compra = Math.min(maxCompra, Math.max(0, nec - s.raciones));
    ui.compra = Math.min(ui.compra, maxCompra);
    let h = `<h2>Noche del día ${s.dia}</h2>`;
    if (ui.castigoRes) h += `<div class="card malo"><p><b>${esc(ui.castigoRes.tipo)}.</b> ${esc(ui.castigoRes.txt)}</p></div>`;
    h += `<p class="paso">1. ¿Dónde duermes?</p>`;
    ops.forEach((x) => {
      h += `<button class="btn ${ui.noche === x.id ? "sel" : ""}" data-act="noche" data-id="${x.id}" ${x.ok ? "" : "disabled"}><span class="t">${esc(x.nombre)}</span><span class="d">${esc(x.desc)}</span>
        ${x.riesgos.map((r) => `<span class="${/Cuidado/.test(r) ? "no" : "n"}">${esc(r)}</span>`).join("")}${x.ok ? "" : `<span class="no">${esc(x.motivo)}</span>`}</button>`;
    });
    h += `<p class="paso">2. Pan</p><p class="small">La ración cuesta ${pan} ${pan === 1 ? "moneda" : "monedas"} hoy. ${nec ? `Esta noche necesitas ${plural(nec, "ración", "raciones")} y tienes ${s.raciones}.` : "Esta noche no comes por tu cuenta."}</p>
      <div class="stepper"><button data-act="compra" data-d="-1" aria-label="Comprar una menos">−</button><span class="v">${ui.compra}</span><button data-act="compra" data-d="1" aria-label="Comprar una más">+</button>
      <span class="small muted">compras ${plural(ui.compra, "ración", "raciones")} · te quedan ${s.monedas - coste - ui.compra * pan} monedas</span></div>`;
    const sobran = s.raciones + ui.compra - nec - P.hatillo;
    if (sobran > 0) h += `<p class="small" style="color:var(--warn)">Solo puedes guardar ${P.hatillo} raciones de una noche a otra: perderás ${plural(sobran, "ración", "raciones")}. Mejor compártelas de día.</p>`;
    const faltan = Math.max(0, nec - s.raciones - ui.compra);
    const conNino = E.ninoConmigo(s) && nec > 0;
    if (faltan && conNino && faltan < nec) {
      h += `<p class="paso">3. No hay pan para los dos: ¿quién come?</p>
        <button class="btn ${ui.comeNino ? "sel" : ""}" data-act="comeNino" data-d="1"><span class="t">Come el niño</span><span class="d">Tú pierdes ${-P.hambreC} de cuerpo${s.cuerpo + P.hambreC <= 0 ? ", y morirías" : ""}.</span></button>
        <button class="btn ${!ui.comeNino ? "sel" : ""}" data-act="comeNino" data-d="0"><span class="t">Comes tú</span><span class="d">El niño pierde ${-P.ninoHambre} de su cuerpo (tiene ${s.nino.cuerpo}).${s.nino.cuerpo + P.ninoHambre <= 0 ? " Se quedaría a 0: al amanecer se lo llevan al hospital de niños y lo pierdes." : s.nino.cuerpo + P.ninoHambre <= P.ninoDebil ? " Quedará muy débil: dentro de la muralla, el cura se lo puede llevar." : ""}</span></button>
        <p class="muted small">Si alguien de tu red con relación 3 o más está disponible, os dará una ración y puede que no haga falta elegir.</p>`;
    } else if (faltan) h += `<p class="small" style="color:var(--bad)">${conNino ? "No hay pan para ninguno de los dos: tú pierdes " + (-P.hambreC) + " de cuerpo y el niño " + (-P.ninoHambre) + "." : `Te ${faltan === 1 ? "faltará 1 ración" : "faltarán " + faltan + " raciones"}: perderás ${faltan * -P.hambreC} de cuerpo${s.cuerpo + faltan * P.hambreC <= 0 ? ", y morirías" : ""}.`}</p>`;
    if (s.nino && !s.nino.perdido && s.nino.con && !s.hoy.forzado) {
      const c = s.contactos.find((x) => x.id === s.nino.con);
      h += `<p class="small">Tu hijo duerme con ${esc(c.nombre)}. Le darás una ración${s.raciones + ui.compra >= 1 ? "" : ` o ${pan} monedas`} por cuidarlo${s.raciones + ui.compra < 1 && s.monedas - coste - ui.compra * pan < pan ? "; no te llega, así que la relación bajará" : ""}.</p>`;
    }
    h += `<button class="btn primary" data-act="dormir" ${op && op.ok ? "" : "disabled"}>Dormir</button>`;
    return h;
  }

  function vNocheResumen() {
    if (!ui.nocheRes) return "";
    const { o, antes, despues } = ui.nocheRes;
    return `<div class="card"><h3>Esta noche: ${esc(o.nombre)}</h3>${o.lineas.filter((l) => l !== "Pierdes la licencia.").map((l) => `<p>${esc(l)}</p>`).join("")}${cambiosHtml(antes, despues)}</div>`;
  }

  function vAutoridad() {
    const a = s.ultimaAutoridad;
    let h = `<h2>Noche del día ${s.dia}</h2>` + vNocheResumen();
    if (ui.castigoRes) h += `<div class="card malo"><p><b>${esc(ui.castigoRes.tipo)}.</b> ${esc(ui.castigoRes.txt)}</p></div>`;
    h += `<div class="card"><h3>Mientras duermes, la autoridad mueve ficha</h3>
      <p class="small">Su atención de hoy es <b>${a.atencion}</b>: suma 1 por cada vez que te vio un alguacil o la guardia, 2 por cada hurto que alguien vio, 1 por cada delación y 1 si la ronda te encontró en un pórtico. Con 0-2 hace un movimiento; con 3-5, dos; con 6 o más, tres, y el tercero es fuerte. Desde el pregón de expulsión (día ${P.escaladaDesde}), uno más cada noche, te vea o no.</p>
      <ul class="lista">${a.movimientos.map((m) => `<li>${esc(m.txt)}</li>`).join("")}</ul></div>`;
    h += `<button class="btn primary" data-act="amanece">Amanece: día ${s.dia + 1}</button>`;
    return h;
  }

  // ---------------------------------------------------------------- final
  function vFin() {
    const f = s.final, p = E.pj(s);
    const enc = s.encuesta || {};
    const titulos = { Horca: "La horca", Muerte: "Has muerto", Recogido: "Te han recogido", Sobrevive: "Sobrevives", Abandono: "Partida abandonada" };
    let h = `<main class="wrap"><h1>${esc(titulos[f.tipo] || f.tipo)}</h1>`;
    if (ui.nocheRes) h += vNocheResumen();
    if (ui.castigoRes) h += `<div class="card malo"><p><b>${esc(ui.castigoRes.tipo)}.</b> ${esc(ui.castigoRes.txt)}</p></div>`;
    h += `<div class="card ${f.tipo === "Sobrevive" ? "bueno" : "malo"}"><p>${esc(E.textoFinal(s))}</p></div>
      <p class="muted small">${esc(s.jugador)} · ${esc(p.nombre)} · ${esc(f.causa)}</p>
      <h2>Tres preguntas</h2><p class="small">Contesta en una frase. Es lo que más sirve para mejorar el juego.</p>
      <label class="campo" for="e_dolio">¿Qué decisión te dolió o te costó tomar?</label><textarea id="e_dolio" data-enc="dolio">${esc(enc.dolio || "")}</textarea>
      <label class="campo" for="e_sobro">¿Qué sobraba, estorbaba o te aburrió?</label><textarea id="e_sobro" data-enc="sobro">${esc(enc.sobro || "")}</textarea>
      <label class="campo" for="e_falto">¿Qué no entendiste o echaste de menos?</label><textarea id="e_falto" data-enc="falto">${esc(enc.falto || "")}</textarea>
      <label class="campo" for="e_otros">Otros comentarios (opcional)</label><textarea id="e_otros" data-enc="otros">${esc(enc.otros || "")}</textarea>
      <h2>Mandar el informe</h2><p class="small">El informe recoge toda la partida y tus respuestas. Va a ${esc(R.CONFIG.email)}.</p>
      ${navigator.share ? `<button class="btn primary" data-act="compartir">Compartir informe (elige tu correo)</button>` : ""}
      <button class="btn ${navigator.share ? "secundario" : "primary"}" data-act="correo">Abrir el correo con el resumen</button>
      <button class="btn secundario" data-act="descargar">Descargar el informe (archivo .txt)</button>
      <button class="btn secundario" data-act="copiar">Copiar el informe</button>
      <p class="muted small">En el ordenador: descarga el archivo y adjúntalo al correo que se abre. En el móvil: «Compartir» y elige tu app de correo.</p>
      <h2>¿Otra?</h2><button class="btn primary" data-act="nueva">Jugar otra partida</button>
      <button class="btn secundario" data-act="inicio">Volver al inicio</button>
      <div class="pie">Versión ${esc(R.version)}</div></main>`;
    return h;
  }

  // ---------------------------------------------------------------- informe
  function nombreArchivo(jug, fecha) {
    const limpio = String(jug || "anonimo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "anonimo";
    const f = (fecha ? new Date(fecha) : new Date()).toISOString().slice(0, 16).replace(/[:T]/g, "-");
    return `liber-vagatorum_${limpio}_${f}.txt`;
  }
  function informeActual() { return { texto: E.informe(s), jugador: s.jugador, fecha: s.fin, resumen: E.resumenCorto(s) }; }
  function descargar(texto, nombre) {
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  async function compartir(texto, nombre, resumen) {
    const file = new File([texto], nombre, { type: "text/plain" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: "Liber Vagatorum · informe", text: resumen + " Para: " + R.CONFIG.email });
      else await navigator.share({ title: "Liber Vagatorum · informe", text: texto });
    } catch (e) { if (e && e.name !== "AbortError") abrirModal(`<p>No se ha podido compartir. Prueba a descargar el informe.</p>`); }
  }
  function abrirCorreo(texto, jugador, resumen) {
    const cuerpo = resumen + "\n\n(Adjunto el informe completo descargado. Si no puedes adjuntarlo, aquí va el principio:)\n\n" + texto.split("--- DATOS")[0].slice(0, 1200);
    location.href = `mailto:${R.CONFIG.email}?subject=${encodeURIComponent("Liber Vagatorum · informe de " + (jugador || "anónimo"))}&body=${encodeURIComponent(cuerpo)}`;
  }
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); abrirModal(`<p>Informe copiado. Pégalo en un correo a <b>${esc(R.CONFIG.email)}</b>.</p>`); }
    catch (e) { abrirModal(`<p>No se ha podido copiar. Usa «Descargar».</p>`); }
  }

  // ---------------------------------------------------------------- render
  function vJuego() {
    if (s.fase === "fin") return vFin();
    let body;
    switch (s.fase) {
      case "amanecer": body = vAmanecer(); break;
      case "franja": body = ui.pend ? vResultado() : vFranja(); break;
      case "castigo": body = vCastigo(); break;
      case "noche": body = vNoche(); break;
      case "autoridad": body = vAutoridad(); break;
      default: body = `<p>Fase desconocida.</p>`;
    }
    return vTop() + `<main class="wrap">${body}</main>`;
  }

  function render() {
    const app = document.getElementById("app");
    let html;
    if (ui.pantalla === "personaje") html = vPersonaje();
    else if (ui.pantalla === "historial") html = vHistorial();
    else if (ui.pantalla === "juego" && s) html = vJuego();
    else { ui.pantalla = "inicio"; html = vInicio(); }
    app.innerHTML = html;
    const vista = ui.pantalla + (s ? `|${s.dia}|${s.fase}|${s.franja}|${!!ui.pend}|${!!ui.sitio}|${!!ui.accion}` : "");
    if (vista !== ultimaVista) {
      const soloSeleccion = ultimaVista.split("|").slice(0, 5).join("|") === vista.split("|").slice(0, 5).join("|") && ultimaVista !== "";
      if (!soloSeleccion) window.scrollTo(0, 0);
      else if (ui.accion || ui.sitio) { const el = document.querySelector(".btn.sel"); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }
      ultimaVista = vista;
    }
  }

  function menu() {
    abrirModal(`<h2>Menú</h2>
      <button class="btn" data-act="ayuda">Cómo se juega</button>
      <button class="btn" data-act="red">Tu red</button>
      <button class="btn" data-act="tema">Cambiar tema claro/oscuro</button>
      <button class="btn" data-act="inicio">Ir al inicio (la partida se guarda)</button>
      ${s && !s.final ? `<button class="btn" data-act="abandonar">Abandonar la partida</button>` : ""}
      <p class="muted small">Versión ${esc(R.version)}. La partida se guarda sola en este dispositivo.</p>`);
  }

  // ---------------------------------------------------------------- acciones
  const H = {
    cerrarModal() { cerrarModal(); },
    ayuda() { abrirModal(htmlAyuda()); },
    red() { abrirModal(htmlRed()); },
    menu() { menu(); },
    metro(d) { const a = AYUDA_METRO[d.k]; if (a) abrirModal(`<h2>${esc(a[0])}</h2><p>${esc(a[1])}</p>`); },
    tema() {
      const actual = document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      save(LS.tema, actual === "dark" ? "light" : "dark"); aplicarTema(); cerrarModal();
    },
    inicio() { cerrarModal(); ui.pantalla = "inicio"; render(); },
    historial() { ui.pantalla = "historial"; render(); },
    instalar() { if (promptInstalar) { promptInstalar.prompt(); promptInstalar = null; render(); } },
    continuar() { ui.pantalla = "juego"; resetUI(); render(); },
    verFinal() { ui.pantalla = "juego"; render(); },
    empezar() {
      const n = (document.getElementById("nombre").value || "").trim();
      if (!n) { abrirModal(`<p>Escribe tu nombre o un apodo: sirve para saber quién ha jugado.</p>`); return; }
      if (s && !s.final && !confirm("Tienes una partida a medias. Si empiezas otra, se da por abandonada (su informe queda guardado). ¿Seguir?")) return;
      save(LS.jugador, n);
      if (s && !s.final) { E.abandonar(s); persistir(); }
      ui.pantalla = "personaje"; render();
    },
    abandonarDesdeInicio() {
      if (!confirm("¿Abandonar la partida? Podrás mandar su informe.")) return;
      E.abandonar(s); persistir(); ui.pantalla = "juego"; render();
    },
    abandonar() {
      cerrarModal();
      if (!confirm("¿Abandonar la partida? Podrás mandar su informe.")) return;
      E.abandonar(s); persistir(); render();
    },
    elegirPj(d) {
      s = E.nuevaPartida({ jugador: load(LS.jugador, "Anónimo"), personaje: d.id, catalogo: load(LS.catalogo, []) });
      resetUI(); ui.nocheRes = null; ui.castigoRes = null; ui.pantalla = "juego"; persistir(); render();
    },
    nueva() { ui.pantalla = "inicio"; render(); },
    introVista() { save(LS.intro, true); render(); },
    treta(d) { ui.treta = d.t; render(); },
    dadoTreta(d) { ui.dadoTreta = +d.i; render(); },
    fingir() {
      try { E.fingir(s, ui.dadoTreta, ui.treta); } catch (e) { abrirModal(`<p>${esc(e.message)}</p>`); return; }
      ui.treta = null; ui.dadoTreta = null; persistir(); render();
    },
    empezarDia() { E.empezarFranjas(s); resetUI(); ui.nocheRes = null; ui.castigoRes = null; persistir(); render(); },
    sitio(d) { ui.sitio = d.id; ui.accion = null; ui.dado = null; render(); },
    cambiarSitio() { ui.sitio = null; ui.accion = null; ui.dado = null; render(); },
    accion(d) {
      ui.accion = d.id; ui.dado = null; ui.contacto = "nuevo";
      if (d.id === "delatar") { const c = E.contactosDisponibles(s)[0]; ui.contacto = c ? c.id : null; }
      const libres = s.dados.map((x, i) => [x, i]).filter(([x]) => !x.usado);
      if (R.ACCIONES[d.id].dado && libres.length === 1) ui.dado = libres[0][1];
      render();
    },
    cambiarAccion() { ui.accion = null; ui.dado = null; render(); },
    contacto(d) { ui.contacto = d.id; render(); },
    dado(d) { ui.dado = +d.i; render(); },
    hacer() {
      const a = R.ACCIONES[ui.accion];
      const eleccion = { sitio: ui.sitio, accion: ui.accion, dado: a.dado ? ui.dado : null, contacto: ["compartir", "preguntar", "delatar"].includes(ui.accion) ? ui.contacto : null };
      const rolls = E.tirar(s, eleccion);
      prepararResultado(eleccion, rolls);
      persistir(); render();
    },
    rumor() {
      const { eleccion, rolls } = ui.pend;
      E.gastarRumor(s);
      rolls.w = E.d6(s); rolls.x = E.d6(s);
      eleccion.rumorGastado = true;
      prepararResultado(eleccion, rolls);
      persistir(); render();
    },
    seguir() {
      const { eleccion, o } = ui.pend;
      E.aplicar(s, eleccion, o);
      resetUI(); persistir(); render();
    },
    pasar() { E.pasarFranja(s); resetUI(); persistir(); render(); },
    acabarDia() {
      const libres = s.dados.filter((d) => !d.usado).length;
      if (libres && !confirm(`Te quedan ${plural(libres, "dado", "dados")} sin usar. ¿Acabar el día igualmente?`)) return;
      E.acabarDia(s); resetUI(); persistir(); render();
    },
    castigo(d) {
      ui.castigoRes = E.aplicarCastigo(s, d.e === "marca" ? "marca" : "trabajo");
      if (s.fase !== "autoridad") ui.nocheRes = ui.nocheRes && s.fase === "fin" ? ui.nocheRes : null;
      resetUI(); persistir(); render();
    },
    noche(d) { ui.noche = d.id; render(); },
    favor(d) { E.responderFavor(s, d.d === "1"); persistir(); render(); },
    dejarNino(d) { try { E.dejarNino(s, d.id); } catch (e) { abrirModal(`<p>${esc(e.message)}</p>`); return; } persistir(); render(); },
    recogerNino() { try { E.recogerNino(s); } catch (e) { abrirModal(`<p>${esc(e.message)}</p>`); return; } persistir(); render(); },
    comeNino(d) { ui.comeNino = d.d === "1"; render(); },
    compra(d) { ui.compra = Math.max(0, (ui.compra || 0) + (+d.d)); render(); },
    dormir() {
      const antes = E.snapshot(s);
      try {
        const o = E.dormir(s, { dormir: ui.noche, compra: ui.compra || 0, comeNino: ui.comeNino !== false });
        ui.nocheRes = { o, antes, despues: E.snapshot(s) };
      } catch (e) { abrirModal(`<p>${esc(e.message)}</p>`); return; }
      ui.castigoRes = null; resetUI(); persistir(); render();
    },
    amanece() { E.siguienteDia(s); resetUI(); ui.nocheRes = null; ui.castigoRes = null; persistir(); render(); },
    compartir() { const i = informeActual(); compartir(i.texto, nombreArchivo(i.jugador, i.fecha), i.resumen); },
    correo() { const i = informeActual(); abrirCorreo(i.texto, i.jugador, i.resumen); },
    descargar() { const i = informeActual(); descargar(i.texto, nombreArchivo(i.jugador, i.fecha)); },
    copiar() { copiar(informeActual().texto); },
    hCompartir(d) { const x = load(LS.historial, [])[+d.i]; compartir(x.informe, nombreArchivo(x.jugador, x.fecha), `${x.jugador} jugó con ${x.personaje}. Final: ${x.final.tipo} el día ${x.final.dia}.`); },
    hDescargar(d) { const x = load(LS.historial, [])[+d.i]; descargar(x.informe, nombreArchivo(x.jugador, x.fecha)); },
    hCorreo(d) { const x = load(LS.historial, [])[+d.i]; abrirCorreo(x.informe, x.jugador, `${x.jugador} jugó con ${x.personaje}. Final: ${x.final.tipo} el día ${x.final.dia}.`); },
  };

  function prepararResultado(eleccion, rolls) {
    const antes = E.snapshot(s);
    const o = E.resolver(s, eleccion, rolls);
    const copia = JSON.parse(JSON.stringify(s));
    E.aplicar(copia, JSON.parse(JSON.stringify(eleccion)), JSON.parse(JSON.stringify(o)));
    ui.pend = { eleccion, rolls, o, antes, despues: E.snapshot(copia) };
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el || el.disabled) return;
    if (el.closest(".modal") && el.dataset.act !== "cerrarModal") cerrarModal();
    const f = H[el.dataset.act];
    if (f) { ev.preventDefault(); f(el.dataset, el); }
  });
  document.getElementById("modal").addEventListener("click", (ev) => { if (ev.target.id === "modal") cerrarModal(); });
  document.addEventListener("input", (ev) => {
    const k = ev.target.dataset && ev.target.dataset.enc;
    if (k && s) { s.encuesta = s.encuesta || {}; s.encuesta[k] = ev.target.value; save(LS.partida, s); s.archivada = false; }
  });
  document.addEventListener("change", (ev) => {
    if (ev.target.dataset && ev.target.dataset.enc && s && s.final) archivar();
  });

  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); promptInstalar = e; if (ui.pantalla === "inicio") render(); });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  aplicarTema();
  if (s && !s.final) ui.pantalla = "inicio";
  render();
  window.__LV = { get s() { return s; }, ui, render };
})();
