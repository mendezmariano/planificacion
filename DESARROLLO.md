# Iteraciones con Codex

## Reproducir la línea de base

Primer encargo para Codex:

> Leé README.md y AGENTS.md. Ejecutá las pruebas. Para Llegadas tardías, recorré los eventos de STCF y contrastá el Gantt con los valores 0, 10, 20, 30 y 120. Indicá el estado de A en t=10 y su primer instante de reanudación. Si aparece una discrepancia, localizá si corresponde al motor o a la vista y corregila.

Aceptación: en t=10 ejecuta B; A está listo y le quedan 90 s. A vuelve en t=30. Retorno medio 50 s. La vista y las métricas deben derivar de la misma traza.

## Extensión 1 · Predicción con devolución

> Agregá una actividad opcional que detenga el avance antes de un despacho y permita elegir entre los candidatos. Mostrá la razón de la decisión tras confirmar. Reutilizá la traza del motor. Conservá el modo guiado básico.

Aceptación: en t=10 del caso tardío, SJF conserva A y STCF elige B. Si se elige C con STCF, explicar que B y C están empatados y se aplica el orden de carga. Retroceder debe restaurar la consigna sin adelantar la respuesta.

## Extensión 2 · Medir el costo del cambio

> Incorporá un costo configurable de cambio entre dos trabajos distintos en RR. Mostrá los intervalos de cambio con su propia etiqueta en el Gantt y contabilizalos por separado. Antes de implementar, explicitá cómo vas a tratar llegadas durante el cambio y cómo evitarás cobrarlo al continuar el único trabajo listo.

Aceptación: con costo cero, todos los resultados publicados siguen idénticos. Dos trabajos de 2 unidades, q=1 y costo de cambio 1, ambos con llegada en 0, terminan el lote en 7 unidades: 4 de CPU útil y 3 de cambios. Especificá y probá qué ocurre si un trabajo nuevo llega exactamente al vencer el cuanto.

## Extensión 3 · Comparar ráfagas estimadas y reales

> Incorporá un modo experimental, separado del capítulo 7, que estime la duración de la próxima ráfaga a partir de la historia del proceso. Exponé la estimación, su actualización y el efecto sobre la secuencia elegida.

Aceptación: el estudiante distingue duración real, estimación y restante. Mantener SJF/STCF con oráculo como referencia para comparar sobre la misma carga. Acordar el estimador y su valor inicial antes de interpretar resultados.
