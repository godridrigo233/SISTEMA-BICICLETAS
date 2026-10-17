namespace Bicicletas.Domain.Usuarios;

/// <summary>Cuenta de acceso al sistema (tabla usuarios). Solo se almacena el hash de la contraseña.</summary>
public sealed class Usuario
{
    public Guid IdUsuario { get; private set; }
    public short IdRol { get; private set; }
    public string CorreoInstitucional { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public bool Activo { get; private set; } = true;
    public DateTime? CreadoEn { get; private set; }
    public bool DebeCambiarPassword { get; private set; } = true;

    private Usuario() { }   // requerido por EF Core

    public Usuario(Guid idUsuario, short idRol, string correoInstitucional, string passwordHash, bool debeCambiarPassword = true)
    {
        if (!RolSistema.EsValido(idRol))
            throw new ArgumentOutOfRangeException(nameof(idRol), "Rol inexistente.");
        IdUsuario = idUsuario;
        IdRol = idRol;
        CorreoInstitucional = correoInstitucional;
        PasswordHash = passwordHash;
        DebeCambiarPassword = debeCambiarPassword;
    }

    /// <summary>Reemplaza la contraseña temporal por una propia (primer ingreso, OWASP A07).</summary>
    public void EstablecerPasswordPropia(string nuevoHash)
    {
        PasswordHash = nuevoHash;
        DebeCambiarPassword = false;
    }

    /// <summary>Contraseña temporal generada por el Administrador (W7): obliga a crear una propia al ingresar.</summary>
    public void AsignarPasswordTemporal(string hashTemporal)
    {
        PasswordHash = hashTemporal;
        DebeCambiarPassword = true;
    }

    /// <summary>Reactivación de una cuenta inactiva desde W7.</summary>
    public void Activar() => Activo = true;

    /// <summary>Inactivación lógica de la cuenta desde W7 (no existe eliminación física).</summary>
    public void Desactivar() => Activo = false;

    /// <summary>Actualiza el hash sin cambiar el estado (p. ej., al elevar el costo de BCrypt).</summary>
    public void ActualizarHash(string nuevoHash) => PasswordHash = nuevoHash;
}
