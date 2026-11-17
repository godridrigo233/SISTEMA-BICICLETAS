using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Comun;
using Bicicletas.Application.Garita;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api.Controllers;

/// <summary>W2 · Panel de Garita: «Últimos movimientos» del operador en el día (D-25).</summary>
[ApiController]
[Route("api/v1/garita")]
[Authorize(Policy = Politicas.OperacionGarita)]
public sealed class GaritaController(IMovimientosGaritaRepositorio movimientos, TimeProvider reloj) : ControllerBase
{
    /// <summary>Filas que muestra la tabla de W2.</summary>
    public const int MaximoMovimientos = 8;

    /// <response code="200">Ingresos y retiros que el operador registró hoy (hora de Perú), del más reciente al más antiguo.</response>
    [HttpGet("movimientos-recientes")]
    public async Task<ActionResult<IReadOnlyList<MovimientoGaritaResponse>>> MovimientosRecientes(CancellationToken ct)
    {
        Guid idOperador = Guid.Parse(User.FindFirst(ClaimsSistema.IdUsuario)!.Value);
        DateTime inicioDelDia = HoraPeru.InicioDelDiaUtc(HoraPeru.Hoy(reloj));
        return Ok(await movimientos.RecientesAsync(idOperador, inicioDelDia, MaximoMovimientos, ct));
    }
}
