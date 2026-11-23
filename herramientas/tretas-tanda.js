// Las tretas (rama claude/tretas), medidas con el oficio de aplicado.js: una tanda por política, las mismas semillas
// para todas (comparación por parejas), y una tabla para compararlas.
//
// Uso (desde la raíz del repositorio):
//   node herramientas/tretas-tanda.js [N]            N veranos de 1545 por política (por defecto 1000)
//   CADENA=1 node herramientas/tretas-tanda.js 300   la cadena (1545, 1553, 1557, con los tuyos)
//   POLITICAS=nunca,voto,todas …                     qué políticas (por defecto: sin tretas, nunca, cada una y todas)
//   TSIEMPRE=1 …                                     cada treta se usa siempre que se puede, valga o no la pena
//   DETALLE=1 …                                      además, la salida entera de cada tanda
//   PRESION=1 …                                      con la ciudad que se endurece (corchetes); POSADA=nunca, sin posada
// Las políticas (ver tretas-comun.js): «sin» es el juego sin el botón; «nunca», con el botón y sin usar ninguna;
// «<id>», solo esa (y el voto, si se compra); «todas», todas las que el oficio valora que convienen.
// Lo que no mide: si divierte. Mide si alguna treta conviene siempre (principio 3), si alguna es una trampa, cuánto
// duran antes de que las cataloguen y si la economía se resuelve igual de pronto.
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const RAIZ = path.resolve(__dirname, "..");
global.window = {};
require(path.join(RAIZ, "rules.js"));
const R = window.RULES;
const N = +process.argv[2] || 1000;
const lista = (R.PARAMS.tretas.lista || []).map((t) => t.id).filter((id) => !["parida", "muerto"].includes(id));
const POLS = (process.env.POLITICAS || ["sin", "nunca", ...lista, "todas"].join(",")).split(",");
const filas = [];
for (const pol of POLS) {
  const json = path.join(os.tmpdir(), `tretas-${process.pid}-${pol}.json`);
  const env = Object.assign({}, process.env, { OFICIO: "1", SIN_TABLA: "1", JSON: json });
  if (pol === "sin") delete env.TRETAS; else env.TRETAS = pol;
  const out = execFileSync("node", [path.join(RAIZ, "herramientas", "aplicado.js"), String(N)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (process.env.DETALLE) console.log(`\n### ${pol}\n${out}`);
  const A = JSON.parse(fs.readFileSync(json, "utf8"));
  fs.unlinkSync(json);
  filas.push({ pol, A });
}
const pc = (x, n) => `${Math.round((100 * (x || 0)) / n)} %`;
const cad = !!process.env.CADENA;
console.log(`${N} ${cad ? "cadenas" : "veranos de 1545"} por política · versión ${R.version} · el oficio${process.env.PRESION ? " · con presión (corchetes)" : ""}${process.env.TSIEMPRE ? " · TSIEMPRE (usa la treta siempre que puede)" : ""}\n`);
const cab = ["política", cad ? "llega a 1557" : "siega", "sin siega", "hambre", "otros finales", "cena entera", "pan/día", "detenido/partida", "tretas/partida", "blancas quitadas", "catalogada (la de la política)"];
console.log(cab.join(" | "));
for (const { pol, A } of filas) {
  const n = A.n, f = A.fin, T = A.tretas;
  const det = Object.entries(A.det || {}).filter(([k]) => !["echado", "a las obras", "azotada en la calle"].includes(k)).reduce((a, [, v]) => a + v, 0);
  const usos = T ? Object.values(T.usos).reduce((a, b) => a + b, 0) : 0;
  const otros = n - (f.siega || 0) - (f.aguanta || 0) - (f.espiga || 0) - (f.hambre || 0);
  const cat = T && T.catalogada[pol] ? `${pc(T.catalogada[pol], n)}, día ${(T.diaCat[pol] / T.catalogada[pol]).toFixed(1)}` : "—";
  console.log([pol, cad ? pc(A.completa, n) : pc(f.siega, n), pc((f.aguanta || 0) + (f.espiga || 0), n), pc(f.hambre, n), pc(otros, n), pc(A.cena[2], A.dias), (A.pan / A.dias).toFixed(2), (det / n).toFixed(2), (usos / n).toFixed(1), T ? (T.quitadas / n).toFixed(1) : "—", cat].join(" | "));
}
