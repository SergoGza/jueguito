# Juego 2D con moñigotes (rama `claude/juego2d`)

25 de noviembre de 2026. Prototipo de videojuego pedido por Sergio, con lo que decidió ese día en `claude/videojuego-escenas.md`: Salamanca en escenas de perfil unidas por salidas, y un mapa para ir lejos. Qué se quiere probar: si funciona como videojuego y si se entiende sin leer texto en cada turno. No cambia ninguna regla. Sale de `claude/vista`. El 26-nov, a petición de Sergio, se le juntó la rama `claude/tretas` tal como quedó el 25-nov: las tretas, la presión (los cierres) y el relevo A (apartado «Tretas y presión»).

**Para jugar (en el ordenador):** https://raw.githack.com/SergoGza/jueguito/claude/juego2d/juego.html. Con `?semilla=N` la partida sale siempre igual.

## Qué hay

- **Una página nueva** (`juego.html`, `juego.js`, `juego-mapa.js`, `juego.css`) que carga `rules.js` y `engine.js` tal cual. Desde el 26-nov el motor es el de `claude/tretas` más la lectura de la vista (`ENGINE.vista.pobresAjenos`), que es lo único que añade y no cambia nada. Como `claude/tretas` trae el relevo A, en la cadena el heredero juega lo que queda de verano, también sin los botones nuevos. Phaser 3.90 va copiado en `lib/`, con su licencia MIT.
- **Doce escenas de perfil**, una por sitio. Las grandes son más anchas que la pantalla (la plaza, 1,5 pantallas; la Rúa y la catedral, 1,3); las de paso caben en una (la ribera, el puente, la orilla, las dos puertas y San Martín). Andas con ← → o A y D, o haciendo clic en el suelo, sin que pase el tiempo.
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

## Tretas y presión (26-nov)

Los botones «Activar tretas» y «Activar presión» del inicio, como en el juguete de la rama `claude/tretas`. Las reglas son las de esa rama; aquí solo se ponen en las escenas.

- **Los que venden, en su sitio y a sus horas**, cada uno con lo suyo en la mano:
  - el estudiante pobre de las Escuelas, con cartas y manteos;
  - el buhonero de la plaza, con pliegos;
  - el mozo de Argel de la Puerta del Río, con cadenas;
  - el ropavejero de la Rúa, con ropa.
  
  Al acercarte dice qué vende y por cuánto. Lo que dice de cada cosa (para qué sirve), en el menú, al pasar por encima.
- **El pan:** la panadera de la plaza y la Rúa lo vende; la ventera de la Puerta del Río lo compra.
- **El mesón**, con su tablero y su ramo, en la Rúa y la plaza. Al acercarte, lo que cuesta y si el mesonero ya te ha avisado.
- **El menú (E):**
  - pedir con cada treta que llevas (las que no valen aquí, con su porqué);
  - ponerte o quitarte el atrezo;
  - comprar en blancas o en pan (si llevas tres, eligiendo cuál dejas);
  - comprar y vender pan;
  - «Acabar el día» dice si aquí hay mesón.
- **Tú, con el atrezo puesto:** con la ropa buena vas de paño oscuro y golilla; con las cadenas, se ven.
- **«Tus tretas» (T):** las que llevas, si las conocen, las pregonadas para tu gente y dejar una.
- **El HUD** lleva las blancas, en rojo si son más de las que la ronda te deja.
- **La presión, a su hora y en su sitio:**
  - el guarda de la puerta, con alabarda y gorro rojo, junto al arco;
  - los diputados de la parroquia, de golilla, con el libro;
  - los alguaciles del Estudio, de azul, con bonete y vara.
  
  Al acercarte dicen qué hacen y cuál es su llave, con el texto del motor (quién la vende, dónde, a qué hora y por cuánto).
- **En el mapa**, G, D y E junto a su sitio, con su hora (relleno, si es ahora), y en la tarjeta de cada sitio.
- **El guarda cierra la salida:** el letrero dice «el guarda de la puerta no deja pasar a los pobres a esta hora». El viaje del mapa se para ahí, con ese aviso.
- **Los avisos del motor** salen unos segundos arriba:
  - lo que pagas al comprar;
  - «el guarda te mira el paño y te deja pasar»;
  - cruzarte con la ronda sin que te pare.
- **Las pantallas** son las de la rama: el amanecer (el pregón de lo catalogado, los cierres nuevos y los que se mueven, la cita, el Corpus con la ronda de todo el día, despertar tras el mesón), la noche (la posada, la ropa robada, quien ofrece una treta, quedar para el muerto), el relevo A, el final con las tretas usadas y su pregunta, la ayuda, Recuerdos y el informe.

### Lo que decidió Claude al juntarlo [Claude, 26-nov, sin revisar]

- **Dónde se pone cada uno y cómo va vestido**, para que se distinga sin leer.
  - Los que venden y la panadera tienen sitio fijo.
  - El guarda va junto al arco de la puerta.
  - Los diputados y los alguaciles del Estudio van donde se pone la ronda en ese sitio; si está la ronda, a su lado.
- **Las líneas de interfaz** se componen con los textos del motor:
  - lo que dicen el guarda, los diputados y el Estudio, con `llaveTxt`;
  - el que vende, qué y por cuánto;
  - el mesón;
  - la panadera y la ventera.
- **Se ven a su hora, no antes.** El guarda, los diputados y el Estudio solo están en la escena a su hora; antes, solo en el mapa y en el aviso al pedir. Los que venden, a las horas en que venden.
- **El muerto fingido** se hace desde el menú con el tuyo que quedó; en la escena el tuyo no se dibuja tendido.
- **Las ventanas de la noche de los tuyos que no estaban contigo** ya no salen vacías.
- **El menú ya no tiene la transformación de centrado.** Con muchas opciones salía un recuadro negro encima en Chrome sin pantalla; ahora puede ocupar casi toda la altura.

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
- **El 26-nov, con tretas y presión:**
  - nueve partidas enteras jugadas al azar con menú, mapa y salidas, con varios veranos en la mitad;
  - una llevada hasta los tres cierres para fotografiarlos (el guarda no deja pasar; con la ropa buena, sí);
  - una con el muerto fingido y la posada;
  - dos sin los botones, que dan lo mismo que antes.
  
  Ningún error. El bot al azar casi no llega a usar tretas por sí solo, así que en la mitad se le dieron al empezar (es una prueba de pantalla, no de reglas).
- **No he jugado yo con el teclado:** lo que digo del andar sale de los anchos de las escenas y de los bots, no de haberlo sentido.

## Cuánto se anda (valoración de Claude)

**Lo medido.** Se anda a 400 px por segundo. Cruzar una escena de una salida a otra:
- unos 3 segundos las que caben en una pantalla (la ribera, el puente, la orilla, las dos puertas y San Martín) y algo más las Escuelas, la calle de San Pablo y San Esteban;
- unos 4 la catedral y la Rúa;
- unos 4,5 la plaza de punta a punta.
- Desde el puente, la puerta del fondo está a un segundo y medio.

De la ribera a la catedral por las salidas son unos 4,5 segundos con la tecla pulsada y tres escenas (6 ratos). Con el mapa, un clic e Intro. El veterano de los bots da 7,1 pasos al día: por las salidas serían de 15 a 25 segundos al día con la tecla pulsada.

**Lo que cambió el 26-nov.** Sergio, al jugarlo: le gusta, pero los sitios son demasiado largos; sirven para ver cómo funciona y qué hay, pero a veces el recorrido de una salida a otra se hace largo [Sergio, 26-nov]. Las escenas eran de 1,15 a 2,3 pantallas y se andaba a 330 px por segundo (la plaza, casi 9 segundos; de la ribera a la catedral, unos 7). Ahora son de 1 a 1,5 pantallas y se anda a 400 [Claude, 26-nov, sin revisar]: las travesías largas quedan en la mitad. Lo que hay en cada escena está en el mismo sitio relativo; la gente se reparte en menos ancho, con la misma densidad.

**Si andar es mirar o trámite.** Lo que hace falta para decidir se ve al llegar, sin andar: la gente, los pobres, la ronda, el vecino y quién avisa. Andar dentro de una escena sirve para:
- leer lo que dice cada cosa al acercarte;
- descubrir lo que queda fuera de cuadro en las escenas anchas (la plaza, la Rúa, la catedral), para lo que está el aviso del borde con la ronda;
- llegar a la salida.

Mi previsión: en las escenas pequeñas y en el camino de la ribera a la puerta, andar será trámite y se usará el mapa. En la plaza y la Rúa, andar es mirar las primeras veces y trámite cuando ya sabes qué hay. La impresión de Sergio del 26-nov va en esa línea.

**Cuántas veces se usa el mapa.** No lo sé: en mis pruebas lo decidía un guion al azar. Lo dirá el informe de la primera partida de Sergio, con los viajes, los pasos con el mapa frente a los de las salidas, y los segundos y píxeles andados.

## Qué falta

- **Las tretas y la presión están desde el 26-nov.** Lo de la noche (quien ofrece tretas, la posada, quedar para el muerto) sigue en la pantalla de la noche, en texto. El modo antiguo de la presión, los corchetes por quejas, no tiene muñecos: está apagado en las reglas.
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
7. **Con tretas y presión:** si encuentras a quien vende y entiendes para qué sirve cada llave antes de comprarla, si ves a tiempo al guarda y a los diputados (en el mapa, con su hora) y si compras alguna llave. Es lo que dijiste que decidiría si la presión se queda.

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
