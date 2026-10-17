namespace Bicicletas.Application.Autenticacion;

/// <summary>Limita los intentos fallidos de inicio de sesión por cuenta (OWASP A07).</summary>
public interface IControlIntentos
{
    /// <summary>Devuelve el tiempo restante de bloqueo, o null si la cuenta puede intentar.</summary>
    TimeSpan? TiempoBloqueoRestante(string correoNormalizado);

    void RegistrarFallo(string correoNormalizado);

    void Reiniciar(string correoNormalizado);
}
