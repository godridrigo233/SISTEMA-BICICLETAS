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

// Menú de la barra superior por rol (P07, mapa de navegación). El Garitero solo opera la Garita.
export const MENU_POR_ROL = Object.freeze({
  [ROL.ESTUDIANTE]: [['/estudiante/historial', 'Mi historial'], ['/estudiante/registro', 'Mi registro']],
  [ROL.GARITERO]: [],
  [ROL.SUPERVISOR]: [['/garita/control-acceso', 'Garita'], ['/supervisor/contingencias', 'Contingencias'], ['/gestion/monitoreo', 'Monitoreo']],
  [ROL.ADMINISTRADOR]: [['/gestion/monitoreo', 'Monitoreo'], ['/admin/usuarios', 'Usuarios'], ['/garita/control-acceso', 'Garita'], ['/supervisor/contingencias', 'Contingencias']],
});
