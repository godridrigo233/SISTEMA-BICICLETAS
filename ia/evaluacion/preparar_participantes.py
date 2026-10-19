"""
Fase B — Genera, a partir del Excel del Dataset Primario Local UCSM, el SQL que crea las cuentas de
los participantes con su descriptor de la Fase A como plantilla v1 y una bicicleta de estudio DENTRO,
y la hoja de stickers QR para imprimir.

Uso:  python3 preparar_participantes.py Dataset_Primario_Local_UCSM.xlsx
El Excel debe tener en la hoja Vectores_Biometricos, además, las columnas DNI, Facultad y Correo
(si falta Correo se usa <código>@estudiante.ucsm.edu.pe). Si los apellidos compuestos no se separan
bien de los nombres, agregue las columnas Nombres y Apellidos. La salida queda en ./salida/ (ignorada por
Git): ejecute el SQL en el editor SQL de Supabase y no comparta los archivos.
"""
import re
import sys
import uuid
from pathlib import Path

import bcrypt
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

from comun import leer_fase_a

VERSION_MODELO_FASE_A = "vlad-1.7.15-ssd"
ID_ROL_ESTUDIANTE = 1


def sql_texto(valor):
    return "'" + str(valor).replace("'", "''") + "'"


def separar_nombre(completo):
    """«PAREDES ROJAS KEVIN JOAQUIN» → («Kevin Joaquin», «Paredes Rojas»): dos apellidos primero."""
    partes = completo.split()
    apellidos, nombres = partes[:2], partes[2:] or partes[1:]
    return " ".join(nombres).title(), " ".join(apellidos).title()


def nombre_abreviado(nombres, apellidos):
    paterno, *resto = apellidos.split()
    materno = f" {resto[0][0]}." if resto else ""
    return f"{nombres[0]}. {paterno}{materno}"


def validar(sujeto):
    extra = sujeto["extra"]
    dni = extra.get("DNI", "")
    if not re.fullmatch(r"\d{8}", dni):
        raise SystemExit(f"{sujeto['seudonimo']}: el DNI debe tener 8 dígitos")
    if not extra.get("Facultad"):
        raise SystemExit(f"{sujeto['seudonimo']}: falta la facultad")
    correo = extra.get("Correo") or f"{sujeto['codigo']}@estudiante.ucsm.edu.pe"
    if not correo.lower().endswith("@estudiante.ucsm.edu.pe"):
        raise SystemExit(f"{sujeto['seudonimo']}: el correo debe ser @estudiante.ucsm.edu.pe")
    if not re.fullmatch(r"\d{1,10}", sujeto["codigo"]):
        raise SystemExit(f"{sujeto['seudonimo']}: código universitario inválido")
    return dni, extra["Facultad"][:80], correo.lower()


def generar_sql(sujetos):
    lineas = ["-- Fase B: participantes del Dataset Primario Local UCSM. NO versionar (Ley N.º 29733).",
              "BEGIN;"]
    stickers = []
    for s in sujetos:
        dni, facultad, correo = validar(s)
        extra = s["extra"]
        if extra.get("Nombres") and extra.get("Apellidos"):
            nombres, apellidos = extra["Nombres"].title(), extra["Apellidos"].title()
        else:
            nombres, apellidos = separar_nombre(s["nombre"])
        id_usuario, id_bici, qr = uuid.uuid4(), uuid.uuid4(), str(uuid.uuid4())
        # Contraseña aleatoria no comunicada: si el participante necesita ingresar, el Administrador
        # la restablece en W7 y el sistema exige cambiarla en el primer ingreso.
        clave = bcrypt.hashpw(uuid.uuid4().hex.encode(), bcrypt.gensalt(12)).decode().replace("$2b$", "$2a$", 1)
        vector = "{" + ",".join(f"{v:.6f}" for v in s["vector"]) + "}"
        lineas += [
            f"-- {s['seudonimo']}",
            "INSERT INTO usuarios (id_usuario, id_rol, correo_institucional, password_hash, debe_cambiar_password) "
            f"VALUES ('{id_usuario}', {ID_ROL_ESTUDIANTE}, {sql_texto(correo)}, {sql_texto(clave)}, TRUE);",
            "INSERT INTO estudiantes (id_estudiante, codigo_universitario, dni, nombres, apellidos, facultad) "
            f"VALUES ('{id_usuario}', {sql_texto(s['codigo'])}, '{dni}', {sql_texto(nombres[:60])}, "
            f"{sql_texto(apellidos[:60])}, {sql_texto(facultad)});",
            "INSERT INTO bicicletas (id_bicicleta, id_estudiante, codigo_qr, numero_marco, marca_modelo, color, estado, rasgos_distintivos) "
            f"VALUES ('{id_bici}', '{id_usuario}', '{qr}', 'FASEB-{s['seudonimo'][-2:]}', 'Bicicleta de estudio', 'Otro', 'DENTRO', "
            "'Registro de la Fase B de la tesis');",
            "INSERT INTO descriptores_biometricos (id_estudiante, vector_embedding, version_modelo) "
            f"VALUES ('{id_usuario}', '{vector}', '{VERSION_MODELO_FASE_A}');",
        ]
        stickers.append((s["seudonimo"], nombre_abreviado(nombres, apellidos), qr))
    lineas.append("COMMIT;")
    return "\n".join(lineas) + "\n", stickers


def generar_stickers(stickers, ruta):
    """Hoja A4 con 12 stickers (3 × 4): QR del sistema, nombre abreviado y seudónimo."""
    pdf = canvas.Canvas(str(ruta), pagesize=A4)
    ancho, alto = A4
    columnas, filas, celda_w, celda_h = 3, 4, 6.2 * cm, 6.6 * cm
    x0, y0 = (ancho - columnas * celda_w) / 2, alto - 1.5 * cm
    for i, (seudonimo, nombre, qr) in enumerate(stickers):
        if i and i % (columnas * filas) == 0:
            pdf.showPage()
        k = i % (columnas * filas)
        x, y = x0 + (k % columnas) * celda_w, y0 - (k // columnas + 1) * celda_h
        pdf.setDash(2, 2)
        pdf.rect(x + 0.1 * cm, y + 0.1 * cm, celda_w - 0.2 * cm, celda_h - 0.2 * cm)
        pdf.setDash()
        widget = QrCodeWidget(qr, barLevel="M")
        b = widget.getBounds()
        lado = 4.4 * cm
        dibujo = Drawing(lado, lado, transform=[lado / (b[2] - b[0]), 0, 0, lado / (b[3] - b[1]), 0, 0])
        dibujo.add(widget)
        renderPDF.draw(dibujo, pdf, x + (celda_w - lado) / 2, y + 1.5 * cm)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawCentredString(x + celda_w / 2, y + 1.0 * cm, nombre)
        pdf.setFont("Helvetica", 8)
        pdf.drawCentredString(x + celda_w / 2, y + 0.5 * cm, f"UCSM · Fase B · {seudonimo}")
    pdf.save()


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    sujetos = leer_fase_a(sys.argv[1])
    salida = Path(__file__).parent / "salida"
    salida.mkdir(exist_ok=True)
    sql, stickers = generar_sql(sujetos)
    (salida / "participantes_faseb.sql").write_text(sql, encoding="utf-8")
    generar_stickers(stickers, salida / "stickers_faseb.pdf")
    print(f"{len(sujetos)} participantes → salida/participantes_faseb.sql y salida/stickers_faseb.pdf")


if __name__ == "__main__":
    main()
