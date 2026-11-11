// Prototipo de hurtar y la horca: lanza las tandas de bots de todas las variantes y guarda una línea por tanda.
//
//   node herramientas/hurto-tanda.js [fichero.jsonl] [N]        (por defecto herramientas/.cache/hurto.jsonl y 2000)
//   SOLO=base,dos node herramientas/hurto-tanda.js …            solo esas variantes
//   PROCESOS=2                                                  cuántas tandas a la vez
//
// Cada variante cambia UNA palanca de PARAMS.hurto respecto de la base (rules.js). Cada tanda es una variante, una
// política de hurto del bot (hurto-comun.js), un bot (el veterano de bot.js, que pasa hambre, y el oficio de
// aplicado.js, que come casi siempre) y un escenario (un verano de 1545, un verano con los tuyos, la cadena de 1545,
// 1552 y 1557 empezando como mozo o como moza). Si el fichero ya tiene una tanda, no la repite.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const RAIZ = path.resolve(__dirname, "..");
const OUT = path.resolve(process.argv[2] || path.join(__dirname, ".cache", "hurto.jsonl"));
const N = process.argv[3] || "2000";
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const H = "PARAMS.hurto.";
const V = {
  base: {},
  // qué se hurta y dónde
  olla: { [H + "que"]: "olla" },                 // la olla de una casa, a sexta (cuando nadie da y la ronda come)
  ropa: { [H + "que"]: "ropa" },                 // ropa: no da pan, da un invierno mejor (solo pesa en la cadena)
  lento: { [H + "ratos"]: 6 },                   // hurtar tarda una franja entera, como pedir
  // quién te ve y qué pasa si te ven
  ojos: { [H + "ojos"]: "ojos" },                // con mucha gente te ven más (en la base, la gente tapa)
  prendido: { [H + "siVisto"]: "prendido" },     // si te ven, te cogen allí mismo
  huye: { [H + "siVisto"]: "huye" },             // si te ven, escapas siempre y te buscan
  mixto: { [H + "siVisto"]: "mixto" },           // mitad y mitad (era la base hasta la ronda 2)
  gente: { [H + "siVisto"]: "gente" },           // con mucha gente te sujetan allí mismo; con poca, escapas y te buscan
  riesgo05: { [H + "riesgo"]: 0.5 },
  riesgo15: { [H + "riesgo"]: 1.5 },
  riesgo2: { [H + "riesgo"]: 2 },
  // la escalera
  dos: { [H + "escalera"]: "dos" },              // oreja y horca (en la base: azotes, oreja y horca)
  // la de Castilla por escrito: vergüenza y azotes, otra vez azotes, y a la tercera la horca (sin oreja: Partida 7,14,18 prohíbe cortar miembro por hurto)
  castellana: { [H + "escalera"]: "castellana" },
  // el primer peldaño sin azotes: a la vergüenza (en un asno, con pregonero); después azotes y horca
  tres: { [H + "escalera"]: "tres" },            // azotes, oreja y horca (era la base hasta la ronda 3)
  cuenta: { [H + "cuenta"]: true },              // prenderte por ladrón cuenta además como detención
  // la marca
  orejaTodos: { [H + "oreja"]: { conoce: true, limosna: 1, siega: false } },   // la lee todo el mundo: menos limosna, ni obra ni hoz
  orejaJusticia: { [H + "oreja"]: { conoce: false, limosna: 0, siega: true } }, // solo la lee el juez, la próxima vez
  espalda: { [H + "espalda"]: true },            // el alcalde lee la espalda azotada venga de donde venga: los azotes por pedir cuentan como primer hurto
  // la necesidad extrema
  necesidad: { [H + "necesidad"]: { cuerpo: 2, visto: 0.5 } }, // con el cuerpo a 2 o menos, los vecinos miran a otro lado la mitad de las veces
  restituir: { [H + "sagrado"]: { lugar: "sanesteban", devuelve: 2, ratos: 3 } }, // si te buscan, en San Esteban devuelves lo hurtado y la parte perdona
  // la horca y el relevo
  horcaAcomp: { [H + "horca"]: "acompanado" },   // sigues como uno de los tuyos que quede libre
  horcaAnoche: { [H + "horca"]: "anoche" },      // sigues como el que durmió contigo la última noche que dormiste libre
  // 1552 y hombre y mujer
  sinGaleras: { [H + "galeras1552"]: false },    // la escalera sigue igual para el hombre después de 1552
  mujerDos: { [H + "escaleraMujer"]: ["azotes", "horca"] }, // para la mujer, nada entre los azotes y la horca
  mujerLarga: { [H + "escaleraMujer"]: ["azotes", "azotes", "azotes", "horca"] }, // a la mujer la azotan más veces antes de ahorcarla (Pérez de Herrera: ahorcada tras 1.500 azotes en diferentes veces)
  // los tuyos y malsinar
  tuyosHurtan: { [H + "tuyosHurtan"]: true },
  malsinar: { [H + "malsinar"]: true },
};
const TODAS = ["nunca", "apuro", "grave", "hambre", "siempre"], TRES = ["apuro", "hambre", "siempre"];
// qué escenarios y políticas se miden de cada variante
const PLAN = [];
const pon = (v, esc, pols, bots) => { for (const pol of pols) for (const bot of bots || ["veterano", "oficio"]) PLAN.push({ v, esc, pol, bot }); };
pon("base", "verano", TODAS); pon("base", "cadena", TODAS); pon("base", "cadena-mujer", TODAS); pon("base", "tuyos", TODAS);
for (const v of ["olla", "lento", "ojos", "prendido", "huye", "riesgo05", "riesgo15", "riesgo2"]) { pon(v, "verano", TRES); pon(v, "cadena", TRES, ["veterano"]); }
pon("gente", "verano", TRES); pon("gente", "cadena", TRES);
for (const v of ["dos", "cuenta", "orejaTodos", "orejaJusticia", "espalda", "necesidad", "restituir"]) { pon(v, "verano", TRES); pon(v, "cadena", TRES); }
pon("espalda", "cadena-mujer", TRES);
pon("dos", "cadena-mujer", TRES); pon("cuenta", "cadena-mujer", TRES);
pon("tres", "verano", TRES); pon("tres", "cadena", TRES); pon("tres", "cadena-mujer", TRES);
pon("castellana", "verano", TRES); pon("castellana", "cadena", TRES); pon("castellana", "cadena-mujer", TRES);
pon("mujerLarga", "cadena", TRES); pon("mujerLarga", "cadena-mujer", TRES);
pon("ropa", "cadena", ["apuro", "grave", "hambre", "siempre"]); pon("ropa", "cadena-mujer", ["apuro", "siempre"]);
for (const v of ["horcaAcomp", "horcaAnoche", "sinGaleras", "mujerDos"]) { pon(v, "cadena", TRES); pon(v, "cadena-mujer", TRES); }
pon("tuyosHurtan", "tuyos", ["nunca"].concat(TRES)); pon("tuyosHurtan", "cadena", ["nunca"].concat(TRES));
pon("malsinar", "tuyos", TRES); pon("malsinar", "cadena", TRES);

const hechas = new Set();
if (fs.existsSync(OUT)) for (const l of fs.readFileSync(OUT, "utf8").split("\n")) if (l.trim()) { const r = JSON.parse(l); hechas.add(`${r.variante}|${r.escenario}|${r.politica}|${r.bot}`); }
const solo = process.env.SOLO ? process.env.SOLO.split(",") : null;
// ESCS=cadena,cadena-mujer y POLS=apuro,hambre limitan los escenarios y las políticas
const escs = process.env.ESCS ? process.env.ESCS.split(",") : null, pols = process.env.POLS ? process.env.POLS.split(",") : null;
const cola = PLAN.filter((j) => (!solo || solo.includes(j.v)) && (!escs || escs.includes(j.esc)) && (!pols || pols.includes(j.pol)) && !hechas.has(`${j.v}|${j.esc}|${j.pol}|${j.bot}`));
console.log(`${cola.length} tandas por hacer (${PLAN.length - cola.length} ya hechas o fuera de SOLO) → ${OUT}`);

function lanzar(j) {
  return new Promise((ok) => {
    const env = Object.assign({}, process.env, { HURTO: j.pol, VAR: j.v, ESC: j.esc, PAL: JSON.stringify(V[j.v]), JSONL: OUT });
    delete env.CADENA; delete env.TUYOS; delete env.SEXO; delete env.SOLO; delete env.PROCESOS; delete env.ESCS; delete env.POLS;
    if (j.esc.startsWith("cadena")) env.CADENA = "1";
    if (j.esc === "cadena-mujer") env.SEXO = "mujer";
    if (j.esc === "tuyos") env.TUYOS = "1";
    let args;
    if (j.bot === "oficio") { env.OFICIO = "1"; env.SIN_TABLA = "1"; args = [path.join(__dirname, "aplicado.js"), N]; }
    else { env.BOTS = j.bot; args = [path.join(__dirname, "bot.js"), N]; }
    const t0 = Date.now();
    const h = spawn(process.execPath, args, { cwd: RAIZ, env, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    h.stderr.on("data", (d) => { err += d; });
    h.on("close", (c) => { console.log(`${c === 0 ? "ok " : "MAL"} ${j.v} · ${j.esc} · ${j.pol} · ${j.bot} (${((Date.now() - t0) / 1000).toFixed(0)} s)${c ? "\n" + err.slice(-600) : ""}`); ok(); });
  });
}
(async () => {
  const np = +process.env.PROCESOS || 2;
  let i = 0;
  await Promise.all(Array.from({ length: np }, async () => { while (i < cola.length) await lanzar(cola[i++]); }));
  console.log("fin");
})();
