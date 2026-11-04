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
| Centrado | Centro del rostro a ≤ 30 % del centro del encuadre y rostro completo en el encuadre | Sí | Sí |
| Giro lateral | Distancia nariz–mandíbula menor / mayor | ≥ 0.55 | ≥ 0.65 |
| Cabeceo | (nariz − ojos) / (mentón − ojos) entre 0.18 y 0.60 | Sí | Sí |
| Inclinación | Ángulo de la línea de los ojos | ≤ 18° | ≤ 12° |
| Iluminación | Luminancia media del rostro entre 75 y 225 (0–255) | Sí | Sí |

## Flujo

- **Retiro (W2):** la captura es automática. El análisis empieza cuando el video de la cámara está listo
  (readyState ≥ 3); antes, la librería se quedaba esperando un evento que los videos no emiten. El video se
  analiza cada 200 ms y el descriptor se calcula cuando el rostro cumple los criterios en al menos 4 de los
  últimos 6 análisis y en el último (≈ 1 s), lo que tolera el temblor normal de los puntos faciales. La pantalla
  indica al vigilante qué corregir («Pida al estudiante que mire de frente a la cámara»). Si a los 10 s no se
  logra, se avisa del último problema y se ofrece además la captura manual (respaldo, sin control de calidad),
  pero la captura automática sigue intentando.
- **Diagnóstico:** con `?diagnostico` en la dirección de la página, la garita muestra las métricas de cada
  análisis, para ajustar los umbrales en el ensayo previo a la Fase B.
- **Enrolamiento (W4):** al pulsar «Capturar rostro», dos capturas automáticas con los criterios más exigentes
  (hasta 20 s cada una). Solo se acepta si la
  distancia entre ambas es ≤ 0.25; se conserva una sola (la primera), igual que en la calibración de θ, y la
  segunda se descarta.
- **Cámara:** se solicita 1280 × 720 cuando el equipo lo permite (antes, el valor por defecto, 640 × 480).

## Iluminación

Con poca luz, el descriptor del titular se aleja del de referencia (en las pruebas, distancias cercanas a 0.40
que se rechazaban con θ = 0.37 y mejoraban al iluminar el rostro). No se sube θ: la menor distancia impostora
de la Fase A fue 0.4220. En su lugar:

- **Mínimo de luz:** el control no captura si la luminancia del rostro es menor de 75 e indica «Falta luz».
- **Exposición automática de la cámara:** si el rostro está oscuro, la página sube un paso la compensación de
  exposición (o el brillo) de la cámara, cuando el navegador y la cámara exponen ese control (Chrome con muchas
  webcams en Windows y Android). Es un ajuste de la adquisición, como mejorar la luz; la imagen no se procesa.
- **Pantalla encendida:** se solicita el bloqueo de pantalla (Screen Wake Lock) para que el equipo no atenúe la
  pantalla durante la verificación.
- **Luz de pantalla en el enrolamiento:** durante la captura, la pantalla se pone en blanco alrededor del video
  para iluminar el rostro de quien la mira. Una página web no puede subir el brillo del dispositivo; solo una
  aplicación nativa podría hacerlo.
- **Garita:** la pantalla mira al vigilante, no al estudiante, por lo que la luz de pantalla no lo ilumina. Se
  recomienda una fuente de luz frontal (panel LED o aro de luz) junto a la cámara como requisito de instalación.

## Latencia (RNF-01)

`latencia_ms` empieza a contarse cuando se inicia el cálculo del descriptor que se envía; el tiempo de espera
hasta que el rostro queda en posición no se cuenta, porque no depende del sistema. La API suma su tiempo de
decisión. Es la misma definición que tenía la captura con clic.

## Implicaciones para la evaluación (Fase B)

- El control debe quedar fijo antes de la Fase B, para que la evaluación mida el sistema final.
- Conforme a ISO/IEC 19795-1, además del FMR y el FNMR se reporta la **tasa de fallo de adquisición (FTA)**:
  proporción de intentos en los que no se logró una captura automática apta y se usó la captura manual o la
  derivación.
- Antes de la Fase B se recomienda un ensayo de 10 retiros con un titular enrolado para confirmar que los
  umbrales no bloquean capturas frontales y que la latencia se mantiene por debajo de 2 s.
