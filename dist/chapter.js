/* El selector y las referencias de las variantes comparten el índice del apunte. */
(function (root) {
  'use strict';

  const lessons = {
    iguales: {sections:'7.3', load:'A, B y C llegan juntos y necesitan 10 s cada uno.'},
    convoy: {sections:'7.3 y 7.4', load:'Los tres llegan juntos. A necesita 100 s y B y C necesitan 10 s cada uno.'},
    tardias: {sections:'7.4 y 7.5', load:'A llega en 0 s y necesita 100 s. B y C llegan en 10 s y necesitan 10 s cada uno.'},
    terminales: {sections:'7.7', load:'Los tres trabajos llegan en 0 s. Cada uno necesita 5 s de ejecución.'},
    disco: {sections:'7.8', load:'A y B llegan juntos y necesitan 50 ms de CPU cada uno. A alterna cinco ráfagas de 10 ms con cuatro operaciones de E/S de 10 ms.'}
  };
  const figures = [
    {number:'7.1', section:'7.3', caseId:'iguales', policy:'FIFO', title:'Ejemplo sencillo de FIFO'},
    {number:'7.2', section:'7.3', caseId:'convoy', policy:'FIFO', title:'Por qué FIFO no es tan bueno'},
    {number:'7.3', section:'7.4', caseId:'convoy', policy:'SJF', title:'Ejemplo sencillo de SJF'},
    {number:'7.4', section:'7.4', caseId:'tardias', policy:'SJF', title:'SJF con llegadas tardías de B y C'},
    {number:'7.5', section:'7.5', caseId:'tardias', policy:'STCF', title:'Ejemplo sencillo de STCF'},
    {number:'7.6', section:'7.7', caseId:'terminales', policy:'SJF', title:'SJF otra vez (malo para el tiempo de respuesta)'},
    {number:'7.7', section:'7.7', caseId:'terminales', policy:'RR', quantum:1, title:'Round Robin (bueno para el tiempo de respuesta)'},
    {number:'7.8', section:'7.8', caseId:'disco', policy:'SERIE', title:'Mal aprovechamiento de los recursos'},
    {number:'7.9', section:'7.8', caseId:'disco', policy:'STCF', title:'La superposición permite aprovechar mejor los recursos'}
  ];
  // La sección 7.6 vuelve a la figura 7.5 para introducir la primera respuesta.
  const readings = figures.flatMap(f => {
    const original = {...f, key:f.number};
    if (f.number !== '7.5') return [original];
    return [original, {...f, key:'respuesta', section:'7.6', title:'Tiempo de respuesta'}];
  });

  function contextFor(caseId, policy, quantum, reading) {
    const unit = caseId === 'disco' ? 'ms' : 's';
    const rule = {
      FIFO:'FIFO respeta el ingreso a listos y no desaloja una ráfaga en curso.',
      SJF:'SJF elige la ráfaga lista más corta y la deja terminar.',
      STCF:'STCF compara lo que resta de la ráfaga y permite el desalojo. En un empate tiene prioridad el orden de carga.',
      RR:'RR respeta el ingreso a listos y usa un cuanto de '+quantum+' '+unit+'.',
      SERIE:'E/S en serie reserva el turno de A incluso durante sus bloqueos.'
    }[policy];
    const assumptions = 'Un procesador y cambios de contexto de costo cero. ' + rule;
    if (caseId === 'propia') return {
      kind:'custom', figure:null, mode:'Carga propia', title:'Carga propia',
      reference:'Capítulo 7 · '+policy, configuration:'Sin figura asociada. Se usan tus llegadas y duraciones.',
      load:'Los trabajos aparecen por orden de llegada.', assumptions:assumptions+' Carga sin E/S.', note:''
    };
    const lesson = lessons[caseId];
    const options = figures.filter(f => f.caseId === caseId);
    const base = options.find(f => f.policy === policy && (f.quantum === undefined || f.quantum === quantum));
    const entry = base?.number === '7.5' && reading === 'respuesta' ? readings.find(r => r.key === reading) : base;
    return {
      kind:entry ? 'original' : 'variant', figure:entry?.number ?? null,
      mode:entry ? 'Configuración del apunte' : 'Variante del apunte',
      title:entry?.title, section:entry?.section ?? lesson.sections,
      reference:entry ? 'Sección '+entry.section+' · Figura '+entry.number : 'Secciones '+lesson.sections+' · Variante del apunte',
      configuration:options.map(f => (f.policy === 'SERIE' ? 'E/S en serie' : f.policy)+(f.quantum ? ' con cuanto '+f.quantum+' s' : '')+' → figura '+f.number).join(' · '),
      load:lesson.load, assumptions,
      note:caseId === 'disco' ? 'La reserva de turno de la figura 7.8 no es el comportamiento de FIFO. La figura 7.9 usa STCF con un disco FIFO.' : ''
    };
  }

  const api = {readings, contextFor};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CpuChapter = api;
})(globalThis);
