using System.ComponentModel.DataAnnotations;

namespace Bicicletas.Application.Estudiantes;

public sealed record BicicletaPropiaResponse(Guid IdBicicleta, string CodigoQr, string NumeroMarco, string MarcaModelo,
    string Color, string? RasgosDistintivos, string Estado);

/// <summary>Datos del padrón (solo lectura en W4) y estado del registro del estudiante.</summary>
public sealed record PerfilEstudianteResponse(string Nombres, string Apellidos, string CodigoUniversitario, string Facultad,
    bool Enrolado, IReadOnlyList<BicicletaPropiaResponse> Bicicletas);

/// <summary>Cuerpo de POST /api/v1/estudiante/bicicletas (CU-01).</summary>
public sealed record RegistrarBicicletaRequest(
    [Required, MaxLength(40)] string NumeroMarco,
    [Required, MaxLength(50)] string MarcaModelo,
    [Required, MaxLength(25)] string Color,
    [MaxLength(100)] string? RasgosDistintivos);

/// <summary>Cuerpo de PUT /api/v1/estudiante/enrolamiento: solo el descriptor, nunca la imagen.</summary>
public sealed record EnrolamientoRequest(
    [Required] double[] Descriptor,
    bool ConsentimientoAceptado,
    [Required, MaxLength(20)] string VersionModelo);

public interface IEstudianteRepositorio
{
    Task<PerfilEstudianteResponse?> ObtenerPerfilAsync(Guid idEstudiante, CancellationToken ct);

    Task<bool> ExisteNumeroMarcoAsync(string numeroMarco, CancellationToken ct);

    void AgregarBicicleta(Domain.Bicicletas.Bicicleta bicicleta);

    Task<Domain.Biometria.DescriptorBiometrico?> ObtenerDescriptorAsync(Guid idEstudiante, CancellationToken ct);

    void AgregarDescriptor(Domain.Biometria.DescriptorBiometrico descriptor);

    Task GuardarAsync(CancellationToken ct);
}
