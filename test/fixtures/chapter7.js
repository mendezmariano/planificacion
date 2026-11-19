// Resultados esperados del apunte, calculados sin ejecutar el motor.
// CPU/disco: [inicio, fin, trabajo]. Cola: letras en orden por frontera, incluido el fin.
// Métricas: [id, primera ejecución, finalización, espera en listos].
// En la figura 7.4 se divide A en t=10 para observar las llegadas.
const disk = [[10,20,'A'], [30,40,'A'], [50,60,'A'], [70,80,'A']];

module.exports = [
  {
    figure:'7.1', caseId:'iguales', policy:'FIFO',
    cpu:[[0,10,'A'], [10,20,'B'], [20,30,'C']],
    ready:['BC', 'C', '', ''],
    metrics:[['A',0,10,0], ['B',10,20,10], ['C',20,30,20]]
  },
  {
    figure:'7.2', caseId:'convoy', policy:'FIFO',
    cpu:[[0,100,'A'], [100,110,'B'], [110,120,'C']],
    ready:['BC', 'C', '', ''],
    metrics:[['A',0,100,0], ['B',100,110,100], ['C',110,120,110]]
  },
  {
    figure:'7.3', caseId:'convoy', policy:'SJF',
    cpu:[[0,10,'B'], [10,20,'C'], [20,120,'A']],
    ready:['CA', 'A', '', ''],
    metrics:[['A',20,120,20], ['B',0,10,0], ['C',10,20,10]]
  },
  {
    figure:'7.4', caseId:'tardias', policy:'SJF',
    cpu:[[0,10,'A'], [10,100,'A'], [100,110,'B'], [110,120,'C']],
    ready:['', 'BC', 'C', '', ''],
    metrics:[['A',0,100,0], ['B',100,110,90], ['C',110,120,100]]
  },
  {
    figure:'7.5', caseId:'tardias', policy:'STCF',
    cpu:[[0,10,'A'], [10,20,'B'], [20,30,'C'], [30,120,'A']],
    ready:['', 'CA', 'A', '', ''],
    metrics:[['A',0,120,20], ['B',10,20,0], ['C',20,30,10]]
  },
  {
    figure:'7.6', caseId:'terminales', policy:'SJF',
    cpu:[[0,5,'A'], [5,10,'B'], [10,15,'C']],
    ready:['BC', 'C', '', ''],
    metrics:[['A',0,5,0], ['B',5,10,5], ['C',10,15,10]]
  },
  {
    figure:'7.7', caseId:'terminales', policy:'RR', quantum:1,
    cpu:[
      [0,1,'A'], [1,2,'B'], [2,3,'C'], [3,4,'A'], [4,5,'B'],
      [5,6,'C'], [6,7,'A'], [7,8,'B'], [8,9,'C'], [9,10,'A'],
      [10,11,'B'], [11,12,'C'], [12,13,'A'], [13,14,'B'], [14,15,'C']
    ],
    ready:['BC', 'CA', 'AB', 'BC', 'CA', 'AB', 'BC', 'CA', 'AB', 'BC', 'CA', 'AB', 'BC', 'C', '', ''],
    metrics:[['A',0,13,8], ['B',1,14,9], ['C',2,15,10]]
  },
  {
    figure:'7.8', caseId:'disco', policy:'SERIE', disk,
    cpu:[
      [0,10,'A'], [10,20,null], [20,30,'A'], [30,40,null], [40,50,'A'],
      [50,60,null], [60,70,'A'], [70,80,null], [80,90,'A'], [90,140,'B']
    ],
    ready:['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', '', ''],
    metrics:[['A',0,90,0], ['B',90,140,90]]
  },
  {
    figure:'7.9', caseId:'disco', policy:'STCF', disk,
    cpu:[
      [0,10,'A'], [10,20,'B'], [20,30,'A'], [30,40,'B'], [40,50,'A'],
      [50,60,'B'], [60,70,'A'], [70,80,'B'], [80,90,'A'], [90,100,'B']
    ],
    ready:['B', '', 'B', '', 'B', '', 'B', '', 'B', '', ''],
    metrics:[['A',0,90,0], ['B',10,100,50]]
  }
];
