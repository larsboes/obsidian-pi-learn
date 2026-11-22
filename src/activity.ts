/** Learn-only presentation. The model supplies parameters, never code or actions. */
export const ACTIVITY_GUIDE = [
  'In Learn, offer an interactive activity only when manipulating a variable teaches more than prose. Ask for a prediction first with the existing prediction quiz or a plain question, then wait.',
  'For a bounded-queue experiment, emit one top-level `learn-activity` fenced block in your completed reply. Its entire body is JSON like:',
  '{"version":1,"kind":"queue","title":"Bounded queue","prompt":"Predict when the queue fills. Change service rate and explain what happens.","capacity":20,"arrival":8,"service":6,"initial":0,"seconds":20}',
  'Use whole numbers, capacity 1–1000, arrival 0–100, service 0–200, initial 0–capacity and seconds 1–120. Include a short prose fallback outside the block. Ask the learner to report what they changed, saw and why; adapt the next question to their explanation (simpler contrast or new transfer case). A prediction or a control change is not evidence of mastery.',
  'Do not emit executable or transcluded embeds in replies. For topics other than queues, use existing cards and prose; this client supports only the queue activity for now.',
].join('\n');

export interface QueueActivity {
  version: 1;
  kind: 'queue';
  title: string;
  prompt: string;
  capacity: number;
  arrival: number;
  service: number;
  initial: number;
  seconds: number;
}

const fields = new Set(['version', 'kind', 'title', 'prompt', 'capacity', 'arrival', 'service', 'initial', 'seconds']);
export function parseActivity(raw: string): QueueActivity | null {
  if (raw.length > 2048) return null;
  try {
    const v = JSON.parse(raw);
    const text = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
    const int = (x: unknown, min: number, max: number) => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some((k) => !fields.has(k))) return null;
    if (v.version !== 1 || v.kind !== 'queue' || !text(v.title, 100) || !text(v.prompt, 400)) return null;
    if (!int(v.capacity, 1, 1000) || !int(v.arrival, 0, 100) || !int(v.service, 0, 200)
      || !int(v.initial, 0, v.capacity) || !int(v.seconds, 1, 120)) return null;
    return v;
  } catch { return null; }
}

export function queueDepth(q: QueueActivity, service: number, time: number): number {
  return Math.min(q.capacity, Math.max(0, q.initial + (q.arrival - service) * time));
}

export function renderActivity(el: HTMLElement, q: QueueActivity, readOnly: boolean): void {
  const card = el.createEl('fieldset', { cls: 'pi-learn-experiment' });
  card.createEl('legend', { text: q.title });
  card.createEl('p', { text: q.prompt });
  card.createEl('p', {
    cls: 'pi-learn-experiment-assumptions',
    text: `${q.initial} of ${q.capacity} items initially · ${q.arrival} arrivals/s · ${q.seconds} s. Fixed rates; the full buffer blocks excess arrivals.`,
  });
  const control = card.createEl('label');
  const label = control.createSpan();
  const slider = control.createEl('input', {
    attr: { type: 'range', min: '0', max: String(Math.max(1, q.service, q.arrival * 2)), step: '1', value: String(q.service) },
  });
  const output = card.createEl('output', { attr: { 'aria-live': 'polite' } });
  const svgNS = 'http://www.w3.org/2000/svg';
  const plot = el.ownerDocument.createElementNS(svgNS, 'svg');
  plot.setAttribute('class', 'pi-learn-experiment-plot');
  plot.setAttribute('viewBox', '0 0 280 82');
  plot.setAttribute('aria-hidden', 'true'); // The output gives the depth, trend and threshold in words.
  const bounds = el.ownerDocument.createElementNS(svgNS, 'path');
  bounds.setAttribute('d', 'M4 6 H276 M4 76 H276');
  bounds.setAttribute('class', 'pi-learn-experiment-bounds');
  const line = el.ownerDocument.createElementNS(svgNS, 'polyline');
  line.setAttribute('class', 'pi-learn-experiment-line');
  plot.append(bounds, line);
  card.appendChild(plot);
  const update = () => {
    const service = Number(slider.value);
    const delta = q.arrival - service;
    label.textContent = `Service rate: ${service} items/s`;
    const end = queueDepth(q, service, q.seconds);
    const threshold = delta > 0 ? (q.capacity - q.initial) / delta : delta < 0 ? q.initial / -delta : Infinity;
    const reached = threshold <= q.seconds;
    const format = (v: number) => String(Number(v.toFixed(2)));
    const transition = reached ? ` ${delta > 0 ? 'Full' : 'Empty'} at ${format(threshold)} s.` : '';
    output.textContent = `Depth after ${q.seconds} s: ${end}/${q.capacity} items. ${delta === 0 ? 'Balanced; depth stays constant.' : delta > 0 ? 'Arrivals outpace service.' : 'Service outpaces arrivals.'}${transition}`;
    const point = (time: number) => `${4 + time / q.seconds * 272},${76 - queueDepth(q, service, time) / q.capacity * 70}`;
    line.setAttribute('points', [point(0), ...(reached ? [point(threshold)] : []), point(q.seconds)].join(' '));
  };
  slider.value = String(q.service);
  slider.addEventListener('input', update);
  if (readOnly) {
    slider.disabled = true;
    card.createEl('p', { text: 'Saved experiment setup · control changes were not recorded.' });
  } else {
    const reset = card.createEl('button', { text: 'Reset experiment', attr: { type: 'button' } });
    reset.onclick = () => { slider.value = String(q.service); update(); };
  }
  update();
}
