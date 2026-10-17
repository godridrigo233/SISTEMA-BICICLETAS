using Bicicletas.Domain.Auditoria;
using Bicicletas.Domain.Bicicletas;

namespace Bicicletas.Application.Garita;

// Puertos de la capa de acceso a datos (patrón repositorio, P05); los implementa Infrastructure.
public interface IBicicletaRepositorio
{
    Task<BicicletaGaritaResponse?> ConsultarPorQrAsync(string codigoQr, CancellationToken ct);

    /// <summary>SELECT … FOR UPDATE: bloquea la fila hasta el COMMIT de la transacción en curso.</summary>
    Task<Bicicleta?> ObtenerConBloqueoAsync(Guid idBicicleta, CancellationToken ct);

    /// <summary>DNI del titular para la verificación manual del Supervisor; no se expone en las respuestas.</summary>
    Task<string?> ObtenerDniTitularAsync(Guid idEstudiante, CancellationToken ct);
}

public interface IAuditoriaRepositorio
{
    void Registrar(AuditoriaAcceso evento);
}

/// <summary>Unidad de trabajo: una transacción por caso de uso (atomicidad ACID).</summary>
public interface IUnidadDeTrabajo
{
    Task<ITransaccion> IniciarAsync(CancellationToken ct);

    Task GuardarAsync(CancellationToken ct);
}

public interface ITransaccion : IAsyncDisposable
{
    Task ConfirmarAsync(CancellationToken ct);
}
