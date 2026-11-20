/* Dibujo del instante observado. Ninguna vista elige el próximo trabajo. */
(function (root) {
  'use strict';
  const el = id => document.getElementById(id);
  const numbers = new Intl.NumberFormat('es-AR', {maximumFractionDigits:2});
  const fmt = value => numbers.format(value);
  const status = {listo:'En espera', ejecutando:'En ejecución', terminado:'Terminó', bloqueado:'Espera E/S'};
  const letter = id => '<span class="letter" data-id="'+id+'">'+id+'</span>';
  const svgNS = 'http://www.w3.org/2000/svg';

  function delta(span, unit) {
    if (span.end === span.start) return fmt(span.prior)+' '+unit;
    const term = fmt(span.end)+' − '+fmt(span.start);
    const expression = span.prior ? fmt(span.prior)+' + ('+term+')' : term;
    return expression+' = '+fmt(span.total)+' '+unit;
  }

  function makeJobs(inputs, unit, showProfile) {
    const maxDemand = Math.max(...inputs.map(j => j.demand));
    const nodes = new Map();
    el('jobs').replaceChildren();
    for (const job of inputs) {
      const row = document.createElement('li');
      row.className = 'job';
      row.dataset.id = job.id;
      row.hidden = true;
      row.innerHTML = '<div class="job-head">'+letter(job.id)+'<strong class="state"></strong>'+
        '<span class="arrival">'+(showProfile ? (job.usesDisk ? 'CPU y E/S' : 'Solo CPU')+' · ' : '')+
        'Llegó en '+job.arrival+' '+unit+'</span><span class="left"></span></div>'+
        '<div class="track"><div class="bar" role="progressbar" aria-label="Ejecución de '+job.id+
        '" aria-valuemin="0" aria-valuemax="'+job.demand+'" style="width:'+100*job.demand/maxDemand+'%">'+
        '<div class="bar-fill"></div></div></div>'+
        '<div class="job-meta"><span class="used"></span><span class="wait"></span></div>';
      nodes.set(job.id, {
        row, state:row.querySelector('.state'), left:row.querySelector('.left'), used:row.querySelector('.used'),
        wait:row.querySelector('.wait'), bar:row.querySelector('.bar'), fill:row.querySelector('.bar-fill')
      });
      el('jobs').append(row);
    }
    return function drawJobs(s) {
      el('noJobs').hidden = s.jobs.some(j => j.state !== 'nuevo');
      for (const j of s.jobs) {
        const n = nodes.get(j.id);
        n.row.hidden = j.state === 'nuevo';
        if (n.row.hidden) continue;
        n.row.dataset.state = j.state;
        n.state.textContent = status[j.state];
        n.fill.style.width = (100*j.cpu.total/j.demand)+'%';
        n.bar.setAttribute('aria-valuenow', Number(j.cpu.total.toFixed(1)));
        n.bar.setAttribute('aria-valuetext', fmt(j.cpu.total)+' de '+j.demand+' '+unit+' ejecutados');
        n.left.textContent = 'Restan '+j.demand+' − '+fmt(j.cpu.total)+' = '+fmt(j.left)+' '+unit;
        n.used.textContent = 'Ejecutó '+delta(j.cpu, unit);
        n.wait.textContent = 'Espera en listos '+delta(j.wait, unit);
      }
    };
  }

  function meanHTML(jobs, field, unit, differences) {
    const terms = jobs.map(j => {
      const known = j[field] !== null;
      const value = known ? fmt(j[field] - j.arrival) : '…';
      const expand = differences === 'all' || (differences === 'late' && j.arrival !== 0);
      const term = known && expand ? '('+j[field]+' − '+j.arrival+')' : value;
      const label = 'Trabajo '+j.id+(known ? ', '+term+' '+unit : ' pendiente');
      return '<span class="term" data-id="'+j.id+'" title="'+label+'" aria-label="'+label+'">'+term+'</span>';
    });
    const brackets = differences ? ['[',']'] : ['(',')'];
    const expression = brackets[0]+terms.join(' + ')+brackets[1]+' / '+jobs.length;
    if (jobs.some(j => j[field] === null)) return expression;
    const sum = jobs.reduce((total, j) => total + j[field] - j.arrival, 0);
    const op = (sum*100) % jobs.length === 0 ? '=' : '≈';
    return expression+' <span class="mean-value">'+op+' '+fmt(sum/jobs.length)+' '+unit+'</span>';
  }

  function metricHTML(jobs, field, unit, differences) {
    const response = field === 'first';
    const title = response ? 'Tiempo de respuesta' : 'Tiempo de retorno';
    const definition = (response ? 'Primera ejecución' : 'Finalización')+' − llegada';
    const lines = jobs.map(j => {
      const description = j[field] === null ? '<span class="pending">Pendiente</span>' :
        j[field]+' − '+j.arrival+' = <b>'+fmt(j[field] - j.arrival)+' '+unit+'</b>';
      return '<li data-for="'+j.id+'">'+letter(j.id)+'<span>'+description+'</span></li>';
    });
    const known = jobs.filter(j => j[field] !== null).length;
    return '<section class="metric" data-metric="'+field+'"><h3>'+title+'</h3><p class="definition">'+definition+'</p>'+
      '<ul class="terms">'+lines.join('')+'</ul><div class="sum"><small>Promedio · '+known+' de '+jobs.length+
      ' términos</small><div class="formula">'+meanHTML(jobs,field,unit,differences)+'</div></div></section>';
  }

  function ioHTML(s, result, unit) {
    const lines = s.jobs.map(j => '<li>'+letter(j.id)+'<span>Ejecutó '+delta(j.cpu, unit)+'</span></li>');
    const observed = result.diskSegments.filter(span => span.start < s.time);
    const completed = observed.filter(span => span.end <= s.time);
    const current = observed.find(span => span.end > s.time);
    const contributions = [];
    // En las figuras 7.8 y 7.9 las cuatro operaciones de A tienen la misma duración.
    if (completed.length) contributions.push(completed.length+' × '+(completed[0].end-completed[0].start));
    if (current) contributions.push('('+fmt(s.time)+' − '+current.start+')');
    const io = s.jobs.reduce((sum, j) => sum + j.io.total, 0);
    const diskTerm = completed.length ? '('+contributions.join(' + ')+')' : contributions[0] ?? '0';
    const terms = [fmt(s.jobs[0].cpu.total), diskTerm, fmt(s.jobs[1].cpu.total)];
    const total = terms.join(' + ')+(s.overlap > 0 ? ' − '+fmt(s.overlap) : '');
    return '<section class="metric" data-metric="lote"><h3>Tiempo del lote</h3>'+
      '<p class="definition">Ejecución de A + E/S de A + ejecución de B. El tiempo compartido se cuenta una sola vez.</p><ul class="terms">'+lines.join('')+
      '<li>CPU ociosa · '+fmt(s.idle)+' '+unit+'</li></ul><div class="sum"><small>Tiempo transcurrido</small>'+
      '<div class="formula">'+total+' = '+fmt(s.time)+' '+unit+'</div></div>'+
      '<p class="io-detail"><b>E/S de A</b> · '+(contributions.length ? contributions.join(' + ')+' = ' : '')+fmt(io)+' '+unit+
      '. De ese tiempo, '+fmt(s.overlap)+' '+unit+' coinciden con la ejecución de B.</p></section>';
  }

  function switchHTML(s, cost) {
    const change = s.frame.switching;
    const partial = change ? ' + ('+fmt(s.time)+' − '+change.start+')' : '';
    const action = change ? 'Cambio de '+change.from+' a '+change.to+' desde '+change.start+' ms. '+change.to+' sigue en listos.'+(s.frame.disk ? ' El disco atiende a '+s.frame.disk+'.' : '') :
      s.frame.cpu ? 'La CPU ejecuta '+s.frame.cpu+'.' : s.jobs.every(j => j.finish !== null) ? 'El lote terminó.' : 'La CPU espera un trabajo listo.';
    const share = s.time ? fmt(100*s.switchTime/s.time)+' %' : 'Pendiente';
    return '<section class="metric" data-metric="cambios"><h3>Tiempo en cambios de contexto</h3>'+
      '<p class="definition">'+action+'</p><div class="sum"><small>'+s.completedSwitches+
      (s.completedSwitches === 1 ? ' cambio completo' : ' cambios completos')+' × '+cost+' ms'+(change ? ' + cambio en curso' : '')+
      '</small><div class="formula">'+s.completedSwitches+' × '+cost+partial+' = '+fmt(s.switchTime)+' ms</div></div></section>'+
      '<section class="metric" data-metric="reloj"><h3>Cómo se compone el reloj</h3>'+
      '<dl class="clock-terms"><dt>CPU útil</dt><dd>'+fmt(s.busy)+' ms</dd><dt>Cambios de contexto</dt><dd>'+fmt(s.switchTime)+
      ' ms</dd><dt>CPU ociosa</dt><dd>'+fmt(s.idle)+' ms</dd></dl><div class="sum"><small>Tiempo transcurrido</small>'+
      '<div class="formula">'+fmt(s.busy)+' + '+fmt(s.switchTime)+' + '+fmt(s.idle)+' = '+fmt(s.time)+' ms</div></div>'+
      '<p class="io-detail">Porcentaje del tiempo en cambios · <b>'+share+'</b></p></section>';
  }

  function makeCalculations(work, result, context, reading, quantum) {
    if (context.kind === 'experiment') {
      el('accountContext').textContent = 'Round Robin · cuanto de '+quantum+' ms · costo por cambio de '+result.switchCost+' ms';
      return s => { el('calculations').innerHTML = switchHTML(s, result.switchCost); };
    }
    const io = result.diskSegments.length > 0;
    const response = reading === 'respuesta' || context.figure === '7.6' || context.figure === '7.7';
    el('accountContext').textContent = io ? 'Ejecución y E/S · milisegundos' :
      response ? 'Desde el primer turno de cada trabajo' : 'Desde la llegada hasta el fin de cada trabajo';
    let lastIndex = -1;
    return function drawCalculations(s) {
      if (!io && lastIndex === s.index) return;
      lastIndex = s.index;
      let html;
      if (io) html = ioHTML(s, result, work.unit);
      else {
        // El libro escribe la suma de 7.3 en el orden B, C, A.
        const jobs = context.figure === '7.3' ? [...s.jobs].sort((a,b) => a.demand-b.demand) : s.jobs;
        // En 7.4 el apunte simplifica el término de A. En 7.5 deja visibles las tres restas.
        let differences = jobs.some(j => j.arrival > 0) ? 'all' : null;
        if (context.figure === '7.4') differences = 'late';
        html = response ? metricHTML(jobs, 'first', work.unit, differences) : '';
        if (!response || (reading !== 'respuesta' && jobs.every(j => j.first !== null))) {
          html += metricHTML(jobs, 'finish', work.unit, differences);
        }
        if (!response && context.kind !== 'original') html += metricHTML(jobs, 'first', work.unit, differences);
      }
      el('calculations').innerHTML = html;
    };
  }

  function makeComparison(work, caseId, policy, quantum, reading) {
    const figures = root.CpuChapter.figures.filter(f => f.caseId === caseId);
    const side = figures.findIndex(f => f.policy === policy);
    const panel = el('comparison');
    const cards = el('comparisonPolicies');
    cards.replaceChildren();
    panel.hidden = figures.length !== 2 || side < 0;
    if (panel.hidden) return () => {};

    const peer = figures[1 - side];
    const peerResult = root.CpuLab.simulate(work.jobs, peer.policy, peer.quantum ?? 1);
    const peerTrace = root.CpuTrace.readTrace(work.jobs, peerResult);
    const rrQuantum = policy === 'RR' ? quantum : peer.quantum;
    const disk = caseId === 'disco';
    const response = caseId === 'terminales' || reading === 'respuesta';
    el('comparisonHint').hidden = disk;
    cards.innerHTML = figures.map(f => {
      const name = f.policy === 'SERIE' ? 'E/S en serie' : f.policy === 'RR' ? 'RR · cuanto de '+rrQuantum+' '+work.unit : f.policy;
      const reference = f.quantum && f.quantum !== rrQuantum ? 'Variante de la figura '+f.number : 'Figura '+f.number;
      return '<section data-policy="'+f.policy+'"><h3>'+name+' <small>'+reference+'</small></h3><dl></dl></section>';
    }).join('');
    const lists = cards.querySelectorAll('dl');
    const field = (key, label, value) => '<div><dt>'+label+'</dt><dd class="formula" data-field="'+key+'">'+value+'</dd></div>';
    let previous = [];
    return function drawComparison(s) {
      el('comparisonTime').textContent = fmt(s.time)+' '+work.unit;
      const other = peerTrace.at(Math.min(s.time, peerResult.end));
      const states = side === 0 ? [s, other] : [other, s];
      if (!disk && states.every((state, i) => state.index === previous[i])) return;
      previous = states.map(state => state.index);
      states.forEach((state, i) => {
        if (disk) {
          const done = state.jobs.every(j => j.finish !== null);
          lists[i].innerHTML = field('idle','CPU ociosa',fmt(state.idle)+' '+work.unit)+
            field('overlap','CPU y disco en uso a la vez',fmt(state.overlap)+' '+work.unit)+
            field('end','Fin del lote',done ? fmt(state.time)+' '+work.unit : 'Pendiente');
        } else {
          lists[i].innerHTML = (response ? field('first','Respuesta media',meanHTML(state.jobs,'first',work.unit)) : '')+
            field('finish','Retorno medio',meanHTML(state.jobs,'finish',work.unit));
        }
      });
      el('comparisonNote').textContent = root.CpuChapter.comparisonNote(caseId,states[0],states[1],rrQuantum);
    };
  }

  function svgElement(tag, attributes, parent, text) {
    const node = document.createElementNS(svgNS, tag);
    for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
    if (text !== undefined) node.textContent = text;
    parent.append(node);
    return node;
  }

  function makeTimeline(result, trace, context, unit) {
    const container = el('timeline');
    const hasDisk = result.diskSegments.length > 0;
    const terminal = context.figure === '7.6' || context.figure === '7.7';
    const bookExtent = hasDisk ? 140 : terminal ? 30 : 120;
    const extent = context.figure ? bookExtent : result.end;
    const experimental = context.kind === 'experiment';
    const shortest = experimental ? Math.min(...trace.cpuRuns.map(s => s.end-s.start)) : extent;
    const margin = experimental ? Math.max(18,String(extent).length*4+5) : 16;
    const left = hasDisk ? 46 : experimental ? margin : 14;
    const lanes = [{list:trace.cpuRuns, label:'CPU'}];
    if (hasDisk) lanes.push({list:result.diskSegments, label:'Disco'});
    const height = 35 + 23*lanes.length;
    let width, plot, svg, marker, origin, range;
    const x = t => left + plot*(t-origin)/range;

    function setWindow(time, measured) {
      const plotWidth = Math.max(1, measured-left-margin);
      // En el experimento un cambio breve sigue siendo legible aunque el lote dure miles de ms.
      const visible = experimental ? Math.min(extent,Math.max(2,Math.floor(plotWidth/28))*shortest) : extent;
      const step = Math.max(1,Math.floor(visible/2));
      const start = Math.min(extent-visible,Math.max(0,Math.ceil((time-visible)/step)*step));
      if (width === measured && origin === start) return;
      width = measured;
      plot = plotWidth;
      range = visible;
      origin = start;
      container.replaceChildren();
      svg = svgElement('svg', {width, height, role:'img'}, container);
      const slots = Math.max(2,Math.min(5,Math.floor(plot/(String(extent).length*8+18))));
      const spacing = context.figure ? (terminal ? 5 : 20) : Math.max(1,Math.ceil(range/slots));
      for (let t=origin; t<origin+range; t+=spacing) {
        if (experimental && x(origin+range)-x(t) < String(extent).length*8+8) continue;
        svgElement('text', {x:x(t), y:height-4, 'font-size':12, 'text-anchor':'middle'}, svg, t);
      }
      svgElement('text', {x:x(origin+range), y:height-4, 'font-size':12, 'text-anchor':'middle'}, svg, origin+range);
      lanes.forEach((lane,i) => {
        lane.y = 8+i*23;
        if (hasDisk) svgElement('text',{x:0,y:lane.y+15,'font-size':12},svg,lane.label);
        svgElement('rect',{x:left,y:lane.y,width:plot,height:19,fill:'#eeeee4',stroke:'#bfc0b1'},svg);
        lane.layer = svgElement('g',{},svg);
        lane.parts = [];
        const first = lane.list.findIndex(span => span.end > origin);
        lane.first = first < 0 ? lane.list.length : first;
      });
      marker = svgElement('line',{y1:3,y2:height-22,stroke:'#304d5a','stroke-width':1.5},svg);
    }

    function updatePart(part, span, time) {
      const end = Math.min(time, span.end);
      const startX = x(Math.max(span.start,origin));
      const w = x(end)-startX;
      part.rect.setAttribute('width',w);
      part.label.setAttribute('x',startX+w/2);
      part.label.setAttribute('visibility',w >= (span.switching ? 17 : 11) ? 'visible' : 'hidden');
      const name = span.switching ? 'Cambio '+span.switching.from+' → '+span.switching.to : span.id || 'CPU ociosa';
      part.title.textContent = name+' · ['+span.start+', '+fmt(end)+') '+unit;
    }

    return function drawTimeline(time) {
      setWindow(time,Math.max(container.clientWidth, terminal ? 420 : 0));
      for (const lane of lanes) {
        const {parts,list,y,first} = lane;
        while (parts.length && list[first+parts.length-1].start >= time) parts.pop().group.remove();
        if (parts.length) updatePart(parts.at(-1),list[first+parts.length-1],time);
        while (first+parts.length < list.length && list[first+parts.length].start < time) {
          const span = list[first+parts.length];
          const group = svgElement('g', span.id ? {'data-id':span.id} : span.switching ? {class:'switch-span'} : {}, lane.layer);
          const fill = span.switching ? '#465464' : span.id ? 'var(--tone)' : '#faf8ef';
          const rect = svgElement('rect',{x:x(Math.max(span.start,origin)),y,height:19,fill,stroke:'#4b5a5a','stroke-width':0.7},group);
          const title = svgElement('title',{},rect);
          const label = svgElement('text',{y:y+14,'text-anchor':'middle','font-size':12,'font-weight':700},group,span.switching ? 'CC' : span.id || '–');
          const part = {group,rect,title,label};
          updatePart(part,span,time);
          parts.push(part);
        }
      }
      marker.setAttribute('x1',x(time));
      marker.setAttribute('x2',x(time));
      svg.setAttribute('aria-label','Línea de tiempo hasta '+fmt(time)+' '+unit+'. Intervalos en el detalle técnico.');
    };
  }

  root.CpuView = {fmt, makeJobs, makeCalculations, makeComparison, makeTimeline};
})(globalThis);
