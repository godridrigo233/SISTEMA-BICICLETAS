namespace Bicicletas.Domain.Auditoria;

public enum TipoEvento
{
    Ingreso,
    Retiro,
}

public enum ResultadoAcceso
{
    Exitoso,
    Denegado,
    Manual,
}

/// <summary>Registro inmutable de la bitácora (auditoria_accesos admite solo INSERT, V002).</summary>
public sealed class AuditoriaAcceso
{
    public long IdAuditoria { get; private set; }
    public Guid IdBicicleta { get; private set; }
    public TipoEvento TipoEvento { get; private set; }
    public double? DistanciaEuclidiana { get; private set; }
    public Guid IdVigilante { get; private set; }
    public ResultadoAcceso Resultado { get; private set; }
    public DateTime TimestampEvento { get; private set; }
    public int? LatenciaMs { get; private set; }

    private AuditoriaAcceso() { }   // requerido por EF Core

    public AuditoriaAcceso(Guid idBicicleta, TipoEvento tipoEvento, double? distanciaEuclidiana,
        Guid idVigilante, ResultadoAcceso resultado, int? latenciaMs, DateTime timestampEventoUtc)
    {
        IdBicicleta = idBicicleta;
        TipoEvento = tipoEvento;
        DistanciaEuclidiana = distanciaEuclidiana;
        IdVigilante = idVigilante;
        Resultado = resultado;
        LatenciaMs = latenciaMs;
        TimestampEvento = timestampEventoUtc;
    }
}
