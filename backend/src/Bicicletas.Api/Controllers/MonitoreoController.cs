using System.Globalization;
using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Comun;
using Bicicletas.Application.Monitoreo;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api.Controllers;

/// <summary>W6 · Monitoreo y Reportes. Solo Supervisor y Administrador (RBAC).</summary>
[ApiController]
[Route("api/v1/monitoreo")]
[Authorize(Policy = Politicas.Monitoreo)]
public sealed class MonitoreoController(MonitoreoService servicio, TimeProvider reloj) : ControllerBase
{
    [HttpGet("resumen")]
    public async Task<ActionResult<ResumenMonitoreoResponse>> Resumen(CancellationToken ct) =>
        Ok(await servicio.ResumenAsync(ct));

    /// <summary>Titulares con 3 o más retiros denegados consecutivos (alerta de revisión biométrica, P05).</summary>
    [HttpGet("alertas-biometricas")]
    public async Task<ActionResult<IReadOnlyList<AlertaBiometricaResponse>>> AlertasBiometricas(CancellationToken ct) =>
        Ok(await servicio.AlertasBiometricasAsync(ct));

    /// <response code="422">Filtro no válido.</response>
    [HttpGet("eventos")]
    public async Task<ActionResult<Pagina<EventoMonitoreoResponse>>> Eventos([FromQuery] FiltroMonitoreo filtro, CancellationToken ct) =>
        Ok(await servicio.ConsultarAsync(filtro, ct));

    /// <summary>Exporta la bitácora filtrada como CSV (máximo 10 000 filas).</summary>
    [HttpGet("eventos/exportar")]
    public async Task<IActionResult> Exportar([FromQuery] FiltroMonitoreo filtro, CancellationToken ct)
    {
        byte[] csv = await servicio.ExportarCsvAsync(filtro, ct);
        string nombre = string.Create(CultureInfo.InvariantCulture, $"monitoreo-{HoraPeru.Hoy(reloj):yyyyMMdd}.csv");
        return File(csv, "text/csv; charset=utf-8", nombre);
    }
}
