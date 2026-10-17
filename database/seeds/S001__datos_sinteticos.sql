-- S001 — Datos SINTÉTICOS de desarrollo (nunca datos reales: el repositorio es público).
-- Contraseña de todas las cuentas semilla: la define cada desarrollador al ejecutar el seed
-- (variable psql :clave_hash, generada con BCrypt costo 12). Ejemplo:
--   psql -v clave_hash="'$2a$12$...'" -f database/seeds/S001__datos_sinteticos.sql
INSERT INTO usuarios (id_usuario, id_rol, correo_institucional, password_hash, debe_cambiar_password) VALUES
  ('00000000-0000-4000-8000-000000000001', 2, 'seed.garita1@ucsm.edu.pe',   :clave_hash, false),
  ('00000000-0000-4000-8000-000000000002', 3, 'seed.supervisor@ucsm.edu.pe', :clave_hash, false),
  ('00000000-0000-4000-8000-000000000003', 4, 'seed.admin@ucsm.edu.pe',      :clave_hash, false),
  ('00000000-0000-4000-8000-000000000011', 1, 'seed.alumno1@estudiante.ucsm.edu.pe',    :clave_hash, false),
  ('00000000-0000-4000-8000-000000000012', 1, 'seed.alumno2@estudiante.ucsm.edu.pe',    :clave_hash, false);

INSERT INTO estudiantes (id_estudiante, codigo_universitario, dni, nombres, apellidos, facultad) VALUES
  ('00000000-0000-4000-8000-000000000011', '0000000001', '00000001', 'ALUMNO UNO', 'PRUEBA UNO', 'Facultad de Prueba'),
  ('00000000-0000-4000-8000-000000000012', '0000000002', '00000002', 'ALUMNO DOS', 'PRUEBA DOS', 'Facultad de Prueba');

INSERT INTO bicicletas (id_bicicleta, id_estudiante, codigo_qr, numero_marco, marca_modelo, color, estado) VALUES
  ('b0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011',
   'b0000000-0000-4000-8000-0000000000a1', 'SEED-MARCO-0001', 'Marca Prueba 1', 'Rojo',  'FUERA'),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012',
   'b0000000-0000-4000-8000-0000000000a2', 'SEED-MARCO-0002', 'Marca Prueba 2', 'Azul',  'DENTRO');
