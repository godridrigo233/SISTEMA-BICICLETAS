using System.Data.Common;
using Bicicletas.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Api.Endpoints;

/// <summary>
/// GET y HEAD /health: lo consulta el monitor externo (UptimeRobot usa HEAD en el plan gratuito) para evitar la suspensión de la
/// instancia gratuita de Render (CC-09) y para verificar la conexión con Supabase. Si la conexión
/// falla, la causa se registra en los logs del servidor (sin la cadena de conexión) y la respuesta
/// pública solo indica SIN_CONEXION.
/// </summary>
public static partial class SaludEndpoints
{
    public static IEndpointRouteBuilder MapSalud(this IEndpointRouteBuilder app)
    {
        app.MapMethods("/health", [HttpMethods.Get, HttpMethods.Head], async (IServiceProvider servicios, ILoggerFactory logs, CancellationToken ct) =>
        {
            bool conectado = await ProbarConexionAsync(servicios, logs.CreateLogger("Salud"), ct);
            return conectado
                ? Results.Ok(new { estado = "OK", baseDatos = "OK" })
                : Results.Json(new { estado = "DEGRADADO", baseDatos = "SIN_CONEXION" },
                    statusCode: StatusCodes.Status503ServiceUnavailable);
        }).AllowAnonymous();

        return app;
    }

    private static async Task<bool> ProbarConexionAsync(IServiceProvider servicios, ILogger log, CancellationToken ct)
    {
        try
        {
            using IServiceScope ambito = servicios.CreateScope();
            AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.OpenConnectionAsync(ct);
            await db.Database.CloseConnectionAsync();
            return true;
        }
        catch (Exception ex) when (ex is DbException or InvalidOperationException or TimeoutException or ArgumentException)
        {
            FalloConexion(log, ex.GetType().Name, ex.Message);
            return false;
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Sin conexión con la base de datos: {Tipo}: {Mensaje}")]
    private static partial void FalloConexion(ILogger log, string tipo, string mensaje);
}
