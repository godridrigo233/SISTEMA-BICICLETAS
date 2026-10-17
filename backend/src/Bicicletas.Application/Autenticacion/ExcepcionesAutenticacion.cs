namespace Bicicletas.Application.Autenticacion;

/// <summary>Correo inexistente o contraseña incorrecta: siempre el mismo mensaje (OWASP A07). HTTP 401.</summary>
public sealed class CredencialesInvalidasException() : Exception("Credenciales inválidas.");

/// <summary>Cuenta desactivada por el Administrador (borrado lógico). HTTP 403.</summary>
public sealed class CuentaInactivaException() : Exception("Cuenta inactiva. Contacte al administrador.");

/// <summary>Demasiados intentos fallidos seguidos: bloqueo temporal. HTTP 423.</summary>
public sealed class CuentaBloqueadaException(TimeSpan restante)
    : Exception($"Demasiados intentos fallidos. Intente nuevamente en {Math.Max(1, (int)Math.Ceiling(restante.TotalMinutes))} minutos.");
