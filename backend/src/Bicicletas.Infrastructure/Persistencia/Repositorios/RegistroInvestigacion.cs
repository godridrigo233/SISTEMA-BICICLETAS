using Bicicletas.Application.Retiros;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

/// <summary>
/// Inserta en investigacion_capturas (V006) dentro de la misma transacción del retiro. Se activa con
/// la variable de entorno Investigacion__FaseBHabilitada=true solo durante las sesiones de la Fase B.
/// </summary>
internal sealed class RegistroInvestigacion(AppDbContext db, IConfiguration configuracion) : IRegistroInvestigacion
{
    public const string VersionModelo = "vlad-1.7.15-ssd";

    public bool Habilitado { get; } =
        bool.TryParse(configuracion["Investigacion:FaseBHabilitada"], out bool habilitado) && habilitado;

    public async Task RegistrarAsync(CapturaInvestigacion captura, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(captura);
        double[] vector = (double[])captura.Descriptor.Clone();
        await db.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO investigacion_capturas
                (id_estudiante, id_auditoria, vector_embedding, distancia_euclidiana, latencia_ms, version_modelo)
            VALUES ({captura.IdEstudiante}, {captura.IdAuditoria}, {vector}, {captura.Distancia}, {captura.LatenciaMs}, {VersionModelo})
            """, ct);
    }
}
