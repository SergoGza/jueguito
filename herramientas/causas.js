// De qué muere cada personaje y si le echaron de la ciudad, con las palancas que se pasen en PALANCAS (JSON de PARAMS).
// Uso: PALANCAS={"pregonPersigue":2,"expulsionDias":3} node herramientas/causas.js
const path = require("path").join(__dirname, "..") + "/";
const R = require(path + "rules.js");
Object.assign(R.PARAMS, JSON.parse(process.env.PALANCAS || "{}"));
globalThis.RULES = R;
const E = require(path + "engine.js");
const { jugar } = require(path + "herramientas/simlib.js")(E, R);
const N = 1000;
for (const pj of ["mozo", "soldado", "viuda"]) {
  const c = {}; let expulsado = 0, muerteTrasExp = 0, detenido = 0;
  for (let i = 0; i < N; i++) {
    const s = jugar(pj, i + 1, "prudente");
    const k = s.final.tipo;
    c[k] = (c[k] || 0) + 1;
    if (s.vetadoHasta) { expulsado++; if (s.final.tipo === "Muerte") muerteTrasExp++; }
    if (s.detenciones) detenido++;
  }
  console.log(pj, Object.entries(c).map(([k, v]) => `${k} ${Math.round(100 * v / N)}%`).join(" · "), `| le detienen alguna vez ${Math.round(100 * detenido / N)}% · le echan ${Math.round(100 * expulsado / N)}% · muere tras ser echado ${Math.round(100 * muerteTrasExp / N)}%`);
}
