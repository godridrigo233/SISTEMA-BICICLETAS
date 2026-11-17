using Bicicletas.Application.Garita;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

/// <summary>Fila sin mapear de «Últimos movimientos» (W2), leída de v_monitoreo_auditoria.</summary>
public sealed class FilaMovimientoGarita
{
    public long IdAuditoria { get; set; }
    public DateTime Fecha { get; set; }
    public string TipoEvento { get; set; } = string.Empty;
    public string Resultado { get; set; } = string.Empty;
    public string Titular { get; set; } = string.Empty;
    public string Bicicleta { get; set; } = string.Empty;
}

/// <summary>D-25: la tabla de la garita se reconstruye desde la auditoría (solo lectura, parámetros: OWASP A03).</summary>
public sealed class MovimientosGaritaRepositorio(AppDbContext db) : IMovimientosGaritaRepositorio
{
    public async Task<IReadOnlyList<MovimientoGaritaResponse>> RecientesAsync(Guid idOperador, DateTime desdeUtc, int tomar,
        CancellationToken ct)
    {
        // El operador, la fecha y el límite viajan como parámetros ($1, $2, $3), nunca como texto concatenado.
        List<FilaMovimientoGarita> filas = await db.Database.SqlQuery<FilaMovimientoGarita>($"""
            SELECT v.id_auditoria AS "IdAuditoria", v.timestamp_evento AS "Fecha", v.tipo_evento AS "TipoEvento",
                   v.resultado AS "Resultado", e.nombres || ' ' || e.apellidos AS "Titular",
                   b.marca_modelo || ' / ' || b.color AS "Bicicleta"
              FROM v_monitoreo_auditoria v
              JOIN bicicletas b  ON b.id_bicicleta  = v.id_bicicleta
              JOIN estudiantes e ON e.id_estudiante = b.id_estudiante
             WHERE v.id_vigilante = {idOperador}
               AND v.timestamp_evento >= {desdeUtc}
               AND v.registro <> 'CONTINGENCIA'
             ORDER BY v.timestamp_evento DESC, v.id_auditoria DESC
             LIMIT {tomar}
            """).ToListAsync(ct);
        return filas.Select(f => new MovimientoGaritaResponse(f.IdAuditoria, f.Fecha, f.TipoEvento, f.Resultado, f.Titular, f.Bicicleta))
            .ToList();
    }
}
