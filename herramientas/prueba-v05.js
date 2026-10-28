// Prueba dirigida de la v0.5: el paquete «mixto» y el final de la viuda. Uso: node herramientas/prueba-v05.js
const REPO = require("path").join(__dirname, "..") + "/";
globalThis.RULES = require(REPO + "rules.js");
const E = require(REPO + "engine.js");
const R = globalThis.RULES;
const P = R.PARAMS;
const assert = (c, m) => { if (!c) { console.log("FALLA:", m); process.exitCode = 1; } else console.log("ok:", m); };
const partida = (pj, dia, seed) => {
  const s = E.nuevaPartida({ jugador: "t", personaje: pj, seed: seed || 1 });
  s.dia = dia; s.hoy.dia = dia; s.tiempos[dia] = { inicio: new Date().toISOString(), fin: null };
  E.empezarFranjas(s);
  s.dados = [1, 2, 3, 4, 5, 6].map((v) => ({ v, usado: false }));
  return s;
};
const caraDe = (s, sid, testigo) => { const f = (E.previewTestigos(s, sid, "pedir") || []).find((x) => x.testigo === testigo); return f ? f.caras[0] : null; };
const accion = (s, sid, acc, dadoIdx, w, extra) => {
  const el = Object.assign({ sitio: sid, accion: acc, dado: dadoIdx, contacto: null }, extra || {});
  const rolls = E.tirar(s, el); rolls.w = w; rolls.x = 6;
  const o = E.resolver(s, el, rolls);
  E.aplicar(s, el, o);
  return o;
};

// 1) el pregón persigue al forastero dentro de la muralla, del día 3 al 9
let s = partida("mozo", 4);
const wAlg = caraDe(s, "plaza", "Alguacil");
assert(wAlg, "en la plaza a prima puede verte un alguacil");
const fila = E.previewTestigos(s, "plaza", "pedir").find((x) => x.testigo === "Alguacil");
assert(/pregón en marcha: Te buscan \+2/.test(fila.efecto), "la tabla de testigos avisa del pregón al forastero");
let tb0 = s.tb, o = accion(s, "plaza", "pedir", 2, wAlg);
assert(o.persigue && o.lineas.some((l) => /el pregón de expulsión te busca: Te buscan \+2/.test(l)), "si le ve un alguacil, el resultado lo dice");
assert(s.tb - tb0 >= 2, `Te buscan sube al menos 2 (${tb0} → ${s.tb})`);
const v = partida("viuda", 4);
assert(!/pregón/.test(E.previewTestigos(v, "plaza", "pedir").find((x) => x.testigo === "Alguacil").efecto), "a la viuda (natural) el pregón no la persigue");
const d2 = partida("mozo", 2);
assert(!/pregón/.test(E.previewTestigos(d2, "plaza", "pedir").find((x) => x.testigo === "Alguacil").efecto), "antes del día 3 no hay persecución");

// 2) expulsión: al mozo, a la primera detención; al soldado, a la segunda
const detener = (s) => { s.hoy.detenido = { motivo: "prueba", termo: s.termo, noche: false }; return E.aplicarCastigo(s, "marca"); };
let m = partida("mozo", 4);
let r = detener(m);
assert(m.fuera && m.vetadoHasta === 7 && /te sacan de la ciudad/.test(r.txt) && /hasta el día 8/.test(r.txt), "mozo detenido el día 4: fuera, no entra hasta el día 8");
m.dia = 6; m.hoy.dia = 6; m.franja = 0;
const cruzar = (s) => E.accionesEn(s, "puente").find((a) => a.id === "cruzar");
assert(!cruzar(m).ok && /no te deja entrar hasta el día 8/.test(cruzar(m).motivo), "el día 6 la guardia no le deja entrar");
m.dia = 8; m.hoy.dia = 8;
assert(cruzar(m).ok, "el día 8 ya puede intentar entrar");
const md = partida("mozo", 2);
detener(md);
assert(!md.fuera && !md.vetadoHasta, "antes del pregón, al mozo detenido no lo echan");
let so = partida("soldado", 4);
detener(so);
assert(!so.fuera && !so.vetadoHasta, "soldado, primera detención: no lo echan");
so.franja = 0; so.hoy.detenido = null;
detener(so);
assert(so.fuera && so.vetadoHasta === 7, "soldado, segunda detención: lo echan");
let vi = partida("viuda", 4);
detener(vi);
assert(!vi.fuera, "a la viuda no la echan nunca");

// 3) dormir en casa de alguien pide relación 3
let t = partida("mozo", 2);
t.contactos.push({ id: "a", nombre: "Ana", rel: 2, lado: "dentro", desde: 1 });
E.acabarDia(t);
const red = () => E.opcionesNoche(t).find((x) => x.id === "red");
assert(!red().ok && /relación 3/.test(red().motivo), "con relación 2 no te da techo, y lo dice");
t.contactos[0].rel = 3;
assert(red().ok, "con relación 3, sí");

// 4) media ración por el niño en la lista
let w = partida("viuda", 2);
w.termo = -2; w.raciones = 0; w.monedas = 0;
const noche = (s) => { accion(s, "parroquia", "cumplir", 0, 1); E.acabarDia(s); return E.dormir(s, { dormir: "portico", compra: 0, comeNino: true }); };
w.franja = 0;
assert(E.racionLista(w) === 0, "sin cumplir, nada");
let n1 = noche(w);
assert(n1.lineas.some((l) => /tu ración de la lista \(\+1\)\. Al niño le dan media: la próxima noche que cumplas/.test(l)), "primera noche: +1 y avisa de que la próxima toca la del niño");
if (w.fase === "castigo") E.aplicarCastigo(w, "marca");
E.siguienteDia(w);
if (w.fase === "amanecer") E.empezarFranjas(w);
w.dados = [{ v: 1, usado: false }];
w.raciones = 0; w.termo = -2; w.nino.con = null;
let n2 = noche(w);
assert(n2.lineas.some((l) => /tu ración de la lista y la del niño \(\+2\)/.test(l)) && n2.faltan === 0 && n2.faltanNino === 0, "segunda noche: +2 y comen los dos");

// 5) el hospital recoge al impedido a la segunda
assert(E.hospVeces(partida("soldado", 2)) === 2 && E.hospVeces(partida("mozo", 2)) === 3 && E.hospVeces(partida("viuda", 2)) === 3, "al impedido lo recogen a la segunda; a los demás, a la tercera");

// 6) el final de la viuda: gana si llegan los dos
const ultimaNoche = (prep) => {
  const s = partida("viuda", 10);
  s.raciones = 2; s.monedas = 0;
  prep(s);
  E.acabarDia(s);
  E.dormir(s, { dormir: "portico", compra: 0, comeNino: true });
  return s;
};
let f = ultimaNoche(() => {});
assert(f.final && f.final.tipo === "Sobrevive" && /Tu hijo sigue contigo/.test(E.textoFinal(f)), "llega con el niño: Sobrevive");
f = ultimaNoche((s) => { s.contactos.push({ id: "a", nombre: "Ana", rel: 2, lado: "dentro", desde: 1 }); s.nino.con = "a"; });
assert(f.final.tipo === "Sobrevive" && /Ana cuida de tu hijo/.test(E.textoFinal(f)), "el niño en casa de alguien de su red: también gana");
f = ultimaNoche((s) => { s.nino.perdido = true; s.nino.motivo = "El cura lo ve y se lo lleva a los niños de la doctrina."; });
assert(f.final.tipo === "Sin el niño" && /Sigues viva, pero sin tu hijo\. Está con los niños de la doctrina/.test(E.textoFinal(f)), "sin el niño: otro final, y el texto lo dice");
f = ultimaNoche((s) => { s.raciones = 1; s.nino.cuerpo = 2; });
assert(f.final.tipo === "Sobrevive" && f.nino.cuerpo === 2, "con una ración, come el niño y llega");
f = (() => {
  const s = partida("viuda", 10); s.raciones = 1; s.monedas = 0; s.nino.cuerpo = 2; s.cuerpo = 8;
  E.acabarDia(s); E.dormir(s, { dormir: "portico", compra: 0, comeNino: false }); return s;
})();
assert(f.final.tipo === "Sin el niño" && f.nino.perdido && /hospital de niños/.test(E.textoFinal(f)), "si el niño se queda a 0 la última noche, llega sin él");
const mo = partida("mozo", 10); mo.raciones = 1; E.acabarDia(mo); E.dormir(mo, { dormir: "portico", compra: 0 });
assert(mo.final.tipo === "Sobrevive", "al mozo no le afecta");
