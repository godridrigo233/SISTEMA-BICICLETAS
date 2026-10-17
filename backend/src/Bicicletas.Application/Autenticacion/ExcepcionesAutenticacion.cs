namespace Bicicletas.Application.Autenticacion;

/// <summary>Correo inexistente o contraseña incorrecta: siempre el mismo mensaje (OWASP A07). HTTP 401.</summary>
public sealed class CredencialesInvalidasException() : Exception("Credenciales inválidas.");

/// <summary>Cuenta desactivada por el Administrador (borrado lógico). HTTP 403.</summary>
public sealed class CuentaInactivaException() : Exception("Cuenta inactiva. Contacte al administrador.");
