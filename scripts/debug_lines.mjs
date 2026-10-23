import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
const [file, p, re] = process.argv.slice(2);
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
const tc = await (await doc.getPage(+p)).getTextContent();
const items = tc.items;
items.forEach((it, i) => { if (new RegExp(re, 'i').test(it.str)) for (let j = Math.max(0, i - 2); j <= i + 3; j++) console.log(i === j ? '>' : ' ', JSON.stringify(items[j]?.str), items[j]?.transform.map(v => +v.toFixed(1)).join(','), +items[j]?.width.toFixed(1)); });
