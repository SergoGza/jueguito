globalThis.RULES = require("../rules.js");
const E = require("../engine.js");
const { jugar } = require(require("path").join(__dirname, "simlib.js"))(E, globalThis.RULES);
for (const pol of ["prudente", "egoista", "azar"]) {
  const mot = {}; let N = 1500, sob = 0, sobCon = 0, dejado = 0, lav = 0;
  for (let i = 0; i < N; i++) {
    const s = jugar("viuda", i + 1, pol);
    if (s.nino.perdido) { const k = s.nino.motivo.split(":")[0].split(".")[0].slice(0, 60); mot[k] = (mot[k] || 0) + 1; }
    if (["Sobrevive", "Sin el niño"].includes(s.final.tipo)) { sob++; if (s.final.tipo === "Sobrevive") sobCon++; }
    s.diario.forEach((d) => { if (d.amanecer && d.amanecer.eventos.some((x) => x.startsWith("Dejas al niño"))) dejado++; d.acciones.forEach((a) => { if (a.accion === "Lavar ropa en la ribera") lav++; }); });
  }
  console.log(`\n${pol}: sobrevive ${Math.round(100 * sob / N)}% · sobrevive CON el niño ${Math.round(100 * sobCon / N)}% · veces que lo deja ${(dejado / N).toFixed(2)}/partida · lavar ${(lav / N).toFixed(1)}/partida`);
  Object.entries(mot).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${Math.round(100 * v / N)}%  ${k}`));
}
