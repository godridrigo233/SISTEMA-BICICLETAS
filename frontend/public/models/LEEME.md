# Pesos de los modelos faciales

Los usa la librería `@vladmandic/face-api` 1.7.15 (TensorFlow.js 4.22), la misma con la que se extrajeron
los descriptores del Dataset Primario Local UCSM (Fase A) y se calibró θ = 0.37. Los archivos provienen del
repositorio oficial `justadudewhohacks/face-api.js` (carpeta `weights/`, licencia MIT) y son **idénticos byte a
byte** a los que distribuye `@vladmandic/face-api` (verificado con SHA-256 el 27/10/2026; ver
`docs/calidad/MIGRACION_LIBRERIA_FACIAL.md`). Se sirven desde el propio dominio de la SPA para no depender de un
CDN externo (OWASP A08: integridad del software). Si cambia un archivo, hay que recalibrar el umbral θ.

| Modelo | Uso |
|---|---|
| `ssd_mobilenetv1_model` | Detección del rostro (SSD MobileNetV1, confianza > 0.90), el mismo detector usado para conformar el Dataset Primario Local UCSM y calibrar θ = 0.37 |
| `face_landmark_68_model` | 68 puntos faciales para alinear el rostro |
| `face_recognition_model` | Descriptor de 128 valores (red residual tipo ResNet-34) |

**Caché:** Vercel sirve esta carpeta con `Cache-Control: public, max-age=31536000, immutable` (ver `frontend/vercel.json`), para que el navegador no vuelva a descargar ni a revalidar los modelos. Si alguna vez se reemplaza un modelo, hay que cambiar el nombre de sus archivos (o de la carpeta), porque de lo contrario los navegadores seguirían usando la versión guardada.
