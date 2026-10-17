using System.ComponentModel.DataAnnotations;

namespace Bicicletas.Application.Usuarios;

public sealed record UsuarioResumenResponse(Guid IdUsuario, string Correo, short IdRol, string Rol, DateTime? CreadoEnUtc,
    bool Activo, bool DebeCambiarPassword);

/// <summary>Alta de personal: los estudiantes provienen del padrón institucional (carga ETL), no de W7.</summary>
public sealed record CrearUsuarioRequest(
    [Required, EmailAddress, MaxLength(100)] string Correo,
    [Range(2, 4)] short IdRol);

/// <summary>La contraseña temporal se muestra una sola vez; en la base solo queda su hash BCrypt.</summary>
public sealed record ContrasenaTemporalResponse(Guid IdUsuario, string Correo, string Rol, string PasswordTemporal);

public sealed record CambiarEstadoRequest([Required] bool? Activo);

public interface IGestionUsuariosRepositorio
{
    Task<(int Total, IReadOnlyList<UsuarioResumenResponse> Elementos)> ListarAsync(short? idRol, string? correo, int saltar, int tomar, CancellationToken ct);

    Task<bool> ExisteCorreoAsync(string correo, CancellationToken ct);

    Task<Domain.Usuarios.Usuario?> ObtenerAsync(Guid idUsuario, CancellationToken ct);

    void Agregar(Domain.Usuarios.Usuario usuario);

    /// <summary>Elimina el descriptor biométrico del estudiante al inactivar su cuenta (Ley N.º 29733).</summary>
    Task EliminarDescriptorAsync(Guid idEstudiante, CancellationToken ct);

    Task GuardarAsync(CancellationToken ct);
}
