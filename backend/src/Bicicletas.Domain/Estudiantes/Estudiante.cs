namespace Bicicletas.Domain.Estudiantes;

/// <summary>Datos del padrón institucional del estudiante (tabla estudiantes, 1:1 con usuarios).</summary>
public sealed class Estudiante
{
    public Guid IdEstudiante { get; private set; }
    public string CodigoUniversitario { get; private set; } = string.Empty;
    public string Dni { get; private set; } = string.Empty;
    public string Nombres { get; private set; } = string.Empty;
    public string Apellidos { get; private set; } = string.Empty;
    public string Facultad { get; private set; } = string.Empty;

    private Estudiante() { }   // requerido por EF Core

    /// <summary>Alta desde la carga del padrón institucional (W7); el Id coincide con el de su cuenta.</summary>
    public static Estudiante DelPadron(Guid idUsuario, string codigoUniversitario, string dni, string nombres, string apellidos, string facultad) => new()
    {
        IdEstudiante = idUsuario,
        CodigoUniversitario = codigoUniversitario,
        Dni = dni,
        Nombres = nombres,
        Apellidos = apellidos,
        Facultad = facultad,
    };
}
