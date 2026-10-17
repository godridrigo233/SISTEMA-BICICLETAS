using Bicicletas.Domain.Usuarios;

namespace Bicicletas.Application.Autenticacion;

/// <summary>
/// Caso de uso de inicio de sesión (RF-01). Un correo inexistente y una contraseña incorrecta
/// producen la misma respuesta y un costo de cómputo equivalente, para no revelar qué cuentas
/// existen (OWASP A07).
/// </summary>
public sealed class AutenticacionService(
    IUsuarioRepositorio usuarios,
    IHasherContrasenas hasher,
    IGeneradorToken generadorToken)
{
    // Hash BCrypt (costo 12) de un valor aleatorio: se verifica cuando el correo no existe.
    private const string HashFicticio = "$2a$12$CSHXz6VaFpMiyfSYklydOewHxvGwai5JJt6iin9P9B1RY22Svty0u";

    public async Task<LoginResponse> IniciarSesionAsync(LoginRequest solicitud, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        string correo = NormalizarCorreo(solicitud.Correo);

        Usuario? usuario = await usuarios.ObtenerPorCorreoAsync(correo, ct);
        if (usuario is null)
        {
            hasher.Verificar(solicitud.Password, HashFicticio);
            throw new CredencialesInvalidasException();
        }

        if (!hasher.Verificar(solicitud.Password, usuario.PasswordHash))
            throw new CredencialesInvalidasException();

        // La inactividad solo se revela a quien conoce la contraseña correcta.
        if (!usuario.Activo)
            throw new CuentaInactivaException();

        if (hasher.RequiereRehash(usuario.PasswordHash))
        {
            usuario.ActualizarHash(hasher.Hashear(solicitud.Password));
            await usuarios.GuardarCambiosAsync(ct);
        }

        TokenEmitido token = generadorToken.Generar(usuario);
        return new LoginResponse(token.Token, token.ExpiraEnUtc, usuario.IdRol, usuario.DebeCambiarPassword);
    }

    public static string NormalizarCorreo(string correo) =>
        (correo ?? string.Empty).Trim().ToLowerInvariant();
}
