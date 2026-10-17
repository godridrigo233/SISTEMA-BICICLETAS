using Bicicletas.Domain.Comun;

namespace Bicicletas.Domain.Usuarios;

/// <summary>Política de contraseñas propias (W1, estado «Cree su contraseña»; OWASP A07).</summary>
public static class ReglasContrasena
{
    public const int LongitudMinima = 10;
    public const int LongitudMaxima = 128;

    /// <summary>Lanza ValidacionNegocioException (HTTP 422) si la nueva contraseña no cumple la política.</summary>
    public static void Validar(string nueva, string actual)
    {
        if (string.IsNullOrEmpty(nueva) || nueva.Length < LongitudMinima || nueva.Length > LongitudMaxima)
            throw new ValidacionNegocioException($"La contraseña debe tener entre {LongitudMinima} y {LongitudMaxima} caracteres.");
        if (!nueva.Any(char.IsLetter) || !nueva.Any(char.IsDigit))
            throw new ValidacionNegocioException("La contraseña debe combinar letras y números.");
        if (string.Equals(nueva, actual, StringComparison.Ordinal))
            throw new ValidacionNegocioException("La nueva contraseña debe ser distinta de la temporal.");
    }
}
