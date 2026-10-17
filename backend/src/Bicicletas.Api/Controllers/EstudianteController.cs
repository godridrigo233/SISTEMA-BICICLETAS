using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Estudiantes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api.Controllers;

/// <summary>W4 · Registro y enrolamiento del estudiante (CU-01). Cada estudiante solo accede a sus datos.</summary>
[ApiController]
[Route("api/v1/estudiante")]
[Authorize(Policy = Politicas.Estudiante)]
public sealed class EstudianteController(EstudianteService servicio) : ControllerBase
{
    private Guid IdEstudiante => Guid.Parse(User.FindFirst(ClaimsSistema.IdUsuario)!.Value);

    [HttpGet("perfil")]
    public async Task<ActionResult<PerfilEstudianteResponse>> Perfil(CancellationToken ct) =>
        Ok(await servicio.ObtenerPerfilAsync(IdEstudiante, ct));

    /// <response code="201">Bicicleta registrada en estado FUERA con su código QR.</response>
    /// <response code="409">El número de marco ya está registrado (CU-01, 7a).</response>
    [HttpPost("bicicletas")]
    public async Task<ActionResult<BicicletaPropiaResponse>> RegistrarBicicleta(RegistrarBicicletaRequest solicitud, CancellationToken ct)
    {
        BicicletaPropiaResponse bicicleta = await servicio.RegistrarBicicletaAsync(IdEstudiante, solicitud, ct);
        return Created($"/api/v1/estudiante/bicicletas/{bicicleta.IdBicicleta}", bicicleta);
    }

    /// <response code="204">Descriptor guardado (o reemplazado) con el consentimiento registrado.</response>
    /// <response code="422">Sin consentimiento o descriptor inválido.</response>
    [HttpPut("enrolamiento")]
    public async Task<IActionResult> Enrolar(EnrolamientoRequest solicitud, CancellationToken ct)
    {
        await servicio.EnrolarAsync(IdEstudiante, solicitud, ct);
        return NoContent();
    }
}
