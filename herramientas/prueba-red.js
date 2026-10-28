// Prueba dirigida de juntarse y señalar en el motor (v0.4). Uso: node herramientas/prueba-red.js
const REPO = require("path").join(__dirname, "..") + "/";
globalThis.RULES = require(REPO + "rules.js");
const E = require(REPO + "engine.js");
const R = globalThis.RULES;
const assert = (c, m) => { if (!c) { console.log("FALLA:", m); process.exitCode = 1; } else console.log("ok:", m); };

// 1) juntarse con alguien nuevo en el convento a prima, sin testigos
let s = E.nuevaPartida({ jugador: "t", personaje: "mozo", seed: 7 });
E.empezarFranjas(s);
s.dados = [{ v: 1, usado: false }, { v: 2, usado: false }, { v: 6, usado: false }];
const acts = E.accionesEn(s, "convento").map((a) => a.id);
assert(acts.includes("juntarse") && !acts.includes("preguntar"), "en el convento a prima se puede juntarse y ya no existe preguntar");
const a = E.accionesEn(s, "convento").find((x) => x.id === "juntarse");
assert(a.ok && /señalada/.test(a.desc), "juntarse explica que la persona queda señalada");
assert(E.ganancia(s, "convento", "juntarse", 1) === "os acercáis, pero no te cuenta nada" && E.ganancia(s, "convento", "juntarse", 3) === "os acercáis y te cuenta algo", "la previsión del dado distingue 1-2 de 3+");
let el = { sitio: "convento", accion: "juntarse", dado: 0, contacto: "nuevo" };
let rolls = E.tirar(s, el); rolls.w = 1;
let o = E.resolver(s, el, rolls);
assert(o.relacion.delta === 1 && o.rumor === 0 && /Pasas el rato/.test(o.resultado), "con un 1 sube la relación y no da rumor");
assert(o.lineas.some((l) => /Queda señalado/.test(l)), "el resultado dice que queda señalado");
E.aplicar(s, el, o);
const c1 = s.contactos[0];
assert(c1 && c1.rel === 1 && s.hoy.senalados.includes(c1.id) && !s.hoy.vistosJuntos.length, "nuevo contacto con relación 1, señalado y sin alguacil");

// 2) juntarse en el mesón a vísperas con alguacil (dado de testigo 6)
s.franja = 4;
const c2 = { id: "cx", nombre: "Juana la Ronca", rel: 1, lado: "dentro", desde: 1 }; s.contactos.push(c2);
el = { sitio: "meson", accion: "juntarse", dado: 2, contacto: "cx" };
rolls = E.tirar(s, el); rolls.w = 6;
o = E.resolver(s, el, rolls);
assert(o.testigo === "Alguacil" && o.rumor === 1 && o.lineas.some((l) => /Os ha visto un alguacil: esta noche interrogará a Juana/.test(l)), "con alguacil avisa del interrogatorio seguro, y con un 6 hay rumor");
E.aplicar(s, el, o);
assert(s.hoy.vistosJuntos.includes("cx") && c2.rel === 2, "Juana queda vista con alguacil y sube a relación 2");

// 3) noche y autoridad: interrogatorio seguro a Juana
E.acabarDia(s);
E.dormir(s, { dormir: "portico", compra: 0 });
if (s.fase === "castigo") E.aplicarCastigo(s, "marca");
const movs = (s.ultimaAutoridad || { movimientos: [] }).movimientos;
assert(movs.some((m) => m.tipo === "Interrogatorio" && m.visto && m.contacto === "Juana la Ronca" && /Un alguacil te vio con Juana/.test(m.txt)), "esa noche interrogan a Juana por el alguacil");
console.log("   ", movs.map((m) => m.txt).join(" | "));

// 4) un interrogatorio al azar va a por el señalado, no a por otro
let bien = 0, total = 0;
const orig = R.MOVIMIENTOS.slice();
R.MOVIMIENTOS.splice(0, 6, "Interrogatorio", "Interrogatorio", "Interrogatorio", "Interrogatorio", "Interrogatorio", "Interrogatorio");
for (let seed = 1; seed <= 200; seed++) {
  const t = E.nuevaPartida({ jugador: "t", personaje: "soldado", seed });
  t.dia = 4; t.hoy.dia = 4; t.tiempos[4] = { inicio: new Date().toISOString(), fin: null };
  t.contactos.push({ id: "a", nombre: "A", rel: 3, lado: "dentro", desde: 1 }, { id: "b", nombre: "B", rel: 3, lado: "dentro", desde: 1 }, { id: "c", nombre: "C", rel: 3, lado: "dentro", desde: 1 });
  t.hoy.senalados = ["b"]; t.hoy.vistosJuntos = [];
  E.empezarFranjas(t); E.acabarDia(t); E.dormir(t, { dormir: "portico", compra: 0 });
  if (t.fase !== "autoridad") continue;
  const ints = t.ultimaAutoridad.movimientos.filter((m) => m.tipo === "Interrogatorio");
  if (!ints.length) continue;
  total++; if (ints[0].contacto === "B" && ints[0].senalado) bien++;
}
R.MOVIMIENTOS.splice(0, 6, ...orig);
assert(total > 50 && bien === total, `el primer interrogatorio va siempre a por el señalado (${bien}/${total})`);

// 5) sin señalados, el interrogatorio sigue siendo al azar
const t = E.nuevaPartida({ jugador: "t", personaje: "soldado", seed: 3 });
assert(Array.isArray(t.hoy.senalados) && t.hoy.senalados.length === 0, "cada día empieza sin señalados");
