# Fase B — Evaluación operativa del módulo biométrico (tesis, sección 4.6.7)

Contrasta H1 con θ = 0.37: **FMR ≤ 1 %** (cota superior del IC 95 % de Clopper-Pearson) y **FNMR ≤ 5 %**.
Cada uno de los 20 sujetos realiza un intento de retiro en la garita con el sistema real; su descriptor
nuevo (v2) se compara con su propia plantilla de la Fase A (20 genuinas) y con la de los otros 19
(380 impostoras).

> **Datos personales (Ley N.º 29733).** El Excel del Dataset Primario Local UCSM, el SQL generado,
> los stickers y el CSV exportado **nunca** se suben al repositorio (público). `.gitignore` excluye
> `ia/**/*.xlsx`, `*.csv` e `ia/evaluacion/salida/`. Requisitos: `pip install numpy scipy openpyxl bcrypt reportlab`.

## Antes de la sesión
1. **Migración V006** — en el editor SQL de Supabase, ejecutar `database/migrations/V006__investigacion_fase_b.sql`.
2. **Participantes** — agregar al Excel (hoja `Vectores_Biometricos`) las columnas `DNI`, `Facultad` y, si
   no es `<código>@estudiante.ucsm.edu.pe`, `Correo`. Luego:
   ```
   python3 preparar_participantes.py Dataset_Primario_Local_UCSM.xlsx
   ```
   Ejecutar `salida/participantes_faseb.sql` en Supabase (crea cuenta, plantilla v1 de la Fase A y una
   bicicleta de estudio DENTRO por sujeto) e imprimir `salida/stickers_faseb.pdf`.
3. **Activar el modo de investigación** — en Render, variable `Investigacion__FaseBHabilitada=true`
   (el servicio se reinicia solo).

## Durante la sesión (protocolo de la tesis)
- Garita bajo techo, misma computadora y cámara, a la altura del rostro y a 50–80 cm; franja horaria similar; sin contraluz.
- Sin gorra, mascarilla ni lentes oscuros. El Garitero escanea el sticker del sujeto → «Capturar rostro».
- **Un intento válido por sujeto.** Si no se detecta el rostro (confianza ≤ 0.90), hasta 3 reintentos, que se
  anotan como fallas de adquisición. Un rechazo con rostro detectado **no se repite**.
- Anotar en la hoja de registro: sujeto, hora, iluminación (sol/sombra/nublado), lentes (sí/no) y resultado.

## Después de la sesión
1. **Desactivar** el modo: `Investigacion__FaseBHabilitada=false` en Render.
2. **Exportar** en el editor SQL de Supabase y descargar como `capturas_faseb.csv`:
   ```sql
   SELECT e.codigo_universitario, c.vector_embedding, c.distancia_euclidiana, c.latencia_ms,
          a.resultado, c.capturado_en
   FROM investigacion_capturas c
   JOIN estudiantes e ON e.id_estudiante = c.id_estudiante
   JOIN auditoria_accesos a ON a.id_auditoria = c.id_auditoria
   ORDER BY c.capturado_en;
   ```
3. **Evaluar**:
   ```
   python3 evaluar_fase_b.py Dataset_Primario_Local_UCSM.xlsx capturas_faseb.csv
   ```
   Genera `salida/resultados_faseb.md` con las Tablas 21 a 24 y la decisión sobre H0/H1. El script avisa si
   la distancia registrada por el sistema no coincide con la recalculada (plantilla v1 distinta de la Fase A).
4. **Al concluir el estudio**, vaciar la tabla: `TRUNCATE investigacion_capturas;`
