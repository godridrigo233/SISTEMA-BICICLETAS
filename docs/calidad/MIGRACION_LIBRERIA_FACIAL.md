# Migración de la librería facial: face-api.js 0.22.2 → @vladmandic/face-api 1.7.15

**Fecha:** 27/10/2026 · **Alcance:** componente biométrico Edge de la SPA (`frontend/src/biometria`)

## Motivo

Los descriptores del Dataset Primario Local UCSM (Fase A), con los que se calibró θ = 0.37, se extrajeron con
`@vladmandic/face-api` 1.7.15 y el detector SSD MobileNetV1. La SPA, en cambio, usaba `face-api.js` 0.22.2,
sin mantenimiento desde 2020 (TensorFlow.js 1.7). En la Fase B, la plantilla v1 (Fase A) se compararía con
capturas v2 de otra librería, una fuente de error que la tesis declaraba como limitación. Con la migración,
la plantilla y la captura provienen de la misma librería.

## Qué no cambia

- **Detector:** SSD MobileNetV1 con confianza mínima de 0.90.
- **Modelos:** los pesos de `frontend/public/models` no se modificaron. Son idénticos byte a byte a los que
  distribuye `@vladmandic/face-api` (los mismos bytes en un solo archivo `.bin` por modelo):

| Modelo | Bytes | SHA-256 de los pesos |
|---|---|---|
| ssd_mobilenetv1_model | 5 616 957 | `2835640602d53718aa6ae9a42896327eaa21beefed056c218d32ca7d79e1e2f8` |
| face_landmark_68_model | 356 840 | `4611ef65c87d836d03d684b30eec4d195d8b219fa1dd58fc58945831c6b9299b` |
| face_recognition_model | 6 444 032 | `b413e420d6840b2775fba32008db6f3cddb07d485967fb42cfcf379c16a8c589` |

- **Umbral:** θ = 0.37 y la regla d ≤ θ en la API.

## Qué cambia

- **Dependencia:** `face-api.js` 0.22.2 → `@vladmandic/face-api` 1.7.15 (TensorFlow.js 4.22, sin
  dependencias transitivas). Se elimina el `override` de `node-fetch` del hallazgo H-01, que ya no es necesario.
  `npm audit --omit=dev`: 0 vulnerabilidades.
- **Versión del modelo:** `version_modelo` pasa a `vlad-1.7.15-ssd`, el mismo valor de las plantillas v1 de la
  Fase A, en el enrolamiento y en `investigacion_capturas`.
- **Tamaño:** el fragmento `vendor-faceapi` pasa de 667 kB (165 kB comprimido) a 1328 kB (340 kB comprimido).
  Se descarga de forma diferida solo en la garita y en el enrolamiento, y queda en caché.

## Verificación (27/10/2026)

Experimento local con Chromium sin interfaz gráfica, sobre las seis imágenes de demostración públicas del
paquete `@vladmandic/face-api` (17 rostros). Las imágenes y los descriptores no se guardaron ni se versionaron.

| Comparación (mismo rostro) | Distancia euclidiana media | Máxima |
|---|---|---|
| face-api.js 0.22.2 frente a @vladmandic 1.7.15, imágenes de 1920 px (CPU y WebGL) | 0.0437 | 0.0623 |
| Misma librería, CPU frente a WebGL | 0.0000 | 0.0000 |
| Aplicación completa (build de producción), cámara simulada de 640 × 480, versión anterior frente a la nueva | 0.0085 | — |

Como referencia, la distancia mínima entre rostros distintos de esas imágenes fue 0.4899, y el margen entre
θ = 0.37 y el par impostor más próximo de la Fase A es de 0.052. La diferencia entre librerías (hasta 0.062)
es del mismo orden que ese margen, lo que confirma la conveniencia de usar en la garita la misma librería de
la calibración.

Flujo real de retiro con el build de producción, la política CSP de `vercel.json` y la cámara simulada:

| Métrica (renderizado por software, sin GPU) | face-api.js 0.22.2 | @vladmandic 1.7.15 |
|---|---|---|
| Garita lista para capturar (descarga y calentamiento) | 18.2 s | 16.5 s |
| Latencia de la captura y extracción | 9.7 s | 6.0 s |
| Infracciones de la CSP | 0 | 0 |

Los tiempos corresponden a un entorno sin aceleración gráfica y solo sirven para comparar ambas versiones;
el cumplimiento de RNF-01 (< 2 s) se mide en la estación de la garita (ST-04 de la Práctica 09).

## Acciones posteriores

- Los descriptores enrolados antes de este cambio (`version_modelo = 'face-api-0.22.2'`, solo cuentas de
  prueba del equipo) deben volver a enrolarse en «Mi registro».
- Antes de la Fase B, verificar en la garita una captura real con la cámara de la estación.
