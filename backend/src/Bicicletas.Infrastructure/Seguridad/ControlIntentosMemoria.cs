using System.Collections.Concurrent;
using Bicicletas.Application.Autenticacion;

namespace Bicicletas.Infrastructure.Seguridad;

/// <summary>
/// Control de intentos en memoria: 5 fallos dentro de 15 minutos bloquean la cuenta 15 minutos.
/// Basta una instancia de la API (Render); con varias instancias se movería a una caché compartida.
/// </summary>
public sealed class ControlIntentosMemoria(TimeProvider reloj) : IControlIntentos
{
    public const int MaximoFallos = 5;
    public static readonly TimeSpan Ventana = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan DuracionBloqueo = TimeSpan.FromMinutes(15);

    private readonly ConcurrentDictionary<string, Registro> _registros = new(StringComparer.Ordinal);

    public TimeSpan? TiempoBloqueoRestante(string correoNormalizado)
    {
        if (!_registros.TryGetValue(correoNormalizado, out Registro? registro) || registro.BloqueadoHasta is null)
            return null;

        TimeSpan restante = registro.BloqueadoHasta.Value - reloj.GetUtcNow();
        if (restante > TimeSpan.Zero)
            return restante;

        _registros.TryRemove(correoNormalizado, out _);
        return null;
    }

    public void RegistrarFallo(string correoNormalizado)
    {
        DateTimeOffset ahora = reloj.GetUtcNow();
        _registros.AddOrUpdate(correoNormalizado,
            _ => new Registro(1, ahora, null),
            (_, previo) =>
            {
                if (ahora - previo.InicioVentana > Ventana)
                    return new Registro(1, ahora, null);
                int fallos = previo.Fallos + 1;
                return new Registro(fallos, previo.InicioVentana, fallos >= MaximoFallos ? ahora + DuracionBloqueo : null);
            });
    }

    public void Reiniciar(string correoNormalizado) => _registros.TryRemove(correoNormalizado, out _);

    private sealed record Registro(int Fallos, DateTimeOffset InicioVentana, DateTimeOffset? BloqueadoHasta);
}
