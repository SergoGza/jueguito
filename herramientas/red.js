// Qué hace el bot con la red: cuántas veces se junta, a qué relación llega, cuántas noches duerme con alguien,
// cuántos interrogatorios hay y cuántas veces le venden. Con RED=no, el bot no se junta con nadie (para comparar).
// Uso: node herramientas/red.js [N]
const path = require("path").join(__dirname, "..") + "/";
globalThis.RULES = require(path + "rules.js");
const E = require(path + "engine.js");
const R = globalThis.RULES;
const { jugar } = require(require("path").join(__dirname, "simlib.js"))(E, R);
const N = +process.argv[2] || 1000;
const f1 = (x) => (x / N).toFixed(2);

for (const p of R.PERSONAJES) {
  const t = { sob: 0, juntarse: 0, compartir: 0, conBajo: 0, nochesRed: 0, interrogatorios: 0, aSenalado: 0, porAlguacil: 0, ventas: 0, ventasSenalado: 0, llevados: 0, relMax: 0, rel2: 0, acomp: 0, finRed: {} };
  const hooks = {
    accion({ el, v }) {
      if (el.accion === "juntarse") { t.juntarse++; if (v <= 2) t.conBajo++; }
      if (el.accion === "compartir") t.compartir++;
    },
  };
  for (let i = 0; i < N; i++) {
    const s = jugar(p.id, i + 1, "prudente", hooks);
    if (s.final.tipo === "Sobrevive") t.sob++;
    if (s.final.acompanado) t.acomp++;
    const mx = s.contactos.reduce((m, c) => Math.max(m, c.rel), 0);
    t.relMax += mx; if (mx >= 2) t.rel2++;
    s.contactos.forEach((c) => { const k = c.estado || "vivo"; t.finRed[k] = (t.finRed[k] || 0) + 1; });
    s.diario.forEach((d) => {
      if (d.noche && /^Con /.test(d.noche.donde)) t.nochesRed++;
      (d.autoridad ? d.autoridad.movimientos : []).forEach((m) => {
        if (!/interroga a /i.test(m)) return;
        t.interrogatorios++;
        const sen = /va a por quien estuvo contigo|un alguacil te vio con/i.test(m);
        if (/va a por quien estuvo contigo/i.test(m)) t.aSenalado++;
        if (/un alguacil te vio con/i.test(m)) t.porAlguacil++;
        if (/te vende/.test(m)) { t.ventas++; if (sen) t.ventasSenalado++; } else t.llevados++;
      });
    });
  }
  console.log(`\n=== ${p.nombre} · ${N} partidas · sobrevive ${Math.round((100 * t.sob) / N)}% · muere acompañado o con alguien de relación 2+ al final ${Math.round((100 * t.acomp) / N)}% ===`);
  console.log(`Por partida: se junta ${f1(t.juntarse)} veces (${t.juntarse ? Math.round((100 * t.conBajo) / t.juntarse) : 0}% con un 1 o un 2) · comparte ${f1(t.compartir)} · noches durmiendo con alguien ${f1(t.nochesRed)}`);
  console.log(`Relación máxima alcanzada (media) ${f1(t.relMax)} · partidas en que llega a relación 2 o más: ${Math.round((100 * t.rel2) / N)}%`);
  console.log(`Interrogatorios ${f1(t.interrogatorios)} por partida (a un señalado ${f1(t.aSenalado)}, por alguacil ${f1(t.porAlguacil)}) · te venden ${f1(t.ventas)} (${f1(t.ventasSenalado)} siendo señalados) · se llevan a alguien ${f1(t.llevados)}`);
  console.log(`Cómo acaba la gente de tu red (por partida): ` + Object.entries(t.finRed).map(([k, v]) => `${k} ${f1(v)}`).join(" · "));
}
