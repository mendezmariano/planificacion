# Desarrollo y backlog

El laboratorio reproduce las nueve figuras del capítulo 7 para el alumnado de Sistemas Operativos de FIUBA. La guía docente ubica las láminas y la actividad de STCF dentro de ese recorrido. [Apunte del capítulo 7](recursos/Capitulo_7_Planificacion_ES.pdf) · [Guía docente](recursos/guia-docente.md)

## Backlog priorizado

Cada issue contiene los criterios de aceptación y las dependencias. Usá los issues para consultar y actualizar el estado de las tareas.

| ID | Prioridad | Tarea | Resultado esperado |
| --- | --- | --- | --- |
| [B01](https://github.com/mendezmariano/planificacion/issues/1) | Alta | Enmarcar los ejemplos en el apunte | Mostrar la sección, la figura, la carga y sus supuestos. Identificar las variantes. |
| [B02](https://github.com/mendezmariano/planificacion/issues/2) | Alta | Completar las pruebas de las nueve figuras | Comprobar intervalos, estados, métricas y fronteras con eventos simultáneos. |
| [B03](https://github.com/mendezmariano/planificacion/issues/3) | Alta | Recorrido de las decisiones | El pedido de simulación continua reemplaza la propuesta inicial de predicción. Cada llegada, desalojo o fin se explica mientras corre el reloj. |
| [B04](https://github.com/mendezmariano/planificacion/issues/4) | Alta | Validar el recorrido completo de la interfaz | Registrar pruebas de controles, teclado, pantalla angosta y apertura local sin red. |
| [B05](https://github.com/mendezmariano/planificacion/issues/5) | Media | Guiar la comparación de métricas | Comparar las figuras por pares con el mismo reloj y formar los promedios a medida que se conocen sus términos. |
| [B06](https://github.com/mendezmariano/planificacion/issues/6) | Media | Preparar la distribución para clase | Generar un paquete reproducible con el laboratorio y acceso local al apunte. |
| [B07](https://github.com/mendezmariano/planificacion/issues/7) | Media | Automatizar las pruebas en GitHub | Ejecutar las pruebas del motor en cada push y pull request, con resultado visible. |
| [B08](https://github.com/mendezmariano/planificacion/issues/8) | Media | Revisar los recursos complementarios | Relacionar las 13 láminas y la fotografía del convoy con los ejercicios y documentar sus créditos. |

La validación en Firefox incluye los instantes entre decisiones y la apertura del apunte local. GitHub Actions ejecuta las pruebas del motor, las figuras y las trazas en cada cambio. [Pruebas del laboratorio](https://github.com/mendezmariano/planificacion/actions/workflows/pruebas.yml) · [Contrato del motor](AGENTS.md)

## Reproducir la línea de base

Primer encargo para Codex:

> Leé README.md y AGENTS.md. Ejecutá las pruebas. Para Llegadas tardías, recorré los eventos de STCF y contrastá el Gantt con los valores 0, 10, 20, 30 y 120. Indicá el estado de A en t=10 y su primer instante de reanudación. Si aparece una discrepancia, localizá si corresponde al motor o a la vista y corregila.

Aceptación: en t=10 ejecuta B; A está listo y le quedan 90 s. A vuelve en t=30. Retorno medio 50 s. La vista y las métricas deben derivar de la misma traza.

En la figura 7.5, a los 35 s, A lleva `10 + (35 − 30) = 15 s` de ejecución y acumula 20 s de espera desde que lo desalojaron hasta que retomó. Al volver a los 10 s, el color de A y los términos del promedio deben corresponder a ese instante.

## Extensiones posteriores

Estas extensiones quedan fuera de la próxima entrega. La línea de base mantiene el costo de cambio nulo y el conocimiento de la próxima ráfaga. Antes de agregar otro comportamiento, definí un modo separado y actualizá el contrato y sus pruebas.

### Medir el costo del cambio

> Incorporá un costo configurable de cambio entre dos trabajos distintos en RR. Mostrá los intervalos de cambio con su propia etiqueta en el Gantt y contabilizalos por separado. Antes de implementar, explicitá cómo vas a tratar llegadas durante el cambio y cómo evitarás cobrarlo al continuar el único trabajo listo.

Aceptación: con costo cero, todos los resultados publicados siguen idénticos. Dos trabajos de 2 unidades, q=1 y costo de cambio 1, ambos con llegada en 0, terminan el lote en 7 unidades: 4 de CPU útil y 3 de cambios. Especificá y probá qué ocurre si un trabajo nuevo llega exactamente al vencer el cuanto.

### Comparar ráfagas estimadas y reales

> Incorporá un modo experimental, separado del capítulo 7, que estime la duración de la próxima ráfaga a partir de la historia del proceso. Exponé la estimación, su actualización y el efecto sobre la secuencia elegida.

Aceptación: el estudiante distingue duración real, estimación y restante. Mantener SJF/STCF con oráculo como referencia para comparar sobre la misma carga. Acordar el estimador y su valor inicial antes de interpretar resultados.
