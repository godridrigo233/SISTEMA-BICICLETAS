"""
Fase B — Contraste de la hipótesis H1 (θ = 0.37): FMR ≤ 1 % (cota superior del IC 95 % de
Clopper-Pearson) y FNMR ≤ 5 %, sobre las capturas en garita registradas con el modo de investigación.

Uso:  python3 evaluar_fase_b.py Dataset_Primario_Local_UCSM.xlsx capturas_faseb.csv

capturas_faseb.csv se exporta desde el editor SQL de Supabase con la consulta de LEEME.md. Para cada
sujeto se usa su PRIMER intento válido (protocolo: un intento por sujeto). Genuina = v2 del sujeto
frente a su propia v1 (Fase A); impostora = v2 del sujeto frente a la v1 de cada uno de los otros
(20 × 19 = 380). Escribe salida/resultados_faseb.md con las Tablas 21 a 24 de la tesis.
"""
import csv
import sys
from pathlib import Path

import numpy as np
from scipy.stats import beta

from comun import leer_fase_a

THETA = 0.37
FMR_MAX, FNMR_MAX = 0.01, 0.05


def clopper_pearson(k, n, confianza=0.95):
    a = 1 - confianza
    bajo = 0.0 if k == 0 else beta.ppf(a / 2, k, n - k + 1)
    alto = 1.0 if k == n else beta.ppf(1 - a / 2, k + 1, n - k)
    return bajo, alto


def leer_capturas(ruta):
    primeras = {}
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        for fila in sorted(csv.DictReader(f), key=lambda r: r["capturado_en"]):
            codigo = fila["codigo_universitario"].strip()
            if codigo in primeras:
                continue
            vector = np.array([float(x) for x in fila["vector_embedding"].strip("{}[]").split(",")])
            if vector.shape != (128,):
                raise SystemExit(f"Vector inválido para el código terminado en {codigo[-3:]}")
            latencia = fila.get("latencia_ms", "").strip()
            primeras[codigo] = {
                "v2": vector,
                "distancia_sistema": float(fila["distancia_euclidiana"]),
                "latencia": int(latencia) if latencia else None,
                "resultado_sistema": fila.get("resultado", "").strip(),
            }
    return primeras


def pct(x):
    return f"{100 * x:.2f} %"


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    sujetos = leer_fase_a(sys.argv[1])
    capturas = leer_capturas(sys.argv[2])
    presentes = [s for s in sujetos if s["codigo"] in capturas]
    ausentes = [s["seudonimo"] for s in sujetos if s["codigo"] not in capturas]

    genuinas, impostoras, avisos = [], [], []
    for s in presentes:
        c = capturas[s["codigo"]]
        d = float(np.linalg.norm(c["v2"] - s["vector"]))
        if abs(d - c["distancia_sistema"]) > 1e-3:
            avisos.append(f"{s['seudonimo']}: la distancia del sistema ({c['distancia_sistema']:.4f}) no coincide con la "
                          f"recalculada ({d:.4f}); verifique que su plantilla v1 sea el descriptor de la Fase A.")
        genuinas.append(d)
        for otro in sujetos:
            if otro is not s:
                impostoras.append(float(np.linalg.norm(c["v2"] - otro["vector"])))

    g, im = np.array(genuinas), np.array(impostoras)
    ng, ni = len(g), len(im)
    fa = int((im <= THETA).sum())          # falsas aceptaciones (impostor autorizado)
    fr = int((g > THETA).sum())            # falsos rechazos (titular denegado)
    ta, tr = ng - fr, ni - fa
    fmr, fnmr = fa / ni, fr / ng
    fmr_ic, fnmr_ic = clopper_pearson(fa, ni), clopper_pearson(fr, ng)
    acc = (ta + tr) / (ng + ni)
    acc_ic = clopper_pearson(ta + tr, ng + ni)
    acc_bal = ((1 - fmr) + (1 - fnmr)) / 2
    lat = np.array([capturas[s["codigo"]]["latencia"] for s in presentes if capturas[s["codigo"]]["latencia"] is not None])

    cumple_fmr = fmr_ic[1] <= FMR_MAX
    cumple_fnmr = fnmr <= FNMR_MAX
    rechaza_h0 = cumple_fmr and cumple_fnmr

    md = [f"# Resultados de la Fase B (θ = {THETA})", "",
          f"Sujetos con captura válida: {ng} de {len(sujetos)}." + (f" Sin captura: {', '.join(ausentes)}." if ausentes else ""),
          "", "## Tabla 21. Matriz de confusión", "",
          "| Tipo de comparación | Autorizado | Denegado | Total |", "|---|---|---|---|",
          f"| Genuina | {ta} | {fr} | {ng} |", f"| Impostora | {fa} | {tr} | {ni} |",
          f"| Total | {ta + fa} | {fr + tr} | {ng + ni} |",
          "", "## Tabla 22. Métricas con IC 95 % (Clopper-Pearson)", "",
          "| Métrica | Valor | IC 95 % |", "|---|---|---|",
          f"| FMR | {pct(fmr)} ({fa}/{ni}) | {pct(fmr_ic[0])} – {pct(fmr_ic[1])} |",
          f"| FNMR | {pct(fnmr)} ({fr}/{ng}) | {pct(fnmr_ic[0])} – {pct(fnmr_ic[1])} |",
          f"| Accuracy | {pct(acc)} | {pct(acc_ic[0])} – {pct(acc_ic[1])} |",
          f"| Accuracy balanceada | {pct(acc_bal)} | — |",
          "", "## Tabla 23. Distancias genuinas", "",
          "| Estadístico | Valor |", "|---|---|",
          f"| Mínimo | {g.min():.4f} |", f"| Media | {g.mean():.4f} |",
          f"| Desviación estándar | {g.std(ddof=1):.4f} |" if ng > 1 else "| Desviación estándar | — |",
          f"| Máximo | {g.max():.4f} |", f"| Comparaciones genuinas con d > {THETA} | {fr} |",
          f"| Distancia impostora mínima (referencia) | {im.min():.4f} |",
          "", "## Tabla 24. Latencia (captura facial → decisión de la API, RNF-01 < 2000 ms)", ""]
    if len(lat):
        md += ["| Estadístico | Latencia (ms) |", "|---|---|",
               f"| Media | {lat.mean():.0f} |", f"| Mediana | {np.median(lat):.0f} |",
               f"| Desviación estándar | {lat.std(ddof=1):.0f} |" if len(lat) > 1 else "| Desviación estándar | — |",
               f"| Percentil 95 | {np.percentile(lat, 95):.0f} |", f"| Máximo | {lat.max():.0f} |",
               f"| Intentos ≥ 2000 ms | {int((lat >= 2000).sum())} de {len(lat)} |"]
    else:
        md.append("Sin mediciones de latencia.")
    md += ["", "## Decisión sobre la hipótesis", "",
           f"- Criterio FMR: cota superior del IC 95 % = {pct(fmr_ic[1])} → {'cumple' if cumple_fmr else 'NO cumple'} (≤ 1 %).",
           f"- Criterio FNMR: {pct(fnmr)} → {'cumple' if cumple_fnmr else 'NO cumple'} (≤ 5 %).",
           f"- **{'Se rechaza H0: se acepta H1' if rechaza_h0 else 'No se rechaza H0'}.**"]
    if ni < 368:
        md.append(f"- Advertencia: con {ni} comparaciones impostoras, la cota superior del FMR no puede bajar de 1 % "
                  "aunque no haya falsas aceptaciones (se requieren ≥ 368, es decir, los 20 sujetos).")
    if avisos:
        md += ["", "## Avisos de consistencia", ""] + [f"- {a}" for a in avisos]

    salida = Path(__file__).parent / "salida"
    salida.mkdir(exist_ok=True)
    (salida / "resultados_faseb.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
