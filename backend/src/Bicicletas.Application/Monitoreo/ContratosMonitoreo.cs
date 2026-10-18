using Bicicletas.Application.Comun;

namespace Bicicletas.Application.Monitoreo;

/// <summary>Indicadores del día (hora de Perú) para W6 · Monitoreo y Reportes.</summary>
public sealed record ResumenMonitoreoResponse(
    int BicicletasDentro,
    int IngresosHoy,
    int RetirosHoy,
    int RechazosHoy,
    int MovimientosManualesHoy,
    int ContingenciasPendientes,
    double? LatenciaPromedioMsHoy,
    int AlertasRevisionBiometrica = 0);

/// <summary>Estudiante con 3 o más retiros DENEGADO consecutivos desde su último enrolamiento.</summary>
public sealed record AlertaBiometricaResponse(string CodigoUniversitario, string Estudiante, int RechazosConsecutivos, DateTime UltimoIntentoUtc);

/// <summary>Fila de la bitácora tomada de v_monitoreo_auditoria (registro AUTOMATICO, CONTINGENCIA o DERIVACION).</summary>
public sealed record EventoMonitoreoResponse(
    long IdAuditoria,
    DateTime FechaUtc,
    string TipoEvento,
    string Resultado,
    string Registro,
    string? Folio,
    double? DistanciaEuclidiana,
    int? LatenciaMs,
    string Bicicleta,
    string CodigoUniversitario,
    string Operador);

/// <summary>Filtros de W6: los de movimientos más resultado y tipo de registro (CC-10).</summary>
public sealed class FiltroMonitoreo : FiltroMovimientos
{
    /// <summary>EXITOSO, DENEGADO o MANUAL.</summary>
    public string? Resultado { get; init; }

    /// <summary>AUTOMATICO, CONTINGENCIA o DERIVACION.</summary>
    public string? Registro { get; init; }
}

/// <summary>Criterios ya validados que recibe el repositorio.</summary>
public sealed record CriteriosMonitoreo(DateTime? DesdeUtc, DateTime? HastaUtc, string? Tipo, string? Resultado, string? Registro);

public interface IMonitoreoRepositorio
{
    Task<ResumenMonitoreoResponse> ResumenAsync(DateTime inicioDiaUtc, CancellationToken ct);

    Task<IReadOnlyList<AlertaBiometricaResponse>> AlertasBiometricasAsync(int minimoRechazos, CancellationToken ct);

    Task<(int Total, IReadOnlyList<EventoMonitoreoResponse> Elementos)> ConsultarEventosAsync(CriteriosMonitoreo criterios,
        int saltar, int tomar, CancellationToken ct);
}
