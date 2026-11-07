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
  RIX: 'Riga', VNO: 'Vilnius', TLL: 'Tallinn', LUX: 'Lüksemburg',
  // Africa
  JNB: 'Johannesburg', CPT: 'Cape Town', NBO: 'Nairobi', ADD: 'Addis Ababa', LOS: 'Lagos',
  ABV: 'Abuja', ACC: 'Akra', DSS: 'Dakar', CMN: 'Kazablanka', RAK: 'Marakeş', ALG: 'Cezayir',
  TUN: 'Tunus', MRU: 'Mauritius', DAR: 'Darüsselam', ZNZ: 'Zanzibar', EBB: 'Entebbe', KGL: 'Kigali',
  MGQ: 'Mogadişu', KRT: 'Hartum', FIH: 'Kinşasa', LAD: 'Luanda', ABJ: 'Abidjan',
};

export const city = (code) => (code && CITY[code]) || code || '';
