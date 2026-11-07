// THY "EKIP PLANLAMA SISTEMI - AYLIK UCUS PROGRAMI" (CARMEN) roster parser.
// Runs fully in the browser (or Node for tests). pdfjs is injected so the same
// code works in both places. Personal documents (passport etc.) are never read.

const MONTHS = {
  OCA: 1, SUB: 2, MAR: 3, NIS: 4, MAY: 5, HAZ: 6, TEM: 7, AGU: 8, EYL: 9, EKI: 10, KAS: 11, ARA: 12,
  JAN: 1, FEB: 2, APR: 4, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const pad = (n) => String(n).padStart(2, '0');
const hm = (t) => { const [h, m] = t.split(':'); return `${pad(+h)}:${m}`; };
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const addDays = (isoDate, n) => {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// "local wall-clock" stamp; comparisons are only done between same-station times
const stamp = (date, time) => `${date}T${hm(time)}`;

async function readItems(pdfjs, data) {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = [];
    for (const it of tc.items) {
      const s = it.str.replace(/\s+/g, ' ').trim();
      if (!s) continue;
      const t = pdfjs.Util.transform(vp.transform, it.transform);
      items.push({ s, x: t[4], y: t[5] });
    }
    pages.push(items);
  }
  return pages;
}

function toLines(items, tol = 3) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= tol) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines;
}
const lineText = (items) => items.map((i) => i.s).join(' ');

export async function parseRoster(pdfjs, data) {
  const pages = await readItems(pdfjs, data);
  const all = pages.flat().map((i) => i.s).join(' ');
  if (!/AYLIK UCUS PROGRAMI/.test(all)) {
    throw new Error('Bu dosya THY aylık uçuş programına benzemiyor.');
  }

  // ---- period & year ----
  const per = all.match(/Period:\s*(\d{2})([A-Z]{3})\s*-\s*(\d{2})([A-Z]{3})/);
  if (!per) throw new Error('Program dönemi (Period) bulunamadı.');
  const pMonth = MONTHS[per[2]];
  const printed = all.match(/Printed\s+(\d{2})([A-Z]{3})(\d{4})/);
  let pYear = printed ? +printed[3] : new Date().getFullYear();
  if (printed && pMonth < MONTHS[printed[2]] - 6) pYear += 1;
  const yearFor = (mon) => {
    if (mon - pMonth > 6) return pYear - 1;
    if (pMonth - mon > 6) return pYear + 1;
    return pYear;
  };
  const dateOf = (dd, mmm) => { const m = MONTHS[mmm]; return iso(yearFor(m), m, +dd); };
  const daysInMonth = new Date(Date.UTC(pYear, pMonth, 0)).getUTCDate();
  const period = { year: pYear, month: pMonth, key: `${pYear}-${pad(pMonth)}`, days: daysInMonth };

  // ---- page 1 grid: name + day codes ----
  const p1 = toLines(pages[0]);
  const person = {};
  const dayCodes = {};
  const hdrIdx = p1.findIndex((l) => l.items.filter((i) => /^\d{2}$/.test(i.s)).length >= 20);
  if (hdrIdx >= 0) {
    const cols = p1[hdrIdx].items.filter((i) => /^\d{2}$/.test(i.s)).map((i) => ({ d: +i.s, x: i.x }));
    const firstX = cols[0].x;
    const nameParts = [];
    for (let k = hdrIdx; k < Math.min(p1.length, hdrIdx + 4); k++) {
      for (const it of p1[k].items) if (it.x < firstX - 40) nameParts.push(it.s);
    }
    // order on sheet: sicil, soyad, ad
    if (nameParts[0] && /^\d+$/.test(nameParts[0])) person.id = nameParts.shift();
    if (nameParts.length >= 2) person.name = `${nameParts[1]} ${nameParts[0]}`;
    else if (nameParts.length) person.name = nameParts[0];
    // code row = first line after weekday row whose right side has codes
    for (let k = hdrIdx + 2; k < Math.min(p1.length, hdrIdx + 4); k++) {
      const codes = p1[k].items.filter((i) => i.x >= firstX - 15 && /^[A-Z]{1,5}$/.test(i.s));
      if (!codes.length) continue;
      for (const c of codes) {
        let best = cols[0];
        for (const col of cols) if (Math.abs(col.x - c.x) < Math.abs(best.x - c.x)) best = col;
        dayCodes[best.d] = c.s;
      }
      break;
    }
    const meta = all.match(/Uc Tr\/Fl\/Snf:\s*([A-Z0-9/]+)/);
    if (meta) {
      const [, fleet, rank] = meta[1].split('/');
      person.fleet = fleet; person.rank = rank;
    }
  }

  // ---- hotels table ----
  const hotels = {};
  for (const items of pages) {
    const otel = items.find((i) => i.s === 'Otel');
    const tel = items.find((i) => i.s === 'Telefon');
    const mes = items.find((i) => /^Mesafe/.test(i.s));
    const yati = items.find((i) => /^Yati/.test(i.s) && otel && Math.abs(i.y - otel.y) < 12);
    if (!otel || !tel || !yati) continue;
    const stations = items
      .filter((i) => Math.abs(i.x - yati.x) < 6 && /^[A-Z]{3}$/.test(i.s) && i.y > otel.y + 5)
      .sort((a, b) => a.y - b.y);
    const keep = [];
    for (const st of stations) {
      if (keep.length && st.y - keep[keep.length - 1].y > 40) break;
      keep.push(st);
    }
    if (!keep.length) continue;
    const maxY = keep[keep.length - 1].y + 12;
    const right = mes ? mes.x + 50 : tel.x + 150;
    for (const st of keep) hotels[st.s] = { name: [], phone: [], distance: '' };
    for (const it of items) {
      if (it.y <= otel.y + 5 || it.y > maxY || it.x < otel.x - 5 || it.x > right) continue;
      let near = keep[0];
      for (const st of keep) if (Math.abs(st.y - it.y) < Math.abs(near.y - it.y)) near = st;
      const h = hotels[near.s];
      if (mes && it.x >= mes.x - 5) h.distance = it.s;
      else if (it.x >= tel.x - 5) h.phone.push(it.s);
      else h.name.push(it.s);
    }
    for (const k of Object.keys(hotels)) {
      const h = hotels[k];
      const phone = h.phone.join(' ').trim();
      hotels[k] = {
        name: h.name.join(' ').trim(),
        phone: /^(None|STATION INFO)/i.test(phone) ? '' : phone,
        distance: h.distance,
      };
    }
    break;
  }

  // ---- local-time section ----
  // Each duty (sefer) is a visually separate block; split on vertical gaps.
  const blocks = [];
  let inLocal = false;
  for (const items of pages) {
    const ucusHdr = items.find((i) => i.s === 'Ucus');
    if (items.some((i) => /^LOKAL SAATLI UCUS PROGRAMI$/.test(i.s))) inLocal = true;
    if (!inLocal || !ucusHdr) continue;
    const kokHdr = items.find((i) => i.s === 'Kokpit');
    const colX = ucusHdr.x - 12;
    const lines = toLines(items.filter((i) => i.y > ucusHdr.y + 6 && !/^Printed|^\d+ \( \d+\)$/.test(i.s)));
    const endIdx = lines.findIndex((l) => l.items.some((i) => i.s === 'ACIKLAMALAR'));
    const body = (endIdx >= 0 ? lines.slice(0, endIdx) : lines)
      .filter((l) => !/Onceki ayda baslayan/.test(lineText(l.items)));
    let block = null, prevY = -1e9, lastFlight = null;
    for (const l of body) {
      if (!block || l.y - prevY > 15) { block = { ev: [], crew: [] }; blocks.push(block); lastFlight = null; }
      prevY = l.y;
      const left = lineText(l.items.filter((i) => i.x < colX));
      const right = lineText(l.items.filter((i) => i.x >= colX));
      for (const m of left.matchAll(/\b(MB|MS|DSB|GMB|GMS):\s*(\d{2})([A-Z]{3})\s+(\d{1,2}:\d{2})/g)) {
        block.ev.push({ k: m[1], at: stamp(dateOf(m[2], m[3]), m[4]), y: l.y });
      }
      for (const m of left.matchAll(/YI\/YDS:\s*([A-Z]{3})\/(\d+:\d{2})/g)) {
        block.ev.push({ k: 'YI', station: m[1], rest: m[2] });
      }
      const us = left.match(/(?:^|\s)US:\s*(\d+:\d{2})/);
      if (us) block.ev.push({ k: 'US', v: us[1] });
      const gs = left.match(/GS\/MDS:\s*(\d+:\d{2})\/(\d+:\d{2})/);
      if (gs) block.ev.push({ k: 'GS', v: gs[1] });
      // rolling legal limits shown next to each duty: "D28: 77:31 / 190:00"
      for (const m of left.matchAll(/\b(D7|D14|D28|B28)\s*:\s*(\d+:\d{2})\s*\/\s*(\d+:\d{2})/g)) {
        block.ev.push({ k: 'LIM', name: m[1], v: m[2], max: m[3] });
      }
      if (!right) continue;
      const f = right.match(/^([A-Z]{2}\d{1,4}[A-Z]?|[A-Z]{2,6})\s+(?:([A-Z]{3})\/)?(\d{1,2}:\d{2})\s+(?:([A-Z]{3})\/)?(\d{1,2}:\d{2})\s*(.*)$/);
      if (f) {
        lastFlight = {
          k: /^[A-Z]{2}\d/.test(f[1]) ? 'FLT' : 'CODE', code: f[1], from: f[2] || null, dep: hm(f[3]),
          to: f[4] || null, arr: hm(f[5]),
        };
        block.ev.push(lastFlight);
        if (f[6]) block.crew.push(f[6]);
      } else if (kokHdr && l.items.filter((i) => i.x >= colX).every((i) => i.x >= kokHdr.x - 40)) {
        block.crew.push(right); // crew names wrapped onto their own line
      }
    }
  }
  // a block without MB is a continuation (e.g. split by page break) -> merge into previous
  const merged = [];
  for (const b of blocks) {
    if (!b.ev.length) continue;
    if (!b.ev.some((e) => e.k === 'MB') && merged.length) {
      merged[merged.length - 1].ev.push(...b.ev);
      merged[merged.length - 1].crew.push(...b.crew);
    }
    else merged.push(b);
  }
  const duties = merged.map((b) => {
    const of = (k) => b.ev.filter((e) => e.k === k);
    const gmb = of('GMB').sort((x, y) => x.y - y.y), gms = of('GMS').sort((x, y) => x.y - y.y);
    return {
      start: of('MB')[0]?.at, end: of('MS')[0]?.at || null, restUntil: of('DSB')[0]?.at || null,
      periods: gmb.map((g, i) => ({ start: g.at, end: gms[i]?.at || null })),
      items: b.ev.filter((e) => e.k === 'FLT' || e.k === 'CODE'),
      layovers: of('YI'),
      flightTime: of('US')[0]?.v || null,
      dutyTime: of('GS')[0]?.v || null,
      limits: of('LIM').map(({ name, v, max }) => ({ name, v, max })),
      crew: b.crew.join(' ').replace(/(^|\s)-(?=\s|$)/g, ' ').split(/,/).map((c) => c.trim()).filter((c) => /\(\w+\)$/.test(c)),
    };
  }).filter((d) => d.start);

  // ---- date each flight leg ----
  for (const d of duties) {
    d.periods.sort((a, b) => (a.start < b.start ? -1 : 1));
    const flights = d.items.filter((x) => x.k === 'FLT');
    const codes = d.items.filter((x) => x.k === 'CODE');
    d.type = flights.length ? 'trip' : (codes[0]?.code || 'DUTY');
    d.code = codes[0] || null;
    let pIdx = 0;
    let cursor = d.periods[0]?.start || d.start;
    const nextAt = (from, time) => {
      let date = from.slice(0, 10);
      if (stamp(date, time) < from) date = addDays(date, 1);
      return date;
    };
    d.legs = flights.map((f, i) => {
      if (i > 0) {
        const cand = stamp(nextAt(cursor, f.dep), f.dep);
        const curEnd = d.periods[pIdx]?.end;
        if (curEnd && cand > curEnd && d.periods[pIdx + 1]) {
          pIdx += 1;
          cursor = d.periods[pIdx].start;
        }
      }
      const depDate = nextAt(cursor, f.dep);
      const depS = stamp(depDate, f.dep);
      const arrDate = nextAt(depS, f.arr);
      cursor = stamp(arrDate, f.arr);
      return {
        flight: f.code, from: f.from, to: f.to,
        depDate, dep: f.dep, arrDate, arr: f.arr,
        dutyIndex: pIdx,
      };
    });
    delete d.items;
    d.layovers = d.layovers.map((l) => ({ station: l.station, rest: l.rest, hotel: hotels[l.station] || null }));
    d.report = d.periods[0]?.start || d.start;
  }

  // ---- totals printed on the sheet ----
  const totals = {};
  const mf = all.match(/Uc Sr\/Lmt U:\s*(\d+:\d{2})/);
  if (mf) totals.monthFlight = mf[1];
  for (const m of all.matchAll(/\b(D1Y|B1Y|B12M)\s+(\d+:\d{2})\s+(\d+:\d{2})/g)) {
    totals[m[1]] = { v: m[2], max: m[3] };
  }

  return {
    version: 2,
    period, person, dayCodes, hotels, totals,
    duties: duties.sort((a, b) => (a.start < b.start ? -1 : 1)),
    hasPrevMonthDuty: /Onceki ayda baslayan goreviniz/.test(all),
    importedAt: new Date().toISOString(),
  };
}
