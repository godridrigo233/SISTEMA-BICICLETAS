using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Bicicletas.Api.Seguridad;

/// <summary>
/// CC-13 · Límite de concurrencia del inicio de sesión. Verificar una contraseña con BCrypt (costo 12) ocupa el
/// procesador y un hilo de trabajo durante cerca de un segundo en la instancia del piloto; en la prueba de carga del
/// 08/11/2026, unos 15 inicios de sesión simultáneos dejaron sin respuesta incluso a la consulta por QR de la garita
/// (RNF-01). La política atiende como máximo <see cref="ConcurrenciaPorDefecto"/> verificaciones a la vez y una fila
/// corta; el resto recibe 429 con un mensaje claro, y la garita conserva hilos libres. No reduce el costo de BCrypt.
/// </summary>
public static class LimiteInicioSesion
{
    public const string Politica = "inicio-sesion";
    public const int ConcurrenciaPorDefecto = 2;
    /// <summary>Fila corta: la SPA espera 4 s antes de pasar a modo degradado, y cada verificación tarda cerca de 1 s.</summary>
    public const int ColaPorDefecto = 4;
    public const int SegundosReintento = 5;
    public const string Mensaje = "Hay muchos inicios de sesión en este momento. Intente nuevamente en unos segundos.";

    public static IServiceCollection AddLimiteInicioSesion(this IServiceCollection services, IConfiguration configuracion)
    {
        int concurrencia = Math.Max(1, configuracion.GetValue("Seguridad:InicioSesion:Concurrencia", ConcurrenciaPorDefecto));
        int cola = Math.Max(0, configuracion.GetValue("Seguridad:InicioSesion:Cola", ColaPorDefecto));

        services.AddRateLimiter(opciones =>
        {
            opciones.AddConcurrencyLimiter(Politica, limite =>
            {
                limite.PermitLimit = concurrencia;
                limite.QueueLimit = cola;
                limite.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            });
            opciones.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            opciones.OnRejected = async (contexto, ct) =>
            {
                HttpResponse respuesta = contexto.HttpContext.Response;
                respuesta.Headers.RetryAfter = SegundosReintento.ToString(CultureInfo.InvariantCulture);
                await respuesta.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = "Demasiadas solicitudes",
                    Detail = Mensaje,
                }, options: null, contentType: "application/problem+json", cancellationToken: ct);
            };
        });
        return services;
    }
}
