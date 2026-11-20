// Proyección de la traza sobre el reloj que mira el alumno. El motor decide los despachos.
(function (root) {
  'use strict';

  function lastAt(entries, time, field) {
    let low = 0, high = entries.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (entries[mid][field] <= time) low = mid + 1;
      else high = mid;
    }
    return low - 1;
  }

  function record(spans, start, end) {
    const last = spans.at(-1);
    if (last && last.end === start) last.end = end;
    else spans.push({start, end, prior: last ? last.prior + last.end - last.start : 0});
  }

  function elapsedAt(spans, time) {
    const span = spans[lastAt(spans, time, 'start')];
    if (!span) return {prior:0, start:0, end:0, total:0};
    const end = Math.min(time, span.end);
    return {prior:span.prior, start:span.start, end, total:span.prior + (end - span.start)};
  }

  function readTrace(inputs, result) {
    // Una misma ejecución puede atravesar varias fronteras, por ejemplo A en la figura 7.4.
    const jobs = inputs.map((input, index) => ({
      id:input.id, arrival:input.arrival, index, usesDisk:input.bursts.length > 1,
      demand:input.bursts.reduce((sum, value, i) => sum + (i % 2 === 0 ? value : 0), 0),
      cpu:[], ready:[], io:[]
    }));
    const overlap = [], idle = [];
    const switches = result.switches ?? [];
    const cpuRuns = [];
    result.cpuSegments.forEach((segment, index) => {
      const {start, end, id, switching} = segment;
      const frame = result.frames[index];
      const run = cpuRuns.at(-1);
      if (run && run.id === id && run.switching === switching) run.end = end;
      else cpuRuns.push({...segment});
      if (frame.cpu && frame.disk) record(overlap, start, end);
      if (!id && !switching) record(idle, start, end);
      for (const job of jobs) {
        const state = frame.jobs[job.index].state;
        if (state === 'ejecutando') record(job.cpu, start, end);
        if (state === 'listo') record(job.ready, start, end);
      }
    });
    for (const job of jobs) {
      for (const interval of result.diskSegments.filter(s => s.id === job.id)) {
        record(job.io, interval.start, interval.end);
      }
    }
    jobs.sort((a, b) => a.arrival - b.arrival || a.index - b.index);

    function at(time) {
      const index = lastAt(result.frames, time, 't');
      const frame = result.frames[index];
      const rows = jobs.map(job => {
        const state = frame.jobs[job.index];
        const cpu = elapsedAt(job.cpu, time);
        const burst = state.state === 'ejecutando' ? state.remaining - (time - frame.t) : state.remaining;
        return {
          id:job.id, arrival:job.arrival, demand:job.demand, usesDisk:job.usesDisk, state:state.state,
          first:state.first, finish:state.finish, burst,
          cpu, left:job.demand - cpu.total, wait:elapsedAt(job.ready, time), io:elapsedAt(job.io, time)
        };
      });
      const busy = rows.reduce((sum, job) => sum + job.cpu.total, 0);
      const completedSwitches = lastAt(switches, time, 'end') + 1;
      const switchTime = completedSwitches * (result.switchCost ?? 0) + (frame.switching ? time - frame.switching.start : 0);
      return {time, index, frame, jobs:rows, busy, completedSwitches, switchTime,
        idle:elapsedAt(idle, time).total, overlap:elapsedAt(overlap, time).total};
    }
    return {at, cpuRuns};
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {readTrace};
  else root.CpuTrace = {readTrace};
})(globalThis);
