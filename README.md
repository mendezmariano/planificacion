# Turno de CPU

Laboratorio web de planificación para Sistemas Operativos. El estudiante predice qué proceso se ejecutará, avanza hasta la próxima decisión y contrasta respuesta y retorno sobre la misma carga. Implementa el capítulo 7, *Scheduling: Introduction*, de Remzi H. y Andrea C. Arpaci-Dusseau, *Operating Systems: Three Easy Pieces*, v1.10.

## Abrir para dar clase

Descomprimí el ZIP completo. Abrí **dist/index.html** en Firefox, Chrome o Edge. Todos los recursos están en esa carpeta y funcionan sin Internet. Para trabajar con un servidor local desde la raíz del proyecto:

```bash
python3 -m http.server 8000 --directory dist
```

Abrí http://localhost:8000. Para probar el motor con Node.js 18 o posterior:

```bash
node --test test/*.test.js
```

## Recorrido

Elegí la política en el menú superior y la carga en «Explorá un ejemplo». Avanzá con «Siguiente». Cada paso muestra el estado **después** de resolver los eventos del instante indicado. El Gantt muestra los intervalos ya transcurridos. Al final se comparan las políticas y se desglosan las métricas por trabajo.

El panel «En el apunte» muestra la sección, figura, supuestos y consigna antes de avanzar. «Configuración del apunte» identifica una de las nueve figuras; «Variante del apunte» indica otra combinación de política o cuanto sobre la misma carga. Las cargas propias se muestran sin figura asociada. En cada ejemplo se indican las configuraciones necesarias para reproducir el apunte.

| Ejemplo | Entrada | Qué comprobar |
| --- | --- | --- |
| Tres trabajos iguales | A, B y C llegan en 0, duran 10 s | FIFO da retorno medio 20 s |
| Efecto convoy | A dura 100 s; B y C, 10 s. Llegan en 0 | FIFO da 110 s de retorno medio; SJF, 50 s |
| Llegadas tardías | B y C llegan en 10 s | SJF da 103,33 s; STCF, 50 s. A se reanuda en 30 |
| Tres terminales | 5 s cada una, llegan en 0 | RR con q = 1 da respuesta 1 s y retorno 14 s |
| CPU y disco | A alterna 5 ráfagas de CPU con 4 E/S; B usa 50 ms de CPU | En serie, 140 ms; con STCF por ráfaga, 100 ms |

La carga propia permite de uno a seis trabajos de CPU con llegadas arbitrarias. El ejemplo de disco usa milisegundos. La vista técnica expone las ráfagas y el registro exacto de intervalos. Para abrir directamente un escenario, agregá por ejemplo `?sim=STCF&caso=tardias` o `?sim=RR&caso=terminales` al final de la URL del laboratorio.

## Continuar con Codex

Abrí esta carpeta en tu editor o iniciá `codex` desde su raíz si ya tenés instalado Codex CLI. Las decisiones de diseño, convenciones y criterios de aceptación están en [AGENTS.md](AGENTS.md). [DESARROLLO.md](DESARROLLO.md) incluye el backlog priorizado, los enlaces a los issues y encargos concretos para iterar sin perder la correspondencia con el capítulo.

- `dist/engine.js` modela las políticas y produce una traza independiente de la interfaz.
- `dist/chapter.js` relaciona las cargas y políticas con las figuras y consignas del capítulo 7.
- `dist/app.js` muestra estados, controles, guía, teoría y métricas.
- `dist/index.html` y `dist/styles.css` forman el recurso estático.
- `test/engine.test.js` comprueba intervalos, colas, estados y métricas de las nueve figuras, fronteras con eventos simultáneos y conservación del tiempo por trabajo.
- `test/fixtures/chapter7.js` contiene los intervalos y resultados esperados del apunte, calculados sin ejecutar el motor.
- `test/chapter.test.js` comprueba la correspondencia con el apunte y la identificación de variantes.

Para distribuir la web en un alojamiento estático, copiá el **contenido** de `dist/` a la raíz que se vaya a publicar. La aplicación usa rutas relativas y admite subdirectorios. El repositorio de paginación es la referencia de interacción y diseño: https://mendezmariano.github.io/memoria-virtual/. Libro: https://pages.cs.wisc.edu/~remzi/OSTEP/.
