using Bicicletas.Application.Garita;
using Bicicletas.Domain.Auditoria;
using Bicicletas.Domain.Bicicletas;
using Bicicletas.Domain.Comun;

namespace Bicicletas.Application.Retiros;

/// <summary>
/// Retiro manual del Supervisor (derivación de CU-04): procede solo si el DNI presentado coincide con
/// el del titular. Queda auditado como RETIRO/MANUAL sin distancia y con el Supervisor como operador,
/// por lo que en Monitoreo aparece con registro «DERIVACION» (v_monitoreo_auditoria).
/// </summary>
public sealed class RetiroManualService(
    IBicicletaRepositorio bicicletas,
    IAuditoriaRepositorio auditoria,
    IUnidadDeTrabajo unidad,
    TimeProvider reloj)
{
    public async Task<RetiroManualResponse> EjecutarAsync(RetiroManualRequest solicitud, Guid idSupervisor, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        await using ITransaccion transaccion = await unidad.IniciarAsync(ct);

        Bicicleta bicicleta = await bicicletas.ObtenerConBloqueoAsync(solicitud.IdBicicleta, ct)
            ?? throw new RecursoNoEncontradoException("Código no registrado.");
        if (bicicleta.Estado != EstadoBicicleta.Dentro)
            throw new ConflictoEstadoException("La bicicleta no figura DENTRO; no procede el retiro.");

        string? dniTitular = await bicicletas.ObtenerDniTitularAsync(bicicleta.IdEstudiante, ct);
        if (!string.Equals(dniTitular?.Trim(), solicitud.DniVerificado, StringComparison.Ordinal))
            throw new ValidacionNegocioException("El DNI no coincide con el del titular registrado; no procede el retiro.");

        bicicleta.RegistrarSalida();
        auditoria.Registrar(new AuditoriaAcceso(bicicleta.IdBicicleta, TipoEvento.Retiro, null, idSupervisor,
            ResultadoAcceso.Manual, null, reloj.GetUtcNow().UtcDateTime));

        await unidad.GuardarAsync(ct);
        await transaccion.ConfirmarAsync(ct);
        return new RetiroManualResponse("AUTORIZADO_MANUAL", "FUERA");
    }
}
