# Juego 2D con moñigotes (rama `claude/juego2d`)

25 de noviembre de 2026. Prototipo de videojuego pedido por Sergio, con lo que decidió ese día en `claude/videojuego-escenas.md`: Salamanca en escenas de perfil unidas por salidas, y un mapa para ir lejos. Qué se quiere probar: si funciona como videojuego y si se entiende sin leer texto en cada turno. No cambia ninguna regla. Sale de `claude/vista`.

**Para jugar (en el ordenador):** https://raw.githack.com/SergoGza/jueguito/claude/juego2d/juego.html. Con `?semilla=N` la partida sale siempre igual.

## Qué hay

- **Una página nueva** (`juego.html`, `juego.js`, `juego-mapa.js`, `juego.css`) que carga `rules.js` y `engine.js` tal cual. El motor no se ha tocado: no hizo falta ninguna lectura nueva; vale la de la vista (`ENGINE.vista.pobresAjenos`). Phaser 3.90 va copiado en `lib/`, con su licencia MIT.
- **Doce escenas de perfil**, una por sitio, más anchas que la pantalla las grandes (la plaza, 2,3 pantallas; la Rúa, 1,9; la catedral, 1,7). Andas con ← → o A y D, o haciendo clic en el suelo, sin que pase el tiempo.
- **Las salidas son los caminos de las reglas, ni uno más**:
  - en los extremos sales al llegar al borde;
  - en una puerta al fondo, con W o ↑ delante de ella, o con un clic.
  - Cada una es un `mover` del motor (2 ratos), con un letrero que dice adónde lleva. Al acercarte: «Plaza · 2 ratos» o «no te da tiempo».
  - Las puertas de la muralla son arcos al fondo.
- **El menú (E o clic en ti)**: pedir, pedir trabajo, hurtar, esperar, acabar el día y mirar el sitio, con su coste. Al pasar el ratón, lo que decía «Antes de actuar». Se elige con el ratón o con 1-6.
- **Los resultados** («Te dan algo», «Te para la ronda») salen en una tarjeta encima de la escena, con los textos del motor. Los malos piden Intro; los demás se quitan al echar a andar. Si la ronda te echa al puente, la tarjeta sale en la escena donde te paró y, al seguir, apareces en el puente.
- **El mapa (M)** es el plano de la vista con lo que sabes:
  - lo de ahora, y lo de antes más claro;
  - la ronda donde la viste por última vez;
  - quién avisa y dónde te vieron pedir.
  
  Tocas adónde ir y, si quieres otro camino, antes un sitio por el que pasar. Dice cuántos pasos y ratos son y a qué hora llegas. Con «Ir», los mismos pasos de una vez. El viaje se para en el primer sitio donde te para la ronda, la ves o no te da tiempo de seguir, y ahí apareces, en esa escena.
- **En la escena, solo lo que ya hay:**
  - la gente según cuánta hay, vestida según quién es (estudiantes con bonete, frailes de blanco y negro, viajeros con hatillo, compradoras con cesta…);
  - los de paso, andando;
  - los otros pobres, sentados con el cuenco;
  - Pedro y Catalina, con su nombre;
  - la ronda (el alguacil de negro con golilla y vara, y dos corchetes con casco y pica), con un «!» encima;
  - el vecino asomado: con marco rojo y el puño en alto si te vieron pedir ahí hoy, y en gris si se quejaron de otro;
  - quien avisa enseguida, con un ojo encima: el portero, el bedel y el cura;
  - el capataz junto al andamio de la catedral, cuando cogen peones;
  - los puestos de la plaza a sus horas;
  - banderines el día del Corpus.
- **Al acercarte** a algo sale su línea, con los textos del juguete. Al tocar las fachadas, lo que sabes del sitio y lo que recuerdas de él.
- **HUD:** el día, la fecha, el sitio, las seis campanas (suena la de la franja nueva) con los ratos de la franja, el cuerpo, el pan, las detenciones y «te conocen». Botones Hacer (E), Mapa (M), Recuerdos (R), la ayuda y el menú.
- **La luz y el cielo** cambian con la franja.
- **Las demás pantallas** son las del juguete, como pantallas de menú: inicio, amanecer (Intro para empezar el día), noche, relevo, siega e invierno, y final con la encuesta. La partida se guarda aparte de la del juguete y de la vista.
- **El informe** es el del motor, con cuatro líneas delante:
  - «Juego 2D»;
  - lo andado: pasos del motor, salidas por el borde y por la puerta, pasos y viajes con el mapa y por qué paró cada viaje;
  - lo de las escenas: tiempo, píxeles andados, a qué se acercó, qué tocó, menú y Recuerdos;
  - la respuesta a una pregunta nueva de la encuesta: «¿Qué no supiste leer en las escenas o en el mapa? ¿Andar por las escenas era mirar o un trámite?».

## Lo que decidió Claude al montarlo [Claude, 25-nov, sin revisar]

- **La ronda entra por la salida del lado de donde venía**, como dice la decisión 2, y **se va por una calleja** que no lleva a ningún sitio vecino. Así no dice adónde va; lo contrario cambiaría lo que sabes. Se lo pregunté a Sergio el 25-nov y respondió «sin preferencia». Se cambia en una línea (`animarCambios`).
- **Cada camino tiene sus salidas en lados opuestos** (o una es puerta al fondo): si sales por la izquierda, entras por la derecha. La primera versión tenía la catedral y la Rúa del mismo lado, y con la tecla pulsada se volvía a salir.
- **Al llegar a una escena, el borde no te saca hasta que sueltas la tecla.** Así cada salida (2 ratos) es un gesto, no una tecla que se queda pulsada.
- **Si la ronda está en la escena pero fuera de cuadro**, sale un aviso «! ▶» en el borde de la pantalla. Sin él, en la plaza no la veías.
- **El viaje del mapa también para si no te da tiempo** de dar el paso siguiente.
- **Los textos son los del juguete**, salvo los de interfaz: la ayuda de los mandos y de quién es quién, los letreros de las salidas, «· 2 ratos», «no te da tiempo», «Lo viste a tercia: …», «Aquí viste a la ronda por última vez…», «Aquí avisan enseguida a la ronda (el portero)», el resumen del camino en el mapa y la pregunta nueva de la encuesta.
- **Los colores y las siluetas** son para distinguir quién es quién, no un estilo: los canónigos van en pardo y no en negro, para que no se confundan con el alguacil.

## Probado

- **En Chrome sin pantalla, a 1280 × 800:** siete partidas enteras jugadas con teclado, menú y mapa (con los tuyos y, a veces, llaga, varios veranos y hurtar). Ningún error. Cada salida llega adonde lleva, y los viajes paran donde deben: por la ronda, por la noche, porque no da tiempo o porque te paró. Miré capturas de la ribera, el puente, la Puerta del Río, la catedral, las Escuelas, la plaza y San Esteban, con la ronda, los tuyos, el vecino y los resultados.
- **En el móvil**, solo de prueba a 844 × 390 y 390 × 844: tocando se anda y se sale, y los botones abren el menú y el mapa. En horizontal se juega justo; en vertical la escena queda en una franja y sale un aviso para girarlo.
- **No probado** en un ordenador ni en un móvil de verdad, ni en Firefox ni en Safari. Phaser usa WebGL; sin él, dibuja en canvas.
- **No he jugado yo con el teclado:** lo que digo del andar sale de los anchos de las escenas y de los bots, no de haberlo sentido.

## Cuánto se anda (valoración de Claude)

**Lo medido.** Se anda a 330 px por segundo. Cruzar una escena de una salida a otra:
- de 2 a 3 segundos el puente, las puertas y la Puerta de San Pablo;
- unos 5 la orilla, las Escuelas, San Martín, la calle de San Pablo y San Esteban;
- hasta 6 la catedral y 7 la Rúa;
- casi 9 la plaza de punta a punta.

De la ribera a la catedral por las salidas son unos 7 segundos con la tecla pulsada y tres escenas (6 ratos). Con el mapa, un clic e Intro. El veterano de los bots da 7,1 pasos al día: por las salidas serían de 20 a 40 segundos al día con la tecla pulsada.

**Si andar es mirar o trámite.** Lo que hace falta para decidir se ve al llegar, sin andar: la gente, los pobres, la ronda, el vecino y quién avisa. Andar dentro de una escena sirve para:
- leer lo que dice cada cosa al acercarte;
- descubrir lo que queda fuera de cuadro en las escenas anchas (la plaza, la Rúa, la catedral), para lo que está el aviso del borde con la ronda;
- llegar a la salida.

Mi previsión: en las escenas pequeñas y en el camino de la ribera a la puerta, andar será trámite y se usará el mapa. En la plaza y la Rúa, andar es mirar las primeras veces y trámite cuando ya sabes qué hay.

**Cuántas veces se usa el mapa.** No lo sé: en mis pruebas lo decidía un guion al azar. Lo dirá el informe de la primera partida de Sergio, con los viajes, los pasos con el mapa frente a los de las salidas, y los segundos y píxeles andados.

## Qué falta

- **Sin tretas ni presión**, como se pidió. Por eso no está «de noche, en la ribera, quien ofrece tretas» de la decisión 4. Para juntarlo con `claude/tretas` harían falta:
  - el guarda, los diputados y los alguaciles del Estudio como muñecos en su sitio, que el viaje también pare con «el guarda no te deja pasar»;
  - las llaves y las blancas en el HUD;
  - la tienda en el menú.
- **Nada nuevo fuera de la muralla:** los carros, el ciego y los segadores van después.
- **La noche, el viejo de la llaga y lo que cuentan los tuyos** siguen en texto, en la pantalla de la noche.
- **Sin sonido.** Las campanas solo se mueven.
- **No se instala ni funciona sin conexión.** Phaser pesa 1,2 MB.
- **Solo la prueba A.** La ronda no se ve moverse por la ciudad (solo ves donde estás).

## Qué mirar al jugar

1. **El primer minuto sin leer la ayuda:** si se entiende que andar no gasta y salir sí, y dónde están las salidas.
2. **Si la ronda, el vecino asomado y el del ojo se leen de un vistazo**, sin acercarte ni tocar.
3. **Si te acercas a la gente para leer su línea**, o si la línea de cada cosa sobra.
4. **El camino de la ribera a la puerta:** si lo andas o abres el mapa, y desde qué día.
5. **Si el viaje del mapa que para al ver a la ronda se entiende**, o se siente como un corte.
6. **En la plaza y la Rúa**, si andar es mirar o es trámite.

## Cómo probarlo con alguien que no conoce el juego

**Qué decirle, lo mínimo:**

> Eres un pobre en la Salamanca de 1545. Aguanta diez días hasta la siega. Pedir está prohibido. Andas con las flechas; con E ves qué puedes hacer; con M, el mapa. Di en voz alta lo que piensas.

Que empiece sin activar nada en el inicio.

**Qué apuntar:**

- **El principio:** cuánto tarda en salir de la ribera y si descubre solo las puertas del fondo.
- **Qué cree que es cada muñeco** cuando lo dice en voz alta, sobre todo la ronda, los corchetes, el del ojo y el vecino.
- **La primera vez que ve a la ronda:** qué hace.
- **Cuándo abre el mapa por primera vez, y para qué.**
- **Cuándo deja de acercarse a la gente** a leer.
- **Al acabar:** que conteste la primera pregunta de la encuesta y te mande el informe.
