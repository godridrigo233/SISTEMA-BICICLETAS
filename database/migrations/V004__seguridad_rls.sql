-- V004 — Row Level Security habilitado sin políticas: los roles públicos de Supabase (anon,
-- authenticated) no pueden leer ni escribir ninguna tabla; el único acceso es el de la API REST.
ALTER TABLE roles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bicicletas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE descriptores_biometricos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_accesos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contingencias_ingreso    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
