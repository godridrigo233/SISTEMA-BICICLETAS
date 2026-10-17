using Bicicletas.Domain.Auditoria;

namespace Bicicletas.Domain.Contingencias;

/// <summary>Movimiento anotado durante una caída del sistema (CU-06, RF-11).</summary>
public sealed class ContingenciaIngreso
{
    public Guid IdContingencia { get; private set; }
    public Guid IdBicicleta { get; private set; }
    public DateTime HoraIngresoManual { get; private set; }
    public string FolioBitacora { get; private set; } = string.Empty;
    public Guid IdSupervisor { get; private set; }
    public string EstadoConciliacion { get; private set; } = "PENDIENTE";
    public DateTime TimestampCarga { get; private set; }
    public TipoEvento TipoEvento { get; private set; }
    public string? DniPresentado { get; private set; }
    public string? MotivoObservacion { get; private set; }
    public Guid? IdVigilante { get; private set; }
    public long? IdAuditoria { get; private set; }
    public string OrigenCarga { get; private set; } = "MANUAL";

    private ContingenciaIngreso() { }   // requerido por EF Core
}
