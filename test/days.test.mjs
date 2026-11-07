import * as pdfjs from '../node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import { parseRoster } from '../js/parser.js';
import { buildDays, trips, toICS } from '../js/model.js';
const r = await parseRoster(pdfjs, new Uint8Array(fs.readFileSync(process.argv[2])));
const s = { leaveHours: 3 };
for (const d of buildDays(r, s)) console.log(d.date, d.kind.padEnd(8), d.label, d.sub || '');
for (const t of trips(r, s)) console.log('TRIP', t.title, 'leave', t.leave, 'dep', t.depStamp, 'return', t.returnStamp);
console.log(toICS([r], s).split('\r\n').slice(0, 16).join('\n'));
