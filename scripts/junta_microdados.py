"""Junta as saídas de build_acertos.py (uma por ano) em data/acertos.json e acrescenta as distribuições
de notas a data/percentis.json. Uso: python3 junta_microdados.py <app> <dir-com-ANO.json-e-pct_ANO.json>"""
import json, sys
from pathlib import Path

app, src = Path(sys.argv[1]), Path(sys.argv[2])
acertos, pct = {}, json.loads((app / 'data/percentis.json').read_text())
for f in sorted(src.glob('[0-9][0-9][0-9][0-9].json')):
    d = json.loads(f.read_text())
    acertos[str(d['year'])] = {'d1': d['d1'], 'd2': d['d2']}
for f in sorted(src.glob('pct_*.json')):
    d = json.loads(f.read_text())
    pct[str(d['year'])] = {k: d[k] for k in ('LC', 'CH', 'CN', 'MT', 'd1', 'd2')}
(app / 'data/acertos.json').write_text(json.dumps(acertos, separators=(',', ':')))
(app / 'data/percentis.json').write_text(json.dumps(dict(sorted(pct.items())), separators=(',', ':')))
print('acertos', sorted(acertos), 'percentis', sorted(pct))
