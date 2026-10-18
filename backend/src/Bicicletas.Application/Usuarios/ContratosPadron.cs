using System.ComponentModel.DataAnnotations;

namespace Bicicletas.Application.Usuarios;

/// <summary>CSV del padrón: codigo_universitario;dni;nombres;apellidos;facultad;correo (máximo ~1 MB).</summary>
public sealed record ArchivoPadronRequest([Required, MaxLength(1_000_000)] string Contenido);

/// <summary>Estado de cada fila: NUEVO (se crea), YA_REGISTRADO (se omite) o ERROR.</summary>
public sealed record FilaPadronResponse(int Fila, string CodigoUniversitario, string Dni, string Nombres, string Apellidos,
    string Facultad, string Correo, string Estado, string? Error);

public sealed record ResultadoPadronResponse(int Creados, int YaRegistrados, int ConError, IReadOnlyList<FilaPadronResponse> Filas);

public sealed record EstudianteExistente(string CodigoUniversitario, string Dni, string Correo);

public sealed record NuevoEstudiante(string CodigoUniversitario, string Dni, string Nombres, string Apellidos, string Facultad, string Correo);

public interface IPadronRepositorio
{
    /// <summary>Estudiantes que ya tienen el código, el DNI o el correo indicados.</summary>
    Task<IReadOnlyList<EstudianteExistente>> BuscarEstudiantesAsync(IReadOnlyCollection<string> codigos,
        IReadOnlyCollection<string> dnis, IReadOnlyCollection<string> correos, CancellationToken ct);

    /// <summary>Correos que ya usa cualquier cuenta (incluido el personal).</summary>
    Task<IReadOnlySet<string>> CorreosEnUsoAsync(IReadOnlyCollection<string> correos, CancellationToken ct);

    /// <summary>Crea cuentas y filas del padrón en una sola transacción (todo o nada).</summary>
    Task InsertarAsync(IReadOnlyList<NuevoEstudiante> estudiantes, string hashPendiente, CancellationToken ct);
}
