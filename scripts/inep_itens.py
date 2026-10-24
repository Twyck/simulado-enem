"""Posição de um item do ITENS_PROVA no caderno. Em 2017 o INEP numera dentro de cada área
(CH, CN e MT de 1 a 45; LC de 1 a 50, com 1–5 inglês e 6–10 espanhol); nos outros anos, de 1 a 180."""
INICIO = {'LC': 0, 'CH': 45, 'CN': 90, 'MT': 135}

def relativo(itens):
    return min(int(r['CO_POSICAO']) for r in itens if r['SG_AREA'] == 'CH') == 1

def posicao(r, rel):
    """(número da questão no caderno, 'en'/'es' para as 5 primeiras de LC, senão None)"""
    p, area = int(r['CO_POSICAO']), r['SG_AREA']
    if rel:
        if area == 'LC':
            if p <= 10: return (p if p <= 5 else p - 5), ('en' if p <= 5 else 'es')
            return p - 5, None
        return p + INICIO[area], None
    if area == 'LC' and p <= 5: return p, ('en' if r['TP_LINGUA'] == '0' else 'es')
    return p, None
