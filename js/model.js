// Turns a parsed roster into per-day, human friendly information.
import { addDays } from './parser.js';
import { city } from './stations.js';

export const HOME = 'IST';
const TR_OFFSET = '+03:00'; // Türkiye: sabit UTC+3

// Istanbul wall-clock "YYYY-MM-DDTHH:MM" -> Date
export const istDate = (stamp) => new Date(`${stamp}:00${TR_OFFSET}`);
export const shiftStamp = (stamp, minutes) => {
  const d = new Date(istDate(stamp).getTime() + minutes * 60000);
  const p = new Date(d.getTime() + 3 * 3600000).toISOString();
  return p.slice(0, 16);
};

export const CODE_INFO = {
  IBB: { label: 'İzin', long: 'Boş gün', kind: 'off' },
  IBI: { label: 'İzin', long: 'Boş gün (talep edilmiş)', kind: 'off' },
  HSBY: { label: 'Nöbet', long: 'Ev nöbeti: evde ama çağrılabilir', kind: 'standby' },
  SBY: { label: 'Nöbet', long: 'Nöbet', kind: 'standby' },
  CFR: { label: 'CFR', long: 'Call for Roster: görev çıkabilir', kind: 'standby' },
  GG: { label: 'Görev', long: 'Önceki aydan devam eden görev', kind: 'prev' },
  IBE: { label: 'İzin', long: 'Boş gün', kind: 'off' },
  III: { label: 'İzin', long: 'Boş gün', kind: 'off' },
  MUA: { label: 'Muayene', long: 'Sağlık muayenesi', kind: 'standby', ground: true },
};
/** Label/colour for a day code; simulator (SR1…) and training (RC1…) get their own words. */
export function codeInfo(type = '') {
  if (CODE_INFO[type]) return CODE_INFO[type];
  if (/^SR\d/.test(type)) return { label: 'Simülatör', long: `Simülatör eğitimi (${type})`, kind: 'standby', ground: true };
  if (/^RC\d/.test(type)) return { label: 'Eğitim', long: `Eğitim (${type})`, kind: 'standby', ground: true };
  return { label: type, long: `Yer görevi / eğitim (${type})`, kind: 'standby', ground: true };
}

export const CARGO_LATER_MIN = 30;
export const SIGNIN_BUFFER_MIN = 40; // arrive this long before sign-in
export const DRIVE_BUFFER_MIN = 10; // extra margin on top of the drive time
export const tripKey = (depStamp, flight) => `${depStamp}-${flight}`;
/** Minutes before departure to leave home (passenger default 3h10; cargo 30 min less). */
export const leaveMinutes = (settings, cargo) => {
  const base = settings.leaveMin ?? 190;
  return cargo ? base - CARGO_LATER_MIN : base;
};

/** Enrich trips: home departure, leave-home time, return. */
export function trips(roster, settings) {
  return roster.duties.filter((d) => d.type === 'trip' && d.legs.length).map((d) => {
    const first = d.legs[0];
    const last = d.legs[d.legs.length - 1];
    const fromHome = first.from === HOME;
    const depStamp = `${first.depDate}T${first.dep}`;
    // Cargo: sign-in 1h before departure (passenger: 1.5h) -> leave home 30 min later.
    const signInGap = (istDate(depStamp) - istDate(d.report)) / 60000;
    const cargo = fromHome && (signInGap > 0 ? signInGap <= 65 : /^TK6\d{3}$/.test(first.flight));
    // With a drive time (Google traffic or typed): leave = sign-in − 40 min − drive time − 10 min margin.
    const key = tripKey(depStamp, first.flight);
    const drive = fromHome ? settings.drive?.[key] : null;
    const leaveBefore = drive
      ? Math.round((istDate(depStamp) - istDate(d.report)) / 60000) + SIGNIN_BUFFER_MIN + drive + DRIVE_BUFFER_MIN
      : leaveMinutes(settings, cargo);
    const leave = fromHome ? shiftStamp(depStamp, -leaveBefore) : null;
    const dests = [...new Set(d.legs.map((l) => l.to).filter((s) => s && s !== HOME))];
    const main = d.layovers[0]?.station || dests[dests.length - 1] || last.to;
    // time on the ground at each station: landing -> next departure (both local to that city)
    const stays = [];
    d.legs.forEach((l, i) => {
      const n = d.legs[i + 1];
      if (!n || n.from !== l.to) return;
      const min = (Date.parse(`${n.depDate}T${n.dep}:00Z`) - Date.parse(`${l.arrDate}T${l.arr}:00Z`)) / 60000;
      if (min > 0) stays.push({ station: l.to, min, transit: min < 240 });
    });
    return {
      ...d,
      stays, cargo, leaveBefore, key, drive: drive || null,
      first, last, leave, depStamp,
      reportStamp: d.report,
      returnStamp: last.to === HOME ? `${last.arrDate}T${last.arr}` : null,
      dests, main,
      title: dests.map(city).join(' → ') || city(last.to),
    };
  });
}

const WEEKDAY = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'UTC' });
const dayFrac = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return (h * 60 + m) / 1440; };

/** One entry per calendar day of the roster month. */
export function buildDays(roster, settings) {
  const { year, month, days } = roster.period;
  const T = trips(roster, settings);
  const out = [];
  const pad = (n) => String(n).padStart(2, '0');
  for (let day = 1; day <= days; day++) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const info = { date, day, kind: 'free', label: 'Evde', items: [] };
    const trip = T.find((t) => t.first.depDate <= date && date <= t.last.arrDate);
    const other = roster.duties.find((d) => d.type !== 'trip' && d.start.slice(0, 10) === date);
    if (trip) {
      info.trip = trip;
      const departing = trip.first.depDate === date;
      const returning = trip.last.arrDate === date;
      // part of the day spent at home (fractions of 24h): before leaving / after landing
      const leaveDate = (trip.leave || trip.depStamp).slice(0, 10);
      const homeUntil = departing ? (leaveDate === date ? dayFrac((trip.leave || trip.depStamp).slice(11)) : 0) : 0;
      const homeFrom = returning && trip.returnStamp ? dayFrac(trip.returnStamp.slice(11)) : 1;
      if (departing || returning) info.home = { until: homeUntil, from: homeFrom };
      if (departing) {
        info.kind = 'depart';
        info.label = trip.main;
        info.sub = trip.leave ? `Çıkış ${trip.leave.slice(11)}` : `Kalkış ${trip.first.dep}`;
        if (returning) info.sub += ` · İniş ${trip.last.arr}`;
      } else if (returning) {
        info.kind = 'return';
        info.label = 'Dönüş';
        info.sub = `İniş ${trip.last.arr}`;
      } else {
        info.kind = 'away';
        // where is he today? last leg that arrived on/before this day
        const arrived = trip.legs.filter((l) => l.arrDate <= date).pop();
        const loc = arrived?.to || trip.main;
        const flying = trip.legs.some((l) => l.depDate === date);
        info.label = loc;
        // what the family wants to see at a glance: when does he land in Türkiye?
        info.sub = trip.returnStamp ? `↩ ${WEEKDAY.format(new Date(trip.returnStamp.slice(0, 10) + 'T12:00:00Z'))} ${trip.returnStamp.slice(11)}` : (flying ? 'Uçuş var' : '');
      }
    } else if (other) {
      const ci = codeInfo(other.type);
      info.kind = ci.kind;
      info.label = ci.label;
      info.duty = other;
      if (ci.kind === 'standby' && other.code) info.sub = `${other.code.dep}–${other.code.arr}`;
    } else {
      const code = roster.dayCodes?.[day];
      if (code === 'GG') { info.kind = 'prev'; info.label = 'Görev'; info.sub = 'Önceki aydan'; }
      else {
        const rest = T.find((t) => t.restUntil && t.last.arrDate < date && date <= t.restUntil.slice(0, 10));
        if (rest) { info.kind = 'rest'; info.label = 'Evde'; info.sub = 'dinlenme'; info.restOf = rest; }
      }
    }
    // early-morning flight: leaving home the evening before
    const nightLeave = T.find((t) => t.leave && t.leave.slice(0, 10) === date && t.first.depDate !== date);
    if (nightLeave) {
      info.nightLeave = nightLeave;
      info.sub = `Gece ${nightLeave.leave.slice(11)} çıkış`;
      info.home = { until: dayFrac(nightLeave.leave.slice(11)), from: 1 };
      if (!info.trip) info.trip = nightLeave;
    }
    out.push(info);
  }
  return out;
}

const DAY_FMT = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
const SHORT_FMT = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDay = (isoDate) => DAY_FMT.format(new Date(isoDate + 'T12:00:00Z'));
export const fmtShort = (isoDate) => SHORT_FMT.format(new Date(isoDate + 'T12:00:00Z'));
export const nextDay = addDays;

export function relative(target, now = new Date()) {
  const ms = target - now;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const d = Math.floor(h / 24);
  const m = Math.floor((abs % 3600000) / 60000);
  const txt = d >= 1 ? `${d} gün ${h % 24} saat` : h >= 1 ? `${h} sa ${m} dk` : `${m} dk`;
  return ms >= 0 ? `${txt} sonra` : `${txt} önce`;
}

/** Human-friendly person name: AYSE NUR YILMAZ -> Ayşe Nur Yılmaz (Turkish dotted İ heuristic) */
export function niceName(s = '') {
  return s.split(/\s+/).filter(Boolean).map((w) => {
    const low = w.toLowerCase();
    return low.charAt(0).toLocaleUpperCase('tr-TR') + low.slice(1);
  }).join(' ');
}

// ---------- iCalendar export ----------
const icsStamp = (stamp) => istDate(stamp).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);

export function toICS(rosters, settings) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UcusPlani//TR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Uçuş Planı'];
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  for (const r of rosters) {
    for (const t of trips(r, settings)) {
      const start = t.leave || t.depStamp;
      const end = t.returnStamp || `${t.last.arrDate}T${t.last.arr}`;
      const desc = [
        t.leave ? `Evden çıkış: ${t.leave.slice(11)}` : null,
        `Mesai başı: ${t.reportStamp.slice(11)}`,
        ...t.legs.map((l) => `${l.flight} ${l.from} ${l.dep} → ${l.to} ${l.arr} (${l.depDate.slice(8)}.${l.depDate.slice(5, 7)}, yerel saat)`),
        ...t.layovers.map((y) => `Konaklama ${city(y.station)}: ${y.hotel?.name || '-'} ${y.hotel?.phone || ''}`),
      ].filter(Boolean).join('\n');
      L.push('BEGIN:VEVENT', `UID:${r.period.key}-${t.depStamp}-${t.first.flight}@ucusplani`, `DTSTAMP:${now}`,
        `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
        `SUMMARY:${esc(`✈ ${t.title} (${t.first.flight})`)}`, `DESCRIPTION:${esc(desc)}`);
      if (t.leave) L.push('BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${esc('1 saat sonra evden çıkış')}`, 'END:VALARM');
      L.push('END:VEVENT');
    }
    for (const d of r.duties.filter((x) => x.type === 'HSBY' || x.type === 'SBY')) {
      L.push('BEGIN:VEVENT', `UID:${r.period.key}-${d.start}-sby@ucusplani`, `DTSTAMP:${now}`,
        `DTSTART:${icsStamp(d.start)}`, `DTEND:${icsStamp(d.end)}`, 'SUMMARY:Ev nöbeti', 'END:VEVENT');
    }
  }
  L.push('END:VCALENDAR');
  // fold long lines (RFC 5545: 75 octets) – approximate by characters
  return L.flatMap((line) => {
    const parts = [];
    for (let i = 0; i < line.length; i += 70) parts.push((i ? ' ' : '') + line.slice(i, i + 70));
    return parts;
  }).join('\r\n');
}

// ---------- statistics ----------
export const hmToMin = (s) => { if (!s) return 0; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const fmtDur = (min, { days = false } = {}) => {
  min = Math.round(min);
  if (days && min >= 1440) {
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60);
    return h ? `${d} gün ${h} sa` : `${d} gün`;
  }
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} sa ${m} dk` : `${h} sa`) : `${m} dk`;
};
export const fmtHM = (min) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;

const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Everything the statistics screen shows for one roster month. */
export function monthStats(roster, settings) {
  const { year, month } = roster.period;
  const pad = (n) => String(n).padStart(2, '0');
  const m0 = istDate(`${year}-${pad(month)}-01T00:00`).getTime();
  const m1 = istDate(`${month === 12 ? year + 1 : year}-${pad(month === 12 ? 1 : month + 1)}-01T00:00`).getTime();
  const monthMin = (m1 - m0) / 60000;
  const T = trips(roster, settings);
  const mins = (a, b) => overlap(a, b, m0, m1) / 60000;

  let abroadMin = 0, awayFromHomeMin = 0, postRestMin = 0, layoverMin = 0, nights = 0;
  const dest = new Map(); // station -> { visits, layoverMin, flights }
  for (const t of T) {
    const dep = istDate(t.depStamp).getTime();
    const ret = t.returnStamp ? istDate(t.returnStamp).getTime() : null;
    if (!ret) continue;
    abroadMin += mins(dep, ret);
    awayFromHomeMin += mins(istDate(t.leave || t.depStamp).getTime(), ret);
    if (t.restUntil) postRestMin += mins(ret, istDate(t.restUntil).getTime());
    // a night counts as "away" when 03:00 Türkiye time falls inside the trip
    for (let n = istDate(t.depStamp.slice(0, 10) + 'T03:00').getTime(); n < ret; n += 86400000) {
      if (n > dep && n >= m0 && n < m1) nights++;
    }
    for (const y of t.layovers) {
      layoverMin += hmToMin(y.rest);
      const e = dest.get(y.station) || { code: y.station, visits: 0, layoverMin: 0, transit: false };
      e.visits++; e.layoverMin += hmToMin(y.rest);
      dest.set(y.station, e);
    }
    for (const l of t.legs) {
      if (l.to === HOME || dest.has(l.to)) continue;
      dest.set(l.to, { code: l.to, visits: 1, layoverMin: 0, transit: true });
    }
  }
  const legs = T.flatMap((t) => t.legs);
  const standby = roster.duties.filter((d) => ['HSBY', 'SBY', 'CFR'].includes(d.type));
  const standbyMin = standby.reduce((s, d) => s + (istDate(d.end) - istDate(d.start)) / 60000, 0);

  const DAY_GROUPS = [
    { key: 'duty', label: 'Uçuş / yurt dışı', kinds: ['depart', 'away', 'return', 'prev'] },
    { key: 'standby', label: 'Nöbet / bekleme', kinds: ['standby'] },
    { key: 'off', label: 'İzin', kinds: ['off'] },
    { key: 'rest', label: 'Dinlenme', kinds: ['rest'] },
    { key: 'free', label: 'Boş (evde)', kinds: ['free'] },
  ];
  const days = buildDays(roster, settings);
  const dayGroups = DAY_GROUPS.map((g) => ({ ...g, count: days.filter((d) => g.kinds.includes(d.kind)).length }));

  const lim = (name) => {
    const vals = roster.duties.flatMap((d) => d.limits || []).filter((l) => l.name === name);
    if (!vals.length) return null;
    const top = vals.reduce((a, b) => (hmToMin(b.v) > hmToMin(a.v) ? b : a));
    return { v: hmToMin(top.v), max: hmToMin(top.max) };
  };
  const tot = roster.totals || {};
  const yearly = (k) => (tot[k] ? { v: hmToMin(tot[k].v), max: hmToMin(tot[k].max) } : null);

  const flightMin = T.reduce((s, t) => s + hmToMin(t.flightTime), 0) || hmToMin(tot.monthFlight);
  return {
    key: roster.period.key,
    monthMin,
    flightMin,
    dutyMin: roster.duties.reduce((s, d) => s + hmToMin(d.dutyTime), 0),
    tripCount: T.length,
    legCount: legs.length,
    abroadMin, homeMin: monthMin - abroadMin, awayFromHomeMin,
    nights, layoverMin, postRestMin, standbyMin, standbyCount: standby.length,
    dayGroups, totalDays: days.length,
    destinations: [...dest.values()].sort((a, b) => b.layoverMin - a.layoverMin || b.visits - a.visits),
    trips: T,
    limits: [
      { label: '28 günlük uçuş', ...lim('B28') },
      { label: '28 günlük görev', ...lim('D28') },
      { label: 'Bu yıl uçuş', ...yearly('B1Y') },
      { label: 'Son 12 ay uçuş', ...yearly('B12M') },
      { label: 'Bu yıl görev', ...yearly('D1Y') },
    ].filter((l) => l.max),
  };
}

/** Statistics over every loaded month (each trip counted once, in the month it starts). */
export function yearStats(rosters, settings) {
  const list = [...rosters].sort((a, b) => (a.period.key < b.period.key ? -1 : 1));
  const months = list.map((r) => monthStats(r, settings));
  const sum = (f) => months.reduce((a, m) => a + f(m), 0);
  const seen = new Set();
  const T = [];
  for (const r of list) {
    for (const t of trips(r, settings)) {
      if (seen.has(t.key)) continue;
      seen.add(t.key);
      T.push({ ...t, me: r.person?.name || '' });
    }
  }
  // destinations: how many trips stayed there + total hotel time
  const dest = new Map();
  for (const t of T) {
    const here = new Set();
    for (const y of t.layovers) {
      const e = dest.get(y.station) || { code: y.station, visits: 0, layoverMin: 0, transit: 0 };
      if (!here.has(y.station)) e.visits++;
      here.add(y.station);
      e.layoverMin += hmToMin(y.rest);
      dest.set(y.station, e);
    }
    for (const l of t.legs) {
      if (l.to === HOME || here.has(l.to)) continue;
      here.add(l.to);
      const e = dest.get(l.to) || { code: l.to, visits: 0, layoverMin: 0, transit: 0 };
      e.transit++;
      dest.set(l.to, e);
    }
  }
  const legs = T.flatMap((t) => t.legs);
  const flown = legs.filter((l) => !l.pos);
  // crew he flew with most (his own name left out)
  const crew = new Map();
  for (const t of T) {
    const me = t.me.toUpperCase();
    for (const c of new Set(t.crew || [])) {
      const name = c.replace(/\s*\(\w+\)$/, '').trim();
      if (!name || name.toUpperCase() === me) continue;
      crew.set(name, (crew.get(name) || 0) + 1);
    }
  }
  // weekends at home
  let weekendDays = 0, weekendHome = 0;
  for (const r of list) {
    for (const d of buildDays(r, settings)) {
      const wd = new Date(d.date + 'T12:00:00Z').getUTCDay();
      if (wd !== 0 && wd !== 6) continue;
      weekendDays++;
      if (!['depart', 'away', 'return', 'prev'].includes(d.kind)) weekendHome++;
    }
  }
  const tripLen = (t) => (t.returnStamp ? istDate(t.returnStamp) - istDate(t.depStamp) : 0) / 60000;
  const longest = T.reduce((a, t) => (tripLen(t) > tripLen(a || t) ? t : a || t), null);
  const ground = list.flatMap((r) => r.duties).filter((d) => d.type !== 'trip' && codeInfo(d.type).ground);
  const byFlight = [...months].sort((a, b) => b.flightMin - a.flightMin);
  return {
    months,
    from: list[0]?.period.key, to: list[list.length - 1]?.period.key,
    flightMin: sum((m) => m.flightMin),
    dutyMin: sum((m) => m.dutyMin),
    abroadMin: sum((m) => m.abroadMin),
    monthMin: sum((m) => m.monthMin),
    layoverMin: sum((m) => m.layoverMin),
    postRestMin: sum((m) => m.postRestMin),
    nights: sum((m) => m.nights),
    offDays: sum((m) => m.dayGroups.find((g) => g.key === 'off').count),
    standbyCount: sum((m) => m.standbyCount),
    tripCount: T.length,
    legCount: flown.length,
    posCount: legs.length - flown.length,
    nightDeps: flown.filter((l) => l.from === HOME && l.dep < '06:00').length,
    groundCount: ground.length,
    simCount: ground.filter((d) => /^SR\d/.test(d.type)).length,
    destinations: [...dest.values()].sort((a, b) => b.visits - a.visits || b.layoverMin - a.layoverMin || b.transit - a.transit),
    crew: [...crew].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 5),
    weekendDays, weekendHome,
    longest: longest && tripLen(longest) ? { title: longest.title, min: tripLen(longest), depStamp: longest.depStamp } : null,
    busiest: byFlight[0], quietest: byFlight[byFlight.length - 1],
  };
}
