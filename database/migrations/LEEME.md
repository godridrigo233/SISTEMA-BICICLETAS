# Migraciones

| Archivo | Contenido | Origen |
|---|---|---|
| `V001__esquema_base.sql` | 7 tablas con UUID, FLOAT8[128], CHECK, UNIQUE e índices B-Tree | P06 + CC-05, CC-08, CC-10 |
| `V002__auditoria_solo_insercion.sql` | Trigger que rechaza UPDATE/DELETE en `auditoria_accesos` | P06 |
| `V003__cc08_cc10_conciliacion.sql` | `conciliar_contingencia`, `conciliar_lote`, `v_monitoreo_auditoria`, REVOKE | CC-08, CC-10 |
| `V004__seguridad_rls.sql` | RLS habilitado sin políticas para anon/authenticated | P05 (OWASP A01) |
| `V005__catalogo_roles.sql` | Catálogo RBAC de 4 roles | P06 |

V001–V005 constituyen la línea base del esquema vigente en Supabase al 17/10/2026 (verificada contra
el respaldo de esa fecha). A partir de aquí, todo cambio es una migración nueva `V006__...`;
una migración integrada a `main` no se edita.

Los datos de prueba van en `database/seeds/` y son exclusivamente sintéticos.
