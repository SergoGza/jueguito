// Mapa estático: en un día dado (DIA=5 por defecto, un viernes corriente), qué puede sacar cada valor de dado, franja a franja,
// sin contar riesgos. Uso: node herramientas/mapa-dados.js   (DIA=4 para el Corpus, etc.)
const REPO = require("path").join(__dirname, "..") + "/";
globalThis.RULES = require(REPO + "rules.js");
const E = require(REPO + "engine.js");
const R = globalThis.RULES, P = R.PARAMS;
const DIA = +(process.env.DIA || 5);

function rinde(s, sid, acc, v) {
  const fr = E.sitio(sid).franjas[s.franja], p = E.pj(s), m = E.modsDe(s.dia, sid, s.franja);
  switch (acc) {
    case "pedir": if (fr.pedirDa === "racion") return v >= fr.umbral ? "1 ración" : ""; { const n = E.monedasPedir(s, sid, v); return n > 0 ? n + " mon." : ""; }
    case "trabajar": return v + p.modJornal >= P.jornalUmbral ? P.jornalPaga + " mon. (2 franjas)" : "";
    case "lavar": return v >= P.lavarUmbral ? P.lavarPaga + " mon." : "";
    case "hurtar": { const ev = Math.min(6, v + (m.modHurtar || 0)); return ev >= 3 ? R.HURTAR_DADO[ev - 1] + " mon. (riesgo)" : ""; }
    case "descansar": return v >= P.descansarUmbral ? "+1 cuerpo si nadie te ve" : "";
    case "curarse": return v >= P.curarUmbral ? "+2 cuerpo (solo enfermo, te apuntan)" : "";
    case "examen": return v >= (p.difExamen || 99) ? "licencia" : "";
    case "preguntar": return v >= P.preguntarUmbral ? "rumor y relación" : "";
    case "compartir": return "rumor y relación, pagando 1 ración";
    case "delatar": return "2 mon., pierdes a esa persona";
  }
  return "";
}

function mapa(pjid, conLicencia) {
  const s = E.nuevaPartida({ jugador: "mapa", personaje: pjid, seed: 1 });
  s.dia = DIA; s.fase = "franja"; s.dados = [{ v: 6, usado: false }];
  s.contactos = [{ id: "c1", nombre: "X", rel: 1, lado: "dentro", desde: 1 }];
  if (conLicencia) s.termo = -2;
  const filas = {};
  for (let v = 1; v <= 6; v++) filas[v] = { franjas: 0, sinRed: 0, usos: new Set() };
  for (let f = 0; f < 5; f++) {
    s.franja = f;
    const porV = {}; const porVsinRed = {};
    E.sitiosDisponibles(s).filter((x) => x.ok).forEach((st) => {
      E.accionesEn(s, st.id).filter((a) => a.ok && a.dado).forEach((a) => {
        for (let v = 1; v <= 6; v++) {
          const r = rinde(s, st.id, a.id, v);
          if (!r) continue;
          porV[v] = true;
          if (!["compartir", "delatar"].includes(a.id)) { porVsinRed[v] = true; filas[v].usos.add(`${a.id} en ${st.corto || st.id} (${R.FRANJAS[f]}): ${r}`); }
        }
      });
    });
    for (let v = 1; v <= 6; v++) { if (porV[v]) filas[v].franjas++; if (porVsinRed[v]) filas[v].sinRed++; }
  }
  return filas;
}

for (const p of R.PERSONAJES) {
  for (const lic of p.forastero ? [false] : [false, true]) {
    console.log(`\n=== ${p.nombre}${lic ? " · con licencia" : ""} · día ${DIA} ===`);
    const m = mapa(p.id, lic);
    for (let v = 1; v <= 6; v++) {
      console.log(`${v}: franjas con algún uso ${m[v].franjas}/5 · sin contar delatar ni compartir ${m[v].sinRed}/5`);
      if (v <= 3) [...m[v].usos].slice(0, 14).forEach((u) => console.log("     " + u));
    }
  }
}
