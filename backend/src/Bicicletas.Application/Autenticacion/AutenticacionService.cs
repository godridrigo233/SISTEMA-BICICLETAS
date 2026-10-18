using Bicicletas.Domain.Comun;
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
    // Hash BCrypt de un valor aleatorio, generado una vez en memoria (no hay hashes en el código fuente):
    // se verifica cuando el correo no existe para igualar el tiempo de respuesta.
    private static string? _hashFicticio;

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
            _hashFicticio ??= hasher.Hashear(Guid.NewGuid().ToString("N"));
            hasher.Verificar(solicitud.Password, _hashFicticio);   // mismo costo que un correo existente
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

    /// <summary>
    /// Reemplaza la contraseña temporal por una propia y devuelve un token nuevo sin la marca
    /// debe_cambiar_password, para que el usuario continúe sin volver a iniciar sesión.
    /// </summary>
    public async Task<LoginResponse> CambiarPasswordAsync(Guid idUsuario, CambiarPasswordRequest solicitud, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        Usuario usuario = await usuarios.ObtenerPorIdAsync(idUsuario, ct)
            ?? throw new RecursoNoEncontradoException("La cuenta no existe.");
        if (!usuario.Activo)
            throw new CuentaInactivaException();

        // 422 y no 401: un 401 cerraría la sesión en la SPA por un simple error de digitación.
        if (!hasher.Verificar(solicitud.PasswordActual, usuario.PasswordHash))
            throw new ValidacionNegocioException("La contraseña actual no es correcta.");

        ReglasContrasena.Validar(solicitud.PasswordNueva, solicitud.PasswordActual);
        usuario.EstablecerPasswordPropia(hasher.Hashear(solicitud.PasswordNueva));
        await usuarios.GuardarCambiosAsync(ct);

        TokenEmitido token = generadorToken.Generar(usuario);
        return new LoginResponse(token.Token, token.ExpiraEnUtc, usuario.IdRol, usuario.DebeCambiarPassword);
    }

    public static string NormalizarCorreo(string correo) =>
        (correo ?? string.Empty).Trim().ToLowerInvariant();
}
