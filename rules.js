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
        f("Cierre del mercado: al pedir te dan sobras (1 ración, si el dado es bueno).", 0, "P", { pedirDa: "racion", umbral: 4 }),
      ],
    },
    {
      id: "catedral", nombre: "Catedral en obras", corto: "Catedral", dentro: true,
      desc: "La catedral nueva, en obras desde 1513. Misas, limosnas y peones.",
      franjas: [
        f("Misa: pedir +1. Pórtico para descansar.", 1, "P D"),
        f("Obras: contratan peones a primera hora. Pórtico.", 0, "P T D"),
        f("Obras: ya no contratan a nadie más. Pórtico.", 0, "P D"),
        f("Obras: ya no contratan a nadie más. Pórtico.", 0, "P D"),
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
        f("Sopa: al pedir te dan 1 ración si el dado es bueno (si no, se acaba antes de que llegues). Pobres a la puerta (red).", 0, "P R", { pedirDa: "racion", umbral: 4 }),
        f("Nada a esta hora: pedir −1.", -1, "P"),
        f("Oficio: se puede pedir. Pobres a la puerta (red).", 0, "P R"),
      ],
    },
    {
      id: "parroquia", nombre: "Tu parroquia", corto: "Parroquia", dentro: true,
      desc: "Donde te conocen. El cura lleva la lista de pobres de la orden: examina a los naturales y los de la lista cumplen aquí.",
      franjas: [
        f("Misa: pedir +1. Los de la lista cumplen. Pórtico para descansar.", 1, "P D U"),
        f("El cura examina para entrar en la lista (solo naturales). Los de la lista cumplen. Pórtico.", 0, "P D E U"),
        f("Nada a esta hora: pedir −1. Los de la lista cumplen. Pórtico.", -1, "P D U"),
        f("Nada a esta hora: pedir −1. Los de la lista cumplen. Pórtico.", -1, "P D U"),
        f("Se puede pedir. Los de la lista cumplen. Pórtico.", 0, "P D U"),
      ],
    },
    {
      id: "hospital", nombre: "Hospital", corto: "Hospital", dentro: true,
      desc: "Te curan, pero te apuntan. Quien entra muy débil ya no sale.",
      franjas: [0, 1, 2, 3, 4].map(() => f("Curarse (solo enfermos: cuerpo 5 o menos): +2 de cuerpo si el dado no es bajo, pero te apuntan (−1). A la tercera vez, o con cuerpo 2 o menos, te recogen.", 0, "P C")),
    },
    {
      id: "puente", nombre: "Puente y arrabal", corto: "Puente", dentro: false, ambos: true,
      desc: "La puerta de la muralla, la ribera y el arrabal. Se llega desde dentro y desde fuera: estar aquí no es salir; sigues de tu lado de la muralla hasta que cruzas la puerta.",
      franjas: [
        f("La puerta abre: la guardia vigila a los forasteros.", 0, "P D X", { tabla: "Puente (puerta)" }),
        f("Ribera: lavanderas (lavar ropa), descansar, gente recién llegada (red). Pedir −1.", -1, "P D R X L", { tabla: "Puente (ribera)" }),
        f("Ribera: lavanderas (lavar ropa), descansar, gente recién llegada (red). Pedir −1.", -1, "P D R X L", { tabla: "Puente (ribera)" }),
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
        f("Abierto: rumores, juntarse, compartir, delatar (red).", 0, "P R"),
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
    // En la lista no se pide: si te ve pedir quien la lleva (beneficencia, cura, alguacil), te borran. Los frailes no denuncian.
    "Pedir estando en la lista": {
      Nadie: E(0, 0, "", 0, 0, "no pasa nada"),
      Vecinos: E(0, 0, "", 0, 0, "nada: no llevan la lista"),
      "Otro pobre": E(0, 0, "RIVAL", 0, 1, "es tu rival: con 1-2 en un dado te delata (Te buscan +1)"),
      Beneficencia: E(0, 0, "", 0, 0, "te borran de la lista: esta noche no hay ración"),
      Fraile: E(0, 0, "", 0, 0, "nada: los frailes no denuncian a nadie"),
      Autoridad: E(0, 1, "", 0, 0, "te borran de la lista (esta noche no hay ración) y Te buscan +1"),
    },
    "Cumplir": Object.fromEntries(CATS.map((c) => [c, E(0, 0, "", 0, 0, c === "Nadie" ? "nadie más te ve" : "nada: estás cumpliendo")])),
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
      Autoridad: E(1, 0, "", 0, 0, "juntarse con vagabundos: +1, y esta noche interroga seguro a quien está contigo"),
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
      Autoridad: E(0, 0, "FORASTERO", 1, 0, "te para la guardia: +1 si eres forastero"),
    },
  };

  const ACCIONES = {
    pedir: { nombre: "Pedir", dado: true, testigo: true, desc: "Mendigar. Cuanto más alto el dado, más te dan; con un dado bajo, nada. Hay sitios y horas que rinden más que otros. Quien te vea te clasifica." },
    trabajar: { nombre: "Trabajar a jornal", dado: true, testigo: true, desc: "Hacer de peón. Con un dado bueno te contratan y te pagan bien por el día. Ocupa también la franja siguiente. Antes de la siega hay poco trabajo: solo contratan a primera hora en la plaza (prima) y en las obras de la catedral (tercia)." },
    hurtar: { nombre: "Hurtar", dado: true, testigo: true, desc: "Robar entre el gentío. Con un dado bajo fallas y te ven; cuanto más alto, más sacas. Si te ve un alguacil, te detienen en el acto." },
    descansar: { nombre: "Descansar", dado: true, testigo: true, desc: "Esconderte y recuperarte: +1 de cuerpo si nadie te ve. Con un dado bajo, el hambre no te deja descansar. Si te ven tirado, cuenta como vagancia." },
    curarse: { nombre: "Curarse", dado: true, testigo: false, desc: "Solo admiten enfermos (cuerpo 5 o menos). +2 de cuerpo si el dado no es bajo, pero te apuntan en el libro (−1). A la tercera vez que te apuntan, o si entras con cuerpo 2 o menos, te recogen y no sales." },
    examen: { nombre: "Entrar en la lista", dado: true, testigo: false, desc: "El cura te examina. Solo para naturales de la ciudad. Hace falta un dado bueno. Si apruebas, entras en la lista de pobres de la orden (−2): ya no puedes pedir, pero cada día que cumplas en tu parroquia te darán una ración por la noche. Si te ven pedir la beneficencia, el cura o un alguacil, te borran." },
    cumplir: { nombre: "Cumplir con la parroquia", dado: true, testigo: true, desc: "Oír misa, confesarte, presentarte al cura. Solo para quien está en la lista. Cualquier dado sirve. Si has cumplido y nadie de los que llevan la lista te ha visto pedir, esta noche te dan una ración (la tuya: el niño no cuenta)." },
    compartir: { nombre: "Compartir", dado: true, testigo: true, desc: "Das una ración (o una moneda si no tienes) a alguien de tu red o a alguien nuevo: sube la relación y te cuenta algo (+1 rumor). Como al juntarte, esa persona queda señalada esta noche." },
    juntarse: { nombre: "Juntarte con alguien", dado: true, testigo: true, desc: "Pasar el rato con otros pobres. Cualquier dado sirve: os acercáis (relación +1); con un dado no bajo, además te cuenta algo (+1 rumor). Pero esa persona queda señalada: si esta noche la autoridad interroga, irá a por ella; y si os ve un alguacil, la interrogará seguro." },
    delatar: { nombre: "Delatar", dado: true, testigo: true, desc: "Vender a alguien de tu red al alguacil: 2 monedas y −1, pero lo pierdes. La autoridad toma nota (atención +1). Si otro pobre te ve, se corre la voz: el resto de tu red te baja la relación y alguien se vengará." },
    lavar: { nombre: "Lavar ropa en la ribera", dado: true, testigo: true, desc: "Lavar ropa ajena en el Tormes. Si el dado no es bajo, te dan ropa y te pagan. En la ribera, a tercia y a sexta. Si te ven trabajar, te tienen por pobre honrada (−1)." },
    cruzar: { nombre: "Cruzar la puerta", dado: false, testigo: true, desc: "Entrar o salir de la ciudad. No gasta dado, pero ocupa la franja. La guardia vigila a los forasteros." },
  };
  const COD_ACC = { P: ["pedir"], T: ["trabajar"], H: ["hurtar"], D: ["descansar"], C: ["curarse"], E: ["examen"], R: ["compartir", "juntarse", "delatar"], X: ["cruzar"], L: ["lavar"], U: ["cumplir"] };

  const PARAMS = {
    jornalUmbral: 4, jornalPaga: 3, delatarPaga: 2, delatarT: -1, compartirCoste: 1,
    curarUmbral: 3, curarC: 2, curarT: -1, recogidoCuerpo: 2, descansarC: 1, descansarUmbral: 3, hambreC: -2,
    tretaUmbral: 4, tretaBonus: 1, catalogadaExam: 1, listaRacion: 1, limosnaPub: 2,
    sitioLimosna: "catedral", juntarseRumor: 3, rivalUmbral: 2, delatorUmbral: 2, delatorUmbralRed: 1,
    tbMax: 6, examenGenUmbral: 2, examenGenFuerte: 3, tfCuerpo: -1, tfDias: 3, aten2: 3, aten3: 6,
    pregonInicio: 3, pregonVence: 10, pregonDias: 3, rondaDias: 2,
    // v0.2
    hatillo: 2,            // raciones que puedes guardar de una noche a otra
    dineroUmbral: 4,       // con más monedas encima, pedir ante alguacil o beneficencia te delata como fingidor (+1)
    roboRiesgo: 1,         // durmiendo al raso con más de dineroUmbral monedas, con este dado o menos te roban
    roboCuerpo: -1,        // y te pegan
    reincidenciaMax: 3,    // tras cada detención, «Te buscan» empieza en el número de detenciones (máximo 3)
    escaladaDesde: 3,      // desde este día la autoridad hace un movimiento más cada noche
    interrogaBase: 4,      // en un interrogatorio, te vende si su dado es ≤ interrogaBase − relación
    interrogaDias: 2,      // días que se llevan a quien no habla
    traicionRel: 1,        // con «se paga el doble por delatar», quien tenga esta relación o menos puede venderte
    favorProb: 2,          // cada amanecer, con este dado o menos alguien de tu red te pide comida
    prestamoRel: 3,        // con esta relación, si te falta pan alguien te da una ración (y baja la relación)
    sucesosDesde: 2,
    hospitalMaxCuerpo: 5,  // el hospital solo admite a quien tenga este cuerpo o menos
    hospitalVeces: 3,      // a la tercera vez que te apuntan, te recogen
    // v0.3
    techoSinDetencion: 2,  // sin detenciones previas el termómetro no pasa de +2: «reincidente» es quien ya ha sido detenido
    lavarUmbral: 3, lavarPaga: 2, ninoPedir: 2, mesonExtra: 2,
    ninoCuerpo0: 4, ninoMax: 5, ninoHambre: -2, ninoDebil: 1, ninoFiebre: 3,
  };
  const PEDIR_DADO = [0, 0, 1, 1, 2, 3];   // dado 1..6
  const HURTAR_DADO = [0, 0, 2, 2, 4, 4];
  const DADOS_CUERPO = [[1, 2, 1], [3, 4, 2], [5, 6, 3], [7, 8, 4], [9, 10, 5]];

  const CALENDARIO = [
    { dia: 1, fecha: "Lunes 1 de junio de 1545", que: "Empieza la partida.", pan: 3 },
    { dia: 2, fecha: "Martes 2 de junio", que: "Día de mercado: la plaza rinde +1 más a tercia y sexta.", pan: 3 },
    { dia: 3, fecha: "Miércoles 3 de junio", que: "Se pregona la expulsión de los forasteros: tienen siete días para irse.", pan: 3 },
    { dia: 4, fecha: "Jueves 4 de junio", que: "Corpus Christi. Procesión de tercia a sexta: pedir +2 en la catedral y la plaza, se puede hurtar entre el gentío (+1) y hay más alguaciles. Es fiesta: no hay jornal.", pan: 4 },
    { dia: 5, fecha: "Viernes 5 de junio", que: "Día corriente. El pan ha subido.", pan: 4 },
    { dia: 6, fecha: "Sábado 6 de junio", que: "Día corriente. El pan vuelve a subir.", pan: 6 },
    { dia: 7, fecha: "Domingo 7 de junio", que: "Misa mayor: pedir +1 a prima en la parroquia y la catedral. No hay mercado ni obras: ni jornal ni hurto en la plaza.", pan: 6 },
    { dia: 8, fecha: "Lunes 8 de junio", que: "Día corriente. El pan sigue subiendo.", pan: 7 },
    { dia: 9, fecha: "Martes 9 de junio", que: "Día de mercado: la plaza rinde +1 más a tercia y sexta. El pan, más caro que nunca.", pan: 7 },
    { dia: 10, fecha: "Miércoles 10 de junio", que: "Vence el pregón: el forastero al que vea un alguacil o la guardia dentro de la muralla queda detenido. Si llegas a la noche, sobrevives.", pan: 8 },
  ];
  // día, sitio, franja, mod pedir, hurtar (1 permite / −1 prohíbe), mod hurtar, prohíbe jornal, alguacil extra
  const MODS = [
    [2, "plaza", "Tercia", 1, 0, 0, 0, 0], [2, "plaza", "Sexta", 1, 0, 0, 0, 0],
    [4, "plaza", "Prima", 0, 0, 0, 1, 0], [4, "plaza", "Tercia", 2, 0, 1, 0, 1], [4, "plaza", "Sexta", 2, 0, 1, 0, 1],
    [4, "catedral", "Tercia", 2, 1, 1, 1, 1], [4, "catedral", "Sexta", 2, 1, 1, 0, 1],
    [7, "plaza", "Prima", 0, 0, 0, 1, 0], [7, "plaza", "Tercia", -1, -1, 0, 0, 0], [7, "plaza", "Sexta", -1, -1, 0, 0, 0],
    [7, "catedral", "Prima", 1, 0, 0, 0, 0], [7, "catedral", "Tercia", 0, 0, 0, 1, 0], [7, "parroquia", "Prima", 1, 0, 0, 0, 0],
    [9, "plaza", "Tercia", 1, 0, 0, 0, 0], [9, "plaza", "Sexta", 1, 0, 0, 0, 0],
  ].map(([dia, sitio, franja, pedir, hurtar, modHurtar, sinJornal, alguacil]) => ({ dia, sitio, franja, pedir, hurtar, modHurtar, sinJornal, alguacil }));

  const PERSONAJES = [
    {
      id: "mozo", nombre: "Mozo de La Armuña", origen: "Forastero", cuerpoTipo: "Válido",
      forastero: true, impedido: false, raciones: 1, modJornal: 0, difExamen: null, oficios: ["peon"], nino: false,
      termo0: 0, cuerpo0: 8, monedas0: 2, raciones0: 1, tretaOficio: null, bonusTreta: 0,
      resumen: "Sin trabajo tras una mala cosecha. Puede trabajar a jornal, pero no puede entrar en la lista de pobres: para la ley es un vago. Para que le den limosna tiene que fingir.",
      claves: ["Forastero: no puede entrar en la lista de pobres", "Válido: la beneficencia le mira mal si pide", "Buen peón: jornal sin penalización"],
    },
    {
      id: "viuda", nombre: "Viuda con un hijo pequeño", origen: "Natural de Salamanca", cuerpoTipo: "Válida, con cargas",
      forastero: false, impedido: false, raciones: 1, modJornal: -1, difExamen: 4, oficios: ["lavar"], nino: true,
      termo0: -1, cuerpo0: 8, monedas0: 2, raciones0: 1, tretaOficio: null, bonusTreta: 0,
      resumen: "Conocida en su parroquia: puede entrar en la lista de pobres del cura (allí no se pide, pero dan una ración al día a quien cumple). Va con su hijo pequeño, que tiene su propio cuerpo y come cada noche. Con el niño al lado da más pena: la limosna en moneda rinde +2. Si el niño enferma o a ella la detienen, la autoridad puede llevárselo. No trabaja de peón, pero puede lavar ropa en la ribera.",
      claves: ["Natural: puede entrar en la lista de pobres (examen a tercia, con un dado bueno)", "Va con su hijo: dos bocas cada noche", "Si no hay pan para los dos, eliges quién come", "Con el niño al lado, la limosna rinde +2 monedas", "Lava ropa en la ribera a tercia y sexta", "Empieza como pobre conocida (−1)"],
    },
    {
      id: "soldado", nombre: "Soldado licenciado y cojo", origen: "Forastero", cuerpoTipo: "Impedido",
      forastero: true, impedido: true, raciones: 1, modJornal: -2, difExamen: null, oficios: ["peon"], nino: false,
      termo0: 0, cuerpo0: 8, monedas0: 2, raciones0: 1, tretaOficio: "Falso cautivo", bonusTreta: 1,
      resumen: "Da lástima sin fingir, pero es forastero y no puede entrar en la lista de pobres. Le cuesta que le contraten. Conoce tretas de soldado.",
      claves: ["Impedido: la beneficencia le tiene por pobre verdadero", "Forastero: no puede entrar en la lista de pobres", "Jornal −2", "+1 al fingir falso cautivo"],
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
    { id: "portico", nombre: "Pórtico de iglesia", lado: "dentro", raso: true, coste: 0, c: -1, t: 0, tb: 0, rumor: 0, riesgo: 2, rc: 0, rt: 1, rtb: 1,
      riesgoTxt: "Pasa la ronda: vagancia +1 y Te buscan +1", desc: "Gratis, pero al raso: −1 de cuerpo. Con 1-2 en el dado de noche te encuentra la ronda." },
    { id: "arrabal", nombre: "Arrabal, junto a la ribera", lado: "fuera", raso: true, coste: 0, c: -1, t: 0, tb: 0, rumor: 0, riesgo: 1, rc: -1, rt: 0, rtb: 0,
      riesgoTxt: "Agua y fiebres: otro −1 de cuerpo", desc: "Gratis y sin rondas, pero al raso: −1 de cuerpo, y con 1 en el dado de noche, fiebres (otro −1). Mañana amaneces fuera de la muralla." },
    { id: "meson", nombre: "Mesón", lado: "dentro", coste: 2, c: 0, t: 0, tb: 0, rumor: 1, riesgo: 0, rc: 0, rt: 0, rtb: 0,
      costePan: true, riesgoTxt: "", desc: "Cuesta una ración de pan más 2 monedas. Duermes bajo techo (no pierdes cuerpo) y oyes un rumor (+1)." },
    { id: "hospital", nombre: "Hospital", lado: "dentro", coste: 0, c: 2, t: -1, tb: 0, rumor: 0, riesgo: 0, rc: 0, rt: 0, rtb: 0,
      riesgoTxt: "", desc: "Gratis. Solo admiten enfermos (cuerpo 5 o menos). +2 de cuerpo, pero te apuntan en el libro (−1). A la tercera vez que te apuntan, o si entras con cuerpo 2 o menos, te recogen." },
    { id: "red", nombre: "Con alguien de tu red", lado: "ambos", coste: 0, c: 0, t: 0, tb: 0, rumor: 0, riesgo: 0, rc: 0, rt: 0, rtb: 0,
      riesgoTxt: "", desc: "Gratis. Duermes bajo techo (no pierdes cuerpo) y nadie te ve. Necesitas relación 2 o más con alguien que viva de tu lado de la muralla." },
    { id: "carcel", nombre: "Cárcel", lado: "ambos", coste: 0, c: 0, t: 0, tb: 0, rumor: 0, riesgo: 0, rc: 0, rt: 0, rtb: 0,
      riesgoTxt: "", desc: "Te han detenido." },
  ];

  const CLASIF = { "-3": "Recogido", "-2": "En la lista", "-1": "Pobre conocido", "0": "Desconocido", "1": "Sospechoso", "2": "Vagabundo", "3": "Reincidente" };

  const MOVIMIENTOS = ["Ronda", "Interrogatorio", "Cerrar la puerta", "Pregón", "Examen general", "Limosna pública"];
  const MOV_DESC = {
    "Ronda": "Manda una ronda donde más te vieron: durante dos días, el resultado más bajo del dado de testigo de ese sitio pasa a ser «Alguacil». Las rondas se acumulan.",
    "Interrogatorio": "Detiene a alguien de tu red y le pregunta por ti. Si ese día te juntaste con alguien, va a por esa persona. Si vuestra relación es baja, te vende (Te buscan +2). Si aguanta, se lo llevan dos días.",
    "Cerrar la puerta": "Mañana no se entra en la ciudad desde fuera, salvo los de la lista.",
    "Pregón": "Pregona una norma nueva para los próximos días.",
    "Examen general": "Mañana el cura examina a todos los de la lista: pueden salir de ella.",
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

  // Sucesos del amanecer (uno al día desde el día 2). La hoja los elige al azar.
  const SUCESOS = [
    { id: "fiebres", titulo: "Fiebres", txt: "Hay fiebres entre los que duermen al raso." },
    { id: "tormenta", titulo: "Tormenta de verano", txt: "Se espera tormenta: esta noche, dormir al raso cuesta 1 de cuerpo más." },
    { id: "pan", titulo: "Escasea el trigo", txt: "Hoy el pan cuesta 1 moneda más." },
    { id: "redada", titulo: "Redada", txt: "Los alguaciles baten la ciudad: hoy, en todos los sitios, el 1 del dado de testigo es alguacil." },
    { id: "cofradia", titulo: "Pan de cofradía", txt: "Una cofradía reparte pan a la puerta de las iglesias." },
    { id: "muerte", titulo: "Un muerto en la ribera", txt: "Amanece un pobre muerto junto a la ribera." },
    { id: "forasteros", titulo: "Llegan más pobres", txt: "Llegan pobres de los pueblos tras la mala cosecha: hoy los rivales te delatan con 1-3." },
    { id: "nada", titulo: "Día sin novedad", txt: "Nada fuera de lo corriente." },
  ];

  const NOMBRES = ["Perico el Tuerto", "Juana la Ronca", "Martín de Toro", "Catalina la del puente", "Antón el Mellado",
    "María la Rubia", "Diego el Zurdo", "Inés de Zamora", "Pedro el Navarro", "Lucía la Viuda", "Bartolo el Cojo",
    "Francisca la Morena", "Gil el Romero", "Teresa la Larga", "Alonso el Pelado", "Ana de Ledesma"];

  const AYUDA = [
    ["De qué va", "Eres un pobre en Salamanca, en junio de 1545. La autoridad acaba de decidir quién merece limosna y quién es un vagabundo. Tienes que llegar vivo al día 10 sin que te ahorquen, sin morir de hambre y sin que te encierren. Nadie sale de pobre."],
    ["El día", "Cada día tiene un amanecer, cinco franjas (prima, tercia, sexta, nona y vísperas), la noche y el turno de la autoridad. En cada franja eliges un sitio y una acción."],
    ["Cuerpo y dados", "El cuerpo (0 a 10) es tu salud. Cada mañana decide cuántos dados tiras: 9-10, cinco; 7-8, cuatro; 5-6, tres; 3-4, dos; 1-2, uno. Cada acción gasta un dado y su valor es lo bien que te sale. Tú eliges qué dado va a cada acción. A 0 de cuerpo, mueres."],
    ["Comer", "Cada noche comes una ración (la viuda, dos). Si te falta, pierdes 2 de cuerpo por ración. El pan se compra de noche y sube de precio cada pocos días. Solo puedes guardar 2 raciones de una noche a otra: el resto se pone duro o te lo quitan, así que lo que te sobre, mejor compártelo."],
    ["Dormir al raso", "Dormir en un pórtico o en el arrabal es gratis, pero cuesta 1 de cuerpo cada noche. Bajo techo (mesón, alguien de tu red) no pierdes cuerpo, pero tampoco recuperas: para eso hay que descansar o ir al hospital."],
    ["Dinero", "Un pobre con dinero es sospechoso. Si llevas más de 4 monedas y te ven pedir un alguacil o la beneficencia, te tienen por fingidor (+1). Si duermes al raso con más de 4, te pueden robar la mitad y pegarte (−1 de cuerpo). Si te detienen, te lo quitan todo."],
    ["Testigos", "Cada acción tira un dado de testigo: decide quién te ve. Vecinos, otros pobres, la beneficencia, frailes o alguaciles. Cada uno te mira a su manera y eso mueve tu termómetro."],
    ["Termómetro", "Cómo te clasifica la autoridad, de −3 a +3. Hacia arriba: sospechoso, vagabundo y reincidente (+3, solo si ya te han detenido antes). Hacia abajo: pobre conocido, en la lista y, al final, recogido (te encierran en una institución y la partida acaba). Fuera de la lista no bajas de −1. El termómetro no mata solo: decide el castigo si te detienen."],
    ["La lista de pobres", "La orden de pobres prohíbe pedir y mantiene a los pobres examinados. Solo entran los naturales: el cura examina en tu parroquia a tercia y hace falta un dado bueno. En la lista no se pide. Cada día que cumplas con la parroquia (cualquier dado sirve), esa noche te dan una ración: la tuya, el niño no cuenta. Si te ven pedir la beneficencia, el cura o un alguacil, te borran: esa noche no hay ración y para volver hay que pasar otro examen. Los frailes no denuncian a nadie, ni en la sopa del convento. El examen general de la autoridad también puede sacarte."],
    ["Tu hijo (viuda)", "La viuda va con su hijo. Con él al lado, la limosna en moneda rinde +2 (si lo dejas con alguien, no). Tiene su propio cuerpo (0 a 5) y come cada noche: si no hay pan para los dos, eliges quién come. Bajo techo y comido se recupera; las tormentas y las fiebres le afectan aparte. Si está muy débil (1 o menos) y estás dentro de la muralla, el cura se lo lleva a los niños de la doctrina, salvo que alguien de tu red (relación 2 o más) lo esconda. Si te detienen, se lo llevan, salvo que alguien de tu red se quede con él. Al amanecer puedes dejarlo con alguien de tu red: cada noche le das una ración o su precio, y si no puedes, la relación baja. Si interrogan a quien lo cuida, lo pierdes."],
    ["Te buscan", "Cuando llega a 6, te detienen. El castigo depende del termómetro: con 0 o menos, reprensión; con +1, azotes; con +2, trabajo forzado o marca; con +3, la horca. Después, ya te conocen: «Te buscan» empieza en el número de veces que te han detenido (hasta 3)."],
    ["La autoridad", "Cada noche juega según lo que vio: manda rondas a donde más te vieron, interroga a tu gente (primero, a quien estuvo contigo ese día), cierra la puerta, pregona normas, examina a los pobres o reparte limosna pública. Desde el pregón de expulsión (día 3) aprieta más: un movimiento extra cada noche, te vea o no. Lo que hace lo ves al amanecer."],
    ["Sucesos", "Cada amanecer pasa algo en la ciudad: fiebres, tormentas, subidas del pan, redadas, repartos de pan o muertes. No los controlas."],
    ["Fingir", "Al amanecer puedes gastar un dado en preparar una treta (llagas, ceguera, falso peregrino…). Ese dado es su calidad para todo el día: te dan más y te tienen por impedido, pero si te examina la beneficencia o el cura y su dado iguala tu calidad, te descubren."],
    ["Red y rumores", "Puedes juntarte con otros pobres (cualquier dado sirve) o compartir con ellos. Con relación 2 puedes dormir con alguien, te encubre si te ve robar y no mueres solo. Con relación 3, si te falta pan, te da una ración. Pero juntarse se ve: quien estuvo contigo queda señalado esa noche. Si la autoridad interroga, va a por esa persona, y si os vio un alguacil, la interroga seguro. Con relación baja, te vende; si aguanta, se la llevan dos días. Las relaciones nuevas son las que más venden. Además te pedirán comida, enfermarán, desaparecerán o morirán: una red de una sola persona no aguanta. Un rumor sirve para repetir un dado de testigo."],
    ["La muralla", "El puente y el arrabal están fuera. Si duermes fuera, para entrar tienes que cruzar la puerta, donde la guardia vigila a los forasteros. Si la autoridad cierra la puerta, te quedas fuera, salvo que estés en la lista."],
  ];

  const RULES = {
    version: "0.4b", CONFIG, FRANJAS, FRANJA_DESC, SITIOS, TESTIGOS, CATEGORIA, TESTIGO_DESC, CATS, EFECTOS, ACCIONES, COD_ACC,
    PARAMS, PEDIR_DADO, HURTAR_DADO, DADOS_CUERPO, CALENDARIO, MODS, PERSONAJES, TRETAS, DORMIR, CLASIF,
    MOVIMIENTOS, MOV_DESC, PREGONES, NOMBRES, AYUDA, SUCESOS,
  };
  root.RULES = RULES;
  if (typeof module !== "undefined" && module.exports) module.exports = RULES;
})(typeof window !== "undefined" ? window : globalThis);
