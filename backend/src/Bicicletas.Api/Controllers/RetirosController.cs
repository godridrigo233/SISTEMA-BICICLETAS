using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Retiros;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api.Controllers;

/// <summary>CU-04. Controlador delgado: autoriza por rol, delega al caso de uso y devuelve el resultado.</summary>
[ApiController]
[Route("api/v1/retiros")]
[Authorize(Policy = Politicas.OperacionGarita)]
public sealed class RetirosController(AutorizarRetiroService servicio, RetiroManualService manual) : ControllerBase
{
    /// <response code="200">Retiro AUTORIZADO o DENEGADO; ambos quedan en auditoria_accesos. No se usa 401
    /// para el rechazo biométrico porque cerraría la sesión del vigilante.</response>
    /// <response code="409">La bicicleta no figura DENTRO o el titular no tiene enrolamiento.</response>
    /// <response code="422">El descriptor no tiene 128 valores numéricos.</response>
    [HttpPost("autorizar")]
    public async Task<ActionResult<RetiroResponse>> Autorizar(RetiroRequest solicitud, CancellationToken ct)
    {
        return Ok(await servicio.EjecutarAsync(solicitud, IdOperador, ct));
    }

    /// <summary>Derivación al Supervisor tras un rechazo biométrico: verifica el DNI físico del titular.</summary>
    /// <response code="200">Retiro manual autorizado: DENTRO → FUERA, auditado como RETIRO/MANUAL.</response>
    /// <response code="403">Solo Supervisor o Administrador (el Garitero deriva, no autoriza).</response>
    /// <response code="409">La bicicleta no figura DENTRO.</response>
    /// <response code="422">El DNI no coincide con el del titular.</response>
    [HttpPost("manual")]
    [Authorize(Policy = Politicas.Regularizacion)]
    public async Task<ActionResult<RetiroManualResponse>> Manual(RetiroManualRequest solicitud, CancellationToken ct) =>
        Ok(await manual.EjecutarAsync(solicitud, IdOperador, ct));

    private Guid IdOperador => Guid.Parse(User.FindFirst(ClaimsSistema.IdUsuario)!.Value);
}
