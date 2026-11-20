const {test} = require('node:test');
const assert = require('node:assert/strict');
const {cases, simulate, cpuJobs} = require('../dist/engine.js');
const {readTrace} = require('../dist/trace.js');
const figures = require('./fixtures/chapter7.js');

const consumed = (intervals, id, time) => intervals.reduce((sum,[start,end,who]) =>
  sum + (who === id ? Math.max(0,Math.min(time,end)-start) : 0), 0);

for (const f of figures) {
  test('Figura '+f.figure+' en fronteras, a mitad de los tramos y al retroceder', () => {
    const inputs = cases[f.caseId].jobs;
    const result = simulate(inputs, f.policy, f.quantum);
    const trace = readTrace(inputs,result);
    const times = [result.end, ...f.cpu.flatMap(([start,end]) => [start,(start+end)/2])].reverse();
    for (const time of times) {
      const view = trace.at(time);
      assert.equal(view.frame.cpu, f.cpu.find(([a,b]) => a<=time && time<b)?.[2] ?? null);
      assert.equal(view.frame.disk, (f.disk ?? []).find(([a,b]) => a<=time && time<b)?.[2] ?? null);
      for (const j of view.jobs) {
        const [,first,finish] = f.metrics.find(row => row[0] === j.id);
        const expected = consumed(f.cpu,j.id,time);
        const waited = f.cpu.reduce((sum,[a,b],i) =>
          sum + (f.ready[i].includes(j.id) ? Math.max(0,Math.min(time,b)-a) : 0),0);
        assert.equal(j.cpu.total, expected);
        assert.equal(j.left, j.demand-expected);
        assert.equal(j.wait.total, waited);
        assert.equal(j.io.total, consumed(f.disk ?? [],j.id,time));
        assert.equal(j.first, time >= first ? first : null);
        assert.equal(j.finish, time >= finish ? finish : null);
        assert.equal(j.state === 'nuevo', time<j.arrival);
      }
      if (f.disk) {
        const service = view.jobs.reduce((sum,j) => sum+j.cpu.total+j.io.total,0);
        assert.equal(service - view.overlap, time, 'La E/S simultánea se cuenta una vez');
      }
    }
  });
}

test('A acumula dos tramos en STCF y conserva su espera mientras se reanuda', () => {
  const jobs = cases.tardias.jobs;
  const trace = readTrace(jobs,simulate(jobs,'STCF'));
  const [a,b,c] = trace.at(35).jobs;
  assert.deepEqual(a.cpu,{prior:10,start:30,end:35,total:15});
  assert.deepEqual(a.wait,{prior:0,start:10,end:30,total:20});
  assert.equal(a.burst,85);
  assert.deepEqual([a.finish,b.finish,c.finish],[null,20,30]);
  assert.equal(trace.at(9.5).jobs[1].state,'nuevo');
  assert.deepEqual(trace.cpuRuns.map(s=>s.id),['A','B','C','A']);
});

test('Una llegada durante una ráfaga de SJF deja una sola barra continua', () => {
  const jobs = cases.tardias.jobs;
  const trace = readTrace(jobs,simulate(jobs,'SJF'));
  assert.deepEqual(trace.cpuRuns[0],{id:'A',start:0,end:100});
  assert.deepEqual(trace.at(40).jobs[0].cpu,{prior:0,start:0,end:40,total:40});
});

test('Carga propia con inactividad y llegadas fuera del orden de edición', () => {
  const inputs = cpuJobs([2,1,2],[6,2,6]);
  const trace = readTrace(inputs,simulate(inputs,'FIFO'));
  assert.ok(trace.at(0).jobs.every(j=>j.state==='nuevo' && j.first===null));
  assert.equal(trace.at(5).idle,4);
  assert.deepEqual(trace.at(6).jobs.map(j=>[j.id,j.state]),[['B','terminado'],['A','ejecutando'],['C','listo']]);
});

test('El reloj forma y deshace la cuenta del cambio incluso si el disco termina en el medio', () => {
  const inputs = [{id:'A',arrival:0,bursts:[1,1,1]}, {id:'B',arrival:0,bursts:[2]}];
  const r = simulate(inputs,'RR',2,3);
  const trace = readTrace(inputs,r);
  assert.deepEqual(trace.cpuRuns.filter(s => s.switching).map(s => [s.start,s.end]), [[1,4],[6,9]]);
  for (const [t,cpu,changes,count] of [[10,4,6,2],[6.5,3,3.5,1],[4,1,3,1],[2.5,1,1.5,0],[1,1,0,0],[0,0,0,0]]) {
    const s = trace.at(t);
    assert.deepEqual([s.busy,s.switchTime,s.idle,s.completedSwitches],[cpu,changes,0,count]);
    assert.equal(s.time,s.busy+s.switchTime+s.idle);
  }
  const [a,b] = trace.at(2.5).jobs;
  assert.deepEqual([a.io.total,a.wait.total,b.wait.total,b.first],[1,0.5,2.5,null]);
  const free = readTrace(inputs,simulate(inputs,'RR',2));
  assert.equal(free.at(1).completedSwitches,1);
  assert.equal(free.at(1).switchTime,0);
  const alone = readTrace([inputs[0]],simulate([inputs[0]],'RR',1,3));
  assert.deepEqual([alone.at(1.5).busy,alone.at(1.5).switchTime,alone.at(1.5).idle],[1,0,0.5]);
});
