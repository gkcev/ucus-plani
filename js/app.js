import { parseRoster } from './parser.js';
import { city } from './stations.js';
import { driveTime, currentPosition } from './traffic.js';
import {
  buildDays, trips, istDate, fmtDay, fmtShort, relative, niceName, toICS, codeInfo, HOME, yearStats,
  monthStats, fmtDur, fmtHM, DRIVE_BUFFER_MIN,
} from './model.js';

// ---------- storage ----------
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { toast('Kaydedilemedi (depolama kapalı olabilir).'); } },
};
let rosters = store.get('rosters', {});
let settings = { leaveMin: 190, ...store.get('settings', {}) };
delete settings.leaveHours; // old setting (hours) replaced by leaveMin
const APP_VERSION = 22;
let viewKey = null;
let view = store.get('view', 'cal');
let statScope = store.get('statScope', 'month');

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTH_FMT = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const monthName = (key) => MONTH_FMT.format(new Date(key + '-15T12:00:00Z'));
const keys = () => Object.keys(rosters).sort();
const minLabel = (m) => (m % 60 ? `${Math.floor(m / 60)} sa ${m % 60} dk` : `${m / 60} saat`);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- PDF import ----------
let pdfjs = null;
async function loadPdf() {
  if (!pdfjs) {
    pdfjs = await import('../vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
  }
  return pdfjs;
}

async function importFiles(files) {
  files = [...files].filter(Boolean);
  if (!files.length) return;
  showLoading(files.length > 1 ? `${files.length} PDF okunuyor…` : 'PDF okunuyor…');
  const ok = [], bad = [];
  try {
    const lib = await loadPdf();
    for (const file of files) {
      try {
        const roster = await parseRoster(lib, new Uint8Array(await file.arrayBuffer()));
        saveRoster(roster, false);
        ok.push(roster.period.key);
      } catch (e) {
        console.error(e);
        bad.push(files.length > 1 ? `${file.name}: ${e.message || 'okunamadı'}` : (e.message || 'PDF okunamadı'));
      }
    }
    if (ok.length) {
      store.set('rosters', rosters);
      viewKey = ok.length === 1 ? ok[0] : (rosters[new Date().toISOString().slice(0, 7)] ? new Date().toISOString().slice(0, 7) : ok.sort().pop());
    }
    toast([ok.length === 1 ? `${monthName(ok[0])} programı eklendi` : ok.length ? `${ok.length} ay eklendi` : '', ...bad].filter(Boolean).join(' · '));
  } catch (e) {
    console.error(e);
    toast(e.message || 'PDF okunamadı');
  } finally {
    hideLoading();
    render();
  }
}

function saveRoster(roster, persist = true) {
  rosters[roster.period.key] = roster;
  if (persist) store.set('rosters', rosters);
  viewKey = roster.period.key;
}

function showLoading(msg) {
  let el = $('#loading');
  if (!el) { el = document.createElement('div'); el.id = 'loading'; el.className = 'loading'; $('#app').prepend(el); }
  el.textContent = msg;
  $('#empty').hidden = true;
  $('#main').hidden = true;
}
function hideLoading() { $('#loading')?.remove(); }

document.addEventListener('change', (e) => {
  if (e.target.matches('.file-input')) {
    importFiles(e.target.files);
    e.target.value = '';
    closeSheet();
  }
});

// ---------- share via link (data lives only in the #hash, never sent to a server) ----------
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
async function makeShareLink(roster) {
  const json = new TextEncoder().encode(JSON.stringify(roster));
  const packed = await pipe(json, new CompressionStream('deflate-raw'));
  const base = location.href.split('#')[0];
  return `${base}#p=${b64url(packed)}`;
}
async function readShareHash(src = location.hash) {
  const m = String(src).match(/#p=([\w-]+)/);
  if (!m) return null;
  try {
    const raw = await pipe(fromB64url(m[1]), new DecompressionStream('deflate-raw'));
    const data = JSON.parse(new TextDecoder().decode(raw));
    const list = Array.isArray(data) ? data : [data];
    if (!list.length || list.some((r) => !r?.period?.key || !Array.isArray(r.duties))) throw new Error('bad');
    return list;
  } catch {
    toast('Paylaşım linki okunamadı');
    return null;
  }
}

// ---------- rendering ----------
function render() {
  const ks = keys();
  if (!ks.length) {
    $('#empty').hidden = false;
    $('#main').hidden = true;
    $('#who').textContent = 'Aylık program';
    return;
  }
  $('#empty').hidden = true;
  $('#main').hidden = false;
  if (!viewKey || !rosters[viewKey]) {
    const nowKey = new Date().toISOString().slice(0, 7);
    viewKey = rosters[nowKey] ? nowKey : ks[ks.length - 1];
  }
  const r = rosters[viewKey];
  const p = r.person || {};
  $('#who').textContent = [niceName(p.name), p.fleet && `B${p.fleet}`, p.rank].filter(Boolean).join(' · ');
  renderHero();
  renderMonth(r);
  renderTrips(r);
  for (const t of document.querySelectorAll('.tab')) {
    const on = t.dataset.view === view;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on);
  }
  $('#viewCal').hidden = view !== 'cal';
  $('#viewStats').hidden = view !== 'stats';
  if (view === 'stats') renderStats(r);
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (!t) return;
  view = t.dataset.view;
  store.set('view', view);
  render();
});

// ---------- Google Maps route to the airport (current location -> IST, live traffic in Maps) ----------
const MAPS_URL = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('İstanbul Havalimanı') + '&travelmode=driving';
const mapsLink = (cls = 'maps-btn') => `<a class="${cls}" href="${MAPS_URL}" target="_blank" rel="noopener" data-maps>🚗 Trafiği gör (Google Maps)</a>`;

// ---------- statistics ----------
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const SHORT_MONTH = new Intl.DateTimeFormat('tr-TR', { month: 'short' });

const scopeBar = (n) => (n > 1 ? `<div class="seg" role="tablist">
  <button role="tab" data-scope="month" class="${statScope === 'month' ? 'on' : ''}" aria-selected="${statScope === 'month'}">Bu ay</button>
  <button role="tab" data-scope="all" class="${statScope === 'all' ? 'on' : ''}" aria-selected="${statScope === 'all'}">Tüm aylar (${n})</button>
</div>` : '');

function renderStats(r) {
  if (statScope === 'all' && keys().length > 1) return renderAllStats();
  const s = monthStats(r, settings);
  const homeDays = s.dayGroups.filter((g) => g.key !== 'duty').reduce((a, g) => a + g.count, 0);
  const dutyDays = s.dayGroups.find((g) => g.key === 'duty').count;
  const maxLay = Math.max(1, ...s.destinations.map((d) => d.layoverMin));

  const all = keys().map((k) => monthStats(rosters[k], settings));
  const maxFlight = Math.max(1, ...all.map((m) => m.flightMin));

  $('#viewStats').innerHTML = `${scopeBar(keys().length)}
    ${(r.version || 1) < 2 ? `<div class="banner"><span>Bu ay eski sürümle yüklendi; saat bilgileri eksik olabilir. Aynı PDF'i tekrar yükle.</span>
      <label class="btn">PDF seç<input type="file" accept="application/pdf,.pdf" class="file-input" multiple hidden></label></div>` : ''}
    <div class="kpis">
      <div class="kpi"><small>Uçuş saati</small><b>${fmtHM(s.flightMin)}</b><span>${s.legCount} uçuş · ${s.tripCount} sefer</span></div>
      <div class="kpi"><small>Görev saati</small><b>${fmtHM(s.dutyMin)}</b><span>nöbet dahil</span></div>
      <div class="kpi"><small>Yurt dışında</small><b>${esc(fmtDur(s.abroadMin, { days: true }))}</b><span>${s.nights} gece evden uzak</span></div>
      <div class="kpi"><small>Türkiye'de</small><b>${esc(fmtDur(s.homeMin, { days: true }))}</b><span>ayın %${pct(s.homeMin, s.monthMin)}'i</span></div>
    </div>

    <div class="card">
      <h3>Zaman: yurt dışı / Türkiye</h3>
      <div class="split" role="img" aria-label="Yurt dışında yüzde ${pct(s.abroadMin, s.monthMin)}, Türkiye'de yüzde ${pct(s.homeMin, s.monthMin)}">
        <i style="width:${pct(s.abroadMin, s.monthMin)}%;background:var(--s1)" title="Yurt dışında: ${esc(fmtDur(s.abroadMin))}"></i>
        <i class="track" style="flex:1" title="Türkiye'de: ${esc(fmtDur(s.homeMin))}"></i>
      </div>
      <div class="lgd">
        <div><i style="background:var(--s1)"></i><span>Yurt dışında <small class="muted">(kalkış → İstanbul'a iniş)</small></span><b>${esc(fmtDur(s.abroadMin, { days: true }))}<span class="pct">%${pct(s.abroadMin, s.monthMin)}</span></b></div>
        <div><i style="background:var(--track)"></i><span>Türkiye'de</span><b>${esc(fmtDur(s.homeMin, { days: true }))}<span class="pct">%${pct(s.homeMin, s.monthMin)}</span></b></div>
      </div>
    </div>

    <div class="card">
      <h3>Günler (${s.totalDays} gün)</h3>
      <div class="split" role="img" aria-label="${s.dayGroups.map((g) => `${g.label} ${g.count} gün`).join(', ')}">
        ${s.dayGroups.filter((g) => g.count).map((g, i) => `<i style="flex:${g.count};background:var(--s${s.dayGroups.indexOf(g) + 1})" title="${esc(g.label)}: ${g.count} gün"></i>`).join('')}
      </div>
      <div class="lgd">
        ${s.dayGroups.map((g, i) => `<div><i style="background:var(--s${i + 1})"></i><span>${esc(g.label)}</span><b>${g.count} gün</b></div>`).join('')}
      </div>
      <p class="footnote" style="margin:10px 0 0">Evde geçen gün: <b>${homeDays}</b> · Görevde: <b>${dutyDays}</b> (gidiş ve dönüş günleri dahil)</p>
    </div>

    <div class="card">
      <h3>Nerelere uçtu</h3>
      ${s.destinations.length ? s.destinations.map((d) => `
        <div class="dest">
          <span class="name">${esc(city(d.code))}<small>${esc(d.code)}${d.transit ? ' · aktarma' : ''}</small></span>
          <span class="val">${d.layoverMin ? `${esc(fmtDur(d.layoverMin))} otel` : 'konaklama yok'}</span>
          ${d.layoverMin ? `<span class="bar"><i style="width:${pct(d.layoverMin, maxLay)}%"></i></span>` : ''}
        </div>`).join('') : '<p class="muted">Bu ay uçuş yok.</p>'}
    </div>

    <div class="card">
      <h3>Dinlenme ve nöbet</h3>
      <dl class="kv">
        <dt>Uçuş sonrası dinlenme</dt><dd><b>${esc(fmtDur(s.postRestMin, { days: true }))}</b> <small class="muted">(evde)</small></dd>
        <dt>Yurt dışında otelde</dt><dd><b>${esc(fmtDur(s.layoverMin, { days: true }))}</b></dd>
        <dt>Nöbet / bekleme</dt><dd><b>${esc(fmtDur(s.standbyMin))}</b> <small class="muted">(${s.standbyCount} kez)</small></dd>
        <dt>Evden uzakta</dt><dd><b>${esc(fmtDur(s.awayFromHomeMin, { days: true }))}</b> <small class="muted">(evden çıkış → iniş)</small></dd>
      </dl>
    </div>

    ${s.limits.length ? `<div class="card">
      <h3>Yasal limitler</h3>
      ${s.limits.map((l) => {
        const p = pct(l.v, l.max);
        return `<div class="limit${p >= 90 ? ' warn' : ''}">
          <div class="top"><span>${esc(l.label)}</span><b>${fmtHM(l.v)} / ${fmtHM(l.max)}</b></div>
          <div class="meter" role="meter" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(l.label)} yüzde ${p}"><i style="width:${Math.min(100, p)}%"></i></div>
          ${p >= 90 ? `<div class="note">⚠️ Limitin %${p}'i dolu</div>` : ''}
        </div>`;
      }).join('')}
      <p class="footnote" style="margin:8px 0 0">28 günlük değerler ay içindeki en yüksek değerdir. Yıllık değerler PDF'in basıldığı tarihe göredir.</p>
    </div>` : ''}

    <div class="card">
      <h3>Aylara göre uçuş saati</h3>
      ${all.length > 1 ? `<div class="months">${all.map((m) => `
        <button class="col${m.key === viewKey ? ' cur' : ''}" data-month="${m.key}" title="${esc(monthName(m.key))}: ${fmtHM(m.flightMin)}">
          <span class="v">${fmtHM(m.flightMin)}</span>
          <i style="height:${Math.max(2, pct(m.flightMin, maxFlight))}%"></i>
          <span class="m">${esc(SHORT_MONTH.format(new Date(m.key + '-15T12:00:00Z')))}</span>
        </button>`).join('')}</div>` : '<p class="muted" style="margin:0 0 6px">Başka ayların PDF\'lerini yükledikçe burada karşılaştırma görünür.</p>'}
      <table class="mtable">
        <thead><tr><th>Ay</th><th>Uçuş</th><th>Yurt dışı</th><th>Gece</th><th>İzin</th></tr></thead>
        <tbody>${all.map((m) => `<tr><td>${esc(monthName(m.key))}</td><td>${fmtHM(m.flightMin)}</td><td>${esc(fmtDur(m.abroadMin, { days: true }))}</td><td>${m.nights}</td><td>${m.dayGroups.find((g) => g.key === 'off').count} gün</td></tr>`).join('')}
        ${all.length > 1 ? `<tr><td><b>Toplam</b></td><td><b>${fmtHM(all.reduce((a, m) => a + m.flightMin, 0))}</b></td><td><b>${esc(fmtDur(all.reduce((a, m) => a + m.abroadMin, 0), { days: true }))}</b></td><td><b>${all.reduce((a, m) => a + m.nights, 0)}</b></td><td><b>${all.reduce((a, m) => a + m.dayGroups.find((g) => g.key === 'off').count, 0)} gün</b></td></tr>` : ''}</tbody>
      </table>
    </div>`;
}

const shortMonth = (key) => `${SHORT_MONTH.format(new Date(key + '-15T12:00:00Z'))} ${key.slice(2, 4)}`;
const dayNum = (min) => `${(min / 1440).toFixed(1).replace('.', ',')} gün`;

function renderAllStats() {
  const y = yearStats(keys().map((k) => rosters[k]), settings);
  const stay = y.destinations.filter((d) => d.visits);
  const pass = y.destinations.filter((d) => !d.visits);
  const maxV = Math.max(1, ...stay.map((d) => d.visits));
  const maxFlight = Math.max(1, ...y.months.map((m) => m.flightMin));
  const range = `${monthName(y.from)} – ${monthName(y.to)}`;
  const avg = Math.round(y.flightMin / y.months.length);
  $('#viewStats').innerHTML = `${scopeBar(y.months.length)}
    <p class="muted" style="margin:0 0 10px">${esc(range)} · ${y.months.length} ay</p>
    <div class="kpis">
      <div class="kpi"><small>Uçuş saati</small><b>${fmtHM(y.flightMin)}</b><span>ayda ortalama ${fmtHM(avg)}</span></div>
      <div class="kpi"><small>Sefer</small><b>${y.tripCount}</b><span>${y.legCount} uçuş${y.posCount ? ` + ${y.posCount} yolcu olarak` : ''}</span></div>
      <div class="kpi"><small>Yurt dışında</small><b>${esc(fmtDur(y.abroadMin, { days: true }))}</b><span>zamanın %${pct(y.abroadMin, y.monthMin)}'i</span></div>
      <div class="kpi"><small>Evden uzak gece</small><b>${y.nights}</b><span>${y.months.length} ayda</span></div>
    </div>

    <div class="card">
      <h3>En çok gittiği şehirler</h3>
      ${stay.map((d) => `
        <div class="dest">
          <span class="name">${esc(city(d.code))}<small>${esc(d.code)}</small></span>
          <span class="val"><b>${d.visits} kez</b> · ${esc(fmtDur(d.layoverMin, { days: true }))} otel</span>
          <span class="bar"><i style="width:${pct(d.visits, maxV)}%"></i></span>
        </div>`).join('') || '<p class="muted">Konaklamalı uçuş yok.</p>'}
      ${pass.length ? `<p class="footnote" style="margin:12px 0 0">Konaklamadan uğradığı yerler: ${pass.map((d) => `<b>${esc(city(d.code))}</b>${d.transit > 1 ? ` (${d.transit})` : ''}`).join(', ')}</p>` : ''}
    </div>

    <div class="card">
      <h3>Öne çıkanlar</h3>
      <dl class="kv">
        ${y.busiest ? `<dt>En yoğun ay</dt><dd><b>${esc(monthName(y.busiest.key))}</b> <small class="muted">${fmtHM(y.busiest.flightMin)} uçuş</small></dd>` : ''}
        ${y.quietest && y.quietest !== y.busiest ? `<dt>En sakin ay</dt><dd><b>${esc(monthName(y.quietest.key))}</b> <small class="muted">${fmtHM(y.quietest.flightMin)} uçuş</small></dd>` : ''}
        ${y.longest ? `<dt>En uzun sefer</dt><dd><b>${esc(y.longest.title)}</b> <small class="muted">${esc(fmtDur(y.longest.min, { days: true }))} · ${esc(fmtShort(y.longest.depStamp.slice(0, 10)))}</small></dd>` : ''}
        <dt>Gece kalkışı</dt><dd><b>${y.nightDeps}</b> <small class="muted">İstanbul'dan 00:00–06:00 arası</small></dd>
        <dt>Hafta sonları</dt><dd><b>${y.weekendHome} / ${y.weekendDays}</b> <small class="muted">gün evde (%${pct(y.weekendHome, y.weekendDays)})</small></dd>
      </dl>
    </div>

    <div class="card">
      <h3>Dinlenme, izin, nöbet</h3>
      <dl class="kv">
        <dt>İzin günü</dt><dd><b>${y.offDays} gün</b></dd>
        <dt>Uçuş sonrası dinlenme</dt><dd><b>${esc(fmtDur(y.postRestMin, { days: true }))}</b></dd>
        <dt>Yurt dışında otelde</dt><dd><b>${esc(fmtDur(y.layoverMin, { days: true }))}</b></dd>
        <dt>Nöbet / CFR</dt><dd><b>${y.standbyCount} kez</b></dd>
        ${y.groundCount ? `<dt>Eğitim / simülatör</dt><dd><b>${y.groundCount} gün</b>${y.simCount ? ` <small class="muted">(${y.simCount} simülatör)</small>` : ''}</dd>` : ''}
      </dl>
    </div>

    ${y.crew.length && y.crew[0].n >= 3 ? `<div class="card">
      <h3>En çok birlikte uçtuğu</h3>
      <dl class="kv">${y.crew.map((c) => `<dt>${esc(niceName(c.name))}</dt><dd><b>${c.n} sefer</b></dd>`).join('')}</dl>
    </div>` : ''}

    <div class="card">
      <h3>Aylara göre uçuş saati</h3>
      <div class="months${y.months.length > 6 ? ' many' : ''}">${y.months.map((m) => `
        <button class="col" data-month="${m.key}" title="${esc(monthName(m.key))}: ${fmtHM(m.flightMin)}">
          <span class="v">${y.months.length > 6 ? Math.round(m.flightMin / 60) : fmtHM(m.flightMin)}</span>
          <i style="height:${Math.max(2, pct(m.flightMin, maxFlight))}%"></i>
          <span class="m">${esc(SHORT_MONTH.format(new Date(m.key + '-15T12:00:00Z')))}</span>
        </button>`).join('')}</div>
      ${y.months.length > 6 ? '<p class="footnote" style="margin:4px 0 0">Sütun üstündeki sayılar saat.</p>' : ''}
      <table class="mtable compact">
        <thead><tr><th>Ay</th><th>Uçuş</th><th>Yurt dışı</th><th>Gece</th><th>İzin</th></tr></thead>
        <tbody>${y.months.map((m) => `<tr><td>${esc(shortMonth(m.key))}</td><td>${fmtHM(m.flightMin)}</td><td>${dayNum(m.abroadMin)}</td><td>${m.nights}</td><td>${m.dayGroups.find((g) => g.key === 'off').count} gün</td></tr>`).join('')}
        <tr><td><b>Toplam</b></td><td><b>${fmtHM(y.flightMin)}</b></td><td><b>${dayNum(y.abroadMin)}</b></td><td><b>${y.nights}</b></td><td><b>${y.offDays} gün</b></td></tr></tbody>
      </table>
      <p class="footnote" style="margin:8px 0 0">Uçuş saati, pilot olarak uçtuğu süredir (PDF'teki US). Yolcu olarak gidilen (P) uçuşlar ve simülatör dahil değildir.</p>
    </div>`;
}

$('#viewStats').addEventListener('click', (e) => {
  const sc = e.target.closest('[data-scope]');
  if (sc) { statScope = sc.dataset.scope; store.set('statScope', statScope); render(); return; }
  const c = e.target.closest('[data-month]');
  if (c) { viewKey = c.dataset.month; statScope = 'month'; store.set('statScope', statScope); render(); }
});

function allTrips() {
  return keys().flatMap((k) => trips(rosters[k], settings).map((t) => ({ ...t, rosterKey: k })))
    .filter((t, i, a) => a.findIndex((x) => x.depStamp === t.depStamp && x.first.flight === t.first.flight) === i);
}

function setDrive(key, minutes, meta = { src: 'manual' }, quiet = false) {
  settings.drive = { ...(settings.drive || {}) };
  settings.driveMeta = { ...(settings.driveMeta || {}) };
  if (minutes) { settings.drive[key] = minutes; settings.driveMeta[key] = { ...meta, at: new Date().toISOString() }; }
  else { delete settings.drive[key]; delete settings.driveMeta[key]; }
  store.set('settings', settings);
  render();
  if (!quiet) toast(minutes ? `Yol ${minutes} dk ile hesaplandı` : 'Sabit kurala dönüldü');
}

// ---------- live traffic (Google Maps Routes API) ----------
delete settings.tomtomKey;
const trafficReady = () => !!(settings.googleKey && settings.home);
for (const [k, m] of Object.entries(settings.driveMeta || {})) {
  if (m?.mode === 'planned' && m.nowMin) {
    settings.drive[k] = m.nowMin;
    settings.driveMeta[k] = { src: 'traffic', delayMin: m.nowDelay || 0, km: m.km, mode: 'now', at: m.at };
  }
}
let trafficBusy = false;
function countCall(n = 1) {
  const m = new Date().toISOString().slice(0, 7);
  settings.apiCalls = { [m]: (settings.apiCalls?.[m] || 0) + n };
  store.set('settings', settings);
}
// state of the "Trafiği şimdi hesapla" button: idle | busy | done | error (shown on the button itself)
let trafficBtn = { state: 'idle' };
function setTrafficBtn(state, msg) {
  trafficBtn = { state, msg };
  clearTimeout(setTrafficBtn._t);
  if (state === 'done' || state === 'error') setTrafficBtn._t = setTimeout(() => { trafficBtn = { state: 'idle' }; renderHero(); }, 4000);
  renderHero();
}
function trafficBtnHtml() {
  const s = trafficBtn.state;
  const label = s === 'busy' ? '⏳ Hesaplanıyor…'
    : s === 'done' ? '✓ Güncellendi'
    : s === 'error' ? `⚠️ ${esc(trafficBtn.msg || 'Güncellenemedi')}`
    : '🔄 Trafiği şimdi hesapla';
  return `<button class="maps-btn on-dark traffic-btn is-${s}" data-traffic ${s === 'busy' ? 'disabled' : ''} aria-live="polite">${label}</button>`;
}

async function refreshTraffic(t, { quiet = false } = {}) {
  if (!trafficReady() || trafficBusy || !t?.key) return;
  trafficBusy = true;
  if (!quiet) setTrafficBtn('busy');
  try {
    // live traffic only: "if you left right now"
    const r = await driveTime({ key: settings.googleKey, home: settings.home, arriveBy: null });
    countCall(r.calls);
    setDrive(t.key, r.minutes, { src: 'traffic', delayMin: r.delayMin, km: r.km, mode: 'now' }, true);
    if (!quiet) setTrafficBtn('done');
  } catch (err) {
    if (!quiet) setTrafficBtn('error', err.message);
    else console.warn(err);
  } finally {
    trafficBusy = false;
  }
}
// Automatic refresh for the next flight: only within 48h of leaving; every 15 min in the last 4h, else every 6h.
function maybeAutoTraffic(t) {
  if (!trafficReady() || !t?.leave || t.first.from !== HOME) return;
  const meta = settings.driveMeta?.[t.key];
  const toLeave = istDate(t.leave) - Date.now();
  // keep refreshing until sign-in (leave time itself moves with traffic)
  if (toLeave > 48 * 3600000 || (t.reportStamp && istDate(t.reportStamp) < Date.now())) return;
  const age = meta?.at ? Date.now() - Date.parse(meta.at) : Infinity;
  const ttl = toLeave < 4 * 3600000 ? 15 * 60000 : 6 * 3600000;
  if (age > ttl) refreshTraffic(t, { quiet: true });
}
// congestion level from traffic delay relative to free-flow time (colour + icon + word, never colour alone)
function congestion(min, delay = 0) {
  const ratio = delay / Math.max(1, min - delay);
  if (ratio < 0.1) return { k: 'ok', icon: '●', label: 'akıcı' };
  if (ratio < 0.3) return { k: 'mid', icon: '▲', label: 'yoğun' };
  return { k: 'bad', icon: '■', label: 'çok yoğun' };
}
const hhmm = (iso) => new Date(Date.parse(iso) + 3 * 3600000).toISOString().slice(11, 16);

function renderHero() {
  const now = new Date();
  const T = allTrips();
  const el = $('#hero');
  el.className = 'hero';
  // 'on duty' starts at departure; until then keep the pre-flight card (leave time + live traffic)
  const current = T.find((t) => istDate(t.depStamp) <= now && t.returnStamp && now < istDate(t.returnStamp));
  if (current) {
    const arrived = current.legs.filter((l) => l.arrDate <= now.toISOString().slice(0, 10)).pop();
    const loc = city(arrived?.to || current.main);
    el.innerHTML = `
      <p class="eyebrow">Şu an görevde</p>
      <h2>${esc(loc)}</h2>
      <p class="when">${esc(current.title)} · ${esc(current.legs.map((l) => l.flight).join(', '))}</p>
      <div class="hero-grid">
        <div class="hero-cell hl"><small>Türkiye'ye iniş</small><b>${current.returnStamp.slice(11)}</b></div>
        <div class="hero-cell"><small>Dönüş günü</small><b style="font-size:16px">${esc(fmtShort(current.returnStamp.slice(0, 10)))}</b></div>
        <div class="hero-cell"><small>Dönüş uçuşu</small><b style="font-size:15px">${esc(current.last.flight)}</b></div>
      </div>
      <p class="countdown">İstanbul'a inişe ${esc(relative(istDate(current.returnStamp), now).replace(' sonra', ''))} var.</p>`;
    el.onclick = () => openTrip(current);
    return;
  }
  const next = T.find((t) => istDate(t.depStamp) > now);
  if (!next) {
    el.className = 'hero home';
    el.innerHTML = `<p class="eyebrow">Durum</p><h2>Evde 🏠</h2><p class="when">Yüklü programda yaklaşan uçuş yok. Yeni ayın PDF'i gelince yükleyebilirsin.</p>`;
    el.onclick = null;
    return;
  }
  const leaveAt = istDate(next.leave || next.depStamp);
  el.innerHTML = `
    <p class="eyebrow">Sıradaki uçuş</p>
    <h2>${esc(next.title)}</h2>
    <p class="when">${esc(fmtDay(next.first.depDate))} · ${esc(next.first.flight)}</p>
    <div class="hero-grid">
      <div class="hero-cell hl"><small>Evden çıkış</small><b>${next.leave ? next.leave.slice(11) : '–'}</b></div>
      <div class="hero-cell"><small>Kalkış</small><b>${next.first.dep}</b></div>
      <div class="hero-cell"><small>Eve iniş${next.returnStamp ? ' · ' + esc(fmtShort(next.returnStamp.slice(0, 10)).replace(/ \S+$/, '')) : ''}</small><b>${next.returnStamp ? next.returnStamp.slice(11) : '–'}</b></div>
    </div>
    <p class="countdown">${leaveAt > now ? `Evden çıkışa ${esc(relative(leaveAt, now).replace(' sonra', ''))} var.` : `Evden çıkış saati geçti (${esc(relative(leaveAt, now))}).${next.reportStamp && istDate(next.reportStamp) > now ? ` İmzaya ${esc(relative(istDate(next.reportStamp), now).replace(' sonra', ''))} var.` : ''}`}${next.returnStamp ? ` Dönüş: ${esc(fmtDay(next.returnStamp.slice(0, 10)))}.` : ''}</p>
    ${next.first.from === HOME ? `
      ${mapsLink('maps-btn on-dark')}
      ${trafficReady() ? '' : `<form class="drive" data-key="${esc(next.key)}">
        <label>Maps'teki yol süresi
          <input type="number" inputmode="numeric" min="5" max="300" step="1" placeholder="örn. 60" value="${next.drive || ''}" aria-label="Yol süresi, dakika">
          <span>dk</span>
        </label>
        <button type="submit">Hesapla</button>
        ${next.drive ? '<button type="button" data-reset>Sıfırla</button>' : ''}
      </form>`}
      ${(() => {
        const meta = settings.driveMeta?.[next.key];
        if (next.drive && meta?.src === 'traffic') {
          const lv = congestion(next.drive, meta.delayMin);
          return `<div class="traffic-big">
            <span class="tb-icon" aria-hidden="true">🚦</span>
            <div><small>Şu anki trafik</small><b class="cg-${lv.k}">${next.drive} dk</b></div>
            <span class="tb-meta"><span class="cg-tag cg-${lv.k}">${lv.icon} ${lv.label}</span><br>${meta.delayMin ? `+${meta.delayMin} dk yoğunluk<br>` : ''}güncelleme ${hhmm(meta.at)}</span>
          </div>
          <p class="drive-note">Evden çıkış = imza ${next.reportStamp.slice(11)} − 40 dk − yol ${next.drive} dk − ${DRIVE_BUFFER_MIN} dk pay</p>`;
        }
        if (next.drive) return `<p class="drive-note">Evden çıkış = imza ${next.reportStamp.slice(11)} − 40 dk − yol ${next.drive} dk − ${DRIVE_BUFFER_MIN} dk pay (elle girildi)</p>`;
        return `<p class="drive-note">Şu an sabit kural: kalkıştan ${minLabel(next.leaveBefore)} önce. ${trafficReady() ? 'Trafik uçuştan 48 saat önce otomatik hesaplanır.' : 'Yol süresini yazarsan ya da ⚙️ Ayarlar\'dan trafik servisini açarsan imza − 40 dk − yol süresi olarak hesaplanır.'}</p>`;
      })()}
      ${trafficReady() ? trafficBtnHtml() : ''}` : ''}`;
  el.onclick = (e) => {
    if (e.target.closest('[data-traffic]')) return refreshTraffic(next);
    if (!e.target.closest('[data-maps], .drive')) openTrip(next);
  };
  maybeAutoTraffic(next);
  const form = el.querySelector('.drive');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const v = Math.round(Number(form.querySelector('input').value));
      setDrive(form.dataset.key, v >= 5 && v <= 300 ? v : null);
    };
    form.querySelector('[data-reset]')?.addEventListener('click', () => setDrive(form.dataset.key, null));
  }
}

function renderMonth(r) {
  $('#monthTitle').textContent = monthName(r.period.key);
  const ks = keys();
  const i = ks.indexOf(viewKey);
  $('#prevMonth').disabled = i <= 0;
  $('#nextMonth').disabled = i >= ks.length - 1;
  const days = buildDays(r, settings);
  const today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
  const firstDow = (new Date(days[0].date + 'T12:00:00Z').getUTCDay() + 6) % 7; // Monday = 0
  const cal = $('#calendar');
  const html = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => `<div class="dow">${d}</div>`);
  for (let k = 0; k < firstDow; k++) html.push('<div class="cell blank"></div>');
  for (const d of days) {
    const label = d.kind === 'depart' ? `✈ ${d.label}` : d.kind === 'return' ? '↩ Dönüş' : d.label;
    html.push(`<button class="cell k-${d.kind}${d.date === today ? ' today' : ''}" data-date="${d.date}"${homeStyle(d)} aria-label="${esc(fmtDay(d.date))}: ${esc(label)}${d.sub ? ', ' + esc(d.sub) : ''}">
      ${d.trip?.cargo && ['depart', 'away', 'return'].includes(d.kind) ? '<span class="kbadge" title="Kargo uçuşu">K</span>' : ''}<span class="n">${d.day}</span><span class="lbl">${esc(label)}</span>${d.sub ? `<span class="sub">${esc(d.sub)}</span>` : ''}</button>`);
  }
  cal.innerHTML = html.join('');
  cal._days = days;
}

// Departure / return days: the part of the day spent at home is painted green (left = 00:00, right = 24:00)
function homeStyle(d) {
  if (!d.home) return '';
  const u = Math.round(d.home.until * 100), f = Math.round(d.home.from * 100);
  const duty = 'var(--duty-bg)';
  return ` style="background:linear-gradient(90deg, var(--off-bg) 0 ${u}%, ${duty} ${u}% ${f}%, var(--off-bg) ${f}% 100%)"`;
}

function renderTrips(r) {
  const now = new Date();
  const T = trips(r, settings);
  $('#tripList').innerHTML = T.length ? T.map((t, i) => `
    <div class="trip${t.returnStamp && istDate(t.returnStamp) < now ? ' past' : ''}" data-trip="${i}" role="button" tabindex="0">
      <h4>✈ ${esc(t.title)}${t.cargo ? ' <span class="kpill">K · kargo</span>' : ''}</h4>
      <p class="dates">${esc(fmtShort(t.first.depDate))} → ${esc(fmtShort(t.last.arrDate))} · ${esc(t.legs.map((l) => l.flight).join(', '))}</p>
      <div class="row">
        ${t.leave ? `<span>Evden çıkış <b>${t.leave.slice(11)}</b></span>` : ''}
        ${t.first.from === HOME ? `<span>İmza <b>${t.reportStamp.slice(11)}</b></span>` : ''}
        <span>Kalkış <b>${t.first.dep}</b></span>
        ${t.returnStamp ? `<span>Eve iniş <b>${t.returnStamp.slice(11)}</b> <b class="ret-date">${esc(fmtShort(t.returnStamp.slice(0, 10)))}</b></span>` : ''}
      </div>
      ${t.stays.some((x) => !x.transit) ? `<div class="row stay">${t.stays.filter((x) => !x.transit).map((x) => `<span>📍 ${esc(city(x.station))} kalış: <b>${esc(fmtDur(x.min, { days: true }))}</b></span>`).join('')}</div>` : ''}
      ${t.first.from === HOME && !(t.returnStamp && istDate(t.returnStamp) < now) ? mapsLink() : ''}
    </div>`).join('') : '<p class="footnote">Bu ay uçuş yok.</p>';
  $('#tripList')._trips = T;
}

// ---------- sheets ----------
function openSheet(html) {
  $('#sheetBody').innerHTML = html;
  $('#sheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $('#sheet').hidden = true;
  document.body.style.overflow = '';
}
$('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

function tripHtml(t) {
  const legs = t.legs.map((l) => `
    <div class="leg">
      <div class="ap"><b>${l.dep}</b><span>${esc(city(l.from))} · ${esc(fmtShort(l.depDate))}</span></div>
      <div class="mid"><b>${esc(l.flight)}</b>✈</div>
      <div class="ap r"><b>${l.arr}</b><span>${esc(city(l.to))} · ${esc(fmtShort(l.arrDate))}</span></div>
    </div>`).join('');
  const steps = [];
  if (t.leave) steps.push({ t: t.leave.slice(11), d: 'Evden çıkış', s: t.drive ? `İmza − 40 dk − yol ${t.drive} dk − ${DRIVE_BUFFER_MIN} dk pay` : `Kalkıştan ${minLabel(t.leaveBefore)} önce${t.cargo ? ' (kargo)' : ''}`, hl: true });
  if (t.first.from === HOME) steps.push({ t: t.reportStamp.slice(11), d: 'İmza (mesai başlangıcı)', s: 'Havalimanında brifing' });
  steps.push({ t: t.first.dep, d: `Kalkış: ${city(t.first.from)} → ${city(t.first.to)}`, s: t.first.flight });
  if (t.returnStamp) steps.push({ t: t.returnStamp.slice(11), d: `İstanbul'a iniş · ${fmtShort(t.returnStamp.slice(0, 10))}`, s: t.last.flight });
  const hotels = t.layovers.map((y) => `
    <dl class="kv">
      <dt>Şehir</dt><dd>${esc(city(y.station))} (${esc(y.station)})</dd>
      ${y.hotel?.name ? `<dt>Otel</dt><dd>${esc(y.hotel.name)}</dd>` : ''}
      ${y.hotel?.phone ? `<dt>Telefon</dt><dd><a href="tel:${esc(y.hotel.phone.replace(/\s/g, ''))}">${esc(y.hotel.phone)}</a></dd>` : ''}
      <dt>Dinlenme</dt><dd>${esc(y.rest)} saat</dd>
    </dl>`).join('');
  return `
    <h2>✈ ${esc(t.title)}${t.cargo ? ' <span class="kpill">K · kargo</span>' : ''}</h2>
    ${t.first.from === HOME ? `<div style="margin-bottom:12px">${mapsLink('maps-btn block')}</div>` : ''}
    <div class="card"><h3>Özet (Türkiye saati)</h3>
      <ul class="timeline">${steps.map((s) => `<li class="${s.hl ? 'hl' : ''}"><span class="t">${s.t}</span><span class="d">${esc(s.d)}<small>${esc(s.s || '')}</small></span></li>`).join('')}</ul>
    </div>
    ${t.stays.length ? `<div class="card"><h3>Orada kalış</h3>${t.stays.map((x) => {
      const inL = t.legs.find((l) => l.to === x.station), outL = t.legs[t.legs.indexOf(inL) + 1];
      return `<div class="dest"><span class="name">${esc(city(x.station))}${x.transit ? '<small>aktarma</small>' : ''}</span>
        <span class="val"><b>${esc(fmtDur(x.min, { days: true }))}</b>${x.min >= 1440 ? ` <small class="muted">(${fmtHM(x.min)} sa)</small>` : ''}</span>
        <span class="muted" style="grid-column:1/-1;font-size:13px">İniş ${esc(fmtShort(inL.arrDate))} ${inL.arr} → kalkış ${esc(fmtShort(outL.depDate))} ${outL.dep} (yerel saat)</span></div>`;
    }).join('')}</div>` : ''}
    <div class="card"><h3>Uçuşlar (yerel saat)</h3>${legs}</div>
    ${hotels ? `<div class="card"><h3>Konaklama</h3>${hotels}</div>` : ''}
    ${t.crew?.length ? `<div class="card"><h3>Kokpit ekibi</h3><div class="chips">${t.crew.map((c) => `<span class="chip">${esc(niceName(c.replace(/\s*\(.*\)$/, '')))} <small>${esc((c.match(/\((.*)\)$/) || [])[1] || '')}</small></span>`).join('')}</div></div>` : ''}
    ${t.restUntil ? `<p class="footnote">Dinlenme bitişi: ${esc(fmtShort(t.restUntil.slice(0, 10)))} ${t.restUntil.slice(11)}</p>` : ''}`;
}
function openTrip(t) { openSheet(tripHtml(t)); }

function openDay(d) {
  if (d.trip) {
    const t = d.trip;
    const landing = t.returnStamp && d.kind !== 'depart' ? `
      <div class="hero landing">
        <p class="eyebrow">Türkiye'ye iniş</p>
        <h2 style="font-size:38px;line-height:1.1">${t.returnStamp.slice(11)}</h2>
        <p class="land-date">${esc(fmtDay(t.returnStamp.slice(0, 10)))}</p>
        <p class="when" style="margin:0">${esc(t.last.flight)} · İstanbul</p>
      </div>` : '';
    return openSheet(landing + tripHtml(t));
  }
  let title = 'Evde 🏠', body = 'Bu gün için bir görev yok.';
  if (d.kind === 'off') { title = 'İzinli 🏠'; body = codeInfo(d.duty?.type).long || 'Boş gün'; }
  if (d.kind === 'rest') { title = 'Dinlenme 🏠'; body = `Uçuş sonrası yasal dinlenme. Bitiş: ${fmtShort(d.restOf.restUntil.slice(0, 10))} ${d.restOf.restUntil.slice(11)}`; }
  if (d.kind === 'prev') { title = 'Görevde'; body = 'Önceki aydan devam eden görev. Ayrıntısı önceki ayın programında.'; }
  if (d.kind === 'standby') {
    const ci = codeInfo(d.duty.type);
    title = ci.ground ? ci.label : d.duty.type === 'CFR' ? 'Görev bekleme' : 'Ev nöbeti';
    body = `${esc(ci.long || '')}<br><b style="font-size:22px">${d.duty.code?.dep || d.duty.start.slice(11)} – ${d.duty.code?.arr || d.duty.end.slice(11)}</b>${ci.ground ? '' : '<br><small>Bu saatlerde aranıp uçuşa çağrılabilir.</small>'}`;
  }
  openSheet(`<h2>${title}</h2><p class="muted">${esc(fmtDay(d.date))}</p><div class="card">${body}</div>`);
}

$('#calendar').addEventListener('click', (e) => {
  const c = e.target.closest('.cell[data-date]');
  if (c) openDay($('#calendar')._days.find((d) => d.date === c.dataset.date));
});
$('#tripList').addEventListener('click', (e) => {
  if (e.target.closest('[data-maps]')) return;
  const b = e.target.closest('[data-trip]');
  if (b) openTrip($('#tripList')._trips[+b.dataset.trip]);
});
$('#tripList').addEventListener('keydown', (e) => {
  const b = e.target.closest('[data-trip]');
  if (b && e.target === b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openTrip($('#tripList')._trips[+b.dataset.trip]); }
});
$('#prevMonth').onclick = () => { const ks = keys(); viewKey = ks[Math.max(0, ks.indexOf(viewKey) - 1)]; render(); };
$('#nextMonth').onclick = () => { const ks = keys(); viewKey = ks[Math.min(ks.length - 1, ks.indexOf(viewKey) + 1)]; render(); };

// ---------- settings ----------
function openSettings() {
  const ks = keys();
  openSheet(`
    <h2>Ayarlar</h2>
    <p class="muted">Bu ayarlar sadece bu cihazda saklanır.</p>
    <div class="card settings">
      <h3>Evden çıkış</h3>
      <div class="row"><span>Yolcu uçuşu: kalkıştan ne kadar önce?</span>
        <div class="stepper"><button data-step="-10" aria-label="Azalt">−</button><output id="lh">${minLabel(settings.leaveMin)}</output><button data-step="10" aria-label="Arttır">+</button></div>
      </div>
      <p class="footnote" style="margin:4px 0 0">Kargo uçuşlarında imza 1 saat önce olduğu için evden çıkış 30 dk daha geç: <b id="lhc">${minLabel(settings.leaveMin - 30)}</b> önce.</p>
    </div>
    <div class="card stack" id="trafficCard">
      <h3>Trafik (Google Maps)</h3>
      <p class="footnote" style="margin:0">Uçuştan önceki 48 saatte evden çıkış, trafiğe göre <b>imza − 40 dk − yol süresi</b> olarak hesaplanır.</p>
      <label class="field">API anahtarı
        <input id="ttKey" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Google Maps API key (AIza…)" value="${esc(settings.googleKey || '')}">
      </label>
      <button class="btn block" id="ttSaveKey">Anahtarı kaydet</button>
      <label class="field">Ev adresi
        <input id="ttAddr" type="text" placeholder="Mahalle, sokak, ilçe" value="">
      </label>
      <div class="two"><button class="btn" id="ttFind">Adresi kaydet ve dene</button><button class="btn" id="ttHere">📍 Şu an evdeyim</button></div>
      <p class="footnote" style="margin:0" id="ttHome">${settings.home ? `Kayıtlı ev: <b>${esc(settings.home.label)}</b>` : 'Ev konumu kayıtlı değil.'}</p>
      <p class="footnote" style="margin:0">Bu ay ${settings.apiCalls?.[new Date().toISOString().slice(0, 7)] || 0} trafik sorgusu yapıldı. Anahtar ve ev konumu sadece bu telefonda saklanır; ev konumu yol süresi için Google'a gönderilir.</p>
    </div>
    <div class="card stack">
      <h3>Program</h3>
      <label class="btn primary block">PDF yükle (birden fazla seçebilirsin)<input type="file" accept="application/pdf,.pdf" class="file-input" multiple hidden></label>
      ${ks.length ? `<button class="btn block" id="shareBtn">Bu ayı paylaş (link)</button>
      ${ks.length > 1 ? `<button class="btn block" id="shareAllBtn">Tüm ayları paylaş (${ks.length} ay, tek link)</button>` : ''}
      <button class="btn block" id="pasteLinkBtn">📩 Gelen linki yapıştır</button>
      <button class="btn block" id="icsBtn">Telefon takvimine ekle (.ics)</button>` : ''}
    </div>
    ${ks.length ? `<div class="card"><h3>Yüklü aylar</h3>${ks.map((k) => `<div class="month-row"><span>${esc(monthName(k))}</span><button class="link-btn" data-del="${k}">Sil</button></div>`).join('')}</div>` : ''}
    <p class="footnote">Sürüm ${APP_VERSION}</p>
    <p class="footnote">🔒 PDF cihazında okunur, hiçbir sunucuya gönderilmez. Paylaşım linki programı linkin içinde taşır, linki kime gönderirsen o görür.</p>`);
}
$('#menuBtn').onclick = openSettings;

$('#sheet').addEventListener('click', async (e) => {
  const id = e.target.id;
  if (id === 'ttSaveKey') {
    settings.googleKey = $('#ttKey').value.trim() || undefined;
    store.set('settings', settings);
    toast(settings.googleKey ? 'Anahtar kaydedildi' : 'Anahtar silindi');
    render();
  }
  if (id === 'ttFind' || id === 'ttHere') {
    try {
      if (!settings.googleKey) throw new Error('Önce API anahtarını kaydet');
      const q = $('#ttAddr').value.trim();
      if (id === 'ttFind' && !q) throw new Error('Adres yaz');
      const home = id === 'ttFind' ? { address: q, label: q } : await currentPosition();
      // test key + address right away with one "traffic now" query
      const r = await driveTime({ key: settings.googleKey, home, arriveBy: null });
      countCall(r.calls);
      settings.home = home;
      store.set('settings', settings);
      $('#ttHome').innerHTML = `Kayıtlı ev: <b>${esc(home.label)}</b> · şu an havalimanına ${r.minutes} dk (${r.km} km)`;
      toast('Ev kaydedildi, bağlantı çalışıyor');
      render();
    } catch (err) { toast(err.message); }
  }
  const step = e.target.closest('[data-step]');
  if (step) {
    settings.leaveMin = Math.min(360, Math.max(90, settings.leaveMin + Number(step.dataset.step)));
    store.set('settings', settings);
    $('#lh').textContent = minLabel(settings.leaveMin);
    $('#lhc').textContent = minLabel(settings.leaveMin - 30);
    render();
  }
  const del = e.target.closest('[data-del]');
  if (del && confirm(`${monthName(del.dataset.del)} programı silinsin mi?`)) {
    delete rosters[del.dataset.del];
    store.set('rosters', rosters);
    viewKey = null;
    render();
    openSettings();
  }
  if (e.target.id === 'icsBtn') {
    const blob = new Blob([toICS(keys().map((k) => rosters[k]), settings)], { type: 'text/calendar' });
    const file = new File([blob], 'ucus-plani.ics', { type: 'text/calendar' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Uçuş planı' }); } catch { /* cancelled */ }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ucus-plani.ics';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  }
  if (e.target.id === 'shareBtn' || e.target.id === 'shareAllBtn') {
    const all = e.target.id === 'shareAllBtn';
    const link = await makeShareLink(all ? keys().map((k) => rosters[k]) : rosters[viewKey]);
    const ks = keys();
    const text = all ? `Uçuş planı (${monthName(ks[0])} – ${monthName(ks[ks.length - 1])})` : `${monthName(viewKey)} uçuş planı`;
    if (navigator.share) {
      try { await navigator.share({ title: text, text, url: link }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(link);
      toast('Link kopyalandı');
    }
  }
});

function applyShared(shared) {
  shared = [...shared].sort((a, b) => (a.period.key < b.period.key ? -1 : 1));
  const fresh = shared.filter((r) => !rosters[r.period.key]).length;
  for (const r of shared) saveRoster(r, false);
  store.set('rosters', rosters);
  if (shared.length > 1) viewKey = null;
  render();
  const b = $('#shareBanner');
  b.hidden = false;
  b.innerHTML = shared.length === 1
    ? `<span>📩 ${esc(monthName(shared[0].period.key))} programı ${fresh ? 'eklendi' : 'güncellendi'}.</span>`
    : `<span>📩 ${shared.length} aylık program eklendi (${esc(monthName(shared[0].period.key))} – ${esc(monthName(shared[shared.length - 1].period.key))}).</span>`;
  setTimeout(() => { b.hidden = true; }, 6000);
}
// iPhone opens shared links in Safari, not in the home-screen app: let the link be pasted here too
async function pasteLink(text) {
  const shared = await readShareHash(text || '');
  if (shared) { closeSheet(); applyShared(shared); return true; }
  if (text !== null) toast('Bu bir paylaşım linki değil');
  return false;
}
document.addEventListener('click', (e) => {
  if (e.target.id !== 'pasteLinkBtn') return;
  const text = prompt('Gelen paylaşım linkini buraya yapıştır:');
  if (text !== null) pasteLink(text);
});

// ---------- boot ----------
async function boot() {
  const shared = await readShareHash();
  if (shared) {
    history.replaceState(null, '', location.pathname + location.search);
    applyShared(shared);
  } else {
    render();
  }
  // refresh countdowns every minute
  setInterval(() => { if (keys().length) renderHero(); }, 60000);
  if ('serviceWorker' in navigator) {
    // when a new version takes over, reload once so the new look shows right away
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  }
}
boot();
