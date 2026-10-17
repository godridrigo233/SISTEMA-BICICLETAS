using System.ComponentModel.DataAnnotations;

namespace Bicicletas.Application.Contingencias;

/// <summary>Una fila del archivo de la garita o del registro manual (todo como texto, tal como se anotó).</summary>
public sealed record FilaContingencia(
    [MaxLength(40)] string? Folio,
    [MaxLength(40)] string? FechaHora,
    [MaxLength(20)] string? Tipo,
    [MaxLength(60)] string? Codigo,
    [MaxLength(20)] string? Dni,
    [MaxLength(100)] string? Vigilante);

/// <summary>Contenido del CSV exportado del Excel de la garita (texto UTF-8, máximo ~200 KB).</summary>
public sealed record ArchivoContingenciaRequest([Required, MaxLength(200_000)] string Contenido);

/// <summary>Fila revisada por el servidor: bicicleta autocompletada y resultado de la validación.</summary>
public sealed record FilaPreviaResponse(
    int Fila,
    string Folio,
    string Tipo,
    string Codigo,
    string? Bicicleta,
    string? EstadoBicicleta,
    DateTime? FechaHoraUtc,
    string? Dni,
    string? Vigilante,
    bool Valida,
    string? Error);

public sealed record ResultadoImportacionResponse(int Insertadas, int ConError, IReadOnlyList<FilaPreviaResponse> Filas);

public sealed record ContingenciaPendienteResponse(
    Guid IdContingencia, string Folio, string Origen, string Tipo, string Estudiante, string Bicicleta,
    DateTime HoraManualUtc, string Estado, string? Motivo);

/// <summary>Datos del modal «Revisar»: el DNI del titular solo se muestra parcialmente (Ley N.º 29733).</summary>
public sealed record DetalleContingenciaResponse(
    Guid IdContingencia, string Folio, string Tipo, string Estado, string? DniAnotado, string DniTitularParcial,
    string Titular, string CorreoTitular, string Bicicleta, string NumeroMarco, DateTime HoraManualUtc,
    string? Vigilante, string? Motivo);

public sealed record ResultadoConciliacionResponse(string Folio, string Tipo, string Resultado);

public sealed record LoteConciliadoResponse(int Conciliados, int Observados, int Conflictos, IReadOnlyList<ResultadoConciliacionResponse> Detalle);

/// <summary>Resolución de un retiro OBSERVADO: ERROR_DIGITACION, CONFIRMADO_TITULAR o NO_RECONOCE.</summary>
public sealed record RevisionRequest(
    [Required] string Resolucion,
    [RegularExpression("^[0-9]{8}$", ErrorMessage = "El DNI debe tener 8 dígitos.")] string? DniCorregido,
    [Required, MinLength(5), MaxLength(160)] string Motivo);

public sealed record BicicletaReferencia(Guid IdBicicleta, string CodigoQr, string NumeroMarco, string Titular, string MarcaColor, string Estado);

public sealed record NuevaContingencia(Guid IdBicicleta, DateTime HoraUtc, string Folio, string Tipo, string? Dni, Guid? IdVigilante);

public interface IContingenciaRepositorio
{
    Task<IReadOnlyList<BicicletaReferencia>> BuscarBicicletasAsync(IReadOnlyCollection<string> codigos, CancellationToken ct);

    /// <summary>Cuentas activas de personal (Garitero, Supervisor, Administrador) por correo.</summary>
    Task<IReadOnlyDictionary<string, Guid>> BuscarOperadoresAsync(IReadOnlyCollection<string> correos, CancellationToken ct);

    Task<IReadOnlyList<(Guid IdBicicleta, string Tipo, DateTime HoraUtc)>> MovimientosCargadosAsync(IReadOnlyCollection<Guid> idsBicicleta, CancellationToken ct);

    /// <summary>Inserta todas las filas en una sola transacción (todo o nada).</summary>
    Task InsertarAsync(IReadOnlyList<NuevaContingencia> filas, Guid idSupervisor, string origen, CancellationToken ct);

    Task<IReadOnlyList<ContingenciaPendienteResponse>> ListarPendientesAsync(CancellationToken ct);

    Task<DetalleContingenciaResponse?> ObtenerDetalleAsync(Guid idContingencia, CancellationToken ct);

    Task<string> ConciliarAsync(Guid idContingencia, Guid idSupervisor, bool confirmadoTitular, string? motivo, CancellationToken ct);

    Task<IReadOnlyList<ResultadoConciliacionResponse>> ConciliarLoteAsync(Guid idSupervisor, CancellationToken ct);

    /// <summary>Corrige el DNI de un OBSERVADO, lo devuelve a PENDIENTE y vuelve a conciliar en la misma transacción.</summary>
    Task<string> CorregirDniYConciliarAsync(Guid idContingencia, string dni, string motivo, Guid idSupervisor, CancellationToken ct);

    Task<bool> AnotarObservacionAsync(Guid idContingencia, string motivo, CancellationToken ct);

    Task<IReadOnlyList<string>> ListarVigilantesAsync(CancellationToken ct);
}
