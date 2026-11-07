// Drive time from home to Istanbul Airport with traffic, via the Google Maps Routes API
// (routes.googleapis.com, callable from the browser). The API key and home location live
// only in this device's localStorage – never in the repo.

// İstanbul Havalimanı (IST) – airport reference point
export const IST_AIRPORT = { lat: 41.2614, lon: 28.7422 };

const waypoint = (p) => (p.address
  ? { address: p.address }
  : { location: { latLng: { latitude: p.lat, longitude: p.lon } } });
const secs = (s) => Number(String(s || '0').replace('s', '')) || 0;

async function route(key, home, departure) {
  const body = {
    origin: waypoint(home),
    destination: waypoint(IST_AIRPORT),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
    languageCode: 'tr',
    regionCode: 'TR',
  };
  if (departure) body.departureTime = departure.toISOString();
  let res;
  try {
    res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Google Maps\'e bağlanılamadı (internet?)');
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = j.error?.message || '';
    if (/API key not valid/i.test(msg)) throw new Error('Google API anahtarı geçersiz');
    if (res.status === 403) throw new Error('Anahtar izinli değil: Routes API açık mı, faturalandırma var mı, site kısıtı doğru mu?');
    if (res.status === 429) throw new Error('Google sorgu limiti doldu');
    if (res.status === 400 && /origin|address|waypoint/i.test(msg)) throw new Error('Ev adresi bulunamadı, daha açık yaz');
    throw new Error(`Google Maps hata verdi (${res.status})`);
  }
  const r = j.routes?.[0];
  if (!r) throw new Error('Rota bulunamadı');
  return { sec: secs(r.duration), staticSec: secs(r.staticDuration), meters: r.distanceMeters || 0 };
}

/**
 * Drive time home -> airport for arriving at `arriveBy` (Istanbul wall clock "YYYY-MM-DDTHH:MM").
 * Google has no "arrive by" for cars, so: guess a departure, ask, then ask again at the corrected
 * departure (2 calls). If the arrival is near/past, uses traffic right now (1 call).
 */
export async function driveTime({ key, home, arriveBy, guessMin = 60 }) {
  const arriveAt = arriveBy ? new Date(`${arriveBy}:00+03:00`) : null;
  const now = Date.now();
  let calls = 0;
  const at = async (dep) => { calls++; return route(key, home, dep); };
  let r;
  let mode = 'now';
  const dep1 = arriveAt ? new Date(arriveAt - guessMin * 60000) : null;
  if (dep1 && dep1 - now > 5 * 60000) {
    mode = 'planned';
    r = await at(dep1);
    const dep2 = new Date(arriveAt - r.sec * 1000);
    if (Math.abs(r.sec / 60 - guessMin) > 5 && dep2 - now > 5 * 60000) r = await at(dep2);
  } else {
    r = await at(null);
  }
  return {
    minutes: Math.ceil(r.sec / 60),
    delayMin: Math.max(0, Math.round((r.sec - r.staticSec) / 60)),
    km: Math.round(r.meters / 100) / 10,
    mode,
    calls,
  };
}

/** Phone's current position (asks for location permission). */
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Bu cihaz konum vermiyor'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5), label: 'Kaydedilen konum' }),
      () => reject(new Error('Konum izni verilmedi')),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}
