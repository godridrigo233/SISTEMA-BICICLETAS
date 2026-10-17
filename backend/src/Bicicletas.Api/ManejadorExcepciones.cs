using Bicicletas.Application.Autenticacion;
using Bicicletas.Domain.Comun;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api;

/// <summary>
/// Traduce las excepciones de negocio a respuestas HTTP con formato ProblemDetails (RFC 9457).
/// Los errores no previstos responden 500 sin detalles internos (OWASP A05).
/// </summary>
public sealed class ManejadorExcepciones(IProblemDetailsService problemas, IHostEnvironment entorno) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(httpContext);
        (int estado, string titulo) = exception switch
        {
            CredencialesInvalidasException => (StatusCodes.Status401Unauthorized, "No autenticado"),
            CuentaInactivaException => (StatusCodes.Status403Forbidden, "Cuenta inactiva"),
            CuentaBloqueadaException => (StatusCodes.Status423Locked, "Cuenta bloqueada temporalmente"),
            RecursoNoEncontradoException => (StatusCodes.Status404NotFound, "No encontrado"),
            ConflictoEstadoException => (StatusCodes.Status409Conflict, "Conflicto de estado"),
            ValidacionNegocioException => (StatusCodes.Status422UnprocessableEntity, "Datos no válidos"),
            _ => (StatusCodes.Status500InternalServerError, "Error interno"),
        };

        httpContext.Response.StatusCode = estado;
        return await problemas.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = estado,
                Title = titulo,
                // En producción un error 500 no expone detalles internos; en desarrollo y pruebas sí.
                Detail = estado != StatusCodes.Status500InternalServerError || !entorno.IsProduction()
                    ? exception.Message
                    : null,
            },
        });
    }
}
