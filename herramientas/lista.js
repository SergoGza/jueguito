// La lista de pobres (v0.4b): cuánto se usa y qué le hace a la viuda. Compara el bot que entra en la lista si puede
// con el que no entra nunca (LISTA=no). Uso: node herramientas/lista.js [N]
const path = require("path").join(__dirname, "..") + "/";
const N = +process.argv[2] || 1000;

function medir(lista) {
  process.env.LISTA = lista;
  for (const k of Object.keys(require.cache)) delete require.cache[k];
  globalThis.RULES = require(path + "rules.js");
  const E = require(path + "engine.js");
  const R = globalThis.RULES;
  const { jugar } = require(require("path").join(__dirname, "simlib.js"))(E, R);
  const t = { sob: 0, sobConNino: 0, entra: 0, diasLista: 0, racionesLista: 0, cumple: 0, borradoPedir: 0, borradoExamen: 0, pedirEnLista: 0, sopaEnLista: 0, lavar: 0, pedir: 0, ninoPerdido: 0, muerte: 0 };
  const hooks = {
    accion({ s, el, o }) {
      if (el.accion === "lavar" && o.contratado) t.lavar++;
      if (el.accion === "pedir") { t.pedir++; if (E.licencia(s)) { t.pedirEnLista++; if (E.sitio(el.sitio).franjas[s.franja].pedirDa === "racion") t.sopaEnLista++; } }
      if (el.accion === "cumplir") t.cumple++;
      if (o.borrado) t.borradoPedir++;
    },
  };
  for (let i = 0; i < N; i++) {
    const s = jugar("viuda", i + 1, "prudente", hooks);
    if (["Sobrevive", "Sin el niño"].includes(s.final.tipo)) { t.sob++; if (s.final.tipo === "Sobrevive") t.sobConNino++; }
    if (s.final.tipo === "Muerte") t.muerte++;
    if (s.nino && s.nino.perdido) t.ninoPerdido++;
    let entro = false;
    s.diario.forEach((d) => {
      if (d.amanecer && d.amanecer.estado && d.amanecer.estado.termo === -2) { t.diasLista++; entro = true; }
      (d.acciones || []).forEach((a) => { if ((a.lineas || []).includes("Entras en la lista.")) entro = true; });
      if (d.noche && d.noche.lineas.some((l) => l.startsWith("Has cumplido: el cura te da tu ración"))) t.racionesLista++;
      if (d.amanecer && d.amanecer.eventos.some((e) => /te borra de la lista/.test(e))) t.borradoExamen++;
    });
    if (entro) t.entra++;
  }
  const f = (x) => (x / N).toFixed(2), pc = (x) => Math.round((100 * x) / N) + "%";
  console.log(`\nViuda, ${lista === "no" ? "sin entrar nunca en la lista" : "entra en la lista si puede"} (${N} partidas)`);
  console.log(`  sobrevive ${pc(t.sob)} (con el niño ${pc(t.sobConNino)}) · muere ${pc(t.muerte)} · pierde al niño ${pc(t.ninoPerdido)}`);
  console.log(`  entra en la lista en el ${pc(t.entra)} de las partidas · días en la lista ${f(t.diasLista)} · cumple ${f(t.cumple)} · raciones de la lista ${f(t.racionesLista)} por partida`);
  console.log(`  la borran por pedir ${f(t.borradoPedir)} y por el examen general ${f(t.borradoExamen)} por partida · pide estando en la lista ${f(t.pedirEnLista)} (la sopa ${f(t.sopaEnLista)})`);
  console.log(`  pide ${f(t.pedir)} veces y lava ${f(t.lavar)} veces por partida`);
}
medir("si");
medir("no");
