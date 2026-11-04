# Control de calidad y captura automática del rostro

## Propósito

Reducir los rechazos de titulares legítimos causados por capturas de baja calidad (rostro girado, lejano,
descentrado o mal iluminado). En las pruebas de sistema del 02/11/2026 se registraron dos rechazos del titular
legítimo (distancias de 0.4885 y 0.4970) por no mirar de frente a la cámara.

## Qué no cambia

- Librería y detector: @vladmandic/face-api 1.7.15, SSD MobileNetV1 con confianza mínima de 0.90.
- Modelos y descriptor de 128 valores (FLOAT8[128]); `version_modelo` = `vlad-1.7.15-ssd`.
- Umbral de decisión θ = 0.37 y decisión en la API.
- No se guarda ni se envía ninguna imagen. La medición del brillo reduce la zona del rostro a 32 × 32 en un
  lienzo en memoria, que se limpia al terminar.

Por eso no se recalibra θ: el control solo decide **cuándo** se captura, no **cómo** se calcula ni se compara
el descriptor.

## Criterios (`frontend/src/biometria/calidadCaptura.js`)

| Criterio | Medida (a partir de la caja y los 68 puntos faciales) | Retiro | Enrolamiento |
|---|---|---|---|
| Distancia | Ancho del rostro ≥ 90 px y ≥ 12 % del ancho del video; ≤ 75 % | Sí | Sí |
| Centrado | Centro del rostro a ≤ 25 % del centro del encuadre y rostro completo en el encuadre | Sí | Sí |
| Giro lateral | Distancia nariz–mandíbula menor / mayor ≥ 0.6 | 0.6 | 0.7 |
| Cabeceo | (nariz − ojos) / (mentón − ojos) entre 0.20 y 0.55 | Sí | Sí |
| Inclinación | Ángulo de la línea de los ojos ≤ 15° | 15° | 10° |
| Iluminación | Luminancia media del rostro entre 60 y 210 (0–255) | Sí | Sí |

## Flujo

- **Retiro (W2):** la captura es automática. El video se analiza cada 200 ms y el descriptor se calcula solo
  cuando el rostro cumple los criterios durante 5 análisis seguidos (≈ 1 s). Mientras tanto, la pantalla indica
  al vigilante qué corregir («Pida al estudiante que mire de frente a la cámara»). Si en 10 s no se logra, se
  informa el último problema y se ofrecen la captura manual (respaldo, sin control de calidad) o reanudar la
  captura automática.
- **Enrolamiento (W4):** dos capturas automáticas con los criterios más exigentes. Solo se acepta si la
  distancia entre ambas es ≤ 0.25; se conserva una sola (la primera), igual que en la calibración de θ, y la
  segunda se descarta.
- **Cámara:** se solicita 1280 × 720 cuando el equipo lo permite (antes, el valor por defecto, 640 × 480).

## Latencia (RNF-01)

`latencia_ms` empieza a contarse cuando se inicia el cálculo del descriptor que se envía; el tiempo de espera
hasta que el rostro queda en posición no se cuenta, porque no depende del sistema. La API suma su tiempo de
decisión. Es la misma definición que tenía la captura con clic.

## Implicaciones para la evaluación (Fase B)

- El control debe quedar fijo antes de la Fase B, para que la evaluación mida el sistema final.
- Conforme a ISO/IEC 19795-1, además del FMR y el FNMR se reporta la **tasa de fallo de adquisición (FTA)**:
  proporción de intentos en los que no se logró una captura apta en el tiempo previsto (TIEMPO_AGOTADO) y se
  usó la captura manual o la derivación.
- Antes de la Fase B se recomienda un ensayo de 10 retiros con un titular enrolado para confirmar que los
  umbrales no bloquean capturas frontales y que la latencia se mantiene por debajo de 2 s.
