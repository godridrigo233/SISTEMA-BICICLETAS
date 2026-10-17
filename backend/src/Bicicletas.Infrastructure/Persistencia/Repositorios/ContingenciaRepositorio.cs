using Bicicletas.Application.Contingencias;
using Bicicletas.Domain.Bicicletas;
using Bicicletas.Domain.Usuarios;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

/// <summary>Resultado escalar de las funciones de conciliación.</summary>
public sealed class FilaLote
{
    public string Folio { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string Resultado { get; set; } = string.Empty;
}

/// <summary>Acceso a contingencias_ingreso y a las funciones conciliar_contingencia / conciliar_lote (V003).</summary>
public sealed class ContingenciaRepositorio(AppDbContext db) : IContingenciaRepositorio
{
    public async Task<IReadOnlyList<BicicletaReferencia>> BuscarBicicletasAsync(IReadOnlyCollection<string> codigos, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(codigos);
        if (codigos.Count == 0)
            return [];
        var qr = codigos.Select(c => c.ToLowerInvariant()).ToList();
        var marcos = codigos.Select(c => c.ToUpperInvariant()).ToList();
        return await (from b in db.Bicicletas.AsNoTracking()
                      join e in db.Estudiantes.AsNoTracking() on b.IdEstudiante equals e.IdEstudiante
                      where qr.Contains(b.CodigoQr) || marcos.Contains(b.NumeroMarco)
                      select new BicicletaReferencia(b.IdBicicleta, b.CodigoQr, b.NumeroMarco, e.Nombres + " " + e.Apellidos,
                          b.MarcaModelo + " / " + b.Color, b.Estado == EstadoBicicleta.Dentro ? "DENTRO" : "FUERA"))
                     .ToListAsync(ct);
    }

    public async Task<IReadOnlyDictionary<string, Guid>> BuscarOperadoresAsync(IReadOnlyCollection<string> correos, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(correos);
        if (correos.Count == 0)
            return new Dictionary<string, Guid>();
        return await db.Usuarios.AsNoTracking()
            .Where(u => correos.Contains(u.CorreoInstitucional) && u.Activo && u.IdRol != RolSistema.Estudiante)
            .ToDictionaryAsync(u => u.CorreoInstitucional, u => u.IdUsuario, StringComparer.Ordinal, ct);
    }

    public async Task<IReadOnlyList<(Guid IdBicicleta, string Tipo, DateTime HoraUtc)>> MovimientosCargadosAsync(
        IReadOnlyCollection<Guid> idsBicicleta, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(idsBicicleta);
        var filas = await db.Contingencias.AsNoTracking()
            .Where(c => idsBicicleta.Contains(c.IdBicicleta))
            .Select(c => new { c.IdBicicleta, c.TipoEvento, c.HoraIngresoManual })
            .ToListAsync(ct);
        return filas.Select(f => (f.IdBicicleta, f.TipoEvento == Domain.Auditoria.TipoEvento.Ingreso ? "INGRESO" : "RETIRO", f.HoraIngresoManual)).ToList();
    }

    public async Task InsertarAsync(IReadOnlyList<NuevaContingencia> filas, Guid idSupervisor, string origen, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(filas);
        await using var transaccion = await db.Database.BeginTransactionAsync(ct);
        foreach (NuevaContingencia f in filas)
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO contingencias_ingreso
                       (id_bicicleta, hora_ingreso_manual, folio_bitacora, id_supervisor, tipo_evento, dni_presentado, id_vigilante, origen_carga)
                VALUES ({f.IdBicicleta}, {f.HoraUtc}, {f.Folio}, {idSupervisor}, {f.Tipo}, {f.Dni}::char(8), {f.IdVigilante}::uuid, {origen})
                """, ct);
        }
        await transaccion.CommitAsync(ct);
    }

    public async Task<IReadOnlyList<ContingenciaPendienteResponse>> ListarPendientesAsync(CancellationToken ct) =>
        await (from c in db.Contingencias.AsNoTracking()
               join b in db.Bicicletas.AsNoTracking() on c.IdBicicleta equals b.IdBicicleta
               join e in db.Estudiantes.AsNoTracking() on b.IdEstudiante equals e.IdEstudiante
               where c.EstadoConciliacion == "PENDIENTE" || c.EstadoConciliacion == "OBSERVADO"
               orderby c.HoraIngresoManual, c.FolioBitacora
               select new ContingenciaPendienteResponse(c.IdContingencia, c.FolioBitacora, c.OrigenCarga,
                   c.TipoEvento == Domain.Auditoria.TipoEvento.Ingreso ? "INGRESO" : "RETIRO",
                   e.Nombres + " " + e.Apellidos, b.MarcaModelo + " / " + b.Color, c.HoraIngresoManual,
                   c.EstadoConciliacion, c.MotivoObservacion))
              .Take(500)
              .ToListAsync(ct);

    public async Task<DetalleContingenciaResponse?> ObtenerDetalleAsync(Guid idContingencia, CancellationToken ct)
    {
        var fila = await (from c in db.Contingencias.AsNoTracking()
                          join b in db.Bicicletas.AsNoTracking() on c.IdBicicleta equals b.IdBicicleta
                          join e in db.Estudiantes.AsNoTracking() on b.IdEstudiante equals e.IdEstudiante
                          join u in db.Usuarios.AsNoTracking() on e.IdEstudiante equals u.IdUsuario
                          join v in db.Usuarios.AsNoTracking() on c.IdVigilante equals (Guid?)v.IdUsuario into vs
                          from v in vs.DefaultIfEmpty()
                          where c.IdContingencia == idContingencia
                          select new
                          {
                              c.IdContingencia, c.FolioBitacora, c.TipoEvento, c.EstadoConciliacion, c.DniPresentado, e.Dni,
                              Titular = e.Nombres + " " + e.Apellidos, u.CorreoInstitucional, Bicicleta = b.MarcaModelo + " / " + b.Color,
                              b.NumeroMarco, c.HoraIngresoManual, Vigilante = v == null ? null : v.CorreoInstitucional, c.MotivoObservacion,
                          })
                         .SingleOrDefaultAsync(ct);
        if (fila is null)
            return null;
        // El DNI completo del titular no sale del servidor: solo los 4 primeros dígitos (Ley N.º 29733).
        string parcial = string.Concat(fila.Dni.AsSpan(0, Math.Min(4, fila.Dni.Length)), " ****");
        return new DetalleContingenciaResponse(fila.IdContingencia, fila.FolioBitacora,
            fila.TipoEvento == Domain.Auditoria.TipoEvento.Ingreso ? "INGRESO" : "RETIRO", fila.EstadoConciliacion, fila.DniPresentado,
            parcial, fila.Titular, fila.CorreoInstitucional, fila.Bicicleta, fila.NumeroMarco, fila.HoraIngresoManual, fila.Vigilante,
            fila.MotivoObservacion);
    }

    public Task<string> ConciliarAsync(Guid idContingencia, Guid idSupervisor, bool confirmadoTitular, string? motivo, CancellationToken ct) =>
        db.Database.SqlQuery<string>($"""
            SELECT conciliar_contingencia({idContingencia}, {idSupervisor}, {confirmadoTitular}, {motivo}::varchar)::text AS "Value"
            """).SingleAsync(ct);

    public async Task<IReadOnlyList<ResultadoConciliacionResponse>> ConciliarLoteAsync(Guid idSupervisor, CancellationToken ct)
    {
        List<FilaLote> filas = await db.Database.SqlQuery<FilaLote>($"""
            SELECT folio::text AS "Folio", tipo::text AS "Tipo", resultado::text AS "Resultado" FROM conciliar_lote({idSupervisor})
            """).ToListAsync(ct);
        return filas.Select(f => new ResultadoConciliacionResponse(f.Folio, f.Tipo, f.Resultado)).ToList();
    }

    public async Task<string> CorregirDniYConciliarAsync(Guid idContingencia, string dni, string motivo, Guid idSupervisor, CancellationToken ct)
    {
        await using var transaccion = await db.Database.BeginTransactionAsync(ct);
        int filas = await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE contingencias_ingreso
               SET dni_presentado = {dni}::char(8), estado_conciliacion = 'PENDIENTE', motivo_observacion = NULL
             WHERE id_contingencia = {idContingencia} AND estado_conciliacion = 'OBSERVADO'
            """, ct);
        if (filas == 0)
            return "NO_PENDIENTE";
        string resultado = await ConciliarAsync(idContingencia, idSupervisor, false, "Error de digitación corregido: " + motivo, ct);
        if (resultado == "OBSERVADO")
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE contingencias_ingreso SET motivo_observacion = {"DNI corregido tampoco coincide: " + motivo}
                 WHERE id_contingencia = {idContingencia}
                """, ct);
        }
        await transaccion.CommitAsync(ct);
        return resultado;
    }

    public async Task<bool> AnotarObservacionAsync(Guid idContingencia, string motivo, CancellationToken ct) =>
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE contingencias_ingreso SET motivo_observacion = {motivo}
             WHERE id_contingencia = {idContingencia} AND estado_conciliacion = 'OBSERVADO'
            """, ct) == 1;

    public async Task<IReadOnlyList<string>> ListarVigilantesAsync(CancellationToken ct) =>
        await db.Usuarios.AsNoTracking()
            .Where(u => u.Activo && (u.IdRol == RolSistema.Garitero || u.IdRol == RolSistema.Supervisor))
            .OrderBy(u => u.CorreoInstitucional)
            .Select(u => u.CorreoInstitucional)
            .ToListAsync(ct);
}
