const {test}=require('node:test');
const assert=require('node:assert/strict');
const {simulate,cases,cpuJobs}=require('../dist/engine.js');
const run=(c,p,q=1)=>simulate(cases[c].jobs,p,q);
test('Figuras 7.1 a 7.5: convoy, llegadas tardías y desalojo',()=>{
  assert.equal(run('iguales','FIFO').turnaround,20);
  assert.equal(run('convoy','FIFO').turnaround,110);
  assert.equal(run('convoy','SJF').turnaround,50);
  assert.equal(run('tardias','SJF').turnaround,310/3);
  const r=run('tardias','STCF');
  assert.deepEqual(r.cpuSegments.map(x=>[x.start,x.end,x.id]),[[0,10,'A'],[10,20,'B'],[20,30,'C'],[30,120,'A']]);
  assert.equal(r.turnaround,50);assert.equal(r.response,10/3);
});
test('Figuras 7.6 y 7.7: primer uso y finalización',()=>{
  const rr=run('terminales','RR'),sjf=run('terminales','SJF');
  assert.deepEqual(rr.metrics.map(j=>j.finish),[13,14,15]);assert.equal(rr.response,1);assert.equal(rr.turnaround,14);
  assert.equal(sjf.response,5);assert.equal(sjf.turnaround,10);
  assert.deepEqual(run('terminales','RR',5).metrics,sjf.metrics);
});
test('Figuras 7.8 y 7.9: cuatro bloqueos, solapamiento y empate en t=80',()=>{
  const overlap=run('disco','STCF'),serial=run('disco','SERIE');
  assert.equal(serial.end,140);assert.equal(overlap.end,100);assert.equal(serial.busy,100);
  assert.equal(overlap.utilization,100);
  assert.deepEqual(overlap.cpuSegments.map(x=>x.id),['A','B','A','B','A','B','A','B','A','B']);
  assert.deepEqual(overlap.diskSegments.map(x=>x.start),[10,30,50,70]);assert.equal(serial.diskSegments.length,4);
});
test('RR en el límite: primero las llegadas, el último cuanto puede ser parcial',()=>{
  const r=simulate(cpuJobs([3,1],[0,2]),'RR',2);
  assert.deepEqual(r.cpuSegments.map(s=>s.id),['A','B','A']);assert.equal(r.end,4);
});
test('STCF compara el restante, incluido el que ya corre',()=>{
  assert.equal(simulate(cpuJobs([10,4],[0,8]),'STCF').frames.find(x=>x.t===8).cpu,'A');
});
test('Inactividad inicial, sin tiempos negativos ni cambio espurio',()=>{
  for(const p of ['FIFO','SJF','STCF','RR']){
    const r=simulate(cpuJobs([1,2],[7,10]),p);
    assert.equal(r.end,12);assert.equal(r.busy,3);assert.equal(r.response,0);
    assert.equal(r.metrics[1].wait,0);
  }
});
test('Carga inválida',()=>{
  for(const n of [0,-1,1.5,301]) assert.throws(()=>simulate(cpuJobs([n]),'RR',1));
  assert.throws(()=>run('terminales','RR',0));
});
test('Conservación de CPU y espera para cargas con E/S y llegadas variadas',()=>{
  for(const p of ['FIFO','SJF','STCF','RR','SERIE'])for(let k=1;k<=40;k++){
    const jobs=[{id:'A',arrival:k%8,bursts:[k%7+1,4,3]},{id:'B',arrival:k%5,bursts:[2,3,k%6+1]},{id:'C',arrival:k%3,bursts:[9]}];
    const r=simulate(jobs,p,1+k%5), busy=jobs.reduce((sum,j)=>sum+j.bursts.filter((_,i)=>i%2===0).reduce((a,b)=>a+b),0);
    assert.equal(r.busy,busy);assert.ok(r.end>=busy);
    assert.ok(r.metrics.every(j=>j.response>=0 && j.turnaround>=j.response && j.wait>=0));
    for(const frame of r.frames) assert.ok(!(frame.cpu && frame.ready.includes(frame.cpu)));
    for(let i=1;i<r.diskSegments.length;i++) assert.ok(r.diskSegments[i].start>=r.diskSegments[i-1].end);
  }
});
