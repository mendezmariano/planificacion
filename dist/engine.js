/* Motor determinista. Todos los instantes y duraciones se expresan en la unidad del caso. */
(function (root) {
  'use strict';
  const POLICIES = ['FIFO', 'SJF', 'STCF', 'RR', 'SERIE'];
  function simulate(input, policy, quantum = 1, switchCost = 0) {
    if (!POLICIES.includes(policy)) throw Error('Política desconocida.');
    if (!Number.isSafeInteger(quantum) || quantum < 1 || quantum > 300) throw Error('El cuanto debe ser un entero de 1 a 300.');
    if (!Number.isSafeInteger(switchCost) || switchCost < 0 || switchCost > 300) throw Error('El costo de cambio debe ser un entero de 0 a 300 ms.');
    if (switchCost && policy !== 'RR') throw Error('El costo de cambio se configura en Round Robin.');
    if (!Array.isArray(input) || input.length < 1 || input.length > 6) throw Error('Se necesitan entre 1 y 6 trabajos.');
    const ids = new Set();
    const jobs = input.map((j, index) => {
      if (typeof j.id !== 'string' || !/^[A-F]$/.test(j.id) || ids.has(j.id)) throw Error('Cada trabajo necesita una letra distinta de A a F.');
      ids.add(j.id);
      if (!Number.isSafeInteger(j.arrival) || j.arrival < 0 || j.arrival > 300) throw Error('La llegada debe ser un entero de 0 a 300.');
      if (!Array.isArray(j.bursts) || !j.bursts.length || j.bursts.length % 2 !== 1 || j.bursts.length > 15 || j.bursts.some(v => !Number.isSafeInteger(v) || v < 1 || v > 300)) throw Error('Las ráfagas deben alternar CPU y E/S, empezar y terminar con CPU y durar de 1 a 300.');
      return { ...j, index, state: 'nuevo', phase: 0, remaining: j.bursts[0], first: null, finish: null, wait: 0 };
    });
    const ready = [], diskQueue = [], cpuSegments = [], diskSegments = [], frames = [];
    const switches = [];
    let switching = null;
    let t = 0, cpu = null, disk = null, diskEnd = Infinity, budget = Infinity, finished = 0;
    const addReady = job => { job.state = 'listo'; ready.push(job); };
    const order = (a, b) => a.remaining - b.remaining || a.index - b.index;
    function startDisk() {
      if (disk || !diskQueue.length) return;
      disk = diskQueue.shift();
      diskEnd = t + disk.bursts[disk.phase];
      diskSegments.push({ start: t, end: diskEnd, id: disk.id });
    }
    function dispatch(job) {
      ready.splice(ready.indexOf(job), 1);
      cpu = job; cpu.state = 'ejecutando';
      if (cpu.first === null) cpu.first = t;
      budget = policy === 'RR' ? quantum : Infinity;
    }
    while (finished < jobs.length) {
      const notes = [];
      const outgoing = cpu;
      if (switching && switching.end === t) switching = null;
      // Finalizar la ráfaga antes de resolver llegadas, desbloqueos y vencimiento de cuanto.
      if (cpu && cpu.remaining === 0) {
        if (cpu.phase === cpu.bursts.length - 1) {
          cpu.finish = t; cpu.state = 'terminado'; finished++;
          notes.push(cpu.id + ' termina.');
        } else {
          cpu.phase++; cpu.state = 'bloqueado'; diskQueue.push(cpu);
          notes.push(cpu.id + ' pide E/S y queda bloqueado.');
        }
        cpu = null;
      }
      for (const j of jobs) if (j.state === 'nuevo' && j.arrival === t) {
        addReady(j); notes.push('Llega ' + j.id + '.');
      }
      if (disk && diskEnd === t) {
        disk.phase++; disk.remaining = disk.bursts[disk.phase];
        notes.push('Termina la E/S de ' + disk.id + ', que vuelve a listos.');
        addReady(disk); disk = null; diskEnd = Infinity;
      }
      startDisk();
      if (cpu && policy === 'RR' && budget === 0) {
        notes.push('Vence el cuanto de ' + cpu.id + '. Vuelve al final de la cola.');
        addReady(cpu); cpu = null;
      }
      if (cpu && policy === 'STCF' && ready.some(j => order(j, cpu) < 0)) {
        notes.push('El planificador desaloja a ' + cpu.id + ' (le quedan ' + cpu.remaining + ').');
        addReady(cpu); cpu = null;
      }
      if (policy === 'STCF' || policy === 'SJF') ready.sort(order);
      let decision = '';
      if (!cpu && !switching && ready.length) {
        // Testigo de la figura 7.8: se reserva el turno para el trabajo de menor índice pendiente.
        const next = policy === 'SERIE' ? jobs.find(j => j.state !== 'terminado') : ready[0];
        if (next && next.state === 'listo') {
          if (policy === 'RR' && outgoing && outgoing !== next) {
            const change = {from:outgoing.id, to:next.id, start:t, end:t+switchCost};
            switches.push(change);
            if (switchCost > 0) switching = change;
          }
          if (!switching) {
            dispatch(next);
            const why = {FIFO:'por orden de entrada a listos', SJF:'por tener la ráfaga lista más corta', STCF:'por tener el menor tiempo restante de ráfaga', RR:'por estar al frente de la cola', SERIE:'por el orden fijo del ejemplo en serie'};
            decision = 'Ejecuta ' + next.id + ' ' + why[policy] + '.';
          }
        }
      }
      if (switching) decision = 'Cambio de contexto de '+switching.from+' a '+switching.to+'. '+switching.to+' espera para empezar su turno.';
      if (!decision && cpu) decision = 'Continúa ' + cpu.id + (policy === 'STCF' ? ': conserva la prioridad por tiempo restante y desempate.' : policy === 'RR' ? ': todavía dispone de cuanto.' : ': conserva la CPU hasta terminar su ráfaga.');
      if (!decision) decision = finished === jobs.length ? 'Todos los trabajos terminaron.' : policy === 'SERIE' && ready.length ? 'La CPU queda ociosa aunque hay un trabajo listo. El ejemplo en serie espera al trabajo anterior.' : 'La CPU queda ociosa hasta el siguiente evento.';
      frames.push({t, cpu:cpu?.id ?? null, switching, disk:disk?.id ?? null, ready:ready.map(j=>j.id), notes, decision, jobs:jobs.map(j=>({id:j.id,state:j.state,remaining:j.state==='terminado'?0:j.state==='bloqueado'?null:j.remaining,first:j.first,finish:j.finish,wait:j.wait}))});
      if (finished === jobs.length) break;
      const nextArrival = Math.min(...jobs.filter(j=>j.state==='nuevo').map(j=>j.arrival),Infinity);
      const nextTime = Math.min(nextArrival, diskEnd, switching?.end ?? Infinity, cpu ? t + Math.min(cpu.remaining, budget) : Infinity);
      if (!Number.isFinite(nextTime) || nextTime <= t) throw Error('El motor no pudo avanzar.');
      const elapsed = nextTime - t;
      const segment = {start:t, end:nextTime, id:cpu?.id ?? null};
      if (switching) segment.switching = switching;
      cpuSegments.push(segment);
      if (cpu) { cpu.remaining -= elapsed; budget -= elapsed; }
      ready.forEach(j=>{j.wait += elapsed;});
      t = nextTime;
    }
    const metrics = jobs.map(j=>({id:j.id,arrival:j.arrival,first:j.first,finish:j.finish,response:j.first-j.arrival,turnaround:j.finish-j.arrival,wait:j.wait}));
    const mean = key => metrics.reduce((s,j)=>s+j[key],0)/jobs.length;
    const busy = cpuSegments.reduce((s,x)=>s+(x.id?x.end-x.start:0),0);
    return {frames,cpuSegments,diskSegments,switches,switchCost,metrics,response:mean('response'),turnaround:mean('turnaround'),wait:mean('wait'),end:t,busy,utilization:100*busy/t};
  }
  const cpuJobs=(lengths,arrivals=[])=>lengths.map((n,i)=>({id:String.fromCharCode(65+i),arrival:arrivals[i]??0,bursts:[n]}));
  const cases = {
    iguales:{name:'Tres trabajos iguales',unit:'s',jobs:cpuJobs([10,10,10])},
    convoy:{name:'Efecto convoy',unit:'s',jobs:cpuJobs([100,10,10])},
    tardias:{name:'Llegadas tardías',unit:'s',jobs:cpuJobs([100,10,10],[0,10,10])},
    terminales:{name:'Tres terminales',unit:'s',jobs:cpuJobs([5,5,5])},
    disco:{name:'CPU y disco',unit:'ms',jobs:[{id:'A',arrival:0,bursts:[10,10,10,10,10,10,10,10,10]},{id:'B',arrival:0,bursts:[50]}]}
  };
  function contextSwitchJobs(cpuCount, ioCount) {
    const count = cpuCount + ioCount;
    if (![cpuCount, ioCount].every(n => Number.isInteger(n) && n >= 0) || count < 1 || count > 6) {
      throw Error('Elegí entre 1 y 6 procesos en total. Podés dejar un tipo en cero.');
    }
    const [ioJob, cpuJob] = cases.disco.jobs;
    return Array.from({length:count}, (_,i) => ({
      id:String.fromCharCode(65+i), arrival:0, bursts:[...(i < ioCount ? ioJob : cpuJob).bursts]
    }));
  }
  const api = {simulate, cases, cpuJobs, contextSwitchJobs};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CpuLab = api;
})(globalThis);
