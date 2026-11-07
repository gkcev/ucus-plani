import * as pdfjs from '../node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import { parseRoster } from '../js/parser.js';
import { monthStats, fmtDur, fmtHM } from '../js/model.js';
const r = await parseRoster(pdfjs, new Uint8Array(fs.readFileSync(process.argv[2])));
const s = monthStats(r, { leaveHours: 3 });
const { trips, ...rest } = s;
console.log(JSON.stringify(rest, null, 1));
console.log('flight', fmtHM(s.flightMin), 'abroad', fmtDur(s.abroadMin, { days: true }), 'home', fmtDur(s.homeMin, { days: true }), 'rest', fmtDur(s.postRestMin, { days: true }));
