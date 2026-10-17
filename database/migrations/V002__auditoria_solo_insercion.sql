-- V002 — Bitácora inmutable: auditoria_accesos solo admite INSERT (P06, sección 2.3).
CREATE FUNCTION bloquear_cambios_auditoria() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'auditoria_accesos es de solo inserción: no se permite %', TG_OP;
END $$;

CREATE TRIGGER trg_auditoria_solo_insercion
    BEFORE DELETE OR UPDATE ON auditoria_accesos
    FOR EACH ROW EXECUTE FUNCTION bloquear_cambios_auditoria();
