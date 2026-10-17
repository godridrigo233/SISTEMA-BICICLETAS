using System.ComponentModel.DataAnnotations;

namespace Bicicletas.Application.Retiros;

/// <summary>
/// Cuerpo de POST /api/v1/retiros/autorizar. El descriptor capturado es transitorio: se usa para la
/// decisión y se descarta; nunca se persiste ni se registra en logs (Ley N.º 29733).
/// </summary>
public sealed record RetiroRequest(
    [Required] Guid IdBicicleta,
    [Required] double[] DescriptorCapturado,
    [Range(0, 60_000)] int? LatenciaMs);

/// <summary>Resultado de negocio: AUTORIZADO o DENEGADO (ambos auditados).</summary>
public sealed record RetiroResponse(string Resultado, string EstadoActualizado, double DistanciaEuclidiana, double UmbralTheta);

/// <summary>Acceso al descriptor de referencia del titular (lo implementa Infrastructure).</summary>
public interface IDescriptorRepositorio
{
    Task<double[]?> ObtenerVectorDelTitularAsync(Guid idEstudiante, CancellationToken ct);
}

/// <summary>
/// Cuerpo de POST /api/v1/retiros/manual: el Supervisor verifica el DNI físico del titular tras un
/// rechazo biométrico (CU-04, flujo alternativo «Derivar al supervisor»).
/// </summary>
public sealed record RetiroManualRequest(
    [Required] Guid IdBicicleta,
    [Required, RegularExpression("^[0-9]{8}$", ErrorMessage = "El DNI debe tener 8 dígitos.")] string DniVerificado);

public sealed record RetiroManualResponse(string Resultado, string EstadoActualizado);
