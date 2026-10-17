using Bicicletas.Application.Garita;
using Bicicletas.Domain.Auditoria;
using Bicicletas.Domain.Bicicletas;
using Bicicletas.Domain.Biometria;
using Bicicletas.Domain.Comun;

namespace Bicicletas.Application.Retiros;

/// <summary>
/// CU-04: verificación biométrica y autorización de retiro. El navegador extrae el descriptor (Edge
/// Computing) y la API toma la decisión recalculando la distancia contra el descriptor de referencia,
/// que nunca sale del servidor: un cliente manipulado no puede autorizar un retiro (OWASP A04).
/// </summary>
public sealed class AutorizarRetiroService(
    IBicicletaRepositorio bicicletas,
    IDescriptorRepositorio descriptores,
    IAuditoriaRepositorio auditoria,
    IUnidadDeTrabajo unidad,
    PoliticaBiometrica politica,
    TimeProvider reloj)
{
    public async Task<RetiroResponse> EjecutarAsync(RetiroRequest solicitud, Guid idVigilante, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        ValidarDescriptor(solicitud.DescriptorCapturado);

        try
        {
            await using ITransaccion transaccion = await unidad.IniciarAsync(ct);

            // 1. SELECT … FOR UPDATE: dos garitas no pueden retirar la misma bicicleta a la vez.
            Bicicleta bicicleta = await bicicletas.ObtenerConBloqueoAsync(solicitud.IdBicicleta, ct)
                ?? throw new RecursoNoEncontradoException("Código no registrado.");
            if (bicicleta.Estado != EstadoBicicleta.Dentro)
                throw new ConflictoEstadoException("La bicicleta no figura DENTRO; no procede el retiro.");

            double[] referencia = await descriptores.ObtenerVectorDelTitularAsync(bicicleta.IdEstudiante, ct)
                ?? throw new ConflictoEstadoException("El titular no tiene enrolamiento facial; derive al supervisor.");

            // 2. Decisión autoritativa en el servidor.
            double distancia = PoliticaBiometrica.Distancia(referencia, solicitud.DescriptorCapturado);
            bool coincide = politica.EsCoincidente(distancia);
            if (coincide)
                bicicleta.RegistrarSalida();   // DENTRO → FUERA (RF-08)

            // 3. Todo intento queda auditado, incluido el DENEGADO (RF-07, OWASP A09).
            auditoria.Registrar(new AuditoriaAcceso(
                bicicleta.IdBicicleta, TipoEvento.Retiro, distancia, idVigilante,
                coincide ? ResultadoAcceso.Exitoso : ResultadoAcceso.Denegado,
                solicitud.LatenciaMs, reloj.GetUtcNow().UtcDateTime));

            await unidad.GuardarAsync(ct);
            await transaccion.ConfirmarAsync(ct);   // COMMIT: estado y auditoría juntos, o ninguno

            return new RetiroResponse(
                coincide ? "AUTORIZADO" : "DENEGADO",
                bicicleta.Estado == EstadoBicicleta.Dentro ? "DENTRO" : "FUERA",
                Math.Round(distancia, 4),
                politica.UmbralTheta);
        }
        finally
        {
            Array.Clear(solicitud.DescriptorCapturado);   // el descriptor no sobrevive a la operación
        }
    }

    private static void ValidarDescriptor(double[]? descriptor)
    {
        if (descriptor is null || descriptor.Length != PoliticaBiometrica.Dimensiones || !descriptor.All(double.IsFinite))
            throw new ValidacionNegocioException($"El descriptor debe tener exactamente {PoliticaBiometrica.Dimensiones} valores numéricos.");
    }
}
