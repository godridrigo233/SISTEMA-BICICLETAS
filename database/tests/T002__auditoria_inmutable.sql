-- Prueba de inmutabilidad de la bitácora (P06, 2.3): UPDATE y DELETE deben ser rechazados.
BEGIN;
INSERT INTO usuarios (id_usuario, id_rol, correo_institucional, password_hash)
VALUES ('00000000-0000-4000-8000-0000000000b1', 2, 'ci.garita@ucsm.edu.pe', 'x'),
       ('00000000-0000-4000-8000-0000000000b2', 1, 'ci.alumno2@ucsm.edu.pe', 'x');
INSERT INTO estudiantes VALUES ('00000000-0000-4000-8000-0000000000b2', '8888888888', '11112222', 'CI', 'DOS', 'CI');
INSERT INTO bicicletas (id_bicicleta, id_estudiante, codigo_qr, numero_marco, marca_modelo, color)
VALUES ('b0000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000b2',
        'b0000000-0000-4000-8000-0000000000e2', 'CI-MARCO-2', 'CI', 'Azul');
INSERT INTO auditoria_accesos (id_bicicleta, tipo_evento, id_vigilante, resultado)
VALUES ('b0000000-0000-4000-8000-0000000000e1', 'INGRESO', '00000000-0000-4000-8000-0000000000b1', 'EXITOSO');

DO $$
BEGIN
  BEGIN
    UPDATE auditoria_accesos SET resultado = 'DENEGADO';
    RAISE EXCEPTION 'FALLA: se permitió UPDATE sobre auditoria_accesos';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALLA:%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM auditoria_accesos;
    RAISE EXCEPTION 'FALLA: se permitió DELETE sobre auditoria_accesos';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALLA:%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'T002 auditoría solo inserción: OK';
END $$;
ROLLBACK;
