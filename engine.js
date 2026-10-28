/* Liber Vagatorum — motor del prototipo. Sin interfaz: se puede probar en Node. */
(function (root) {
  "use strict";
  const R = root.RULES || (typeof require !== "undefined" ? require("./rules.js") : null);
  const P = R.PARAMS;

  // ---------------------------------------------------------------- utilidades
  function rand(s) {
    s.rng = (s.rng + 0x6d2b79f5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const d6 = (s) => 1 + Math.floor(rand(s) * 6);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const signo = (n) => (n > 0 ? "+" + n : n < 0 ? "−" + -n : "0");
  const sitio = (id) => R.SITIOS.find((x) => x.id === id);
  const pj = (s) => R.PERSONAJES.find((p) => p.id === s.pj);
  const cal = (d) => R.CALENDARIO[Math.min(d, R.CALENDARIO.length) - 1];
  const licencia = (s) => s.termo === -2;
  const clasif = (t) => R.CLASIF[String(t)];
  const ahora = () => new Date().toISOString();

  function dadosPorCuerpo(c) {
    if (c <= 0) return 0;
    const b = R.DADOS_CUERPO.find(([lo, hi]) => c >= lo && c <= hi);
    return b ? b[2] : 5;
  }

  function modsDe(dia, sid, franjaIdx) {
    const fr = R.FRANJAS[franjaIdx];
    const m = { pedir: 0, hurtar: 0, modHurtar: 0, sinJornal: 0, alguacil: 0 };
    R.MODS.filter((x) => x.dia === dia && x.sitio === sid && x.franja === fr).forEach((x) => {
      m.pedir += x.pedir; m.hurtar += x.hurtar; m.modHurtar += x.modHurtar; m.sinJornal += x.sinJornal; m.alguacil += x.alguacil;
    });
    return m;
  }

  function snapshot(s) {
    return { cuerpo: s.cuerpo, monedas: s.monedas, raciones: s.raciones, termo: s.termo, tb: s.tb, rumores: s.rumores, fuera: s.fuera, marca: s.marca,
      nino: s.nino ? (s.nino.perdido ? "perdido" : s.nino.cuerpo) : null, ninoCon: s.nino && s.nino.con ? s.nino.con : null };
  }

  const vivo = (c) => !c.estado;
  const disponible = (s, c) => vivo(c) && !(c.ausenteHasta && c.ausenteHasta >= s.dia);
  const contactosDisponibles = (s) => s.contactos.filter((c) => disponible(s, c));
  function maxRel(s, lado) {
    return contactosDisponibles(s).filter((c) => !lado || c.lado === lado).reduce((m, c) => Math.max(m, c.rel), 0);
  }
  function mejorContacto(s, lado, min) {
    const cs = contactosDisponibles(s).filter((c) => !lado || c.lado === lado).slice().sort((a, b) => b.rel - a.rel);
    return cs.length && cs[0].rel >= (min || 2) ? cs[0] : null;
  }
  // Palancas de calibración (v0.5): por defecto no cambian nada.
  const umbralJornal = (s) => (P.jornalDias ? P.jornalDias[Math.min(s.dia, P.jornalDias.length) - 1] : P.jornalUmbral);
  const techoRel = () => P.techoRel || 2;
  // palanca: al impedido lo recogen antes (el encierro es su castigo)
  // palanca: a partir de qué detención echan de la ciudad al forastero (puede ser distinta para el impedido)
  const desdeExpulsion = (s) => (pj(s).impedido && P.expulsionDesdeImpedido ? P.expulsionDesdeImpedido : P.expulsionDesde || 1);
  // desde el pregón y hasta que vence, la autoridad busca a los forasteros que ve dentro de la muralla
  const persigue = (s, sid) => !!(P.pregonPersigue && pj(s).forastero && !licencia(s) && s.dia >= P.pregonInicio && s.dia < P.pregonVence && sid !== "puente");
  const hospVeces = (s) => P.hospitalVeces - (P.recogeImpedido && pj(s).impedido ? 1 : 0);
  function alAzar(s, lista) { return lista.length ? lista[Math.floor(rand(s) * lista.length)] : null; }

  // Termómetro con suelo: fuera de la lista no se baja de −1 (estar en la lista es el −2); el −2 solo con el examen; el −3 solo en el hospital.
  function aplicarT(s, delta, o) {
    o = o || {};
    if (o.recogido) { s.termo = -3; return; }
    if (o.fijar !== undefined) { s.termo = o.fijar; return; }
    const suelo = s.marca ? 1 : licencia(s) ? (o.hospital ? -3 : -2) : -1;
    s.termo = clamp(s.termo + delta, Math.min(suelo, s.termo), Math.max(techo(s), s.termo));
  }
  // Sin detenciones previas no se pasa de +2: «reincidente» es quien ya ha sido detenido.
  const techo = (s) => ((s.detenciones || 0) > 0 ? 3 : P.techoSinDetencion);

  // ---------------------------------------------------------------- autoridad visible
  const rondasEn = (s, sid, dia, franjaIdx) =>
    s.autoridad.rondas.filter((r) => r.sitio === sid && r.desde <= dia && dia <= r.hasta).reduce((a, r) => a + r.peso, 0) +
    (franjaIdx === undefined ? 0 : modsDe(dia, sid, franjaIdx).alguacil) +
    (s.hoy && s.hoy.dia === dia && s.hoy.redada ? 1 : 0);
  const limosnaEn = (s, sid, dia) => { const l = s.autoridad.limosna[dia]; return l && l.sitio === sid ? l.nivel : 0; };
  const pregonActivo = (s, tipo, dia) => s.autoridad.pregones.some((p) => p.tipo === tipo && p.desde <= (dia || s.dia) && (dia || s.dia) <= p.hasta);
  const puertaCerrada = (s, dia) => s.autoridad.puerta.includes(dia || s.dia);

  function resumenAutoridad(s, dia) {
    const out = [];
    const porSitio = {};
    s.autoridad.rondas.filter((r) => r.desde <= dia && dia <= r.hasta).forEach((r) => { porSitio[r.sitio] = (porSitio[r.sitio] || 0) + r.peso; });
    Object.keys(porSitio).forEach((sid) => {
      const n = porSitio[sid];
      out.push(`Ronda en ${sitio(sid).nombre}: ${n === 1 ? "el 1" : "del 1 al " + n} del dado de testigo es alguacil.`);
    });
    if (puertaCerrada(s, dia)) out.push("La puerta está cerrada: desde fuera solo entran los de la lista.");
    if (s.autoridad.examen[dia]) out.push(`Examen general en las parroquias${s.autoridad.examen[dia] === 2 ? " (fuerte)" : ""}.`);
    const l = s.autoridad.limosna[dia];
    if (l) out.push(`Limosna pública en ${sitio(l.sitio).nombre}: pedir +${P.limosnaPub}${l.nivel === 2 ? ", y solo miran alguaciles" : ", con la beneficencia y los alguaciles mirando"}.`);
    if (pregonActivo(s, 1, dia)) out.push("Pregón: prohibido pedir en la catedral durante la misa y el oficio.");
    if (pregonActivo(s, 3, dia)) out.push("Pregón: se paga el doble por delatar.");
    return out;
  }

  function pregonExpulsion(dia) {
    if (dia < P.pregonInicio) return "";
    if (dia < P.pregonVence) { const n = P.pregonVence - dia; return `Pregón de expulsión de forasteros: vence en ${n} ${n === 1 ? "día" : "días"}.`; }
    if (dia === P.pregonVence) return "Hoy vence el pregón de expulsión de forasteros.";
    return "";
  }

  // ---------------------------------------------------------------- partida
  function nuevaPartida(opts) {
    const p = R.PERSONAJES.find((x) => x.id === opts.personaje);
    const seed = opts.seed !== undefined ? opts.seed | 0 : (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0;
    const s = {
      v: R.version, id: "P" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), seed, rng: seed,
      jugador: opts.jugador || "Anónimo", pj: p.id, inicio: ahora(), fin: null, tiempos: {},
      dia: 1, fase: "amanecer", franja: 0,
      cuerpo: p.cuerpo0, monedas: p.monedas0, raciones: p.raciones0, termo: p.termo0, tb: 0, rumores: 0,
      marca: false, tf: 0, fuera: false, dados: [], treta: null, ocupada: false,
      contactos: [], venganza: false, usosTreta: {}, nombresUsados: [], detenciones: 0, ultimoDormir: null, apuntes: 0,
      hoy: null, autoridad: { rondas: [], puerta: [], examen: {}, limosna: {}, pregones: [] },
      catalogo: (opts.catalogo || []).slice(), diario: [], final: null, encuesta: null, ultimaAutoridad: null,
      nino: p.nino ? { cuerpo: P.ninoCuerpo0, con: null, perdido: false, motivo: "" } : null,
    };
    amanecer(s);
    return s;
  }

  function diaActual(s) { return s.diario[s.diario.length - 1]; }

  function suceso(s, ev) {
    const su = R.SUCESOS[Math.floor(rand(s) * R.SUCESOS.length)];
    const txts = [su.txt];
    switch (su.id) {
      case "fiebres": {
        if (s.ultimoDormir === "portico" || s.ultimoDormir === "arrabal") { s.cuerpo = clamp(s.cuerpo - 1, 0, 10); txts.push("Anoche dormiste al raso: −1 de cuerpo."); }
        if (ninoConmigo(s) && d6(s) <= P.ninoFiebre) { s.nino.cuerpo = clamp(s.nino.cuerpo - 1, 0, P.ninoMax); txts.push("Al niño le sube la fiebre (−1 a su cuerpo)."); }
        const c = alAzar(s, contactosDisponibles(s));
        if (c) { c.ausenteHasta = s.dia + 1; c.ausenteMotivo = "enfermo"; txts.push(`${c.nombre} cae con fiebres: hoy y mañana no podrás contar con esa persona.`); }
        break;
      }
      case "tormenta": s.hoy.frio = 1; break;
      case "pan": s.hoy.panExtra = 1; break;
      case "redada": s.hoy.redada = 1; break;
      case "cofradia":
        if (!s.fuera && !s.hoy.forzado) { s.raciones += 1; txts.push("Te llevas una ración (+1)."); }
        else txts.push(s.hoy.forzado ? "Tú estás en el trabajo forzado." : "Tú estás fuera de la muralla y no llegas.");
        break;
      case "muerte": {
        const c = alAzar(s, s.contactos.filter(vivo));
        if (c) { c.estado = "muerto"; c.muertoDia = s.dia; txts.push(`Es ${c.nombre}, de tu red.`); }
        else txts.push("Nadie sabe su nombre.");
        break;
      }
      case "forasteros": s.hoy.rivalExtra = 1; break;
    }
    s.hoy.suceso = { id: su.id, titulo: su.titulo, txt: txts.join(" ") };
    ev.push(`${su.titulo}. ${txts.join(" ")}`);
  }

  // ---------------------------------------------------------------- el niño (viuda)
  const ninoConmigo = (s) => !!(s.nino && !s.nino.perdido && !s.nino.con);
  function perderNino(s, txt, ev) {
    s.nino.perdido = true; s.nino.con = null; s.nino.motivo = txt; s.nino.dia = s.dia;
    if (ev) ev.push(txt);
  }
  function revisarNino(s, ev) {
    const n = s.nino;
    if (!n || n.perdido) return;
    if (n.con) {
      const c = s.contactos.find((x) => x.id === n.con);
      if (!c || c.estado) { perderNino(s, `${c ? c.nombre : "Quien cuidaba de tu hijo"} ya no está. La autoridad encuentra al niño y se lo lleva a los niños de la doctrina.`, ev); return; }
      if (c.ausenteHasta && c.ausenteHasta >= s.dia) {
        if (c.ausenteMotivo === "enfermo") { n.con = null; ev.push(`En casa de ${c.nombre} hay fiebres: te devuelve al niño.`); }
        else { perderNino(s, `Se han llevado a ${c.nombre}. Tu hijo estaba en su casa: lo dejan en los niños de la doctrina.`, ev); return; }
      } else if (c.rel < 2) { n.con = null; ev.push(`${c.nombre} no puede seguir cuidando del niño y te lo devuelve.`); }
    }
    if (n.cuerpo <= 0) { perderNino(s, "El niño enferma gravemente. Se lo llevan al hospital de niños y no te dejan verlo.", ev); return; }
    if (!n.con && n.cuerpo <= P.ninoDebil && !s.fuera) {
      const c = mejorContacto(s);
      if (c) { n.con = c.id; ev.push(`El niño está muy débil. Antes de que lo vea el cura, ${c.nombre} se lo lleva y lo esconde.`); }
      else perderNino(s, "El niño está muy débil. El cura lo ve y se lo lleva a los niños de la doctrina.", ev);
    }
  }
  function puedeCuidar(s) { return contactosDisponibles(s).filter((c) => c.rel >= 2); }
  function dejarNino(s, contactoId) {
    if (!ninoConmigo(s)) throw new Error("El niño no está contigo.");
    const c = puedeCuidar(s).find((x) => x.id === contactoId);
    if (!c) throw new Error("Esa persona no puede quedarse con él.");
    s.nino.con = c.id;
    diaActual(s).amanecer.eventos.push(`Dejas al niño con ${c.nombre}.`);
    return c;
  }
  function recogerNino(s) {
    if (!s.nino || s.nino.perdido || !s.nino.con) throw new Error("El niño no está con nadie.");
    const c = s.contactos.find((x) => x.id === s.nino.con);
    s.nino.con = null;
    diaActual(s).amanecer.eventos.push(`Recoges al niño${c ? " de casa de " + c.nombre : ""}.`);
  }

  function amanecer(s) {
    s.hoy = { dia: s.dia, pedidas: {}, visto: {}, actuado: {}, atencion: 0, detenido: null, castigo: null, eventos: [], forzado: false, suceso: null, favor: null, senalados: [], vistosJuntos: [], cumplido: false, borrado: false };
    s.franja = 0; s.ocupada = false; s.treta = null; s.fase = "amanecer";
    s.tiempos[s.dia] = { inicio: ahora(), fin: null };
    const ev = [];
    const entrada = { dia: s.dia, amanecer: null, fingir: null, favor: null, acciones: [], castigo: null, noche: null, autoridad: null, fin: null };
    s.diario.push(entrada);
    if (s.dia >= P.sucesosDesde) suceso(s, ev);
    revisarNino(s, ev);
    if (s.cuerpo <= 0) {
      entrada.amanecer = { estado: snapshot(s), dados: [], eventos: ev.slice(), autoridad: resumenAutoridad(s, s.dia) };
      s.hoy.eventos = ev;
      terminar(s, "Muerte", "Murió de fiebres.");
      return;
    }
    if (s.tf > 0) {
      s.dados = []; s.hoy.forzado = true;
      ev.push(`Trabajo forzado: hoy no actúas, y esta noche pierdes 1 de cuerpo. ${s.tf - 1 > 0 ? "Te quedan " + (s.tf - 1) + " días más." : "Es el último día."}`);
    } else {
      const n = dadosPorCuerpo(s.cuerpo);
      s.dados = Array.from({ length: n }, () => ({ v: d6(s), usado: false }));
    }
    const eg = s.autoridad.examen[s.dia];
    if (eg && licencia(s)) {
      const x = d6(s);
      const umbral = eg === 2 ? P.examenGenFuerte : P.examenGenUmbral;
      if (x <= umbral) { aplicarT(s, 1); ev.push(`Examen general: el cura saca ${x} y te borra de la lista (+1).`); }
      else ev.push(`Examen general: el cura saca ${x} y sigues en la lista.`);
    }
    if (!s.hoy.forzado) {
      const disp = contactosDisponibles(s);
      if (disp.length && d6(s) <= P.favorProb) {
        const c = alAzar(s, disp);
        s.hoy.favor = { id: c.id, nombre: c.nombre, respondido: false, txt: "" };
        ev.push(`${c.nombre} te pide algo de comer.`);
      }
    }
    s.hoy.eventos = ev;
    entrada.amanecer = { estado: snapshot(s), dados: s.dados.map((d) => d.v), eventos: ev.slice(), autoridad: resumenAutoridad(s, s.dia) };
    if (s.tb >= P.tbMax) {
      s.hoy.detenido = { motivo: "Al amanecer vienen a por ti: alguien te ha vendido y «Te buscan» ha llegado a " + P.tbMax + ".", termo: s.termo, noche: false };
      s.fase = "castigo";
    }
  }

  function responderFavor(s, dar) {
    const f = s.hoy.favor;
    if (!f || f.respondido) return null;
    const c = s.contactos.find((x) => x.id === f.id);
    if (dar && s.raciones >= 1) { s.raciones -= 1; if (c) c.rel = clamp(c.rel + 1, 0, 5); f.txt = `Le das una ración a ${f.nombre}. Relación +1.`; f.dio = true; }
    else { if (c) c.rel = clamp(c.rel - 1, 0, 5); f.txt = `No le das nada a ${f.nombre}. Relación −1.`; f.dio = false; }
    f.respondido = true;
    diaActual(s).favor = f.txt;
    return f;
  }

  function catalogada(s, treta) {
    return s.catalogo.some((c) => c.treta === treta && (c.partida !== s.id || c.dia < s.dia));
  }

  function fingir(s, dadoIdx, treta) {
    if (s.fase !== "amanecer" || s.treta) throw new Error("Solo se finge una vez, al amanecer.");
    const d = s.dados[dadoIdx];
    if (!d || d.usado) throw new Error("Ese dado no está disponible.");
    d.usado = true;
    const p = pj(s);
    const calidad = Math.min(6, d.v + (p.tretaOficio === treta ? p.bonusTreta : 0));
    s.treta = { nombre: treta, calidad, catalogada: catalogada(s, treta) };
    s.usosTreta[treta] = (s.usosTreta[treta] || 0) + 1;
    diaActual(s).fingir = { treta, dado: d.v, calidad, catalogada: s.treta.catalogada };
    return s.treta;
  }

  function empezarFranjas(s) {
    if (s.hoy.favor && !s.hoy.favor.respondido) responderFavor(s, false);
    if (s.hoy.forzado) { s.fase = "noche"; return; }
    s.fase = "franja"; s.franja = 0;
  }

  // ---------------------------------------------------------------- sitios y acciones disponibles
  function sitiosDisponibles(s) {
    return R.SITIOS.map((st) => {
      const fr = st.franjas[s.franja];
      let ok = true, motivo = "";
      if (st.dentro && !st.ambos && s.fuera) { ok = false; motivo = "Estás fuera de la muralla: antes tienes que cruzar la puerta en el puente."; }
      const notas = [];
      const m = modsDe(s.dia, st.id, s.franja);
      if (m.pedir) notas.push("Hoy pedir " + signo(m.pedir) + ".");
      if (m.sinJornal && fr.acts.includes("T")) notas.push("Hoy no hay jornal.");
      if (m.hurtar > 0) notas.push("Hoy se puede hurtar" + (m.modHurtar ? " (+" + m.modHurtar + " al dado)" : "") + ".");
      if (m.hurtar < 0) notas.push("Hoy no se puede hurtar.");
      const r = rondasEn(s, st.id, s.dia, s.franja);
      if (r > 0) notas.push(`Vigilancia: ${r === 1 ? "el 1" : "del 1 al " + r} del dado de testigo es alguacil.`);
      const l = limosnaEn(s, st.id, s.dia);
      if (l) notas.push(`Limosna pública: pedir +${P.limosnaPub}${l === 2 ? ", solo miran alguaciles" : ""}.`);
      if (st.id === "catedral" && (s.franja === 0 || s.franja === 4) && pregonActivo(s, 1)) notas.push("Pregón: prohibido pedir en misa y oficio.");
      return { id: st.id, nombre: st.nombre, desc: st.desc, texto: fr.texto, ok, motivo, notas };
    });
  }

  function accionesEn(s, sid) {
    const st = sitio(sid), fr = st.franjas[s.franja], m = modsDe(s.dia, sid, s.franja), p = pj(s);
    let ids = [];
    fr.acts.forEach((c) => ids.push(...R.COD_ACC[c]));
    const oficios = p.oficios || ["peon"];
    ids = ids.filter((id) => (id !== "trabajar" || oficios.includes("peon")) && (id !== "lavar" || oficios.includes("lavar")));
    if (m.hurtar > 0 && !ids.includes("hurtar")) ids.push("hurtar");
    const libres = s.dados.filter((d) => !d.usado).length;
    return ids.map((id) => {
      const a = R.ACCIONES[id];
      let ok = true, motivo = "", aviso = "";
      if (a.dado && libres === 0) { ok = false; motivo = "No te quedan dados."; }
      if (id === "hurtar" && m.hurtar < 0) { ok = false; motivo = "Hoy no hay gentío para hurtar aquí."; }
      if (id === "trabajar" && m.sinJornal) { ok = false; motivo = "Hoy no hay jornal."; }
      if (id === "examen") {
        if (p.forastero) { ok = false; motivo = "Solo para naturales de la ciudad: eres forastero."; }
        else if (licencia(s)) { ok = false; motivo = "Ya estás en la lista."; }
      }
      if (id === "pedir" && sid === "catedral" && (s.franja === 0 || s.franja === 4) && pregonActivo(s, 1)) { ok = false; motivo = "Pregón: prohibido pedir en la catedral en misa y oficio."; }
      if (id === "compartir" && s.raciones < 1 && s.monedas < P.compartirCoste) { ok = false; motivo = "No tienes ni una ración ni una moneda que compartir."; }
      if (id === "delatar" && !contactosDisponibles(s).length) { ok = false; motivo = "Solo puedes delatar a alguien que conoces, y no tienes a nadie en tu red."; }
      if (id === "cruzar" && s.fuera && puertaCerrada(s) && !licencia(s)) { ok = false; motivo = "La puerta está cerrada: hoy solo entran los de la lista."; }
      if (id === "cruzar" && s.fuera && s.vetadoHasta && s.dia <= s.vetadoHasta) { ok = false; motivo = `Te han echado de la ciudad: la guardia no te deja entrar hasta el día ${s.vetadoHasta + 1}.`; }
      if (id === "cumplir" && !licencia(s)) { ok = false; motivo = "Solo para quien está en la lista de pobres."; }
      else if (id === "cumplir" && s.hoy.cumplido) { ok = false; motivo = "Ya has cumplido hoy."; }
      if (id === "pedir" && licencia(s)) aviso = "Estás en la lista: si te ven pedir la beneficencia, el cura o un alguacil, te borran (y esta noche no hay ración). Los frailes no denuncian.";
      if (id === "curarse" && s.cuerpo > P.hospitalMaxCuerpo) { ok = false; motivo = `Solo admiten enfermos: necesitas cuerpo ${P.hospitalMaxCuerpo} o menos.`; }
      if (id === "curarse" && (s.apuntes || 0) >= hospVeces(s) - 1) aviso = `Ya te han apuntado ${s.apuntes} ${s.apuntes === 1 ? "vez" : "veces"}: si te curan, te recogen. Fin de la partida.`;
      else if (id === "curarse" && s.cuerpo <= P.recogidoCuerpo) aviso = "Con cuerpo 2 o menos, si entras te recogen: fin de la partida.";
      else if (id === "curarse" && licencia(s)) aviso = "Estás en la lista: si te apuntan, te recogen (−3): fin de la partida.";
      if (id === "hurtar") aviso = "Si te ve un alguacil, te detienen en el acto.";
      if (id === "cruzar" && s.fuera && s.dia >= P.pregonVence && p.forastero && !licencia(s)) aviso = "Ha vencido el pregón: si te ve la guardia, no te deja entrar.";
      const nombre = id === "cruzar" ? (s.fuera ? "Cruzar la puerta (entrar)" : "Cruzar la puerta (salir)") : a.nombre;
      return { id, nombre, desc: a.desc, dado: a.dado, testigo: a.testigo, red: ["compartir", "juntarse", "delatar"].includes(id), ok, motivo, aviso };
    });
  }

  function grupoEfecto(s, sid, accion) {
    switch (accion) {
      case "pedir":
        if (licencia(s)) return "Pedir estando en la lista";
        if (s.treta) return "Pedir con treta";
        return "Pedir sin licencia";
      case "cumplir": return "Cumplir";
      case "hurtar": return "Hurtar";
      case "trabajar": case "lavar": return "Trabajar";
      case "descansar": return "Descansar";
      case "compartir": case "juntarse": return "La red";
      case "delatar": return "Delatar";
      case "cruzar": return "Cruzar la puerta";
      default: return null;
    }
  }

  // la limosna que se da en moneda (no la sopa ni el pan) rinde más si llevas al niño
  const x0 = (s, sid) => sitio(sid).franjas[s.franja].pedirDa !== "racion";
  function monedasPedir(s, sid, v) {
    const fr = sitio(sid).franjas[s.franja], m = modsDe(s.dia, sid, s.franja);
    if (v === 1) return 0;
    const x = R.PEDIR_DADO[v - 1] + fr.modPedir + m.pedir + (P.masPobresDesde && s.dia >= P.masPobresDesde ? P.masPobresMod || -1 : 0) +
      (limosnaEn(s, sid, s.dia) ? P.limosnaPub : 0) +
      (s.treta && s.treta.calidad >= P.tretaUmbral && !s.treta.catalogada ? P.tretaBonus : 0) +
      (ninoConmigo(s) && x0(s, sid) ? P.ninoPedir : 0);
    return Math.max(0, x);
  }

  // Qué te da la acción con un dado concreto (sin contar testigos)
  function ganancia(s, sid, accion, v) {
    const fr = sitio(sid).franjas[s.franja], m = modsDe(s.dia, sid, s.franja), p = pj(s);
    switch (accion) {
      case "pedir":
        if (fr.pedirDa === "racion") return v >= fr.umbral ? "te dan una ración" : sid === "convento" ? "se acaba la sopa antes de que llegues" : "no te dan nada";
        { const n = monedasPedir(s, sid, v); return n <= 0 ? "no te darán nada" : n === 1 ? "te darán poco" : n <= 3 ? "te darán algo" : "te darán bastante"; }
      case "juntarse": return v >= P.juntarseRumor ? "os acercáis y te cuenta algo" : "os acercáis, pero no te cuenta nada";
      case "trabajar": return v + p.modJornal >= umbralJornal(s) ? "te contratan" : "no te contratan";
      case "lavar": return v >= P.lavarUmbral ? "te dan ropa que lavar" : "hoy no te dan ropa";
      case "hurtar": { const ev = Math.min(6, v + m.modHurtar); return ev <= 2 ? "fallas y te ven" : R.HURTAR_DADO[ev - 1] >= 4 ? "si nadie te pilla, sacas bastante" : "si nadie te pilla, sacas algo"; }
      case "descansar": return v >= P.descansarUmbral ? "descansas, si nadie te ve" : "el hambre no te deja descansar";
      case "curarse": return v >= P.curarUmbral ? "te curan" : "hoy no te atienden";
      case "examen": return v >= (p.difExamen || 99) ? "apruebas" : "suspendes";
      case "cumplir": return "cumples";
      default: return "";
    }
  }

  function testigoPara(s, sid, franjaIdx, w, opts) {
    const lim = limosnaEn(s, sid, s.dia);
    if (lim === 2) return "Alguacil";
    if (lim === 1) return w <= 3 ? "Beneficencia" : "Alguacil";
    if (w <= rondasEn(s, sid, s.dia, franjaIdx)) return "Alguacil";
    const st = sitio(sid);
    const tabla = st.franjas[franjaIdx].tabla || st.nombre;
    const t = R.TESTIGOS[tabla][w - 1];
    if (opts && opts.hurtoFallido && t === "Nadie") return "Vecinos (la víctima)";
    return t;
  }

  function previewTestigos(s, sid, accion) {
    if (!R.ACCIONES[accion].testigo) return null;
    const grupo = grupoEfecto(s, sid, accion);
    const filas = [];
    for (let w = 1; w <= 6; w++) {
      const t = testigoPara(s, sid, s.franja, w, {});
      const f = filas.find((x) => x.testigo === t);
      if (f) f.caras.push(w); else filas.push({ testigo: t, caras: [w], efecto: R.EFECTOS[grupo][R.CATEGORIA[t]].txt + (R.CATEGORIA[t] === "Autoridad" && persigue(s, sid) ? `; y eres forastero con el pregón en marcha: Te buscan +${P.pregonPersigue}` : "") });
    }
    return filas;
  }

  // ---------------------------------------------------------------- resolver una acción
  function tirar(s, eleccion) {
    const rolls = { w: d6(s), x: d6(s), nombre: null };
    if (eleccion && ["compartir", "juntarse"].includes(eleccion.accion) && eleccion.contacto === "nuevo") rolls.nombre = nombreNuevo(s);
    return rolls;
  }

  function nombreNuevo(s) {
    const libres = R.NOMBRES.filter((n) => !s.nombresUsados.includes(n));
    const lista = libres.length ? libres : R.NOMBRES;
    return lista[Math.floor(rand(s) * lista.length)];
  }

  function nombreDe(s, eleccion, rolls) {
    if (eleccion.contacto === "nuevo" || !eleccion.contacto) return rolls.nombre || "un pobre que no conoces";
    const c = s.contactos.find((x) => x.id === eleccion.contacto);
    return c ? c.nombre : "alguien";
  }

  function resolver(s, eleccion, rolls) {
    const sid = eleccion.sitio, accion = eleccion.accion;
    const st = sitio(sid), fr = st.franjas[s.franja], m = modsDe(s.dia, sid, s.franja), p = pj(s), A = R.ACCIONES[accion];
    const v = eleccion.dado !== null && eleccion.dado !== undefined ? s.dados[eleccion.dado].v : null;
    const lic = licencia(s);
    const o = {
      dia: s.dia, franja: s.franja, franjaNombre: R.FRANJAS[s.franja], sitio: sid, accion, v, w: null, x: null,
      testigo: null, cat: null, grupo: null, cond: "", condOk: false,
      dM: 0, dR: 0, dC: 0, dT: 0, dTB: 0, aten: 0, rumor: 0,
      detenido: false, motivoDet: "", recogido: false, descubierta: false, contratado: false, cruce: false, entrando: null,
      hospital: false, fijarT: undefined, relacion: null, delatado: null, venganzaNueva: false, venganzaUsada: false,
      nombre: null, resultado: "", lineas: [],
    };
    const ev = accion === "hurtar" ? Math.min(6, v + m.modHurtar) : v;
    if (A.testigo) {
      o.w = rolls.w;
      o.testigo = testigoPara(s, sid, s.franja, rolls.w, { hurtoFallido: accion === "hurtar" && ev <= 2 });
      o.cat = R.CATEGORIA[o.testigo];
    }
    o.grupo = grupoEfecto(s, sid, accion);
    let ef = null;
    if (o.grupo && o.cat) { ef = R.EFECTOS[o.grupo][o.cat]; o.cond = ef.cond; }
    if (ef && ef.cond) {
      switch (ef.cond) {
        case "REPITE": o.condOk = (s.hoy.pedidas[sid] || 0) > 0; break;
        case "RIVAL": o.x = rolls.x; o.condOk = o.x <= P.rivalUmbral + (s.hoy.rivalExtra || 0); break;
        case "IMPEDIDO": o.condOk = p.impedido || !!s.treta; break;
        case "EXAMEN": o.x = rolls.x; o.condOk = o.x + (s.treta.catalogada ? P.catalogadaExam : 0) >= s.treta.calidad; break;
        case "DELATOR": o.x = rolls.x; o.condOk = o.x <= (maxRel(s) >= 2 ? P.delatorUmbralRed : P.delatorUmbral); break;
        case "FORASTERO": o.condOk = p.forastero && !lic; break;
      }
    }
    let wT = ef ? (o.condOk ? ef.at : ef.t) : 0;
    let wTB = ef ? (o.condOk ? ef.atb : ef.tb) : 0;
    if (["compartir", "juntarse", "delatar"].includes(accion)) o.nombre = nombreDe(s, eleccion, rolls);

    switch (accion) {
      case "pedir":
        if (fr.pedirDa === "racion") { o.dR = v >= fr.umbral ? 1 : 0; o.resultado = o.dR ? "Te dan 1 ración." : (sid === "convento" ? "Se acaba la sopa antes de que llegues." : "No te dan nada."); }
        else { o.dM = monedasPedir(s, sid, v); o.resultado = o.dM ? `Te dan ${o.dM} ${o.dM === 1 ? "moneda" : "monedas"}.` : "No te dan nada."; }
        if (o.grupo === "Pedir con treta") o.resultado += ` Pides con ${s.treta.nombre.toLowerCase()}.`;
        break;
      case "trabajar":
        o.contratado = v + p.modJornal >= umbralJornal(s);
        if (o.contratado) { o.dM = P.jornalPaga; o.resultado = `Te contratan: ${P.jornalPaga} monedas. La franja siguiente sigues trabajando.`; }
        else { wT = 0; wTB = 0; o.resultado = "No te contratan."; }
        break;
      case "lavar":
        o.contratado = v >= P.lavarUmbral;
        if (o.contratado) { o.dM = P.lavarPaga; o.resultado = `Te dan ropa que lavar: ${P.lavarPaga} monedas.`; }
        else { wT = 0; wTB = 0; o.resultado = "Hoy no te dan ropa que lavar."; }
        break;
      case "hurtar":
        if (o.cat === "Autoridad") { o.detenido = true; o.motivoDet = `${o.testigo === "Guardia" ? "La guardia" : "Un alguacil"} te ve hurtar.`; o.resultado = "Te pillan en el acto."; }
        else if (ev <= 2) o.resultado = "Fallas y te ven.";
        else { o.dM = R.HURTAR_DADO[ev - 1]; o.resultado = `Robas ${o.dM} monedas.`; }
        break;
      case "descansar":
        if (o.cat === "Nadie" && v >= P.descansarUmbral) { o.dC = P.descansarC; o.resultado = `Descansas: +${P.descansarC} de cuerpo.`; }
        else if (o.cat === "Nadie") o.resultado = "Nadie te molesta, pero el hambre no te deja pegar ojo.";
        else o.resultado = "Te ven tirado: no descansas.";
        break;
      case "curarse":
        o.hospital = true;
        if (s.cuerpo <= P.recogidoCuerpo) { o.recogido = true; o.resultado = "Llegas sin fuerzas: te recogen y ya no sales."; }
        else if (v >= P.curarUmbral) {
          o.dC = P.curarC; o.dT += P.curarT; o.apunte = true;
          if ((s.apuntes || 0) + 1 >= hospVeces(s)) { o.recogido = true; o.resultado = `Te curan, pero es la ${hospVeces(s)}ª vez que te apuntan: te recogen y ya no sales.`; }
          else o.resultado = `Te curan: +${P.curarC} de cuerpo. Te apuntan en el libro (${P.curarT}). Llevas ${(s.apuntes || 0) + 1} de ${hospVeces(s)}.`;
        }
        else o.resultado = "Hoy no te atienden.";
        break;
      case "examen":
        if (v >= (p.difExamen || 99)) { o.fijarT = -2; o.resultado = "Pasas el examen: entras en la lista de pobres (−2). Ya no puedes pedir; cada día que cumplas en tu parroquia, por la noche te darán una ración."; }
        else { o.dT += 1; o.resultado = "Suspendes el examen (+1)."; }
        break;
      case "cumplir":
        o.cumple = true;
        o.resultado = "Cumples con la parroquia: oyes misa y el cura te ve. Esta noche te toca tu ración, si nadie de los que llevan la lista te ve pedir.";
        break;
      case "compartir":
        if (s.raciones >= 1) o.dR = -1; else o.dM = -P.compartirCoste;
        o.rumor = 1; o.relacion = { contacto: eleccion.contacto || "nuevo", delta: 1 }; o.senalar = true;
        o.resultado = `Compartes ${s.raciones >= 1 ? "una ración" : "una moneda"} con ${o.nombre}. Te cuenta algo (+1 rumor) y os acercáis (relación +1).`;
        break;
      case "juntarse":
        o.relacion = { contacto: eleccion.contacto || "nuevo", delta: 1 }; o.senalar = true;
        if (v >= P.juntarseRumor) { o.rumor = 1; o.resultado = `Pasas el rato con ${o.nombre}: os acercáis (relación +1) y te cuenta algo (+1 rumor).`; }
        else o.resultado = `Pasas el rato con ${o.nombre}: os acercáis (relación +1), pero no te cuenta nada.`;
        break;
      case "delatar":
        { const cd = s.contactos.find((x) => x.id === eleccion.contacto);
          const paga = cd && cd.rel <= 1 && P.delatarDesconocido !== undefined && P.delatarDesconocido !== null ? P.delatarDesconocido : P.delatarPaga;
          o.dM = paga * (pregonActivo(s, 3) ? 2 : 1); }
        o.dT += P.delatarT; o.aten += 1;
        o.delatado = eleccion.contacto;
        if (o.cat === "Otro pobre") { o.venganzaNueva = true; o.seCorreLaVoz = true; }
        o.resultado = `Delatas a ${o.nombre}: ${o.dM} monedas y ${P.delatarT}. La autoridad toma nota.`;
        break;
      case "cruzar":
        o.entrando = s.fuera; o.cruce = true;
        if (o.entrando && s.dia >= P.pregonVence && p.forastero && !lic && o.cat === "Autoridad") { o.cruce = false; o.resultado = "Ha vencido el pregón: la guardia no deja entrar a forasteros."; }
        else o.resultado = o.entrando ? "Entras en la ciudad." : "Sales de la ciudad.";
        break;
    }
    o.dT += wT; o.dTB += wTB;
    // palanca: desde el pregón, la autoridad busca a los forasteros que ve dentro de la muralla
    if (o.cat === "Autoridad" && persigue(s, sid)) {
      o.dTB += P.pregonPersigue; o.persigue = true;
    }
    if (accion === "pedir" && s.monedas > P.dineroUmbral && (o.cat === "Autoridad" || o.cat === "Beneficencia")) { o.dT += 1; o.fingidorDinero = true; }

    if (o.testigo) {
      let l = `${o.testigo} (dado de testigo ${o.w}): ${ef.txt}.`;
      switch (o.cond) {
        case "REPITE": l += o.condOk ? " Ya habías pedido aquí hoy." : " Es la primera vez hoy: no pasa nada."; break;
        case "RIVAL": l += ` Saca ${o.x}: ${o.condOk ? "te delata" : "no te delata"}.`; break;
        case "IMPEDIDO": l += o.condOk ? " Pareces impedido." : " Pareces válido."; break;
        case "EXAMEN": l += ` Saca ${o.x}${s.treta && s.treta.catalogada ? " (+1, tu treta está catalogada)" : ""} contra tu ${s.treta.calidad}: ${o.condOk ? "te descubre" : "no te descubre"}.`; break;
        case "DELATOR": l += ` Saca ${o.x}: ${o.condOk ? "te delata" : "te encubre"}.`; break;
        case "FORASTERO": l += o.condOk ? " Eres forastero." : ""; break;
      }
      if ((accion === "trabajar" || accion === "lavar") && !o.contratado && ef.t) l += " Como no trabajas, no cuenta.";
      o.lineas.push(l);
    }
    if (o.persigue) o.lineas.push(`Eres forastero y el pregón de expulsión te busca: Te buscan +${P.pregonPersigue}.`);
    if (o.fingidorDinero) o.lineas.push(`Llevas ${s.monedas} monedas encima: un pobre con dinero es un fingidor (+1).`);
    if (s.venganza && o.cat === "Otro pobre" && accion !== "delatar") { o.dTB += 2; o.venganzaUsada = true; o.lineas.push("Es el pobre al que delataste: te reconoce y te delata (Te buscan +2)."); }
    if (accion === "hurtar") o.aten += o.cat && o.cat !== "Nadie" ? 2 : 0;
    else if (o.cat === "Autoridad") o.aten += 1;
    if (!o.detenido && s.dia >= P.pregonVence && p.forastero && !lic && o.cat === "Autoridad" && sid !== "puente") {
      o.detenido = true; o.motivoDet = "Ha vencido el pregón: eres forastero y te ve la autoridad dentro de la muralla.";
    }
    if (!o.detenido && s.tb + o.dTB >= P.tbMax) { o.detenido = true; o.motivoDet = `«Te buscan» llega a ${P.tbMax}.`; }
    o.descubierta = o.grupo === "Pedir con treta" && o.cond === "EXAMEN" && o.condOk;
    if (o.descubierta) o.lineas.push("Tu treta queda catalogada: desde mañana rinde menos y te pillan antes. La autoridad no la olvida entre partidas.");
    if (o.grupo === "Pedir estando en la lista" && (o.cat === "Beneficencia" || o.cat === "Autoridad")) {
      o.borrado = true;
      o.lineas.push("Te han visto pedir: te borran de la lista. Esta noche no hay ración, y para volver hace falta otro examen.");
    }
    if (o.senalar && !o.detenido) {
      o.vistoJuntos = o.cat === "Autoridad";
      o.lineas.push(o.vistoJuntos ? `Os ha visto un alguacil: esta noche interrogará a ${o.nombre}.` : `Queda señalado quien estuvo contigo: si esta noche la autoridad interroga, irá a por ${o.nombre}.`);
    }
    if (o.venganzaNueva) o.lineas.push("Otro pobre te ha visto: se corre la voz. El resto de tu red te baja la relación (−1) y alguien se vengará la próxima vez que te vea otro pobre.");
    if (o.detenido) o.lineas.push("TE DETIENEN. " + o.motivoDet + " La jornada se acaba.");
    return o;
  }

  function aplicar(s, eleccion, o) {
    if (eleccion.dado !== null && eleccion.dado !== undefined) s.dados[eleccion.dado].usado = true;
    const antes = snapshot(s);
    s.monedas = Math.max(0, s.monedas + o.dM);
    s.raciones = Math.max(0, s.raciones + o.dR);
    s.cuerpo = clamp(s.cuerpo + o.dC, 0, 10);
    if (o.recogido) aplicarT(s, 0, { recogido: true });
    else if (o.borrado) { aplicarT(s, 0, { fijar: -1 }); if (o.dT) aplicarT(s, o.dT); }
    else if (o.fijarT !== undefined) aplicarT(s, 0, { fijar: o.fijarT });
    else aplicarT(s, o.dT, { hospital: o.hospital });
    s.tb = clamp(s.tb + o.dTB, 0, P.tbMax);
    s.rumores += o.rumor;
    s.hoy.atencion += o.aten;
    if (o.apunte) s.apuntes = (s.apuntes || 0) + 1;
    if (o.cumple) s.hoy.cumplido = true;
    if (o.borrado) s.hoy.borrado = true;
    if (o.accion === "pedir") s.hoy.pedidas[o.sitio] = (s.hoy.pedidas[o.sitio] || 0) + 1;
    s.hoy.actuado[o.sitio] = (s.hoy.actuado[o.sitio] || 0) + 1;
    if (o.cat && o.cat !== "Nadie") s.hoy.visto[o.sitio] = (s.hoy.visto[o.sitio] || 0) + 1;
    if (o.venganzaUsada) s.venganza = false;
    if (o.venganzaNueva) s.venganza = true;
    if (o.relacion) {
      let c = o.relacion.contacto === "nuevo" ? null : s.contactos.find((x) => x.id === o.relacion.contacto);
      if (!c) {
        c = { id: "c" + (s.contactos.length + 1) + "_" + s.dia + "_" + s.franja, nombre: o.nombre, rel: 0, lado: o.sitio === "puente" ? "fuera" : "dentro", desde: s.dia };
        s.contactos.push(c); s.nombresUsados.push(o.nombre);
      }
      c.rel = clamp(c.rel + o.relacion.delta, 0, 5);
      if (o.senalar && !o.detenido) {
        s.hoy.senalados = s.hoy.senalados || []; s.hoy.vistosJuntos = s.hoy.vistosJuntos || [];
        if (!s.hoy.senalados.includes(c.id)) s.hoy.senalados.push(c.id);
        if (o.vistoJuntos && !s.hoy.vistosJuntos.includes(c.id)) s.hoy.vistosJuntos.push(c.id);
      }
    }
    if (o.delatado) {
      const c = s.contactos.find((x) => x.id === o.delatado);
      if (c) { c.estado = "delatado"; c.rel = 0; }
      if (o.seCorreLaVoz) s.contactos.filter((x) => !x.estado).forEach((x) => { x.rel = Math.max(0, x.rel - 1); });
    }
    if (o.accion === "cruzar" && o.cruce) s.fuera = !s.fuera;
    if (o.descubierta) catalogar(s, s.treta.nombre, `Descubierta por ${o.testigo === "Cura" ? "el cura" : "la beneficencia"}`);
    if (o.accion === "trabajar" && o.contratado) s.ocupada = true;
    if (o.detenido) s.hoy.detenido = { motivo: o.motivoDet, termo: s.termo, noche: false };
    const lineasLic = antes.termo === -2 && s.termo > -2 ? ["Sales de la lista."] : antes.termo !== -2 && s.termo === -2 ? ["Entras en la lista."] : [];
    diaActual(s).acciones.push({
      franja: o.franjaNombre, sitio: sitio(o.sitio).nombre, accion: R.ACCIONES[o.accion].nombre, dado: o.v, testigo: o.testigo, dadoTestigo: o.w, dadoExtra: o.x,
      resultado: o.resultado, lineas: o.lineas.concat(lineasLic), cambios: { monedas: o.dM, raciones: o.dR, cuerpo: o.dC, termo: s.termo - antes.termo, tb: s.tb - antes.tb, rumores: o.rumor, atencion: o.aten },
      rumorGastado: !!eleccion.rumorGastado, estado: snapshot(s),
    });
    if (s.termo <= -3) { terminar(s, "Recogido", o.recogido ? (o.apunte ? "Le apuntaron en el hospital por tercera vez." : "Entró al hospital sin fuerzas.") : "Le apuntaron en el hospital estando en la lista."); return; }
    avanzarFranja(s);
  }

  function gastarRumor(s) {
    if (s.rumores < 1) throw new Error("No tienes rumores.");
    s.rumores -= 1;
  }

  function avanzarFranja(s) {
    if (s.hoy.detenido) { s.fase = "castigo"; return; }
    s.franja += 1;
    if (s.franja <= 4 && s.ocupada) {
      diaActual(s).acciones.push({ franja: R.FRANJAS[s.franja], sitio: "", accion: "Sigue trabajando", resultado: "Sigues en el jornal.", lineas: [], cambios: {}, estado: snapshot(s) });
      s.ocupada = false; s.franja += 1;
    }
    s.ocupada = false;
    if (s.franja > 4) s.fase = "noche";
  }

  function pasarFranja(s) {
    diaActual(s).acciones.push({ franja: R.FRANJAS[s.franja], sitio: "", accion: "Nada", resultado: "Dejas pasar la franja.", lineas: [], cambios: {}, estado: snapshot(s) });
    avanzarFranja(s);
  }

  function acabarDia(s) {
    while (s.fase === "franja") pasarFranja(s);
  }

  function catalogar(s, treta, como) {
    if (s.catalogo.some((c) => c.treta === treta && c.partida === s.id)) return;
    s.catalogo.push({ treta, partida: s.id, jugador: s.jugador, dia: s.dia, como });
  }

  // ---------------------------------------------------------------- castigo
  function textoCastigo(t) {
    if (t <= 0) return "reprensión (+1 en el termómetro)";
    if (t === 1) return "azotes (−3 de cuerpo)";
    if (t === 2) return "trabajo forzado o marca";
    return "la horca";
  }

  function castigoPendiente(s) {
    const t = s.hoy.detenido.termo;
    return { termo: t, clasificacion: clasif(t), texto: textoCastigo(t), eleccion: t === 2, motivo: s.hoy.detenido.motivo, noche: s.hoy.detenido.noche };
  }

  function aplicarCastigo(s, eleccion) {
    const d = s.hoy.detenido, t = d.termo;
    let tipo, txt;
    if (t <= 0) { tipo = "Reprensión"; aplicarT(s, 1); txt = "Te reprenden y te devuelven a tu parroquia. Termómetro +1."; }
    else if (t === 1) { tipo = "Azotes"; s.cuerpo = clamp(s.cuerpo - 3, 0, 10); txt = "Te azotan en público. −3 de cuerpo."; }
    else if (t === 2) {
      if (eleccion === "marca") { tipo = "Marca"; s.marca = true; s.termo = Math.max(s.termo, 1); txt = "Te marcan. El termómetro ya no bajará de +1 y los alguaciles te reconocerán."; }
      else { tipo = "Trabajo forzado"; s.tf = P.tfDias; txt = `Trabajo forzado sin salario: ${P.tfDias} días sin acciones, −1 de cuerpo cada día.`; }
    } else { tipo = "Horca"; txt = "Te condenan a la horca."; }
    s.detenciones = (s.detenciones || 0) + 1;
    const conf = s.monedas; s.monedas = 0;
    s.tb = Math.min(P.reincidenciaMax, s.detenciones); s.fuera = !!(P.expulsionDias && pj(s).forastero && s.dia >= P.pregonInicio && s.detenciones >= desdeExpulsion(s)); d.castigado = true; s.hoy.castigo = tipo;
    if (ninoConmigo(s) && tipo !== "Horca") {
      const c = puedeCuidar(s).sort((a, b) => b.rel - a.rel)[0];
      if (c) { s.nino.con = c.id; txt += ` ${c.nombre} se queda con tu hijo mientras tanto.`; }
      else { perderNino(s, "Mientras te llevan detenida, se llevan al niño a los niños de la doctrina."); txt += " Se llevan a tu hijo a los niños de la doctrina."; }
    }
    if (tipo !== "Horca") txt += `${conf ? " Te quitan las " + conf + " monedas que llevabas." : ""} Ya te conocen: «Te buscan» empieza en ${s.tb}.`;
    diaActual(s).castigo = { motivo: d.motivo, termo: t, tipo, noche: d.noche, txt };
    if (tipo === "Horca") { terminar(s, "Horca", `Detenido con el termómetro en +3. ${d.motivo}`); return { tipo, txt }; }
    // palanca suave: tras el pregón, al forastero detenido lo sacan de la muralla y no le dejan entrar unos días
    if (P.expulsionDias && pj(s).forastero && s.dia >= P.pregonInicio && !s.final && s.detenciones >= desdeExpulsion(s)) {
      s.vetadoHasta = s.dia + P.expulsionDias; s.fueraTrasCastigo = true;
      txt += ` Eres forastero y ya ha salido el pregón: te sacan de la ciudad y la guardia no te dejará entrar hasta el día ${s.vetadoHasta + 1}.`;
      diaActual(s).castigo.txt = txt;
    }
    // palanca: tras el pregón, al forastero detenido lo echan de la ciudad
    if (P.expulsion && pj(s).forastero && s.dia >= P.pregonInicio) { terminar(s, "Expulsado", `Detenido tras el pregón de expulsión: le echan de la ciudad. ${d.motivo}`); return { tipo, txt: txt + " Eres forastero y ya ha salido el pregón: te echan de la ciudad." }; }
    if (s.cuerpo <= 0) { terminar(s, "Muerte", "Murió por los azotes."); return { tipo, txt }; }
    if (d.noche) despuesDeNoche(s); else s.fase = "noche";
    return { tipo, txt };
  }

  // ---------------------------------------------------------------- noche
  function precioPan(s) { return cal(s.dia).pan + (s.hoy && s.hoy.dia === s.dia ? s.hoy.panExtra || 0 : 0); }
  // la ración de la lista: a quien está en ella, ha cumplido hoy y no le han visto pedir
  function racionLista(s) {
    if (!(licencia(s) && s.hoy && s.hoy.cumplido && !s.hoy.borrado && !s.hoy.forzado)) return 0;
    const extra = P.listaNinoCada && ninoConmigo(s) && ((s.mediasNino || 0) + 1) % P.listaNinoCada === 0 ? 1 : 0;
    return P.listaRacion + extra;
  }
  // lo que dice el cura por la noche (lo usan el motor y la interfaz)
  function lineaLista(s, deLista) {
    if (!deLista) return licencia(s) && s.hoy && !s.hoy.forzado ? "Hoy no has cumplido con la parroquia: no hay ración de la lista." : "";
    if (!(P.listaNinoCada && ninoConmigo(s))) return `Has cumplido: el cura te da tu ración de la lista (+${deLista}).`;
    if (deLista > P.listaRacion) return `Has cumplido: el cura te da tu ración de la lista y la del niño (+${deLista}). Al niño le dan media: una ración cada ${P.listaNinoCada} noches que cumplas.`;
    const faltan = P.listaNinoCada - (((s.mediasNino || 0) + 1) % P.listaNinoCada);
    return `Has cumplido: el cura te da tu ración de la lista (+${deLista}). Al niño le dan media: ${faltan === 1 ? "la próxima noche que cumplas" : "dentro de " + faltan + " noches que cumplas"}, otra ración para él.`;
  }
  function racionesNecesarias(s) { return s.hoy.forzado ? 0 : pj(s).raciones + (ninoConmigo(s) ? 1 : 0); }

  function opcionesNoche(s) {
    if ((s.hoy.detenido && s.hoy.detenido.castigado && !s.hoy.detenido.noche) || s.hoy.forzado) {
      const c = R.DORMIR.find((d) => d.id === "carcel");
      return [Object.assign({}, c, { ok: true, motivo: "", riesgos: [], desc: s.hoy.forzado ? "Estás cumpliendo trabajo forzado." : "Te han detenido: pasas la noche en la cárcel." })];
    }
    const lado = s.fuera ? "fuera" : "dentro";
    return R.DORMIR.filter((d) => d.id !== "carcel").map((d) => {
      const o = Object.assign({}, d, { ok: true, motivo: "", riesgos: [], con: null });
      if (d.costePan) { o.coste = precioPan(s) + (P.mesonExtra || 0); o.desc = `${o.coste} monedas (lo que cuesta una ración${P.mesonExtra ? " más " + P.mesonExtra : ""}; la cena no va incluida). ${o.c > 0 ? "+" + o.c + " de cuerpo" : "Duermes bajo techo (no pierdes cuerpo)"} y oyes un rumor (+1).`; }
      if (d.lado !== "ambos" && d.lado !== lado) { o.ok = false; o.motivo = lado === "fuera" ? "Estás fuera de la muralla." : "Estás dentro de la muralla: para dormir en el arrabal tienes que haber salido antes por la puerta."; }
      if (d.id === "red") {
        const c = mejorContacto(s, lado, techoRel());
        if (!c) { o.ok = false; o.motivo = `Necesitas relación ${techoRel()} o más con alguien de tu red que viva de este lado de la muralla.`; }
        else { o.con = c.nombre; o.nombre = "Con " + c.nombre; }
      }
      if (o.coste > s.monedas) { o.ok = false; o.motivo = `Cuesta ${o.coste} monedas y no las tienes.`; }
      if (d.riesgo > 0) {
        const pct = Math.round((d.riesgo / 6) * 100);
        o.riesgos.push(`${d.riesgo === 1 ? "Con un 1" : "Con 1-" + d.riesgo} en el dado de noche (${pct} %): ${d.riesgoTxt.toLowerCase()}.`);
        if (d.rtb > 0 && s.tb + d.rtb >= P.tbMax) {
          const t = clamp(s.termo + d.rt, -1, Math.max(techo(s), s.termo));
          o.riesgos.push(`¡Cuidado! «Te buscan» llegaría a ${P.tbMax}: te detendrían, y con termómetro ${signo(t)} te tocaría ${textoCastigo(t)}.`);
          o.peligro = true;
        }
        if (d.rc < 0 && s.cuerpo + d.rc <= 0) { o.riesgos.push("¡Cuidado! Podrías morir."); o.peligro = true; }
      }
      if (d.raso && s.hoy.frio) o.riesgos.push("Tormenta esta noche: al raso, otro −1 de cuerpo.");
      if (d.raso && s.monedas > P.dineroUmbral) o.riesgos.push(`Llevas ${s.monedas} monedas: si después de comprar sigues con más de ${P.dineroUmbral}, con un 1 (17 %) te roban la mitad y te pegan (−1 de cuerpo).`);
      if (d.raso && s.cuerpo + d.c <= 0) { o.riesgos.push("¡Cuidado! Al raso podrías morir esta noche."); o.peligro = true; }
      if (d.id === "hospital" && s.cuerpo > P.hospitalMaxCuerpo) { o.ok = false; o.motivo = `Solo admiten enfermos: necesitas cuerpo ${P.hospitalMaxCuerpo} o menos.`; }
      if (d.id === "hospital" && s.apuntes > 0) o.riesgos.push(`Te han apuntado ${s.apuntes} ${s.apuntes === 1 ? "vez" : "veces"}: a la ${hospVeces(s)}ª te recogen.`);
      if (d.id === "hospital" && (s.apuntes || 0) >= hospVeces(s) - 1) { o.riesgos.push("¡Cuidado! Si duermes aquí te recogen: fin de la partida."); o.peligro = true; }
      if (d.id === "hospital") {
        if (s.cuerpo <= P.recogidoCuerpo) { o.riesgos.push("¡Cuidado! Con cuerpo 2 o menos, te recogen: fin de la partida."); o.peligro = true; }
        else if (licencia(s)) { o.riesgos.push("¡Cuidado! Estás en la lista: si te apuntan, te recogen (−3): fin de la partida."); o.peligro = true; }
      }
      return o;
    });
  }

  function dormir(s, eleccion) {
    const opciones = opcionesNoche(s);
    const op = opciones.find((x) => x.id === eleccion.dormir);
    if (!op || !op.ok) throw new Error("No puedes dormir ahí.");
    const pan = precioPan(s);
    const compra = Math.max(0, eleccion.compra | 0);
    if (compra * pan + op.coste > s.monedas) throw new Error("No te llega el dinero.");
    const o = { dormir: op.id, nombre: op.nombre, compra, pan, dado: null, riesgo: false, dC: 0, dT: 0, dTB: 0, dM: 0, dR: 0, rumor: 0, faltan: 0, recogido: false, detenido: false, aten: 0, lineas: [] };
    o.dM -= op.coste + compra * pan;
    o.dC += op.c; o.dT += op.t; o.dTB += op.tb; o.rumor += op.rumor;
    if (op.riesgo > 0) {
      o.dado = d6(s);
      if (o.dado <= op.riesgo) {
        o.riesgo = true; o.dC += op.rc; o.dT += op.rt; o.dTB += op.rtb;
        if (op.id === "portico") o.aten += 1;
        o.lineas.push(`Dado de noche ${o.dado}: ${op.riesgoTxt.toLowerCase()}.`);
      } else o.lineas.push(`Dado de noche ${o.dado}: noche tranquila.`);
    }
    if (op.raso) o.lineas.unshift("Duermes al raso: −1 de cuerpo.");
    if (op.raso && s.hoy.frio) { o.dC -= 1; o.lineas.push("La tormenta te cala: otro −1 de cuerpo."); }
    if (op.raso && s.monedas + o.dM > P.dineroUmbral) {
      o.dadoRobo = d6(s);
      if (o.dadoRobo <= P.roboRiesgo) {
        const robo = Math.ceil((s.monedas + o.dM) / 2);
        o.dM -= robo; o.dC += P.roboCuerpo; o.robado = robo;
        o.lineas.push(`Mientras duermes te roban ${robo} monedas y te pegan (${P.roboCuerpo} de cuerpo).`);
      }
    }
    if (op.id === "hospital" && (s.cuerpo <= P.recogidoCuerpo || (s.apuntes || 0) + 1 >= hospVeces(s))) o.recogido = true;
    if (op.id === "hospital") s.apuntes = (s.apuntes || 0) + 1;
    if (op.id === "meson") o.lineas.push("En el mesón oyes un rumor (+1).");
    if (op.id === "red") o.lineas.push(`Duermes con ${op.con}: nadie te ve.`);
    if (op.id === "hospital") o.lineas.push(o.recogido ? (s.cuerpo <= P.recogidoCuerpo ? "Llegas sin fuerzas: te recogen." : `Es la ${hospVeces(s)}ª vez que te apuntan: te recogen.`) : `Te curan y te apuntan en el libro (−1). Llevas ${s.apuntes} de ${hospVeces(s)}.`);
    const necMadre = s.hoy.forzado ? 0 : pj(s).raciones;
    const necNino = ninoConmigo(s) && !s.hoy.forzado ? 1 : 0;
    const deLista = racionLista(s);
    const lin = lineaLista(s, deLista);
    if (lin) o.lineas.push(lin);
    if (deLista && P.listaNinoCada && ninoConmigo(s)) s.mediasNino = (s.mediasNino || 0) + 1;
    let disp = s.raciones + compra + deLista, prest = 0;
    if (disp < necMadre + necNino) {
      const amigo = contactosDisponibles(s).filter((c) => c.rel >= P.prestamoRel).sort((a, b) => b.rel - a.rel)[0];
      if (amigo) { prest = 1; amigo.rel -= 1; o.lineas.push(`${amigo.nombre} comparte su pan contigo (relación −1).`); }
    }
    disp += prest;
    let comeMadre, comeNino;
    if (disp >= necMadre + necNino) { comeMadre = necMadre; comeNino = necNino; }
    else if (eleccion.comeNino === false) { comeMadre = Math.min(necMadre, disp); comeNino = Math.min(necNino, disp - comeMadre); }
    else { comeNino = Math.min(necNino, disp); comeMadre = Math.min(necMadre, disp - comeNino); }
    o.faltan = necMadre - comeMadre; o.faltanNino = necNino - comeNino;
    o.dR = compra + deLista - Math.max(0, comeMadre + comeNino - prest);
    o.dC += o.faltan * P.hambreC;
    if (necMadre) o.lineas.push(o.faltan ? `${necNino ? "Le das tu parte al niño. " : ""}Te ${o.faltan === 1 ? "falta 1 ración" : "faltan " + o.faltan + " raciones"}: ${signo(o.faltan * P.hambreC)} de cuerpo.` : necNino ? (o.faltanNino ? "Comes tú." : "Coméis los dos.") : "Comes.");
    o.dNino = 0;
    if (s.nino && !s.nino.perdido) {
      if (!s.nino.con && necNino) {
        if (o.faltanNino) { o.dNino += P.ninoHambre; o.lineas.push(`El niño se acuesta sin comer (${signo(P.ninoHambre)} a su cuerpo).`); }
        if (op.raso && s.hoy.frio) { o.dNino -= 1; o.lineas.push("La tormenta también le cala a él (−1 a su cuerpo)."); }
        if (!op.raso && !o.faltanNino) { o.dNino += 1; o.lineas.push("Bajo techo y comido, el niño se recupera (+1)."); }
      } else if (s.nino.con) {
        const c = s.contactos.find((x) => x.id === s.nino.con);
        o.dNino += 1;
        if (s.raciones + o.dR >= 1) { o.dR -= 1; o.lineas.push(`Le das una ración a ${c.nombre} por cuidar del niño.`); }
        else if (s.monedas + o.dM >= pan) { o.dM -= pan; o.lineas.push(`Le pagas ${pan} monedas a ${c.nombre} por cuidar del niño.`); }
        else { c.rel = Math.max(0, c.rel - 1); o.lineas.push(`No tienes con qué pagar a ${c.nombre} por cuidar del niño: relación −1.`); }
      }
    }
    const quedan = s.raciones + o.dR;
    if (quedan > P.hatillo) { const pierdes = quedan - P.hatillo; o.dR -= pierdes; o.perdidas = pierdes; o.lineas.push(`Solo puedes guardar ${P.hatillo} raciones: pierdes ${pierdes} (se ponen duras o te las quitan).`); }
    if (pregonActivo(s, 3)) {
      contactosDisponibles(s).filter((c) => c.rel <= P.traicionRel).forEach((c) => {
        if (d6(s) <= 1) { c.estado = "traidor"; o.dTB += 2; o.lineas.push(`${c.nombre} te vende al alguacil por el doble de lo de costumbre (Te buscan +2).`); }
      });
    }
    if (s.hoy.forzado) { o.dC += P.tfCuerpo; o.lineas.push(`Trabajo forzado: ${P.tfCuerpo} de cuerpo.`); }

    const antes = snapshot(s);
    s.monedas += o.dM; s.raciones += o.dR; s.rumores += o.rumor;
    s.cuerpo = clamp(s.cuerpo + o.dC, 0, 10);
    if (s.nino && !s.nino.perdido) s.nino.cuerpo = clamp(s.nino.cuerpo + o.dNino, 0, P.ninoMax);
    aplicarT(s, o.dT, { hospital: op.id === "hospital", recogido: o.recogido });
    if (antes.termo === -2 && s.termo > -2) o.lineas.push("Sales de la lista.");
    s.tb = clamp(s.tb + o.dTB, 0, P.tbMax);
    s.hoy.atencion += o.aten;
    if (s.hoy.forzado) s.tf = Math.max(0, s.tf - 1);
    s.ultimoDormir = op.id;
    diaActual(s).noche = { donde: op.nombre, dado: o.dado, compra, pan, faltan: o.faltan, lineas: o.lineas.slice(), cambios: { cuerpo: s.cuerpo - antes.cuerpo, monedas: s.monedas - antes.monedas, raciones: s.raciones - antes.raciones, termo: s.termo - antes.termo, tb: s.tb - antes.tb }, estado: snapshot(s) };
    if (!s.hoy.detenido && s.tb >= P.tbMax && s.termo > -3) {
      s.hoy.detenido = { motivo: "La ronda te encuentra de noche y «Te buscan» llega a " + P.tbMax + ".", termo: s.termo, noche: true };
      o.detenido = true;
      o.lineas.push("TE DETIENEN DE NOCHE.");
      s.fase = "castigo";
      return o;
    }
    despuesDeNoche(s);
    return o;
  }

  function despuesDeNoche(s) {
    if (s.final) return;
    if (s.termo <= -3) { terminar(s, "Recogido", "Le recogieron en el hospital."); return; }
    if (s.cuerpo <= 0) { terminar(s, "Muerte", "Murió de hambre y debilidad."); return; }
    s.tiempos[s.dia].fin = ahora();
    diaActual(s).fin = snapshot(s);
    if (s.dia >= R.CALENDARIO.length) {
      // la viuda gana si llegan los dos: el niño con ella o en casa de alguien de su red
      const n = s.nino;
      if (n && !n.perdido) {
        const c = n.con ? s.contactos.find((x) => x.id === n.con) : null;
        if (n.cuerpo <= 0) perderNino(s, "El niño enferma gravemente. Se lo llevan al hospital de niños y no te dejan verlo.");
        else if (n.con && (!c || c.estado)) perderNino(s, `${c ? c.nombre : "Quien cuidaba de tu hijo"} ya no está. La autoridad encuentra al niño y se lo lleva a los niños de la doctrina.`);
      }
      if (n && n.perdido) { terminar(s, "Sin el niño", "Llegó a la noche del día " + s.dia + ", pero sin su hijo."); return; }
      terminar(s, "Sobrevive", "Llegó a la noche del día " + s.dia + "."); return;
    }
    turnoAutoridad(s);
  }

  // ---------------------------------------------------------------- autoridad
  function turnoAutoridad(s) {
    const at = s.hoy.atencion;
    const n = at < P.aten2 ? 1 : at < P.aten3 ? 2 : 3;
    let mejor = "plaza", ms = -1;
    R.SITIOS.forEach((st) => {
      const sc = 10 * (s.hoy.visto[st.id] || 0) + (s.hoy.actuado[st.id] || 0);
      if (sc > ms) { ms = sc; mejor = st.id; }
    });
    const d = s.dia, movs = [];
    const senalados = () => (s.hoy.senalados || []).map((id) => s.contactos.find((c) => c.id === id)).filter((c) => c && disponible(s, c));
    const add = (tipo, fuerte, dado, escalada, objetivo) => {
      const m = { tipo, fuerte, dado, sitio: null, txt: "", escalada: !!escalada };
      if (tipo === "Interrogatorio" && !contactosDisponibles(s).length) { tipo = "Ronda"; m.tipo = "Ronda"; m.sinRed = true; }
      switch (tipo) {
        case "Interrogatorio": {
          const sen = senalados();
          const c = objetivo || alAzar(s, sen.length ? sen : contactosDisponibles(s));
          m.senalado = !objetivo && sen.includes(c); m.visto = !!objetivo;
          const x = d6(s);
          m.contacto = c.nombre; m.dadoInterroga = x;
          const conNino = s.nino && !s.nino.perdido && s.nino.con === c.id;
          if (x <= P.interrogaBase + (fuerte ? 1 : 0) - c.rel) {
            s.tb = clamp(s.tb + 2, 0, P.tbMax); c.estado = "traidor"; m.vendido = true;
            m.txt = `Interroga a ${c.nombre} (relación ${c.rel}; saca ${x}): te vende. Te buscan +2.`;
          } else {
            c.ausenteHasta = d + P.interrogaDias; c.ausenteMotivo = "detenido";
            m.txt = `Interroga a ${c.nombre} (relación ${c.rel}; saca ${x}): no dice nada. Se lo llevan ${P.interrogaDias} días.`;
          }
          if (conNino) m.txt += " Tenía a tu hijo.";
          if (m.visto) m.txt = `Un alguacil te vio con ${c.nombre}. ` + m.txt;
          else if (m.senalado) m.txt = `Va a por quien estuvo contigo. ` + m.txt;
          break;
        }
        case "Ronda":
          m.sitio = mejor;
          s.autoridad.rondas.push({ sitio: mejor, desde: d + 1, hasta: d + P.rondaDias, peso: fuerte ? 2 : 1 });
          m.txt = `Manda ${fuerte ? "una ronda doble" : "una ronda"} a ${sitio(mejor).nombre}, donde más te vieron: durante dos días, ${fuerte ? "el 1 y el 2" : "el 1"} del dado de testigo de ese sitio ${fuerte ? "son" : "es"} alguacil.`;
          break;
        case "Cerrar la puerta":
          s.autoridad.puerta.push(d + 1); if (fuerte) s.autoridad.puerta.push(d + 2);
          m.txt = `Cierra la puerta ${fuerte ? "dos días" : "mañana"}: desde fuera solo entran los de la lista.`;
          break;
        case "Pregón": {
          const dp = d6(s); m.dadoPregon = dp;
          const pr = R.PREGONES[dp - 1], dur = P.pregonDias * (fuerte ? 2 : 1);
          if (pr.tipo === 2) {
            const usada = Object.keys(s.usosTreta).sort((a, b) => s.usosTreta[b] - s.usosTreta[a])[0] || "Llagas fingidas";
            catalogar(s, usada, "Pregón de fingidores");
            m.txt = `Pregón: se pregonan los fingidores. «${usada}» queda catalogada.`;
          } else {
            s.autoridad.pregones.push({ tipo: pr.tipo, desde: d + 1, hasta: d + dur });
            m.txt = `Pregón durante ${dur} días: ${pr.txt.charAt(0).toLowerCase() + pr.txt.slice(1)}`;
          }
          break;
        }
        case "Examen general":
          s.autoridad.examen[d + 1] = Math.max(s.autoridad.examen[d + 1] || 0, fuerte ? 2 : 1);
          m.txt = `Examen general mañana: los de la lista pueden salir de ella${fuerte ? " (con 1-3)" : " (con 1-2)"}.`;
          break;
        case "Limosna pública": {
          const prev = s.autoridad.limosna[d + 1];
          s.autoridad.limosna[d + 1] = { sitio: P.sitioLimosna, nivel: Math.max(prev ? prev.nivel : 0, fuerte ? 2 : 1) };
          m.txt = `Limosna pública mañana en ${sitio(P.sitioLimosna).nombre}: pedir +${P.limosnaPub}, pero ${fuerte ? "solo miran alguaciles" : "miran la beneficencia y los alguaciles"}.`;
          break;
        }
      }
      if (m.sinRed) m.txt = "No sabe de nadie de tu red a quien interrogar. " + m.txt;
      if (m.escalada) m.txt = "Por el pregón, aprieta más: " + m.txt.charAt(0).toLowerCase() + m.txt.slice(1);
      movs.push(m);
    };
    add("Ronda", false, null);
    for (let i = 2; i <= n; i++) { const dado = d6(s); add(R.MOVIMIENTOS[dado - 1], i === 3, dado); }
    if (d >= P.escaladaDesde) { const dado = d6(s); add(R.MOVIMIENTOS[dado - 1], false, dado, true); }
    (s.hoy.vistosJuntos || []).forEach((id) => { const c = s.contactos.find((x) => x.id === id); if (c && disponible(s, c)) add("Interrogatorio", false, null, false, c); });
    s.ultimaAutoridad = { dia: d, atencion: at, movimientos: movs };
    diaActual(s).autoridad = { atencion: at, movimientos: movs.map((m) => m.txt) };
    s.fase = "autoridad";
    return s.ultimaAutoridad;
  }

  function siguienteDia(s) {
    if (s.fase !== "autoridad") throw new Error("Aún no ha acabado el día.");
    s.dia += 1;
    amanecer(s);
  }

  // ---------------------------------------------------------------- final
  function terminar(s, tipo, causa) {
    const c = mejorContacto(s);
    s.final = { tipo, dia: s.dia, causa, acompanado: c ? c.nombre : null };
    s.fase = "fin"; s.fin = ahora();
    if (s.tiempos[s.dia]) s.tiempos[s.dia].fin = s.tiempos[s.dia].fin || ahora();
    const da = diaActual(s); if (da) da.fin = snapshot(s);
  }

  function abandonar(s) { terminar(s, "Abandono", "Dejó la partida el día " + s.dia + "."); }

  function textoFinal(s) {
    const f = s.final; if (!f) return "";
    const p = pj(s);
    const con = f.acompanado;
    const n = s.nino;
    const hijo = !n || f.tipo === "Sin el niño" ? "" : n.perdido ? " Tu hijo está en manos de la institución." : n.con ? ` ${(s.contactos.find((c) => c.id === n.con) || {}).nombre || "Alguien"} cuida de tu hijo.` : ["Horca", "Muerte"].includes(f.tipo) ? " Tu hijo se queda solo en Salamanca." : f.tipo === "Recogido" ? " A tu hijo lo llevan a los niños de la doctrina." : " Tu hijo sigue contigo.";
    return textoFinalBase(s, f, p, con) + hijo;
  }
  function textoFinalBase(s, f, p, con) {
    switch (f.tipo) {
      case "Horca": return `Te ahorcan en la plaza el día ${f.dia}. La autoridad lo llama justicia y lo hace delante de todos, para que se vea. ${con ? con + " está entre la gente que mira. Sabe tu nombre." : "Nadie de los que miran sabe tu nombre."}`;
      case "Muerte": return `Mueres el día ${f.dia}. ${con ? con + " se queda contigo hasta el final." : (p.id === "viuda" ? "Mueres sola." : "Mueres solo.")} El pan seguía subiendo.`;
      case "Expulsado": return `Te echan de Salamanca el día ${f.dia}, con la espalda abierta y un pregón detrás. Otra ciudad, otro pregón.`;
      case "Recogido": return `Te recogen el día ${f.dia}. Comerás todos los días, rezarás a sus horas y no volverás a salir. La piedad también encierra.`;
      case "Sobrevive": return `Llegas a la noche del día ${f.dia}. Sigues siendo pobre, pero sigues ${p.id === "viuda" ? "viva" : "vivo"}${p.forastero ? " y nadie te ha echado de la ciudad todavía" : ""}. La siega aún no ha empezado: el prototipo acaba aquí.`;
      case "Sin el niño": {
        const donde = s.nino && /hospital/.test(s.nino.motivo || "") ? "Está en el hospital de niños y no te dejan verlo" : "Está con los niños de la doctrina: le enseñarán a rezar y lo pondrán a servir";
        return `Llegas a la noche del día ${f.dia}. Sigues viva, pero sin tu hijo. ${donde}. Has salvado a uno de los dos.`;
      }
      case "Abandono": return `Dejas la partida el día ${f.dia}.`;
      default: return "";
    }
  }

  // ---------------------------------------------------------------- informe
  function minutosPorDia(s) {
    const out = {};
    Object.keys(s.tiempos).forEach((d) => {
      const t = s.tiempos[d];
      if (t.inicio && t.fin) out[d] = Math.round(((new Date(t.fin) - new Date(t.inicio)) / 60000) * 10) / 10;
    });
    return out;
  }

  function informe(s) {
    const p = pj(s);
    const L = [];
    const est = (e) => `cuerpo ${e.cuerpo}${e.nino === null || e.nino === undefined ? "" : e.nino === "perdido" ? " · niño perdido" : " · niño " + e.nino + (e.ninoCon ? " (con otra persona)" : "")} · monedas ${e.monedas} · raciones ${e.raciones} · termómetro ${signo(e.termo)} (${clasif(e.termo)}) · Te buscan ${e.tb} · rumores ${e.rumores}${e.fuera ? " · fuera de la muralla" : ""}`;
    const cam = (c) => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `${{ monedas: "monedas", raciones: "raciones", cuerpo: "cuerpo", termo: "termómetro", tb: "Te buscan", rumores: "rumores", atencion: "atención" }[k]} ${signo(v)}`).join(", ");
    const mins = minutosPorDia(s);
    L.push(`LIBER VAGATORUM · informe de partida (prototipo ${s.v})`);
    L.push("");
    L.push(`Jugador: ${s.jugador}`);
    L.push(`Personaje: ${p.nombre}`);
    L.push(`Empezó: ${s.inicio}`);
    if (s.fin) L.push(`Acabó: ${s.fin} (${Math.round((new Date(s.fin) - new Date(s.inicio)) / 60000)} minutos)`);
    if (s.final) L.push(`Final: ${s.final.tipo}, día ${s.final.dia}. ${s.final.causa}${s.final.acompanado ? " Acompañado por " + s.final.acompanado + "." : ""}`);
    if (Object.keys(mins).length) L.push(`Minutos por día: ${Object.entries(mins).map(([d, m]) => "día " + d + ": " + m).join(" · ")}`);
    L.push("");
    if (s.encuesta) {
      L.push("ENCUESTA");
      L.push(`Qué decisión te dolió: ${s.encuesta.dolio || "—"}`);
      L.push(`Qué sobró o estorbó: ${s.encuesta.sobro || "—"}`);
      L.push(`Qué echaste de menos o no entendiste: ${s.encuesta.falto || "—"}`);
      L.push(`Otros comentarios: ${s.encuesta.otros || "—"}`);
      L.push("");
    }
    L.push("PARTIDA DÍA A DÍA");
    s.diario.forEach((d) => {
      L.push("");
      L.push(`Día ${d.dia} · ${cal(d.dia).fecha} · pan a ${cal(d.dia).pan}`);
      L.push(`  Amanecer: ${est(d.amanecer.estado)}`);
      L.push(`  Dados: ${d.amanecer.dados.join(", ") || "ninguno"}`);
      d.amanecer.autoridad.forEach((x) => L.push(`  Autoridad visible: ${x}`));
      d.amanecer.eventos.forEach((x) => L.push(`  ${x}`));
      if (d.favor) L.push(`  Favor: ${d.favor}`);
      if (d.fingir) L.push(`  Finge: ${d.fingir.treta}, calidad ${d.fingir.calidad}${d.fingir.catalogada ? " (catalogada)" : ""}`);
      d.acciones.forEach((a) => {
        L.push(`  ${a.franja}: ${a.sitio ? a.sitio + " · " : ""}${a.accion}${a.dado ? " (dado " + a.dado + ")" : ""} → ${a.resultado}${a.rumorGastado ? " [repitió el testigo con un rumor]" : ""}`);
        a.lineas.forEach((l) => L.push(`      ${l}`));
        const c = cam(a.cambios); if (c) L.push(`      Cambios: ${c}`);
      });
      if (d.castigo) L.push(`  Detención${d.castigo.noche ? " de noche" : ""}: ${d.castigo.motivo} Termómetro ${signo(d.castigo.termo)} → ${d.castigo.tipo}. ${d.castigo.txt || ""}`);
      if (d.noche) {
        L.push(`  Noche: ${d.noche.donde}${d.noche.dado ? " (dado " + d.noche.dado + ")" : ""} · compra ${d.noche.compra} ${d.noche.compra === 1 ? "ración" : "raciones"} a ${d.noche.pan}`);
        d.noche.lineas.forEach((l) => L.push(`      ${l}`));
      }
      if (d.autoridad) L.push(`  Autoridad (atención ${d.autoridad.atencion}): ${d.autoridad.movimientos.join(" | ")}`);
      if (d.fin) L.push(`  Al acabar: ${est(d.fin)}`);
    });
    L.push("");
    L.push(`Red: ${s.contactos.length ? s.contactos.map((c) => c.nombre + " (relación " + c.rel + (c.estado ? ", " + ({ muerto: "muerto", traidor: "te vendió", delatado: "lo delataste" }[c.estado] || c.estado) : "") + ")").join(", ") : "nadie"}`);
    L.push(`Detenciones: ${s.detenciones || 0}`);
    if (s.nino) L.push(`Niño: ${s.nino.perdido ? "perdido el día " + s.nino.dia + " (" + s.nino.motivo + ")" : "cuerpo " + s.nino.cuerpo + (s.nino.con ? ", al cuidado de " + ((s.contactos.find((c) => c.id === s.nino.con) || {}).nombre || "alguien") : ", contigo")}`);
    L.push(`Catálogo de tretas de la autoridad: ${s.catalogo.length ? s.catalogo.map((c) => c.treta + " (" + c.como + ")").join(", ") : "vacío"}`);
    L.push("");
    L.push("--- DATOS PARA ANALIZAR (no hace falta leerlos) ---");
    const datos = Object.assign({}, s); delete datos.rng; delete datos.hoy;
    L.push(JSON.stringify(datos));
    return L.join("\n");
  }

  function resumenCorto(s) {
    const p = pj(s);
    return `${s.jugador} jugó con ${p.nombre}. Final: ${s.final ? s.final.tipo + " el día " + s.final.dia : "sin terminar"}.`;
  }

  const ENGINE = {
    d6, rand, clamp, signo, sitio, pj, cal, licencia, clasif, dadosPorCuerpo, modsDe, snapshot, maxRel, mejorContacto,
    resumenAutoridad, pregonExpulsion, nuevaPartida, amanecer, fingir, empezarFranjas, sitiosDisponibles, accionesEn,
    grupoEfecto, ganancia, previewTestigos, testigoPara, tirar, resolver, aplicar, gastarRumor, pasarFranja, acabarDia,
    castigoPendiente, aplicarCastigo, textoCastigo, opcionesNoche, dormir, precioPan, racionesNecesarias, turnoAutoridad,
    siguienteDia, abandonar, textoFinal, informe, resumenCorto, minutosPorDia, catalogada, puertaCerrada,
    responderFavor, contactosDisponibles, disponible, monedasPedir, racionLista, lineaLista, hospVeces, umbralJornal, ninoConmigo, dejarNino, recogerNino, puedeCuidar, techo,
  };
  root.ENGINE = ENGINE;
  if (typeof module !== "undefined" && module.exports) module.exports = ENGINE;
})(typeof window !== "undefined" ? window : globalThis);
