// Repite una partida de una persona desde la semilla y la crónica de su informe (rama claude/tretas, 25-nov).
// Uso: node herramientas/repetir.js informe.txt ['código que se ejecuta antes de cada acción, con s, E y linea']
// Ejemplo: node herramientas/repetir.js informe.txt 'if (/^Pide/.test(linea)) console.log(s.dia, E.previsionPedir(s))'
// Al final dice si la crónica sale idéntica. Sirve para ver lo que tenía delante en cada momento.
const path = require("path"), fs = require("fs");
global.window = {};
const RAIZ = path.resolve(__dirname, "..");
require(path.join(RAIZ, "rules.js")); require(path.join(RAIZ, "engine.js"));
const E = window.ENGINE, R = window.RULES;
const txt = fs.readFileSync(process.argv[2], "utf8");
const sem = txt.match(/semilla (\d+)/)[1];
const cron = txt.split("== Crónica ==")[1].split("== Dónde estuvo")[0].split("\n").filter((l) => l.trim() && !l.startsWith("--"));
const porCorto = {}; for (const [id, l] of Object.entries(E.L)) porCorto[l.corto] = id;
const porNombreT = {}; for (const [id, t] of Object.entries(E.TT)) porNombreT[t.nombre] = id;
const cab = (txt.split("\n").find((l) => l.startsWith("Cuerpo al final")) || "");
const on = (k) => new RegExp(k + ": (activad[oa]|[^·]*activad)").test(cab) && !new RegExp(k + ": no activad").test(cab);
const s = E.nueva("A", "anónimo", sem, { llaga: on("llaga"), tuyos: on("los tuyos"), cadena: on("varios veranos"), hurto: on("hurtar"), tretas: on("tretas"), presion: on("presión") });
const espia = process.argv[3] ? new Function("s", "E", "linea", process.argv[3]) : null;
let mal = 0, n = 0;
const fase = () => { for (let g = 0; g < 20; g++) { if (s.fase === "amanecer") E.empezarJornada(s); else if (s.fase === "resultado") E.seguir(s); else if (s.fase === "invierno") E.siguienteVerano(s); else break; } };
const dia = (f) => { fase(); const r = f(); if (s.fase === "dia") E.comprobarNoche(s); return r; };
for (const raw of cron) {
  const l = raw.replace(/^\S+ \d\/6 · /, "").replace(/^noche · /, "").trim();
  let m, r = null;
  if (espia) espia(s, E, l);
  if ((m = l.match(/^Noche \(.*\): come (\d)/))) { fase(); r = E.cenar(s, +m[1]); }
  else if ((m = l.match(/^(.+) → (.+)$/))) r = dia(() => E.mover(s, porCorto[m[2]]));
  else if ((m = l.match(/^(?:Pide|Empieza a pedir) con (.+?) en /))) r = dia(() => E.pedirCon(s, porNombreT[m[1]]));
  else if (/^(Pide|Empieza a pedir) en /.test(l) || /^Le echan los (diputados|alguaciles)/.test(l)) r = dia(() => E.pedir(s));
  else if (/^Espera en /.test(l)) r = dia(() => E.esperar(s));
  else if (/^Compra un pedazo de pan/.test(l)) r = dia(() => E.comprarPan(s));
  else if ((m = l.match(/^Compra (.+?) en .+ \((\d+) (blancas|pedazos)/))) r = dia(() => E.comprar(s, porNombreT[m[1]], null, m[3] === "pedazos" ? "pan" : "blancas"));
  else if ((m = l.match(/^Se pone (.+)\./))) r = dia(() => E.poner(s, Object.keys(E.TT).find((id) => E.TT[id].puesta && E.TT[id].puesta.nombre === m[1])));
  else if (/^Da el día por acabado/.test(l)) r = dia(() => E.acabarDia(s));
  else if (/^(No le|Le) cogen en las obras/.test(l)) r = dia(() => E.pedirTrabajo(s));
  else if ((m = l.match(/^Aprende (.+)\.$/))) { fase(); r = E.aprender(s, null); }
  else if (/^Paga la posada/.test(l)) { fase(); r = E.pagarPosada(s); }
  else if ((m = l.match(/^Da (un pedazo|dos pedazos) a (\w+)/))) { fase(); r = E.darPan(s, m[2].toLowerCase(), m[1] === "un pedazo" ? 1 : 2); }
  else if ((m = l.match(/^Queda con (\w+) para mañana a [^ ]+ en (.+)\.$/))) { fase(); r = E.quedar(s, m[1].toLowerCase(), Object.keys(E.L).find((id) => E.L[id].nombre === m[2])); }
  else if ((m = l.match(/^Noche \(.*\): come (\d)/))) { fase(); r = E.cenar(s, +m[1]); }
  else if ((m = l.match(/^Sigue (\w+)\.$/))) { fase(); if (s.fase === "relevo") r = E.elegirHeredero(s, m[1].toLowerCase()); else continue; }
  else continue;
  n++; if (r === false) { mal++; console.log("NO PUDO:", raw); }
}
fase();
const mio = s.cronica.map((c) => c.texto);
const suyo = cron.map((x) => x.replace(/^\S+ \d\/6 · /, "").replace(/^noche · /, "").trim());
let igual = 0; for (let i = 0; i < Math.min(mio.length, suyo.length); i++) { if (mio[i] === suyo[i]) igual++; else { console.log("difiere en", i, "\n  suyo:", suyo[i], "\n  mío: ", mio[i]); break; } }
console.log(`acciones ${n}, fallidas ${mal}, crónica ${mio.length} / ${suyo.length}, iguales hasta ${igual}; final: ${(s.final || {}).tipo}`);
