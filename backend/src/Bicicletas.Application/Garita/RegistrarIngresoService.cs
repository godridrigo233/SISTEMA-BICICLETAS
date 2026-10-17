using Bicicletas.Domain.Auditoria;
using Bicicletas.Domain.Bicicletas;
using Bicicletas.Domain.Comun;

namespace Bicicletas.Application.Garita;

/// <summary>
/// CU-03: ingreso por QR, sin verificación facial. El cambio FUERA → DENTRO y el registro en la
/// auditoría se confirman juntos o no se confirma ninguno (atomicidad); el bloqueo de fila impide
/// que dos garitas registren el mismo ingreso a la vez (aislamiento).
/// </summary>
public sealed class RegistrarIngresoService(
    IBicicletaRepositorio bicicletas,
    IAuditoriaRepositorio auditoria,
    IUnidadDeTrabajo unidad,
    TimeProvider reloj)
{
    public async Task<MovimientoResponse> EjecutarAsync(IngresoRequest solicitud, Guid idVigilante, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        await using ITransaccion transaccion = await unidad.IniciarAsync(ct);

        Bicicleta bicicleta = await bicicletas.ObtenerConBloqueoAsync(solicitud.IdBicicleta, ct)
            ?? throw new RecursoNoEncontradoException("Código no registrado.");

        bicicleta.RegistrarIngreso();   // 409 si ya figura DENTRO (CU-03, flujo 5a)

        auditoria.Registrar(new AuditoriaAcceso(
            bicicleta.IdBicicleta, TipoEvento.Ingreso, distanciaEuclidiana: null, idVigilante,
            ResultadoAcceso.Exitoso, solicitud.LatenciaMs, reloj.GetUtcNow().UtcDateTime));

        await unidad.GuardarAsync(ct);
        await transaccion.ConfirmarAsync(ct);
        return new MovimientoResponse("EXITOSO", "DENTRO");
    }
}
