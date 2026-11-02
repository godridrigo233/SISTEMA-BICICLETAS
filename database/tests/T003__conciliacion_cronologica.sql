-- D-19: la conciliación no aplica movimientos anteriores al último evento auditado ni retiros de una
-- bicicleta que figura FUERA (escenario reproducido de la prueba de sistema ST-07 del 02/11/2026).
-- Toda la prueba corre dentro de una transacción que se revierte al final.
BEGIN;

INSERT INTO usuarios (id_usuario, id_rol, correo_institucional, password_hash, debe_cambiar_password)
VALUES ('00000000-0000-4000-8000-0000000000b1', 3, 'ci.supervisor3@ucsm.edu.pe', 'x', false),
       ('00000000-0000-4000-8000-0000000000b2', 1, 'ci.alumno3@ucsm.edu.pe',     'x', false);
INSERT INTO estudiantes VALUES
  ('00000000-0000-4000-8000-0000000000b2', '9999999993', '11112222', 'CI', 'PRUEBA', 'CI');
INSERT INTO bicicletas (id_bicicleta, id_estudiante, codigo_qr, numero_marco, marca_modelo, color, estado)
VALUES ('b0000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000b2',
        'b0000000-0000-4000-8000-0000000000f1', 'CI-MARCO-3', 'CI', 'Rojo', 'FUERA');

-- Último movimiento real: retiro automático hace 60 min (la bicicleta figura FUERA).
INSERT INTO auditoria_accesos (id_bicicleta, tipo_evento, distancia_euclidiana, id_vigilante, resultado, timestamp_evento)
VALUES ('b0000000-0000-4000-8000-0000000000e1', 'RETIRO', 0.21, '00000000-0000-4000-8000-0000000000b1', 'EXITOSO',
        clock_timestamp() - interval '60 minutes');

-- Bitácora con el retiro anotado ANTES que el ingreso y con un DNI equivocado.
INSERT INTO contingencias_ingreso (id_bicicleta, hora_ingreso_manual, folio_bitacora, id_supervisor, tipo_evento, dni_presentado, origen_carga)
VALUES ('b0000000-0000-4000-8000-0000000000e1', clock_timestamp() - interval '50 minutes', 'E-0102',
        '00000000-0000-4000-8000-0000000000b1', 'RETIRO', '12345678', 'CSV'),
       ('b0000000-0000-4000-8000-0000000000e1', clock_timestamp() - interval '45 minutes', 'E-0101',
        '00000000-0000-4000-8000-0000000000b1', 'INGRESO', NULL, 'CSV');

DO $$
DECLARE
  r          RECORD;
  v_id       uuid;
  v_res      TEXT;
  v_motivo   TEXT;
  v_estado   TEXT;
BEGIN
  FOR r IN SELECT * FROM conciliar_lote('00000000-0000-4000-8000-0000000000b1') LOOP
    RAISE NOTICE '% % -> %', r.folio, r.tipo, r.resultado;
    IF r.folio = 'E-0102' AND r.resultado <> 'CONFLICTO' THEN
      RAISE EXCEPTION 'El retiro de una bicicleta FUERA debía ser CONFLICTO (no %)', r.resultado;
    END IF;
    IF r.folio = 'E-0101' AND r.resultado <> 'CONCILIADO' THEN
      RAISE EXCEPTION 'El ingreso debía conciliarse (no %)', r.resultado;
    END IF;
  END LOOP;

  -- Revisión posterior con el DNI corregido: el retiro (hace 50 min) es anterior al ingreso conciliado (hace 45 min).
  SELECT id_contingencia INTO v_id FROM contingencias_ingreso WHERE folio_bitacora = 'E-0102';
  UPDATE contingencias_ingreso SET dni_presentado = '11112222' WHERE id_contingencia = v_id;
  v_res := conciliar_contingencia(v_id, '00000000-0000-4000-8000-0000000000b1', false, 'Error de digitación corregido');
  SELECT motivo_observacion INTO v_motivo FROM contingencias_ingreso WHERE id_contingencia = v_id;
  IF v_res <> 'CONFLICTO' OR v_motivo NOT LIKE 'Conflicto: la hora anotada es anterior%' THEN
    RAISE EXCEPTION 'Un retiro anterior al último movimiento debía ser CONFLICTO por hora (resultado %, motivo %)', v_res, v_motivo;
  END IF;

  SELECT estado INTO v_estado FROM bicicletas WHERE id_bicicleta = 'b0000000-0000-4000-8000-0000000000e1';
  IF v_estado <> 'DENTRO' THEN RAISE EXCEPTION 'Se esperaba DENTRO tras el ingreso; se obtuvo %', v_estado; END IF;

  IF EXISTS (SELECT 1 FROM auditoria_accesos
              WHERE id_bicicleta = 'b0000000-0000-4000-8000-0000000000e1' AND tipo_evento = 'RETIRO' AND resultado = 'MANUAL') THEN
    RAISE EXCEPTION 'No debía auditarse el retiro manual fuera de secuencia';
  END IF;

  -- La secuencia auditada alterna RETIRO → INGRESO, sin dos movimientos iguales seguidos.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT tipo_evento, lag(tipo_evento) OVER (ORDER BY timestamp_evento) AS anterior
        FROM auditoria_accesos
       WHERE id_bicicleta = 'b0000000-0000-4000-8000-0000000000e1' AND resultado <> 'DENEGADO') s
     WHERE s.tipo_evento = s.anterior) THEN
    RAISE EXCEPTION 'La auditoría contiene dos movimientos del mismo tipo seguidos';
  END IF;

  -- Un retiro posterior y con el DNI correcto se sigue conciliando con normalidad (sin regresión).
  INSERT INTO contingencias_ingreso (id_bicicleta, hora_ingreso_manual, folio_bitacora, id_supervisor, tipo_evento, dni_presentado, origen_carga)
  VALUES ('b0000000-0000-4000-8000-0000000000e1', clock_timestamp() - interval '30 minutes', 'E-0103',
          '00000000-0000-4000-8000-0000000000b1', 'RETIRO', '11112222', 'CSV')
  RETURNING id_contingencia INTO v_id;
  v_res := conciliar_contingencia(v_id, '00000000-0000-4000-8000-0000000000b1');
  IF v_res <> 'CONCILIADO' THEN RAISE EXCEPTION 'Un retiro posterior y con DNI correcto debía conciliarse (no %)', v_res; END IF;

  RAISE NOTICE 'T003 conciliación cronológica: OK';
END $$;

ROLLBACK;
