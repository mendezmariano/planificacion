# Desarrollo del laboratorio de planificación

El público es alumnado de Sistemas Operativos de FIUBA. Escribí las explicaciones en español rioplatense. Cada figura se reproduce sola desde la primera llegada hasta la última finalización. El color de cada trabajo se aclara en proporción a su ejecución. Formá las cuentas con los intervalos observados en el reloj. Conservá el menú, la preparación de cargas, el avance por eventos, el retroceso, la pausa y el detalle técnico consultable. Mantené el fondo crema, la cabecera celeste y los acentos por trabajo, siempre con letras visibles además del color.

## Contrato del motor

Un procesador, costo de cambio nulo, un disco FIFO. Los intervalos son [inicio, fin). Las ráfagas de cada trabajo alternan CPU y E/S. SJF y STCF usan la próxima ráfaga conocida; STCF compara lo que resta de la que ya corre. Con igual restante, el menor índice en la carga tiene prioridad. FIFO y RR respetan el orden de ingreso a listos. En una frontera se reconocen fin de ráfaga, llegadas en orden de carga, desbloqueo y vencimiento del cuanto, antes de elegir CPU. En la figura 7.9, A vuelve en t = 80 ms y empata en 10 ms con B; el desempate por índice despacha A.

La vista «E/S en serie» es el testigo de la figura 7.8. Intencionalmente permite inactividad con B listo. No generalizar ese comportamiento a FIFO.

El experimento de cambio de contexto usa RR y mide en milisegundos. Se cobra una vez cuando la CPU pasa directamente de un trabajo a otro, por vencimiento del cuanto, bloqueo o finalización. El primer despacho, la salida de un período ocioso y la renovación del cuanto del único trabajo listo cuestan cero. Durante el cambio, el próximo trabajo conserva su lugar al frente de listos y espera hasta empezar a ejecutar. El disco sigue atendiendo y las llegadas y desbloqueos ingresan al final de la cola en su instante real. El reloj suma CPU útil, cambios e inactividad.

En el experimento de la sección 7.9, cada proceso parte de la misma estimación. Después de completar una ráfaga de CPU, si pide disco, calcula la próxima como α × duración observada + (1 − α) × estimación anterior. La configuración inicial usa 20 unidades de tiempo y α = 0,5. SJF elige por ráfaga estimada y la deja terminar. STCF compara el restante estimado, con piso cero, y conserva el servicio acumulado al desalojar. El empate se resuelve por orden de carga. La referencia con oráculo usa las mismas llegadas y demandas reales. La E/S y la espera en listos se excluyen de la medición de la ráfaga.

## Criterios de aceptación

Cada cambio del motor debe conservar las nueve figuras del capítulo, la secuencia de estados y los resultados de las pruebas. Una CPU solo ejecuta un proceso a la vez. Ningún trabajo bloqueado usa CPU. La espera en listos excluye E/S. Respuesta es primera ejecución menos llegada. Retorno es finalización menos llegada. Un dato desconocido en una traza parcial se muestra como tal.

Antes de entregar, ejecutá «node --test test/engine.test.js». Probá manualmente Siguiente, Anterior, Reiniciar, Reproducir, selección de política y una carga propia. Verificá la interfaz con teclado y tamaño de pantalla angosto. Conservá el arranque directo desde dist/index.html sin dependencias remotas.
