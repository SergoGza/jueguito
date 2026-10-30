# Liber Vagatorum · el juguete (j0.7)

Prueba mínima del núcleo del juego, tras el replanteamiento de octubre de 2026: **un mendigo, una necesidad (el hambre) y una amenaza (la ronda)**. Nada más: ni los tuyos, ni el relevo, ni tretas, ni exámenes. Si el núcleo solo no obliga a exponerse para comer, los sistemas de encima no lo van a arreglar.

Es una página estática, sin servidor, instalable en el móvil y jugable sin conexión. Te mueves tocando el mapa (o con la lista «Adónde vas»); en el móvil, pedir, esperar y acabar el día van en una barra fija abajo, y solo se desplaza la pantalla para leer. Se publica en GitHub Pages desde `main`: https://sergogza.github.io/jueguito/

**El prototipo anterior (v0.5a)** está entero en la rama `archivo-v0.5a`, con su bot y sus simulaciones.

## A es el núcleo (30 de octubre de 2026)

Se probaron dos granos de movimiento con la misma ciudad, gente, ronda y pan:

- **A · calles** (la que queda). Diez sitios. Cada paso a un sitio vecino cuesta 2 ratos (tres pasos, una franja). Solo ves el sitio donde estás, y la ronda igual.
- **B · barrios** (guardada en el código; se juega con `?prueba=B`). Los mismos sitios en cuatro barrios: dentro del barrio te mueves gratis y lo ves entero; pasar a otro cuesta una franja. La ronda vigila todo su barrio.

Ningún criterio fijado antes de probar separó una de otra: en A nadie contó pasos, en B cruzar pesaba, y la sorpresa con la ronda acabó leyéndose como decisión propia en las dos. Decidió Sergio: A le parece más realista (moverse a cualquier sitio cuesta tiempo) y premia al que aprende. A era más fácil para quien aprende, porque el aviso trae a la ronda a donde pediste y en A esquivarla cuesta 2 ratos; por eso entra **la ronda que aprende** (ver las reglas).

## Las reglas, en corto

Todo está en `rules.js` y la ayuda del juego lo explica.

- **El día:** seis franjas (prima a completas) de seis ratos. Pedir ocupa una franja. Al acabar completas cierran la puerta de la muralla.
- **El pan está dentro y los pobres duermen fuera, en la ribera** (en el puente no se puede dormir). Fuera de la muralla nadie da. Dentro, solo donde hay gente que no es pobre; si hay otros pobres pidiendo, os repartís lo que hay. Desde el día 6, el pan sube y la gente da menos.
- **Lo que ves caduca.** La gente, los pobres y la ronda cambian al empezar cada franja. Lo demás lo sabes de cuando estuviste, y el mapa lo pinta más claro cuanto más viejo.
- **Lo que recuerdas** (botón «Recuerdos» de la cabecera). Un panel que hay que abrir guarda dónde y cuándo has visto a la ronda, dónde has pedido tú (por franjas) y dónde te ha parado. Es la forma de aprender su recorrido de costumbre y de ver la tuya, y lo que heredará el siguiente en el relevo.
- **La ronda:** un recorrido de costumbre (plaza por la mañana, a sexta come, escuelas a nona, Rúa a vísperas, puerta al cerrar), desvíos al azar y, sobre todo, va donde avisan. Quien te ve pedir avisa; en la puerta, las Escuelas y San Martín, enseguida; en San Esteban, nadie.
  - Si te ve pedir, te detiene (con mucha gente, a veces no te ve).
  - Si llegas a donde está, puede pararte: la primera vez te echa de la ciudad; si ya te conoce, te detiene.
  - Quieto, no te para.
  - **Aprende tus costumbres:** si te han visto pedir en el mismo sitio a la misma hora dos días distintos (donde alguien avisa), desde entonces va allí a esa hora 6 de cada 10 veces. No se explica; si te pilla así, el alguacil: «Sabía que te encontraría aquí». En el informe sale como «(tu costumbre)».
- **Detenciones:** cárcel y sin pan; la segunda, azotes; la tercera, destierro (fin).
- **Trabajo:** las obras de la catedral cogen peones a prima los días laborables, por 2 pedazos y cansancio (−1 de cuerpo esa noche). Con el cuerpo bajo es más difícil que te cojan. Ninguna de las dos cosas se dice antes: se aprende («Tus brazos no me valen, muchacho»). Desde la ribera no se llega a tiempo: hay que haber dormido dentro.
- **La noche:** ración entera (2 pedazos) +1 de cuerpo, media −1, nada −2. Dormir dentro ahorra el camino, pero la ronda de noche va donde ha habido quejas: donde te vieron pedir ese día (1 de 3; fichado, 1 de 2), donde otros pobres pidieron en dos franjas o más (1 de 6; fichado, 1 de 4) y, donde nadie se quejó, menos (1 de 12; fichado, 1 de 8). El juego no lo explica: lo que sabes está en el mapa (dónde te vieron pedir, dónde viste otros pobres) y, si te detienen, lo dice el alguacil («Ya me han dicho que andabas pidiendo por aquí»; «Venimos a limpiar esto de pordioseros»). Si fue la ronda de costumbre, no dice nada.

**Principio (Sergio):** la información la dan los personajes y el mundo, y el jugador la interpreta; nada de una voz en off que lleve de la mano. Pendiente: recortar «Antes de actuar» con ese criterio después de esta tanda de pruebas.
- **Objetivo:** aguantar diez días (1 a 10 de junio de 1545; el 4 es Corpus Christi y el 7, domingo) hasta la siega, que empieza el 11. En la siega el mayoral coge segadores según el cuerpo (con 4 o más, seguro; con 3, a veces; con menos, no). La cifra no se dice: «Tus brazos no me valen». Así, llegar con lo justo no es lo mismo que llegar entero.

**Licencias históricas** (también en la ayuda): la ronda y su recorrido son invención; que en San Esteban nadie avise sale de que Soto, su prior, escribió contra la orden, sin documento que lo diga; la limosna va en pan y no en dinero para no meter el mercado en esta prueba; las cifras son del juego.

**Bots (j0.6, 1.000 partidas cada uno; no es un objetivo de dificultad).** Llegan a la siega, con siega o sin ella:

| Bot | j0.4 (sin la ronda que aprende) | j0.6 |
|---|---|---|
| Escondido en la ribera | 0 % | 0 % |
| Novato (no conoce la ciudad) | 33 % | 19 % |
| Veterano (conoce horarios y ronda; cambia de rutina si se la aprenden) | 48 % | 50 % |
| Prudente (como el veterano, pesa el triple el riesgo) | 67 % | 51 % |
| Veterano y prudente que no cambian de rutina | 48 % y 67 % | 27 % y 37 % |
| Duerme siempre dentro, eligiendo sitio | 42 % | 37 % |

Repetir rutina se paga; darse cuenta y cambiarla compensa.

## La llaga (j0.7; se activa al empezar)

Fingir entra por la llaga, decidido el 30 de octubre de 2026. Sale de Robles (Salamanca, 1545): «la llaga de la pierna le es un Perú», y al que ve con una llaga la justicia «no le puede preguntar más». Y de la vuelta que le da Soto con san Juan Crisóstomo: «si el pobre finge alguna lesión, por necesidad y menester grande la finge, por causa de tu crueldad». **Se activa con el botón «Activar llaga» de la pantalla de inicio** (se recuerda en el móvil). Sin activarla, la partida es igual que la j0.6, con los mismos números en los bots; así se puede probar desde la app instalada y no se mezcla con las pruebas de la j0.6. El informe dice si estaba activada y si se la hizo. Los agentes juegan sin ella.

- **Cómo.** De noche en la ribera, una sola vez y para siempre. Lo enseña un viejo que duerme allí: «Esta me da de comer». Lo que cuesta no lo dice nadie; lo dicen el capataz, el alguacil y el mayoral.
- **Lo que da.** La tirada de limosna sube 1. Las tres primeras veces que llegas a donde está la ronda, el alguacil te mira la pierna y sigue su camino. A la cuarta ya no le vale: «Otra vez tú, el de la pierna. Esa llaga ya me la sé».
- **Lo que cuesta.** Esa noche, fiebre (−1 de cuerpo). El cuerpo ya no pasa de 5. Cada noche siguiente, una de cada tres se encona (−1). Ni las obras ni el mayoral te cogen: el final es aguantar sin siega.
- **Palancas** en `PARAMS.llaga`: `limosna`, `cuerpo`, `cuerpoMax`, `encona`, `parar`, `protege`, `pillar`, `noche`.

**Calibrado con bots** (`LLAGA=1 node herramientas/bot.js 2000`; juegan como el veterano). Por parejas con la misma semilla, solo en las partidas en que el bot se hizo la llaga:

| Cuándo se la hace | Llega con llaga | El veterano sin llaga llega | De ellos, con siega |
|---|---|---|---|
| La primera noche | 53 % | 49 % | 30 % |
| Desde el día 3 | 59 % | 52 % | 31 % |
| Desde el día 5 | 65 % | 56 % | 34 % |
| Desde el día 7 | 78 % | 67 % | 41 % |
| En apuros (desde el día 4, cuerpo ≤ 2 o dos detenciones) | 54 % | 43 % | 22 % |

Hacérsela pronto casi no salva y pierde la siega. Tarde, y sobre todo en apuros, salva unos 11 de cada 100 a cambio de una siega que ya era difícil. Se llegó aquí tras descartar dos versiones:

- **Protección para siempre** (más limosna y el alguacil no te para nunca): hacérsela la primera noche llegaba al 97 %. Quitaba las dos formas de morir y, después de hacérsela, la partida ya no tenía tensión.
- **Protección a medias** (el alguacil te para la mitad de las veces): como protege lo mismo cada día, el momento daba igual. Cuando la llaga temprana quedaba igualada con no hacérsela, la tardía tampoco ayudaba.

Con la protección que se gasta, la hecha pronto la gasta pronto y la hecha en apuros la guarda para el final.

**Del núcleo, de paso:** casi todas las detenciones del veterano (1,4 por partida) son por llegar a donde está la ronda cuando ya te tiene fichado. Pidiendo, solo 0,15; de noche, 0,22 (`DESGLOSE=1`).

## El informe

Al acabar (o al abandonar), cinco preguntas y el informe: la partida entera, el tiempo repartido entre moverse, pedir, trabajar y esperar, los pasos o cruces por día, las veces que llegó donde estaba la ronda, la crónica, dónde estuvo la ronda en cada franja (que el jugador no veía) y los datos en bruto.

- **Móvil:** «Compartir informe» adjunta un `.txt` y deja elegir la app de correo.
- **Ordenador:** «Descargar» y luego «Abrir el correo», y adjunta el archivo.

El correo de destino está en `rules.js` (`CONFIG.email`); en GitHub Pages queda a la vista.

## Cambiar reglas

Todo en `rules.js`. **Cada vez que cambies algo, sube la versión en dos sitios**, o los móviles seguirán con la copia vieja:

1. `rules.js` → `version: "j0.7"`, por ejemplo a `"j0.8"`.
2. `sw.js` → `const VERSION = "lv-j0.7-1"`, por ejemplo a `"lv-j0.8-1"`.

## Probarlo en local

```
python3 -m http.server 8000
```

y abre `http://localhost:8000`. Con `?semilla=7` la partida nueva sale siempre igual.

## Herramientas

- `herramientas/bot.js`: siete bots (escondido, azar, novato, veterano, prudente y dos que duermen siempre dentro: uno elige dónde y otro no) que juegan miles de partidas con el motor real y sacan porcentajes. `node herramientas/bot.js 1000` (solo A; `PRUEBAS=A,B` para las dos; `RUTINA=1` para que el veterano y el prudente no se den cuenta de que la ronda aprende). Admite palancas para probar cambios sin tocar `rules.js`. No son personas: sirven para ver si una regla rompe algo, no para fijar la dificultad.
- `herramientas/agentes/`: agentes de Claude que juegan la app real y escriben un diario (`/agentes prueba` desde Claude Code). Ver su README.
