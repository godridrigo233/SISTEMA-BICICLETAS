namespace Bicicletas.Application.Retiros;

/// <summary>
/// Fase B de la tesis: conserva, solo durante las sesiones del estudio, el descriptor capturado en la
/// garita para calcular fuera de línea las comparaciones genuinas e impostoras. Fuera del estudio está
/// deshabilitado y el descriptor se descarta como siempre (Ley N.º 29733, minimización).
/// </summary>
public interface IRegistroInvestigacion
{
    bool Habilitado { get; }

    Task RegistrarAsync(CapturaInvestigacion captura, CancellationToken ct);
}

public sealed record CapturaInvestigacion(
    Guid IdEstudiante, long IdAuditoria, double[] Descriptor, double Distancia, int? LatenciaMs);
