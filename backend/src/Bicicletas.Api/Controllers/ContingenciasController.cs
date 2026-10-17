using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Contingencias;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api.Controllers;

/// <summary>W3 · Consola de Regularización (CU-06). Solo Supervisor y Administrador.</summary>
[ApiController]
[Route("api/v1/contingencias")]
[Authorize(Policy = Politicas.Regularizacion)]
public sealed class ContingenciasController(ContingenciaService servicio) : ControllerBase
{
    private Guid IdSupervisor => Guid.Parse(User.FindFirst(ClaimsSistema.IdUsuario)!.Value);

    /// <summary>Valida el CSV y devuelve la vista previa con la bicicleta autocompletada; no guarda nada.</summary>
    [HttpPost("csv/previsualizar")]
    public async Task<ActionResult<IReadOnlyList<FilaPreviaResponse>>> Previsualizar(ArchivoContingenciaRequest solicitud, CancellationToken ct) =>
        Ok(await servicio.PrevisualizarAsync(solicitud, ct));

    /// <summary>Vuelve a validar en el servidor y agrega al lote solo las filas válidas (origen CSV).</summary>
    [HttpPost("csv/importar")]
    public async Task<ActionResult<ResultadoImportacionResponse>> Importar(ArchivoContingenciaRequest solicitud, CancellationToken ct) =>
        Ok(await servicio.ImportarAsync(solicitud, IdSupervisor, ct));

    [HttpPost("fila/previsualizar")]
    public async Task<ActionResult<FilaPreviaResponse>> PrevisualizarFila(FilaContingencia fila, CancellationToken ct) =>
        Ok(await servicio.PrevisualizarFilaAsync(fila, ct));

    /// <response code="201">Fila agregada al lote (origen MANUAL).</response>
    /// <response code="422">La fila no es válida; el detalle indica el motivo.</response>
    [HttpPost("fila")]
    public async Task<ActionResult<FilaPreviaResponse>> RegistrarFila(FilaContingencia fila, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await servicio.RegistrarFilaAsync(fila, IdSupervisor, ct));

    [HttpGet("pendientes")]
    public async Task<ActionResult<IReadOnlyList<ContingenciaPendienteResponse>>> Pendientes(CancellationToken ct) =>
        Ok(await servicio.ListarPendientesAsync(ct));

    [HttpGet("vigilantes")]
    public async Task<ActionResult<IReadOnlyList<string>>> Vigilantes(CancellationToken ct) =>
        Ok(await servicio.ListarVigilantesAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DetalleContingenciaResponse>> Detalle(Guid id, CancellationToken ct) =>
        Ok(await servicio.ObtenerDetalleAsync(id, ct));

    /// <response code="200">CONCILIADO, OBSERVADO o CONFLICTO (este último queda PENDIENTE con el motivo).</response>
    [HttpPost("{id:guid}/conciliar")]
    public async Task<ActionResult<ResultadoConciliacionResponse>> Conciliar(Guid id, CancellationToken ct) =>
        Ok(await servicio.ConciliarAsync(id, IdSupervisor, ct));

    /// <summary>Concilia todas las PENDIENTE en orden cronológico (ingresos antes que retiros a la misma hora).</summary>
    [HttpPost("conciliar-lote")]
    public async Task<ActionResult<LoteConciliadoResponse>> ConciliarLote(CancellationToken ct) =>
        Ok(await servicio.ConciliarLoteAsync(IdSupervisor, ct));

    [HttpPost("{id:guid}/revisar")]
    public async Task<ActionResult<ResultadoConciliacionResponse>> Revisar(Guid id, RevisionRequest solicitud, CancellationToken ct) =>
        Ok(await servicio.RevisarAsync(id, solicitud, IdSupervisor, ct));
}
