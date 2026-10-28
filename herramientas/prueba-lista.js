// Prueba dirigida de la lista de pobres (v0.4b). Uso: node herramientas/prueba-lista.js
const REPO = require("path").join(__dirname, "..") + "/";
globalThis.RULES = require(REPO + "rules.js");
const E = require(REPO + "engine.js");
const assert = (c, m) => { if (!c) { console.log("FALLA:", m); process.exitCode = 1; } else console.log("ok:", m); };
const accion = (s, sid, acc, dadoIdx, w, extra) => {
  const el = Object.assign({ sitio: sid, accion: acc, dado: dadoIdx, contacto: null }, extra || {});
  const rolls = E.tirar(s, el); rolls.w = w; rolls.x = 6;
  const o = E.resolver(s, el, rolls);
  E.aplicar(s, el, o);
  return o;
};

// 1) entrar en la lista y cumplir
let s = E.nuevaPartida({ jugador: "t", personaje: "viuda", seed: 3 });
E.empezarFranjas(s);
s.dados = [{ v: 1, usado: false }, { v: 2, usado: false }, { v: 5, usado: false }, { v: 4, usado: false }];
assert(!E.accionesEn(s, "parroquia").find((a) => a.id === "cumplir").ok, "fuera de la lista no se puede cumplir");
s.franja = 1;
const ex = E.accionesEn(s, "parroquia").find((a) => a.id === "examen");
assert(ex && ex.nombre === "Entrar en la lista" && ex.ok, "a tercia se puede pedir entrar en la lista");
assert(E.ganancia(s, "parroquia", "examen", 4) === "apruebas" && E.ganancia(s, "parroquia", "examen", 3) === "suspendes", "la previsión del examen dice si apruebas");
let o = accion(s, "parroquia", "examen", 3, 1);
assert(s.termo === -2 && E.clasif(s.termo) === "En la lista", "con un 4 apruebas: termómetro −2, «En la lista»");
o = accion(s, "parroquia", "cumplir", 0, 1);
assert(o.cumple && s.hoy.cumplido && E.racionLista(s) === 1, "cumplir con un 1: esta noche toca ración");
assert(!E.accionesEn(s, "parroquia").find((a) => a.id === "cumplir").ok, "no se cumple dos veces el mismo día");

// 2) la sopa del convento con un fraile mirando: no te borran
s.franja = 2;
o = accion(s, "convento", "pedir", 2, 2);
assert(o.testigo === "Fraile" && !o.borrado && s.termo === -2 && o.dR === 1, "la sopa con un 5 y un fraile mirando: ración y sigues en la lista");
assert(/Estás en la lista/.test(E.accionesEn(s, "convento").find((a) => a.id === "pedir").aviso || ""), "pedir avisa de que estás en la lista");

// 3) pedir con el cura mirando: te borran
s.franja = 3;
o = accion(s, "parroquia", "pedir", 1, 3);
assert(o.testigo === "Cura" && o.borrado && s.termo === -1 && s.hoy.borrado, "pedir con el cura mirando: te borran (−1)");
assert(o.lineas.some((l) => /te borran de la lista/.test(l)), "el resultado lo dice");
assert(E.racionLista(s) === 0, "esa noche ya no hay ración");

// 4) la noche: la ración de la lista se come
let t = E.nuevaPartida({ jugador: "t", personaje: "viuda", seed: 4 });
E.empezarFranjas(t);
t.termo = -2; t._examen = true; t.raciones = 1; t.monedas = 0;
t.dados = [{ v: 1, usado: false }];
accion(t, "parroquia", "cumplir", 0, 1);
E.acabarDia(t);
const r = E.dormir(t, { dormir: "portico", compra: 0, comeNino: true });
assert(r.lineas.some((l) => /el cura te da tu ración de la lista/.test(l)) && r.faltan === 0 && r.faltanNino === 0 && t.raciones === 0, "con 1 ración propia y la de la lista, comen los dos");

// 5) forasteros fuera
const m = E.nuevaPartida({ jugador: "t", personaje: "mozo", seed: 5 });
E.empezarFranjas(m); m.franja = 1;
assert(!E.accionesEn(m, "parroquia").find((a) => a.id === "examen").ok, "el forastero no puede entrar en la lista");

// 6) previsión por dado de las acciones de umbral
const so = E.nuevaPartida({ jugador: "t", personaje: "soldado", seed: 6 });
E.empezarFranjas(so);
assert(E.ganancia(so, "plaza", "trabajar", 5) === "no te contratan" && E.ganancia(so, "plaza", "trabajar", 6) === "te contratan", "trabajar avisa: al soldado solo le contratan con un 6");
so.franja = 1;
assert(E.ganancia(so, "plaza", "hurtar", 1) === "fallas y te ven", "hurtar con un 1 avisa de que fallas");
