import { ROL } from '../../app/rutasPorRol';

/**
 * Guía rápida por rol: resume las tareas del Manual de Usuario (Práctica 11) con los mismos nombres de botones
 * que muestran las pantallas. Si cambia un texto de la interfaz, se actualiza aquí y en el manual.
 */
const GARITA = [
  {
    tarea: 'Registrar el ingreso de una bicicleta',
    pasos: [
      'Con el cursor en «Código QR de la bicicleta», lea el sticker con el lector.',
      'Coteje la bicicleta con la ficha y pulse «Registrar ingreso».',
    ],
  },
  {
    tarea: 'Autorizar el retiro con verificación facial',
    pasos: [
      'Lea el QR de la bicicleta: si figura DENTRO, se abre la verificación facial.',
      'Pida al estudiante que mire de frente a la cámara, solo y con buena luz: la captura es automática.',
      'Si el rostro coincide, el retiro se autoriza y la bicicleta pasa a FUERA.',
    ],
  },
  {
    tarea: 'Si el sistema rechaza al dueño o no hay conexión',
    pasos: [
      'Corrija la posición o la luz y pulse «Reintentar captura».',
      'Si el rechazo persiste, pulse «Derivar al supervisor»: la bicicleta permanece DENTRO.',
      'Sin conexión, anote cada movimiento en la plantilla de contingencia o en la bitácora, verificando DNI, rostro y sticker.',
    ],
  },
];

export const GUIAS_POR_ROL = Object.freeze({
  [ROL.ESTUDIANTE]: [
    {
      tarea: 'Registrar su bicicleta y su rostro',
      pasos: [
        'Entre a «Mi registro» y complete marca y modelo, color y número de marco.',
        'Acepte el consentimiento y pulse «Capturar rostro»: mire de frente, sin lentes ni mascarilla.',
        'Pulse «Completar registro» y luego «Descargar sticker QR»; péguelo en el tubo de la bicicleta.',
      ],
    },
    {
      tarea: 'Registrar otra bicicleta',
      pasos: ['En «Mi registro», pulse «Registrar otra bicicleta», complete los datos y pulse «Registrar bicicleta».'],
    },
    {
      tarea: 'Consultar sus movimientos',
      pasos: ['Entre a «Mi historial»; para buscar, elija las fechas o el tipo y pulse «Filtrar».'],
    },
  ],
  [ROL.GARITERO]: GARITA,
  [ROL.SUPERVISOR]: [
    ...GARITA,
    {
      tarea: 'Autorizar un retiro manual con DNI',
      pasos: [
        'En una verificación derivada, abra «Retiro manual (Supervisor)».',
        'Verifique el DNI o carné físico, escriba el DNI del titular y pulse «Autorizar retiro manual».',
      ],
    },
    {
      tarea: 'Regularizar los movimientos anotados sin conexión',
      pasos: [
        'En «Contingencias», importe el archivo CSV de la garita y pulse «Importar y conciliar».',
        'Agregue los movimientos de la bitácora en papel con «Agregar al lote» y pulse «Conciliar lote».',
        'Resuelva los casos OBSERVADO con «Revisar».',
      ],
    },
    {
      tarea: 'Revisar los indicadores y exportar el reporte',
      pasos: ['En «Monitoreo», filtre por fechas, tipo o resultado y pulse «Exportar CSV».'],
    },
  ],
  [ROL.ADMINISTRADOR]: [
    {
      tarea: 'Crear una cuenta del personal',
      pasos: [
        'En «Usuarios», escriba el correo @ucsm.edu.pe, elija el rol y pulse «Crear cuenta».',
        'Entregue en persona la contraseña temporal: se muestra una sola vez.',
      ],
    },
    {
      tarea: 'Restablecer una contraseña',
      pasos: ['En la fila de la cuenta, pulse «Restablecer contraseña» y confirme.'],
    },
    {
      tarea: 'Inactivar o reactivar una cuenta',
      pasos: [
        'Desmarque o marque la casilla de la cuenta y confirme.',
        'Al inactivar a un estudiante se elimina su rostro registrado. No puede inactivar su propia cuenta.',
      ],
    },
  ],
});
