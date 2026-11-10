// IATA -> city name (Turkish), focused on THY network. Unknown codes fall back to the code.
export const CITY = {
  IST: 'İstanbul', SAW: 'İstanbul SAW', ESB: 'Ankara', ADB: 'İzmir', AYT: 'Antalya', ADA: 'Adana',
  TZX: 'Trabzon', DLM: 'Dalaman', BJV: 'Bodrum', GZT: 'Gaziantep', DIY: 'Diyarbakır', VAN: 'Van',
  ERZ: 'Erzurum', KYA: 'Konya', ASR: 'Kayseri', SZF: 'Samsun', MLX: 'Malatya', HTY: 'Hatay',
  // Americas
  JFK: 'New York', EWR: 'Newark', IAD: 'Washington', BOS: 'Boston', ORD: 'Chicago', ATL: 'Atlanta',
  MIA: 'Miami', IAH: 'Houston', DFW: 'Dallas', DEN: 'Denver', LAX: 'Los Angeles', SFO: 'San Francisco',
  SEA: 'Seattle', DTW: 'Detroit', YYZ: 'Toronto', YUL: 'Montreal', YVR: 'Vancouver', MEX: 'Meksiko',
  CUN: 'Cancún', GRU: 'São Paulo', GIG: 'Rio de Janeiro', EZE: 'Buenos Aires', BOG: 'Bogota',
  CCS: 'Karakas', HAV: 'Havana', PTY: 'Panama', SCL: 'Santiago', LIM: 'Lima',
  // Asia / Far East
  HKG: 'Hong Kong', PVG: 'Şanghay', PEK: 'Pekin', PKX: 'Pekin Daxing', CAN: 'Guangzhou', XIY: "Xi'an",
  NRT: 'Tokyo Narita', HND: 'Tokyo Haneda', KIX: 'Osaka', ICN: 'Seul', TPE: 'Taipei', SIN: 'Singapur',
  KUL: 'Kuala Lumpur', BKK: 'Bangkok', HKT: 'Phuket', CGK: 'Cakarta', DPS: 'Bali', MNL: 'Manila',
  SGN: 'Ho Chi Minh', HAN: 'Hanoi', DEL: 'Delhi', BOM: 'Mumbai', MLE: 'Maldivler', CMB: 'Kolombo',
  KTM: 'Katmandu', DAC: 'Dakka', ISB: 'İslamabad', LHE: 'Lahor', KHI: 'Karaçi', KBL: 'Kabil',
  SYD: 'Sidney', MEL: 'Melbourne', ALA: 'Almatı', NQZ: 'Astana', TAS: 'Taşkent', SKD: 'Semerkant',
  FRU: 'Bişkek', DYU: 'Duşanbe', ASB: 'Aşkabat', GYD: 'Bakü', TBS: 'Tiflis', EVN: 'Erivan',
  ULN: 'Ulan Batur',
  // Middle East
  BEY: 'Beyrut', DXB: 'Dubai', DWC: 'Dubai DWC', AUH: 'Abu Dabi', DOH: 'Doha', BAH: 'Bahreyn',
  KWI: 'Kuveyt', MCT: 'Maskat', RUH: 'Riyad', JED: 'Cidde', MED: 'Medine', DMM: 'Dammam',
  AMM: 'Amman', TLV: 'Tel Aviv', BGW: 'Bağdat', EBL: 'Erbil', BSR: 'Basra', IKA: 'Tahran',
  MHD: 'Meşhed', TBZ: 'Tebriz', SHJ: 'Şarika', CAI: 'Kahire', HRG: 'Hurgada', SSH: 'Şarm El-Şeyh',
  // Europe
  LHR: 'Londra Heathrow', LGW: 'Londra Gatwick', STN: 'Londra Stansted', MAN: 'Manchester',
  BHX: 'Birmingham', EDI: 'Edinburgh', DUB: 'Dublin', CDG: 'Paris', ORY: 'Paris Orly', NCE: 'Nice',
  LYS: 'Lyon', MRS: 'Marsilya', AMS: 'Amsterdam', BRU: 'Brüksel', FRA: 'Frankfurt', MUC: 'Münih',
  BER: 'Berlin', HAM: 'Hamburg', DUS: 'Düsseldorf', CGN: 'Köln', STR: 'Stuttgart', HAJ: 'Hannover',
  NUE: 'Nürnberg', ZRH: 'Zürih', GVA: 'Cenevre', BSL: 'Basel', VIE: 'Viyana', PRG: 'Prag',
  BUD: 'Budapeşte', WAW: 'Varşova', KRK: 'Krakov', CPH: 'Kopenhag', ARN: 'Stockholm', OSL: 'Oslo',
  HEL: 'Helsinki', FCO: 'Roma', MXP: 'Milano', VCE: 'Venedik', BLQ: 'Bolonya', NAP: 'Napoli',
  MAD: 'Madrid', BCN: 'Barselona', LIS: 'Lizbon', OPO: 'Porto', ATH: 'Atina', SKG: 'Selanik',
  SOF: 'Sofya', OTP: 'Bükreş', BEG: 'Belgrad', ZAG: 'Zagreb', SJJ: 'Saraybosna', TIA: 'Tiran',
  SKP: 'Üsküp', PRN: 'Priştine', KIV: 'Kişinev', KBP: 'Kiev', ODS: 'Odessa', VKO: 'Moskova Vnukovo',
  SVO: 'Moskova', DME: 'Moskova Domodedovo', LED: 'St. Petersburg', ECN: 'Lefkoşa', MLA: 'Malta',
  MST: 'Maastricht', RIX: 'Riga', VNO: 'Vilnius', TLL: 'Tallinn', LUX: 'Lüksemburg',
  // Africa
  JNB: 'Johannesburg', CPT: 'Cape Town', NBO: 'Nairobi', ADD: 'Addis Ababa', LOS: 'Lagos',
  ABV: 'Abuja', ACC: 'Akra', DSS: 'Dakar', CMN: 'Kazablanka', RAK: 'Marakeş', ALG: 'Cezayir',
  TUN: 'Tunus', MRU: 'Mauritius', DAR: 'Darüsselam', ZNZ: 'Zanzibar', EBB: 'Entebbe', KGL: 'Kigali',
  MGQ: 'Mogadişu', KRT: 'Hartum', FIH: 'Kinşasa', LAD: 'Luanda', ABJ: 'Abidjan',
};

export const city = (code) => (code && CITY[code]) || code || '';

// IATA -> IANA time zone, so local times in the roster can be shown in Turkey time too.
const Z = {
  'Europe/Istanbul': 'IST SAW ESB ADB AYT ADA TZX DLM BJV GZT DIY VAN ERZ KYA ASR SZF MLX HTY ECN',
  'America/New_York': 'JFK EWR IAD BOS ATL MIA DTW', 'America/Chicago': 'ORD IAH DFW',
  'America/Denver': 'DEN', 'America/Los_Angeles': 'LAX SFO SEA', 'America/Toronto': 'YYZ YUL',
  'America/Vancouver': 'YVR', 'America/Mexico_City': 'MEX', 'America/Cancun': 'CUN',
  'America/Sao_Paulo': 'GRU GIG', 'America/Argentina/Buenos_Aires': 'EZE', 'America/Bogota': 'BOG',
  'America/Caracas': 'CCS', 'America/Havana': 'HAV', 'America/Panama': 'PTY', 'America/Santiago': 'SCL',
  'America/Lima': 'LIM',
  'Asia/Hong_Kong': 'HKG', 'Asia/Shanghai': 'PVG PEK PKX CAN XIY', 'Asia/Tokyo': 'NRT HND KIX',
  'Asia/Seoul': 'ICN', 'Asia/Taipei': 'TPE', 'Asia/Singapore': 'SIN', 'Asia/Kuala_Lumpur': 'KUL',
  'Asia/Bangkok': 'BKK HKT', 'Asia/Jakarta': 'CGK', 'Asia/Makassar': 'DPS', 'Asia/Manila': 'MNL',
  'Asia/Ho_Chi_Minh': 'SGN HAN', 'Asia/Kolkata': 'DEL BOM', 'Indian/Maldives': 'MLE', 'Asia/Colombo': 'CMB',
  'Asia/Kathmandu': 'KTM', 'Asia/Dhaka': 'DAC', 'Asia/Karachi': 'ISB LHE KHI', 'Asia/Kabul': 'KBL',
  'Australia/Sydney': 'SYD', 'Australia/Melbourne': 'MEL', 'Asia/Almaty': 'ALA NQZ', 'Asia/Tashkent': 'TAS SKD',
  'Asia/Bishkek': 'FRU', 'Asia/Dushanbe': 'DYU', 'Asia/Ashgabat': 'ASB', 'Asia/Baku': 'GYD',
  'Asia/Tbilisi': 'TBS', 'Asia/Yerevan': 'EVN', 'Asia/Ulaanbaatar': 'ULN',
  'Asia/Beirut': 'BEY', 'Asia/Dubai': 'DXB DWC AUH SHJ MCT', 'Asia/Qatar': 'DOH BAH', 'Asia/Kuwait': 'KWI',
  'Asia/Riyadh': 'RUH JED MED DMM', 'Asia/Amman': 'AMM', 'Asia/Jerusalem': 'TLV', 'Asia/Baghdad': 'BGW EBL BSR',
  'Asia/Tehran': 'IKA MHD TBZ', 'Africa/Cairo': 'CAI HRG SSH',
  'Europe/London': 'LHR LGW STN MAN BHX EDI', 'Europe/Dublin': 'DUB', 'Europe/Lisbon': 'LIS OPO',
  'Europe/Paris': 'CDG ORY NCE LYS MRS AMS BRU FRA MUC BER HAM DUS CGN STR HAJ NUE ZRH GVA BSL VIE PRG BUD WAW KRK CPH ARN OSL FCO MXP VCE BLQ NAP MAD BCN BEG ZAG SJJ TIA SKP PRN MLA LUX MST',
  'Europe/Athens': 'ATH SKG SOF OTP KIV KBP ODS RIX VNO TLL HEL', 'Europe/Moscow': 'VKO SVO DME LED',
  'Africa/Johannesburg': 'JNB CPT', 'Africa/Nairobi': 'NBO ADD DAR ZNZ EBB MGQ', 'Africa/Lagos': 'LOS ABV FIH LAD',
  'Africa/Abidjan': 'ACC DSS ABJ', 'Africa/Casablanca': 'CMN RAK', 'Africa/Algiers': 'ALG', 'Africa/Tunis': 'TUN',
  'Indian/Mauritius': 'MRU', 'Africa/Kigali': 'KGL', 'Africa/Khartoum': 'KRT',
};
export const TZ = {};
for (const [z, codes] of Object.entries(Z)) for (const c of codes.split(' ')) TZ[c] = z;

const offCache = {};
// minutes the zone is ahead of UTC at the given UTC instant
function zoneOffset(zone, utcMs) {
  const f = offCache[zone] ||= new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(utcMs / 60000) * 60000) / 60000;
}

/**
 * Local wall time at an airport -> Turkey wall time. Returns { date:'YYYY-MM-DD', time:'HH:MM', diffMin }
 * (diffMin = Turkey minus local) or null when the airport's zone is unknown or it is already Turkey.
 */
export function toTurkey(code, date, time) {
  const zone = TZ[code];
  if (!zone || zone === 'Europe/Istanbul' || !date || !time) return null;
  const wall = Date.parse(`${date}T${time}:00Z`);
  let utc = wall - zoneOffset(zone, wall) * 60000;
  utc = wall - zoneOffset(zone, utc) * 60000;
  const tr = new Date(utc + 180 * 60000).toISOString();
  return { date: tr.slice(0, 10), time: tr.slice(11, 16), diffMin: Math.round((utc + 180 * 60000 - wall) / 60000) };
}
