"""Parâmetros TRI (a, b, c) e habilidade de cada questão do caderno Azul → data/itens.json.
Lê ITENS_PROVA_<ano>.csv de dentro dos microdados do INEP (sem baixar o zip inteiro).
Uso: python3 build_itens.py <app> [dir-com-ITENS_<ano>.csv já extraídos]"""
import csv, io, json, sys
from collections import defaultdict
from pathlib import Path

app = Path(sys.argv[1])
cache = Path(sys.argv[2]) if len(sys.argv) > 2 else None
gab = json.loads((app / 'data/gabaritos.json').read_text())
DAY = {'LC': 'd1', 'CH': 'd1', 'CN': 'd2', 'MT': 'd2'}

def itens_csv(year):
    if cache and (cache / f'ITENS_{year}.csv').exists():
        return (cache / f'ITENS_{year}.csv').read_text(encoding='latin-1')
    sys.path.insert(0, str(Path(__file__).parent))
    from inep_zip import open_zip
    z = open_zip(year)
    name = next(i.filename for i in z.infolist() if 'ITENS_PROVA' in i.filename and i.filename.endswith('.csv'))
    return z.read(name).decode('latin-1')

out = {}
for year in sorted(gab):
    rows = list(csv.DictReader(io.StringIO(itens_csv(year)), delimiter=';'))
    provas = defaultdict(list)
    for r in rows:
        if r['TX_COR'] == 'AZUL': provas[(r['SG_AREA'], r['CO_PROVA'])].append(r)
    for area, day in DAY.items():
        # o caderno Azul da 1ª aplicação é o que tem o gabarito idêntico ao PDF oficial
        def score(items):
            ok = 0
            for r in items:
                k = gab[year][day].get(r['CO_POSICAO'])
                if isinstance(k, list): k = k[0 if r['TP_LINGUA'] == '0' else 1]
                ok += k in (r['TX_GABARITO'], 'X')
            return ok / len(items)
        cands = sorted(((score(v), cp) for (a, cp), v in provas.items() if a == area), reverse=True)
        best, code = cands[0]
        assert best == 1.0, f'{year} {area}: nenhum caderno Azul bate com o gabarito ({cands[:2]})'
        for r in provas[(area, code)]:
            n = int(r['CO_POSICAO'])
            qid = f"{n}{'en' if r['TP_LINGUA'] == '0' else 'es'}" if area == 'LC' and n <= 5 else str(n)
            item = {'h': int(r['CO_HABILIDADE']) if r['CO_HABILIDADE'] else None}
            if r['IN_ITEM_ABAN'] == '1' or not r['NU_PARAM_A']:
                item['aban'] = True  # anulada: fica fora do cálculo
            else:
                item.update(a=round(float(r['NU_PARAM_A']), 5), b=round(float(r['NU_PARAM_B']), 5), c=round(float(r['NU_PARAM_C']), 5))
            out.setdefault(year, {}).setdefault(day, {})[qid] = item
        print(year, area, 'caderno', code, len(provas[(area, code)]), 'itens')
(app / 'data/itens.json').write_text(json.dumps(out, separators=(',', ':')))
