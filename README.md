# Liber Vagatorum · el juguete (j0.2)

Prueba mínima del núcleo del juego, tras el replanteamiento de octubre de 2026: **un mendigo, una necesidad (el hambre) y una amenaza (la ronda)**. Nada más: ni los tuyos, ni el relevo, ni tretas, ni exámenes. Si el núcleo solo no obliga a exponerse para comer, los sistemas de encima no lo van a arreglar.

Es una página estática, sin servidor, instalable en el móvil y jugable sin conexión. Se publica en GitHub Pages desde `main`: https://sergogza.github.io/jueguito/

**El prototipo anterior (v0.5a)** está entero en la rama `archivo-v0.5a`, con su bot y sus simulaciones.

## Qué se prueba: A contra B

Las dos versiones de la ciudad tienen los mismos sitios, la misma gente, la misma ronda y el mismo pan. Solo cambia el grano del movimiento:

- **A · calles.** Diez sitios. Cada paso a un sitio vecino cuesta 2 ratos (tres pasos, una franja). Solo ves el sitio donde estás, y la ronda igual.
- **B · barrios.** Los mismos diez sitios en cuatro barrios. Dentro de tu barrio te mueves sin gastar tiempo y lo ves entero; pasar a otro barrio cuesta una franja. La ronda ve igual que tú: todo su barrio.

Criterios fijados antes de probar, y dónde mirarlos en el informe:

| Criterio | Dónde se ve |
|---|---|
| Gana B si en A la gente cuenta pasos y optimiza rutas | Pregunta 2 («¿cómo decidías adónde ir?») y el tiempo moviéndose |
| Gana A si en B cruzar no pesa (cruzan siempre, o nunca) | Cruces por día, en la tabla «Por día» |
| En las dos: ¿la sorpresa se lee como mala decisión o como mala suerte? | Pregunta 3 y las veces que llegó donde estaba la ronda |

Con la misma semilla (`?semilla=N`), la ciudad es la misma en A y en B.

## Las reglas, en corto

Todo está en `rules.js` y la ayuda del juego lo explica.

- **El día:** seis franjas (prima a completas) de seis ratos. Pedir ocupa una franja. Al acabar completas cierran la puerta de la muralla.
- **El pan está dentro y los pobres duermen fuera.** Fuera de la muralla nadie da. Dentro, solo donde hay gente que no es pobre; si hay otros pobres pidiendo, os repartís lo que hay. Desde el día 6, el pan sube y la gente da menos.
- **Lo que ves caduca.** La gente, los pobres y la ronda cambian al empezar cada franja. Lo demás lo sabes de cuando estuviste, y el mapa lo pinta más claro cuanto más viejo.
- **Lo que recuerdas.** Un panel que hay que abrir guarda dónde y cuándo has visto a la ronda, por franjas, y dónde te ha parado. Es la forma de aprender su recorrido de costumbre, y lo que heredará el siguiente en el relevo.
- **La ronda:** un recorrido de costumbre (plaza por la mañana, a sexta come, escuelas a nona, Rúa a vísperas, puerta al cerrar), desvíos al azar y, sobre todo, va donde avisan. Quien te ve pedir avisa; en la puerta, las Escuelas y San Martín, enseguida; en San Esteban, nadie.
  - Si te ve pedir, te detiene (con mucha gente, a veces no te ve). En B vigila todo su barrio, y el mapa lo pinta entero.
  - Si llegas a donde está, puede pararte: la primera vez te echa de la ciudad; si ya te conoce, te detiene.
  - Quieto, no te para.
- **Detenciones:** cárcel y sin pan; la segunda, azotes; la tercera, destierro (fin).
- **Trabajo:** las obras de la catedral cogen peones a prima los días laborables, por 2 pedazos y cansancio (−1 de cuerpo esa noche). Con el cuerpo bajo es más difícil que te cojan. Ninguna de las dos cosas se dice antes: se aprende («Tus brazos no me valen, muchacho»). Desde la ribera no se llega a tiempo: hay que haber dormido dentro.
- **La noche:** ración entera (2 pedazos) +1 de cuerpo, media −1, nada −2. Dormir dentro ahorra el camino de la mañana, pero la ronda de noche puede encontrarte.
- **Objetivo:** aguantar diez días (1 a 10 de junio de 1545; el 4 es Corpus Christi y el 7, domingo).

**Licencias históricas** (también en la ayuda): la ronda y su recorrido son invención; que en San Esteban nadie avise sale de que Soto, su prior, escribió contra la orden, sin documento que lo diga; la limosna va en pan y no en dinero para no meter el mercado en esta prueba; las cifras son del juego.

**Comprobación gruesa (no es un objetivo de dificultad).** Con un bot que ya conoce los horarios y el recorrido de la ronda: quien se esconde en la ribera muere de hambre el día 3 siempre, quien juega al azar no aguanta nunca, y el bot aguanta entre la mitad y dos tercios de las partidas en las dos pruebas. En A le pierde la ronda (le paran al llegar); en B, el hambre. Una persona que juega por primera vez no sabe lo que sabe el bot.

## El informe

Al acabar (o al abandonar), cinco preguntas y el informe: la partida entera, el tiempo repartido entre moverse, pedir, trabajar y esperar, los pasos o cruces por día, las veces que llegó donde estaba la ronda, la crónica, dónde estuvo la ronda en cada franja (que el jugador no veía) y los datos en bruto.

- **Móvil:** «Compartir informe» adjunta un `.txt` y deja elegir la app de correo.
- **Ordenador:** «Descargar» y luego «Abrir el correo», y adjunta el archivo.

El correo de destino está en `rules.js` (`CONFIG.email`); en GitHub Pages queda a la vista.

## Cambiar reglas

Todo en `rules.js`. **Cada vez que cambies algo, sube la versión en dos sitios**, o los móviles seguirán con la copia vieja:

1. `rules.js` → `version: "j0.2"`, por ejemplo a `"j0.3"`.
2. `sw.js` → `const VERSION = "lv-j0.2-1"`, por ejemplo a `"lv-j0.3-1"`.

## Probarlo en local

```
python3 -m http.server 8000
```

y abre `http://localhost:8000`. Con `?semilla=7` la partida nueva sale siempre igual.

## Herramientas

`herramientas/agentes/`: agentes de Claude que juegan la app real y escriben un diario (`/agentes prueba` desde Claude Code). Ver su README.
