// Duty-notification e-mails ("Duty notifications that you have been informed are below. (All duties
// are in UTC time zone)"). The text is pasted, or read from a screenshot on the phone (OCR), and
// turned into the same trip shape the PDF parser produces. All times in the mail are UTC.
import { HOME } from './model.js';
import { TZ } from './stations.js';

const pad = (n) => String(n).padStart(2, '0');
const hm = (min) => `${Math.floor(min / 60)}:${pad(Math.round(min % 60))}`;

const fmtCache = {};
/** UTC ms -> wall time at an airport { date, time }; Turkey fixed UTC+3. null if the zone is unknown. */
export function localAt(code, utcMs) {
  const zone = code === HOME ? 'Europe/Istanbul' : TZ[code];
  if (!zone) return null;
  if (zone === 'Europe/Istanbul') {
    const s = new Date(utcMs + 180 * 60000).toISOString();
    return { date: s.slice(0, 10), time: s.slice(11, 16) };
  }
  const f = fmtCache[zone] ||= new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// OCR slips: O for 0 in numbers, l/I for 1, '.' or ',' for ':' etc.
const clean = (t) => t
  .replace(/[–—−]/g, '-')
  .replace(/(\d)[.,;](\d{2})(?!\d)/g, '$1:$2')
  .replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, '0')
  .replace(/(?<=\d)[lI|]|[lI|](?=\d)/g, '1');

const DT = String.raw`(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})\s+(\d{1,2}):(\d{2})`;
const utc = (m, i) => Date.UTC(+m[i + 2], m[i + 1] - 1, +m[i], +m[i + 3], +m[i + 4]);
// the '/' before the airport is often read as '|', '[', 'l' or '1' by OCR
const SEP = String.raw`\s*[/|\[\]\\(){}!lI1]?\s*`;
const LEG = new RegExp(String.raw`(?:TK\s*(\d{2,4})[^\n]*\n[\s\S]{0,40}?)?${DT}${SEP}([A-Z]{3})\s*-\s*${DT}${SEP}([A-Z]{3})`, 'g');
const DUTY = new RegExp(String.raw`${DT}\s*-\s*${DT}(?!${SEP}[A-Z]{3})`);

/**
 * Returns { trips: [{ dutyStart, dutyEnd, legs:[{flight, from, to, depUtc, arrUtc}] }], informed, problems }
 */
export function parseMail(raw = '') {
  const text = clean(raw);
  const blocks = text.split(/Duty\s*Notification\s*\d*\s*:/i).slice(1);
  if (!blocks.length) blocks.push(text);
  const trips = [], problems = [];
  for (const b of blocks) {
    const legs = [];
    for (const m of b.matchAll(LEG)) {
      legs.push({ flight: m[1] ? `TK${m[1]}` : '', from: m[7], depUtc: utc(m, 2), to: m[13], arrUtc: utc(m, 8) });
    }
    if (!legs.length) continue;
    const d = b.match(DUTY);
    // missing flight numbers (OCR): take the one from the leg before
    legs.forEach((l, i) => { if (!l.flight && i) l.flight = legs[i - 1].flight; });
    if (legs.some((l) => !l.flight)) problems.push('Uçuş numarası okunamadı');
    for (const l of legs) {
      if (!TZ[l.from] && l.from !== HOME) problems.push(`${l.from} için saat dilimi bilinmiyor`);
      if (!TZ[l.to] && l.to !== HOME) problems.push(`${l.to} için saat dilimi bilinmiyor`);
      const h = (l.arrUtc - l.depUtc) / 3600000;
      if (!(h > 0.3 && h < 20)) problems.push(`${l.flight} ${l.from}-${l.to}: saatler tutarsız (yanlış okunmuş olabilir)`);
    }
    trips.push({ dutyStart: d ? utc(d, 1) : null, dutyEnd: d ? utc(d, 6) : null, legs });
  }
  if (!trips.length) problems.push('Mailde uçuş satırı bulunamadı');
  return { trips, problems: [...new Set(problems)] };
}

/** One parsed notification -> trip duty (local wall times at each airport, like the PDF). */
export function buildMailTrip(p, id) {
  const legs = p.legs.map((l) => {
    const d = localAt(l.from, l.depUtc), a = localAt(l.to, l.arrUtc);
    return { flight: l.flight, from: l.from, to: l.to, depDate: d.date, dep: d.time, arrDate: a.date, arr: a.time };
  });
  const first = p.legs[0], last = p.legs[p.legs.length - 1];
  // sign-in: duty start in the mail; else 1.5 h before departure (cargo 1 h)
  const cargo = /^TK6\d{3}$/.test(first.flight);
  const repUtc = p.dutyStart ?? first.depUtc - (cargo ? 60 : 90) * 60000;
  const rep = localAt(first.from, repUtc);
  const end = localAt(last.to, p.dutyEnd ?? last.arrUtc);
  const layovers = [];
  p.legs.forEach((l, i) => {
    const n = p.legs[i + 1];
    if (n && n.from === l.to && n.depUtc - l.arrUtc >= 240 * 60000) layovers.push({ station: l.to, rest: hm((n.depUtc - l.arrUtc) / 60000), hotel: null });
  });
  const fly = p.legs.reduce((s, l) => s + (l.arrUtc - l.depUtc) / 60000, 0);
  return {
    type: 'trip', manual: true, manualId: id, code: null, reportAuto: !p.dutyStart, fromMail: true,
    start: `${rep.date}T${rep.time}`, report: `${rep.date}T${rep.time}`, end: `${end.date}T${end.time}`,
    restUntil: null, periods: [], limits: [], crew: [], dutyTime: null,
    flightTime: hm(fly), layovers, legs,
  };
}
