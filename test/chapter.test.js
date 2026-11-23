const {test} = require('node:test');
const assert = require('node:assert/strict');
const {contextFor, readings, workloadAssumptions, relaxedAssumptions} = require('../dist/chapter.js');
const {cases, simulate} = require('../dist/engine.js');
const {readTrace} = require('../dist/trace.js');

// Configuraciones de las figuras del apunte, independientes de los datos de la vista.
const figures = [
  ['iguales', 'FIFO', 1, '7.1', '7.3'],
  ['convoy', 'FIFO', 1, '7.2', '7.3'],
  ['convoy', 'SJF', 1, '7.3', '7.4'],
  ['tardias', 'SJF', 1, '7.4', '7.4'],
  ['tardias', 'STCF', 1, '7.5', '7.5'],
  ['terminales', 'SJF', 1, '7.6', '7.7'],
  ['terminales', 'RR', 1, '7.7', '7.7'],
  ['disco', 'SERIE', 1, '7.8', '7.8'],
  ['disco', 'STCF', 1, '7.9', '7.8']
];

test('El índice abre las nueve figuras del apunte en orden con sus datos y supuestos', () => {
  assert.deepEqual(readings.filter(r => r.key === r.number).map(r => r.number), figures.map(f => f[3]));
  for (const [caseId, policy, q, figure, section] of figures) {
    const context = contextFor(caseId, policy, q);
    assert.equal(context.kind, 'original');
    assert.equal(context.figure, figure);
    const label = policy === 'SERIE' ? 'E/S en serie' : policy;
    assert.equal(context.reference, 'Figura '+figure+' · '+label+' · Sección '+section);
    assert.ok(context.load.length && context.title.length);
    assert.ok(context.assumptions.includes('costo cero'));
    assert.ok(context.configuration.includes('figura '+figure));
  }
});

test('La sección 7.6 vuelve a la figura 7.5 para introducir la respuesta', () => {
  const i = readings.findIndex(r => r.key === 'respuesta');
  assert.deepEqual(readings.slice(i-1,i+2).map(r => r.key), ['7.5','respuesta','7.6']);
  const r = readings[i];
  const response = contextFor(r.caseId,r.policy,1,r.key);
  assert.equal(response.reference, 'Figura 7.5 · STCF · Sección 7.6');
  assert.match(response.assumptionNote, /primer uso de la CPU/);
  assert.equal(contextFor('tardias','SJF',1,r.key).figure, '7.4');
});

test('Cambiar política o cuanto distingue una variante de una figura original', () => {
  for (const caseId of Object.keys(cases)) {
    for (const policy of ['FIFO', 'SJF', 'STCF', 'RR']) {
      for (const q of [1, 2, 5, 300]) {
        const expected = figures.find(f => f[0] === caseId && f[1] === policy && (policy !== 'RR' || f[2] === q));
        const context = contextFor(caseId, policy, q);
        assert.equal(context.figure, expected?.[3] ?? null, caseId+' '+policy+' '+q);
        assert.equal(context.kind, expected ? 'original' : 'variant');
        assert.ok(context.configuration.includes('figura'));
      }
    }
  }
  assert.equal(contextFor('terminales', 'RR', 5).mode, 'Variante del apunte');
  assert.equal(contextFor('terminales', 'RR', 1).mode, 'Configuración del apunte');
});

test('La carga propia no se atribuye a una figura aunque copie los valores del apunte', () => {
  for (const policy of ['FIFO', 'SJF', 'STCF', 'RR']) {
    const context = contextFor('propia', policy, 1);
    assert.equal(context.kind, 'custom');
    assert.equal(context.figure, null);
    assert.match(context.configuration, /Sin figura asociada/);
    assert.match(context.assumptions, /sin E\/S/);
  }
});

test('Los supuestos corresponden a la ejecución actual y distinguen el testigo en serie', () => {
  assert.match(contextFor('terminales', 'RR', 5).assumptions, /cuanto de 5 s/);
  assert.match(contextFor('disco', 'RR', 2).assumptions, /cuanto de 2 ms/);
  assert.match(contextFor('convoy', 'STCF', 1).assumptions, /permite el desalojo/);
  assert.doesNotMatch(contextFor('convoy', 'STCF', 1).assumptions, /no desaloja/);
  assert.equal(contextFor('disco', 'FIFO', 1).kind, 'variant');
  assert.match(contextFor('disco', 'FIFO', 1).note, /no es el comportamiento de FIFO/);
  assert.match(contextFor('disco', 'SERIE', 1).assumptions, /incluso durante sus bloqueos/);
  assert.equal(contextFor('iguales', 'FIFO', 1).note, '');
});

test('Cada figura identifica los supuestos relajados con los números de la sección 7.1', () => {
  assert.deepEqual(workloadAssumptions.map(a => a.label), [
    'igual duración', 'llegadas simultáneas', 'ejecución hasta terminar', 'uso exclusivo de CPU', 'duración conocida'
  ]);
  const expected = [[], [1], [1], [1,2], [1,2,3], [], [3], [3,4], [3,4]];
  const focus = [undefined, 1, 1, 2, 3, undefined, 3, 4, 4];
  for (const [i, [caseId, policy, q, figure]] of figures.entries()) {
    const inputs = cases[caseId].jobs;
    const jobs = readTrace(inputs, simulate(inputs,policy,q)).at(0).jobs;
    assert.deepEqual(relaxedAssumptions(jobs,policy,false), expected[i], 'Figura '+figure);
    const context = contextFor(caseId,policy,q);
    assert.equal(context.assumptionFocus, focus[i], 'Figura '+figure);
    assert.ok(context.assumptionNote.trim(), 'Figura '+figure);
  }
});

test('La ficha responde a una carga propia, al desalojo permitido y al modelo de estimación', () => {
  const jobs = [{arrival:2, demand:50, usesDisk:false}, {arrival:2, demand:50, usesDisk:false}];
  assert.deepEqual(relaxedAssumptions(jobs,'SJF',false), []);
  jobs[1].arrival = 5;
  jobs[1].demand = 10;
  assert.deepEqual(relaxedAssumptions(jobs,'FIFO',false), [1,2]);
  assert.deepEqual(relaxedAssumptions(jobs,'STCF',true), [1,2,3,5]);
  assert.deepEqual(relaxedAssumptions(jobs.slice(0,1),'RR',false), [3]);
  jobs[0].usesDisk = true;
  assert.deepEqual(relaxedAssumptions(jobs,'SJF',true), [1,2,3,4,5]);
});
