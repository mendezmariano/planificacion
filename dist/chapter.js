/* El selector y las referencias de las variantes comparten el índice del apunte. */
(function (root) {
  'use strict';

  // El orden fija la numeración de la sección 7.1.
  const workloadAssumptions = [
    {label:'igual duración', statement:'Todos los trabajos necesitan la misma cantidad de tiempo de CPU.'},
    {label:'llegadas simultáneas', statement:'Todos los trabajos llegan en el mismo instante.'},
    {label:'ejecución hasta terminar', statement:'Una vez que un trabajo toma la CPU, sigue ejecutando hasta terminar.'},
    {label:'uso exclusivo de CPU', statement:'Los trabajos usan solamente la CPU, sin operaciones de entrada/salida (E/S).'},
    {label:'duración conocida', statement:'El planificador conoce de antemano el tiempo de ejecución de cada trabajo.'}
  ];

  function relaxedAssumptions(jobs, policy, estimated) {
    const usesDisk = jobs.some(job => job.usesDisk);
    const relaxed = [];
    if (jobs.some(job => job.demand !== jobs[0].demand)) relaxed.push(1);
    if (jobs.some(job => job.arrival !== jobs[0].arrival)) relaxed.push(2);
    // Se puede interrumpir un trabajo aunque en esta carga le alcance un solo turno.
    if (usesDisk || policy === 'RR' || policy === 'STCF') relaxed.push(3);
    if (usesDisk) relaxed.push(4);
    if (estimated) relaxed.push(5);
    return relaxed;
  }

  const lessons = {
    iguales: {sections:'7.3', load:'A, B y C llegan juntos y necesitan 10 s cada uno.'},
    convoy: {sections:'7.3 y 7.4', load:'Los tres llegan juntos. A necesita 100 s y B y C necesitan 10 s cada uno.'},
    tardias: {sections:'7.4 y 7.5', load:'A llega en 0 s y necesita 100 s. B y C llegan en 10 s y necesitan 10 s cada uno.'},
    terminales: {sections:'7.7', load:'Los tres trabajos llegan en 0 s. Cada uno necesita 5 s de ejecución.'},
    disco: {sections:'7.8', load:'A y B llegan juntos y necesitan 50 ms de CPU cada uno. A alterna cinco ráfagas de 10 ms con cuatro operaciones de E/S de 10 ms.'}
  };
  const figures = [
    {number:'7.1', section:'7.3', caseId:'iguales', policy:'FIFO', title:'Ejemplo sencillo de FIFO',
      assumptionNote:'Los tres trabajos llegan en 0 s. Cada uno necesita 10 s de CPU y FIFO le da un turno completo.'},
    {number:'7.2', section:'7.3', caseId:'convoy', policy:'FIFO', assumptionFocus:1, title:'Por qué FIFO no es tan bueno',
      assumptionNote:'A necesita 100 s de CPU. B y C necesitan 10 s cada uno, pero FIFO los deja en la cola detrás de A.'},
    {number:'7.3', section:'7.4', caseId:'convoy', policy:'SJF', assumptionFocus:1, title:'Ejemplo sencillo de SJF',
      menuDetail:'Primero el trabajo más corto',
      assumptionNote:'Se mantiene la carga de la figura 7.2. SJF elige primero a B y C, de 10 s cada uno, y después a A, de 100 s.'},
    {number:'7.4', section:'7.4', caseId:'tardias', policy:'SJF', assumptionFocus:2, title:'SJF con llegadas tardías de B y C',
      assumptionNote:'A llega en 0 s y B y C en 10 s. Para calcular cada retorno se resta el instante de llegada de ese trabajo.'},
    {number:'7.5', section:'7.5', caseId:'tardias', policy:'STCF', assumptionFocus:3, title:'Ejemplo sencillo de STCF',
      assumptionNote:'Cuando B y C llegan en 10 s, STCF puede desalojar a A y dejar para otro turno la CPU que le falta.'},
    {number:'7.6', section:'7.7', caseId:'terminales', policy:'SJF', title:'SJF otra vez (malo para el tiempo de respuesta)',
      assumptionNote:'Los tres llegan juntos y necesitan 5 s cada uno. SJF deja terminar a cada trabajo. Para medir la respuesta, mirá cuándo empieza su primer turno.'},
    {number:'7.7', section:'7.7', caseId:'terminales', policy:'RR', quantum:1, assumptionFocus:3, title:'Round Robin (bueno para el tiempo de respuesta)',
      assumptionNote:'La carga es la misma que en la figura 7.6. Al vencer el cuanto de 1 s, RR devuelve a listos al trabajo que todavía necesita CPU.'},
    {number:'7.8', section:'7.8', caseId:'disco', policy:'SERIE', assumptionFocus:4, title:'Mal aprovechamiento de los recursos',
      assumptionNote:'A deja la CPU para usar el disco durante 10 ms. En este ejemplo se le reserva el turno y B espera con la CPU ociosa.'},
    {number:'7.9', section:'7.8', caseId:'disco', policy:'STCF', assumptionFocus:4, title:'La superposición permite aprovechar mejor los recursos',
      assumptionNote:'Se mantiene la E/S de la figura 7.8. Mientras A usa el disco, B usa la CPU. Cuando A vuelve a listos, STCF puede interrumpir a B.'}
  ];
  // La sección 7.6 vuelve a la figura 7.5 para introducir la primera respuesta.
  const readings = figures.flatMap(f => {
    const original = {...f, key:f.number};
    if (f.number !== '7.5') return [original];
    return [original, {...f, key:'respuesta', section:'7.6', title:'Tiempo de respuesta', menuDetail:'Tiempo de respuesta (sección 7.6)',
      assumptionNote:'Se conservan los supuestos de la figura 7.5. Ahora se mide la respuesta desde la llegada hasta el primer uso de la CPU.'}];
  });

  function figureLabel(figure) {
    const policy = figure.policy === 'SERIE' ? 'E/S en serie' : figure.policy;
    return 'Figura '+figure.number+' · '+policy;
  }

  function contextFor(caseId, policy, quantum, reading) {
    const unit = caseId === 'disco' ? 'ms' : 's';
    const rule = {
      FIFO:'FIFO respeta el ingreso a listos y no desaloja una ráfaga en curso.',
      SJF:'SJF conoce la duración de la próxima ráfaga. Elige la más corta entre los trabajos listos y la deja terminar.',
      STCF:'STCF conoce las próximas ráfagas, compara lo que resta de la que ya corre y permite el desalojo. En un empate tiene prioridad el orden de carga.',
      RR:'RR respeta el ingreso a listos y usa un cuanto de '+quantum+' '+unit+'.',
      SERIE:'E/S en serie reserva el turno de A incluso durante sus bloqueos.'
    }[policy];
    const resources = caseId === 'disco' ? 'Un disco FIFO atiende la E/S.' : 'La carga usa solo CPU, sin E/S.';
    const assumptions = 'Un procesador y cambios de contexto de costo cero. '+resources+' '+rule;
    if (caseId === 'propia') return {
      kind:'custom', figure:null, mode:'Carga propia', title:'Carga propia',
      reference:'Carga propia · '+policy, configuration:'Sin figura asociada. Se usan tus llegadas y duraciones.',
      load:'Los trabajos aparecen por orden de llegada.', assumptions, assumptionNote:rule, note:''
    };
    const lesson = lessons[caseId];
    const options = figures.filter(f => f.caseId === caseId);
    const base = options.find(f => f.policy === policy && (f.quantum === undefined || f.quantum === quantum));
    const entry = base?.number === '7.5' && reading === 'respuesta' ? readings.find(r => r.key === reading) : base;
    return {
      kind:entry ? 'original' : 'variant', figure:entry?.number ?? null,
      mode:entry ? 'Configuración del apunte' : 'Variante del apunte',
      title:entry?.title, section:entry?.section ?? lesson.sections,
      reference:entry ? figureLabel(entry)+' · Sección '+entry.section : 'Secciones '+lesson.sections+' · Variante del apunte',
      configuration:options.map(f => (f.policy === 'SERIE' ? 'E/S en serie' : f.policy)+(f.quantum ? ' con cuanto '+f.quantum+' s' : '')+' → figura '+f.number).join(' · '),
      load:lesson.load, assumptions, assumptionFocus:entry?.assumptionFocus, assumptionNote:entry?.assumptionNote ?? rule,
      note:caseId === 'disco' ? 'La reserva de turno de la figura 7.8 no es el comportamiento de FIFO. La figura 7.9 usa STCF con un disco FIFO.' : ''
    };
  }

  // Las dos trazas llegan hasta el mismo instante y siguen el orden de las figuras del capítulo.
  function comparisonNote(caseId, left, right, quantum) {
    switch (caseId) {
      case 'convoy':
        return 'En FIFO, B y C esperan detrás de A. SJF elige primero las ráfagas cortas y reduce la espera de B y C.';
      case 'tardias':
        if (right.jobs[1].state === 'nuevo') return 'A es el único trabajo que llegó. SJF y STCF le dan la CPU.';
        return 'Cuando llegan B y C, SJF deja que A termine su ráfaga. STCF desaloja a A y atiende primero a B y C.';
      case 'terminales': {
        const c = right.jobs[2];
        if (right.jobs.every(j => j.finish !== null)) {
          if (left.jobs.every((j, i) => j.finish === right.jobs[i].finish)) {
            return 'Cada trabajo termina en su primer turno de RR. Los primeros usos y las finalizaciones coinciden con SJF.';
          }
          return 'Con RR, B y C reciben CPU antes. Al alternarse los tres trabajos, A y B terminan más tarde que con SJF. Por eso baja la respuesta media y sube el retorno medio.';
        }
        if (c.first !== null && left.jobs[2].first === null) {
          return 'C ya recibió CPU con RR a los '+c.first+' s. En SJF todavía espera su primer turno. La respuesta de C con RR ya entra en la cuenta.';
        }
        return 'SJF deja que cada trabajo complete su ráfaga. RR le da al primero en la cola hasta '+quantum+' s de CPU por turno.';
      }
      case 'disco':
        return 'En la figura 7.8, B espera mientras A usa el disco. En la 7.9, B puede ejecutar durante esa E/S. Cada intervalo compartido cuenta una sola vez en el tiempo del lote.';
    }
  }

  const api = {figures, readings, figureLabel, contextFor, comparisonNote, workloadAssumptions, relaxedAssumptions};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CpuChapter = api;
})(globalThis);
