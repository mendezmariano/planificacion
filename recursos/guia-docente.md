# Material para acompañar el capítulo 7

Las 13 láminas de Sistemas Operativos de FIUBA acompañan la lectura de *Operating Systems: Three Easy Pieces*, de Remzi H. y Andrea C. Arpaci-Dusseau. El apunte en español fija las cargas, unidades y políticas de las nueve figuras. [Apunte del capítulo 7](Capitulo_7_Planificacion_ES.pdf) · [Láminas de planificación de CPU](Laminas_Planificacion_CPU.pptx)

| Láminas | Lectura | Qué mirar en el reloj |
| --- | --- | --- |
| 1 a 3 | Introducción y sección 7.1 | El compilador y el editor ilustran el bloqueo y los turnos. Después llegan A, B y C con la misma demanda de CPU. |
| 4 | Secciones 7.2, 7.3 y 7.6 · figura 7.1 | B empieza a los 10 s y termina a los 20 s. Como llegó en 0 s, su respuesta es 10 s y su retorno es 20 s. |
| 5 | Secciones 7.3 y 7.4 · figuras 7.2 y 7.3 | A necesita 100 s. En FIFO, B recibe CPU a los 100 s. En SJF empieza en 0 s. El retorno medio baja de 110 a 50 s. |
| 6 y 7 | Secciones 7.4 a 7.6 · figuras 7.4 y 7.5 | B y C llegan a los 10 s. Con STCF, A espera de 10 a 30 s y vuelve con 90 s de CPU pendientes. |
| 8 y 9 | Sección 7.7 · figuras 7.6 y 7.7 | A los 3 s, SJF le dio los 3 s a A. RR con cuanto de 1 s le dio 1 s a cada trabajo. La lámina 9 también calcula un costo hipotético de cambio de 1 ms. Las figuras del laboratorio usan costo cero. |
| 10 y 11 | Sección 7.8 · figuras 7.8 y 7.9 | Los tiempos están en milisegundos. El lote dura 140 ms en el ejemplo en serie y 100 ms cuando B aprovecha los 40 ms de E/S de A. |
| 12 y 13 | Carga propia con STCF · secciones 7.5 y 7.9 | La actividad agrega otra carga. B llega a los 2 s, ejecuta de 2 a 3 s, espera a C y vuelve de 4 a 6 s. Su retorno es 4 s y el retorno medio de la carga es 17/3 ≈ 5,67 s. |

Para acompañar la lámina 9, abrí el experimento de Round Robin. Con los valores iniciales, A pide disco a los 10 ms. Entre los 10 y los 11 ms el disco atiende a A mientras la CPU cambia de A a B. En 11 ms empieza la primera ejecución de B. Podés repetir el recorrido con otra cantidad de procesos, otro cuanto y otro costo. [Simular el costo del cambio de contexto](../dist/index.html?experimento=contexto)

Para reproducir las dos últimas láminas, elegí **STCF** en **Explorar otra carga o política**. Abrí **Ver o editar carga** e ingresá las filas en este orden.

```text
0, 8
2, 3
3, 1
```

## Fotografía del efecto convoy

La foto del proyecto SARTRE muestra dos camiones y tres autos en fila. Sirve para introducir la espera de B y C detrás del trabajo largo A. En la figura 7.2 podés medir esa espera en la línea de tiempo. [Simular el efecto convoy](../dist/index.html?figura=7.2)

La copia local `convoy-effect.jpeg` lleva el crédito «Derechos reservados de SARTRE». La misma fotografía se puede consultar en línea en la figura 16.1, página 86, del estudio británico sobre conducción en convoy. [Fotografía de SARTRE en el informe](https://assets.publishing.service.gov.uk/media/5a82acf9e5274a2e8ab58c39/truck-platooning-uk-feasibility-study.pdf#page=86)
