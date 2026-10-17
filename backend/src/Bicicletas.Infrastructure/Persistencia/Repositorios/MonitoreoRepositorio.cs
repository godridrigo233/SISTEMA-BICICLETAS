using Bicicletas.Application.Monitoreo;
using Bicicletas.Domain.Auditoria;
using Bicicletas.Domain.Bicicletas;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

/// <summary>Fila sin mapear leída de la vista v_monitoreo_auditoria (V003, fuente única del campo «registro»).</summary>
public sealed class FilaMonitoreo
{
    public long IdAuditoria { get; set; }
    public DateTime Fecha { get; set; }
    public string TipoEvento { get; set; } = string.Empty;
    public string Resultado { get; set; } = string.Empty;
    public string Registro { get; set; } = string.Empty;
    public string? Folio { get; set; }
    public double? Distancia { get; set; }
    public int? LatenciaMs { get; set; }
    public string Bicicleta { get; set; } = string.Empty;
    public string CodigoUniversitario { get; set; } = string.Empty;
    public string Operador { get; set; } = string.Empty;
}

public sealed class MonitoreoRepositorio(AppDbContext db) : IMonitoreoRepositorio
{
    public async Task<ResumenMonitoreoResponse> ResumenAsync(DateTime inicioDiaUtc, CancellationToken ct)
    {
        IQueryable<AuditoriaAcceso> hoy = db.Auditoria.AsNoTracking().Where(a => a.TimestampEvento >= inicioDiaUtc);
        return new ResumenMonitoreoResponse(
            await db.Bicicletas.CountAsync(b => b.Estado == EstadoBicicleta.Dentro, ct),
            await hoy.CountAsync(a => a.TipoEvento == TipoEvento.Ingreso && a.Resultado != ResultadoAcceso.Denegado, ct),
            await hoy.CountAsync(a => a.TipoEvento == TipoEvento.Retiro && a.Resultado != ResultadoAcceso.Denegado, ct),
            await hoy.CountAsync(a => a.Resultado == ResultadoAcceso.Denegado, ct),
            await hoy.CountAsync(a => a.Resultado == ResultadoAcceso.Manual, ct),
            await db.Contingencias.CountAsync(c => c.EstadoConciliacion == "PENDIENTE" || c.EstadoConciliacion == "OBSERVADO", ct),
            await hoy.Where(a => a.LatenciaMs != null).AverageAsync(a => (double?)a.LatenciaMs, ct));
    }

    public async Task<(int Total, IReadOnlyList<EventoMonitoreoResponse> Elementos)> ConsultarEventosAsync(
        CriteriosMonitoreo criterios, int saltar, int tomar, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(criterios);
        // Consulta fija sin parámetros; los filtros se agregan con LINQ y viajan como parámetros (OWASP A03).
        IQueryable<FilaMonitoreo> consulta = db.Database.SqlQuery<FilaMonitoreo>($"""
            SELECT v.id_auditoria AS "IdAuditoria", v.timestamp_evento AS "Fecha", v.tipo_evento AS "TipoEvento",
                   v.resultado AS "Resultado", v.registro AS "Registro", v.folio AS "Folio",
                   v.distancia_euclidiana AS "Distancia", v.latencia_ms AS "LatenciaMs",
                   b.marca_modelo || ' (' || b.color || ')' AS "Bicicleta",
                   e.codigo_universitario AS "CodigoUniversitario", u.correo_institucional AS "Operador"
              FROM v_monitoreo_auditoria v
              JOIN bicicletas b  ON b.id_bicicleta  = v.id_bicicleta
              JOIN estudiantes e ON e.id_estudiante = b.id_estudiante
              JOIN usuarios u    ON u.id_usuario    = v.id_vigilante
            """);
        if (criterios.DesdeUtc is { } d)
            consulta = consulta.Where(f => f.Fecha >= d);
        if (criterios.HastaUtc is { } h)
            consulta = consulta.Where(f => f.Fecha < h);
        if (criterios.Tipo is { } t)
            consulta = consulta.Where(f => f.TipoEvento == t);
        if (criterios.Resultado is { } r)
            consulta = consulta.Where(f => f.Resultado == r);
        if (criterios.Registro is { } g)
            consulta = consulta.Where(f => f.Registro == g);

        int total = await consulta.CountAsync(ct);
        List<EventoMonitoreoResponse> elementos = await consulta
            .OrderByDescending(f => f.Fecha).ThenByDescending(f => f.IdAuditoria)
            .Skip(saltar).Take(tomar)
            .Select(f => new EventoMonitoreoResponse(f.IdAuditoria, f.Fecha, f.TipoEvento, f.Resultado, f.Registro, f.Folio,
                f.Distancia, f.LatenciaMs, f.Bicicleta, f.CodigoUniversitario, f.Operador))
            .ToListAsync(ct);
        return (total, elementos);
    }
}
