const {test} = require('node:test');
const assert = require('node:assert/strict');
const {simulate, cases, cpuJobs} = require('../dist/engine.js');
const figures = require('./fixtures/chapter7.js');
const run = (c, p, q=1) => simulate(cases[c].jobs, p, q);
const intervals = list => list.map(s => [s.start, s.end, s.id]);
const frameAt = (result, t) => {
  const frame = result.frames.find(f => f.t === t);
  assert.ok(frame, 'Falta la frontera t='+t);
  return frame;
};
const jobAt = (frame, id) => frame.jobs.find(j => j.id === id);
const total = list => list.reduce((sum, value) => sum+value, 0);

// Reconstruye estados a partir de intervalos esperados, sin decidir qué trabajo ejecutar.
// Las figuras no tienen cola de disco: sus intervalos de E/S coinciden con el bloqueo.
function expectedFrames(spec, jobs) {
  const times = [...spec.cpu.map(s => s[0]), spec.cpu.at(-1)[1]];
  assert.equal(spec.ready.length, times.length, 'La referencia necesita una cola por frontera');
  const wait = Object.fromEntries(jobs.map(j => [j.id, 0]));
  return times.map((t, index) => {
    if (index) {
      for (const id of spec.ready[index-1]) wait[id] += t-times[index-1];
    }
    const cpu = spec.cpu.find(([start,end]) => start <= t && t < end)?.[2] ?? null;
    const disk = (spec.disk ?? []).find(([start,end]) => start <= t && t < end)?.[2] ?? null;
    return {
      t, cpu, disk, ready:spec.ready[index].split(''),
      jobs:jobs.map(job => {
        const [, first, finish] = spec.metrics.find(m => m[0] === job.id);
        const state = t < job.arrival ? 'nuevo' : t >= finish ? 'terminado' : cpu === job.id ? 'ejecutando' : disk === job.id ? 'bloqueado' : 'listo';
        let remaining = null;
        if (state === 'terminado') remaining = 0;
        else if (state !== 'bloqueado') {
          const consumed = total(spec.cpu.filter(s => s[2] === job.id).map(([start,end]) => Math.max(0, Math.min(t,end)-start)));
          let demand = 0;
          for (let phase=0; phase<job.bursts.length; phase+=2) {
            demand += job.bursts[phase];
            if (demand > consumed) { remaining = demand-consumed; break; }
          }
        }
        return {id:job.id, state, remaining, first:t >= first ? first : null, finish:t >= finish ? finish : null, wait:wait[job.id]};
      })
    };
  });
}

// Invariantes aplicables también a cargas con cola de disco y llegadas arbitrarias.
function assertAccounting(jobs, policy, result) {
  const {frames, cpuSegments, diskSegments, metrics} = result;
  assert.equal(frames[0].t, 0);
  assert.equal(frames.at(-1).t, result.end);
  assert.equal(cpuSegments.length, frames.length-1);
  assert.deepEqual(intervals(cpuSegments), frames.slice(0,-1).map((f,i) => [f.t,frames[i+1].t,f.cpu]));
  for (const s of cpuSegments) assert.ok(s.start < s.end);
  for (let i=0; i<diskSegments.length; i++) {
    const s = diskSegments[i];
    assert.ok(s.start < s.end && s.start >= 0 && s.end <= result.end);
    if (i) assert.ok(s.start >= diskSegments[i-1].end, 'El disco no superpone operaciones');
  }
  for (const f of frames) {
    assert.deepEqual(f.jobs.filter(j => j.state === 'ejecutando').map(j => j.id), f.cpu === null ? [] : [f.cpu]);
    assert.equal(new Set(f.ready).size, f.ready.length, 'No hay duplicados en listos');
    assert.deepEqual([...f.ready].sort(), f.jobs.filter(j => j.state === 'listo').map(j => j.id).sort());
    const activeDisk = diskSegments.filter(s => s.start <= f.t && f.t < s.end);
    assert.equal(activeDisk.length, f.disk === null ? 0 : 1);
    assert.equal(activeDisk[0]?.id ?? null, f.disk);
    if (f.disk) assert.equal(jobAt(f,f.disk).state, 'bloqueado');
    if (policy !== 'SERIE' && f.cpu === null) assert.equal(f.ready.length, 0, 'No se abandona una CPU libre con trabajo listo');
    for (const j of f.jobs) {
      assert.equal(j.state === 'nuevo', f.t < jobs.find(input => input.id === j.id).arrival);
      if (j.state === 'bloqueado') {
        assert.notEqual(j.id, f.cpu);
        assert.ok(!f.ready.includes(j.id));
        assert.equal(j.remaining, null);
      }
    }
  }
  for (const input of jobs) {
    const cpu = cpuSegments.filter(s => s.id === input.id);
    const disk = diskSegments.filter(s => s.id === input.id);
    const cpuDemand = total(input.bursts.filter((_,i) => i%2 === 0));
    assert.equal(total(cpu.map(s => s.end-s.start)), cpuDemand, 'CPU consumida por '+input.id);
    assert.deepEqual(disk.map(s => s.end-s.start), input.bursts.filter((_,i) => i%2 === 1));
    let wait = 0, blocked = 0;
    for (let i=0; i<frames.length; i++) {
      const f = frames[i], current = jobAt(f,input.id);
      assert.equal(current.wait, wait, input.id+' espera acumulada en t='+f.t);
      assert.equal(current.first, f.t < cpu[0].start ? null : cpu[0].start);
      assert.equal(current.finish, f.t < cpu.at(-1).end ? null : cpu.at(-1).end);
      if (i === frames.length-1) break;
      const elapsed = frames[i+1].t-f.t;
      if (current.state === 'listo') wait += elapsed;
      if (current.state === 'bloqueado') blocked += elapsed;
    }
    const expected = {id:input.id, arrival:input.arrival, first:cpu[0].start, finish:cpu.at(-1).end, response:cpu[0].start-input.arrival, turnaround:cpu.at(-1).end-input.arrival, wait};
    assert.deepEqual(metrics.find(m => m.id === input.id), expected);
    assert.equal(expected.turnaround, cpuDemand+wait+blocked, 'Retorno = CPU + espera en listos + bloqueo');
    assert.ok(expected.response >= 0 && wait >= 0);
  }
  assert.equal(result.busy, total(cpuSegments.filter(s => s.id !== null).map(s => s.end-s.start)));
  assert.equal(result.utilization, 100*result.busy/result.end);
}

for (const spec of figures) {
  test('Figura '+spec.figure+': intervalos, colas, estados y métricas', () => {
    const jobs = cases[spec.caseId].jobs;
    const result = run(spec.caseId, spec.policy, spec.quantum ?? 1);
    assert.deepEqual(intervals(result.cpuSegments), spec.cpu);
    assert.deepEqual(intervals(result.diskSegments), spec.disk ?? []);
    const expectedMetrics = spec.metrics.map(([id, first, finish, wait]) => {
      const arrival = jobs.find(j => j.id === id).arrival;
      return {id,arrival,first,finish,response:first-arrival,turnaround:finish-arrival,wait};
    });
    assert.deepEqual(result.metrics, expectedMetrics);
    for (const key of ['response','turnaround','wait']) assert.equal(result[key], total(expectedMetrics.map(j => j[key]))/jobs.length);
    assert.equal(result.end, spec.cpu.at(-1)[1]);
    assert.deepEqual(result.frames.map(({t,cpu,disk,ready,jobs}) => ({t,cpu,disk,ready,jobs})), expectedFrames(spec,jobs));
    assertAccounting(jobs, spec.policy, result);
  });
}

test('Figura 7.5: A queda listo con 90 s en t=10 y vuelve en t=30', () => {
  const result = run('tardias','STCF');
  const at10 = frameAt(result,10);
  assert.equal(at10.cpu, 'B');
  assert.deepEqual(jobAt(at10,'A'), {id:'A',state:'listo',remaining:90,first:0,finish:null,wait:0});
  assert.equal(frameAt(result,30).cpu, 'A');
  assert.equal(jobAt(frameAt(result,30),'A').wait, 20);
});

test('Figura 7.9: A desaloja a B al empatar en 10 ms en t=80', () => {
  const result = run('disco','STCF');
  assert.equal(frameAt(result,70).cpu, 'B');
  const at80 = frameAt(result,80);
  assert.equal(at80.cpu, 'A');
  assert.deepEqual(at80.ready, ['B']);
  assert.equal(jobAt(at80,'A').remaining, 10);
  assert.equal(jobAt(at80,'B').remaining, 10);
  assert.equal(at80.disk, null);
});

test('RR: llegadas en orden de carga, desbloqueo y luego vencimiento del cuanto', () => {
  const jobs = [
    {id:'A',arrival:0,bursts:[1,2,1]}, {id:'B',arrival:0,bursts:[4]},
    {id:'F',arrival:3,bursts:[1]}, {id:'C',arrival:3,bursts:[1]}
  ];
  const result = simulate(jobs,'RR',2);
  assert.deepEqual(intervals(result.cpuSegments), [[0,1,'A'],[1,3,'B'],[3,4,'F'],[4,5,'C'],[5,6,'A'],[6,8,'B']]);
  assert.deepEqual(intervals(result.diskSegments), [[1,3,'A']]);
  const at3 = frameAt(result,3);
  assert.equal(at3.cpu, 'F');
  assert.deepEqual(at3.ready, ['C','A','B']);
  assert.equal(jobAt(at3,'B').remaining, 2);
  assertAccounting(jobs,'RR',result);
});

test('Fin de ráfaga en el límite: B se bloquea antes de las llegadas y no se reencola por cuanto', () => {
  const jobs = [
    {id:'A',arrival:0,bursts:[1,2,1]}, {id:'B',arrival:0,bursts:[2,1,1]},
    {id:'C',arrival:3,bursts:[1]}
  ];
  const result = simulate(jobs,'RR',2);
  assert.deepEqual(intervals(result.cpuSegments), [[0,1,'A'],[1,3,'B'],[3,4,'C'],[4,5,'A'],[5,6,'B']]);
  assert.deepEqual(intervals(result.diskSegments), [[1,3,'A'],[3,4,'B']]);
  const at3 = frameAt(result,3);
  assert.equal(at3.cpu, 'C');
  assert.equal(at3.disk, 'B');
  assert.deepEqual(at3.ready, ['A']);
  assert.equal(jobAt(at3,'B').state, 'bloqueado');
  assert.ok(!at3.notes.some(note => note.startsWith('Vence el cuanto')));
  assertAccounting(jobs,'RR',result);
});

test('Disco FIFO: la espera por el dispositivo también es bloqueo, no espera en listos', () => {
  const jobs = [{id:'A',arrival:0,bursts:[1,4,1]}, {id:'B',arrival:0,bursts:[1,1,1]}, {id:'C',arrival:0,bursts:[1,1,1]}];
  const result = simulate(jobs,'FIFO');
  assert.deepEqual(intervals(result.cpuSegments), [[0,1,'A'],[1,2,'B'],[2,3,'C'],[3,5,null],[5,6,'A'],[6,7,'B'],[7,8,'C']]);
  assert.deepEqual(intervals(result.diskSegments), [[1,5,'A'],[5,6,'B'],[6,7,'C']]);
  assert.deepEqual(frameAt(result,3).jobs.map(j => j.state), ['bloqueado','bloqueado','bloqueado']);
  assert.deepEqual(result.metrics.map(j => j.wait), [0,1,2]);
  assertAccounting(jobs,'FIFO',result);
});

test('FIFO aprovecha la CPU durante el bloqueo de A; SERIE conserva su reserva', () => {
  assert.equal(frameAt(run('disco','FIFO'),10).cpu, 'B');
  assert.equal(frameAt(run('disco','SERIE'),10).cpu, null);
  assert.deepEqual(frameAt(run('disco','SERIE'),10).ready, ['B']);
});

test('SJF y STCF usan la próxima ráfaga, y STCF compara el restante de quien ejecuta', () => {
  for (const policy of ['SJF','STCF']) {
    const jobs = [{id:'A',arrival:0,bursts:[2,1,20]}, {id:'B',arrival:0,bursts:[3]}];
    assert.equal(simulate(jobs,policy).frames[0].cpu, 'A');
  }
  assert.equal(frameAt(simulate(cpuJobs([10,4],[0,8]),'STCF'),8).cpu, 'A');
});

test('RR con cuanto de 5 reproduce SJF en el caso de terminales', () => {
  assert.deepEqual(run('terminales','RR',5).metrics, run('terminales','SJF').metrics);
});

test('RR en el límite: primero las llegadas, el último cuanto puede ser parcial', () => {
  const result = simulate(cpuJobs([3,1],[0,2]),'RR',2);
  assert.deepEqual(intervals(result.cpuSegments), [[0,2,'A'],[2,3,'B'],[3,4,'A']]);
});

test('Inactividad inicial e intermedia sin esperas negativas', () => {
  for (const policy of ['FIFO','SJF','STCF','RR']) {
    const jobs = cpuJobs([1,2],[7,10]);
    const result = simulate(jobs,policy);
    assert.equal(result.end, 12);
    assert.equal(result.busy, 3);
    assert.equal(result.response, 0);
    assert.equal(result.metrics[1].wait, 0);
    assertAccounting(jobs,policy,result);
  }
});

test('Carga inválida', () => {
  for (const n of [0,-1,1.5,301]) assert.throws(() => simulate(cpuJobs([n]),'RR',1));
  assert.throws(() => run('terminales','RR',0));
});

test('Conservación por trabajo y por frontera en 200 cargas con E/S', () => {
  for (const policy of ['FIFO','SJF','STCF','RR','SERIE']) {
    for (let k=1; k<=40; k++) {
      const jobs = [{id:'A',arrival:k%8,bursts:[k%7+1,4,3]}, {id:'B',arrival:k%5,bursts:[2,3,k%6+1]}, {id:'C',arrival:k%3,bursts:[9]}];
      assertAccounting(jobs,policy,simulate(jobs,policy,1+k%5));
    }
  }
});
