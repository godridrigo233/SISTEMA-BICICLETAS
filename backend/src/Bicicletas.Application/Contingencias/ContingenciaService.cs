using System.Globalization;
using System.Text.RegularExpressions;
using Bicicletas.Application.Comun;
using Bicicletas.Domain.Comun;

namespace Bicicletas.Application.Contingencias;

/// <summary>
/// W3 · Consola de Regularización (CU-06, CC-08 y CC-10): importación del CSV de la garita con
/// autocompletado, registro manual, conciliación por fila o por lote y revisión de retiros observados.
/// La conciliación la ejecutan las funciones atómicas de la base (V003); aquí solo se valida y orquesta.
/// </summary>
public sealed partial class ContingenciaService(IContingenciaRepositorio repositorio, TimeProvider reloj)
{
    private static readonly string[] Formatos =
    [
        "dd/MM/yyyy HH:mm", "d/M/yyyy H:mm", "dd/MM/yyyy HH:mm:ss", "d/M/yyyy H:mm:ss",
        "yyyy-MM-ddTHH:mm", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd HH:mm", "yyyy-MM-dd HH:mm:ss",
    ];

    public Task<IReadOnlyList<FilaPreviaResponse>> PrevisualizarAsync(ArchivoContingenciaRequest archivo, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(archivo);
        return PrevisualizarFilasAsync(LectorCsvContingencias.Leer(archivo.Contenido), ct);
    }

    public async Task<ResultadoImportacionResponse> ImportarAsync(ArchivoContingenciaRequest archivo, Guid idSupervisor, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(archivo);
        var revisadas = await RevisarAsync(LectorCsvContingencias.Leer(archivo.Contenido), ct);
        var validas = revisadas.Where(r => r.Nueva is not null).Select(r => r.Nueva!).ToList();
        if (validas.Count == 0)
            throw new ValidacionNegocioException("Ninguna fila es válida; corrija el archivo y vuelva a validarlo.");
        await repositorio.InsertarAsync(validas, idSupervisor, "CSV", ct);
        return new ResultadoImportacionResponse(validas.Count, revisadas.Count - validas.Count, revisadas.Select(r => r.Previa).ToList());
    }

    public async Task<FilaPreviaResponse> PrevisualizarFilaAsync(FilaContingencia fila, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(fila);
        return (await PrevisualizarFilasAsync([(1, fila)], ct))[0];
    }

    public async Task<FilaPreviaResponse> RegistrarFilaAsync(FilaContingencia fila, Guid idSupervisor, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(fila);
        var (previa, nueva) = (await RevisarAsync([(1, fila)], ct))[0];
        if (nueva is null)
            throw new ValidacionNegocioException(previa.Error ?? "La fila no es válida.");
        await repositorio.InsertarAsync([nueva], idSupervisor, "MANUAL", ct);
        return previa;
    }

    public Task<IReadOnlyList<ContingenciaPendienteResponse>> ListarPendientesAsync(CancellationToken ct) =>
        repositorio.ListarPendientesAsync(ct);

    public async Task<DetalleContingenciaResponse> ObtenerDetalleAsync(Guid id, CancellationToken ct) =>
        await repositorio.ObtenerDetalleAsync(id, ct) ?? throw new RecursoNoEncontradoException("Contingencia no encontrada.");

    public async Task<ResultadoConciliacionResponse> ConciliarAsync(Guid id, Guid idSupervisor, CancellationToken ct)
    {
        DetalleContingenciaResponse detalle = await ObtenerDetalleAsync(id, ct);
        string resultado = await repositorio.ConciliarAsync(id, idSupervisor, false, null, ct);
        return resultado == "NO_PENDIENTE"
            ? throw new ConflictoEstadoException("La contingencia ya no está PENDIENTE.")
            : new ResultadoConciliacionResponse(detalle.Folio, detalle.Tipo, resultado);
    }

    public async Task<LoteConciliadoResponse> ConciliarLoteAsync(Guid idSupervisor, CancellationToken ct)
    {
        IReadOnlyList<ResultadoConciliacionResponse> detalle = await repositorio.ConciliarLoteAsync(idSupervisor, ct);
        return new LoteConciliadoResponse(
            detalle.Count(d => d.Resultado == "CONCILIADO"),
            detalle.Count(d => d.Resultado == "OBSERVADO"),
            detalle.Count(d => d.Resultado == "CONFLICTO"),
            detalle);
    }

    public async Task<ResultadoConciliacionResponse> RevisarAsync(Guid id, RevisionRequest solicitud, Guid idSupervisor, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        DetalleContingenciaResponse detalle = await ObtenerDetalleAsync(id, ct);
        if (detalle.Estado != "OBSERVADO")
            throw new ConflictoEstadoException("Solo se revisan contingencias en estado OBSERVADO.");
        string motivo = solicitud.Motivo.Trim();

        string resultado = solicitud.Resolucion.Trim().ToUpperInvariant() switch
        {
            "ERROR_DIGITACION" => await repositorio.CorregirDniYConciliarAsync(id,
                solicitud.DniCorregido ?? throw new ValidacionNegocioException("Indique el DNI corregido."), motivo, idSupervisor, ct),
            "CONFIRMADO_TITULAR" => await repositorio.ConciliarAsync(id, idSupervisor, true, "Confirmado por el titular: " + motivo, ct),
            "NO_RECONOCE" => await repositorio.AnotarObservacionAsync(id, "Titular no reconoce el retiro: " + motivo, ct)
                ? "OBSERVADO"
                : throw new ConflictoEstadoException("La contingencia ya no está OBSERVADA."),
            _ => throw new ValidacionNegocioException("Resolución no válida. Use ERROR_DIGITACION, CONFIRMADO_TITULAR o NO_RECONOCE."),
        };
        return resultado == "NO_PENDIENTE"
            ? throw new ConflictoEstadoException("La contingencia ya no está OBSERVADA.")
            : new ResultadoConciliacionResponse(detalle.Folio, detalle.Tipo, resultado);
    }

    public Task<IReadOnlyList<string>> ListarVigilantesAsync(CancellationToken ct) => repositorio.ListarVigilantesAsync(ct);

    private async Task<IReadOnlyList<FilaPreviaResponse>> PrevisualizarFilasAsync(IReadOnlyList<(int, FilaContingencia)> filas, CancellationToken ct) =>
        (await RevisarAsync(filas, ct)).Select(r => r.Previa).ToList();

    /// <summary>Valida cada fila contra la base y devuelve la vista previa y, si es válida, el registro a insertar.</summary>
    private async Task<List<(FilaPreviaResponse Previa, NuevaContingencia? Nueva)>> RevisarAsync(
        IReadOnlyList<(int Fila, FilaContingencia Datos)> filas, CancellationToken ct)
    {
        var codigos = filas.Select(f => f.Datos.Codigo?.Trim()).OfType<string>().Where(c => c.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        IReadOnlyList<BicicletaReferencia> bicicletas = await repositorio.BuscarBicicletasAsync(codigos, ct);
        var correos = filas.Select(f => f.Datos.Vigilante?.Trim().ToLowerInvariant()).OfType<string>().Where(c => c.Length > 0).Distinct(StringComparer.Ordinal).ToList();
        IReadOnlyDictionary<string, Guid> operadores = await repositorio.BuscarOperadoresAsync(correos, ct);
        var cargados = (await repositorio.MovimientosCargadosAsync(bicicletas.Select(b => b.IdBicicleta).ToList(), ct)).ToHashSet();

        DateTime ahora = reloj.GetUtcNow().UtcDateTime;
        var enArchivo = new HashSet<(Guid, string, DateTime)>();
        var resultado = new List<(FilaPreviaResponse, NuevaContingencia?)>();
        foreach (var (numero, d) in filas)
        {
            string folio = d.Folio?.Trim() ?? string.Empty;
            string tipo = d.Tipo?.Trim().ToUpperInvariant() ?? string.Empty;
            string codigo = d.Codigo?.Trim() ?? string.Empty;
            string? dni = string.IsNullOrWhiteSpace(d.Dni) ? null : d.Dni.Trim();
            string? vigilante = string.IsNullOrWhiteSpace(d.Vigilante) ? null : d.Vigilante.Trim().ToLowerInvariant();
            BicicletaReferencia? bici = bicicletas.FirstOrDefault(b =>
                string.Equals(b.CodigoQr, codigo, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(b.NumeroMarco, codigo, StringComparison.OrdinalIgnoreCase));
            DateTime? hora = LeerFecha(d.FechaHora);

            string? error =
                folio.Length is 0 or > 20 ? "Folio obligatorio (máximo 20 caracteres)."
                : tipo is not ("INGRESO" or "RETIRO") ? "El tipo debe ser INGRESO o RETIRO."
                : hora is null ? "Fecha y hora no válidas (dd/mm/aaaa hh:mm)."
                : hora > ahora.AddMinutes(5) ? "La fecha y hora no puede ser futura."
                : hora < ahora.AddHours(-72).AddMinutes(1) ? "Supera las 72 h permitidas para regularizar."
                : dni is not null && !Dni().IsMatch(dni) ? "El DNI debe tener 8 dígitos."
                : tipo == "RETIRO" && dni is null ? "Un retiro requiere el DNI presentado."
                : codigo.Length == 0 ? "Indique el código QR o el número de marco."
                : bici is null ? "Código no registrado."
                : vigilante is not null && !operadores.ContainsKey(vigilante) ? "Vigilante no registrado o inactivo."
                : cargados.Contains((bici.IdBicicleta, tipo, hora.Value)) ? "Ya cargado (duplicado)."
                : !enArchivo.Add((bici.IdBicicleta, tipo, hora.Value)) ? "Duplicado dentro del archivo."
                : null;

            var previa = new FilaPreviaResponse(numero, folio, tipo, codigo,
                bici is null ? null : $"{bici.Titular} — {bici.MarcaColor}", bici?.Estado, hora, dni, vigilante, error is null, error);
            NuevaContingencia? nueva = error is null
                ? new NuevaContingencia(bici!.IdBicicleta, hora!.Value, folio, tipo, dni, vigilante is null ? null : operadores[vigilante])
                : null;
            resultado.Add((previa, nueva));
        }
        return resultado;
    }

    /// <summary>La hora anotada en garita es hora de Perú (UTC−5); se guarda en UTC.</summary>
    private static DateTime? LeerFecha(string? texto) =>
        DateTime.TryParseExact(texto?.Trim(), Formatos, CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime local)
            ? new DateTimeOffset(local, HoraPeru.Desfase).UtcDateTime
            : null;

    [GeneratedRegex("^[0-9]{8}$")]
    private static partial Regex Dni();
}
