// Changes that come by phone (called out from standby, flight changed or cancelled): no new PDF is
// published, so they are entered by hand. They live inside the roster object itself
// (roster.manual), so they travel with the share link and disappear when a newer PDF is loaded.
import { addDays } from './parser.js';
import { HOME, shiftStamp, tripKey } from './model.js';
import { CITY, TZ, toTurkey } from './stations.js';

const pad = (n) => String(n).padStart(2, '0');
const hm = (min) => `${Math.floor(min / 60)}:${pad(Math.round(min % 60))}`;

// local wall time at an airport -> UTC ms (Turkey is fixed UTC+3)
function utcOf(code, date, time) {
  const tr = code === HOME ? { date, time } : toTurkey(code, date, time) || { date, time };
  return Date.parse(`${tr.date}T${tr.time}:00+03:00`);
}
// local arrival date that makes the flight last between 20 min and 20 h
function arrivalDate(depUtc, code, depDate, time) {
  for (const off of [0, 1, -1, 2]) {
    const d = addDays(depDate, off);
    const h = (utcOf(code, d, time) - depUtc) / 3600000;
    if (h > 0.3 && h < 20) return d;
  }
  return depDate;
}

/** "den", "DEN", "Denver" -> "DEN" (or null) */
export function resolveStation(input = '') {
  const s = input.trim();
  const code = s.slice(0, 3).toUpperCase();
  if (/^[A-Za-z]{3}$/.test(s) || /^[A-Z]{3}\b/.test(s)) return code;
  const low = s.toLocaleLowerCase('tr-TR');
  const hit = Object.entries(CITY).find(([, name]) => name.toLocaleLowerCase('tr-TR') === low)
    || Object.entries(CITY).find(([, name]) => name.toLocaleLowerCase('tr-TR').startsWith(low));
  return hit ? hit[0] : null;
}
export const knownZone = (code) => !!TZ[code];

/**
 * Builds a trip duty (same shape the PDF parser produces) from the form.
 * f = { outFlight, dest, date, dep, arr, retFlight, retDate, retDep, retArr, report }
 * Departure from İstanbul and landing in İstanbul are Turkey time; the rest is local time there.
 */
export function buildTrip(f, id) {
  const outDepUtc = utcOf(HOME, f.date, f.dep);
  const outArrDate = arrivalDate(outDepUtc, f.dest, f.date, f.arr);
  const retDepUtc = utcOf(f.dest, f.retDate, f.retDep);
  const retArrDate = arrivalDate(retDepUtc, HOME, f.retDate, f.retArr);
  const outMin = (utcOf(f.dest, outArrDate, f.arr) - outDepUtc) / 60000;
  const retMin = (utcOf(HOME, retArrDate, f.retArr) - retDepUtc) / 60000;
  const groundMin = (retDepUtc - utcOf(f.dest, outArrDate, f.arr)) / 60000;
  const depStamp = `${f.date}T${f.dep}`;
  const cargo = /^TK6\d{3}$/.test(f.outFlight);
  // sign-in: typed, else 1.5 h before departure (cargo 1 h)
  const report = f.report
    ? (f.report <= f.dep ? `${f.date}T${f.report}` : `${addDays(f.date, -1)}T${f.report}`)
    : shiftStamp(depStamp, cargo ? -60 : -90);
  return {
    type: 'trip', manual: true, manualId: id, code: null, reportAuto: !f.report,
    start: report, report, end: `${retArrDate}T${f.retArr}`,
    restUntil: null, periods: [], limits: [], crew: [], dutyTime: null,
    flightTime: hm(Math.max(0, outMin) + Math.max(0, retMin)),
    layovers: groundMin >= 240 ? [{ station: f.dest, rest: hm(groundMin), hotel: null }] : [],
    legs: [
      { flight: f.outFlight, from: HOME, to: f.dest, depDate: f.date, dep: f.dep, arrDate: outArrDate, arr: f.arr },
      { flight: f.retFlight, from: f.dest, to: HOME, depDate: f.retDate, dep: f.retDep, arrDate: retArrDate, arr: f.retArr },
    ],
  };
}

/** The form values for an existing (two-leg) trip, to edit it. */
export function formFromTrip(d) {
  const a = d.legs[0], b = d.legs[d.legs.length - 1];
  return {
    outFlight: a.flight, dest: a.to, date: a.depDate, dep: a.dep, arr: a.arr,
    retFlight: b.flight, retDate: b.depDate, retDep: b.dep, retArr: b.arr, report: d.reportAuto ? '' : d.report?.slice(11) || '',
  };
}

const sortDuties = (r) => r.duties.sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
const dutyOfTrip = (r, key) => r.duties.find((d) => d.type === 'trip' && d.legs.length
  && tripKey(`${d.legs[0].depDate}T${d.legs[0].dep}`, d.legs[0].flight) === key);
const book = (r) => (r.manual ||= { log: [], removed: [] });
const label = (d) => { const c = d.layovers?.[0]?.station || d.legs[0].to; return `${d.legs[0].flight} ${CITY[c] || c}`; };

/**
 * Adds a trip typed by hand. Stand-by / day-off codes on the days it covers are set aside
 * (restored on undo). `replaceKey` = trip being edited.
 */
export function addTrip(r, duty, replaceKey) {
  const m = book(r);
  const id = duty.manualId;
  let kind = 'add', was = null;
  if (replaceKey) {
    const old = dutyOfTrip(r, replaceKey);
    if (old?.manual) {
      // editing a hand-made trip: replace it outright and take over what it had set aside
      r.duties.splice(r.duties.indexOf(old), 1);
      for (const x of m.removed) if (x.by === old.manualId) x.by = id;
      m.log = m.log.filter((x) => x.id !== old.manualId);
    } else if (old) { r.duties.splice(r.duties.indexOf(old), 1); m.removed.push({ by: id, duty: old }); kind = 'edit'; was = label(old); }
  }
  const from = duty.legs[0].depDate, to = duty.legs[duty.legs.length - 1].arrDate;
  for (const d of [...r.duties]) {
    const day = d.start.slice(0, 10);
    if (d.type !== 'trip' && day >= from && day <= to) { r.duties.splice(r.duties.indexOf(d), 1); m.removed.push({ by: id, duty: d }); }
  }
  r.duties.push(duty);
  sortDuties(r);
  m.log.push({ id, kind, text: kind === 'edit' ? `${was} → ${label(duty)} (${from})` : `${label(duty)} ${duty.fromMail ? 'mailden ' : ''}eklendi (${from})`, at: new Date().toISOString() });
}

export function cancelTrip(r, key, id) {
  const m = book(r);
  const old = dutyOfTrip(r, key);
  if (!old) return false;
  if (old.manual) { undo(r, old.manualId); return true; } // a hand-made trip is simply removed
  r.duties.splice(r.duties.indexOf(old), 1);
  m.removed.push({ by: id, duty: old });
  m.log.push({ id, kind: 'cancel', text: `${label(old)} iptal (${old.legs[0].depDate})`, at: new Date().toISOString() });
  return true;
}

/** Undo one hand-made change (and everything it set aside). */
export function undo(r, id) {
  const m = r.manual;
  if (!m) return;
  r.duties = r.duties.filter((d) => d.manualId !== id);
  for (const x of m.removed.filter((x) => x.by === id)) r.duties.push(x.duty);
  m.removed = m.removed.filter((x) => x.by !== id);
  m.log = m.log.filter((x) => x.id !== id);
  sortDuties(r);
}
