const path = require("path").join(__dirname, "..") + "/";
const N = +process.argv[2] || 500;
const L = {
  techoNoCura: (R) => R.DORMIR.forEach((d) => { if (d.id === "meson" || d.id === "red") d.c = 0; }),
  pan1: (R) => R.CALENDARIO.forEach((d) => { d.pan += 1; }),
  panMitad: (R) => R.CALENDARIO.forEach((d, i) => { if (i >= 3) d.pan += 1; }),
  pedirDuro: (R) => { R.PEDIR_DADO.splice(0, 6, 0, 0, 1, 1, 1, 2); },
  pedir6a2: (R) => { R.PEDIR_DADO[5] = 2; },
  descansar4: (R) => { R.PARAMS.descansarUmbral = 4; },
  curar1: (R) => { R.PARAMS.curarC = 1; },
  hospital1: (R) => R.DORMIR.forEach((d) => { if (d.id === "hospital") d.c = 1; }),
  dinero3: (R) => { R.PARAMS.dineroUmbral = 3; },
  ninoPedir2: (R) => { R.PARAMS.ninoPedir = 2; },
  pan2: (R) => R.CALENDARIO.forEach((d) => { d.pan += 2; }),
  pedirMuyDuro: (R) => { R.PEDIR_DADO.splice(0, 6, 0, 0, 0, 1, 1, 2); },
  mesonMas1: (R) => { R.PARAMS.mesonExtra = 1; },
  ninoPedir3: (R) => { R.PARAMS.ninoPedir = 3; },
  panProg: (R) => R.CALENDARIO.forEach((d, i) => { d.pan += i < 5 ? 1 : 2; }),
  panProg2: (R) => R.CALENDARIO.forEach((d, i) => { d.pan += i < 3 ? 1 : 2; }),
  mesonMas2: (R) => { R.PARAMS.mesonExtra = 2; },
  soldSinBonus: (R) => { R.PERSONAJES.find((p) => p.id === "soldado").bonusTreta = 0; },
  mesonMas3: (R) => { R.PARAMS.mesonExtra = 3; },
  lavar3: (R) => { R.PARAMS.lavarPaga = 3; },
  licMin2: (R) => { R.PARAMS.licMin = 2; },
  raso2: (R) => R.DORMIR.forEach((d) => { if (d.raso) d.c = -2; }),
};
const combos = (process.env.COMBOS || "").split(";").filter(Boolean).map((c) => c.split("+").filter(Boolean));
if (!combos.length) combos.push([]);
const cache = {};
function corre(combo, pjid, pol) {
  for (const k of Object.keys(require.cache)) delete require.cache[k];
  globalThis.RULES = require(path + "rules.js");
  combo.forEach((k) => L[k](globalThis.RULES));
  const E = require(path + "engine.js");
  const { jugar } = require(require("path").join(__dirname, "simlib.js"))(E, globalThis.RULES);
  const fin = {}; let cu = 0, ns = 0;
  for (let i = 0; i < N; i++) { const s = jugar(pjid, i + 1, pol); fin[s.final.tipo] = (fin[s.final.tipo] || 0) + 1; if (s.final.tipo === "Sobrevive") { ns++; cu += s.cuerpo; } }
  const pc = (k) => Math.round((100 * (fin[k] || 0)) / N);
  return { sob: pc("Sobrevive"), horca: pc("Horca"), muerte: pc("Muerte"), rec: pc("Recogido"), cu: ns ? (cu / ns).toFixed(1) : "-" };
}
for (const combo of combos) {
  const out = ["mozo", "viuda", "soldado"].map((p) => { const r = corre(combo, p, process.env.POL || "prudente"); return `${p} ${r.sob}% (h${r.horca} m${r.muerte} r${r.rec} c${r.cu})`; });
  console.log((combo.join("+") || "base").padEnd(36), out.join(" · "));
}
