'use strict';
(() => {
  const {cases, simulate} = window.CpuLab;
  const {readings, contextFor} = window.CpuChapter;
  const {fmt, makeJobs, makeCalculations, makeTimeline} = window.CpuView;
  const el = id => document.getElementById(id);
  const rules = {
    FIFO:['Primero en entrar, primero en salir','Ejecuta la primera ráfaga que entró a listos. Una nueva llegada espera hasta que la CPU quede libre.'],
    SJF:['Primero el trabajo más corto','Al quedar libre la CPU, elige la ráfaga lista más corta y la ejecuta hasta que termine o pida E/S.'],
    STCF:['Primero el de menor tiempo restante','Cada llegada o desbloqueo permite comparar las ráfagas listas con lo que falta de la ráfaga en ejecución. Puede haber desalojo.'],
    RR:['Round Robin','El primero en la cola recibe hasta un cuanto. Si todavía le queda trabajo al vencer el cuanto, vuelve al final de la cola.'],
    SERIE:['E/S en serie','En la figura 7.8 se reserva el turno de A incluso durante sus bloqueos. B espera hasta que A termina.']
  };
  const table = (heads, rows) => '<div class="scroll"><table><thead><tr>'+heads.map(h=>'<th scope="col">'+h+'</th>').join('')+
    '</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  const picker = el('figure');
  for (const r of readings) {
    const name = r.key === 'respuesta' ? '§ 7.6 · Respuesta en la figura 7.5' : 'Figura '+r.number+' · '+r.title;
    picker.add(new Option(name, r.key));
  }
  const variantOption = new Option('Variante o carga propia', 'variante');
  variantOption.disabled = true;
  picker.add(variantOption);
  Object.entries(cases).forEach(([id,c]) => el('case').add(new Option(c.name,id)));
  el('case').add(new Option('Carga propia','propia'));

  let custom = {name:'Carga propia', unit:'s', jobs:cases.convoy.jobs};
  let work, result, trace, context, snapshot, drawJobs, drawCalculations, drawTimeline;
  let policy, caseId, quantum = 1, reading;
  let playback = null;
  let request = null;

  function describeEvent(frame) {
    const current = frame.jobs.find(j => j.id === frame.cpu);
    if (current && (policy === 'STCF' || (policy === 'SJF' && !frame.decision.startsWith('Continúa')))) {
      const tied = frame.jobs.filter(j => (j.state === 'listo' || j === current) && j.remaining === current.remaining);
      if (tied.length > 1) return new Intl.ListFormat('es-AR').format(tied.map(j => j.id))+' empatan en '+current.remaining+' '+work.unit+
        '. Ejecuta '+current.id+' por orden de carga.';
    }
    return frame.decision;
  }

  function drawTechnical() {
    if (!el('technical').open || !snapshot) return;
    const s = snapshot, unit = work.unit;
    const rows = s.jobs.map(j => [j.id, j.arrival, j.state, j.burst === null ? '—' : fmt(j.burst), fmt(j.wait.total)]);
    const intervals = list => list.filter(span => span.start < s.time).map(span =>
      [span.start, fmt(Math.min(s.time, span.end)), span.id || 'Ociosa']);
    const listTable = list => list.length ? table(['Desde','Hasta','Trabajo'],list) : '<p>Todavía no hay intervalos transcurridos.</p>';
    el('techbody').innerHTML = '<h3>Estado en '+fmt(s.time)+' '+unit+'</h3><p>Cola de listos · <b id="ready">'+(s.frame.ready.join(', ') || 'Vacía')+
      '</b>　 CPU · <b id="cpu">'+(s.frame.cpu || 'Ociosa')+'</b>　 Disco · <b id="disk">'+(s.frame.disk || 'Libre')+'</b></p>'+
      table(['Trabajo','Llegada','Estado','Ráfaga restante','Espera en listos'],rows)+
      '<h3>Intervalos de CPU ('+unit+')</h3>'+listTable(intervals(result.cpuSegments))+
      (result.diskSegments.length ? '<h3>Intervalos de disco ('+unit+')</h3>'+listTable(intervals(result.diskSegments)) : '');
  }

  function resultsHTML() {
    const rows = ['FIFO','SJF','STCF','RR',...(caseId === 'disco' ? ['SERIE'] : [])].map(p => {
      const r = p === policy ? result : simulate(work.jobs,p,quantum);
      const name = p === 'RR' ? 'RR (q = '+quantum+')' : p === 'SERIE' ? 'E/S en serie' : p;
      return [name,fmt(r.response),fmt(r.turnaround),r.end,fmt(r.utilization)+' %'];
    });
    return '<h3>Por trabajo ('+work.unit+')</h3>'+
      table(['Trabajo','Llegada','Primer uso','Fin','Respuesta','Retorno','Espera en listos'],
        result.metrics.map(j=>[j.id,j.arrival,j.first,j.finish,j.response,j.turnaround,j.wait]))+
      '<details class="details"><summary>Comparar políticas con esta carga</summary>'+
      table(['Política','Respuesta media','Retorno medio','Fin del lote','CPU ocupada'],rows)+'</details>';
  }

  function draw(time) {
    const previous = snapshot;
    snapshot = trace.at(time);
    const done = time === result.end;
    el('time').textContent = fmt(time)+' '+work.unit;
    el('time').dataset.time = time;
    el('seek').value = Math.floor(time);
    el('seek').setAttribute('aria-valuetext', Math.floor(time)+' '+work.unit);
    drawJobs(snapshot);
    drawTimeline(time);
    drawCalculations(snapshot);
    if (!previous || snapshot.index !== previous.index) {
      const f = snapshot.frame;
      el('eventTime').textContent = f.t+' '+work.unit;
      el('decision').textContent = describeEvent(f);
      el('story').textContent = f.notes.join(' ');
    }
    el('prev').disabled = time === 0;
    el('next').disabled = done;
    el('end').disabled = done;
    el('results').hidden = !done;
    if (done && previous?.time !== time) el('resultTables').innerHTML = resultsHTML();
    drawTechnical();
  }

  function setPlayLabel() {
    const running = playback !== null;
    const title = running ? 'Pausar' : snapshot?.time === result.end ? 'Repetir' : snapshot?.time > 0 ? 'Reanudar' : 'Reproducir';
    el('play').textContent = (running ? 'Ⅱ ' : '▷ ')+title;
    el('play').setAttribute('aria-label', title);
  }

  function stop() {
    if (request !== null) cancelAnimationFrame(request);
    request = null;
    playback = null;
  }

  function seek(time) {
    stop();
    draw(time);
    setPlayLabel();
  }

  function tick(stamp) {
    const run = playback;
    if (!run) return;
    if (run.last !== null) run.time = Math.min(run.target, run.time + Math.max(0,stamp-run.last)*run.rate/1000);
    run.last = stamp;
    // El mismo décimo de unidad alimenta el reloj, el color y todas las operaciones.
    const visible = Math.floor(run.time*10)/10;
    if (visible !== snapshot.time) draw(visible);
    if (run.time >= run.target) {
      stop();
      setPlayLabel();
    } else request = requestAnimationFrame(tick);
  }

  function playTo(target, stepping = false) {
    stop();
    const from = snapshot.time;
    const baseRate = caseId === 'terminales' ? 1 : caseId === 'iguales' ? 2.5 : 5;
    const rate = baseRate * Number(el('speed').value);
    // Un avance manual muestra el tramo y se detiene exactamente en su frontera.
    playback = {time:from, last:null, target, stepping, rate:stepping ? Math.max(rate,(target-from)/0.65) : rate};
    setPlayLabel();
    request = requestAnimationFrame(tick);
  }

  function configure(requestedReading) {
    stop();
    caseId = el('case').value;
    policy = el('policy').value;
    if (policy === 'SERIE') {
      caseId = 'disco';
      el('case').value = caseId;
    }
    el('case').disabled = policy === 'SERIE';
    el('q').disabled = policy !== 'RR';
    const candidate = el('q').valueAsNumber;
    const invalid = policy === 'RR' && !(Number.isInteger(candidate) && candidate >= 1 && candidate <= 300);
    if (invalid) el('q').value = quantum;
    else if (policy === 'RR') quantum = candidate;
    el('error').hidden = !invalid;
    if (invalid) el('error').textContent = 'Usá un cuanto entero de 1 a 300. Se conserva '+quantum+'.';

    work = caseId === 'propia' ? custom : cases[caseId];
    result = simulate(work.jobs,policy,quantum);
    trace = window.CpuTrace.readTrace(work.jobs,result);
    context = contextFor(caseId,policy,quantum,requestedReading);
    reading = requestedReading === 'respuesta' && context.figure === '7.5' ? 'respuesta' : context.figure;
    picker.value = reading || 'variante';
    el('chapterTitle').textContent = context.title || work.name+' · '+policy;
    el('chapterReference').textContent = context.kind === 'custom' ? 'Carga propia · '+policy : context.reference;
    el('chapterLoad').textContent = context.load+(policy === 'RR' ? ' El cuanto es de '+quantum+' '+work.unit+'.' : '');
    el('chapterMode').textContent = context.mode;
    el('chapterConfiguration').textContent = context.configuration;
    el('chapterAssumptions').textContent = context.assumptions;
    el('chapterNote').textContent = context.note;
    el('chapterNote').hidden = !context.note;
    el('axisUnit').textContent = '('+work.unit+')';
    el('seek').max = result.end;
    const next = reading && readings[readings.findIndex(r => r.key === reading)+1];
    el('continue').hidden = !next;
    if (next) {
      el('continue').textContent = next.key === 'respuesta' ? 'Seguir con la respuesta · § 7.6 →' : 'Seguir con la figura '+next.number+' →';
      el('continue').onclick = () => { selectReading(next.key); picker.focus(); };
    }
    document.title = el('chapterTitle').textContent+' · Turno de CPU';
    snapshot = null;
    drawJobs = makeJobs(trace.at(0).jobs, work.unit);
    drawTimeline = makeTimeline(result,trace,context,work.unit);
    drawCalculations = makeCalculations(work,result,context,reading);
    draw(0);
    playTo(result.end);
  }

  function selectReading(key) {
    const entry = readings.find(r => r.key === key);
    el('policy').value = entry.policy;
    el('case').value = entry.caseId;
    quantum = entry.quantum ?? 1;
    el('q').value = quantum;
    configure(key);
  }

  picker.onchange = () => selectReading(picker.value);
  el('policy').onchange = el('case').onchange = el('q').onchange = () => configure();
  el('play').onclick = () => {
    if (playback) { stop(); setPlayLabel(); }
    else {
      if (snapshot.time === result.end) draw(0);
      playTo(result.end);
    }
  };
  el('reset').onclick = () => seek(0);
  el('end').onclick = () => seek(result.end);
  el('prev').onclick = () => {
    const index = snapshot.time === snapshot.frame.t ? snapshot.index-1 : snapshot.index;
    seek(result.frames[Math.max(0,index)].t);
  };
  el('next').onclick = () => playTo(result.frames[snapshot.index+1].t, true);
  el('seek').oninput = () => seek(el('seek').valueAsNumber);
  el('speed').onchange = () => { if (playback) playTo(playback.target,playback.stepping); };
  el('technical').ontoggle = drawTechnical;
  document.addEventListener('visibilitychange', () => { if (playback) playback.last = null; });

  const dialog = el('dialog');
  function show(body) {
    stop();
    setPlayLabel();
    el('dialogbody').innerHTML = body;
    dialog.showModal();
  }
  document.querySelectorAll('[data-help]').forEach(b => b.onclick = () => {
    if (b.dataset.help === 'guide') show('<h2 id="dialogTitle">Guía de uso</h2><p>Elegí una figura del capítulo. Cada trabajo aparece al llegar. Su barra conserva el color en la parte pendiente y se vuelve más clara en la parte ejecutada.</p><p>Pausá el reloj para leer una cuenta. Usá Anterior y Siguiente para recorrer los eventos, o mové el control de tiempo hasta el instante que quieras ver.</p><p>En Explorar otra carga o política podés cambiar el ejemplo o escribir tus propias llegadas y duraciones.</p>');
    else show('<h2 id="dialogTitle">'+rules[policy][0]+'</h2><p>'+rules[policy][1]+'</p><p>'+context.assumptions+'</p><h3>Los tiempos</h3><p>El retorno se cuenta desde la llegada hasta el fin del trabajo. La respuesta se cuenta hasta la primera ejecución. La espera en listos acumula los intervalos en que el trabajo ya puede ejecutar y aguarda su turno.</p><h3>En el mismo instante</h3><p>Primero se reconocen los fines de ráfaga, luego las llegadas en orden de carga, los desbloqueos y el vencimiento del cuanto. Después se elige quién usa la CPU.</p>');
  });
  el('configBtn').onclick = () => {
    if (caseId === 'disco') {
      show('<h2 id="dialogTitle">Ráfagas de CPU y de E/S</h2><p>'+context.load+'</p><p>'+context.note+'</p>');
      return;
    }
    show('<h2 id="dialogTitle">Carga propia</h2><p>Una fila por trabajo, de A a F. Escribí llegada y duración en segundos, separadas por coma. La llegada admite 0 a 300 y la duración, 1 a 300.</p><label for="edit">Llegada, duración</label><textarea id="edit" rows="6" spellcheck="false"></textarea><p id="formerror" role="alert" class="formerror"></p><button class="secondary" id="save">Usar esta carga</button>');
    el('edit').value = work.jobs.map(j => j.arrival+', '+j.bursts[0]).join('\n');
    el('save').onclick = () => {
      try {
        const jobs = el('edit').value.trim().split(/\r?\n/).map((line,i) => {
          const match = line.match(/^\s*(\d+)\s*,\s*(\d+)\s*$/);
          if (!match) throw Error('Revisá la fila '+(i+1)+'. Usá llegada, duración.');
          return {id:String.fromCharCode(65+i),arrival:Number(match[1]),bursts:[Number(match[2])]};
        });
        simulate(jobs,policy,quantum);
        custom = {name:'Carga propia',unit:'s',jobs};
        el('case').value = 'propia';
        dialog.close();
        configure();
      } catch (error) { el('formerror').textContent = error.message; }
    };
  };
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) dialog.close();
  });

  const params = new URLSearchParams(location.search);
  const key = params.get('seccion') === '7.6' ? 'respuesta' : params.get('figura');
  if (readings.some(r => r.key === key)) selectReading(key);
  else if (params.has('sim') || params.has('caso')) {
    el('policy').value = Object.hasOwn(rules,params.get('sim')) ? params.get('sim') : 'FIFO';
    el('case').value = Object.hasOwn(cases,params.get('caso')) ? params.get('caso') : 'convoy';
    configure();
  } else selectReading('7.1');
  new ResizeObserver(() => drawTimeline(snapshot.time)).observe(el('timeline'));
})();
