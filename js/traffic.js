// Live / predicted drive time from home to Istanbul Airport via the TomTom Routing API.
// The API key and home position live only in this device's localStorage (never in the repo).
// Free tier: 2,500 requests/day; this app makes a handful per month.

// İstanbul Havalimanı (IST) – airport reference point
export const IST_AIRPORT = { lat: 41.2614, lon: 28.7422 };

async function call(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Trafik servisine bağlanılamadı (internet?)');
  }
  if (res.status === 401 || res.status === 403) throw new Error('TomTom API anahtarı geçersiz');
  if (res.status === 429) throw new Error('TomTom sorgu limiti doldu, sonra tekrar dene');
  if (!res.ok) throw new Error(`Trafik servisi hata verdi (${res.status})`);
  return res.json();
}

/**
 * Drive time home -> airport.
 * arriveBy: Istanbul wall-clock stamp "YYYY-MM-DDTHH:MM" to be at the airport (imza − 40 dk).
 * If that moment is (almost) now or past, uses current traffic (departAt=now).
 */
export async function driveTime({ key, home, arriveBy }) {
  const params = new URLSearchParams({ key, traffic: 'true', travelMode: 'car', routeType: 'fastest' });
  const arriveAt = arriveBy ? new Date(`${arriveBy}:00+03:00`) : null;
  const future = arriveAt && arriveAt - Date.now() > 20 * 60000;
  if (future) params.set('arriveAt', `${arriveBy}:00+03:00`);
  else params.set('departAt', 'now');
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${home.lat},${home.lon}:${IST_AIRPORT.lat},${IST_AIRPORT.lon}/json?${params}`;
  const j = await call(url);
  const s = j.routes?.[0]?.summary;
  if (!s) throw new Error('Rota bulunamadı');
  return {
    minutes: Math.ceil(s.travelTimeInSeconds / 60),
    delayMin: Math.round((s.trafficDelayInSeconds || 0) / 60),
    km: Math.round(s.lengthInMeters / 100) / 10,
    mode: future ? 'arriveAt' : 'now',
  };
}

/** Address text -> { lat, lon, label } (Türkiye only). */
export async function geocode({ key, query }) {
  const params = new URLSearchParams({ key, countrySet: 'TR', limit: '1', language: 'tr-TR' });
  const j = await call(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json?${params}`);
  const r = j.results?.[0];
  if (!r) throw new Error('Adres bulunamadı');
  return { lat: r.position.lat, lon: r.position.lon, label: r.address?.freeformAddress || query };
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
