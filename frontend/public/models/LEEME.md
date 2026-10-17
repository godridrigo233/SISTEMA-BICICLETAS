# Pesos de face-api.js 0.22.2

Copiados sin modificar del repositorio oficial `justadudewhohacks/face-api.js` (carpeta `weights/`,
licencia MIT). Se sirven desde el propio dominio de la SPA para no depender de un CDN externo
(OWASP A08: integridad del software). Si cambia un archivo, hay que recalibrar el umbral θ.

| Modelo | Uso |
|---|---|
| `tiny_face_detector_model` | Detección rápida del rostro en el video de la garita |
| `face_landmark_68_model` | 68 puntos faciales para alinear el rostro |
| `face_recognition_model` | Descriptor de 128 valores (red residual tipo ResNet-34) |
