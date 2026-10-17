using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Retiros;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api.Controllers;

/// <summary>CU-04. Controlador delgado: autoriza por rol, delega al caso de uso y devuelve el resultado.</summary>
[ApiController]
[Route("api/v1/retiros")]
[Authorize(Policy = Politicas.OperacionGarita)]
public sealed class RetirosController(AutorizarRetiroService servicio) : ControllerBase
{
    /// <response code="200">Retiro AUTORIZADO o DENEGADO; ambos quedan en auditoria_accesos. No se usa 401
    /// para el rechazo biométrico porque cerraría la sesión del vigilante.</response>
    /// <response code="409">La bicicleta no figura DENTRO o el titular no tiene enrolamiento.</response>
    /// <response code="422">El descriptor no tiene 128 valores numéricos.</response>
    [HttpPost("autorizar")]
    public async Task<ActionResult<RetiroResponse>> Autorizar(RetiroRequest solicitud, CancellationToken ct)
    {
        Guid idVigilante = Guid.Parse(User.FindFirst(ClaimsSistema.IdUsuario)!.Value);
        return Ok(await servicio.EjecutarAsync(solicitud, idVigilante, ct));
    }
}
