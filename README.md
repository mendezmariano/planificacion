# Turno de CPU

Laboratorio web de planificación para Sistemas Operativos de FIUBA. Reproduce las nueve figuras del capítulo 7 de *Operating Systems: Three Easy Pieces*, de Remzi H. y Andrea C. Arpaci-Dusseau, v1.10. Cada trabajo aparece cuando llega. El reloj muestra cómo se consume su duración y cómo se forman las cuentas del apunte.

## Abrir para dar clase

Descomprimí el ZIP completo y abrí **dist/index.html** en Firefox, Chrome o Edge. El enlace **Apunte del capítulo 7 (PDF)** al pie del laboratorio abre el texto en otra pestaña. Dejá juntas las carpetas `dist/` y `recursos/` para usar el laboratorio y el apunte sin Internet.

La guía docente relaciona las 13 láminas con las figuras e incluye los datos para reproducir en el simulador la actividad de STCF. [Guía del material de clase](recursos/guia-docente.md)

Para armar el paquete con la versión confirmada en Git, ejecutá este comando desde la raíz del repositorio.

```bash
TZ=UTC git archive --format=zip --output=turno-de-cpu-clase.zip HEAD dist recursos
```

Para usar un servidor local, ejecutá este comando desde la misma carpeta.

```bash
python3 -m http.server 8000
```

Abrí el [laboratorio local](http://localhost:8000/dist/).

Podés ejecutar las pruebas del motor y de las figuras con Node.js 18 o posterior.

```bash
node --test test/*.test.js
```

Para verificar la interfaz, necesitás Firefox, geckodriver, Python 3.9 o posterior y una versión de Node.js con WebSocket integrado, como la 20.20.

```bash
python3 scripts/check_firefox.py --output-dir /tmp/planificacion-firefox-review
```

Si los ejecutables están fuera de `PATH`, indicá `--firefox /ruta/a/firefox` y `--geckodriver /ruta/a/geckodriver`. Agregá `--headed` para ver el recorrido. WebDriver usa un puerto local para controlar Firefox.

La prueba abre `dist/index.html` desde el disco con el acceso web bloqueado. Recorre las nueve figuras, el experimento de cambio de contexto, los controles, una carga propia, la navegación por teclado y el PDF a 1280 y 360 px de ancho. Para verificar el ZIP, extraelo en una carpeta nueva y agregá `--lab-root /ruta/al/paquete/extraido` al comando. El informe `report.json`, las capturas y `geckodriver.log` quedan en el directorio indicado con `--output-dir`.

## Recorrido

Al abrir el laboratorio empieza la figura 7.1. Elegí otra en **Ejercicio o experimento** para reproducirla con sus valores originales. La sección 7.6 vuelve a la figura 7.5 para calcular la respuesta. La parte clara de cada barra representa el tiempo ya ejecutado. Durante la espera, la barra conserva su avance.

La reproducción empieza a **0,25×**. En la figura 7.7, cada turno de 1 s dura 4 segundos en pantalla. En **Velocidad** podés bajar a **0,1×** o acelerar el recorrido. El ajuste también se aplica a **Siguiente**.

Pausá la simulación o mové **Recorrer el tiempo** para examinar un instante. **Anterior** y **Siguiente** recorren las decisiones. Al retroceder también se restauran las cuentas. Por ejemplo, en la figura 7.5, a los 35 s, A lleva `10 + (35 − 30) = 15 s` de ejecución y le quedan 85 s. B y C ya tienen retorno, y el de A sigue pendiente.

En **Comparación con la misma carga**, las dos figuras usan el mismo reloj. En las figuras 7.6 y 7.7, mirá qué pasa a los 2 s. Con RR ya se conoce la respuesta de los tres trabajos. Con SJF, B y C todavía esperan su primer turno. A los 15 s también podés comparar cuánto tardaron en terminar. En las figuras 7.8 y 7.9 el panel cuenta cuánto tiempo coinciden la CPU y el disco.

En **Explorar otra carga o política** podés cambiar los trabajos, la política o el cuanto. El encabezado identifica la figura original, la variante o la carga propia. **Mirar debajo del capó** abre el detalle de colas, ráfagas e intervalos observados.

| Ejemplo | Entrada | Qué comprobar |
| --- | --- | --- |
| Tres trabajos iguales | A, B y C llegan en 0, duran 10 s | FIFO da retorno medio 20 s |
| Efecto convoy | A dura 100 s; B y C, 10 s. Llegan en 0 | FIFO da 110 s de retorno medio; SJF, 50 s |
| Llegadas tardías | B y C llegan en 10 s | SJF da 103,33 s; STCF, 50 s. A se reanuda en 30 |
| Tres terminales | 5 s cada una, llegan en 0 | RR con q = 1 da respuesta 1 s y retorno 14 s |
| CPU y disco | A alterna 5 ráfagas de CPU con 4 E/S; B usa 50 ms de CPU | En serie, 140 ms; con STCF por ráfaga, 100 ms |

La carga propia permite de uno a seis trabajos de CPU con llegadas arbitrarias. El ejemplo de disco usa milisegundos. Para abrir una figura, agregá por ejemplo `?figura=7.5` al final de la URL del laboratorio. Usá `?seccion=7.6` para su lectura de respuesta. También se admiten enlaces como `?sim=STCF&caso=tardias`.

## Experimento de cambio de contexto

Elegí **RR · Costo del cambio de contexto** en el menú. Podés combinar de uno a seis procesos de los dos tipos de la sección 7.8. Cada proceso necesita 50 ms de CPU. Los que usan disco reparten esos 50 ms en cinco ráfagas e intercalan cuatro operaciones de E/S de 10 ms. Todos llegan juntos. [Abrir el experimento](dist/index.html?experimento=contexto)

Elegí el cuanto de Round Robin (1 a 300 ms) y el costo de cada cambio (0 a 300 ms). **Aplicar y reproducir** inicia la nueva corrida. El Gantt marca cada cambio con **CC**. Mientras pasa ese intervalo, los procesos listos acumulan espera y el disco sigue trabajando. El panel suma CPU útil, cambios y CPU ociosa hasta el instante que marca el reloj.

Para ver el efecto del cuanto, probá con dos procesos solo CPU y 2 ms por cambio. Con un cuanto de 10 ms hay nueve cambios y el lote dura `100 + 9 × 2 = 118 ms`. Con 25 ms hay tres cambios y dura `100 + 3 × 2 = 106 ms`. En ambos casos se ejecutan los mismos 100 ms de trabajo.

## Continuar con Codex

Abrí esta carpeta en tu editor o iniciá `codex` desde su raíz si ya tenés instalado Codex CLI. Las decisiones de diseño, convenciones y criterios de aceptación están en [AGENTS.md](AGENTS.md). [DESARROLLO.md](DESARROLLO.md) incluye el backlog priorizado, los enlaces a los issues y encargos concretos para iterar sin perder la correspondencia con el capítulo.

- `dist/engine.js` modela las políticas y produce una traza independiente de la interfaz.
- `dist/chapter.js` relaciona las cargas y políticas con las lecturas del capítulo.
- `dist/trace.js` calcula qué parte de cada intervalo ya transcurrió al leer el reloj.
- `dist/app.js` controla la reproducción y `dist/simulation-view.js` dibuja los trabajos, la línea de tiempo y las cuentas.
- `dist/index.html` y `dist/styles.css` forman el recurso estático.
- `test/engine.test.js` comprueba intervalos, colas, estados y métricas de las nueve figuras, fronteras con eventos simultáneos y conservación del tiempo por trabajo.
- `test/fixtures/chapter7.js` contiene los intervalos y resultados esperados del apunte, calculados sin ejecutar el motor.
- `test/chapter.test.js` comprueba la correspondencia con el apunte y la identificación de variantes.
- `test/trace.test.js` comprueba el consumo, la espera, la respuesta y el retorno en instantes intermedios y al retroceder.

Para publicar el paquete en un alojamiento estático, conservá las carpetas `dist/` y `recursos/` bajo el mismo directorio y enlazá `dist/index.html`. La aplicación usa rutas relativas. El laboratorio de paginación es la referencia de interacción y diseño. [Laboratorio de memoria virtual](https://mendezmariano.github.io/memoria-virtual/) · [Operating Systems: Three Easy Pieces](https://pages.cs.wisc.edu/~remzi/OSTEP/).
