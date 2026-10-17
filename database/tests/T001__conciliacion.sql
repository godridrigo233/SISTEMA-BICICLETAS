-- Prueba de las funciones de conciliación (CU-06, RF-11). Se ejecuta en CI sobre PostgreSQL 17.
-- Toda la prueba corre dentro de una transacción que se revierte al final.
BEGIN;

INSERT INTO usuarios (id_usuario, id_rol, correo_institucional, password_hash, debe_cambiar_password)
VALUES ('00000000-0000-4000-8000-0000000000a1', 3, 'ci.supervisor@ucsm.edu.pe', 'x', false),
       ('00000000-0000-4000-8000-0000000000a2', 1, 'ci.alumno@ucsm.edu.pe',     'x', false);
INSERT INTO estudiantes VALUES
  ('00000000-0000-4000-8000-0000000000a2', '9999999999', '12345678', 'CI', 'PRUEBA', 'CI');
INSERT INTO bicicletas (id_bicicleta, id_estudiante, codigo_qr, numero_marco, marca_modelo, color)
VALUES ('b0000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a2',
        'b0000000-0000-4000-8000-0000000000d1', 'CI-MARCO-1', 'CI', 'Rojo');

-- Ingreso (FUERA) y retiro con DNI distinto (debe quedar OBSERVADO)
INSERT INTO contingencias_ingreso (id_bicicleta, hora_ingreso_manual, folio_bitacora, id_supervisor, tipo_evento, dni_presentado, origen_carga)
VALUES ('b0000000-0000-4000-8000-0000000000c1', clock_timestamp() - interval '2 hours', 'E-0001',
        '00000000-0000-4000-8000-0000000000a1', 'INGRESO', NULL, 'CSV'),
       ('b0000000-0000-4000-8000-0000000000c1', clock_timestamp() - interval '1 hour',  'E-0002',
        '00000000-0000-4000-8000-0000000000a1', 'RETIRO', '87654321', 'CSV');

DO $$
DECLARE r RECORD; v_estado TEXT;
BEGIN
  FOR r IN SELECT * FROM conciliar_lote('00000000-0000-4000-8000-0000000000a1') LOOP
    RAISE NOTICE '% % -> %', r.folio, r.tipo, r.resultado;
  END LOOP;

  SELECT estado INTO v_estado FROM bicicletas WHERE id_bicicleta = 'b0000000-0000-4000-8000-0000000000c1';
  IF v_estado <> 'DENTRO' THEN RAISE EXCEPTION 'Se esperaba DENTRO tras el ingreso; se obtuvo %', v_estado; END IF;

  IF NOT EXISTS (SELECT 1 FROM contingencias_ingreso WHERE folio_bitacora = 'E-0002' AND estado_conciliacion = 'OBSERVADO') THEN
    RAISE EXCEPTION 'El retiro con DNI distinto debía quedar OBSERVADO';
  END IF;

  IF (SELECT count(*) FROM auditoria_accesos WHERE id_bicicleta = 'b0000000-0000-4000-8000-0000000000c1' AND resultado = 'MANUAL') <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 evento MANUAL';
  END IF;
  RAISE NOTICE 'T001 conciliación: OK';
END $$;

ROLLBACK;
