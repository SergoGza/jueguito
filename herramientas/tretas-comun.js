// Las tretas (rama claude/tretas) para el oficio de aplicado.js: cuándo aprende, compra y usa cada una un bot de
// política fija. La búsqueda del aplicado no sabe valorarlas; esto solo vale con OFICIO=1 (como HURTO).
//
// TRETAS=nunca          las tretas puestas, pero no aprende ni compra ninguna (la referencia: juega como sin ellas)
// TRETAS=atado          solo esa (se pueden poner varias: TRETAS=carta,cautivo). Si alguna se compra, aprende también
//                       el voto, que es de donde salen las primeras blancas
// TRETAS=todas          todas las que puede usar
// TVB=0.4               lo que vale una blanca frente a un pedazo de pan cuando aún le hace falta (por defecto 0.4: con
//                       el pan a 2 blancas, media ración, menos el camino al mercado y el riesgo de llevarlas encima)
// TDADA=1               empieza el verano con las tretas de su lista ya aprendidas o compradas (y sin el voto si no está
//                       en la lista): mide lo que hace cada treta, sin lo que cuesta conseguirla
// TSIEMPRE=1            usa las tretas de su lista siempre que puede, valgan o no más que pedir sin más (para medir
//                       cada treta por sí misma)
//
// Cómo juega: el oficio decide adónde ir y cuándo pedir como siempre, pero valora cada sitio y franja con la mejor
// treta que puede usar allí; al pedir, pide con ella si vale más que pedir sin más. Compra pan con blancas cuando no
// tiene la cena o lleva demasiadas encima, y va a comprar las tretas de su lista cuando le llega. De noche acepta lo que
// le ofrecen si está en su lista y no se queda sin cenar. Nunca se tiende de parida ni hace el muerto (no sabe
// medir el riesgo de no poder huir) y se quita las muletas o las cadenas para andar.
module.exports = function (R, E) {
  const P = R.PARAMS, TR = P.tretas || {}, FR = R.RATOS, FIN = E.FIN, PASO = R.MODOS.A.paso;
  const POL = process.env.TRETAS || "";
  const activo = !!POL && !!P.tretas;
  const VB = process.env.TVB != null ? +process.env.TVB : 0.4;
  const SIEMPRE = !!process.env.TSIEMPRE;
  const POSADA = process.env.POSADA || ""; // POSADA=nunca: no paga posada aunque le lleguen las blancas
  const COMPRA = new Set((TR.lista || []).filter((t) => t.compra).map((t) => t.id));
  const NO_SABE = new Set(["parida", "muerto"]); // no sabe medir el riesgo de no poder huir
  let quiere = new Set();
  if (POL === "todas") quiere = new Set((TR.lista || []).map((t) => t.id));
  else if (POL && POL !== "nunca") quiere = new Set(POL.split(","));
  // las primeras blancas salen del voto: si alguna se paga en blancas, aprende también el voto
  const DADA = !!process.env.TDADA;
  if (!DADA && [...quiere].some((id) => COMPRA.has(id) || ((TR.lista.find((t) => t.id === id) || {}).aprende || {}).blancas)) quiere.add("voto");
  for (const x of NO_SABE) quiere.delete(x);
  const mas = (o, k, n) => { o[k] = (o[k] || 0) + (n == null ? 1 : n); };
  const valorPan = (pan) => (pan < 2 ? 1 : pan < 4 ? 0.55 : 0);
  const salir = (l) => (E.L[l].dentro ? Math.min(...E.PUERTAS.map((g) => E.DIST[l][g] + 1)) * PASO : 0);

  // lo que se espera de una treta con esa gente: pan y blancas
  function media(t, da, esc, ll, s, lugar) {
    if (da < (t.minDa || 2) && !t.nuncaCero) return null;
    const tabla = (esc ? P.limosnaEscasez : P.limosna)[da >= 3 ? 3 : 2];
    const cat = E.catalogada(s, t.id);
    const combo = !cat && t.combo ? Object.entries(t.combo).reduce((n, [k, v]) => n + (s.mazo.includes(k) && !E.catalogada(s, k) ? v : 0), 0) : 0;
    const bonus = cat ? 0 : (t.bonus || 0) + (t.sitioNuevo && !s.votoSitios.includes(lugar) ? t.sitioNuevo : 0) + combo;
    let g = 0;
    for (let d = 1; d <= 6; d++) { let x = da >= 2 ? tabla[Math.max(1, Math.min(6, d + bonus + (ll ? P.llaga.limosna : 0))) - 1] : 0; if (t.nuncaCero) x = Math.max(1, x); g += x / 6; }
    const n = t.tiradas || t.franjas || 1;
    const tot = g * n;
    if (t.moneda === "pan") return { pan: tot, bl: t.blancasExtra || 0 };
    if (t.moneda === "mitad") return { pan: g, bl: (tot - g) * TR.blancasPedazo };
    return { pan: 0, bl: tot * TR.blancasPedazo + (t.blancasExtra || 0) };
  }
  // lo que resta valor: más quejas, la justicia, andar despacio, que te la descubran
  function castigo(t, s) {
    let c = 0;
    if (t.avisoExtra) c += 0.08 * t.avisoExtra;
    if (t.justicia) c += s.buscado ? 3 : 0.9;
    if (t.puesta && t.puesta.paso) c += 0.1;
    if (t.puesta && t.puesta.descubre) c += 0.25 * t.puesta.descubre * (s.detenciones >= 1 ? 2 : 1);
    if (t.repite && t.sitioNuevo && s.votoSitios.includes(s.lugar)) c += 0.15;
    return c;
  }
  // de las que lleva, la mejor para pedir en un sitio y franja (la gente se estima con lo que hay), o null
  // (tb: cuándo empezaría; con muletas o cadenas tiene que quitárselas y salir antes de que cierren)
  function mejor(s, lugar, f, da, vp, soloOk, tb) {
    let best = null;
    for (const id of s.mazo) {
      const t = E.TT[id];
      if (NO_SABE.has(id) || !E.puedeUsarla(s, t)) continue;
      if (tb != null && tb + (t.franjas || 1) * FR + (t.puesta && t.puesta.paso ? TR.ratos : 0) + salir(lugar) > FIN) continue;
      if (soloOk) { if (!E.tretaAqui(s, id).ok) continue; } else {
        if (!t.lugares.includes(lugar) || (t.usos && !(s.usos[id] > 0))) continue;
        if (t.gente && !t.gente.includes(da)) continue;
        if (f + (t.franjas || 1) > R.FRANJAS.length) continue;
      }
      const m = media(t, da, E.escasez(s, s.dia), !!s.llaga, s, lugar);
      if (!m) continue;
      const v = m.pan * vp + m.bl * VB - castigo(t, s);
      if (!best || v > best.v) best = { id, v, pan: m.pan, bl: m.bl };
    }
    return best;
  }
  // para ocasiones(): el valor de pedir en (l, fb) con la mejor treta, frente a pedir sin más (g pedazos)
  // (pr: probabilidad de que la ronda o un corchete estén ahí; la ropa buena hace que con mucha gente no te vean)
  function valor(s, l, fb, g, mucha, vp, tb, pr) {
    if (!activo || !s.conTretas || !s.mazo.length) return null;
    const da = mucha >= 0.5 ? 3 : 2;
    if (g <= 0 && !(pr > 0)) return null; // si sin más no se espera nada, la treta tampoco (no hay gente)
    let best = null;
    for (const id of s.mazo) {
      const b = mejor({ ...s, mazo: [id] }, l, fb, da, vp, false, tb);
      if (!b) continue;
      const t = E.TT[id], ver = t.puesta && t.puesta.pillar ? t.puesta.pillar[da] : 1;
      const v = b.v * (1 - (pr || 0) * ver);
      if (!best || v > best) best = v;
    }
    if (best == null) return null;
    return SIEMPRE ? best + 1 : best;
  }
  // con la ronda o un corchete delante, ¿puede pedir sin que le vean? (la ropa buena, con mucha gente)
  function oculto(s, l, e) {
    if (!activo || !s.conTretas) return false;
    return s.mazo.some((id) => { const t = E.TT[id]; return t.puesta && t.puesta.pillar && t.puesta.pillar[e.da >= 3 ? 3 : 2] === 0 && E.tretaAqui(s, id).ok; });
  }
  const tieneBlancas = (s) => activo && !!s.conTretas && s.mazo.some((id) => E.TT[id].moneda !== "pan" && !NO_SABE.has(id));
  // al pedir: con qué treta (o null, sin ninguna)
  function elegir(s) {
    if (!activo || !s.conTretas) return null;
    const e = E.estado(s, s.lugar, s.dia, E.franja(s.t));
    const vigilado = !!E.rondaEnTuZona(s) || (!!s.conPresion && E.corcheteEn(s, s.lugar, E.franja(s.t)));
    if (vigilado) { const id = s.mazo.find((x) => { const t = E.TT[x]; return t.puesta && t.puesta.pillar && t.puesta.pillar[e.da >= 3 ? 3 : 2] === 0 && E.tretaAqui(s, x).ok; }); return id || null; }
    const vp = valorPan(s.pan);
    const b = mejor(s, s.lugar, E.franja(s.t), e.da >= 3 ? 3 : e.gente === 2 ? 2 : e.da, vp, true, s.t);
    if (!b) return null;
    const plano = (e.da >= 2 ? media({ minDa: 2, moneda: "pan" }, e.da, E.escasez(s, s.dia), !!s.llaga, s, s.lugar).pan : 0) * vp;
    return SIEMPRE || b.v > plano ? b.id : null;
  }
  // el sitio más cercano donde se vende (pan o una treta), con tiempo de llegar, hacerlo y salir
  function irA(s, sitios) {
    let best = null;
    for (const [l, frs] of sitios) {
      let tb = s.t + E.DIST[s.lugar][l] * (PASO + (pesa(s) ? 1 : 0));
      while (tb < FIN && !frs.includes(E.franja(tb))) tb = (Math.floor(tb / FR) + 1) * FR;
      if (tb >= FIN || tb + TR.ratos + salir(l) > FIN) continue;
      if (!best || tb < best.tb) best = { l, tb };
    }
    return best;
  }
  const pesa = (s) => !!(s.puesta && E.TT[s.puesta].puesta && E.TT[s.puesta].puesta.paso);
  const paso = (s, l) => { const sig = E.DIST[s.lugar]; let mejor = null; for (const v of E.VECINOS[s.lugar]) if (E.DIST[v][l] < (mejor ? E.DIST[mejor][l] : 99)) mejor = v; return mejor; };
  // la jugada del bot si le toca comprar o ir a comprar; null si sigue con lo suyo
  function decidir(s) {
    if (!activo || !s.conTretas || s.fase !== "dia" || s.t >= FIN) return null;
    const precio = E.escasez(s, s.dia) ? TR.pan.compraEscasez : TR.pan.compra;
    const mp = E.mercadoPan(s);
    const f = E.franja(s.t);
    // pan: si no tiene la cena (desde sexta) o lleva demasiadas blancas encima
    const hambre = s.pan < 2 && s.blancas >= precio && (f >= 2 || s.pan === 0);
    const sobra = s.blancas > TR.registro && s.pan < P.panMax;
    if (mp.compra && mp.compra.ok && (hambre || sobra)) return { a: "comprarPan" };
    // tretas de su lista que se venden aquí
    for (const x of E.tiendaAqui(s)) {
      if (!quiere.has(x.id) || !x.ok || s.blancas < x.blancas + (s.pan < 2 ? 2 * TR.pan.compra : 0)) continue; // antes, la cena
      if (x.lleno) { const cat = s.mazo.find((id) => E.catalogada(s, id)) || (s.mazo.includes("voto") && x.id !== "voto" ? "voto" : null); if (!cat) continue; return { a: "comprar", t: x.id, o: cat }; }
      return { a: "comprar", t: x.id };
    }
    // ir a comprar pan: a vísperas o antes de que cierre, si no tiene la cena y le llega
    if (s.pan < 2 && s.blancas >= precio && f >= 3) {
      const d = irA(s, Object.entries(TR.pan.compraEn));
      if (d && d.l !== s.lugar) return { a: "mover", d: paso(s, d.l) };
    }
    // ir a comprar una treta de su lista que no tiene, si le llegan las blancas (y le queda la cena)
    if (s.pan >= 2 || f <= 2) {
      const sitios = [];
      for (const t of TR.lista) {
        if (!t.compra || !quiere.has(t.id) || s.mazo.includes(t.id) && !(t.usos && !(s.usos[t.id] > 0))) continue;
        if (!E.puedeUsarla(s, t) || (s.quemadas || []).includes(t.id) || s.blancas < t.compra.blancas + (s.pan < 2 ? 2 * TR.pan.compra : 0)) continue;
        if (s.mazo.length >= TR.mazo && !s.mazo.some((id) => E.catalogada(s, id) || id === "voto")) continue;
        sitios.push([t.compra.lugar, t.compra.franjas]);
      }
      const d = sitios.length ? irA(s, sitios) : null;
      if (d && d.l !== s.lugar) return { a: "mover", d: paso(s, d.l) };
    }
    return null;
  }
  // antes de ejecutar lo que dice el oficio: pedir con treta, o quitarse lo que pesa para andar
  // la posada: si iba a salir de la muralla (o a dormir en un portal) y le llegan las blancas, duerme en el mesón
  const PO = TR.posada;
  function quierePosada(s) {
    if (!PO || !activo || !s.conTretas || POSADA === "nunca") return false;
    const precioPan = E.escasez(s, s.dia) ? TR.pan.compraEscasez : TR.pan.compra;
    return s.blancas >= PO.blancas + Math.max(0, 2 - s.pan) * precioPan;
  }
  function cambia(s, j) {
    if (!activo || !s.conTretas || !j) return j;
    const saliendo = (j.a === "mover" && ((j.plan && j.plan.tipo === "salir") || (s._meta && s._meta.tipo === "salir"))) || (j.a === "acabar" && E.L[s.lugar].dentro);
    if (saliendo && quierePosada(s)) {
      if (PO.en.includes(s.lugar)) { s._meta = null; return { a: "acabar" }; }
      let best = null;
      for (const l of PO.en) { const d = E.DIST[s.lugar][l]; if (s.t + d * (PASO + (pesa(s) ? 1 : 0)) <= FIN && (!best || d < best.d)) best = { l, d }; }
      if (best) { s._meta = null; return { a: "mover", d: paso(s, best.l) }; }
    }
    if (j.a === "pedir") { const id = elegir(s); if (id) return { a: "pedirCon", t: id }; }
    if (j.a === "mover" && pesa(s) && E.puedeQuitar(s)) return { a: "quitar", luego: j };
    return j;
  }
  // de noche: aprende lo que le ofrecen si está en su lista y no se queda sin cenar
  function noche(s) {
    if (!activo || !s.conTretas) return;
    if (E.puedePosada(s)) E.pagarPosada(s);
    const o = E.ofertaTxt(s);
    if (o && quiere.has(o.id) && o.ok && (s.pan - o.pan >= 2 || o.pan === 0)) {
      if (!o.lleno) E.aprender(s, null);
      else { const cat = s.mazo.find((id) => E.catalogada(s, id)); if (cat) E.aprender(s, cat); }
    }
  }
  function ejecutar(s, j) {
    if (j.a === "pedirCon") return E.pedirCon(s, j.t);
    if (j.a === "comprar") return E.comprar(s, j.t, j.o || null);
    if (j.a === "comprarPan") return E.comprarPan(s);
    if (j.a === "venderPan") return E.venderPan(s);
    if (j.a === "quitar") return E.quitar(s);
    return null;
  }
  // las cuentas de una tanda
  const nueva = () => ({ posadas: 0, n: 0, usos: {}, pan: {}, bl: {}, pillado: {}, descubierta: {}, catalogada: {}, diaCat: {}, tiene: {}, compras: {}, blFin: 0, quitadas: 0, panCompra: 0, panVenta: 0, robada: 0, aprende: 0 });
  function cuenta(A, s) {
    if (!s.conTretas) return;
    A.n++;
    for (const [id, x] of Object.entries(s.tretasLog || {})) {
      mas(A.tiene, id); mas(A.usos, id, x.usos); mas(A.pan, id, x.pan); mas(A.bl, id, x.blancas); mas(A.pillado, id, x.pillado); mas(A.descubierta, id, x.descubierta);
      if (x.compras) mas(A.compras, id, x.compras);
      if (x.catalogada) { mas(A.catalogada, id); const d = +String(x.catalogada).replace(/.*día /, ""); mas(A.diaCat, id, d); }
    }
    A.blFin += s.blancas; A.quitadas += s.blancasQuitadas || 0;
    for (const c of s.cronica) { if (c.tipo === "panCompra") A.panCompra++; if (c.tipo === "panVenta") A.panVenta++; if (c.tipo === "robada") A.robada++; if (c.tipo === "aprende") A.aprende++; if (c.tipo === "posada") A.posadas++; }
  }
  function linea(A, nombre) {
    if (!A || !A.n) return "";
    const N = A.n, ids = Object.keys(A.tiene).sort((a, b) => (A.usos[b] || 0) - (A.usos[a] || 0));
    const out = [`  TRETAS (${POL}): blancas al acabar ${(A.blFin / N).toFixed(1)} · se las quita la ronda ${(A.quitadas / N).toFixed(1)} · pan comprado ${(A.panCompra / N).toFixed(1)} · tretas aprendidas de noche ${(A.aprende / N).toFixed(1)} · noches en la posada ${(A.posadas / N).toFixed(1)} (por partida)`];
    for (const id of ids) {
      const u = A.usos[id] || 0;
      out.push(`    ${E.TT[id].nombre.padEnd(22)} la tiene el ${Math.round((100 * A.tiene[id]) / N)} % · la usa ${(u / N).toFixed(1)} veces · da ${(A.pan[id] / Math.max(1, u)).toFixed(2)} pedazos y ${(A.bl[id] / Math.max(1, u)).toFixed(1)} blancas por uso · le pillan ${A.pillado[id] || 0} · le descubren ${A.descubierta[id] || 0} · catalogada en el ${Math.round((100 * (A.catalogada[id] || 0)) / N)} % de las partidas${A.catalogada[id] ? ` (día ${(A.diaCat[id] / A.catalogada[id]).toFixed(1)} de media)` : ""}`);
    }
    return out.join("\n");
  }
  // al empezar cada verano: con TDADA, las de su lista ya en el hatillo
  function inicio(s) {
    if (!activo || !DADA || !s.conTretas || s.dia !== 1) return;
    for (const id of quiere) { const t = E.TT[id]; if (t && !s.mazo.includes(id) && s.mazo.length < TR.mazo && E.puedeUsarla(s, t) && !(s.quemadas || []).includes(id)) { s.mazo.push(id); if (t.usos) s.usos[id] = t.usos; } }
  }
  return { activo, quiere, inicio, valor, oculto, tieneBlancas, elegir, decidir, cambia, noche, ejecutar, nueva, cuenta, linea };
};
