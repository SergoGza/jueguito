// Simulación masiva del motor: invariantes y equilibrio aproximado. El bot está en simlib.js.
const path = require("path").join(__dirname, "..") + "/";
globalThis.RULES = require(path + "rules.js");
const E = require(path + "engine.js");
const R = globalThis.RULES;
const P = R.PARAMS;

const { jugar } = require(require("path").join(__dirname, "simlib.js"))(E, R);

const N = +process.argv[2] || 2000;
for (const politica of ["azar", "prudente"]) {
  console.log(`\n=== política: ${politica} (${N} partidas por personaje) ===`);
  for (const p of R.PERSONAJES) {
    const fin = {}; let dias = 0, monedas = 0, detenc = 0, ac = 0, cuerpoFin = 0, sobrevivenMon = 0, nSob = 0, red = 0, ninoPerd = 0, ninoCon = 0;
    for (let i = 0; i < N; i++) {
      const s = jugar(p.id, i + 1, politica);
      fin[s.final.tipo] = (fin[s.final.tipo] || 0) + 1;
      dias += s.final.dia;
      detenc += s.diario.filter((d) => d.castigo).length;
      ac += s.final.acompanado ? 1 : 0;
      red += s.contactos.filter((c) => !c.estado).length;
      if (s.nino) { if (s.nino.perdido) ninoPerd++; else if (s.nino.con) ninoCon++; }
      if (s.final.tipo === "Sobrevive") { nSob++; cuerpoFin += s.cuerpo; sobrevivenMon += s.monedas; }
    }
    const pct = (k) => ((100 * (fin[k] || 0)) / N).toFixed(0) + "%";
    console.log(`${p.nombre.padEnd(28)} sobrevive ${pct("Sobrevive")}${p.nino ? ` (sin el niño, ${pct("Sin el niño")} más)` : ""} · horca ${pct("Horca")} · muerte ${pct("Muerte")} · recogido ${pct("Recogido")} · día medio ${(dias / N).toFixed(1)} · detenciones/partida ${(detenc / N).toFixed(2)} · acompañado ${((100 * ac) / N).toFixed(0)}% · red viva ${(red / N).toFixed(1)}${nSob ? ` · al sobrevivir: cuerpo ${(cuerpoFin / nSob).toFixed(1)}, monedas ${(sobrevivenMon / nSob).toFixed(1)}` : ""}${p.nino ? ` · niño perdido ${((100 * ninoPerd) / N).toFixed(0)}%, con otra persona ${((100 * ninoCon) / N).toFixed(0)}%` : ""}`);
  }
}
