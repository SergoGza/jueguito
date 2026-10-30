/* Liber Vagatorum · el juguete (prueba mínima del núcleo).
 * Todas las reglas y cifras están aquí. El motor (engine.js) las lee sin tocar nada más.
 * Cada vez que cambies algo, sube `version` aquí y `VERSION` en sw.js, o los móviles seguirán con la copia vieja. */
(function () {
  const CONFIG = {
    email: "sergiogza0@gmail.com", // a donde van los informes (en GitHub Pages queda a la vista)
    // A (calles) es el núcleo desde el 30 de octubre de 2026. B (barrios) queda en el código: se juega con ?prueba=B.
    pruebas: ["A"],
  };

  // El día: seis horas canónicas. Cada franja son 6 ratos.
  const FRANJAS = [
    { id: "prima", nombre: "Prima", hora: "al salir el sol" },
    { id: "tercia", nombre: "Tercia", hora: "media mañana" },
    { id: "sexta", nombre: "Sexta", hora: "mediodía" },
    { id: "nona", nombre: "Nona", hora: "media tarde" },
    { id: "visperas", nombre: "Vísperas", hora: "caída de la tarde" },
    { id: "completas", nombre: "Completas", hora: "anochecer" },
  ];
  const RATOS = 6; // ratos por franja
  const DIAS = 10;

  // Las dos pruebas. Todo lo demás es igual: sitios, gente, ronda, pan.
  //  zona: lo que ves y lo que ve la ronda. «lugar» = solo el sitio donde estás; «barrio» = todo tu barrio.
  //  paso: ratos por moverte a un sitio vecino (A). cruce: ratos por pasar a un barrio vecino (B); dentro del barrio, gratis.
  const MODOS = {
    A: {
      id: "A", nombre: "Prueba A · calles", zona: "lugar", paso: 2, cruce: null,
      resumen: "Muchos sitios. Cada paso a un sitio vecino cuesta 2 ratos (3 pasos, una franja). Solo ves el sitio donde estás.",
    },
    B: {
      id: "B", nombre: "Prueba B · barrios", zona: "barrio", paso: null, cruce: 6,
      resumen: "Pocos barrios. Dentro de tu barrio te mueves sin gastar tiempo y lo ves entero; pasar a otro barrio cuesta una franja.",
    },
  };

  const BARRIOS = [
    { id: "ribera", nombre: "La ribera", dentro: false },
    { id: "catedral", nombre: "Barrio de la Catedral", dentro: true },
    { id: "rua", nombre: "La Rúa", dentro: true },
    { id: "sanesteban", nombre: "San Esteban", dentro: true },
  ];

  // gente[franja]: 0 nadie · 1 nadie que dé (solo pobres o gente de paso) · 2 poca · 3 mucha.
  // pobres: probabilidad de que haya otros pobres pidiendo (os repartís lo que hay: cuenta como un nivel menos de gente).
  // aviso: cuánto se queja la gente si te ve pedir (la ronda va luego donde hay quejas). 0 = nadie avisa.
  // x, y: posición en el mapa (viewBox 360 × 320).
  const LUGARES = [
    {
      id: "ribera", nombre: "Ribera del Tormes", corto: "Ribera", barrio: "ribera", dentro: false, x: 62, y: 262,
      gente: [1, 1, 1, 1, 1, 1], pobres: 0, aviso: 0, quien: "solo pobres",
      desc: "Donde duermes, entre los juncos y las aceñas. Aquí solo hay pobres: nadie te da. La ronda no baja.",
    },
    {
      id: "puente", nombre: "Puente romano", corto: "Puente", barrio: "ribera", dentro: false, x: 180, y: 280,
      gente: [1, 1, 1, 1, 1, 1], pobres: 0, aviso: 0, quien: "gente de paso",
      desc: "El puente, con el toro de piedra a la entrada. Pasan arrieros y viajeros, pero van de camino y no dan. De noche no se puede dormir aquí.",
    },
    {
      id: "puerta", nombre: "Puerta del Río", corto: "Puerta", barrio: "catedral", dentro: true, x: 180, y: 232,
      gente: [2, 2, 1, 1, 2, 1], pobres: 0.2, aviso: 2, quien: "gente que entra y sale",
      desc: "La puerta de la muralla que da al puente. El portero mira a quien entra y a quien sale, y avisa. Al acabar completas, la cierran.",
    },
    {
      id: "catedral", nombre: "Catedral y obras", corto: "Catedral", barrio: "catedral", dentro: true, x: 118, y: 182,
      gente: [3, 2, 1, 2, 3, 1], pobres: 0.4, aviso: 1, quien: "fieles y canónigos", trabajo: true,
      desc: "La catedral vieja y, pegadas, las obras de la nueva. Misa a prima y oficio a vísperas. Las obras cogen peones a prima, los días de trabajo: quien duerme fuera de la muralla no llega a tiempo.",
    },
    {
      id: "escuelas", nombre: "Escuelas Mayores", corto: "Escuelas", barrio: "catedral", dentro: true, x: 218, y: 176,
      gente: [2, 3, 1, 3, 2, 1], pobres: 0.2, aviso: 2, quien: "estudiantes",
      desc: "La universidad. Los estudiantes salen entre lección y lección (tercia y nona). El bedel avisa a la ronda.",
    },
    {
      id: "rua", nombre: "Rúa Mayor", corto: "Rúa", barrio: "rua", dentro: true, x: 140, y: 120,
      gente: [2, 2, 1, 2, 3, 1], pobres: 0.2, aviso: 1, quien: "vecinos y paseantes",
      desc: "La calle principal, de la catedral a la plaza. Siempre pasa alguien; a vísperas, la gente sale a pasear.",
    },
    {
      id: "sanmartin", nombre: "Iglesia de San Martín", corto: "San Martín", barrio: "rua", dentro: true, x: 74, y: 66,
      gente: [3, 2, 1, 1, 2, 1], pobres: 0.3, aviso: 2, quien: "parroquianos",
      desc: "La parroquia junto a la plaza. Misa a prima. El cura lleva la cuenta de sus pobres y avisa si ve a uno de fuera.",
    },
    {
      id: "plaza", nombre: "Plaza de San Martín", corto: "Plaza", barrio: "rua", dentro: true, x: 172, y: 50,
      gente: [3, 3, 2, 2, 2, 1], pobres: 0.4, aviso: 1, quien: "compradores y vendedores",
      desc: "La plaza del mercado. Mucha gente por la mañana, y la ronda pasa a menudo.",
    },
    {
      id: "sanpablo", nombre: "Calle de San Pablo", corto: "San Pablo", barrio: "sanesteban", dentro: true, x: 286, y: 92,
      gente: [1, 2, 1, 2, 2, 1], pobres: 0.1, aviso: 1, quien: "vecinos",
      desc: "Calle tranquila entre la plaza y el convento de San Esteban.",
    },
    {
      id: "sanesteban", nombre: "Convento de San Esteban", corto: "S. Esteban", barrio: "sanesteban", dentro: true, x: 300, y: 196,
      gente: [2, 1, 1, 1, 2, 1], pobres: 0.5, aviso: 0, quien: "frailes y devotos",
      desc: "El convento de los dominicos. Su prior, fray Domingo de Soto, ha escrito contra la orden de pobres: aquí nadie avisa a la ronda. Pero acuden muchos pobres.",
    },
  ];

  // Caminos entre sitios (prueba A). En la prueba B, dos barrios son vecinos si hay un camino entre ellos.
  const CAMINOS = [
    ["ribera", "puente"], ["puente", "puerta"], ["puerta", "catedral"], ["catedral", "escuelas"],
    ["catedral", "rua"], ["rua", "sanmartin"], ["rua", "plaza"], ["sanmartin", "plaza"],
    ["escuelas", "sanesteban"], ["sanesteban", "sanpablo"], ["sanpablo", "plaza"],
  ];

  // Junio de 1545 (calendario juliano): el 1 fue lunes y el 4, jueves de Corpus Christi.
  const CALENDARIO = [
    { dia: 1, fecha: "lunes 1 de junio", tipo: "laborable" },
    { dia: 2, fecha: "martes 2 de junio", tipo: "laborable" },
    { dia: 3, fecha: "miércoles 3 de junio", tipo: "laborable" },
    { dia: 4, fecha: "jueves 4 de junio", tipo: "corpus", fiesta: "Corpus Christi" },
    { dia: 5, fecha: "viernes 5 de junio", tipo: "laborable" },
    { dia: 6, fecha: "sábado 6 de junio", tipo: "laborable" },
    { dia: 7, fecha: "domingo 7 de junio", tipo: "domingo", fiesta: "Domingo" },
    { dia: 8, fecha: "lunes 8 de junio", tipo: "laborable" },
    { dia: 9, fecha: "martes 9 de junio", tipo: "laborable" },
    { dia: 10, fecha: "miércoles 10 de junio", tipo: "laborable" },
  ];

  // Cambios de gente en los días señalados: { tipo: { lugar: { franja: nivel } } }
  const DIAS_SENALADOS = {
    domingo: {
      catedral: { 0: 3, 1: 3 }, sanmartin: { 0: 3, 1: 3 }, sanesteban: { 1: 2 },
      plaza: { 0: 2, 1: 2, 2: 1 }, escuelas: { 1: 1, 3: 1 },
    },
    corpus: {
      catedral: { 0: 3, 1: 3, 2: 3 }, rua: { 1: 3, 2: 3 }, plaza: { 1: 3, 2: 3 },
      sanmartin: { 0: 3 }, escuelas: { 1: 1, 3: 1 },
    },
  };

  // La ronda: un alguacil y sus corchetes. Está en un sitio cada franja (o en ninguno).
  // circuito: dónde suele estar (null: está comiendo). Se desvía al azar a veces; y si alguien ha avisado, va allí.
  const RONDA = {
    circuito: ["plaza", "plaza", null, "escuelas", "rua", "puerta"],
    circuitoCorpus: ["plaza", "rua", "rua", "rua", "plaza", "puerta"], // acompaña la procesión
    desvio: 0.3,     // probabilidad de ir a otro sitio de dentro al azar (si nadie ha avisado)
    persigue: [0, 0.4, 0.8, 0.9], // probabilidad de ir donde hay quejas, según cuántas (0, 1, 2, 3 o más)
    // la ronda aprende tus costumbres: si te han visto pedir en el mismo sitio a la misma hora en minDias días
    // distintos (donde alguien avisa), desde entonces suele ir allí a esa hora. No se explica: lo dice el alguacil.
    aprende: { minDias: 2, prob: 0.6 },
  };

  const PARAMS = {
    cuerpoInicial: 4, cuerpoMax: 6, panInicial: 1, panMax: 4,
    // pedir: lo que te dan según la gente que de verdad da (tras restar los otros pobres), por tirada de 1 a 6
    limosna: { 2: [0, 0, 1, 1, 1, 2], 3: [0, 1, 1, 2, 2, 3] },
    // antes de la siega el pan sube y la gente da menos: desde este día, la tabla de escasez
    escasezDesde: 6,
    limosnaEscasez: { 2: [0, 0, 0, 1, 1, 2], 3: [0, 1, 1, 1, 2, 2] },
    // la ronda te ve pedir: con mucha gente, a veces no; con poca, siempre
    pillarPidiendo: { 2: 1, 3: 0.5 },
    // llegas a donde está la ronda: probabilidad de que te paren
    pararAlLlegar: { desconocido: 1 / 4, conocido: 1 / 3 },
    // dormir dentro de la muralla (en un portal): la ronda de noche
    // dormir dentro de la muralla: la ronda de noche va donde hubo quejas (de ti o de otros pobres)
    //  vigilada: hoy te vieron pedir en tu sitio (A) o en tu barrio (B)
    //  pobres: hoy hubo otros pobres pidiendo ahí en 2 franjas o más (lo sabes solo si lo viste)
    //  tranquila: lo demás. Cada par: [sin fichar, fichado]
    nocheDentro: { vigilada: [1 / 3, 1 / 2], pobres: [1 / 6, 1 / 4], tranquila: [1 / 12, 1 / 8] },
    nochePobresFranjas: 2,
    // obras: cogen peones a prima, los días de trabajo
    trabajo: { pedirRatos: 1, probPorCuerpo: { 6: 0.5, 5: 0.5, 4: 0.5, 3: 0.25 }, hasta: 4, paga: 2, cansancio: 1 },
    // cena: pedazos de pan que comes → cambio de cuerpo
    cena: { 2: 1, 1: -1, 0: -2 },
    carcel: { cuerpo: -1, azotes: -1 }, // la segunda detención trae azotes; la tercera, destierro
    detencionesMax: 3,
    // la siega empieza al acabar el último día: cogen segadores según el cuerpo (no se dice la cifra; se aprende)
    siega: { probPorCuerpo: { 6: 1, 5: 1, 4: 1, 3: 0.5 } },
    // la llaga (fingir): una vez, de noche en la ribera, y para siempre. Más limosna y el alguacil no te pregunta
    // (Robles: al que ve con una llaga «no le puede preguntar más»); pero ni las obras ni el mayoral te cogen.
    // Nada de esto se explica: lo dicen el viejo de la ribera, el capataz, el alguacil y el mayoral.
    llaga: {
      limosna: 1,   // la tirada de limosna (1 a 6) sube tantos puntos
      cuerpo: -1,   // la noche que te la haces: fiebre
      cuerpoMax: 5, // desde entonces el cuerpo no pasa de aquí
      encona: 1 / 3, // cada noche siguiente, probabilidad de que se encone (−1 de cuerpo): cuanto antes, más noches
      parar: 0,     // multiplica la probabilidad de que la ronda te pare al llegar, mientras dure la protección
      protege: 3,   // cuántas veces te deja pasar el alguacil por la llaga; luego te reconoce (0: siempre)
      pillar: 1,    // multiplica la de que te vea pidiendo (pedir sigue prohibido)
      noche: 1,     // multiplica la de la ronda de noche
    },
  };

  const LICENCIAS = [
    "La ronda, su recorrido y que coma a sexta son invención del juego.",
    "Que en San Esteban nadie avise a la ronda sale de que Soto, su prior, escribió contra la orden; no hay documento que lo diga.",
    "La limosna se da en pan (pedazos) y no en dinero, para no meter el mercado en esta prueba.",
    "La siega empieza el 11 de junio; en Castilla solía empezar a finales de junio o en julio.",
    "Las cifras (gente, limosna, probabilidades) son del juego.",
  ];

  window.RULES = {
    version: "j0.7.1", CONFIG, FRANJAS, RATOS, DIAS, MODOS, BARRIOS, LUGARES, CAMINOS, CALENDARIO, DIAS_SENALADOS,
    RONDA, PARAMS, LICENCIAS,
    // la mesa de los agentes pregunta por PERSONAJES: en el juguete, cada «personaje» es una prueba
    PERSONAJES: [
      { id: "A", nombre: "Mozo de La Armuña", origen: "Forastero", cuerpoTipo: "Válido", resumen: MODOS.A.resumen, claves: ["Prueba A · calles"] },
      { id: "B", nombre: "Mozo de La Armuña", origen: "Forastero", cuerpoTipo: "Válido", resumen: MODOS.B.resumen, claves: ["Prueba B · barrios"] },
    ],
  };
})();
