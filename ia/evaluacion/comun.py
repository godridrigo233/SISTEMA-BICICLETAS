"""Utilidades compartidas de la Fase B. Los datos personales nunca se versionan (Ley N.º 29733)."""
import json
import openpyxl
import numpy as np

COLUMNAS_FASE_A = ("Codigo_UCSM", "Apellidos_Nombre", "Vector_128D")


def leer_fase_a(ruta_excel):
    """Lee la hoja Vectores_Biometricos. El orden de las filas define Sujeto_01…Sujeto_20."""
    hoja = openpyxl.load_workbook(ruta_excel, data_only=True)["Vectores_Biometricos"]
    filas = list(hoja.iter_rows(values_only=True))
    encabezado = [str(c).strip() if c is not None else "" for c in filas[0]]
    faltan = [c for c in COLUMNAS_FASE_A if c not in encabezado]
    if faltan:
        raise SystemExit(f"Faltan columnas en Vectores_Biometricos: {faltan}")
    idx = {nombre: encabezado.index(nombre) for nombre in encabezado if nombre}
    sujetos = []
    for fila in filas[1:]:
        if not fila[idx["Vector_128D"]]:
            continue
        vector = np.array(json.loads(fila[idx["Vector_128D"]]), dtype=float)
        if vector.shape != (128,) or not np.all(np.isfinite(vector)):
            raise SystemExit(f"Vector inválido en la fila {len(sujetos) + 2}")
        extra = {k: (str(fila[i]).strip() if fila[i] is not None else "") for k, i in idx.items()}
        sujetos.append({
            "seudonimo": f"Sujeto_{len(sujetos) + 1:02d}",
            "codigo": str(fila[idx["Codigo_UCSM"]]).strip(),
            "nombre": str(fila[idx["Apellidos_Nombre"]]).strip(),
            "vector": vector,
            "extra": extra,
        })
    return sujetos
