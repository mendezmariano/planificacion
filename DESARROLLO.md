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

## Experimento implementado

El experimento de cambio de contexto usa Round Robin con la mezcla de procesos, el cuanto y el costo que elija el alumnado. La traza registra quién cede la CPU, quién la recibe y cuánto tarda el cambio. Las figuras del capítulo usan costo cero. [Abrir el experimento](dist/index.html?experimento=contexto) · [Contrato del motor](AGENTS.md)

Las pruebas cubren dos procesos de 2 ms que terminan en 7 ms con cuanto y costo de 1 ms. También comprueban las llegadas al vencer el cuanto, el fin de E/S durante un cambio, la renovación del turno del mismo proceso y la composición del reloj al retroceder.

## Experimento de estimación de ráfagas

El laboratorio compara SJF y STCF con estimaciones por proceso frente a la misma política con duraciones conocidas. Las cargas corresponden al efecto convoy y a la figura 7.9. Cada corrida comparte con su referencia el reloj, las llegadas y las demandas de CPU y disco. El avance por eventos y el retroceso recorren las fronteras de ambas trazas. [Abrir el experimento](dist/index.html?experimento=estimacion)

La estimación inicial y el peso de la última medición se pueden ajustar. Las pruebas comprueban la actualización al terminar la ráfaga, el servicio acumulado durante un desalojo, los empates y el caso en que la CPU consumida supera la estimación. En la configuración inicial, a los 20 ms sigue B con estimaciones y ejecuta A con el oráculo.
