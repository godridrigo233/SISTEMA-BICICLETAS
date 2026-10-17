using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Garita;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api.Controllers;

/// <summary>CU-03, paso 2: identificación de la bicicleta por su código QR en la garita (W2).</summary>
[ApiController]
[Route("api/v1/bicicletas")]
[Authorize(Policy = Politicas.OperacionGarita)]
public sealed class BicicletasController(IBicicletaRepositorio bicicletas) : ControllerBase
{
    /// <response code="200">Bicicleta registrada con su estado y los datos para el cotejo visual.</response>
    /// <response code="400">El código no tiene formato UUID.</response>
    /// <response code="404">Código no registrado (CU-03, flujo 3a).</response>
    [HttpGet("{codigoQr}")]
    public async Task<ActionResult<BicicletaGaritaResponse>> ConsultarPorQr(string codigoQr, CancellationToken ct)
    {
        if (!Guid.TryParse(codigoQr?.Trim(), out Guid uuid))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Formato no válido",
                detail: "El código QR debe tener formato UUID (36 caracteres).");

        BicicletaGaritaResponse? bicicleta = await bicicletas.ConsultarPorQrAsync(uuid.ToString(), ct);
        return bicicleta is null
            ? Problem(statusCode: StatusCodes.Status404NotFound, title: "No encontrado", detail: "Código no registrado.")
            : Ok(bicicleta);
    }
}
