const {test} = require('node:test');
const assert = require('node:assert/strict');
const {contextFor, readings} = require('../dist/chapter.js');
const {cases} = require('../dist/engine.js');

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
    assert.ok(context.reference.startsWith('Sección '+section));
    assert.ok(context.reference.includes('Figura '+figure));
    assert.ok(context.load.length && context.title.length);
    assert.ok(context.assumptions.includes('costo cero'));
    assert.ok(context.configuration.includes('figura '+figure));
  }
});

test('La sección 7.6 vuelve a la figura 7.5 para introducir la respuesta', () => {
  const i = readings.findIndex(r => r.key === 'respuesta');
  assert.deepEqual(readings.slice(i-1,i+2).map(r => r.key), ['7.5','respuesta','7.6']);
  const r = readings[i];
  assert.equal(contextFor(r.caseId,r.policy,1,r.key).reference, 'Sección 7.6 · Figura 7.5');
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
