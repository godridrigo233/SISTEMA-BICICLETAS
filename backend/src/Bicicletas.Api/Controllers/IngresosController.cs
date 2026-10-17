using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Garita;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api.Controllers;

/// <summary>CU-03: registro del ingreso. Controlador delgado: autoriza por rol y delega al caso de uso.</summary>
[ApiController]
[Route("api/v1/ingresos")]
[Authorize(Policy = Politicas.OperacionGarita)]
public sealed class IngresosController(RegistrarIngresoService servicio) : ControllerBase
{
    /// <response code="200">Ingreso registrado: la bicicleta pasa a DENTRO.</response>
    /// <response code="404">La bicicleta no existe.</response>
    /// <response code="409">La bicicleta ya figura DENTRO.</response>
    [HttpPost("registrar")]
    public async Task<ActionResult<MovimientoResponse>> Registrar(IngresoRequest solicitud, CancellationToken ct)
    {
        Guid idVigilante = Guid.Parse(User.FindFirst(ClaimsSistema.IdUsuario)!.Value);
        return Ok(await servicio.EjecutarAsync(solicitud, idVigilante, ct));
    }
}
