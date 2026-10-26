const path = require("path").join(__dirname, "..") + "/";
for (const k of Object.keys(require.cache)) delete require.cache[k];
globalThis.RULES = require(path + "rules.js");
const R = globalThis.RULES;
R.DORMIR.forEach((d) => { if (d.id === "meson" || d.id === "red") d.c = 0; });
const E = require(path + "engine.js");
const { jugar } = require(require("path").join(__dirname, "simlib.js"))(E, R);
const N = 400;
for (const pj of ["mozo", "viuda", "soldado"]) {
  const src = {}, rac = {}, dormir = {}; let dias = 0, cuerpoMas = {}, cuerpoMenos = {};
  for (let i = 0; i < N; i++) {
    const s = jugar(pj, i + 1, "prudente");
    s.diario.forEach((d) => {
      dias++;
      (d.acciones || []).forEach((a) => {
        const c = a.cambios || {};
        if (c.monedas > 0) src[a.accion] = (src[a.accion] || 0) + c.monedas;
        if (c.raciones > 0) rac[a.accion] = (rac[a.accion] || 0) + c.raciones;
        if (c.cuerpo > 0) cuerpoMas[a.accion] = (cuerpoMas[a.accion] || 0) + c.cuerpo;
        if (c.cuerpo < 0) cuerpoMenos[a.accion] = (cuerpoMenos[a.accion] || 0) + c.cuerpo;
      });
      if (d.noche) { dormir[d.noche.donde] = (dormir[d.noche.donde] || 0) + 1; const c = d.noche.cambios.cuerpo; if (c > 0) cuerpoMas["noche"] = (cuerpoMas["noche"] || 0) + c; if (c < 0) cuerpoMenos["noche"] = (cuerpoMenos["noche"] || 0) + c; }
    });
  }
  const f = (o) => Object.entries(o).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([k, v]) => `${k} ${(v / dias).toFixed(2)}`).join(", ");
  console.log(`\n${pj} (por día jugado)\n  monedas: ${f(src)}\n  raciones: ${f(rac)}\n  cuerpo +: ${f(cuerpoMas)}\n  cuerpo −: ${f(cuerpoMenos)}\n  duerme: ${f(dormir)}`);
}
