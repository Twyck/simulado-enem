"""Extrai gabaritos dos PDFs oficiais do INEP para data/gabaritos.json."""
import json, re, subprocess, sys
from pathlib import Path

root = Path(sys.argv[1])
out = {}
ANS = re.compile(r'^([A-E]|anulad[oa])$', re.I)
for pdf in sorted(root.glob('provas/*_GB_*.pdf')):
    m = re.match(r'(\d{4})_GB_impresso_D(\d)_CD(\d+)', pdf.stem)
    year, day = m.group(1), int(m.group(2))
    text = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], capture_output=True, text=True).stdout
    key = {}
    for line in text.splitlines():
        toks = line.split()
        i = 0
        while i < len(toks):
            if toks[i].isdigit() and 1 <= int(toks[i]) <= 180:
                q = int(toks[i]); i += 1
                answers = []
                while i < len(toks) and ANS.match(toks[i]):
                    a = toks[i].upper()
                    answers.append('X' if a.startswith('ANULAD') else a); i += 1
                if answers and str(q) not in key:
                    key[str(q)] = answers if len(answers) > 1 else answers[0]
            else:
                i += 1
    lo, hi = (1, 90) if day == 1 else (91, 180)
    key = {k: v for k, v in key.items() if lo <= int(k) <= hi}
    missing = [q for q in range(lo, hi + 1) if str(q) not in key]
    print(year, day, len(key), 'missing', missing, 'anuladas', [k for k, v in key.items() if v == 'X'])
    out.setdefault(year, {})[f'd{day}'] = key
(root / 'data').mkdir(exist_ok=True)
(root / 'data/gabaritos.json').write_text(json.dumps(out, indent=1))
