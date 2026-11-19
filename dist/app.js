'use strict';
(() => {
  const {cases, simulate} = window.CpuLab;
  const {contextFor} = window.CpuChapter;
  const el = id => document.getElementById(id);
  const colors = {A:'#8ed1f2',B:'#b1da91',C:'#ffc07b',D:'#e1b0eb',E:'#f4a7a1',F:'#a8d9d0'};
  const rules = {
    FIFO:['Primero en entrar, primero en salir','Ejecuta la primera ráfaga que entró a la cola de listos. Una llegada nueva espera hasta que la CPU quede libre. También se llama FCFS (First Come, First Served).'],
    SJF:['Shortest Job First','Cuando queda libre la CPU, elige la ráfaga lista más corta. Una vez iniciada la ráfaga, conserva la CPU hasta terminarla o pedir E/S.'],
    STCF:['Shortest Time-to-Completion First','Compara el tiempo restante de la ráfaga en ejecución con el de las ráfagas listas. Una llegada o el fin de una E/S pueden provocar un desalojo. También se llama PSJF.'],
    RR:['Round Robin','Da hasta un cuanto al primer trabajo listo. Si el cuanto vence y todavía queda ráfaga, el trabajo vuelve al final de la cola. Si termina antes, entrega la CPU en ese instante.'],
    SERIE:['E/S en serie · figura 7.8','Este caso de referencia reserva el turno para A incluso mientras está bloqueado. B espera hasta que A termina. Comparalo con STCF por ráfaga en la figura 7.9.']
  };
  Object.entries(cases).forEach(([key,c])=>el('case').add(new Option(c.name,key)));
  el('case').add(new Option('Carga propia','propia'));
  const params = new URLSearchParams(location.search);
  let custom = {name:'Carga propia',unit:'s',jobs:cases.convoy.jobs};
  let which = Object.hasOwn(cases,params.get('caso')) ? params.get('caso') : 'convoy';
  let policy = Object.hasOwn(rules,params.get('sim')) ? params.get('sim') : 'FIFO';
  if (policy === 'SERIE') which = 'disco';
  let work, result, step = 0, timer = null, q = 1;
  const decimal = n => n.toLocaleString('es-AR',{maximumFractionDigits:2});
  const badge = id => '<span class="badge" style="--tone:'+colors[id]+'">'+id+'</span>';
  const jobLabel = j => j.id+' llega en '+j.arrival+' · '+j.bursts.map((v,i)=>v+(i%2?' E/S':' CPU')).join(' / ');
  const empty = str => '<span class="muted">'+str+'</span>';
  const table=(heads,rows)=>'<div class="scroll"><table><thead><tr>'+heads.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  function pause(){ clearInterval(timer);timer=null;el('play').textContent='▷ Reproducir'; }
  function configure() {
    pause();
    policy = el('policy').value; which = el('case').value;
    if (policy==='SERIE') { which='disco';el('case').value=which; }
    el('case').disabled=policy==='SERIE'; el('q').disabled=policy!=='RR';
    let candidate = policy==='RR' ? el('q').valueAsNumber : q;
    const invalidQuantum = !Number.isInteger(candidate) || candidate < 1 || candidate > 300;
    if(invalidQuantum){candidate=q;el('q').value=q;}
    work = which==='propia'?custom:cases[which];
    try { result=simulate(work.jobs,policy,candidate);q=candidate; }
    catch(e){el('error').textContent=e.message;el('error').hidden=false;return;}
    el('error').hidden=!invalidQuantum;
    if(invalidQuantum) el('error').textContent='El cuanto debe ser un entero de 1 a 300. Se usó el último valor válido: '+q+'.';
    step=0;
    const context = contextFor(which,policy,q);
    el('chapterMode').textContent=context.mode;
    el('chapterMode').dataset.kind=context.kind;
    el('chapterReference').textContent=context.reference;
    el('chapterConfiguration').textContent=context.configuration;
    el('chapterAssumptions').textContent=context.assumptions;
    el('chapterQuestion').textContent=context.question;
    el('chapterNote').textContent=context.note;
    el('chapterNote').hidden=!context.note;
    render();
  }
  function drawTimeline() {
    const container = el('timeline');
    const width = container.clientWidth;
    if (!width) return;
    const now = result.frames[step-1]?.t ?? 0;
    const extent = result.end;
    const left = 46; // Espacio para los nombres de CPU y disco, en píxeles CSS.
    const plotWidth = Math.max(0, width-left-20);
    const pos = t => left + plotWidth*t/extent;
    const lanes = work.jobs.some(j=>j.bursts.length>1)?[['CPU',result.cpuSegments],['Disco',result.diskSegments]]:[['CPU',result.cpuSegments]];
    const height = lanes.length*28+28;
    let svg='<svg class="timeline" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Línea de tiempo hasta '+now+' '+work.unit+'. Los intervalos exactos están en Mirar debajo del capó.">';
    lanes.forEach(([name,list],idx)=>{
      const y=idx*28+3;
      svg+='<text x="0" y="'+(y+17)+'" font-size="14" font-weight="bold">'+name+'</text><rect x="'+left+'" y="'+y+'" width="'+plotWidth+'" height="23" fill="#eeeae0" stroke="#b7b1a4"/>';
      for(const s of list){
        if(s.start>=now) break;
        const end=Math.min(now,s.end),w=pos(end)-pos(s.start);
        svg+='<rect x="'+pos(s.start)+'" y="'+y+'" width="'+w+'" height="23" fill="'+(colors[s.id]||'#faf8f1')+'" stroke="#423f3c" stroke-width=".8"><title>'+name+' · '+(s.id||'ociosa')+' · ['+s.start+', '+end+') '+work.unit+'</title></rect>';
        if(w>=12) svg+='<text text-anchor="middle" x="'+((pos(s.start)+pos(end))/2)+'" y="'+(y+16)+'" font-size="14" font-weight="bold">'+(s.id||'–')+'</text>';
      }
    });
    const ticks=[...new Set([0,Math.round(extent/4),Math.round(extent/2),Math.round(extent*3/4),extent])];
    for(const t of ticks)svg+='<text x="'+pos(t)+'" y="'+(height-4)+'" text-anchor="middle" font-size="12">'+t+'</text>';
    container.innerHTML=svg+'</svg>';
  }
  function compare(){
    const rows=['FIFO','SJF','STCF','RR',...(which==='disco'?['SERIE']:[])].map(p=>{
      const r=p===policy?result:simulate(work.jobs,p,q);
      return [p==='SERIE'?'E/S en serie':p==='RR'?'RR (q = '+q+')':p,decimal(r.response),decimal(r.turnaround),r.end,decimal(r.utilization)+' %'];
    });
    el('results').innerHTML='<h2>¿Qué cambió con la política?</h2><p>Misma carga · tiempos en '+work.unit+' · promedios por trabajo.</p>'+table(['Política','Respuesta media','Retorno medio','Fin del lote','CPU ocupada'],rows)+'<h3>Resultados por trabajo · '+policy+'</h3>'+table(['Trabajo','Llegada','Primer uso','Fin','Respuesta','Retorno','Espera en listos'],result.metrics.map(j=>[j.id,j.arrival,j.first,j.finish,j.response,j.turnaround,j.wait]));
  }
  function technical(f){
    const rows = work.jobs.map((j,i)=>{const live=f?.jobs[i];return [j.id,j.arrival,j.bursts.join(' / '),live?.state??'por admitir',live?.remaining??'—',live?.wait??0];});
    const now=f?.t??0;
    const history=result.cpuSegments.filter(s=>s.start<now).map(s=>[s.start,s.end,s.id||'Ociosa']);
    const historyDisk=result.diskSegments.filter(s=>s.start<now).map(s=>[s.start,Math.min(s.end,now),s.id]);
    el('techbody').innerHTML='<h3>Estado de los trabajos</h3><p>Las ráfagas alternan CPU / E/S / CPU. El restante corresponde a la ráfaga actual de CPU. Un trabajo bloqueado espera la E/S. Unidad: '+work.unit+'.</p>'+table(['Trabajo','Llegada','Ráfagas','Estado','Restante','Espera en listos'],rows)+'<h3>Intervalos de CPU hasta t = '+now+'</h3>'+(history.length?table(['Desde','Hasta','Trabajo'],history):'<p>Todavía no transcurrió tiempo.</p>')+(historyDisk.length?'<h3>Intervalos de disco observados</h3>'+table(['Desde','Hasta','Trabajo'],historyDisk):'');
  }
  function render(){
    const f = step ? result.frames[step-1] : null;
    const done=step===result.frames.length;
    const now=f?.t??0;
    el('caseTag').textContent=policy+' · '+work.unit;
    document.querySelectorAll('.steps span').forEach((s,i)=>s.classList.toggle('active',i===(done?2:step?1:0)));
    el('ready').innerHTML=f?(f.ready.map(badge).join('')||empty('Vacía')):empty('Antes de admitir');
    el('cpu').innerHTML=f?.cpu?badge(f.cpu):empty(done?'En reposo':f?'Ociosa':'Por elegir');
    el('disk').innerHTML=f?.disk?badge(f.disk):empty('Libre');
    el('time').textContent='t = '+now+' '+work.unit;
    drawTimeline();
    el('loadline').textContent=work.jobs.map(j=>j.id+' ('+j.arrival+'; '+j.bursts.join('/')+')').join('   ·   ')+'   —   (llegada; ráfagas) en '+work.unit;
    el('eventnum').textContent=step+'/'+result.frames.length;
    el('decision').textContent=f?f.decision:'¿Quién debería usar la CPU primero?';
    el('story').textContent=f?f.notes.join(' ')||'La decisión anterior sigue vigente.':'Leé las llegadas y las duraciones. Presioná Siguiente para contrastar tu predicción.';
    el('prev').disabled=step===0;el('next').disabled=done;el('end').disabled=done;el('play').disabled=done;el('reset').disabled=step===0;
    el('results').hidden=!done;if(done){pause();compare();}
    if(document.querySelector('.technical').open) technical(f);
  }
  function go(target){pause();step=Math.max(0,Math.min(target,result.frames.length));render();}
  el('policy').value=policy;el('case').value=which;
  el('policy').onchange=configure;el('case').onchange=configure;
  el('prepare').onclick=configure;
  el('q').onchange=()=>{if(el('policy').value==='RR')configure();};
  el('reset').onclick=()=>go(0);el('prev').onclick=()=>go(step-1);el('next').onclick=()=>go(step+1);el('end').onclick=()=>go(result.frames.length);
  function play(){
    if(timer){pause();return;}
    el('play').textContent='Ⅱ Pausar';
    timer=setInterval(()=>{if(step<result.frames.length){step++;render();}else pause();},Number(el('speed').value));
  }
  el('play').onclick=play;el('speed').onchange=()=>{if(timer){pause();play();}};
  document.querySelector('.technical').ontoggle=e=>{if(e.target.open) technical(step?result.frames[step-1]:null);};
  const dialog=el('dialog');
  function show(body){pause();el('dialogbody').innerHTML=body;dialog.showModal();}
  document.querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>{
    const [title,explanation]=rules[policy];
    if(b.dataset.help==='guide')show('<h2>Guía rápida · '+policy+'</h2><ol><li>Elegí un ejemplo. Ver o editar carga muestra el orden de llegada y las ráfagas.</li><li>Anticipá el próximo trabajo. Siguiente revela una frontera entre eventos. La CPU indicada corre a partir del instante mostrado; la barra muestra lo que ya transcurrió.</li><li>Con Anterior podés volver a la decisión. Ir al final completa las métricas y compara todas las políticas sobre la misma carga.</li></ol><h3>Para probar '+policy+'</h3><p>'+({FIFO:'En Efecto convoy, ¿cuánto espera B mientras corre A?',SJF:'En Llegadas tardías, ¿puede B interrumpir a A en t = 10?',STCF:'En Llegadas tardías, mirá cuánto le queda a A cuando llegan B y C.',RR:'En Tres terminales, compará la primera ejecución de C con cuantos de 1 y de 5.',SERIE:'En t = 10, fijate qué hacen el disco y B. Después elegí STCF.'}[policy])+'</p>');
    else show('<h2>'+title+'</h2><p>'+explanation+'</p><h3>Cómo leer los tiempos</h3><p>Respuesta = primer uso de CPU − llegada. Retorno = finalización − llegada. Espera acumula exclusivamente los intervalos en listos. La utilización es tiempo de CPU ocupada dividido por el tiempo desde t = 0 hasta el último fin.</p><h3>Supuestos y desempates</h3><p>Un procesador, un disco FIFO, tiempos enteros y cambios de contexto de costo cero. SJF y STCF conocen la duración de la ráfaga actual. A igual duración restante se elige la primera fila de la carga, incluso si se requiere desalojar. Así se reproduce la figura 7.9 en t = 80 ms.</p><p>Las llegadas simultáneas siguen el orden de carga. En RR, las llegadas y los desbloqueos en el límite ingresan antes de reencolar al trabajo cuyo cuanto vence. Una ráfaga que termina justo en el límite se considera completada.</p><p>Fuente: R. H. y A. C. Arpaci-Dusseau, <i>Operating Systems: Three Easy Pieces</i>, cap. 7, versión 1.10.</p>');
  });
  el('configBtn').onclick=()=>{
    if(which==='disco'){
      show('<h2>CPU y disco</h2><p>Ambos trabajos llegan en t = 0 ms.</p><p>'+work.jobs.map(jobLabel).join('<br>')+'</p><p>A pide E/S cuatro veces. Compará E/S en serie con STCF sobre las mismas cinco ráfagas de A.</p>');return;
    }
    show('<h2>Carga de CPU</h2><p>Una fila por trabajo (A a F, en orden). Escribí dos enteros separados por coma. La llegada admite 0 a 300 y la duración de CPU, 1 a 300 segundos.</p><label for="edit">Llegada, duración</label><textarea id="edit" rows="6" spellcheck="false"></textarea><p id="formerror" role="alert" class="formerror"></p><button class="btn yellow" id="save">Usar esta carga</button>');
    el('edit').value=work.jobs.map(j=>j.arrival+', '+j.bursts[0]).join('\n');
    el('save').onclick=()=>{
      try {
        const lines=el('edit').value.trim().split(/\r?\n/);
        const jobs=lines.map((s,i)=>{const m=/^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(s);if(!m)throw Error('Revisá la fila '+(i+1)+'. Usá llegada, duración.');return {id:String.fromCharCode(65+i),arrival:Number(m[1]),bursts:[Number(m[2])]};});
        simulate(jobs,policy,q);custom={name:'Carga propia',unit:'s',jobs};el('case').value='propia';dialog.close();configure();
      }catch(e){el('formerror').textContent=e.message;}
    };
  };
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  configure();
  new ResizeObserver(drawTimeline).observe(el('timeline'));
})();
