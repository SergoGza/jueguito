/* Liber Vagatorum — prototipo jugable.
 * Todas las reglas en datos. Para ajustar el juego, cambia números aquí.
 * Si cambias algo, sube RULES.version y la versión de caché en sw.js.
 */
(function (root) {
  "use strict";

  const CONFIG = {
    // Correo al que los testers mandan el informe. Ojo: en GitHub Pages queda visible en el código.
    email: "sergiogza0@gmail.com",
    titulo: "Liber Vagatorum",
  };

  const FRANJAS = ["Prima", "Tercia", "Sexta", "Nona", "Vísperas"];
  const FRANJA_DESC = {
    Prima: "Primera luz. Misas tempranas y la puerta que abre.",
    Tercia: "Media mañana. El mercado se llena.",
    Sexta: "Mediodía. La sopa del convento.",
    Nona: "Media tarde. La ciudad afloja.",
    Vísperas: "Cae la tarde. Oficios, sobras y la puerta que cierra.",
  };

  // acciones: P pedir · T trabajar · H hurtar · D descansar · C curarse · E examen · R red · X cruzar
  function f(texto, mod, acts, extra) {
    return Object.assign({ texto, modPedir: mod, acts: acts.split(" "), pedirDa: "monedas", umbral: 0, tabla: null }, extra || {});
  }

  const SITIOS = [
    {
      id: "plaza", nombre: "Plaza del mercado", corto: "Plaza", dentro: true,
      desc: "El centro del comercio. Mucha gente y muchos alguaciles.",
      franjas: [
        f("Contratan peones para el jornal.", 0, "P T"),
        f("Mercado: pedir +1. Hay gentío para hurtar.", 1, "P H"),
        f("Mercado: pedir +1. Hay gentío para hurtar.", 1, "P H"),
        f("Poco movimiento: pedir −1.", -1, "P"),
        f("Cierre del mercado: al pedir te dan sobras (1 ración con dado 4 o más).", 0, "P", { pedirDa: "racion", umbral: 4 }),
      ],
    },
    {
      id: "catedral", nombre: "Catedral en obras", corto: "Catedral", dentro: true,
      desc: "La catedral nueva, en obras desde 1513. Misas, limosnas y peones.",
      franjas: [
        f("Misa: pedir +1. Pórtico para descansar.", 1, "P D"),
        f("Obras: contratan peones. Pórtico.", 0, "P T D"),
        f("Obras: contratan peones. Pórtico.", 0, "P T D"),
        f("Obras: contratan peones. Pórtico.", 0, "P T D"),
        f("Oficio: pedir +1. Pórtico.", 1, "P D"),
      ],
    },
    {
      id: "escuelas", nombre: "Escuelas", corto: "Escuelas", dentro: true,
      desc: "La Universidad. Estudiantes que dan poco y estudiantes pobres que compiten contigo.",
      franjas: [
        f("Poca gente: pedir −1.", -1, "P"),
        f("Estudiantes: se puede pedir, compitiendo con estudiantes pobres.", 0, "P"),
        f("Estudiantes: se puede pedir, compitiendo con estudiantes pobres.", 0, "P"),
        f("Estudiantes: se puede pedir, compitiendo con estudiantes pobres.", 0, "P"),
        f("Poca gente: pedir −1.", -1, "P"),
      ],
    },
    {
      id: "convento", nombre: "Convento de San Esteban", corto: "Convento", dentro: true,
      desc: "Los dominicos. Reparten sopa a mediodía y hay pobres a la puerta.",
      franjas: [
        f("Oficio: se puede pedir. Pobres a la puerta (red).", 0, "P R"),
        f("Nada a esta hora: pedir −1.", -1, "P"),
        f("Sopa: al pedir te dan 1 ración con dado 3 o más (con 1-2 llegas tarde). Pobres a la puerta (red).", 0, "P R", { pedirDa: "racion", umbral: 3 }),
        f("Nada a esta hora: pedir −1.", -1, "P"),
        f("Oficio: se puede pedir. Pobres a la puerta (red).", 0, "P R"),
      ],
    },
    {
      id: "parroquia", nombre: "Tu parroquia", corto: "Parroquia", dentro: true,
      desc: "Donde te conocen. El cura examina y da licencias a los naturales de la ciudad.",
      franjas: [
        f("Misa: pedir +1 (con licencia, +2). Pórtico para descansar.", 1, "P D"),
        f("El cura examina y da licencias (solo naturales). Pórtico.", 0, "P D E"),
        f("Nada a esta hora: pedir −1. Pórtico.", -1, "P D"),
        f("Nada a esta hora: pedir −1. Pórtico.", -1, "P D"),
        f("Se puede pedir. Pórtico.", 0, "P D"),
      ],
    },
    {
      id: "hospital", nombre: "Hospital", corto: "Hospital", dentro: true,
      desc: "Te curan, pero te apuntan. Quien entra muy débil ya no sale.",
      franjas: [0, 1, 2, 3, 4].map(() => f("Curarse: +2 de cuerpo con dado 3 o más, pero te apuntan (−1). Si entras con cuerpo 2 o menos, te recogen.", 0, "P C")),
    },
    {
      id: "puente", nombre: "Puente y arrabal", corto: "Puente", dentro: false, ambos: true,
      desc: "La puerta de la muralla, la ribera y el arrabal. Se llega desde dentro y desde fuera.",
      franjas: [
        f("La puerta abre: la guardia vigila a los forasteros.", 0, "P D X", { tabla: "Puente (puerta)" }),
        f("Ribera: descansar, gente recién llegada (red). Pedir −1.", -1, "P D R X", { tabla: "Puente (ribera)" }),
        f("Ribera: descansar, gente recién llegada (red). Pedir −1.", -1, "P D R X", { tabla: "Puente (ribera)" }),
        f("Ribera: descansar, gente recién llegada (red). Pedir −1.", -1, "P D R X", { tabla: "Puente (ribera)" }),
        f("La puerta cierra: la guardia vigila a los forasteros.", 0, "P D X", { tabla: "Puente (puerta)" }),
      ],
    },
    {
      id: "meson", nombre: "Mesón", corto: "Mesón", dentro: true,
      desc: "Abre al caer la tarde. Rumores, tratos y gente como tú.",
      franjas: [
        f("Cerrado: pedir −1.", -1, "P"),
        f("Cerrado: pedir −1.", -1, "P"),
        f("Cerrado: pedir −1.", -1, "P"),
        f("Cerrado: pedir −1.", -1, "P"),
        f("Abierto: rumores, compartir, delatar (red).", 0, "P R"),
      ],
    },
  ];

  const TESTIGOS = {
    "Plaza del mercado": ["Nadie", "Vecinos", "Vecinos", "Otro pobre", "Alguacil", "Alguacil"],
    "Catedral en obras": ["Nadie", "Vecinos", "Beneficencia", "Beneficencia", "Otro pobre", "Alguacil"],
    "Escuelas": ["Nadie", "Nadie", "Vecinos", "Otro pobre", "Beneficencia", "Alguacil del Estudio"],
    "Convento de San Esteban": ["Nadie", "Fraile", "Fraile", "Otro pobre", "Otro pobre", "Beneficencia"],
    "Tu parroquia": ["Nadie", "Vecinos", "Cura", "Cura", "Cura", "Alguacil"],
    "Hospital": ["Beneficencia", "Beneficencia", "Beneficencia", "Otro pobre", "Otro pobre", "Alguacil"],
    "Puente (puerta)": ["Nadie", "Nadie", "Otro pobre", "Guardia", "Guardia", "Guardia"],
    "Puente (ribera)": ["Nadie", "Nadie", "Nadie", "Nadie", "Otro pobre", "Alguacil"],
    "Mesón": ["Nadie", "Nadie", "Otro pobre", "Otro pobre", "Otro pobre", "Alguacil"],
  };

  // Cómo cuenta cada testigo para los efectos
  const CATEGORIA = {
    "Nadie": "Nadie", "Vecinos": "Vecinos", "Vecinos (la víctima)": "Vecinos", "Otro pobre": "Otro pobre",
    "Beneficencia": "Beneficencia", "Cura": "Beneficencia", "Fraile": "Fraile",
    "Alguacil": "Autoridad", "Alguacil del Estudio": "Autoridad", "Guardia": "Autoridad",
  };
  const TESTIGO_DESC = {
    "Nadie": "No te ve nadie que importe.",
    "Vecinos": "Los que viven y comercian allí.",
    "Vecinos (la víctima)": "Fallas el hurto y te ve la víctima.",
    "Otro pobre": "Compite contigo, te acompaña o te delata.",
    "Beneficencia": "Los que dan y examinan: distinguen al pobre «verdadero» del fingido.",
    "Cura": "En la parroquia examina el cura.",
    "Fraile": "La caridad del convento: te tiene por pobre de Cristo.",
    "Alguacil": "La justicia de la ciudad.",
    "Alguacil del Estudio": "La justicia de la Universidad.",
    "Guardia": "La guardia de la puerta: vigila a los forasteros.",
  };
  const CATS = ["Nadie", "Vecinos", "Otro pobre", "Beneficencia", "Fraile", "Autoridad"];

  // [ΔTermómetro, ΔTe buscan, condición, ΔT si se cumple, ΔTB si se cumple, texto]
  const E = (t, tb, c, at, atb, txt) => ({ t, tb, cond: c || "", at: at || 0, atb: atb || 0, txt });
  const EFECTOS = {
    "Pedir sin licencia": {
      Nadie: E(0, 0, "", 0, 0, "no pasa nada"),
      Vecinos: E(0, 0, "REPITE", 1, 0, "+1 si ya pediste hoy en este sitio"),
      "Otro pobre": E(0, 0, "RIVAL", 0, 1, "es tu rival: con 1-2 en un dado te delata (Te buscan +1)"),
      Beneficencia: E(1, 0, "IMPEDIDO", -1, 0, "te examina con la vista: +1 si pareces válido, −1 si pareces impedido"),
      Fraile: E(-1, 0, "", 0, 0, "−1: te tiene por pobre de Cristo"),
      Autoridad: E(1, 1, "", 0, 0, "+1 y Te buscan +1"),
    },
    "Pedir con licencia (tu parroquia)": Object.fromEntries(CATS.map((c) => [c, E(0, 0, "", 0, 0, c === "Nadie" ? "no pasa nada" : "nada: pides con licencia en tu parroquia")])),
    "Pedir con licencia (fuera)": {
      Nadie: E(0, 0, "", 0, 0, "no pasa nada"),
      Vecinos: E(0, 0, "", 0, 0, "nada: llevas licencia"),
      "Otro pobre": E(0, 0, "", 0, 0, "nada: llevas licencia"),
      Beneficencia: E(0, 0, "", 0, 0, "nada: llevas licencia"),
      Fraile: E(0, 0, "", 0, 0, "nada: llevas licencia"),
      Autoridad: E(2, 0, "", 0, 0, "pides fuera de tu parroquia: pierdes la licencia (+2)"),
    },
    "Pedir con treta": {
      Nadie: E(0, 0, "", 0, 0, "no pasa nada"),
      Vecinos: E(0, 0, "REPITE", 1, 0, "+1 si ya pediste hoy en este sitio"),
      "Otro pobre": E(0, 0, "RIVAL", 0, 1, "es tu rival: con 1-2 en un dado te delata (Te buscan +1)"),
      Beneficencia: E(-1, 0, "EXAMEN", 2, 2, "te examina: tira un dado contra tu treta; si lo iguala o supera, te descubre (+2, Te buscan +2 y la treta queda catalogada); si no, −1"),
      Fraile: E(-1, 0, "", 0, 0, "−1: te tiene por pobre de Cristo"),
      Autoridad: E(1, 1, "", 0, 0, "+1 y Te buscan +1"),
    },
    "Hurtar": {
      Nadie: E(0, 0, "", 0, 0, "nadie te ve"),
      Vecinos: E(2, 2, "", 0, 0, "+2 y Te buscan +2"),
      "Otro pobre": E(0, 0, "DELATOR", 0, 2, "tira un dado: con 1-2 te delata (Te buscan +2); si tienes relación 2+ con alguien de tu red, solo con 1"),
      Beneficencia: E(2, 1, "", 0, 0, "+2 y Te buscan +1"),
      Fraile: E(1, 0, "", 0, 0, "+1"),
      Autoridad: E(0, 0, "", 0, 0, "te detienen en el acto"),
    },
    "Trabajar": {
      Nadie: E(0, 0, "", 0, 0, "no pasa nada"),
      Vecinos: E(-1, 0, "", 0, 0, "−1 si te contratan: te ven trabajar"),
      "Otro pobre": E(0, 0, "", 0, 0, "nada"),
      Beneficencia: E(-1, 0, "", 0, 0, "−1 si te contratan: te ven trabajar"),
      Fraile: E(0, 0, "", 0, 0, "nada"),
      Autoridad: E(-1, 0, "", 0, 0, "−1 si te contratan: te ven trabajar"),
    },
    "Descansar": {
      Nadie: E(0, 0, "", 0, 0, "nadie te molesta: +1 de cuerpo"),
      Vecinos: E(1, 0, "", 0, 0, "vagancia: +1, y no descansas"),
      "Otro pobre": E(0, 0, "", 0, 0, "nada, pero no descansas"),
      Beneficencia: E(0, 0, "", 0, 0, "nada, pero no descansas"),
      Fraile: E(0, 0, "", 0, 0, "nada, pero no descansas"),
      Autoridad: E(1, 1, "", 0, 0, "vagancia: +1 y Te buscan +1, y no descansas"),
    },
    "La red": {
      Nadie: E(0, 0, "", 0, 0, "nadie más os ve"),
      Vecinos: E(0, 0, "", 0, 0, "nada"),
      "Otro pobre": E(0, 0, "", 0, 0, "nada"),
      Beneficencia: E(0, 0, "", 0, 0, "nada"),
      Fraile: E(0, 0, "", 0, 0, "nada"),
      Autoridad: E(1, 0, "", 0, 0, "juntarse con vagabundos: +1"),
    },
    "Delatar": {
      Nadie: E(0, 0, "", 0, 0, "nadie más te ha visto"),
      Vecinos: E(0, 0, "", 0, 0, "nada"),
      "Otro pobre": E(0, 0, "", 0, 0, "el delatado te ha visto: se vengará"),
      Beneficencia: E(0, 0, "", 0, 0, "nada"),
      Fraile: E(0, 0, "", 0, 0, "nada"),
      Autoridad: E(0, 0, "", 0, 0, "el alguacil toma nota de ti"),
    },
    "Cruzar la puerta": {
      Nadie: E(0, 0, "", 0, 0, "pasas sin que te miren"),
      Vecinos: E(0, 0, "", 0, 0, "nada"),
      "Otro pobre": E(0, 0, "", 0, 0, "nada"),
      Beneficencia: E(0, 0, "", 0, 0, "nada"),
      Fraile: E(0, 0, "", 0, 0, "nada"),
      Autoridad: E(0, 0, "FORASTERO", 1, 0, "te para la guardia: +1 si eres forastero sin licencia"),
    },
  };

  const ACCIONES = {
    pedir: { nombre: "Pedir", dado: true, testigo: true, desc: "Mendigar. Con 1 no te dan nada; 2-3, una moneda; 4-5, dos; 6, tres. Más lo que dé el sitio. Quien te vea te clasifica." },
    trabajar: { nombre: "Trabajar a jornal", dado: true, testigo: true, desc: "Hacer de peón. Con dado 4 o más (más tu modificador) te contratan: 3 monedas. Ocupa también la franja siguiente." },
    hurtar: { nombre: "Hurtar", dado: true, testigo: true, desc: "Robar entre el gentío. 1-2: fallas y te ven. 3-4: 2 monedas. 5-6: 4 monedas. Si te ve un alguacil, te detienen en el acto." },
    descansar: { nombre: "Descansar", dado: true, testigo: true, desc: "Esconderte y recuperarte: +1 de cuerpo si nadie te ve. Si te ven tirado, cuenta como vagancia." },
    curarse: { nombre: "Curarse", dado: true, testigo: false, desc: "+2 de cuerpo con dado 3 o más, pero te apuntan en el libro (−1). Si entras con cuerpo 2 o menos, te recogen y no sales." },
    examen: { nombre: "Pedir licencia", dado: true, testigo: false, desc: "El cura te examina. Solo para naturales de la ciudad. Si apruebas, pasas a pobre con licencia (−2): limosna segura en tu parroquia, pero si te ven pedir fuera, la pierdes." },
    compartir: { nombre: "Compartir", dado: true, testigo: true, desc: "Das una ración (o una moneda si no tienes) a alguien de tu red o a alguien nuevo: sube la relación y te cuenta algo (+1 rumor)." },
    preguntar: { nombre: "Preguntar", dado: true, testigo: true, desc: "Hablar con alguien. Con dado 3 o más te cuenta algo (+1 rumor) y sube la relación." },
    delatar: { nombre: "Delatar", dado: true, testigo: true, desc: "Vender a otro pobre al alguacil: 2 monedas y −1. La autoridad toma nota (atención +1). Si otro pobre te ve, se vengará." },
    cruzar: { nombre: "Cruzar la puerta", dado: false, testigo: true, desc: "Entrar o salir de la ciudad. No gasta dado, pero ocupa la franja. La guardia vigila a los forasteros." },
  };
  const COD_ACC = { P: ["pedir"], T: ["trabajar"], H: ["hurtar"], D: ["descansar"], C: ["curarse"], E: ["examen"], R: ["compartir", "preguntar", "delatar"], X: ["cruzar"] };

  const PARAMS = {
    jornalUmbral: 4, jornalPaga: 3, delatarPaga: 2, delatarT: -1, compartirCoste: 1,
    curarUmbral: 3, curarC: 2, curarT: -1, recogidoCuerpo: 2, descansarC: 1, hambreC: -2,
    tretaUmbral: 4, tretaBonus: 1, catalogadaExam: 1, licMin: 1, licPrima: 1, limosnaPub: 2,
    sitioLimosna: "catedral", preguntarUmbral: 3, rivalUmbral: 2, delatorUmbral: 2, delatorUmbralRed: 1,
    tbMax: 6, examenGenUmbral: 2, examenGenFuerte: 3, tfCuerpo: -1, tfDias: 3, aten2: 3, aten3: 6,
    pregonInicio: 3, pregonVence: 10, pregonDias: 3, rondaDias: 2,
  };
  const PEDIR_DADO = [0, 1, 1, 2, 2, 3];   // dado 1..6
  const HURTAR_DADO = [0, 0, 2, 2, 4, 4];
  const DADOS_CUERPO = [[1, 2, 1], [3, 4, 2], [5, 6, 3], [7, 8, 4], [9, 10, 5]];

  const CALENDARIO = [
    { dia: 1, fecha: "Lunes 1 de junio de 1545", que: "Empieza la partida.", pan: 2 },
    { dia: 2, fecha: "Martes 2 de junio", que: "Día de mercado: la plaza rinde +1 más a tercia y sexta.", pan: 2 },
    { dia: 3, fecha: "Miércoles 3 de junio", que: "Se pregona la expulsión de los forasteros: tienen siete días para irse.", pan: 2 },
    { dia: 4, fecha: "Jueves 4 de junio", que: "Corpus Christi. Procesión de tercia a sexta: pedir +2 en la catedral y la plaza, se puede hurtar entre el gentío (+1) y hay más alguaciles. Es fiesta: no hay jornal.", pan: 3 },
    { dia: 5, fecha: "Viernes 5 de junio", que: "Día corriente. El pan ha subido.", pan: 3 },
    { dia: 6, fecha: "Sábado 6 de junio", que: "Día corriente.", pan: 3 },
    { dia: 7, fecha: "Domingo 7 de junio", que: "Misa mayor: pedir +1 a prima en la parroquia y la catedral. No hay mercado ni obras: ni jornal ni hurto en la plaza.", pan: 4 },
    { dia: 8, fecha: "Lunes 8 de junio", que: "Día corriente. El pan sigue subiendo.", pan: 4 },
    { dia: 9, fecha: "Martes 9 de junio", que: "Día de mercado: la plaza rinde +1 más a tercia y sexta.", pan: 4 },
    { dia: 10, fecha: "Miércoles 10 de junio", que: "Vence el pregón: el forastero sin licencia al que vea un alguacil o la guardia dentro de la muralla queda detenido. Si llegas a la noche, sobrevives.", pan: 5 },
  ];
  // día, sitio, franja, mod pedir, hurtar (1 permite / −1 prohíbe), mod hurtar, prohíbe jornal, alguacil extra
  const MODS = [
    [2, "plaza", "Tercia", 1, 0, 0, 0, 0], [2, "plaza", "Sexta", 1, 0, 0, 0, 0],
    [4, "plaza", "Prima", 0, 0, 0, 1, 0], [4, "plaza", "Tercia", 2, 0, 1, 0, 1], [4, "plaza", "Sexta", 2, 0, 1, 0, 1],
    [4, "catedral", "Tercia", 2, 1, 1, 1, 1], [4, "catedral", "Sexta", 2, 1, 1, 1, 1], [4, "catedral", "Nona", 0, 0, 0, 1, 0],
    [7, "plaza", "Prima", 0, 0, 0, 1, 0], [7, "plaza", "Tercia", -1, -1, 0, 0, 0], [7, "plaza", "Sexta", -1, -1, 0, 0, 0],
    [7, "catedral", "Prima", 1, 0, 0, 0, 0], [7, "catedral", "Tercia", 0, 0, 0, 1, 0], [7, "catedral", "Sexta", 0, 0, 0, 1, 0],
    [7, "catedral", "Nona", 0, 0, 0, 1, 0], [7, "parroquia", "Prima", 1, 0, 0, 0, 0],
    [9, "plaza", "Tercia", 1, 0, 0, 0, 0], [9, "plaza", "Sexta", 1, 0, 0, 0, 0],
  ].map(([dia, sitio, franja, pedir, hurtar, modHurtar, sinJornal, alguacil]) => ({ dia, sitio, franja, pedir, hurtar, modHurtar, sinJornal, alguacil }));

  const PERSONAJES = [
    {
      id: "mozo", nombre: "Mozo de La Armuña", origen: "Forastero", cuerpoTipo: "Válido",
      forastero: true, impedido: false, raciones: 1, modJornal: 0, difExamen: null,
      termo0: 0, cuerpo0: 8, monedas0: 2, raciones0: 1, tretaOficio: null, bonusTreta: 0,
      resumen: "Sin trabajo tras una mala cosecha. Puede trabajar a jornal, pero no puede tener licencia: para la ley es un vago. Para que le den limosna tiene que fingir.",
      claves: ["Forastero: no puede pedir licencia", "Válido: la beneficencia le mira mal si pide", "Buen peón: jornal sin penalización"],
    },
    {
      id: "viuda", nombre: "Viuda con un hijo pequeño", origen: "Natural de Salamanca", cuerpoTipo: "Válida, con cargas",
      forastero: false, impedido: false, raciones: 2, modJornal: -1, difExamen: 4,
      termo0: -1, cuerpo0: 8, monedas0: 2, raciones0: 1, tretaOficio: null, bonusTreta: 0,
      resumen: "Conocida en su parroquia: puede pedir licencia al cura. Necesita dos raciones cada noche. El hijo cuenta en lo que necesitan comer, nunca como recurso para conmover.",
      claves: ["Natural: puede sacar licencia (examen a tercia, dado 4+)", "Dos raciones cada noche", "Empieza como pobre conocida (−1)", "Jornal −1"],
    },
    {
      id: "soldado", nombre: "Soldado licenciado y cojo", origen: "Forastero", cuerpoTipo: "Impedido",
      forastero: true, impedido: true, raciones: 1, modJornal: -2, difExamen: null,
      termo0: 0, cuerpo0: 8, monedas0: 2, raciones0: 1, tretaOficio: "Falso cautivo", bonusTreta: 1,
      resumen: "Da lástima sin fingir, pero es forastero y no puede tener licencia. Le cuesta que le contraten. Conoce tretas de soldado.",
      claves: ["Impedido: la beneficencia le tiene por pobre verdadero", "Forastero: no puede pedir licencia", "Jornal −2", "+1 al fingir falso cautivo"],
    },
  ];

  const TRETAS = [
    { nombre: "Llagas fingidas", desc: "Llagas pintadas o abiertas a propósito." },
    { nombre: "Mal de corazón", desc: "Caer con convulsiones a la puerta de la iglesia." },
    { nombre: "Falso peregrino", desc: "Pedir para seguir camino a Santiago." },
    { nombre: "Falso cautivo", desc: "Decir que vuelves de tierra de moros y pedir para el rescate." },
    { nombre: "Falsa ceguera", desc: "Con lazarillo o sin él." },
  ];

  const DORMIR = [
    { id: "portico", nombre: "Pórtico de iglesia", lado: "dentro", coste: 0, c: 0, t: 0, tb: 0, rumor: 0, riesgo: 2, rc: 0, rt: 1, rtb: 1,
      riesgoTxt: "Pasa la ronda: vagancia +1 y Te buscan +1", desc: "Gratis. Con 1-2 en el dado de noche te encuentra la ronda." },
    { id: "arrabal", nombre: "Arrabal, junto a la ribera", lado: "fuera", coste: 0, c: 0, t: 0, tb: 0, rumor: 0, riesgo: 1, rc: -1, rt: 0, rtb: 0,
      riesgoTxt: "Agua y fiebres: −1 de cuerpo", desc: "Gratis y sin rondas. Con 1 en el dado de noche, −1 de cuerpo. Mañana amaneces fuera de la muralla." },
    { id: "meson", nombre: "Mesón", lado: "dentro", coste: 2, c: 1, t: 0, tb: 0, rumor: 1, riesgo: 0, rc: 0, rt: 0, rtb: 0,
      riesgoTxt: "", desc: "2 monedas. +1 de cuerpo y oyes un rumor (+1)." },
    { id: "hospital", nombre: "Hospital", lado: "dentro", coste: 0, c: 2, t: -1, tb: 0, rumor: 0, riesgo: 0, rc: 0, rt: 0, rtb: 0,
      riesgoTxt: "", desc: "Gratis. +2 de cuerpo, pero te apuntan (−1). Si entras con cuerpo 2 o menos, te recogen." },
    { id: "red", nombre: "Con alguien de tu red", lado: "ambos", coste: 0, c: 1, t: 0, tb: 0, rumor: 0, riesgo: 0, rc: 0, rt: 0, rtb: 0,
      riesgoTxt: "", desc: "Gratis. +1 de cuerpo y nadie te ve. Necesitas relación 2 o más con alguien que viva de tu lado de la muralla." },
    { id: "carcel", nombre: "Cárcel", lado: "ambos", coste: 0, c: 0, t: 0, tb: 0, rumor: 0, riesgo: 0, rc: 0, rt: 0, rtb: 0,
      riesgoTxt: "", desc: "Te han detenido." },
  ];

  const CLASIF = { "-3": "Recogido", "-2": "Con licencia", "-1": "Pobre conocido", "0": "Desconocido", "1": "Sospechoso", "2": "Vagabundo", "3": "Reincidente" };

  const MOVIMIENTOS = ["Ronda", "Ronda", "Cerrar la puerta", "Pregón", "Examen general", "Limosna pública"];
  const MOV_DESC = {
    "Ronda": "Manda una ronda donde más te vieron: durante dos días, el resultado más bajo del dado de testigo de ese sitio pasa a ser «Alguacil». Las rondas se acumulan.",
    "Cerrar la puerta": "Mañana no se entra en la ciudad desde fuera sin licencia.",
    "Pregón": "Pregona una norma nueva para los próximos días.",
    "Examen general": "Mañana el cura examina a todos los pobres con licencia: pueden perderla.",
    "Limosna pública": "Mañana reparte limosna en la catedral: pedir allí rinde +2, pero solo miran la beneficencia y los alguaciles. La piedad como espectáculo.",
  };
  const PREGONES = [
    { tipo: 1, txt: "Prohibido pedir en la catedral durante la misa y el oficio (prima y vísperas)." },
    { tipo: 1, txt: "Prohibido pedir en la catedral durante la misa y el oficio (prima y vísperas)." },
    { tipo: 2, txt: "Se pregonan los fingidores: tu treta más usada queda catalogada (si no has fingido, las llagas)." },
    { tipo: 2, txt: "Se pregonan los fingidores: tu treta más usada queda catalogada (si no has fingido, las llagas)." },
    { tipo: 3, txt: "Se paga el doble por delatar." },
    { tipo: 3, txt: "Se paga el doble por delatar." },
  ];

  const NOMBRES = ["Perico el Tuerto", "Juana la Ronca", "Martín de Toro", "Catalina la del puente", "Antón el Mellado",
    "María la Rubia", "Diego el Zurdo", "Inés de Zamora", "Pedro el Navarro", "Lucía la Viuda", "Bartolo el Cojo",
    "Francisca la Morena", "Gil el Romero", "Teresa la Larga", "Alonso el Pelado", "Ana de Ledesma"];

  const AYUDA = [
    ["De qué va", "Eres un pobre en Salamanca, en junio de 1545. La autoridad acaba de decidir quién merece limosna y quién es un vagabundo. Tienes que llegar vivo al día 10 sin que te ahorquen, sin morir de hambre y sin que te encierren. Nadie sale de pobre."],
    ["El día", "Cada día tiene un amanecer, cinco franjas (prima, tercia, sexta, nona y vísperas), la noche y el turno de la autoridad. En cada franja eliges un sitio y una acción."],
    ["Cuerpo y dados", "El cuerpo (0 a 10) es tu salud. Cada mañana decide cuántos dados tiras: 9-10, cinco; 7-8, cuatro; 5-6, tres; 3-4, dos; 1-2, uno. Cada acción gasta un dado y su valor es lo bien que te sale. Tú eliges qué dado va a cada acción. A 0 de cuerpo, mueres."],
    ["Comer", "Cada noche comes una ración (la viuda, dos). Si te falta, pierdes 2 de cuerpo por ración. El pan se compra de noche y sube de precio cada pocos días."],
    ["Testigos", "Cada acción tira un dado de testigo: decide quién te ve. Vecinos, otros pobres, la beneficencia, frailes o alguaciles. Cada uno te mira a su manera y eso mueve tu termómetro."],
    ["Termómetro", "Cómo te clasifica la autoridad, de −3 a +3. Hacia arriba: sospechoso, vagabundo, reincidente. Hacia abajo: pobre conocido, con licencia y, al final, recogido (te encierran en una institución y la partida acaba). Sin licencia no bajas de −1. El termómetro no mata solo: decide el castigo si te detienen."],
    ["Te buscan", "Cuando llega a 6, te detienen. El castigo depende del termómetro: con 0 o menos, reprensión; con +1, azotes; con +2, trabajo forzado o marca; con +3, la horca."],
    ["La autoridad", "Cada noche juega según lo que vio: manda rondas a donde más te vieron, cierra la puerta, pregona normas, examina a los pobres o reparte limosna pública. Lo que hace lo ves al amanecer."],
    ["Fingir", "Al amanecer puedes gastar un dado en preparar una treta (llagas, ceguera, falso peregrino…). Ese dado es su calidad para todo el día: te dan más y te tienen por impedido, pero si te examina la beneficencia o el cura y su dado iguala tu calidad, te descubren."],
    ["Red y rumores", "Puedes compartir o preguntar a otros pobres. Con relación 2 puedes dormir con alguien, te encubre si te ve robar y no mueres solo. Un rumor sirve para repetir un dado de testigo."],
    ["La muralla", "El puente y el arrabal están fuera. Si duermes fuera, para entrar tienes que cruzar la puerta, donde la guardia vigila a los forasteros. Si la autoridad cierra la puerta, sin licencia te quedas fuera."],
  ];

  const RULES = {
    version: "0.1b", CONFIG, FRANJAS, FRANJA_DESC, SITIOS, TESTIGOS, CATEGORIA, TESTIGO_DESC, CATS, EFECTOS, ACCIONES, COD_ACC,
    PARAMS, PEDIR_DADO, HURTAR_DADO, DADOS_CUERPO, CALENDARIO, MODS, PERSONAJES, TRETAS, DORMIR, CLASIF,
    MOVIMIENTOS, MOV_DESC, PREGONES, NOMBRES, AYUDA,
  };
  root.RULES = RULES;
  if (typeof module !== "undefined" && module.exports) module.exports = RULES;
})(typeof window !== "undefined" ? window : globalThis);
