-- V007 — D-19 (pruebas de sistema, ST-07, 02/11/2026): coherencia cronológica de la conciliación.
--
-- Defecto: un RETIRO anotado a las 12:10 y un INGRESO a las 12:15 de la misma bicicleta se
-- conciliaron en orden inverso. El retiro se evaluó cuando la bicicleta figuraba FUERA, pero la
-- regla del DNI se aplicaba antes que la del estado y lo dejó OBSERVADO en vez de CONFLICTO; al
-- resolverse después del ingreso, se aplicó con su hora original y la auditoría quedó con la
-- secuencia RETIRO 12:10 → INGRESO 12:15, incoherente con el estado final de la bicicleta.
--
-- Corrección (misma firma; las llamadas de la API no cambian):
--   1. Un movimiento manual con hora anterior al último movimiento auditado de la bicicleta es
--      CONFLICTO: la auditoría solo admite eventos posteriores al último registrado.
--   2. El estado de la bicicleta se valida antes que el DNI, de modo que un retiro de una
--      bicicleta que figura FUERA es CONFLICTO y no OBSERVADO.
-- Las demás reglas (OBSERVADO por DNI distinto, confirmación con motivo, huella MANUAL) se mantienen.

CREATE OR REPLACE FUNCTION conciliar_contingencia(p_id uuid, p_supervisor uuid, p_confirmado_titular boolean DEFAULT false, p_motivo character varying DEFAULT NULL::character varying) RETURNS character varying
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  c          contingencias_ingreso%ROWTYPE;
  v_estado   VARCHAR(10);
  v_dni      CHAR(8);
  v_ultimo   TIMESTAMPTZ;
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

  -- El bloqueo de la bicicleta serializa la conciliación con la garita (aislamiento).
  SELECT b.estado, e.dni INTO v_estado, v_dni
    FROM bicicletas b JOIN estudiantes e ON e.id_estudiante = b.id_estudiante
   WHERE b.id_bicicleta = c.id_bicicleta
     FOR UPDATE OF b;

  SELECT max(a.timestamp_evento) INTO v_ultimo
    FROM auditoria_accesos a
   WHERE a.id_bicicleta = c.id_bicicleta;

  -- 1. Hora anterior al último movimiento registrado -> CONFLICTO
  IF v_ultimo IS NOT NULL AND c.hora_ingreso_manual < v_ultimo THEN
    UPDATE contingencias_ingreso
       SET motivo_observacion = 'Conflicto: la hora anotada es anterior al último movimiento registrado ('
                                || to_char(v_ultimo AT TIME ZONE 'America/Lima', 'DD/MM/YYYY HH24:MI') || ')'
     WHERE id_contingencia = p_id;
    RETURN 'CONFLICTO';
  END IF;

  -- 2. Estado incompatible -> CONFLICTO (queda PENDIENTE con el motivo)
  IF (c.tipo_evento = 'INGRESO' AND v_estado <> 'FUERA') OR
     (c.tipo_evento = 'RETIRO'  AND v_estado <> 'DENTRO') THEN
    UPDATE contingencias_ingreso
       SET motivo_observacion = 'Conflicto: la bicicleta figura ' || v_estado
     WHERE id_contingencia = p_id;
    RETURN 'CONFLICTO';
  END IF;

  -- 3. Retiro con DNI distinto al del titular -> OBSERVADO (no se toca la bicicleta)
  IF c.tipo_evento = 'RETIRO' AND c.dni_presentado IS DISTINCT FROM v_dni
     AND NOT p_confirmado_titular THEN
    UPDATE contingencias_ingreso
       SET estado_conciliacion = 'OBSERVADO',
           motivo_observacion  = 'DNI no coincide con el titular'
     WHERE id_contingencia = p_id;
    RETURN 'OBSERVADO';
  END IF;

  -- 4. Movimiento válido: cambia el estado, deja huella MANUAL y concilia
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

-- CREATE OR REPLACE conserva los privilegios; se reafirma la restricción de V003 (OWASP A01).
REVOKE EXECUTE ON FUNCTION conciliar_contingencia(uuid, uuid, boolean, varchar) FROM PUBLIC, anon, authenticated;
