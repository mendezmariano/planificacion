/* Referencias y consignas del capítulo 7. La simulación vive en engine.js. */
(function (root) {
  'use strict';

  const lessons = {
    iguales: {
      sections: '7.3 · FIFO',
      assumptions: 'A, B y C llegan en t = 0 y usan 10 s de CPU cada uno. No hay E/S.',
      question: 'Anticipá el orden de ejecución y calculá el retorno medio. ¿Qué cambia al elegir otra política?',
      figures: [
        {number:'7.1', policy:'FIFO', section:'7.3 · FIFO', title:'Ejemplo sencillo de FIFO', question:'Antes de avanzar, anotá cuándo terminará cada trabajo. ¿Cómo calcularías el retorno medio?'}
      ]
    },
    convoy: {
      sections: '7.3 · FIFO y 7.4 · SJF',
      assumptions: 'Todos llegan en t = 0. A usa 100 s de CPU; B y C usan 10 s cada uno. No hay E/S.',
      question: 'Anticipá cuánto esperarán B y C. Compará el retorno medio con las configuraciones de FIFO y SJF del apunte.',
      figures: [
        {number:'7.2', policy:'FIFO', section:'7.3 · FIFO', title:'Por qué FIFO no es tan bueno', question:'¿Cuánto esperan B y C detrás de A? Seguí la ejecución y explicá el efecto convoy.'},
        {number:'7.3', policy:'SJF', section:'7.4 · SJF', title:'Ejemplo sencillo de SJF', question:'Anticipá qué trabajo empieza. ¿Cómo cambia el retorno medio respecto de FIFO con esta misma carga?'}
      ]
    },
    tardias: {
      sections: '7.4 · SJF y 7.5 · STCF',
      assumptions: 'A llega en t = 0 y usa 100 s de CPU. B y C llegan en t = 10 y usan 10 s cada uno. No hay E/S.',
      question: 'Anticipá qué ocurre cuando llegan B y C en t = 10. Compará el resultado con SJF y STCF.',
      figures: [
        {number:'7.4', policy:'SJF', section:'7.4 · SJF', title:'SJF con llegadas tardías de B y C', question:'Cuando llegan B y C en t = 10, ¿pueden interrumpir a A? Calculá el retorno de cada trabajo desde su llegada.'},
        {number:'7.5', policy:'STCF', section:'7.5 · STCF', title:'Ejemplo sencillo de STCF', question:'En t = 10, compará lo que le queda a A con la duración de B y C. ¿Quién ejecutará y cuándo volverá A?'}
      ]
    },
    terminales: {
      sections: '7.7 · Round Robin; tiempo de respuesta definido en 7.6',
      assumptions: 'A, B y C llegan en t = 0 y usan 5 s de CPU cada uno. No hay E/S.',
      question: 'Anotá cuándo usa la CPU cada trabajo por primera vez y cuándo termina. Compará respuesta y retorno con SJF y con RR de cuanto 1 s.',
      figures: [
        {number:'7.6', policy:'SJF', section:'7.7 · Round Robin', title:'SJF otra vez, malo para el tiempo de respuesta', question:'¿Cuánto tarda C en usar la CPU por primera vez? Calculá la respuesta media y después comparala con RR de cuanto 1 s.'},
        {number:'7.7', policy:'RR', quantum:1, section:'7.7 · Round Robin', title:'Round Robin, bueno para el tiempo de respuesta', question:'Con un cuanto de 1 s, ¿cuándo empieza cada trabajo? Compará la respuesta y el retorno con SJF.'}
      ]
    },
    disco: {
      sections: '7.8 · Incorporación de la E/S',
      assumptions: 'Ambos llegan en t = 0. A alterna cinco ráfagas de CPU de 10 ms con cuatro E/S de 10 ms. B usa 50 ms de CPU. Hay un disco FIFO.',
      question: 'Observá qué hace la CPU mientras A está bloqueado. Compará el fin del lote y la utilización con las figuras 7.8 y 7.9.',
      note: 'E/S en serie es el testigo de la figura 7.8: deja la CPU ociosa con B listo mientras espera a A. Esa reserva de turno no es el comportamiento de FIFO.',
      figures: [
        {number:'7.8', policy:'SERIE', section:'7.8 · Incorporación de la E/S', title:'Mal aprovechamiento de los recursos', question:'En t = 10 ms, ¿qué hacen la CPU, el disco y B? Identificá los intervalos en que podría aprovecharse la CPU.'},
        {number:'7.9', policy:'STCF', section:'7.8 · Incorporación de la E/S', title:'La superposición permite aprovechar mejor los recursos', question:'Anticipá quién usa la CPU durante cada E/S de A. En t = 80 ms, compará los restantes y aplicá el desempate por orden de carga.'}
      ]
    }
  };

  function contextFor(caseId, policy, quantum) {
    const unit = caseId === 'disco' ? 'ms' : 's';
    const policyAssumption = {
      FIFO: 'FIFO respeta el ingreso a listos y no desaloja una ráfaga en curso.',
      SJF: 'SJF conoce la próxima ráfaga de CPU y no desaloja una ráfaga en curso.',
      STCF: 'STCF conoce la próxima ráfaga de CPU y permite el desalojo. Los empates se resuelven por orden de carga.',
      RR: 'RR respeta el ingreso a listos y usa un cuanto de '+quantum+' '+unit+'.',
      SERIE: 'E/S en serie reserva el turno de A hasta que termine, incluso durante sus bloqueos.'
    }[policy];
    const common = 'Un procesador y cambios de contexto de costo cero. ';
    if (caseId === 'propia') {
      return {
        kind:'custom', figure:null, mode:'Carga propia',
        reference:'Capítulo 7 · Exploración de las políticas de planificación',
        configuration:'Sin figura asociada: las llegadas y duraciones fueron definidas por vos.',
        assumptions:common+'Solo CPU, sin E/S. '+policyAssumption,
        question:'Antes de avanzar, anticipá el primer trabajo y qué ocurrirá con las próximas llegadas. Al terminar, compará respuesta y retorno entre políticas.',
        note:''
      };
    }
    const lesson = lessons[caseId];
    const original = lesson.figures.find(f => f.policy === policy && (f.quantum === undefined || f.quantum === quantum));
    const configurations = lesson.figures.map(f => {
      const name = f.policy === 'SERIE' ? 'E/S en serie' : f.policy;
      return name+(f.quantum === undefined ? '' : ' con cuanto '+f.quantum+' s')+' → figura '+f.number;
    }).join(' · ');
    return {
      kind:original ? 'original' : 'variant',
      figure:original?.number ?? null,
      mode:original ? 'Configuración del apunte' : 'Variante del apunte',
      reference:original ? 'Sección '+original.section+' · Figura '+original.number+': '+original.title : 'Capítulo 7 · '+lesson.sections+' · '+(lesson.figures.length === 1 ? 'Figura ' : 'Figuras ')+lesson.figures.map(f=>f.number).join(' y '),
      configuration:'Configuraciones del apunte: '+configurations+'.',
      assumptions:common+lesson.assumptions+' '+policyAssumption,
      question:original?.question ?? lesson.question,
      note:lesson.note ?? ''
    };
  }

  const api = {contextFor};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CpuChapter = api;
})(globalThis);
