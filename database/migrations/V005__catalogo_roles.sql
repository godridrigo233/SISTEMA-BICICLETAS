-- V005 — Catálogo RBAC (id_rol: 1 Estudiante, 2 Garitero, 3 Supervisor, 4 Administrador).
INSERT INTO roles (nombre_rol, descripcion) VALUES
  ('Estudiante',    'Usuario ciclista con permisos de lectura'),
  ('Garitero',      'Operador de vigilancia y control en puerta'),
  ('Supervisor',    'Oficial de seguridad con permisos de regularización'),
  ('Administrador', 'Control total de configuración y auditoría');
