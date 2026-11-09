# Liber Vagatorum · el juguete (j0.11)

Prueba mínima del núcleo del juego, tras el replanteamiento de octubre de 2026: **un mendigo, una necesidad (el hambre) y una amenaza (la ronda)**. Encima, tres pruebas que se activan al empezar: la llaga (fingir), los tuyos y varios veranos (el relevo). Ni más tretas ni exámenes. Si el núcleo solo no obliga a exponerse para comer, los sistemas de encima no lo van a arreglar.

Es una página estática, sin servidor, instalable en el móvil y jugable sin conexión. Te mueves tocando el mapa (o con la lista «Adónde vas»); en el móvil, pedir, esperar y acabar el día van en una barra fija abajo, y solo se desplaza la pantalla para leer. Se publica en GitHub Pages desde `main`: https://sergogza.github.io/jueguito/

**El prototipo anterior (v0.5a)** está entero en la rama `archivo-v0.5a`, con su bot y sus simulaciones.

## A es el núcleo (30 de octubre de 2026)

Se probaron dos granos de movimiento con la misma ciudad, gente, ronda y pan:

- **A · calles** (la que queda). Diez sitios (doce desde la j0.8, con la segunda puerta y la orilla). Cada paso a un sitio vecino cuesta 2 ratos (tres pasos, una franja). Solo ves el sitio donde estás, y la ronda igual.
- **B · barrios** (guardada en el código; se juega con `?prueba=B`). Los mismos sitios en cuatro barrios: dentro del barrio te mueves gratis y lo ves entero; pasar a otro cuesta una franja. La ronda vigila todo su barrio.

Ningún criterio fijado antes de probar separó una de otra: en A nadie contó pasos, en B cruzar pesaba, y la sorpresa con la ronda acabó leyéndose como decisión propia en las dos. Decidió Sergio: A le parece más realista (moverse a cualquier sitio cuesta tiempo) y premia al que aprende. A era más fácil para quien aprende, porque el aviso trae a la ronda a donde pediste y en A esquivarla cuesta 2 ratos; por eso entra **la ronda que aprende** (ver las reglas).

## Las reglas, en corto

Todo está en `rules.js` y la ayuda del juego lo explica.

- **El día:** seis franjas (prima a completas) de seis ratos. Pedir ocupa una franja. Al acabar completas cierran las puertas de la muralla.
- **Dos puertas** (j0.8). La Puerta del Río, junto al puente, y la de San Pablo, al este, junto a San Esteban, a la que se llega desde el puente por la orilla (un paso más). Al anochecer la ronda va a cerrar una de las dos, y cuál es una de sus costumbres de ese verano (ver abajo). En la de San Pablo nadie pide y sus guardas no avisan. Así, al acabar el día se elige por dónde salir según lo que sepas de la ronda: el oeste es más rico a vísperas (Catedral, Rúa); el este, más pobre. Quieto en una puerta, la ronda no te para, y salir hacia fuera no cuenta como llegar adonde está. Historia: el Postigo Ciego (pegado a la Puerta del Río) y la Puerta de San Pablo existieron; ver el registro.
- **El pan está dentro y los pobres duermen fuera, en la ribera** (en el puente y en la orilla no se puede dormir: se baja a la ribera). Fuera de la muralla nadie da. Dentro, solo donde hay gente que no es pobre; si hay otros pobres pidiendo, os repartís lo que hay. Desde el día 6, el pan sube y la gente da menos.
- **Lo que ves caduca.** La gente, los pobres y la ronda cambian al empezar cada franja. Lo demás lo sabes de cuando estuviste, y el mapa lo pinta más claro cuanto más viejo.
- **Lo que recuerdas** (botón «Recuerdos» de la cabecera). Un panel que hay que abrir guarda dónde y cuándo has visto a la ronda, dónde has pedido tú (por franjas) y dónde te ha parado. Es la forma de aprender sus costumbres de este verano y de ver las tuyas, y lo que heredará el siguiente en el relevo.
- **La ronda:** unas costumbres, desvíos al azar y, sobre todo, va donde avisan.
  - **Las costumbres cambian cada verano** (j0.9; cada partida es un verano y las saca de la semilla). El esqueleto es fijo y sale del mundo: por la mañana (prima y tercia) anda donde hay mercado o misa (la Plaza, la Catedral o San Martín); a sexta come; a nona y a vísperas, donde hay gente (nona: Escuelas, Rúa, Catedral o Plaza; vísperas: Rúa, Catedral o Plaza); al anochecer cierra una de las dos puertas; el Corpus acompaña la procesión. Lo que cambia es el sitio: hay 72 combinaciones. La ayuda dice que no son las mismas cada verano; cuáles son, se aprende mirando (Recuerdos). El informe las dice al final. Hasta la j0.8 el recorrido era fijo (Plaza, Plaza, come, Escuelas, Rúa, Puerta del Río) y quien había jugado varias veces se lo sabía de memoria.
  - Quien te ve pedir avisa; Quien te ve pedir avisa; en la Puerta del Río, las Escuelas y San Martín, enseguida; en San Esteban, nadie.
  - Si te ve pedir, te detiene (con mucha gente, a veces no te ve).
  - Si llegas a donde está, puede pararte: la primera vez te echa de la ciudad; si ya te conoce, te detiene.
  - Quieto, no te para.
  - **Aprende tus costumbres:** si te han visto pedir en el mismo sitio a la misma hora dos días distintos (donde alguien avisa), desde entonces va allí a esa hora 6 de cada 10 veces. No se explica; si te pilla así, el alguacil: «Sabía que te encontraría aquí». En el informe sale como «(tu costumbre)».
- **Detenciones:** cárcel y sin pan; la segunda, azotes; la tercera, destierro (fin).
- **Trabajo:** las obras de la catedral cogen peones a prima los días laborables, por 2 pedazos y cansancio (−1 de cuerpo esa noche). Con el cuerpo bajo es más difícil que te cojan. Ninguna de las dos cosas se dice antes: se aprende («Tus brazos no me valen, muchacho»). Desde la ribera no se llega a tiempo: hay que haber dormido dentro.
- **La noche:** ración entera (2 pedazos) +1 de cuerpo, media −1, nada −2. Dormir dentro ahorra el camino, pero la ronda de noche va donde ha habido quejas: donde te vieron pedir ese día (1 de 3; fichado, 1 de 2), donde otros pobres pidieron en dos franjas o más (1 de 6; fichado, 1 de 4) y, donde nadie se quejó, menos (1 de 12; fichado, 1 de 8). El juego no lo explica: lo que sabes está en el mapa (dónde te vieron pedir, dónde viste otros pobres) y, si te detienen, lo dice el alguacil («Ya me han dicho que andabas pidiendo por aquí»; «Venimos a limpiar esto de pordioseros»). Si fue la ronda de costumbre, no dice nada.

**Principio (Sergio):** la información la dan los personajes y el mundo, y el jugador la interpreta; nada de una voz en off que lleve de la mano. Pendiente: recortar «Antes de actuar» con ese criterio después de esta tanda de pruebas.
- **Objetivo:** aguantar diez días (1 a 10 de junio de 1545; el 4 es Corpus Christi y el 7, domingo) hasta la siega, que empieza el 11. En la siega el mayoral coge segadores según el cuerpo (con 4 o más, seguro; con 3, a veces; con menos, no). La cifra no se dice: «Tus brazos no me valen». Así, llegar con lo justo no es lo mismo que llegar entero.

**Licencias históricas** (también en la ayuda): la ronda y sus costumbres son invención; que en San Esteban nadie avise sale de que Soto, su prior, escribió contra la orden, sin documento que lo diga; la limosna va en pan y no en dinero para no meter el mercado en esta prueba; que los guardas de la Puerta de San Pablo no avisen es del juego, y la muralla tenía más puertas de las dos que salen; las cifras son del juego.

**Bots (2.000 partidas cada uno; no es un objetivo de dificultad).** Llegan a la siega, con siega o sin ella. Hasta la j0.7.2, el veterano y el prudente se quedaban dentro de la muralla sin querer 1 de cada 9 noches y eso les daba tiempo de pedir: sus cifras de entonces (50 % y 51 %) estaban infladas. Desde la j0.8 siempre salen a tiempo y eligen puerta. Desde la j0.9 el veterano y el prudente conocen el esqueleto de las costumbres de la ronda y aprenden las del verano de lo que ven; hasta la j0.8 se sabían el recorrido fijo.

| Bot | j0.7.2, una puerta | j0.8, dos puertas | j0.9, costumbres por verano |
|---|---|---|---|
| Escondido en la ribera | 0 % | 0 % | 0 % |
| Novato (no conoce la ciudad; sale por la puerta más cercana) | 19 % | 32 % | 40 % |
| Veterano (conoce horarios; aprende la ronda; cambia de rutina si se la aprenden; elige puerta) | 43 % | 51 % | 53 % |
| Prudente (como el veterano, pesa el triple el riesgo) | 27 % | 31 % | 25 % |
| Veterano y prudente que no cambian de rutina (`RUTINA=1`) | 30 % y 39 % | 44 % y 57 % | 44 % y 59 % |
| Duerme siempre dentro, eligiendo sitio | 37 % | 36 % | 39 % |
| Vidente (como el veterano, pero sabe las costumbres del verano desde el primer día) | — | — | 62 % |
| Memorioso (como el veterano, pero cree que la ronda sigue el recorrido fijo de hasta la j0.8) | — | — | 51 % |

- **Costumbres por verano (j0.9):** saberlas desde el primer día vale unos 9 puntos (vidente 62 % frente al veterano que las aprende, 53 %); el que se sabía el recorrido viejo no saca ventaja (51 %). El veterano acierta pronto qué puerta cierra (9 de cada 10 veranos hacia el día 9), porque sale por ellas; lo demás le cuesta más, porque esquiva la ronda y la ve poco. Los veranos en que la ronda cierra la Puerta de San Pablo son más fáciles (veterano 58 % frente a 47 %; novato 48 % frente a 31 %): el oeste, más rico, sale por la puerta grande sin ronda. `CIERRA=1` lo separa.
- **La segunda puerta (j0.8):** el veterano salía por la de San Pablo 1 de cada 5 tardes. Lo que más mata al veterano y al prudente es el hambre.
- **Darse cuenta de la rutina** compensa al veterano (53 % frente a 44 %), pero el prudente se pasa de cauto: deja los mejores sitios y se muere de hambre (25 % frente a 59 %).
- **Detenciones del veterano** (`DESGLOSE=1`): al llegar donde está la ronda, 0,98 por partida; pidiendo, 0,07; de noche, ninguna (duerme siempre fuera).

## La llaga (j0.7; se activa al empezar)

Fingir entra por la llaga, decidido el 30 de octubre de 2026. Sale de Robles (Salamanca, 1545): «la llaga de la pierna le es un Perú», y al que ve con una llaga la justicia «no le puede preguntar más». Y de la vuelta que le da Soto con san Juan Crisóstomo: «si el pobre finge alguna lesión, por necesidad y menester grande la finge, por causa de tu crueldad». **Se activa con el botón «Activar llaga» de la pantalla de inicio** (se recuerda en el móvil). Sin activarla, la partida es la normal (desde la j0.8, con las dos puertas); así se puede probar desde la app instalada y no se mezcla con las partidas sin llaga. Se pide a cada probador una partida sin llaga y luego otra con ella. El informe dice si estaba activada y si se la hizo. Los agentes juegan sin ella.

- **Cómo.** De noche en la ribera, una sola vez y para siempre. Lo enseña un viejo que duerme allí: «Esta me da de comer». Lo que cuesta no lo dice nadie; lo dicen el capataz, el alguacil y el mayoral.
- **Lo que da.** La tirada de limosna sube 1. Las tres primeras veces que llegas a donde está la ronda, el alguacil te mira la pierna y sigue su camino. A la cuarta ya no le vale: si te para, sea para echarte o para detenerte, el alguacil dice «Otra vez tú, el de la pierna. Esa llaga ya me la sé» (en la j0.7, si aún no te tenía fichado, te echaba sin mencionar la pierna; arreglado en la j0.7.1). Si además te esperaba allí por tu costumbre, dice las dos cosas: «…Esa llaga ya me la sé, y sabía que te encontraría aquí» (j0.7.2; antes la frase de la pierna tapaba la de la costumbre).
- **Lo que cuesta.** Esa noche, fiebre (−1 de cuerpo). El cuerpo ya no pasa de 5. Cada noche siguiente, una de cada tres se encona (−1). Ni las obras ni el mayoral te cogen: el final es aguantar sin siega.
- **Palancas** en `PARAMS.llaga`: `limosna`, `cuerpo`, `cuerpoMax`, `encona`, `parar`, `protege`, `pillar`, `noche`.

**Calibrado con bots** (`LLAGA=1 node herramientas/bot.js 2000`; juegan como el veterano). Por parejas con la misma semilla, solo en las partidas en que el bot se hizo la llaga. Se calibró con los bots de antes, que se quedaban dentro sin querer; con los bots arreglados (j0.8) la llaga ayuda bastante más, porque el veterano honrado pasa más hambre y la llaga da de comer:

| Cuándo se la hace | Calibrado (j0.7): con llaga / el veterano sin ella | j0.8, bots arreglados: con llaga / el veterano sin ella | j0.9: con llaga / el veterano sin ella |
|---|---|---|---|
| La primera noche | 53 % / 49 % | 63 % / 51 % | 70 % / 53 % |
| Desde el día 3 | 59 % / 52 % | 71 % / 52 % | 72 % / 54 % |
| Desde el día 5 | 65 % / 56 % | 75 % / 54 % | 78 % / 57 % |
| Desde el día 7 | 78 % / 67 % | 81 % / 59 % | 83 % / 61 % |
| En apuros (desde el día 4, cuerpo ≤ 2 o dos detenciones) | 54 % / 43 % | 56 % / 45 % | 56 % / 45 % |

Al calibrarla: hacérsela pronto casi no salvaba y perdía la siega; tarde, y sobre todo en apuros, salvaba unos 11 de cada 100. Con los bots arreglados, salva de 10 a 22 de cada 100 según cuándo (en la j0.9, de 11 a 22), y la siega que se pierde es de 1 de cada 4 o 5. Está pendiente de revisar con los informes. Se llegó a la versión actual tras descartar dos:

- **Protección para siempre** (más limosna y el alguacil no te para nunca): hacérsela la primera noche llegaba al 97 %. Quitaba las dos formas de morir y, después de hacérsela, la partida ya no tenía tensión.
- **Protección a medias** (el alguacil te para la mitad de las veces): como protege lo mismo cada día, el momento daba igual. Cuando la llaga temprana quedaba igualada con no hacérsela, la tardía tampoco ayudaba.

Con la protección que se gasta, la hecha pronto la gasta pronto y la hecha en apuros la guarda para el final.

**Del núcleo, de paso:** casi todas las detenciones del veterano son por llegar a donde está la ronda cuando ya te tiene fichado, y sobre todo en la Puerta del Río a completas. Por eso la j0.8 añade la segunda puerta (ver arriba).

## Los tuyos (j0.10; se activan al empezar)

Decidido por rondas el 31 de octubre y el 1 de noviembre de 2026 (ver `claude/decisiones-replanteamiento.md` en el proyecto). **Se activa con el botón «Jugar con los tuyos» de la pantalla de inicio**, como la llaga, y solo en la prueba A. Sin activarlo, la partida es la normal.

- **Quiénes.** Pedro y Catalina, de tu aldea, bajaron contigo. Pedro es prudente: pide dos veces al día como mucho, no repite sitio y hora, prefiere donde nadie avisa y se recoge pronto. Catalina se arriesga: no pide dos franjas seguidas, recorre la ciudad y le pillan más. Quien ve es quien se expone.
- **De día viven con tus reglas**, a escala de franja: cada franja andan hasta tres pasos (y pueden toparse con la ronda) o piden en un sitio (misma tabla de limosna, mismos avisos, mismas detenciones, la ronda también les aprende las costumbres). Donde piden cuentan como otros pobres. Su azar sale de la semilla, no de tus tiradas.
- **Lo que se ve.** Si coincides con uno: «Catalina está pidiendo aquí». Si en tu sitio quedan quejas de otro que pidió hace poco: «Un vecino rezonga: "Otra vez pordioseros por aquí"» (sin eso, el jugador pedía donde acababa de pedir un tuyo y la ronda le cogía: 0,57 detenciones por partida).
- **De noche, si dormís en la ribera,** te cuentan lo que vieron, tal cual («A tercia vi la ronda en la Catedral… Sin ronda: Rúa y Plaza (nona)»), a veces algo de oídas que puede estar mal. Va a «Recuerdos», en «Lo que te han contado». El que no ha sacado para cenar te pide, y tú le das 0, 1 o 2 pedazos.
- **Malsinar** (Soto, Salamanca 1545: «unos malsinan de otros»). Si te pide y se lo niegas teniendo pan, la primera vez te avisa («Tengo hambre, y el alguacil da pan al que le cuenta cosas»); las siguientes, la mitad de las veces va al alguacil a la mañana siguiente: la ronda se aprende de golpe tus costumbres de pedir y él se va. El alguacil, cuando te pilla así: «Ya me han contado dónde pides».
- **El final dice con quién llegas a la siega** («Llegáis a la siega tú y Pedro. Catalina murió el día 7») o si mueres acompañado o solo. Es un adelanto del relevo.
- **Palancas** en `PARAMS.tuyos`. Apagadas, medidas con bots: `trueque` (solo te cuentan si les das), `devuelve` (el que te debe pan te da un pedazo la noche que no tienes, o te lo lleva a la cárcel), `trato: "confianza"` (al que dejas con hambre te cuenta menos), `mundo: false` (sin efecto en el mundo, para diagnosticar).

**Bots** (`TUYOS=1`; 2.000 partidas, el veterano; `DAR=` cómo reparte):

| | Llega a la siega | Los tuyos vivos al final (Pedro / Catalina) | Malsinadas por partida |
|---|---|---|---|
| Sin los tuyos | 53 % | — | — |
| No les da nunca | 47 % | 53 % / 47 % | 0,43 |
| Solo a Catalina | 41 % | 56 % / 62 % | 0,28 |
| A los dos lo que piden, guardándose su ración | 37 % | 74 % / 60 % | 0,13 |
| Lo que piden, aunque se quede sin cenar | 16 % | 91 % / 75 % | 0 |

- **Darles pan no compensa dentro del verano.** Es una decisión de Sergio (1 de noviembre): compartir en un verano de hambre no sale a cuenta, como en la realidad; lo que hará que importe mantenerlos vivos es el relevo, que va a continuación. Con `devuelve` las estrategias quedaban casi empatadas (46 %, 45 % y 43 %), pero funciona como un seguro y se descartó.
- **Lo que cuentan vale unos 5 puntos** (47 % frente a 42 % con `OIDOS=0`).
- **Los tuyos piden pan una de cada tres noches.** Sacan unos 1,5 pedazos al día. Ven unos 4 o 5 sitios al día.

## Varios veranos (j0.11; se activa al empezar)

Decidido por rondas del 5 al 9 de noviembre de 2026 (ver «El relevo» en `claude/decisiones-replanteamiento.md`, en el proyecto). **Se activa con el botón «Jugar varios veranos»** de la pantalla de inicio; lleva siempre a los tuyos y solo existe en la prueba A. Sin activarlo, la partida es la de la j0.10 (los bots dan exactamente lo mismo).

- **Tres veranos de Salamanca:** 1545 (la orden), 1552 (las galeras) y 1557 (el hambre), cada uno con su calendario juliano (en 1552 y 1557 el Corpus cae después del día 10 y el domingo es el de Pentecostés). En 1552 se pregona la pragmática: al hombre, una detención lo manda a galeras (se va como el desterrado). Las galeras siguen en 1557, y ese año la gente da poco desde el primer día.
- **La cadena dura lo que dure tu gente.** Si mueres y uno de los tuyos ha dormido a tu lado esa noche (la ribera o el mismo portal; en la cárcel se muere solo), sigues como él el verano siguiente; si estaban los dos, eliges. Si mueres solo, se acaba. El destierro y las galeras no son morir: sigue uno de los tuyos, el que elijas. Los días que faltan para la siega se viven sin ti: los tuyos siguen con las mismas reglas y nadie les da pan; si el que ha de seguir se va, sigue el otro con la misma regla.
- **La siega decide cómo llegas al verano siguiente:** con hoz, 5 de cuerpo y 2 pedazos; espigando, 4 y 1; sin nada, 3 y 0 (`PARAMS.cadena.inicio`). Vale igual para los tuyos.
- **Entre veranos:** la cara se olvida y las detenciones quedan; al que azotaron, el alguacil le mira la espalda y es como si le conociera. La ronda saca costumbres nuevas, inclinadas hacia donde te vio pedir y la puerta por la que más pasabas (`PARAMS.cadena.reaccion`). Recuerdos guarda los veranos anteriores, con lo que vio el heredero.
- **Hombre y mujer** (solo con varios veranos). El hombre (tú y Pedro) puede trabajar en las obras y segar con hoz; si la ronda le para por la calle sin conocerle y con 5 o más de cuerpo, lo manda a las obras sin paga hasta la noche (`PARAMS.cadena.obrasForzadas`). La mujer (Catalina) no va a las obras y en la siega espiga; la ronda, si la para por la calle, solo la echa, aunque la conozca. Pedir delante de la ronda y la noche, igual para los dos. Nada de esto se explica: lo dicen el capataz, el alguacil, el mayoral y el pregón.
- **Al final,** cuánto aguantó tu gente («Tu gente aguantó de 1545 a 1552») y lo que fue de cada uno, verano a verano. Es un final provisional: el de 1565 vendrá después.
- **Textos de los tuyos** (también sin varios veranos): el cuerpo se les nota por grados («se le ve flaco» con 3, «muy flaco» con 2, «no se tiene en pie» con 1), y «¿Tampoco hoy?» solo sale si la última vez que te pidieron se lo negaste; si no, «Acuérdate de lo que te dije».

**Bots** (`CADENA=1`; 2.000 cadenas; «completa» = el que juega llega a la siega de 1557):

| | Veterano: llega a 1557 / completa | Novato: llega a 1557 / completa |
|---|---|---|
| No les da nunca | 31 % / 7 % | 34 % / 18 % |
| A los dos lo que piden, guardándose su ración | 36 % / 9 % | 39 % / 22 % |
| Solo a Catalina | 38 % / 10 % | 42 % / 23 % |
| Lo que piden, aunque se quede sin cenar | 39 % / 9 % | 40 % / 22 % |

- **Con la cadena, dar pan compensa** (unos 2 a 5 puntos en completar, 5 a 8 en llegar a 1557), y dejarse morir para que siga otro no es lo mejor.
- **Agujero cerrado:** al principio, los días que faltaban se saltaban y el heredero llegaba a la siega descansado. El bot que no sale de la ribera llevaba a su gente hasta 1557 en el 80 % de las cadenas. Viviendo esos días, el 18 %, y nunca completa.
- **Elegir heredero sale parejo:** Pedro primero, 10 % (veterano) y 20 % (novato); Catalina primero, 8 % y 22 %. El hombre aguanta mejor 1545; la mujer, las galeras.
- **Pendiente de Sergio: la mujer sale mejor en casi todo.** Para ella la ronda deja de ser una amenaza. Empezando como moza, llega a la siega de 1545 el 42 % (el mozo, el 30 %) con el veterano, y el 52 % (frente al 16 %) con el novato. Y en la cadena el arrojo gana a la prudencia, al revés que en un verano: novato 22 %, osado 19 %, veterano 9 %, prudente 0 %. Las cifras de la siega no lo arreglan (la hoz a 6 no cambia nada: con dos pedazos, la primera noche ya estás a 6).

## El informe

Al acabar (o al abandonar), cinco preguntas (seis con varios veranos) y el informe: la partida entera, el tiempo repartido entre moverse, pedir, trabajar y esperar, los pasos o cruces por día, las veces que llegó donde estaba la ronda, la crónica, dónde estuvo la ronda en cada franja (que el jugador no veía) y los datos en bruto.

- **Móvil:** «Compartir informe» adjunta un `.txt` y deja elegir la app de correo.
- **Ordenador:** «Descargar» y luego «Abrir el correo», y adjunta el archivo.

El correo de destino está en `rules.js` (`CONFIG.email`); en GitHub Pages queda a la vista.

## Cambiar reglas

Todo en `rules.js`. **Cada vez que cambies algo, sube la versión en dos sitios**, o los móviles seguirán con la copia vieja:

1. `rules.js` → `version: "j0.11"`, por ejemplo a `"j0.12"`.
2. `sw.js` → `const VERSION = "lv-j0.11-1"`, por ejemplo a `"lv-j0.12-1"`.

## Probarlo en local

```
python3 -m http.server 8000
```

y abre `http://localhost:8000`. Con `?semilla=7` la partida nueva sale siempre igual.

## Herramientas

- `herramientas/bot.js`: diez bots (escondido, azar, novato, veterano, prudente, osado, vidente, memorioso y dos que duermen siempre dentro: uno elige dónde y otro no) que juegan miles de partidas con el motor real y sacan porcentajes. El veterano y el prudente salen siempre antes de que cierren, eligen puerta por el riesgo que esperan y aprenden las costumbres de la ronda de lo que ven; el novato sale por la más cercana. `node herramientas/bot.js 1000` (solo A; `PRUEBAS=A,B` para las dos; `RUTINA=1` para que el veterano y el prudente no se den cuenta de que la ronda aprende; `CIERRA=1` para separar los veranos según la puerta que cierra la ronda; `TUYOS=1` con los tuyos, y `DAR=nadie|todos|ojos|hambre|generoso` para cómo les da pan; `CADENA=1` para varios veranos, con `HEREDERO=cuerpo|pedro|catalina` para a quién elige y `SEXO=mujer` para empezar como moza; `BOTS=veterano,…` para jugar solo con algunos bots). Admite palancas para probar cambios sin tocar `rules.js`. No son personas: sirven para ver si una regla rompe algo, no para fijar la dificultad.
- `herramientas/agentes/`: agentes de Claude que juegan la app real y escriben un diario (`/agentes prueba` desde Claude Code). Ver su README.
