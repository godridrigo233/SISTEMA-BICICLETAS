# Sistema de Control de Accesos de Bicicletas — UCSM

Sistema web de control y prevención de robos de bicicletas mediante códigos QR y
autenticación biométrica facial 1:1: el descriptor facial se extrae en el navegador
(Edge Computing) y la verificación 1:1 se decide en la API.
Proyecto de Fin de Carrera — Escuela Profesional de Ingeniería de Sistemas, UCSM, 2026.

Equipo: Rodrigo Sebastián Gómez Fernández · Christian Joaquín Romero Bejarano.
Asesor: Dr. Néstor Torres Gamarra.

## Arquitectura (Práctica 05)

| Capa (P05)                    | Carpeta                                   | Tecnología                         | Despliegue            |
|-------------------------------|-------------------------------------------|------------------------------------|-----------------------|
| Presentación (SPA)            | `frontend/src/features`, `frontend/src/app` | React 18 + Vite                  | Vercel                |
| Componente biométrico (Edge)  | `frontend/src/biometria`, `frontend/public/models` | face-api.js 0.22.2 + WebGL | Navegador de la garita |
| Lógica de negocio (API REST)  | `backend/src/Bicicletas.Api`, `backend/src/Bicicletas.Application`, `backend/src/Bicicletas.Domain` | ASP.NET Core 10 (LTS) | Render (Docker) |
| Acceso a datos                | `backend/src/Bicicletas.Infrastructure`   | Entity Framework Core 10 + Npgsql  | Render (Docker)       |
| Persistencia                  | `database/migrations`                     | PostgreSQL 17                      | Supabase (Session Pooler, TLS) |

El frontend nunca accede directamente a la base de datos; toda operación pasa por la API REST,
que valida el JWT (claim `id_rol`) y aplica el control de acceso basado en roles (RBAC).

## Estructura del repositorio

```text
sistema-bicicletas/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Pruebas en cada push y PR (BD + API + Web + Sonar)
│   │   └── backup-supabase.yml       # Respaldo diario pg_dump cifrado (AES-256)
│   └── pull_request_template.md
├── frontend/                         # Capa de Presentación + Componente biométrico Edge
│   ├── public/models/                # Pesos de face-api.js servidos desde el propio dominio
│   ├── src/
│   │   ├── app/                      # Enrutador, ProtectedRoute (RBAC), proveedores
│   │   ├── features/                 # Una carpeta por pantalla (W1–W7)
│   │   │   ├── auth/                 # W1 Login unificado y cambio de contraseña
│   │   │   ├── garita/               # W2 Panel Central de Garita (CU-03, CU-04)
│   │   │   ├── contingencias/        # W3 Consola de Regularización (CU-06)
│   │   │   ├── enrolamiento/         # W4 Registro y Enrolamiento (CU-01)
│   │   │   ├── historial/            # W5 Historial de Trazabilidad (CU-02)
│   │   │   ├── monitoreo/            # W6 Monitoreo de Aforo y Reportes (CU-05)
│   │   │   └── usuarios/             # W7 Gestión de Usuarios y Roles
│   │   ├── biometria/                # Carga de modelos y extracción del descriptor 128-D (Edge)
│   │   ├── services/                 # Cliente HTTP (JWT, manejo de 401/403)
│   │   ├── components/               # UI compartida: DataGrid, Badge, ConfirmModal, Banner
│   │   └── hooks/
│   ├── package.json
│   ├── vite.config.js
│   └── sonar-project.properties
├── backend/                          # Capas de Negocio y de Acceso a Datos
│   ├── BicicletasUcsm.sln
│   ├── Dockerfile                    # Imagen multietapa para Render
│   ├── src/
│   │   ├── Bicicletas.Api/           # Controllers, middleware, Program.cs, políticas RBAC
│   │   ├── Bicicletas.Application/   # Servicios de casos de uso, DTO, validaciones, interfaces
│   │   ├── Bicicletas.Domain/        # Entidades, enumeraciones y reglas (estado, biometría)
│   │   └── Bicicletas.Infrastructure/# EF Core (DbContext, repositorios), JWT, BCrypt, CSV
│   └── tests/
│       ├── Bicicletas.UnitTests/         # xUnit: reglas de dominio y servicios
│       └── Bicicletas.IntegrationTests/  # xUnit contra PostgreSQL 17 del pipeline
├── database/
│   ├── migrations/                   # V###__descripcion.sql (fuente de verdad del esquema)
│   ├── seeds/                        # Solo datos sintéticos de desarrollo
│   └── tests/                        # Pruebas SQL de conciliar_contingencia / conciliar_lote
├── ia/
│   └── calibracion/                  # Script de calibración LOSO (los vectores NO se versionan)
├── herramientas/
│   └── garita/                       # Plantilla_Contingencia_Garita.xlsm
└── docs/
    ├── CONVENCIONES.md
    ├── bitacora/                     # Bitácora por sprint (Tabla 46 del libro)
    ├── calidad/                      # Ficha de calidad y registro de hallazgos Sonar
    └── seguimiento/                  # Curva S y control de avance
```

## Ejecución local

```bash
# API
cd backend && dotnet restore && dotnet test && dotnet run --project src/Bicicletas.Api
# Web
cd frontend && npm ci && npm run dev
```

Variables de entorno de la API (nunca en el código; en Render como variables cifradas):
`ConnectionStrings__Principal`, `Jwt__ClaveFirma`, `Jwt__Emisor`, `Cors__OrigenPermitido`,
`Biometria__UmbralTheta` (0.37).

## Protección de datos (Ley N.º 29733)

- No se almacenan ni transmiten imágenes faciales; solo el descriptor de 128 valores (`FLOAT8[]`).
- El descriptor de referencia nunca sale del servidor: el navegador envía el descriptor capturado
  (transitorio, no persistido) y la API calcula la distancia y decide el retiro.
- Este repositorio es **público**: nunca se versionan respaldos, archivos `.env`, cadenas de conexión
  ni vectores del Dataset Primario Local. Los respaldos se publican como artefactos **cifrados**.
