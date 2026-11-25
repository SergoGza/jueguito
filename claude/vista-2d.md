# Vista 2D del juguete (rama `claude/vista`)

25 de noviembre de 2026. Prueba de pantalla pedida por Sergio: si el juego se entiende y se juega mejor viendo la ciudad que leyéndola. No cambia ninguna regla. No toca `main` ni `estado.md`.

**Para jugar:** https://raw.githack.com/SergoGza/jueguito/claude/vista/vista.html (en el móvil o en el ordenador; con `?semilla=N` la partida sale siempre igual).

## Qué hay

- **Una página nueva** (`vista.html`, `vista.js`, `vista.css`) que carga `rules.js` y `engine.js` tal cual. El juguete de siempre (`index.html`, `app.js`) no cambia.
- **El plano de Salamanca**, dibujado más o menos donde estaba cada cosa y sin escala: el Tormes, el puente romano, la muralla con la Puerta del Río y la de San Pablo, y los doce sitios unidos por sus caminos.
- **Moñigotes:**
  - tú, que andas de un sitio a otro;
  - la gente, según cuánta hay (uno claro de paso, tres si hay poca, siete si hay mucha);
  - los otros pobres, sentados con el cuenco;
  - Pedro y Catalina, con su inicial, cuando coincidís, de pie o pidiendo;
  - la ronda (el alguacil con su vara y dos corchetes) donde la ves, con un «!» y el sitio latiendo en rojo; donde la viste por última vez, más clara;
  - un vecino asomado donde se han quejado: en rojo si te vieron pedir ahí hoy (se ve desde cualquier sitio), y en gris si fue otro (solo donde estás);
  - quien avisa enseguida (el portero, el bedel, el cura), con un ojo encima;
  - el capataz cuando las obras cogen peones;
  - los puestos de la plaza a sus horas;
  - banderines el día del Corpus.
- **Lo que no ves ahora** es lo último que viste: más claro si fue antes hoy, casi borrado si fue ayer o antes. Lo que no has visto nunca es solo el edificio, con el borde a trazos.
- **La luz de cada franja** tiñe la escena, de la mañana rosada a completas azulada.
- **Al tocar:** el primer toque en un sitio abre una tarjeta (lo que ves o recuerdas con su edad, lo que decía «Antes de actuar», la descripción del sitio y lo que recuerdas de él: a qué horas viste allí la ronda, dónde pediste, lo que te contaron); el segundo toque en el mismo sitio, o el botón «Ir · 2 ratos», te lleva [opción A, Sergio, 25-nov]. Tocar un muñeco abre la misma tarjeta con su frase arriba. En el móvil la tarjeta va arriba o abajo para no tapar el sitio del que habla; en pantalla ancha, a la derecha.
- **Los resultados** («Te dan algo», «Te para la ronda»…) salen en una tarjeta encima de la escena, con los mismos textos del motor. Los malos piden «Seguir»; los demás se quitan al hacer lo siguiente. Cuando te dan pan, sale «+N» sobre ti.
- **Lo demás** (inicio, amanecer, noche, relevo, invierno, final, Recuerdos y la ayuda) son las pantallas del juguete, copiadas. La ayuda trae la leyenda dibujada.
- **La partida se guarda aparte** de la del juguete, y también los botones de llaga, los tuyos, varios veranos y hurtar.
- **El informe** es el del motor con tres líneas delante:
  - «Vista 2D»;
  - los toques: ir (con el segundo toque o con el botón), abrir un vecino, tu sitio u otro sitio, tocar un muñeco, cerrar la tarjeta, acciones y Recuerdos;
  - la respuesta a una pregunta nueva de la encuesta: «¿Qué no supiste leer en el plano? ¿Qué tuviste que tocar para entenderlo?».

## El motor

Una sola lectura nueva, `ENGINE.vista.pobresAjenos`, porque `estado().pobres` cuenta juntos a los otros pobres y a los tuyos que piden, y la vista los dibuja aparte. Va detrás del bloque de exportaciones, sin tocarlo, para que no choque con `claude/tretas`. Solo lee.

**Comprobado:** `bot.js` da exactamente lo mismo antes y después en cinco tandas (A, TUYOS, CADENA, CADENA con HURTO=apuro, LLAGA), y 400 partidas con todo activado acaban en el mismo estado, byte a byte, que con el motor de `main`.

## Cambios sobre la lista que viste [Claude, 25-nov, sin revisar]

- **La tarjeta sube o baja según el sitio.** Abajo tapaba la ribera y el puente, que es donde empiezas cada día.
- **Lo visto ayer o antes, casi borrado (20 %).** Con más opacidad, a los pocos días el plano se llenaba de gente vieja que se leía como de ahora.
- **Los puestos de la plaza se ven siempre a sus horas**, aunque no estés allí, porque lo sabe cualquiera; los de la Rúa, solo con hurtar.
- **Los muñecos van a 1,5 veces el tamaño dibujado**, porque en el móvil no se veían.

## Qué falta

- **Probado solo en Chrome sin pantalla**, a 390 × 780 y 1280 × 800, en tema claro y oscuro: 8 partidas enteras jugadas tocando (con llaga, los tuyos, varios veranos y hurtar), sin un error y llegando cada paso adonde se tocó. **No probado en un móvil de verdad, ni en Safari ni en iPhone.** La luz usa `mix-blend-mode` y `100dvh`; en un navegador viejo puede salir mal.
- **Solo la prueba A.** Sin tretas ni presión. Para juntarla con `claude/tretas` harían falta:
  - el guarda, los diputados y los alguaciles del Estudio como muñecos en su sitio y a su hora;
  - las llaves y la ropa buena encima de tu muñeco;
  - las blancas en la cabecera;
  - la tienda y la posada en la tarjeta del sitio.
- **No se instala ni funciona sin conexión** (no tiene `manifest` ni `service worker`).
- **La ronda no se ve moverse por la ciudad**, como en las reglas (solo ves donde estás). Cuando llega adonde estás quieto, entra andando.
- **Los textos de las tarjetas son los del juguete.** No he escrito ninguno nuevo salvo la leyenda, la pista del primer día («Toca un sitio para ver lo que sabes de él. Tócalo otra vez para ir»), «A N pasos», «Lo viste a tercia: …», «Aquí viste a la ronda por última vez…» y «Aquí avisan enseguida a la ronda (el portero)».

## El andar se nota (aviso de Claude)

- **Medido en el grafo de caminos:** el sitio de dentro más cercano a la ribera es la catedral, a 3 pasos. Ir y volver son 6 pasos al día como mínimo, 12 toques con la opción A, antes de decidir nada. La plaza está a 5 pasos: 20 toques ir y volver.
- **Con los bots** (j0.13, 500 partidas): el veterano anda 7,1 pasos al día y el novato 9,3. Son unos 14-19 toques al día solo para andar, frente a 3 o 4 para pedir, esperar o acabar el día. Más o menos el 80 % de los toques de la escena son de andar.
- **En la vista, cada paso es un toque para mirar y otro para ir, con su animación.** No lo he tapado: ni andar varios pasos de un toque ni saltarse la ribera.
- Andar varios pasos de un toque sería fácil y no tocaría las reglas (serían varios `mover` seguidos, parando si pasa algo). Pero escondería justo lo que dice el diagnóstico: que andar casi no decide. Si se hace, es una decisión de diseño, no de pantalla.

## Qué mirar al jugar

1. Si dejas de abrir Recuerdos y la tarjeta de tu sitio. Lo dice el informe, en los toques.
2. Si la ronda, el guarda de cada sitio y los vecinos asomados se leen sin tocar, o si hay que tocarlos para saber qué son.
3. Si lo visto antes (más claro) se confunde con lo de ahora.
4. Si el primer toque en un vecino, el que abre la tarjeta, se lee o se salta.
5. Cuántos toques de andar te sobran al día, y si te aburren o te dan tiempo a pensar.

## Cómo probarlo con alguien que no conoce el juego

**Qué decirle, lo mínimo:**

> Eres un pobre en la Salamanca de 1545. Tienes que aguantar diez días hasta la siega. Pedir está prohibido. Toca la pantalla para moverte y mirar; los botones de abajo son lo que puedes hacer. No te voy a ayudar: di en voz alta lo que piensas.

Nada más: ni qué es la ronda, ni qué hace el vecino, ni el «?». Que juegue sin botones activados en el inicio (ni los tuyos ni lo demás), para que el plano tenga lo justo.

**Qué apuntar mientras juega:**

- **El primer minuto:** qué toca primero, si descubre solo que el segundo toque lleva, y cuánto tarda en salir de la ribera.
- **Cada vez que se para a mirar sin tocar:** qué mira, y si dice qué cree que es (la ronda, la gente, el vecino, el ojo, lo más claro).
- **Lo que interpreta mal en voz alta** («esos son guardias» por los pobres, «ahí no hay nadie» por lo desvaído…).
- **La primera vez que ve a la ronda:** qué hace (se va, se queda quieto, pide igual).
- **Si abre la ayuda, Recuerdos o una tarjeta, y en qué momento.**
- **Cuándo se cansa de andar o lo dice.**
- **Al acabar:** que conteste la encuesta, sobre todo la primera pregunta, la del plano, y te mande el informe (los toques van dentro).
