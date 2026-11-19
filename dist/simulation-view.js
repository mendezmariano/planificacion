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

  function makeJobs(inputs, unit) {
    const maxDemand = Math.max(...inputs.map(j => j.demand));
    const nodes = new Map();
    el('jobs').replaceChildren();
    for (const job of inputs) {
      const row = document.createElement('li');
      row.className = 'job';
      row.dataset.id = job.id;
      row.hidden = true;
      row.innerHTML = '<div class="job-head">'+letter(job.id)+'<strong class="state"></strong>'+
        '<span class="arrival">Llegó en '+job.arrival+' '+unit+'</span><span class="left"></span></div>'+
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

  function metricHTML(jobs, field, unit, differences) {
    const response = field === 'first';
    const title = response ? 'Tiempo de respuesta' : 'Tiempo de retorno';
    const definition = (response ? 'Primera ejecución' : 'Finalización')+' − llegada';
    const values = [];
    const terms = [];
    const lines = jobs.map(j => {
      const known = j[field] !== null;
      const difference = known ? j[field]+' − '+j.arrival : '';
      if (known) values.push(j[field]-j.arrival);
      const value = known ? String(j[field]-j.arrival) : '…';
      const expand = differences === 'all' || (differences === 'late' && j.arrival !== 0);
      const term = known && expand ? '('+difference+')' : value;
      terms.push('<span class="term" data-id="'+j.id+'" title="Trabajo '+j.id+'">'+term+'</span>');
      const description = known ? difference+' = <b>'+value+' '+unit+'</b>' : '<span class="pending">Pendiente</span>';
      return '<li data-for="'+j.id+'">'+letter(j.id)+'<span>'+description+'</span></li>';
    });
    const complete = values.length === jobs.length;
    const sum = values.reduce((a,b) => a+b, 0);
    const op = (sum*100) % jobs.length === 0 ? ' = ' : ' ≈ ';
    const result = complete ? op+fmt(sum/jobs.length)+' '+unit : '';
    const brackets = differences ? ['[',']'] : ['(',')'];
    const mean = brackets[0]+terms.join(' + ')+brackets[1]+' / '+jobs.length+result;
    return '<section class="metric" data-metric="'+field+'"><h3>'+title+'</h3><p class="definition">'+definition+'</p>'+
      '<ul class="terms">'+lines.join('')+'</ul><div class="sum"><small>Promedio · '+values.length+' de '+jobs.length+
      ' términos</small><div class="formula">'+mean+'</div></div></section>';
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

  function makeCalculations(work, result, context, reading) {
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
    const spacing = context.figure ? (terminal ? 5 : 20) : Math.max(1, Math.ceil(extent/5));
    const left = hasDisk ? 46 : 14;
    const lanes = [{list:trace.cpuRuns, label:'CPU'}];
    if (hasDisk) lanes.push({list:result.diskSegments, label:'Disco'});
    const height = 35 + 23*lanes.length;
    let width, plot, svg, marker;
    const x = t => left + plot*t/extent;

    function resize() {
      width = Math.max(container.clientWidth, terminal ? 420 : 0);
      plot = width-left-16;
      container.replaceChildren();
      svg = svgElement('svg', {width, height, role:'img'}, container);
      for (let t=0; t<extent; t+=spacing) {
        svgElement('text', {x:x(t), y:height-4, 'font-size':12, 'text-anchor':'middle'}, svg, t);
      }
      svgElement('text', {x:x(extent), y:height-4, 'font-size':12, 'text-anchor':'middle'}, svg, extent);
      lanes.forEach((lane,i) => {
        lane.y = 8+i*23;
        if (hasDisk) svgElement('text',{x:0,y:lane.y+15,'font-size':12},svg,lane.label);
        svgElement('rect',{x:left,y:lane.y,width:plot,height:19,fill:'#eeeee4',stroke:'#bfc0b1'},svg);
        lane.layer = svgElement('g',{},svg);
        lane.parts = [];
      });
      marker = svgElement('line',{y1:3,y2:height-22,stroke:'#304d5a','stroke-width':1.5},svg);
    }

    function updatePart(part, span, time) {
      const end = Math.min(time, span.end);
      const w = x(end)-x(span.start);
      part.rect.setAttribute('width',w);
      part.label.setAttribute('x',x(span.start)+w/2);
      part.label.setAttribute('visibility',w >= 11 ? 'visible' : 'hidden');
      part.title.textContent = (span.id || 'CPU ociosa')+' · ['+span.start+', '+fmt(end)+') '+unit;
    }

    return function drawTimeline(time) {
      if (width !== Math.max(container.clientWidth, terminal ? 420 : 0)) resize();
      for (const lane of lanes) {
        const {parts,list,y} = lane;
        while (parts.length && list[parts.length-1].start >= time) parts.pop().group.remove();
        if (parts.length) updatePart(parts.at(-1),list[parts.length-1],time);
        while (parts.length < list.length && list[parts.length].start < time) {
          const span = list[parts.length];
          const group = svgElement('g', span.id ? {'data-id':span.id} : {}, lane.layer);
          const rect = svgElement('rect',{x:x(span.start),y,height:19,fill:span.id?'var(--tone)':'#faf8ef',stroke:'#4b5a5a','stroke-width':0.7},group);
          const title = svgElement('title',{},rect);
          const label = svgElement('text',{y:y+14,'text-anchor':'middle','font-size':12,'font-weight':700},group,span.id || '–');
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

  root.CpuView = {fmt, makeJobs, makeCalculations, makeTimeline};
})(globalThis);
