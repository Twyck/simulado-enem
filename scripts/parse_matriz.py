"""Extrai as 30 habilidades de cada área da Matriz de Referência do ENEM (PDF do INEP) → data/habilidades.json.
Uso: python3 parse_matriz.py <app> <matriz_referencia.pdf>"""
import json, re, subprocess, sys
from pathlib import Path

app, pdf = Path(sys.argv[1]), sys.argv[2]
text = subprocess.run(['pdftotext', pdf, '-'], capture_output=True, text=True).stdout
AREAS = [('LC', 'Linguagens'), ('MT', 'Matemática'), ('CN', 'Ciências da Natureza'), ('CH', 'Ciências Humanas')]
starts = [(text.index(f'Matriz de Referência de {name}'), area) for area, name in AREAS]
starts.sort()
out = {}
for i, (pos, area) in enumerate(starts):
    end = starts[i + 1][0] if i + 1 < len(starts) else len(text)
    block = text[pos:end].split('ANEXO')[0]
    comp_of, comps = {}, {}
    # competências e habilidades: cada uma vai até o próximo marcador
    for m in re.finditer(r'(Competência de área (\d+)|H(\d+))\s*[-–]\s*(.+?)(?=\n\s*(?:Competência de área \d+|H\d+)\s*[-–]|\Z)', block, re.S):
        desc = re.sub(r'\s+', ' ', m.group(4)).strip()
        desc = re.sub(r'\s*\d+\s*$', '', desc)  # número de página que vaza no fim
        if m.group(2):
            current = int(m.group(2)); comps[current] = desc
        else:
            comp_of[int(m.group(3))] = (current, desc)
    out[area] = {'competencias': comps, 'habilidades': {h: {'c': c, 'd': d} for h, (c, d) in sorted(comp_of.items())}}
    print(area, len(comps), 'competências', len(comp_of), 'habilidades')
(app / 'data/habilidades.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
