export const ROL = Object.freeze({ ESTUDIANTE: 1, GARITERO: 2, SUPERVISOR: 3, ADMINISTRADOR: 4 });

// Pantalla inicial de cada perfil (P07, Figura 1).
export const RUTA_INICIO_POR_ROL = Object.freeze({
  [ROL.ESTUDIANTE]: '/estudiante/historial',
  [ROL.GARITERO]: '/garita/control-acceso',
  [ROL.SUPERVISOR]: '/garita/control-acceso',
  [ROL.ADMINISTRADOR]: '/gestion/monitoreo',
});

export const NOMBRE_ROL = Object.freeze({
  [ROL.ESTUDIANTE]: 'Estudiante',
  [ROL.GARITERO]: 'Garitero',
  [ROL.SUPERVISOR]: 'Supervisor',
  [ROL.ADMINISTRADOR]: 'Administrador',
});
