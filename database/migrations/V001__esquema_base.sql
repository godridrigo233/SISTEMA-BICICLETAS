-- V001 — Esquema base del sistema (línea base vigente en Supabase al 17/10/2026, incluye CC-05, CC-08 y CC-10).
-- PostgreSQL 17. Llaves UUID (gen_random_uuid), descriptor biométrico FLOAT8[128], QR VARCHAR(36).

CREATE TABLE roles (
    id_rol       SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_rol   VARCHAR(20)  NOT NULL CONSTRAINT roles_nombre_rol_key UNIQUE,
    descripcion  VARCHAR(100) NOT NULL
);

CREATE TABLE usuarios (
    id_usuario             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_rol                 SMALLINT     NOT NULL REFERENCES roles (id_rol),
    correo_institucional   VARCHAR(100) NOT NULL CONSTRAINT usuarios_correo_institucional_key UNIQUE,
    password_hash          VARCHAR(255) NOT NULL,
    activo                 BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en              TIMESTAMPTZ  DEFAULT clock_timestamp(),
    debe_cambiar_password  BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE estudiantes (
    id_estudiante         UUID PRIMARY KEY REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
    codigo_universitario  VARCHAR(10) NOT NULL CONSTRAINT estudiantes_codigo_universitario_key UNIQUE,
    dni                   CHAR(8)     NOT NULL CONSTRAINT estudiantes_dni_key UNIQUE,
    nombres               VARCHAR(60) NOT NULL,
    apellidos             VARCHAR(60) NOT NULL,
    facultad              VARCHAR(80) NOT NULL
);

CREATE TABLE bicicletas (
    id_bicicleta        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_estudiante       UUID         NOT NULL REFERENCES estudiantes (id_estudiante),
    codigo_qr           VARCHAR(36)  NOT NULL CONSTRAINT bicicletas_codigo_qr_key UNIQUE,
    numero_marco        VARCHAR(40)  NOT NULL CONSTRAINT bicicletas_numero_marco_key UNIQUE,
    marca_modelo        VARCHAR(50)  NOT NULL,
    color               VARCHAR(25)  NOT NULL,
    estado              VARCHAR(10)  NOT NULL DEFAULT 'FUERA'
                        CONSTRAINT bicicletas_estado_check CHECK (estado IN ('DENTRO', 'FUERA')),
    rasgos_distintivos  VARCHAR(100)
);

CREATE TABLE descriptores_biometricos (
    id_descriptor      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_estudiante      UUID        NOT NULL CONSTRAINT descriptores_biometricos_id_estudiante_key UNIQUE
                       REFERENCES estudiantes (id_estudiante) ON DELETE CASCADE,
    vector_embedding   FLOAT8[]    NOT NULL CONSTRAINT chk_vector_128 CHECK (array_length(vector_embedding, 1) = 128),
    version_modelo     VARCHAR(20) NOT NULL,
    actualizado_en     TIMESTAMPTZ DEFAULT clock_timestamp(),
    consentimiento_en  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE auditoria_accesos (
    id_auditoria          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_bicicleta          UUID        NOT NULL REFERENCES bicicletas (id_bicicleta),
    tipo_evento           VARCHAR(10) NOT NULL
                          CONSTRAINT auditoria_accesos_tipo_evento_check CHECK (tipo_evento IN ('INGRESO', 'RETIRO')),
    distancia_euclidiana  FLOAT8,
    id_vigilante          UUID        NOT NULL REFERENCES usuarios (id_usuario),
    resultado             VARCHAR(15) NOT NULL
                          CONSTRAINT chk_resultado CHECK (resultado IN ('EXITOSO', 'DENEGADO', 'MANUAL')),
    timestamp_evento      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    latencia_ms           INTEGER
);

CREATE TABLE contingencias_ingreso (
    id_contingencia      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_bicicleta         UUID         NOT NULL REFERENCES bicicletas (id_bicicleta),
    hora_ingreso_manual  TIMESTAMPTZ  NOT NULL,
    folio_bitacora       VARCHAR(20)  NOT NULL,
    id_supervisor        UUID         NOT NULL REFERENCES usuarios (id_usuario),
    estado_conciliacion  VARCHAR(12)  NOT NULL DEFAULT 'PENDIENTE',
    timestamp_carga      TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    tipo_evento          VARCHAR(10)  NOT NULL DEFAULT 'INGRESO',
    dni_presentado       CHAR(8),
    motivo_observacion   VARCHAR(200),
    id_vigilante         UUID REFERENCES usuarios (id_usuario),
    id_auditoria         BIGINT CONSTRAINT uq_contingencia_auditoria UNIQUE REFERENCES auditoria_accesos (id_auditoria),
    origen_carga         VARCHAR(10)  NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT chk_estado_conciliacion  CHECK (estado_conciliacion IN ('PENDIENTE', 'CONCILIADO', 'OBSERVADO')),
    CONSTRAINT chk_tipo_contingencia    CHECK (tipo_evento IN ('INGRESO', 'RETIRO')),
    CONSTRAINT chk_dni_formato          CHECK (dni_presentado IS NULL OR dni_presentado ~ '^[0-9]{8}$'),
    CONSTRAINT chk_dni_retiro           CHECK (tipo_evento = 'INGRESO' OR dni_presentado IS NOT NULL),
    CONSTRAINT chk_origen_carga         CHECK (origen_carga IN ('CSV', 'MANUAL')),
    CONSTRAINT chk_conciliado_auditoria CHECK ((estado_conciliacion = 'CONCILIADO') = (id_auditoria IS NOT NULL)),
    CONSTRAINT chk_ventana_72h          CHECK (hora_ingreso_manual >= timestamp_carga - INTERVAL '72 hours'
                                           AND hora_ingreso_manual <= timestamp_carga + INTERVAL '5 minutes'),
    CONSTRAINT uq_movimiento_contingencia UNIQUE (id_bicicleta, tipo_evento, hora_ingreso_manual)
);

-- Índices B-Tree de consulta operativa (RNF-01)
CREATE INDEX idx_bicicletas_qr          ON bicicletas (codigo_qr);
CREATE INDEX idx_bicicletas_marco       ON bicicletas (numero_marco);
CREATE INDEX idx_auditoria_bicicleta    ON auditoria_accesos (id_bicicleta);
CREATE INDEX idx_contingencias_estado   ON contingencias_ingreso (estado_conciliacion, hora_ingreso_manual);
