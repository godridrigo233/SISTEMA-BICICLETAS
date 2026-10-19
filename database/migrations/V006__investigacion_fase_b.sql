-- V006 — Registro de investigación de la Fase B (evaluación operativa del módulo biométrico).
-- Solo se escribe cuando la API tiene Investigacion__FaseBHabilitada=true durante las sesiones del
-- estudio. Guarda el descriptor capturado en la garita (128 valores, nunca imágenes) para calcular
-- fuera de línea las comparaciones genuinas e impostoras. Base legal: consentimiento informado de
-- los participantes (Ley N.º 29733). La tabla se vacía con TRUNCATE al concluir el estudio.
CREATE TABLE investigacion_capturas (
    id_captura            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_estudiante         UUID        NOT NULL REFERENCES estudiantes (id_estudiante) ON DELETE CASCADE,
    id_auditoria          BIGINT      NOT NULL CONSTRAINT uq_investigacion_auditoria UNIQUE
                          REFERENCES auditoria_accesos (id_auditoria),
    vector_embedding      FLOAT8[]    NOT NULL CONSTRAINT chk_investigacion_vector_128
                          CHECK (array_length(vector_embedding, 1) = 128),
    distancia_euclidiana  FLOAT8      NOT NULL,
    latencia_ms           INTEGER,
    version_modelo        VARCHAR(40) NOT NULL,
    capturado_en          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE investigacion_capturas IS
  'Fase B de la tesis: descriptores seudonimizados con consentimiento. Vaciar al concluir el estudio.';

ALTER TABLE investigacion_capturas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON investigacion_capturas FROM anon, authenticated;
