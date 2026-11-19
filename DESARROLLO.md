# Desarrollo y backlog

El objetivo de la próxima entrega es completar el recorrido didáctico del capítulo 7 para el alumnado de Sistemas Operativos de FIUBA. Los ejemplos tienen como referencia principal [Capitulo_7_Planificacion_ES.pdf](recursos/Capitulo_7_Planificacion_ES.pdf).

## Backlog priorizado

Cada issue contiene los criterios de aceptación y las dependencias. Usá los issues para consultar y actualizar el estado de las tareas.

| ID | Prioridad | Tarea | Resultado esperado |
| --- | --- | --- | --- |
| [B01](https://github.com/mendezmariano/planificacion/issues/1) | Alta | Enmarcar los ejemplos en el apunte | Sección, figura, supuestos y consigna visibles; distinguir la configuración original de cada figura de las variantes. |
| [B02](https://github.com/mendezmariano/planificacion/issues/2) | Alta | Completar las pruebas de las nueve figuras | Comprobar intervalos, estados, métricas y fronteras con eventos simultáneos. |
| [B03](https://github.com/mendezmariano/planificacion/issues/3) | Alta | Incorporar predicción con devolución | Registrar una elección, explicar la decisión y restaurar la consigna al retroceder. |
| [B04](https://github.com/mendezmariano/planificacion/issues/4) | Alta | Validar el recorrido completo de la interfaz | Registrar pruebas de controles, teclado, pantalla angosta y apertura local sin red. |
| [B05](https://github.com/mendezmariano/planificacion/issues/5) | Media | Guiar la comparación de métricas | Explicar los cálculos y proponer preguntas específicas para cada carga. |
| [B06](https://github.com/mendezmariano/planificacion/issues/6) | Media | Preparar la distribución para clase | Generar un paquete reproducible con el laboratorio y acceso local al apunte. |
| [B07](https://github.com/mendezmariano/planificacion/issues/7) | Media | Automatizar las pruebas en GitHub | Ejecutar las pruebas del motor en cada push y pull request, con resultado visible. |
| [B08](https://github.com/mendezmariano/planificacion/issues/8) | Media | Revisar los recursos complementarios | Revisar las láminas y la imagen del convoy antes de incorporarlas con referencias claras. |

Comenzá por B01 y B02, seguí con B03 y cerrá la validación de B04 sobre ese recorrido. B07 puede resolverse de forma independiente. Todos los cambios deben respetar [AGENTS.md](AGENTS.md).

## Reproducir la línea de base

Primer encargo para Codex:

> Leé README.md y AGENTS.md. Ejecutá las pruebas. Para Llegadas tardías, recorré los eventos de STCF y contrastá el Gantt con los valores 0, 10, 20, 30 y 120. Indicá el estado de A en t=10 y su primer instante de reanudación. Si aparece una discrepancia, localizá si corresponde al motor o a la vista y corregila.

Aceptación: en t=10 ejecuta B; A está listo y le quedan 90 s. A vuelve en t=30. Retorno medio 50 s. La vista y las métricas deben derivar de la misma traza.

## B03 · Predicción con devolución

> Agregá una actividad opcional que detenga el avance antes de un despacho y permita elegir entre los candidatos. Mostrá la razón de la decisión tras confirmar. Reutilizá la traza del motor. Conservá el modo guiado básico.

Aceptación: en t=10 del caso tardío, SJF conserva A y STCF elige B. Si se elige C con STCF, explicar que B y C están empatados y se aplica el orden de carga. Retroceder debe restaurar la consigna sin adelantar la respuesta.

## Extensiones posteriores

Estas extensiones quedan fuera de la próxima entrega. La línea de base mantiene el costo de cambio nulo y el conocimiento de la próxima ráfaga. Antes de agregar otro comportamiento, definí un modo separado y actualizá el contrato y sus pruebas.

### Medir el costo del cambio

> Incorporá un costo configurable de cambio entre dos trabajos distintos en RR. Mostrá los intervalos de cambio con su propia etiqueta en el Gantt y contabilizalos por separado. Antes de implementar, explicitá cómo vas a tratar llegadas durante el cambio y cómo evitarás cobrarlo al continuar el único trabajo listo.

Aceptación: con costo cero, todos los resultados publicados siguen idénticos. Dos trabajos de 2 unidades, q=1 y costo de cambio 1, ambos con llegada en 0, terminan el lote en 7 unidades: 4 de CPU útil y 3 de cambios. Especificá y probá qué ocurre si un trabajo nuevo llega exactamente al vencer el cuanto.

### Comparar ráfagas estimadas y reales

> Incorporá un modo experimental, separado del capítulo 7, que estime la duración de la próxima ráfaga a partir de la historia del proceso. Exponé la estimación, su actualización y el efecto sobre la secuencia elegida.

Aceptación: el estudiante distingue duración real, estimación y restante. Mantener SJF/STCF con oráculo como referencia para comparar sobre la misma carga. Acordar el estimador y su valor inicial antes de interpretar resultados.
