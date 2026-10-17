using Bicicletas.Infrastructure.Persistencia;

namespace Bicicletas.Api.Endpoints;

/// <summary>
/// GET /health: lo consulta el monitor externo cada 10 minutos para evitar la suspensión de la
/// instancia gratuita de Render (CC-09) y para verificar la conexión con Supabase.
/// </summary>
public static class SaludEndpoints
{
    public static IEndpointRouteBuilder MapSalud(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", async (AppDbContext db, CancellationToken ct) =>
        {
            bool conectado;
            try
            {
                conectado = await db.Database.CanConnectAsync(ct);
            }
            catch (InvalidOperationException)
            {
                conectado = false;
            }

            return conectado
                ? Results.Ok(new { estado = "OK", baseDatos = "OK" })
                : Results.Json(new { estado = "DEGRADADO", baseDatos = "SIN_CONEXION" },
                    statusCode: StatusCodes.Status503ServiceUnavailable);
        }).AllowAnonymous();

        return app;
    }
}
