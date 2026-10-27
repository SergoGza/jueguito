// Dados muertos y decisiones reales, con el bot prudente de simlib.js.
//  - Qué pasa con cada dado según su valor: sirve para algo, se gasta en balde, se queda sin usar o se pierde
//    porque la jornada se corta (detención o fin de partida).
//  - Cada franja en la que aún quedan dados: los dados no dejan (nada da nada con el mejor dado que queda) / hay algo
//    pero no compensa el riesgo / una sola acción vale la pena / dos acciones distintas valen parecido (reñida) /
//    varias, pero una gana claramente.
// «Reñida» depende de cómo puntúa el bot; el recuento de dados no.
// Uso: node herramientas/dados.js [N]   (MARGEN=1 diferencia para llamarla reñida, OFFSET=n cambia las semillas)
const path = require("path").join(__dirname, "..") + "/";
globalThis.RULES = require(path + "rules.js");
const E = require(path + "engine.js");
const R = globalThis.RULES;
const { jugar } = require(require("path").join(__dirname, "simlib.js"))(E, R);
const N = +process.argv[2] || 1000;
const MARGEN = +(process.env.MARGEN || 1);
const OFF = +(process.env.OFFSET || 0);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

function medir(pjid) {
  const v7 = () => [0, 0, 0, 0, 0, 0, 0];
  const st = { partidas: 0, dias: 0, sob: 0, dados: v7(), sirve: v7(), balde: v7(), sinUsar: v7(), cortado: v7(), treta: v7(),
    conDados: 0, noDejan: 0, riesgo: 0, una: 0, renida: 0, clara: 0, usosBajos: {} };
  let dadosHoy = null;
  const hooks = {
    amanecer(s) { st.dias++; dadosHoy = s.dados; s.dados.forEach((d) => st.dados[d.v]++); },
    treta(s, v) { st.treta[v]++; st.dados[v]--; },
    franja({ s, libres, opciones, vmax }) {
      if (!libres.length) return;
      st.conDados++;
      let gmax = -1e9; const porTipo = {};
      opciones.forEach((op) => {
        if (!op.a.dado || op.accion === "cruzar" || op.g === undefined) return;
        gmax = Math.max(gmax, op.g);
        if (op.sc > 0.2) porTipo[op.accion] = Math.max(porTipo[op.accion] ?? -1e9, op.sc);
      });
      const t = Object.values(porTipo).sort((a, b) => b - a);
      if (gmax <= 0.2) st.noDejan++;
      else if (!t.length) st.riesgo++;
      else if (t.length === 1) st.una++;
      else if (t[0] - t[1] < MARGEN) st.renida++;
      else st.clara++;
    },
    accion({ el, v, o }) {
      if (v === null) return;
      const sirve = o.dM > 0 || o.dR > 0 || o.dC > 0 || o.rumor > 0 || (o.relacion && o.relacion.delta > 0) || o.contratado || o.fijarT === -2 || o.dT < 0;
      (sirve ? st.sirve : st.balde)[v]++;
      if (sirve && v <= 2) { const k = `${el.accion} con ${v}`; st.usosBajos[k] = (st.usosBajos[k] || 0) + 1; }
    },
    finFranjas(s) {
      if (!dadosHoy) return;
      const cortada = !!(s.hoy && s.hoy.detenido) || !!s.final;
      dadosHoy.forEach((d) => { if (!d.usado) (cortada ? st.cortado : st.sinUsar)[d.v]++; });
      dadosHoy = null;
    },
  };
  for (let i = 0; i < N; i++) { const s = jugar(pjid, OFF + i + 1, "prudente", hooks); st.partidas++; if (s.final.tipo === "Sobrevive") st.sob++; }
  return st;
}

for (const p of R.PERSONAJES) {
  const st = medir(p.id);
  const muertos = sum(st.sinUsar) + sum(st.balde);
  console.log(`\n=== ${p.nombre} · ${N} partidas · sobrevive ${pct(st.sob, N)}% ===`);
  console.log(`Dados por día ${(sum(st.dados) / st.dias).toFixed(2)} · no sirven para nada ${(muertos / st.dias).toFixed(2)} al día (${(muertos / N).toFixed(1)} por partida) · perdidos al cortarse la jornada ${(sum(st.cortado) / st.dias).toFixed(2)} al día`);
  console.log("Valor | salen | sirven | en balde | sin usar | cortados");
  for (let v = 1; v <= 6; v++) console.log(`  ${v}   | ${String(st.dados[v]).padStart(5)} | ${String(pct(st.sirve[v], st.dados[v])).padStart(3)}%   | ${String(pct(st.balde[v], st.dados[v])).padStart(3)}%     | ${String(pct(st.sinUsar[v], st.dados[v])).padStart(3)}%     | ${pct(st.cortado[v], st.dados[v])}%`);
  const F = st.conDados;
  console.log(`Franjas con dados en la mano (${(F / N).toFixed(1)} por partida): los dados no dejan ${pct(st.noDejan, F)}% (${(st.noDejan / N).toFixed(1)} por partida) · no compensa el riesgo ${pct(st.riesgo, F)}% · una sola opción ${pct(st.una, F)}% · reñidas ${pct(st.renida, F)}% · una clara ${pct(st.clara, F)}%`);
  console.log("Para qué sirven los 1 y 2 (veces por 100 días): " + Object.entries(st.usosBajos).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${((100 * n) / st.dias).toFixed(1)}`).join(", "));
}
