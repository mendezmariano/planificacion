# Turno de CPU

Laboratorio web de planificación para Sistemas Operativos de FIUBA. Reproduce las nueve figuras del capítulo 7 de *Operating Systems: Three Easy Pieces*, de Remzi H. y Andrea C. Arpaci-Dusseau, v1.10. Cada trabajo aparece cuando llega. El reloj muestra cómo se consume su duración y cómo se forman las cuentas del apunte.

## Abrir para dar clase

Descomprimí el ZIP completo. Abrí **dist/index.html** en Firefox, Chrome o Edge. Todos los recursos están en esa carpeta y funcionan sin Internet. Para trabajar con un servidor local desde la raíz del proyecto:

```bash
python3 -m http.server 8000 --directory dist
```

Abrí http://localhost:8000. Para probar el motor con Node.js 18 o posterior:

```bash
node --test test/*.test.js
```

Para verificar la interfaz, necesitás Firefox, geckodriver, Python 3.9 o posterior y una versión de Node.js con WebSocket integrado, como la 20.20.

```bash
python3 scripts/check_firefox.py --output-dir /tmp/planificacion-firefox-review
```

Si los ejecutables están fuera de `PATH`, indicá `--firefox /ruta/a/firefox` y `--geckodriver /ruta/a/geckodriver`. Agregá `--headed` para ver el recorrido. WebDriver usa un puerto local para controlar Firefox.

La prueba abre `dist/index.html` desde el disco con el acceso web bloqueado. Recorre las nueve figuras, los controles, una carga propia y la navegación por teclado a 1280 y 360 px de ancho. Guarda `report.json`, las capturas y `geckodriver.log` en el directorio indicado.

## Recorrido

Al abrir el laboratorio empieza la figura 7.1. Elegí otra en **Ejercicio del apunte** para reproducirla con sus valores originales. La sección 7.6 vuelve a la figura 7.5 para calcular la respuesta. La parte clara de cada barra representa el tiempo ya ejecutado. Durante la espera, la barra conserva su avance.

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

Para distribuir la web en un alojamiento estático, copiá el **contenido** de `dist/` a la raíz que se vaya a publicar. La aplicación usa rutas relativas y admite subdirectorios. El repositorio de paginación es la referencia de interacción y diseño: https://mendezmariano.github.io/memoria-virtual/. Libro: https://pages.cs.wisc.edu/~remzi/OSTEP/.
