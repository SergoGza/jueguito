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
      id: "orilla", nombre: "Orilla del Tormes", corto: "Orilla", barrio: "ribera", dentro: false, x: 252, y: 266,
      gente: [1, 1, 1, 1, 1, 1], pobres: 0, aviso: 0, quien: "gente de paso",
      desc: "El camino que va por fuera de la muralla, junto al río, del puente a la Puerta de San Pablo. Pasan arrieros, lavanderas y pobres. Aquí no hay donde echarse a dormir.",
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
      desc: "La plaza del mercado. Mucha gente por la mañana.",
    },
    {
      id: "sanpablo", nombre: "Calle de San Pablo", corto: "San Pablo", barrio: "sanesteban", dentro: true, x: 286, y: 92,
      gente: [1, 2, 1, 2, 2, 1], pobres: 0.1, aviso: 1, quien: "vecinos",
      desc: "Calle tranquila entre la plaza y el convento de San Esteban.",
    },
    {
      id: "sanpolo", nombre: "Puerta de San Pablo", corto: "Pta. S. Pablo", barrio: "sanesteban", dentro: true, x: 318, y: 238,
      gente: [1, 1, 1, 1, 1, 1], pobres: 0, aviso: 0, quien: "carros y gente de paso",
      desc: "La otra puerta de la muralla del lado del río, aguas abajo del puente, junto a San Esteban. Sus guardas miran los carros por lo que pagan, no a los pobres. Al acabar completas, la cierran.",
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
    // la segunda puerta (j0.8): del puente, por la orilla, a la Puerta de San Pablo y San Esteban
    ["puente", "orilla"], ["orilla", "sanpolo"], ["sanpolo", "sanesteban"],
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

  // Varios veranos (j0.11; se activa al empezar, con los tuyos). Salamanca juega los años que cuentan:
  // 1545 la orden, 1552 las galeras, 1557 el hambre. Calendario juliano: en 1552 y 1557 el Corpus cae después
  // del día 10 (16 y 17 de junio) y el domingo es el de Pentecostés.
  //  galeras: una detención manda a galeras a los hombres (pragmática de 1552; sigue en vigor después).
  //  escasezDesde: desde qué día la gente da menos (si no está, PARAMS.escasezDesde).
  const VERANOS = [
    { anio: 1545, calendario: CALENDARIO },
    {
      anio: 1552, galeras: true,
      calendario: [
        { dia: 1, fecha: "miércoles 1 de junio", tipo: "laborable" },
        { dia: 2, fecha: "jueves 2 de junio", tipo: "laborable" },
        { dia: 3, fecha: "viernes 3 de junio", tipo: "laborable" },
        { dia: 4, fecha: "sábado 4 de junio", tipo: "laborable" },
        { dia: 5, fecha: "domingo 5 de junio", tipo: "domingo", fiesta: "Pentecostés" },
        { dia: 6, fecha: "lunes 6 de junio", tipo: "laborable" },
        { dia: 7, fecha: "martes 7 de junio", tipo: "laborable" },
        { dia: 8, fecha: "miércoles 8 de junio", tipo: "laborable" },
        { dia: 9, fecha: "jueves 9 de junio", tipo: "laborable" },
        { dia: 10, fecha: "viernes 10 de junio", tipo: "laborable" },
      ],
    },
    {
      anio: 1557, galeras: true, escasezDesde: 1,
      calendario: [
        { dia: 1, fecha: "martes 1 de junio", tipo: "laborable" },
        { dia: 2, fecha: "miércoles 2 de junio", tipo: "laborable" },
        { dia: 3, fecha: "jueves 3 de junio", tipo: "laborable" },
        { dia: 4, fecha: "viernes 4 de junio", tipo: "laborable" },
        { dia: 5, fecha: "sábado 5 de junio", tipo: "laborable" },
        { dia: 6, fecha: "domingo 6 de junio", tipo: "domingo", fiesta: "Pentecostés" },
        { dia: 7, fecha: "lunes 7 de junio", tipo: "laborable" },
        { dia: 8, fecha: "martes 8 de junio", tipo: "laborable" },
        { dia: 9, fecha: "miércoles 9 de junio", tipo: "laborable" },
        { dia: 10, fecha: "jueves 10 de junio", tipo: "laborable" },
      ],
    },
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
  // Sus costumbres cambian cada verano (cada partida), con la semilla (j0.9). El esqueleto es fijo y sale del mundo:
  // por la mañana (prima y tercia) anda donde hay mercado o misa; a sexta come; a nona y a vísperas, donde hay gente;
  // al anochecer cierra una de las dos puertas; el Corpus acompaña la procesión. Lo que cambia es el sitio concreto.
  // Se desvía al azar a veces; y si alguien ha avisado, va allí.
  const RONDA = {
    costumbres: {
      manana: ["plaza", "catedral", "sanmartin"],
      nona: ["escuelas", "rua", "catedral", "plaza"],
      visperas: ["rua", "catedral", "plaza"],
      cierra: ["puerta", "sanpolo"],
    },
    circuitoCorpus: ["plaza", "rua", "rua", "rua", "plaza", null], // acompaña la procesión; a completas, la puerta que cierre ese verano
    circuitoAntiguo: ["plaza", "plaza", null, "escuelas", "rua", "puerta"], // el fijo hasta la j0.8 (para partidas empezadas antes)
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
    // los tuyos (j0.10; se activan al empezar): dos que bajaron contigo de La Armuña y viven con tus mismas reglas.
    // De noche, en la ribera, te cuentan lo que vieron y, si no han sacado para cenar, te piden pan.
    // Si pasan hambre y les niegas pan teniéndolo, pueden malsinarte (Soto, 1545). Nada de esto se explica: lo dicen ellos.
    tuyos: {
      quienes: [
        // pideMax: veces que pide al día como mucho
        { id: "pedro", nombre: "Pedro", manera: "prudente", el: true, pideMax: 2 },       // pide poco y se recoge pronto: ve poco
        { id: "catalina", nombre: "Catalina", manera: "arriesgada", el: false, pideMax: 3 }, // no pide dos franjas seguidas: recorre la ciudad, ve mucho, le pillan
      ],
      cuerpo: 4, pan: 1,
      quieto: 0,          // con el cuerpo así o menos no sale de la ribera (0: siempre sale)
      oidas: 0.25,        // cada noche, probabilidad de contar algo que le han dicho
      oidasCierto: 2 / 3, // y de que sea verdad
      trato: "malsinar",  // si les niegas pan: «malsinar» (decidido) o «confianza» (para comparar con bots)
      malsinarCuerpo: 6,  // al negarle pan teniéndolo, con el cuerpo así o menos (6: siempre que te pide): la primera vez avisa; después, puede venderte
      malsinar: 0.5,      // probabilidad de que vaya al alguacil a la mañana siguiente, ya avisado
      // palancas apagadas (medidas con bots el 1 de noviembre; Sergio eligió no darles nada a cambio dentro del verano):
      trueque: false,     // si es true, la noche que te pide pan solo te cuenta lo que vio si le das
      pide: 2,            // lo que pide como mucho: lo que le falta para una ración (2) o media (1)
      devuelve: false,    // si es true, el que te debe pan te da un pedazo la noche que no tienes para cenar, o te lo lleva a la cárcel
      confianza: { inicial: 2, max: 3 }, // trato «confianza»: con 1, cuenta la mitad; con 0, nada
    },
    // varios veranos (j0.11). La cadena dura lo que dure tu gente: si mueres con uno de los tuyos durmiendo a tu lado,
    // sigues como él el verano siguiente; si mueres solo, se acaba. El destierro y las galeras no son morir: sigue uno
    // de los tuyos, el que elijas. Entre verano y verano la cara se olvida y las detenciones quedan (los azotes se ven
    // en la espalda). Con la cadena, los rasgos de hombre y mujer. Nada de esto se explica: lo dice el mundo.
    cadena: {
      // con qué empiezas el verano siguiente según la siega (hoz, espigar o nada); a medir con bots
      inicio: { hoz: { cuerpo: 5, pan: 2 }, espiga: { cuerpo: 4, pan: 1 }, nada: { cuerpo: 3, pan: 0 } },
      // la ronda cambia sus costumbres según dónde te vio pedir y por qué puerta pasabas: cada día visto suma esto
      // al peso de ese sitio (cada sitio pesa 1 de partida)
      reaccion: 0.5,
      // el hombre al que la ronda para por la calle sin conocerle, con el cuerpo así o más, va a las obras sin paga
      // hasta la noche (Briviesca, 1387: servir sin soldada). La mujer no va a las obras y en la siega espiga; la ronda,
      // si la para por la calle, solo la echa, aunque la conozca. Pedir delante de la ronda y la noche, igual.
      obrasForzadas: 5,
    },
  };

  const LICENCIAS = [
    "La ronda, sus costumbres y que coma a sexta son invención del juego.",
    "Que en San Esteban nadie avise a la ronda sale de que Soto, su prior, escribió contra la orden; no hay documento que lo diga.",
    "La limosna se da en pan (pedazos) y no en dinero, para no meter el mercado en esta prueba.",
    "La siega empieza el 11 de junio; en Castilla solía empezar a finales de junio o en julio.",
    "La Puerta de San Pablo existió, del lado del río y al este del puente; que sus guardas no avisen a la ronda es del juego. Había más puertas, que el juego deja fuera.",
    "Las cifras (gente, limosna, probabilidades) son del juego.",
  ];
  // solo con «Jugar varios veranos»
  const LICENCIAS_CADENA = [
    "Las galeras son de la pragmática de 1552 (el vagabundo sano de más de veinte años, cuatro años de galeras en lugar de azotes). En el juego, todos los hombres pasan de veinte y basta una detención.",
    "El pan caro de 1557 sale de la crisis de grano de 1557-1558; que la gente dé menos desde el 1 de junio es del juego.",
    "Que el alguacil mande a las obras sin paga al mozo sano que para por la calle sale de una ley más vieja (Briviesca, 1387: servir sin soldada); en Salamanca es del juego.",
    "Que a la mujer la ronda solo la eche cuando la para por la calle es del juego. No había galeras para mujeres.",
    "Entre un verano y otro, lo que pasa en el invierno se resume en cómo llegas: con hoz, espigando o sin nada.",
  ];

  window.RULES = {
    version: "j0.11", CONFIG, FRANJAS, RATOS, DIAS, MODOS, BARRIOS, LUGARES, CAMINOS, CALENDARIO, VERANOS, DIAS_SENALADOS,
    RONDA, PARAMS, LICENCIAS, LICENCIAS_CADENA,
    // la mesa de los agentes pregunta por PERSONAJES: en el juguete, cada «personaje» es una prueba
    PERSONAJES: [
      { id: "A", nombre: "Mozo de La Armuña", origen: "Forastero", cuerpoTipo: "Válido", resumen: MODOS.A.resumen, claves: ["Prueba A · calles"] },
      { id: "B", nombre: "Mozo de La Armuña", origen: "Forastero", cuerpoTipo: "Válido", resumen: MODOS.B.resumen, claves: ["Prueba B · barrios"] },
    ],
  };
})();
