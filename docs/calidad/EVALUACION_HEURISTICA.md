# Evaluación heurística de usabilidad (10 heurísticas de Nielsen)

**Fecha:** 25/10/2026 · **Versión evaluada:** rama `main` (commit f9317fd) · **Evaluadores:** equipo del proyecto

## Método

Se recorrieron las pantallas W1–W7 con cada rol (Estudiante, Garitero, Supervisor y Administrador) en el build de producción, en escritorio (1366 × 768, la resolución de la estación de garita) y en móvil (390 × 844), incluidos los estados de error, vacío, confirmación y resultado. Cada problema se asoció a una heurística de Nielsen (1994) y se calificó con su escala de severidad:

| Severidad | Significado |
| --- | --- |
| 0 | No es un problema de usabilidad |
| 1 | Cosmético: se corrige si hay tiempo |
| 2 | Menor: prioridad baja |
| 3 | Mayor: prioridad alta |
| 4 | Catastrófico: debe corregirse antes de liberar |

Criterio de aceptación: ningún hallazgo de severidad ≥ 2 abierto.

## Hallazgos

| ID | Pantalla | Problema | Heurística | Sev. | Corrección | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| HU-01 | W2 Garita (retiro) | En 1366 × 768 la cámara y «Capturar y verificar» quedan fuera de la vista: el vigilante debe desplazarse en cada retiro | H7 Flexibilidad y eficiencia | 3 | La verificación se desplaza a la vista y el botón recibe el foco (Enter captura) | Corregido |
| HU-02 | W2 Garita (retiro denegado) | Tras un DENEGADO no hay forma de cancelar el flujo | H3 Control y libertad | 2 | Botón «Cancelar» también en el estado denegado | Corregido |
| HU-03 | W2 Garita (retiro) | «Distancia», «Umbral θ» y el valor numérico en el mensaje de denegación | H2 Lenguaje del usuario | 2 | «Diferencia con el rostro registrado: 0.68 · Se acepta hasta 0.37»; mensaje sin cifras | Corregido |
| HU-04 | W2 Garita | Ayuda «Formato UUID (36 caracteres)… (CU-03, 2a)» | H2 Lenguaje del usuario | 2 | «Si el lector no logra leer el sticker, escriba el código impreso debajo del QR y pulse Enter» | Corregido |
| HU-05 | Encabezado de garita | «Garita Operativa» y «Puesto activo» son fijos y no reflejan el estado real | H1 Visibilidad del estado | 2 | Indicador real: «En línea» / «Sin conexión: use la plantilla de contingencia» (también en las demás pantallas cuando se pierde la conexión) | Corregido |
| HU-06 | Encabezados (móvil y escritorio) | En móvil el encabezado de garita desborda; en ambos tamaños se ven a la vez los botones ☰ y ‹ | H8 Diseño minimalista / H4 Consistencia | 2 | Cada botón solo en su dispositivo; encabezado compacto en móvil | Corregido |
| HU-07 | W4 Registro | «Completar registro» deshabilitado con un texto genérico; no indica qué falta | H1 / H5 Prevención de errores | 2 | Lista de requisitos con su estado (✓ / pendiente) | Corregido |
| HU-08 | W4 Registro | «Descriptor: capturado (128 / 128)» | H2 Lenguaje del usuario | 2 | «Rostro capturado correctamente» | Corregido |
| HU-09 | W7 Usuarios | «Restablecer contraseña» sin confirmación invalida al instante la contraseña vigente | H5 Prevención de errores | 2 | Diálogo de confirmación con la consecuencia | Corregido |
| HU-10 | W6 Monitoreo | Dice «en tiempo real», pero no se actualiza solo ni indica cuándo se actualizó | H1 Visibilidad del estado | 2 | Indicadores cada minuto y «Actualizado a las HH:MM» | Corregido |
| HU-11 | W6 Monitoreo | «Latencia», «Distancia»; tiempos en ms en la tabla y en s en el indicador | H2 / H4 | 2 | «Tiempo promedio de verificación», «Diferencia facial», «Tiempo» en segundos | Corregido |
| HU-12 | W3 Contingencias | Concordancia: «1 filas», «1 listas», «1 movimientos» | H4 Consistencia | 1 | Singular y plural correctos | Corregido |
| HU-13 | W3 y W7 | Jerga técnica en ayudas: UTF-8, UUID, carga ETL, hash BCrypt, borrado lógico, RBAC | H2 Lenguaje del usuario | 1 | Textos en lenguaje del usuario | Corregido |
| HU-14 | W1 Login | No advierte que 5 intentos fallidos bloquean la cuenta 15 minutos | H5 Prevención de errores | 1 | Aviso permanente bajo la contraseña: «Por seguridad, tras 5 intentos fallidos la cuenta se bloquea durante 15 minutos» (asociado al campo con aria-describedby) | Corregido |
| HU-15 | W2 Garita | El estado aparece dos veces (insignia y «Estado actual») | H8 Diseño minimalista | 1 | — | Aceptado: refuerzo intencional en el dato más crítico |
| HU-16 | W6 Monitoreo | En 1366 px la tabla de eventos requiere desplazamiento horizontal para ver las últimas columnas | H8 | 1 | Tabla compacta: menor relleno de celdas, folio debajo del tipo de registro, código sin estilo monoespaciado y correo divisible antes de «@». Medido con Playwright: ancho requerido 1205 → 1056 px en 1366 × 768 y 970 px en 1280 × 720, sin desplazamiento horizontal | Corregido |
| HU-17 | General | La ayuda contextual es breve; no hay una guía por rol dentro del sistema | H10 Ayuda y documentación | 1 | Se atiende con el manual de usuario por rol (P11) | Pendiente |

**Resultado:** 15 hallazgos corregidos (1 de severidad 3, 10 de severidad 2 y 4 de severidad 1); quedan 2 de severidad 1 (HU-15 aceptado por diseño y HU-17, que se atiende con el manual de usuario de la P11), sin hallazgos ≥ 2 abiertos. HU-14 y HU-16 se corrigieron en un segundo incremento (26/10/2026).

## Cumplimiento por heurística (después de las correcciones)

| Heurística | Evidencia en el sistema |
| --- | --- |
| H1 Visibilidad del estado | Indicador de conexión; «Preparando el reconocimiento facial…»; estados «Validando…», «Verificando…», «Guardando…»; hora de actualización del monitoreo; lista de requisitos del registro |
| H2 Relación con el mundo real | Términos de la garita (sticker, DENTRO / FUERA, folio, bitácora); fechas en hora de Lima; sin jerga técnica en la operación |
| H3 Control y libertad | «Cancelar» en ingreso, retiro (incluido el denegado), importación del CSV y diálogos; «Reintentar captura» |
| H4 Consistencia y estándares | Mismo patrón de etiquetas de estado y botones en todas las pantallas; login con el estilo institucional UCSM; plurales correctos |
| H5 Prevención de errores | Aviso previo del bloqueo por 5 intentos fallidos; confirmación antes de importar, conciliar, inactivar y restablecer; DNI de 8 dígitos; botones deshabilitados con explicación; sin fechas futuras ni mayores a 72 h |
| H6 Reconocer antes que recordar | Autocompletado de la bicicleta en el CSV y en el registro manual; DNI del titular mostrado parcialmente al revisar; motivos frecuentes con un clic |
| H7 Flexibilidad y eficiencia | Lector 2D con Enter; foco automático en «Registrar ingreso» y en «Capturar y verificar»; validación automática del CSV; «Importar y conciliar» en un paso |
| H8 Estética y diseño minimalista | Garita a pantalla completa sin menú para el Garitero; encabezados compactos en móvil; tabla de eventos de W6 sin desplazamiento horizontal en 1280–1366 px |
| H9 Reconocer, diagnosticar y recuperarse de errores | Mensajes específicos y accionables («El DNI debe tener 8 dígitos», «Hay más de un rostro en el encuadre…», «Sin conexión: use la plantilla de contingencia») |
| H10 Ayuda y documentación | Ayudas breves junto a cada campo; plantilla descargable; manual técnico y manual de usuario (P11) |

## Referencia

Nielsen, J. (1994). *Usability engineering*. Morgan Kaufmann.
