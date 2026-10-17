-- V003 — Conciliación de contingencias (CC-08, CC-10): funciones atómicas por fila y vista de monitoreo.
-- Copiadas del esquema vigente en Supabase (respaldo del 17/10/2026).

CREATE FUNCTION conciliar_contingencia(p_id uuid, p_supervisor uuid, p_confirmado_titular boolean DEFAULT false, p_motivo character varying DEFAULT NULL::character varying) RETURNS character varying
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  c          contingencias_ingreso%ROWTYPE;
  v_estado   VARCHAR(10);
  v_dni      CHAR(8);
  v_id_aud   BIGINT;
BEGIN
  SELECT * INTO c FROM contingencias_ingreso WHERE id_contingencia = p_id FOR UPDATE;
  IF NOT FOUND
     OR NOT (c.estado_conciliacion = 'PENDIENTE'
             OR (c.estado_conciliacion = 'OBSERVADO' AND p_confirmado_titular)) THEN
    RETURN 'NO_PENDIENTE';
  END IF;
  IF p_confirmado_titular AND coalesce(trim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'La confirmación del titular requiere un motivo';
  END IF;

  SELECT b.estado, e.dni INTO v_estado, v_dni
    FROM bicicletas b JOIN estudiantes e ON e.id_estudiante = b.id_estudiante
   WHERE b.id_bicicleta = c.id_bicicleta
     FOR UPDATE OF b;

  -- Retiro con DNI distinto al del titular -> OBSERVADO (no se toca la bicicleta)
  IF c.tipo_evento = 'RETIRO' AND c.dni_presentado IS DISTINCT FROM v_dni
     AND NOT p_confirmado_titular THEN
    UPDATE contingencias_ingreso
       SET estado_conciliacion = 'OBSERVADO',
           motivo_observacion  = 'DNI no coincide con el titular'
     WHERE id_contingencia = p_id;
    RETURN 'OBSERVADO';
  END IF;

  -- Estado incompatible -> CONFLICTO (queda PENDIENTE con el motivo)
  IF (c.tipo_evento = 'INGRESO' AND v_estado <> 'FUERA') OR
     (c.tipo_evento = 'RETIRO'  AND v_estado <> 'DENTRO') THEN
    UPDATE contingencias_ingreso
       SET motivo_observacion = 'Conflicto: la bicicleta figura ' || v_estado
     WHERE id_contingencia = p_id;
    RETURN 'CONFLICTO';
  END IF;

  -- Movimiento válido: cambia el estado, deja huella MANUAL y concilia
  UPDATE bicicletas
     SET estado = CASE WHEN c.tipo_evento = 'INGRESO' THEN 'DENTRO' ELSE 'FUERA' END
   WHERE id_bicicleta = c.id_bicicleta;

  INSERT INTO auditoria_accesos
         (id_bicicleta, tipo_evento, distancia_euclidiana, id_vigilante, resultado, timestamp_evento)
  VALUES (c.id_bicicleta, c.tipo_evento, NULL,
          COALESCE(c.id_vigilante, p_supervisor), 'MANUAL', c.hora_ingreso_manual)
  RETURNING id_auditoria INTO v_id_aud;

  UPDATE contingencias_ingreso
     SET estado_conciliacion = 'CONCILIADO',
         id_auditoria        = v_id_aud,
         id_supervisor       = p_supervisor,
         motivo_observacion  = p_motivo
   WHERE id_contingencia = p_id;

  RETURN 'CONCILIADO';
END $$;

CREATE FUNCTION conciliar_lote(p_supervisor uuid) RETURNS TABLE(folio character varying, tipo character varying, resultado character varying)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id_contingencia, folio_bitacora, tipo_evento
      FROM contingencias_ingreso
     WHERE estado_conciliacion = 'PENDIENTE'
     ORDER BY hora_ingreso_manual, (tipo_evento = 'RETIRO')
  LOOP
    folio := r.folio_bitacora;
    tipo  := r.tipo_evento;
    resultado := conciliar_contingencia(r.id_contingencia, p_supervisor);
    RETURN NEXT;
  END LOOP;
END $$;

CREATE VIEW v_monitoreo_auditoria WITH (security_invoker='true') AS
 SELECT a.id_auditoria,
    a.timestamp_evento,
    a.tipo_evento,
    a.resultado,
    a.distancia_euclidiana,
    a.latencia_ms,
    a.id_bicicleta,
    a.id_vigilante,
        CASE
            WHEN ((a.resultado)::text <> 'MANUAL'::text) THEN 'AUTOMATICO'::text
            WHEN (c.id_contingencia IS NOT NULL) THEN 'CONTINGENCIA'::text
            ELSE 'DERIVACION'::text
        END AS registro,
    c.folio_bitacora AS folio
   FROM (auditoria_accesos a
     LEFT JOIN contingencias_ingreso c ON ((c.id_auditoria = a.id_auditoria)));

-- Solo la API REST (rol de conexión del backend) puede ejecutar la conciliación (OWASP A01).
REVOKE EXECUTE ON FUNCTION conciliar_contingencia(uuid, uuid, boolean, varchar) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION conciliar_lote(uuid) FROM PUBLIC, anon, authenticated;
