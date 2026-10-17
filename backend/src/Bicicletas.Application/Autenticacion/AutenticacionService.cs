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
    IGeneradorToken generadorToken,
    IControlIntentos intentos)
{
    // Hash BCrypt (costo 12) de un valor aleatorio: se verifica cuando el correo no existe.
    private const string HashFicticio = "$2a$12$CSHXz6VaFpMiyfSYklydOewHxvGwai5JJt6iin9P9B1RY22Svty0u";

    public async Task<LoginResponse> IniciarSesionAsync(LoginRequest solicitud, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        string correo = NormalizarCorreo(solicitud.Correo);

        // Tras 5 fallos seguidos la cuenta se bloquea 15 minutos, aunque luego se envíe la clave correcta.
        TimeSpan? bloqueo = intentos.TiempoBloqueoRestante(correo);
        if (bloqueo is not null)
            throw new CuentaBloqueadaException(bloqueo.Value);

        Usuario? usuario = await usuarios.ObtenerPorCorreoAsync(correo, ct);
        bool valida;
        if (usuario is null)
        {
            hasher.Verificar(solicitud.Password, HashFicticio);   // mismo costo que un correo existente
            valida = false;
        }
        else
        {
            valida = hasher.Verificar(solicitud.Password, usuario.PasswordHash);
        }

        if (usuario is null || !valida)
        {
            intentos.RegistrarFallo(correo);
            throw new CredencialesInvalidasException();
        }

        intentos.Reiniciar(correo);

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
