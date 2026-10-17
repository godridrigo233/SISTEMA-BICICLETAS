namespace Bicicletas.Domain.Biometria;

/// <summary>
/// Descriptor facial de referencia del titular (FLOAT8[128]). Nunca se almacenan imágenes
/// y el vector no sale del servidor: la comparación 1:1 se decide en la API (Ley N.º 29733).
/// </summary>
public sealed class DescriptorBiometrico
{
    public Guid IdDescriptor { get; private set; }
    public Guid IdEstudiante { get; private set; }
    public double[] VectorEmbedding { get; private set; } = [];
    public string VersionModelo { get; private set; } = string.Empty;
    public DateTime? ActualizadoEn { get; private set; }
    public DateTime ConsentimientoEn { get; private set; }

    private DescriptorBiometrico() { }   // requerido por EF Core

    /// <summary>Primer enrolamiento: requiere el consentimiento informado del titular.</summary>
    public static DescriptorBiometrico Crear(Guid idEstudiante, double[] vector, string versionModelo, DateTime ahoraUtc) =>
        new()
        {
            IdDescriptor = Guid.NewGuid(),
            IdEstudiante = idEstudiante,
            VectorEmbedding = vector,
            VersionModelo = versionModelo,
            ActualizadoEn = ahoraUtc,
            ConsentimientoEn = ahoraUtc,
        };

    /// <summary>Re-enrolamiento: reemplaza el vector y renueva el consentimiento.</summary>
    public void Actualizar(double[] vector, string versionModelo, DateTime ahoraUtc)
    {
        VectorEmbedding = vector;
        VersionModelo = versionModelo;
        ActualizadoEn = ahoraUtc;
        ConsentimientoEn = ahoraUtc;
    }
}
