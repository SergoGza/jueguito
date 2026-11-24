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
      // j0.13: en junio de 1545 Soto ya no está en Salamanca: en mayo salió hacia Trento (cada verano tiene su texto, en VERANOS)
      desc: "El convento de los dominicos. Su prior, fray Domingo de Soto, escribió contra la orden de pobres y se ha ido al concilio: aquí nadie avisa a la ronda. Pero acuden muchos pobres.",
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
  // 1545 la orden, 1553 las galeras, 1557 el hambre. Calendario juliano: en 1553 el Corpus cae el día 1 (jueves) y en
  // 1557 después del día 10 (el 17), y el domingo de 1557 es el de Pentecostés.
  // j0.13: el verano de las galeras pasa de 1552 a 1553. La pragmática se dio en Monzón el 25 de noviembre de 1552 y se
  // pregonó en la Corte el 3 de diciembre: en junio de 1552 aún no regía (decidido por Sergio el 20 de noviembre de 2026).
  //  galeras: una detención manda a galeras a los hombres (pragmática de 1552; sigue en vigor después).
  //  escasezDesde: desde qué día la gente da menos (si no está, PARAMS.escasezDesde).
  //  desc: el texto de algún sitio que cambia ese verano.
  // En el calendario, mercado: true es jueves de mercado en la plaza (j0.13; ver DIAS_SENALADOS). Si cae en Corpus,
  // no hay mercado: es fiesta (en 1545, el único jueves es el Corpus).
  const SOTO_VUELTO = "El convento de los dominicos. Fray Domingo de Soto, que escribió contra la orden de pobres, volvió del concilio hace años: aquí nadie avisa a la ronda. Pero acuden muchos pobres.";
  const VERANOS = [
    { anio: 1545, calendario: CALENDARIO },
    {
      anio: 1553, galeras: true,
      // Soto volvió a España en enero de 1550 y en septiembre de 1552 ganó la cátedra de prima
      desc: { sanesteban: "El convento de los dominicos. Fray Domingo de Soto, que escribió contra la orden de pobres, volvió del concilio y lee prima en las Escuelas: aquí nadie avisa a la ronda. Pero acuden muchos pobres." },
      calendario: [
        { dia: 1, fecha: "jueves 1 de junio", tipo: "corpus", fiesta: "Corpus Christi" },
        { dia: 2, fecha: "viernes 2 de junio", tipo: "laborable" },
        { dia: 3, fecha: "sábado 3 de junio", tipo: "laborable" },
        { dia: 4, fecha: "domingo 4 de junio", tipo: "domingo", fiesta: "Domingo" },
        { dia: 5, fecha: "lunes 5 de junio", tipo: "laborable" },
        { dia: 6, fecha: "martes 6 de junio", tipo: "laborable" },
        { dia: 7, fecha: "miércoles 7 de junio", tipo: "laborable" },
        { dia: 8, fecha: "jueves 8 de junio", tipo: "laborable", mercado: true },
        { dia: 9, fecha: "viernes 9 de junio", tipo: "laborable" },
        { dia: 10, fecha: "sábado 10 de junio", tipo: "laborable" },
      ],
    },
    {
      anio: 1557, galeras: true, escasezDesde: 1,
      desc: { sanesteban: SOTO_VUELTO },
      calendario: [
        { dia: 1, fecha: "martes 1 de junio", tipo: "laborable" },
        { dia: 2, fecha: "miércoles 2 de junio", tipo: "laborable" },
        { dia: 3, fecha: "jueves 3 de junio", tipo: "laborable", mercado: true },
        { dia: 4, fecha: "viernes 4 de junio", tipo: "laborable" },
        { dia: 5, fecha: "sábado 5 de junio", tipo: "laborable" },
        { dia: 6, fecha: "domingo 6 de junio", tipo: "domingo", fiesta: "Pentecostés" },
        { dia: 7, fecha: "lunes 7 de junio", tipo: "laborable" },
        { dia: 8, fecha: "martes 8 de junio", tipo: "laborable" },
        { dia: 9, fecha: "miércoles 9 de junio", tipo: "laborable" },
        { dia: 10, fecha: "jueves 10 de junio", tipo: "laborable", mercado: true },
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
    // jueves de mercado (j0.13; decidido por Sergio el 20 de noviembre de 2026): la plaza sigue llena hasta nona.
    // Se suma a lo del tipo de día. Cifras de Claude, sin revisar.
    mercado: {
      plaza: { 2: 3, 3: 3 },
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
      // si la para por la calle, no la lleva a la cárcel: la echa, y si ya la conoce (o le ve la espalda), la azota allí
      // mismo (PARAMS.carcel.azotes de cuerpo esa noche; pregunta 12, opción B). Pedir delante de la ronda y la noche, igual.
      obrasForzadas: 5,
    },
    // hurtar y la horca (j0.12; se activa al empezar, sola o con lo demás; solo en la prueba A). Decidido por rondas
    // del 10 al 12 de noviembre de 2026 (ver «Hurtar y la horca» en claude/decisiones-replanteamiento.md, en el proyecto).
    // Lo castiga la justicia, no la ronda de pobres: quien te ve es el dueño o el vecino, y la pena es una escalera
    // aparte de las detenciones por pedir. Los valores marcados DECIDIDO son los del juego; las demás palancas son las
    // opciones que se midieron y no se eligieron: están apagadas y quedan para los bots (herramientas/hurto-tanda.js).
    hurto: {
      // qué se hurta: «hogaza» (pan del mercado y de las tiendas), «olla» (la comida de una casa, a sexta) o
      // «ropa» (algo que dura: no da pan, da un invierno mejor; solo pesa con varios veranos)
      que: "hogaza", // DECIDIDO (ronda 1, 10 de noviembre): pan de un puesto
      // dónde y a qué franjas, según lo que se hurta
      donde: {
        hogaza: { plaza: [0, 1], rua: [1, 3, 4] },
        olla: { rua: [2], sanpablo: [2], sanmartin: [2], plaza: [2], escuelas: [2] },
        ropa: { orilla: [0, 1, 2, 3], rua: [1, 3, 4] },
      },
      // los jueves de mercado (j0.13), franjas de más en que se puede hurtar: hay puestos en la plaza hasta nona
      mercado: { hogaza: { plaza: [2, 3] } },
      ratos: 2,   // lo que tarda (pedir tarda una franja: 6)
      gana: 2,    // pedazos (hogaza y olla)
      ropa: { cuerpo: 1, pan: 1 }, // con ropa hurtada, el invierno se pasa un escalón mejor
      // ¿te ven? Con «bulto», la gente tapa (mucha gente, menos ojos sobre ti); con «ojos», la gente mira.
      ojos: "bulto",
      // DECIDIDO (ronda 9, 12 de noviembre): con poca gente te ven 1 de cada 2; con mucha, 1 de cada 4
      visto: { bulto: { 2: 0.5, 3: 0.25 }, ojos: { 2: 0.2, 3: 0.4 } },
      vistoFijo: { olla: 0.3, ropa: 0.3 },
      riesgo: 1,          // multiplica todo lo anterior (para barrer el riesgo)
      repite: 2,          // multiplica si ya has hurtado hoy en ese sitio
      rondaDelante: { 2: 1, 3: 0.5 }, // con la ronda en el sitio, te coge ella (como al pedir)
      aviso: 3,           // las voces que quedan en el sitio: la ronda acude
      // si te ven: «prendido» (te cogen allí mismo), «huye» (escapas con lo hurtado y te buscan por tus señas)
      // o «mixto» (mitad y mitad)
      // DECIDIDO (ronda 2, 11 de noviembre): «gente» — con mucha gente te sujetan allí mismo; con poca, escapas y te buscan
      siVisto: "gente", prendido: 0.5,
      // si te buscan: la ronda te para más (llegar a donde está) y, si te para o te coge por otra cosa, es por ladrón
      pararBuscado: 0.5,
      // la escalera: lo que le toca al ladrón cada vez que lo prenden. «tres»: azotes, oreja, horca. «dos»: oreja, horca.
      // DECIDIDO (ronda 3, 11 de noviembre): «verguenza» — la primera vez, a la vergüenza (sin azotes); la segunda, azotes; la tercera, la horca
      escalera: "verguenza",
      escaleras: { verguenza: ["verguenza", "azotes", "horca"], vergOreja: ["verguenza", "oreja", "horca"], tres: ["azotes", "oreja", "horca"], dos: ["oreja", "horca"], castellana: ["azotes", "azotes", "horca"] },
      escaleraMujer: null, // null: la misma; o p. ej. ["azotes", "horca"] (nada entre los azotes y la horca)
      // si el alcalde lee la espalda azotada venga de donde venga: al que ya azotó la ronda por pedir, el primer hurto le cuenta como segundo
      // DECIDIDO (ronda 5, 11 de noviembre): la justicia no recuerda más que lo que lleva el cuerpo, y la espalda azotada
      // (por lo que sea, también los varazos de la calle) quita el peldaño de en medio: vergüenza y, a la segunda, la horca
      espalda: "acorta", espaldaQue: "todas", // ver penaHurto en engine.js
      // qué recuerda la justicia de un verano a otro: «libro» (la cuenta de veces que te ha prendido no se pierde) o
      // «cuerpo» (solo lo que llevas encima: la oreja cortada y, si «espalda», los azotes; la vergüenza se olvida)
      memoria: "cuerpo",
      cuenta: false,       // si prenderte por ladrón cuenta además como detención (camino del destierro)
      // desde la pragmática de 1552 (en el juego, desde el verano de 1553), al ladrón varón lo mandan a galeras en vez de
      // subir la escalera: true (al primer hurto, como dice la pragmática), "segunda" (la primera vez, a la vergüenza;
      // galeras a la segunda) o false
      galeras1552: true, // DECIDIDO (ronda 6, 11 de noviembre): al primer hurto, como dice la pragmática
      // la oreja cortada: quién la lee. conoce: la ronda te trata como conocido (como la espalda azotada);
      // limosna: puntos que baja la tirada de limosna; siega: si aún te dan hoz u obra
      oreja: { conoce: true, limosna: 0, siega: true },
      // la necesidad extrema: null (no hace nada) o { cuerpo, visto }: con el cuerpo así o menos, los vecinos miran
      // a otro lado (multiplica la probabilidad de que te vean). La justicia no cambia.
      // DECIDIDO (ronda 7, 12 de noviembre): con el cuerpo a 2 o menos te ven la mitad de las veces
      necesidad: { cuerpo: 2, visto: 0.5 },
      // restituir: null, o { lugar, devuelve, ratos }: si te buscan, en ese sitio devuelves lo hurtado y la parte perdona
      sagrado: null,
      // morir ahorcado en la cadena: «solo» (se acaba la cadena), «acompanado» (sigues como uno de los tuyos que quede libre)
      // o «anoche» (sigues como el que durmió contigo la última noche que dormiste libre, si sigue libre)
      horca: "solo", // DECIDIDO (ronda 4, 11 de noviembre): ahorcado, mueres solo y se acaba la cadena
      // los tuyos: si la que se arriesga hurta cuando pasa hambre, con estas mismas reglas
      // DECIDIDO (ronda 8, 12 de noviembre): Catalina hurta cuando pasa hambre, y el que te vende cuenta también tus hurtos
      // (ronda 9: Catalina hurta antes, con el cuerpo en 3 o menos)
      tuyosHurtan: true, tuyosCuerpo: 3,
      // malsinar: si el que te vende cuenta también lo que has hurtado este verano (te buscan)
      malsinar: true,
      // cuántos días te buscan por tus señas (null: hasta que te prenden o hasta el invierno)
      buscaDias: 3, // DECIDIDO (ronda 9): te buscan tres días
    },
    // las tretas (rama claude/tretas; se activan al empezar, como hurtar). Lo decidido es de Sergio (23-nov): un
    // repertorio que se gana y se quema, que cuesta, que se paga en pan o en blancas y que el rasgo filtra. Las cifras
    // y el detalle de cada una son de Claude (23-nov, sin revisar): las fichas están en claude/borrador-tretas.md.
    // Nada se explica: lo dicen quien te la enseña o te la vende, la gente y el alguacil.
    tretas: {
      mazo: 3,            // cuántas llevas como mucho; para una cuarta hay que olvidar una
      catalogo: 4,        // señas que junta una treta antes de que la autoridad la catalogue ese verano
      senas: 2,           // señas que suma si la ronda te descubre con ella (al pedir o al pararte)
      blancasPedazo: 2,   // lo que da en blancas cada pedazo de la tirada, en las tretas que dan blancas
      ratos: 1,           // comprar, vender o quitarte el atrezo
      registro: 6,        // con más blancas encima, si la ronda te para te las quita («mucho dinero para un pobre»)
      // la posada (prototipo de presión, 23-nov): lo que las blancas dan y el pan no. Dormir dentro sin la ronda de noche
      // solo la noche (al amanecer te echan por la Puerta del Río) y se gasta: cada mesón, 2 noches por verano; si vuelves, da parte
      posada: { blancas: 3, en: ["rua", "plaza"], veces: 2 },
      // el pan también se compra y se vende (no al mismo precio, para que pan y blancas no sean la misma moneda)
      pan: { compra: 2, compraEscasez: 3, venta: 1, compraEn: { plaza: [0, 1, 2, 3], rua: [0, 1, 2, 3, 4] }, ventaEn: { puerta: [0, 1, 2, 3, 4, 5] } },
      lista: [
        // la de entrada: gratis, la primera noche en la ribera
        { id: "voto", pregon: "para la cera de los santos sin licencia del cura", nombre: "el voto", corto: "el voto", boton: "Pedir para la cera del santo", quien: "todos", primera: true,
          aprende: { pan: 0, blancas: 0, quien: "una vieja",
            dice: "Una vieja te enseña su estampa de San Roque: «Pide para la cera del santo, que a eso no se niega nadie, y lo que te den es dinero, no pan. Pide sencillo: al que habla mucho no le dan. Y no vuelvas a la misma calle, que el vecino se acuerda»." },
          lugares: ["rua", "sanpablo", "plaza"], minDa: 2, bonus: 0, sitioNuevo: 1, repite: { aviso: 2, senas: 1 }, moneda: "blancas", fingir: true,
          como: "para la cera de San Roque, con la estampa en la mano" },
        { id: "carta", pregon: "con cartas y sellos que no ha dado el obispo", nombre: "la carta y el sello", corto: "la carta", boton: "Pedir con la carta", quien: "todos",
          compra: { lugar: "escuelas", franjas: [1, 3], blancas: 6, quien: "un estudiante pobre",
            dice: "Un estudiante pobre escribe cartas de limosna, con sello y todo, por seis blancas: «Dice que eres cautivo rescatado y que el obispo te da licencia para pedir. En la Rúa y en San Pablo no saben leer. Si la lees en misa un domingo, en la catedral, a prima, sacas en una mañana lo de una semana; pero eso, una vez. Y no se la enseñes a nadie que sepa leer»." },
          lugares: ["rua", "sanpablo"], minDa: 2, bonus: 1, moneda: "blancas", fingir: true,
          misa: { lugar: "catedral", f: 0, tipos: ["domingo", "corpus"], tiradas: 3 },
          descubreParar: 1 / 3, // la llevas siempre encima: si la ronda te para, a veces te la pide
          como: "con tu carta de limosna, sello y todo" },
        { id: "parida", pregon: "fingiéndose recién paridas a las puertas de las iglesias", nombre: "la parida", corto: "la parida", boton: "Tenderte de parida (dos franjas)", quien: "mujer",
          aprende: { pan: 1, blancas: 2, quien: "una mujer",
            dice: "Una mujer te enseña a hacerte la recién parida: «Una sábana, cera en la cara para estar pálida y una criatura de trapo. Te tiendes a la puerta de la iglesia dos franjas seguidas y te dan como a nadie. Pero tumbada no puedes correr: si viene la ronda, te levanta la sábana». Por enseñarte y por la sábana, un pedazo esta noche y dos blancas." },
          lugares: ["catedral", "sanesteban"], minDa: 2, franjas: 2, bonus: 2, moneda: "mitad", sinHuir: true, fingir: true,
          como: "tendida en una sábana, de recién parida, con la criatura de trapo" },
        { id: "coplas", pregon: "cantando coplas sin licencia", nombre: "las coplas", corto: "las coplas", boton: "Cantar y vender coplas", quien: "todos",
          compra: { lugar: "plaza", franjas: [0, 1], blancas: 3, usos: 3, quien: "el buhonero",
            dice: "El buhonero vende pliegos de coplas de ciego, tres por tres blancas: «Cántalas donde haya mucha gente y vende los pliegos. Eso no es pedir: es vender. Pero el corro se oye de lejos»." },
          lugares: ["plaza", "rua"], minDa: 3, bonus: 0, moneda: "blancas", avisoExtra: 2, fingir: false, sinUsos: "se te han acabado los pliegos",
          como: "cantando coplas de ciego y vendiendo los pliegos" },
        { id: "cautivo", pregon: "diciéndose cautivos de Argel, con cadenas", nombre: "el cautivo", corto: "las cadenas", boton: "Pedir con las cadenas de cautivo", quien: "hombre",
          compra: { lugar: "puerta", franjas: [0, 1, 2, 3, 4, 5], blancas: 4, quien: "un mozo que dice venir de Argel",
            dice: "Un mozo con cadenas al hombro dice que viene de Argel y te vende otras y la historia por cuatro blancas: «Cuéntala en la catedral y en la Rúa. Con una carta de rescate, mejor. Pesan, y si el alguacil te pregunta por el baño de Argel, más te vale saber qué decir»." },
          lugares: ["catedral", "rua"], minDa: 2, bonus: 1, combo: { carta: 1 }, moneda: "blancas", fingir: true,
          puesta: { paso: 1, descubre: 1 / 3, nombre: "las cadenas", quitar: "Quitarte las cadenas" },
          como: "con las cadenas al hombro, contando tu cautiverio en Argel" },
        { id: "vergonzante", pregon: "bien vestidos, fingiéndose vergonzantes", nombre: "el pobre vergonzante", corto: "la ropa buena", boton: "Pedir en voz baja, bien vestido", quien: "todos",
          compra: { lugar: "rua", franjas: [0, 1, 2, 3, 4], blancas: 8, quien: "un ropavejero",
            dice: "Un ropavejero te ofrece un sayo y unas calzas de buen paño, de segunda mano, por ocho blancas: «Con esto no pareces pobre. Pide en voz baja, como quien no está hecho a pedir: al vergonzante se le da. La ronda ni te mira. Pero no duermas con ella en la ribera, que allí te la pueden robar»." },
          lugares: ["rua", "sanpablo", "plaza"], minDa: 2, bonus: 0, moneda: "pan", fingir: true,
          puesta: { noParan: true, pillar: { 2: 0.5, 3: 0 }, nombre: "la ropa buena" }, ribera: "roban", robo: 1 / 3, // una de cada tres noches en la ribera
          como: "en voz baja, con tu ropa buena, como quien no está hecho a pedir" },
        { id: "muerto", pregon: "para enterrar muertos que no lo están", nombre: "el muerto fingido", corto: "el muerto", boton: "Hacer el muerto", quien: "tuyo",
          aprende: { pan: 0, blancas: 0, quien: "tuyo",
            dice: "«Yo sé una que hacíamos en Madrid», dice {tuyo}. «Uno se tiende como muerto a la puerta de la iglesia, a la hora de vísperas, con una sábana, y el otro pide para enterrarlo. Con mucha gente se saca de una vez lo de un día. Hay que quedar la noche antes, y en cada iglesia, una vez. Y el muerto no puede correr»." },
          lugares: ["catedral", "sanmartin"], minDa: 2, tiradas: 4, moneda: "blancas", mitadTuyo: true, unaVez: "sitio", sinHuir: true, fingir: true,
          cita: { f: 4 }, // a vísperas: el otro tiene el día para llegar
          como: "con {tuyo} tendido en el suelo como muerto, pidiendo para enterrarlo" },
      ],
    },
    // la ciudad se endurece (prototipo, rama claude/tretas, 23-nov; se activa al empezar). Decidido por Sergio: corchetes
    // que se suman durante el verano donde se acumulan quejas (tuyas, de los tuyos y de otros pobres), y uno en la puerta
    // por la que más pasas. Las cifras son de Claude, sin revisar. Un corchete vigila un sitio a una hora todos los días
    // desde que lo ponen: si pides delante te ve, y si llegas te puede parar, como la ronda. Se dice al amanecer.
    presion: {
      desde: 2,           // el primer día con corchetes (se ponen al amanecer, con las quejas de los días anteriores)
      porDia: 2,          // corchetes nuevos cada mañana
      max: 10,            // como mucho. Con desde 2, 2 al día y 10, el oficio sin tretas llega a la siega el 62 % (sin presión,
                          // el 92 %); con desde 3, 1 al día y 5, el 82 % (el 62 % que salía antes era un fallo del bot, 24-nov)
      umbral: 2,          // quejas acumuladas que hacen falta en un sitio y hora
      otros: 1,           // peso de las quejas de otros pobres (cada franja en que piden donde hay gente, lo que avisa el sitio)
      franjas: [0, 1, 3, 4], // a sexta comen; a completas está la ronda en la puerta
      puerta: { desde: 3, min: 2 }, // desde el día 3, uno en la puerta y la franja por la que más has pasado (si son 2 o más veces); se mueve si cambias
      desdeVerano: 0,     // en la cadena, desde qué verano (0: 1545; 1: 1553)
      paran: true,        // si los corchetes paran al que llega: true (todos), false (solo el de la puerta), "nunca" (solo ven pedir)
      // Decidido por Sergio (24-nov, opción A de tres): sin corchetes por quejas; parejas de cierre y llave que atacan los
      // huecos y la ruta del que juega bien, cambian cada verano y cuyas llaves se queman. Primero las dos con llaves que
      // ya existen: el guarda de la puerta (llave: la ropa buena puesta) y los diputados de la parroquia (llave: la carta).
      // «corchetes» deja la presión del 23-nov, para repetir sus medidas. Las cifras son de Claude, sin revisar.
      modo: "cierres",
      cierres: {
        desde: [2, 4],    // el día en que aparece cada cierre: cada verano, al azar entre estos dos
        senas: 1,         // señas que suma la llave cada vez que pasa un cierre (con PARAMS.tretas.catalogo, se la quitan y queda catalogada)
        echa: 3,          // ratos que pierdes si los diputados te echan de la calle
        // el guarda: empieza en la puerta que la ronda no cierra ese verano, a una de estas franjas; desde que está, cada
        // mañana se va a la puerta y la hora por la que más sales (si son min veces o más), salvo donde cierra la ronda
        puerta: { franjas: [4, 5], min: 2 },
        // los diputados: empiezan en un hueco de estos sitios (con gente que da y sin la ronda de costumbre a esa hora); desde
        // que están, cada mañana se van al sitio y la hora de estos donde más pan has sacado pidiendo (si son min pedazos o más)
        parroquia: { sitios: ["sanpablo", "puerta", "rua", "plaza", "catedral", "sanmartin"], franjas: [0, 1, 3, 4], min: 3 },
      },
    },
  };

  const LICENCIAS = [
    "La ronda, sus costumbres y que coma a sexta son invención del juego.",
    "Que en San Esteban nadie avise a la ronda sale de que Soto, su prior, escribió contra la orden; no hay documento que lo diga.",
    "La limosna se da en pan (pedazos) y no en dinero, para no meter el mercado en esta prueba.",
    "La siega empieza el 11 de junio; en Castilla solía empezar a finales de junio o en julio.",
    "La Puerta de San Pablo existió, del lado del río y al este del puente; que sus guardas no avisen a la ronda es del juego. Había más puertas, que el juego deja fuera.",
    "Las cifras (gente, limosna, probabilidades) son del juego.",
    "La Armuña era tierra de Salamanca, a menos de seis leguas: por la ley de 1540, su pobre podía pedir en la ciudad con licencia. La orden de 1544 prohibió pedir a todos; si su ración llegaba a los pobres de la Tierra o solo a los de la ciudad no se sabe. En el juego, no les llega.",
  ];
  // solo con «Hurtar»
  const LICENCIAS_HURTO = [
    "Que al ladrón lo saquen a la vergüenza, en un asno y con el pregonero delante, está en las leyes y en los pleitos; que la primera vez sea solo eso, sin azotes, es del juego.",
    "La horca al segundo hurto del que ya lleva azotes es del juego. Por ley, el hurto simple no llevaba a la horca: las Partidas mandaban azotar al ladrón y prohibían matarlo o cortarle miembro, y la pragmática de 1566 solo alargó las galeras. Ahorcar al tercer hurto era costumbre de los jueces.",
    "Que te busquen por tus señas sale de las listas de señas de la época; que a los tres días dejen de buscarte es del juego.",
    "Que el dueño vuelva la cabeza ante el que se muere de hambre sale de la doctrina (en necesidad extrema, tomar no es hurtar, y el hambriento puede suponer que el dueño se lo permitiría); que pase la mitad de las veces es del juego.",
    "Desde la pragmática de 1552, al ladrón varón de más de veinte años, vergüenza y cuatro años de galeras la primera vez. La mujer quedaba fuera de las galeras, para castigarla conforme a las leyes.",
  ];
  // solo con «Jugar varios veranos»
  const LICENCIAS_CADENA = [
    "Las galeras son de la pragmática dada en Monzón el 25 de noviembre de 1552: al vagabundo sano de más de veinte años, la primera vez, vergüenza y cuatro años de galeras en lugar de azotes. Por eso el segundo verano es 1553. En el juego, todos los hombres pasan de veinte y basta una detención.",
    "El pan caro de 1557 sale de la cosecha de 1556, de las peores del siglo; que la gente dé menos desde el 1 de junio es del juego.",
    "El mercado de los jueves en la plaza de San Martín está documentado en la Edad Media; que siguiera en el siglo XVI y que llene la plaza hasta nona es del juego.",
    "Que el alguacil mande a las obras sin paga al mozo sano que para por la calle sale de una ley más vieja (Briviesca, 1387: servir sin soldada); en Salamanca es del juego.",
    "A la mujer, la ronda no la lleva a la cárcel cuando la para por la calle: la echa y, si ya la conoce, la azota (para las mujeres no había nada entre los azotes y la horca). Que no haya cárcel es del juego. No había galeras para mujeres.",
    "Entre un verano y otro, lo que pasa en el invierno se resume en cómo llegas: con hoz, espigando o sin nada.",
  ];

  // solo con «Tretas» (rama claude/tretas). La primera sustituye a la de la limosna en pan.
  const LICENCIAS_TRETAS = [
    "La limosna se da en pan, salvo en las tretas que piden para algo (la cera, el rescate, el entierro) o venden algo (las coplas), que dan blancas. Los precios en blancas son del juego.",
    "Las tretas salen de los catálogos de mendigos de la época (el Liber vagatorum, Pérez de Herrera, los pleitos de Alcalá, Madrid y otras ciudades); que se usen en Salamanca en 1545 es del juego.",
    "El estudiante que escribe cartas en las Escuelas, el buhonero de pliegos, el mozo que vende cadenas de Argel y el ropavejero de la Rúa son del juego.",
    "Que la autoridad catalogue una treta y la pregone sale de lo que hacían los catálogos de mendigos; cuándo y cómo, es del juego.",
    "Las posadas y mesones de la Rúa y la Plaza existían; que la ronda de noche no entre en ellas y lo que cuestan son del juego.",
  ];
  // solo con «Presión» (prototipo, rama claude/tretas)
  const LICENCIAS_PRESION = [
    "Hubo guardas en las puertas de las ciudades castellanas (Ávila, 1518-1520; Burgos, 1565), sobre todo con peste; en Salamanca no consta. Que el guarda no deje pasar a los pobres a la hora en que más sales, y que la ropa buena le engañe, es del juego.",
    "Los diputados de las parroquias examinaban a los pobres y la cédula era obligatoria para pedir (Cortes de 1525, ley de 1540); Soto cuenta en 1545 que iban por las calles escribiendo pobres. Que te echen de la calle si no la llevas, y que vayan adonde más sacas, es del juego.",
  ];

  window.RULES = {
    version: "j0.13-tretas", CONFIG, FRANJAS, RATOS, DIAS, MODOS, BARRIOS, LUGARES, CAMINOS, CALENDARIO, VERANOS, DIAS_SENALADOS,
    RONDA, PARAMS, LICENCIAS, LICENCIAS_CADENA, LICENCIAS_HURTO, LICENCIAS_TRETAS, LICENCIAS_PRESION,
    // la mesa de los agentes pregunta por PERSONAJES: en el juguete, cada «personaje» es una prueba
    PERSONAJES: [
      { id: "A", nombre: "Mozo de La Armuña", origen: "De la Tierra", cuerpoTipo: "Válido", resumen: MODOS.A.resumen, claves: ["Prueba A · calles"] },
      { id: "B", nombre: "Mozo de La Armuña", origen: "De la Tierra", cuerpoTipo: "Válido", resumen: MODOS.B.resumen, claves: ["Prueba B · barrios"] },
    ],
  };
})();
