import * as pdfjs from '../node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import { parseRoster } from '../js/parser.js';
const file = process.argv[2];
const r = await parseRoster(pdfjs, new Uint8Array(fs.readFileSync(file)));
console.log(JSON.stringify(r, null, 1));
