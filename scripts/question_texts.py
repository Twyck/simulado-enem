"""Junta o OCR das páginas por questão (usando o layout) → textos.json. Uso: python3 question_texts.py <app> <dir-ocr>"""
import json, re, sys
from pathlib import Path

app, ocr = Path(sys.argv[1]), Path(sys.argv[2])
out = {}
for f in sorted(ocr.glob('*_PV_*.json')):
    year, day = re.match(r'(\d{4})_PV_impresso_D(\d)', f.name).groups()
    layout = json.loads((app / f'data/layout/{year}_d{day}.json').read_text())
    pages = layout['pages']
    key = lambda p, x, y: (p, 0 if x < pages[p - 1]['mid'] - 5 else 1, -y)
    heads = sorted((key(q['p'], q['x'], q['y']), q['id']) for q in layout['questions'].values())
    texts = {}
    for img, lines in json.loads(f.read_text()).items():
        p = int(re.search(r'p-(\d+)', img).group(1))
        W, H = pages[p - 1]['w'], pages[p - 1]['h']
        for t, bx, by, bw, bh in lines:
            k = key(p, bx * W, by * H + 0.5)  # base da linha: o cabeçalho "QUESTÃO N" fica com a própria questão
            owner = None
            for hk, qid in heads:
                if hk <= k: owner = qid
                else: break
            if owner and by * H > 60 and (by + bh) * H < H - 30:
                texts.setdefault(owner, []).append(t)
    out.setdefault(year, {})[f'd{day}'] = {q: ' '.join(v) for q, v in texts.items()}
    print(year, day, len(texts))
Path(sys.argv[3] if len(sys.argv) > 3 else 'textos.json').write_text(json.dumps(out, ensure_ascii=False))
