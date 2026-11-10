# El bot aplicado: cuánto da de sí la j0.11 jugando bien

10 de noviembre de 2026. Rama `claude/bot-aplicado`, sobre `main` en la j0.11 (`e5adb84`). No se tocan `main`, las reglas ni `herramientas/bot.js`. El bot está en `herramientas/aplicado.js`. Todas las cifras son de 2.000 partidas por variante (semillas 1 a 2.000, las mismas que usa `bot.js`), salvo donde se dice otra cosa.

## En corto

- **Supera al veterano, y por mucho.** En un verano de 1545 llega a la siega el 98,7 % de las veces y con hoz el 95,7 % (el veterano, 53 % y 25 %). Saca 1,86 pedazos al día, casi lo mismo que Sergio (1,9). Los bots de `bot.js` no eran el suelo por poco: estaban muy lejos del techo.
- **Casi todo lo hace la heurística, no la búsqueda.** El «oficio» (una regla a mano, sin mirar hacia delante) ya llega el 98,2 % y con hoz el 93,2 %. La búsqueda sobre el motor añade medio punto de llegar y dos y medio de hoz en 1545; donde pesa de verdad es con los tuyos y en la cadena.
- **La cadena, que los bots completaban 1 de cada 20 veces, el aplicado la completa 71 de cada 100 veces empezando como hombre y 95 empezando como mujer.**
- **Por qué es tan fácil:** con dos peticiones al día se come; hay sitios con gente donde la ronda no va nunca por costumbre; pedir casi no expone (0,03 detenciones pidiendo por partida); y lo que detiene, que es cruzarse con la ronda, se evita en buena parte. Aprenderse las costumbres del verano vale menos de un punto.
- **Los agujeros que más pesan** (detalle y semillas abajo): la mujer es mucho mejor que el hombre para quien juega bien; en la cadena, morir acompañado no cuesta y sale a cuenta dejarse morir para seguir como Catalina; si solo cuenta llegar, hacerse la llaga la primera noche llega el 99,7 %; a los tuyos no se les da pan nunca y que te vendan no cuesta nada; el último día no tiene consecuencias; las obras no se usan.
- **Límite de todo esto:** el bot es una cota inferior del techo, no el techo. Mira un día hacia delante y el resto lo valora con una tabla; un jugador mejor puede existir. Y sabe las reglas y las cifras de `rules.js`, como Sergio: no dice nada de lo que entiende quien juega por primera vez.

## Qué es el bot y qué sabe

Dos piezas, las dos en `herramientas/aplicado.js`:

- **El oficio.** Una heurística a mano. De todo lo que puede hacer (pedir aquí ahora, esperar a que empiece la franja, ir a otro sitio a pedir al llegar o al empezar la franja), elige lo que más pan espera sacar por el tiempo que cuesta, menos lo que arriesga, y sale por la puerta de menos riesgo antes de que cierren. Lo que arriesga lo calcula con lo que cree de la ronda. Se puede jugar solo con `OFICIO=1`.
- **La búsqueda.** En cada decisión saca mundos compatibles con lo que sabe, prueba en cada uno todas las jugadas posibles con el motor real, deja que el oficio juegue el resto del día y valora cómo amanece con una tabla de valor. La tabla dice lo que vale amanecer un día con un cuerpo, un pan, unas detenciones, dentro o fuera, con llaga o sin ella (y en la cadena, siendo hombre o mujer y con qué tuyos vivos); se calcula antes, hacia atrás (del día 10 al 1 y de 1557 a 1545), con partidas de un día del propio oficio. La jugada del oficio es la «titular»: otra solo la desbanca si le gana con claridad en los mismos mundos (con pocos mundos, la mejor media sale muchas veces de la suerte). De noche decide igual cuánto cenar, si darle pan a cada uno de los tuyos, si hacerse la llaga y, en el relevo, a quién seguir.

**Un mundo compatible** es una copia de la partida con otra semilla (otro azar de ahí en adelante), unas costumbres de la ronda sacadas de lo que cree (regla de Bayes sobre lo que ha visto y lo que le han contado; en la cadena, partiendo de dónde pidió y por qué puerta pasó el verano anterior, que es lo que el juego usa), y la ronda de esa franja y los tuyos colocados reviviendo el día desde la noche anterior con esa semilla. Solo vale si casa con lo que ve: la gente y los pobres de su sitio, si la ronda está, si uno de los tuyos pide ahí, si un vecino rezonga.

**Lo que sabe:** lo que ve en su sitio, Recuerdos (dónde vio a la ronda, dónde ha pedido, lo que le han contado), el esqueleto de la ronda y las reglas con sus cifras. **Lo que no lee para decidir:** la semilla, las costumbres del verano, dónde está la ronda si no la ve ni por qué ha ido, la gente de los sitios donde no está, dónde andan los tuyos de día.

**Dos cosas que conviene tener presentes al leer las cifras:**

1. **Conoce las cifras de las reglas** (cuánto avisa cada sitio, las probabilidades de que le paren, la tabla de limosna). Es el jugador que ha leído `rules.js`, no el que llega de nuevas.
2. **De los tuyos da por sabido con qué anochecieron** (cuerpo, pan, detenciones, dónde han pedido otros días). Una persona que apunte lo que le cuentan cada noche lo reconstruye casi entero, pero no del todo (por ejemplo, la noche que no duermen juntos). Solo afecta a las variantes con los tuyos. Que uno le haya vendido no lo usa hasta que se entera: esa noche en la ribera, o cuando el alguacil dice «ya me han contado dónde pides».

**Qué persigue.** En un verano suelto, acabar con hoz vale 1 y llegar sin hoz, 0,9 (`AGUANTA=0.9`). Se elige así porque la cifra que usan las tablas del registro es «llega a la siega», pero un jugador también quiere la hoz. Con la llaga cambia mucho según este número, y está medido con los dos (ver el agujero 4). En la cadena persigue lo que mide `bot.js`: que el que juega llegue a la siega de 1557.

## Las cifras

Los bots de `bot.js` están medidos sin tocar nada, con las mismas 2.000 semillas; sus cifras coinciden con las del registro. «Oficio» y «Aplicado» son los dos modos de `aplicado.js`.

**Un verano de 1545, sin los tuyos**

| Bot | Llega a la siega | Con hoz | Hambre | Destierro | Azotes | Pan al día |
|---|---|---|---|---|---|---|
| Novato | 40 % | 28 % | 9 % | 46 % | 6 % | 1,55 |
| Veterano | 53 % | 25 % | 28 % | 17 % | 3 % | 1,45 |
| Prudente | 25 % | 5 % | 64 % | 8 % | 2 % | 1,27 |
| Osado | 39 % | 29 % | 7 % | 48 % | 7 % | 1,55 |
| Vidente | 62 % | 35 % | 20 % | 15 % | 2 % | 1,5 |
| Oficio (la heurística sola) | 98,2 % | 93,2 % | 0,6 % | 0,9 % | 0,3 % | 1,88 |
| **Aplicado** (oficio + búsqueda) | 98,7 % | 95,7 % | 0,6 % | 0,7 % | 0,1 % | 1,86 |

**Un verano de 1545, con los tuyos (los bots de antes, sin darles pan, que es como mejor les va)**

| Bot | Llega a la siega | Con hoz | Hambre | Destierro | Azotes | Pan al día |
|---|---|---|---|---|---|---|
| Novato | 25 % | 16 % | 15 % | 51 % | 10 % | 1,39 |
| Veterano | 47 % | 27 % | 27 % | 21 % | 6 % | 1,38 |
| Prudente | 34 % | 13 % | 50 % | 12 % | 4 % | 1,25 |
| Osado | 32 % | 21 % | 16 % | 43 % | 9 % | 1,41 |
| Vidente | 48 % | 27 % | 27 % | 18 % | 6 % | 1,38 |
| Oficio | 89,9 % | 81,2 % | 5,2 % | 3,6 % | 1,2 % | 1,73 |
| **Aplicado** | 94,3 % | 88,3 % | 2,3 % | 2,5 % | 0,8 % | 1,75 |

**Con los tuyos, dándoles lo que piden guardándose la ración (el reparto por defecto de bot.js)**

| Bot | Llega a la siega | Con hoz | Hambre | Destierro | Azotes | Pan al día |
|---|---|---|---|---|---|---|
| Novato | 19 % | 10 % | 20 % | 48 % | 13 % | 1,4 |
| Veterano | 37 % | 18 % | 37 % | 20 % | 7 % | 1,41 |
| Prudente | 24 % | 7 % | 60 % | 11 % | 6 % | 1,3 |
| Osado | 25 % | 13 % | 22 % | 40 % | 14 % | 1,42 |
| Vidente | 35 % | 16 % | 39 % | 17 % | 9 % | 1,4 |

**Un verano de 1545, con la llaga activada** (en `bot.js` solo el veterano tiene reglas para hacérsela)

| Bot | Llega a la siega | Con hoz | Hambre | Destierro | Azotes | Pan al día |
|---|---|---|---|---|---|---|
| Veterano (no se la hace) | 53 % | 25 % | 28 % | 17 % | 3 % | 1,45 |
| Veterano, llaga la primera noche | 70 % | 0 % | 5 % | 17 % | 8 % | 1,85 |
| Veterano, desde el día 3 | 70 % | 0 % | 6 % | 17 % | 7 % | 1,82 |
| Veterano, desde el día 5 | 73 % | 0 % | 7 % | 15 % | 5 % | 1,81 |
| Veterano, desde el día 7 | 72 % | 0 % | 11 % | 14 % | 4 % | 1,76 |
| Veterano, en apuros | 54 % | 20 % | 25 % | 17 % | 2 % | 1,5 |
| Oficio (no se la hace) | 98,2 % | 93,2 % | 0,6 % | 0,9 % | 0,3 % | 1,88 |
| **Aplicado** (se la hace 3,6 de cada 100 veces) | 99,0 % | 93,3 % | 0,5 % | 0,3 % | 0,1 % | 1,87 |

**La cadena (1545, 1552, 1557), empezando como hombre** (los bots de antes, con el reparto por defecto de `bot.js`; entre paréntesis, sin dar pan)

| Bot | Completa (el que juega llega a la siega de 1557) | Su gente llega a 1557 | Acaba en 1545 | Acaba en 1552 |
|---|---|---|---|---|
| Novato | 6 % (sin dar pan: 5 %) | 23 % (20 %) | 38 % | 39 % |
| Veterano | 5 % (sin dar pan: 4 %) | 30 % (26 %) | 28 % | 42 % |
| Prudente | 0 % (sin dar pan: 0 %) | 21 % (16 %) | 29 % | 50 % |
| Osado | 4 % (sin dar pan: 4 %) | 22 % (17 %) | 38 % | 40 % |
| Vidente | 8 % (sin dar pan: 6 %) | 32 % (28 %) | 28 % | 39 % |
| Oficio | 51,7 % | 68,2 % | 5,5 % | 26,3 % |
| **Aplicado** | 71,3 % | 82,0 % | 5,7 % | 12,2 % |

**La cadena, empezando como mujer**

| Bot | Completa (el que juega llega a la siega de 1557) | Su gente llega a 1557 | Acaba en 1545 | Acaba en 1552 |
|---|---|---|---|---|
| Novato | 8 % (sin dar pan: 9 %) | 30 % (32 %) | 31 % | 39 % |
| Veterano | 5 % (sin dar pan: 6 %) | 35 % (30 %) | 19 % | 46 % |
| Prudente | 0 % (sin dar pan: 0 %) | 22 % (17 %) | 23 % | 55 % |
| Osado | 5 % (sin dar pan: 6 %) | 28 % (27 %) | 25 % | 47 % |
| Vidente | 9 % (sin dar pan: 8 %) | 40 % (35 %) | 19 % | 41 % |
| Oficio | 89,0 % | 93,5 % | 2,1 % | 4,3 % |
| **Aplicado** | 95,1 % | 97,6 % | 0,8 % | 1,6 % |

Lecturas:

- **Un verano.** El aplicado llega 99 de cada 100 veces. Casi no le detienen pidiendo (0,03 por partida) ni pasa hambre (0,6 %). Al llegar donde está la ronda le paran 0,70 veces por partida, y de esas solo 0,20 son detenciones (al veterano le detienen así 0,98 veces).
- **Con los tuyos baja** del 98,7 % al 94,3 %: para quien juega bien, los tuyos estorban más de lo que ayudan (agujero 6).
- **Con la llaga** activada apenas la usa (3,6 % de las partidas, cuando va mal), porque no la necesita. Si solo cuenta llegar, se la hace siempre (agujero 4).
- **La cadena:** el aplicado la completa el 71,3 % de las veces empezando como mozo y el 95,1 % empezando como moza; los bots de antes, entre el 0 % y el 9 %. Empezando como mozo, el verano de 1545 lo acaba en la siega menos veces que el oficio (68 % frente a 87 %) y aun así completa mucho más: se deja relevar (agujeros 2 y 3). No da pan (0,2 pedazos por cadena).

## La estrategia que domina, en llano

Lo que hace el aplicado en un verano de 1545 (medias de 2.000 partidas):

1. **Come todos los días con dos peticiones.** Pide 2,1 veces al día y saca 1,86 pedazos; cena ración entera 9 noches de cada 10. Al tercer día suele tener el cuerpo en 6 y ya no baja. Le sobra pan: 1,6 pedazos por partida no le caben en el hatillo.
2. **Pide donde hay gente y la ronda no tiene costumbre a esa hora.** Tres de cada cuatro peticiones son en ocho sitios y horas: la calle de San Pablo a nona y a tercia, las Escuelas a tercia y a nona, la Puerta del Río a prima, la Catedral y la Rúa a vísperas y la Catedral a tercia. Las Escuelas a tercia (mucha gente, y la ronda de la mañana solo anda por la Plaza, la Catedral o San Martín) y la calle de San Pablo (no está en ninguna costumbre) son sitios seguros todos los veranos.
3. **Entra por donde menos arriesga:** la mitad de los días por la orilla y la Puerta de San Pablo, la otra mitad por la del Río.
4. **Se recoloca a sexta,** cuando la ronda come: en 2.000 partidas se cruza con ella 0,01 veces por partida a esa hora.
5. **La mitad de las veces espera a que empiece la franja para pedir,** y así no le han pillado nunca. La otra mitad pide nada más llegar, porque esperar cuesta tiempo y el riesgo es pequeño.
6. **Después de pedir, se va.** La ronda acude a donde ha pedido 57 de cada 100 veces a la franja siguiente; él ya no está, y mientras la ronda está allí no está en ningún otro sitio.
7. **Sale antes de completas o por la puerta que la ronda no cierra,** y aun así es su mayor riesgo: de las 2,6 veces por partida que llega a donde está la ronda, 1,2 son en una puerta a completas.
8. **No trabaja, no se hace la llaga y no da pan.**
9. **Si solo tiene un pedazo, a veces no cena y lo guarda** (0,3 noches por partida): media ración hoy y media mañana son peores que nada hoy y ración entera mañana.
10. **Alguna noche duerme en un portal de la Puerta de San Pablo** (0,4 por partida), donde nadie pide y nadie se queja.

Y por qué el veterano se queda en el 53 %: sobre todo porque pasa hambre (28 %). Trata el riesgo de un sitio como si fuera el mismo toda la franja, la vea o no, y deja de pedir donde podría; y a completas cruza la puerta que cierra la ronda. El aplicado saca 0,4 pedazos más al día y llega a donde está la ronda menos de la mitad de veces (0,26 al día frente a 0,63).

**Qué pieza sostiene el resultado** (el oficio solo, quitándole una cosa cada vez; `OFICIO=1` y el interruptor que se indica):

| El oficio… | Llega | Con hoz | Hambre | Destierro | Pan al día | Paradas por partida |
|---|---|---|---|---|---|---|
| entero | 98,2 % | 93,2 % | 0,6 % | 0,9 % | 1,88 | 0,77 |
| sin aprender las costumbres del verano (`CIEGO=1`) | 97,5 % | 92,4 % | 1,1 % | 1,1 % | 1,88 | 0,84 |
| sabiéndolas desde el primer día (`VIDENTE=1`) | 98,1 % | 94,1 % | 0,8 % | 0,8 % | 1,90 | 0,68 |
| sin contar con dónde puede estar la ronda: solo la esquiva si la ve (`SIN_MIEDO=1`) | 78,8 % | 71,0 % | 1,2 % | 19,2 % | 1,79 | 2,18 |
| pidiendo siempre nada más llegar (`ALINEA=nunca`) | 96,2 % | 90,4 % | 3,0 % | 0,5 % | 1,83 | 0,91 |
| pidiendo siempre al empezar la franja (`ALINEA=siempre`) | 91,5 % | 76,0 % | 8,2 % | 0,0 % | 1,59 | 0,59 |
| solo en los sitios de costumbre de la ronda: Catedral, Rúa, Plaza, San Martín (`VETA=sanpablo,escuelas,puerta,sanesteban,sanpolo`) | 75,3 % | 55,5 % | 23,6 % | 0,2 % | 1,49 | 0,92 |
| solo fuera de ellos (`VETA=catedral,rua,plaza,sanmartin`) | 92,6 % | 79,3 % | 6,3 % | 0,6 % | 1,68 | 0,70 |

Lo que sostiene el resultado es saber el esqueleto de la ronda (sin eso, 19 % de destierros) y tener sitios fuera de él. Aprender las costumbres concretas del verano casi no cuenta.

## Agujeros y jugadas dominantes

Cada uno con la semilla que lo reproduce. Para ver una partida: `SEMILLA=3 node herramientas/aplicado.js` (con `PIENSA=1` enseña además qué valoró en cada jugada). La primera vez tarda un minuto en calcular la tabla de valor (siete en la cadena). No se arregla ninguno.

### 1. Hay sitios con gente que la ronda no pisa por costumbre, y con eso basta

- **Qué pasa.** Las costumbres de la ronda salen de una lista corta: por la mañana, Plaza, Catedral o San Martín; a nona, Escuelas, Rúa, Catedral o Plaza; a vísperas, Rúa, Catedral o Plaza. Quedan fuera, con gente que da, las Escuelas a tercia (mucha gente), la calle de San Pablo a tercia, nona y vísperas, y la Puerta del Río a prima, tercia y vísperas. Ahí la ronda solo aparece por un desvío (3 de cada 100 franjas) o por una queja.
- **Cuánto pesa.** Pidiendo solo fuera de los sitios de costumbre, el oficio llega el 92,6 %; pidiendo solo en ellos, el 75,3 %. Sin aprender nada de las costumbres del verano, el 97,5 % (aprendiéndolas, 98,2 %; sabiéndolas desde el primer día, 98,1 %). Las costumbres nuevas cada verano de la j0.9 y Recuerdos no le cambian la partida a quien juega bien.
- **Semilla 1** (un verano): pide sobre todo en las Escuelas, la calle de San Pablo y la Puerta; siega con el cuerpo en 6 desde el día 3.

### 2. La mujer es mucho mejor que el hombre para quien juega bien

- **Qué pasa.** Con varios veranos, al hombre que la ronda para por la calle lo echa, lo manda a las obras sin paga si tiene 5 o más de cuerpo, o lo detiene si ya lo conoce; y desde 1552 cualquier detención es galeras. A la mujer la echa y, si ya la conoce, la azota (1 de cuerpo) y la echa: ni cárcel por la calle ni galeras. Lo que ella pierde a cambio (las obras, y espigar en vez de segar: empieza el verano siguiente con 4 de cuerpo y un pedazo en vez de 5 y dos) no le pesa a quien come ración entera casi todas las noches.
- **Cuánto pesa.** Empezando como moza, el aplicado completa la cadena el 95,1 % de las veces; empezando como mozo, el 71,3 % (el oficio solo, 89,0 % y 51,7 %). A la moza la ronda la echa 1,4 veces por cadena y la azota 1,7, y da igual: llega a donde está la ronda 11 veces por cadena, porque casi no le hace falta esquivarla. Dentro de las mismas cadenas (las que empieza el mozo), el verano de 1552 lo acaba en la siega el 62 % de los hombres que lo juegan y el 96 % de las mujeres; el de 1557, el 81 % y el 95 %. Uno de cada cuatro hombres que juegan 1552 acaba en galeras, también jugando bien.
- **Por qué no se vio.** La comprobación de la pregunta 12 («parejos»: 30 % y 28 %; 5 % y 5 %) se hizo con bots que morían de hambre antes de que la ronda importara. Con un jugador que come, lo que separa a los dos es la ronda, y ahí la mujer casi no tiene nada que perder.
- **Semillas** (`CADENA=1`): la 28, el mozo acaba en galeras el día 3 de 1552 y se acaba la cadena; la 1 con `SEXO=mujer`, a la moza la echan dos veces, la azotan tres (las tres en una puerta a completas) y la detienen una noche en un portal, y espiga los tres veranos.

### 3. En la cadena, morir acompañado no cuesta: sale a cuenta dejarse morir para seguir como Catalina

- **Qué pasa.** Si mueres con uno de los tuyos durmiendo al lado, sigues como él. El heredero vive solo los días que faltan y llega al verano siguiente con la cara limpia; y si es Catalina, es mujer (agujero 2). Para el mozo que va mal (poco cuerpo, detenciones encima), morir esa noche en la ribera vale más que seguir. El aplicado lo hace: deja de entrar a pedir, da el día por acabado fuera y no cena.
- **Cuánto pesa.** Empezando como mozo, el aplicado muere de hambre en 1545 con heredero en el 24 % de las cadenas (el oficio, que no lo busca, en el 6 %) y llega a la siega de 1545 solo en el 68 % (el oficio, en el 87 %); aun así completa la cadena el 71,3 % frente al 51,7 %. En una muestra de 170 cadenas (semillas 31 a 200), las que el mozo acaba con hoz en 1545 se completan el 76 % de las veces; las que acaba muerto de hambre con heredero, el 80 %; las que acaba desterrado, el 85 % (son pocas: 91, 41 y 13 cadenas). Morir o que te destierren en 1545 no es peor que segar. Esto contradice lo medido con los bots de antes («dejarse morir para que siga otro no es lo mejor»), por la misma razón que el agujero 2.
- **También elige heredero así:** cuando puede elegir, 4 de cada 10 veces se queda con el de menos cuerpo.
- **Semilla 23** (`CADENA=1 SEMILLA=23 PIENSA=1`), 1545, día 7: el mozo amanece en la Puerta con 2 de cuerpo, sin pan y con dos detenciones. Entrar a pedir lo valora en 0,62; salir al puente y dar el día por acabado, en 0,83. Sale, no cena, muere esa noche con Pedro al lado, y la cadena se completa con Catalina.

### 4. Si solo cuenta llegar, la llaga la primera noche llega siempre

- **Qué pasa.** Con la llaga, la tirada de limosna sube un punto y el alguacil deja pasar tres veces; lo que cuesta (fiebre, cuerpo máximo 5, una de cada tres noches se encona) lo paga de sobra el pan de más. Lo único que frena al jugador es la hoz.
- **Cuánto pesa.** Valorando igual llegar con hoz que sin ella (`AGUANTA=1`, 600 partidas), el aplicado se la hace en las 600, la primera noche en 587, y llega en 598 (99,7 %), con 2,04 pedazos al día y 0,01 detenciones al llegar por partida. Sin la llaga y con ese mismo criterio llega en 595 (99,2 %): la llaga no le hace falta, pero es gratis, así que se la hace. Valorando la hoz un 10 % más (lo que se usa en el resto del informe), se la hace 3,6 de cada 100 veces, cuando va mal. Es lo que el registro ya temía («el principal coste de la llaga no pesa en el juguete»): en un verano suelto la hoz no da nada, y sin ese freno la llaga temprana domina.
- **Semilla 1** con `LLAGA=1 AGUANTA=1`: llaga la noche del día 1 y llega con la pierna abierta.

### 5. Pedir casi no expone: lo que expone es andar

- **Qué pasa.** Dos reglas juntas. Si la ronda no está cuando empiezas a pedir, solo puede pillarte en la parte de la petición que cae en la franja siguiente: si empiezas al empezar la franja, nunca. Y si viene por la queja que acabas de provocar, llega cuando ya terminas. Además la ronda es una sola: cuando va a donde acabas de pedir (57 de cada 100 veces), no está en ningún otro sitio. Las quejas, pensadas como amenaza, le sirven al que se va de señuelo.
- **Cuánto pesa.** Al aplicado le pillan pidiendo 62 veces en 2.000 partidas (0,03 por partida), todas pidiendo a media franja; ninguna de las 21.451 peticiones que empezó en punto, aunque en 582 de ellas la ronda llegó por su cuenta al sitio justo al acabar. Con el oficio obligado a pedir siempre en punto (`ALINEA=siempre`), cero veces en 2.000 partidas. Cuando la ronda para al oficio, estaba allí por su recorrido (0,57 veces por partida) o por un desvío (0,20); porque le hubiera aprendido la costumbre, 0,07; por una queja suya, 2 veces en 2.000 partidas. Ni la queja ni la ronda que aprende llegan a morder a quien no repite sitio y hora.
- **Semilla 3,** día 2: pide en la Catedral a nona 1/6, saca un pedazo, y a vísperas la ronda llega a la Catedral por su recorrido (ese verano su costumbre de vísperas es la Catedral). Se va andando a la Puerta sin que le digan nada.

### 6. Con los tuyos: no se da pan nunca, que te vendan no cuesta y estorban más de lo que ayudan

- **No dar.** En un verano con los tuyos, el aplicado valoró dar uno o dos pedazos cada noche que le pedían y dio pan 2 veces en 2.000 partidas. En la cadena, 0,2 pedazos por cadena. Los tuyos acaban casi todos fuera: al final de la cadena del mozo vive Pedro en 2 de cada 100 y Catalina en 2 de cada 100 (aparte del que hereda). Para quien juega bien, los tuyos son un cuerpo de repuesto, y se usa una vez.
- **Que te vendan no cuesta.** Le venden en el 45 % de las partidas de un verano. El malsín cuenta dónde ha pedido, y con eso la ronda va a un solo sitio por hora, 6 de cada 10 veces: al oficio le para por lo que contó un malsín 0,02 veces por partida. Negar el pan sale gratis.
- **Estorban.** Sin ellos, al oficio le para la ronda 0,84 veces por partida; con ellos, 1,44, y de esas 0,50 son porque la ronda había ido a donde acababa de pedir uno de los tuyos y 0,10 porque le había aprendido la costumbre a uno de ellos. Además le quitan limosna donde coinciden. El aplicado baja del 98,7 % al 94,3 % (el oficio, del 98,2 % al 89,9 %).
- **Sus ojos valen 2 puntos.** El oficio con los tuyos llega el 89,9 %; sin hacer caso de lo que le cuentan (`OIDOS=0`), el 88 %.
- **Semilla 12** (`TUYOS=1`): le niega el pan a los dos, le venden los dos, la ronda no le para ni una vez y acaba con hoz.

### 7. El último día no tiene consecuencias

- **Qué pasa.** La siega se decide por el cuerpo al acabar la noche del día 10. Una detención ese día (si no es la tercera) cuesta uno o dos puntos de cuerpo y nada más: a la mañana siguiente le dan la hoz igual. Dormir en un portal esa noche, lo mismo.
- **Cuánto pesa.** En 115 de las 2.000 partidas acaba el día 10 en la cárcel o en un portal y le dan la hoz.
- **Semilla 4,** día 10: segunda detención en la Puerta de San Pablo a vísperas, azotes (cuerpo de 6 a 4), y al amanecer, la hoz.

### 8. Las obras no se usan

- **Qué pasa.** Trabajar da 2 pedazos y quita 1 de cuerpo esa noche, ocupa hasta el final de nona, solo cogen la mitad de las veces y hay que haber dormido dentro. Pedir a prima en la Catedral, al lado, da de media 1,5 pedazos en una franja y sin cansancio.
- **Cuánto pesa.** El aplicado pudo pedir trabajo 76 veces en 2.000 partidas y lo eligió 2. Con los tuyos, 116 y 8.
- No hay semilla de un agujero: es una jugada dominada.

### 9. Media ración es peor que ayunar y juntar

- **Qué pasa.** Ración entera, +1; media, −1; nada, −2. Dos noches a media ración son −2; una sin cenar y otra con ración entera, −1. Con un solo pedazo, guardarlo sale a cuenta si mañana se espera sacar uno.
- **Cuánto pesa.** Poco: el aplicado lo hace 0,3 noches por partida (en la cadena, 2 por cadena, parte de ellas para dejarse morir). Pero es una jugada que nadie haría por intuición.
- **Semilla 2,** noche del día 7: con el cuerpo en 6 y un pedazo, no cena.

### 10. El portal de la Puerta de San Pablo

- **Qué pasa.** En la Puerta de San Pablo no pide nadie, así que nunca hay quejas ni de ti ni de otros pobres: es siempre un sitio tranquilo para dormir (1 de cada 12; fichado, 1 de cada 8), está pegado a la salida y ahorra el camino de la ribera.
- **Cuánto pesa.** El aplicado duerme allí 0,43 noches por partida (853 noches, 80 detenciones: 9,4 %). No domina: dormir fuera sigue siendo lo normal. Es una opción barata que el mapa regala.
- **Semilla 3,** noche del día 5.

### Lo que parecía un agujero y no lo es tanto

- **La reacción de la ronda entre veranos se puede adivinar, pero poco.** En la cadena, el primer día del verano el bot acierta qué puerta cierra la ronda el 62 % de las veces (al azar, 50 %) y la costumbre de la mañana el 42 % (al azar, 33 %). Quien saliera siempre por la misma puerta podría dirigirla más (diez días por una puerta dan 6 a 1 de que el verano siguiente cierre esa), pero el bot no lo hace y no lo he medido.
- **Esperar siempre a que empiece la franja no es lo mejor** (91,5 % frente a 98,2 %): es seguro, pero cuesta tiempo.

## Qué añade la búsqueda y qué no

**Lo que añade.** La diferencia entre el oficio solo y el aplicado, con las mismas semillas:

| Variante | Oficio: llega / con hoz | Aplicado: llega / con hoz | Veces que se aparta del oficio |
|---|---|---|---|
| Un verano | 98,2 % / 93,2 % | 98,7 % / 95,7 % | 1,7 de 41 decisiones de día por partida |
| Con los tuyos | 89,9 % / 81,2 % | 94,3 % / 88,3 % | 4,2 de 44 |
| Con la llaga | 98,2 % / 93,2 % | 99,0 % / 93,3 % | 1,8 de 41, y la llaga en 3,6 de cada 100 partidas |
| La cadena, empieza el mozo | completa 51,7 % | completa 71,3 % | 9,7 de 100 |
| La cadena, empieza la moza | completa 89,0 % | completa 95,1 % | 8,8 de 128 |

- En 1545 sin los tuyos queda poco que ganar y la búsqueda casi no se aparta. Cuando lo hace es, sobre todo, para ir a pedir a otro sitio (0,9 veces por partida) o para dormir en un portal (0,7).
- Con los tuyos gana 4 puntos porque en sus mundos los tuyos piden, dejan quejas y traen a la ronda, cosa que el oficio no se imagina.
- En la cadena gana 20 puntos empezando como mozo, y la mayor parte viene de valorar bien el relevo (agujeros 2 y 3): cuándo vale más ser otro.

**Lo que no hace, y por eso es una cota inferior:**

- **Mira un día.** Prueba cada jugada, deja que el oficio acabe el día y valora el amanecer con la tabla. No planea a varios días (por ejemplo, salir siempre por la misma puerta para que el verano siguiente la ronda cierre esa).
- **La tabla de valor está hecha con el oficio,** no con el propio aplicado, y no distingue cuánto sabe ya de la ronda, cómo están de cuerpo los tuyos ni si alguno le ha amenazado. Por eso no sabe valorar darles pan para tenerlos sanos como herederos: solo ve si siguen vivos.
- **Se aparta del oficio solo con evidencia clara** (8 a 32 mundos por jugada). Con más mundos encontraría mejoras más finas; con menos cautela, en las pruebas, jugaba peor que el oficio.
- **No explota a propósito** lo que no le sale del día: no busca a la ronda para que le detengan el último día, no dirige a la ronda entre veranos.

Que el oficio solo, que es una regla de una página, ya esté en el 98 % dice que el techo de 1545 no depende de la búsqueda: depende de entender cuatro cosas de la ronda.

## Cómo reproducir

```
node herramientas/aplicado.js 2000                       # un verano
TUYOS=1 node herramientas/aplicado.js 2000               # con los tuyos
LLAGA=1 node herramientas/aplicado.js 2000               # con la llaga
CADENA=1 node herramientas/aplicado.js 2000              # la cadena, empieza el mozo
CADENA=1 SEXO=mujer node herramientas/aplicado.js 2000   # la cadena, empieza la moza
OFICIO=1 …                                               # la heurística sola
BOTS=novato,veterano,prudente,osado,vidente node herramientas/bot.js 2000   # los de antes (con TUYOS=1, DAR=nadie, LLAGA=1, CADENA=1, SEXO=mujer)
PROCESOS=2 …                                             # en dos procesos (da lo mismo)
SEMILLA=3 PIENSA=1 node herramientas/aplicado.js         # una partida, con lo que pensó
```

Con dos procesos, 2.000 partidas de un verano tardan unos 9 minutos; con los tuyos, 15; la cadena, entre 40 y 50 minutos. La tabla de valor se guarda en `herramientas/.cache/` (fuera del repositorio) y se rehace sola si cambian las reglas; si se cambia el oficio hay que subir `TABLA` en el fichero.
