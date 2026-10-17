using Bicicletas.Application.Estudiantes;
using Bicicletas.Domain.Auditoria;
using Bicicletas.Domain.Bicicletas;
using Bicicletas.Domain.Biometria;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

public sealed class EstudianteRepositorio(AppDbContext db) : IEstudianteRepositorio
{
    public async Task<PerfilEstudianteResponse?> ObtenerPerfilAsync(Guid idEstudiante, CancellationToken ct)
    {
        var estudiante = await db.Estudiantes.AsNoTracking().SingleOrDefaultAsync(e => e.IdEstudiante == idEstudiante, ct);
        if (estudiante is null)
            return null;

        List<BicicletaPropiaResponse> bicicletas = await db.Bicicletas.AsNoTracking()
            .Where(b => b.IdEstudiante == idEstudiante)
            .OrderBy(b => b.NumeroMarco)
            .Select(b => new BicicletaPropiaResponse(b.IdBicicleta, b.CodigoQr, b.NumeroMarco, b.MarcaModelo, b.Color,
                b.RasgosDistintivos, b.Estado == EstadoBicicleta.Dentro ? "DENTRO" : "FUERA"))
            .ToListAsync(ct);
        bool enrolado = await db.Descriptores.AnyAsync(d => d.IdEstudiante == idEstudiante, ct);

        return new PerfilEstudianteResponse(estudiante.Nombres, estudiante.Apellidos, estudiante.CodigoUniversitario,
            estudiante.Facultad, enrolado, bicicletas);
    }

    public Task<bool> ExisteNumeroMarcoAsync(string numeroMarco, CancellationToken ct) =>
        db.Bicicletas.AnyAsync(b => b.NumeroMarco == numeroMarco, ct);

    public void AgregarBicicleta(Bicicleta bicicleta) => db.Bicicletas.Add(bicicleta);

    public Task<DescriptorBiometrico?> ObtenerDescriptorAsync(Guid idEstudiante, CancellationToken ct) =>
        db.Descriptores.SingleOrDefaultAsync(d => d.IdEstudiante == idEstudiante, ct);

    public void AgregarDescriptor(DescriptorBiometrico descriptor) => db.Descriptores.Add(descriptor);

    public Task GuardarAsync(CancellationToken ct) => db.SaveChangesAsync(ct);

    public async Task<(int Total, IReadOnlyList<MovimientoHistorialResponse> Elementos)> ConsultarHistorialAsync(Guid idEstudiante,
        TipoEvento? tipo, DateTime? desdeUtc, DateTime? hastaUtc, int saltar, int tomar, CancellationToken ct)
    {
        var consulta = from a in db.Auditoria.AsNoTracking()
                       join b in db.Bicicletas.AsNoTracking() on a.IdBicicleta equals b.IdBicicleta
                       where b.IdEstudiante == idEstudiante
                       select new { a, b.MarcaModelo, b.Color };
        if (tipo is { } t)
            consulta = consulta.Where(x => x.a.TipoEvento == t);
        if (desdeUtc is { } d)
            consulta = consulta.Where(x => x.a.TimestampEvento >= d);
        if (hastaUtc is { } h)
            consulta = consulta.Where(x => x.a.TimestampEvento < h);

        int total = await consulta.CountAsync(ct);
        List<MovimientoHistorialResponse> elementos = await consulta
            .OrderByDescending(x => x.a.TimestampEvento).ThenByDescending(x => x.a.IdAuditoria)
            .Skip(saltar).Take(tomar)
            .Select(x => new MovimientoHistorialResponse(
                x.a.TimestampEvento,
                x.a.TipoEvento == TipoEvento.Ingreso ? "INGRESO" : "RETIRO",
                x.a.Resultado == ResultadoAcceso.Exitoso ? "EXITOSO" : x.a.Resultado == ResultadoAcceso.Denegado ? "DENEGADO" : "MANUAL",
                x.a.Resultado == ResultadoAcceso.Manual ? "MANUAL" : "AUTOMATICO",
                x.MarcaModelo + " (" + x.Color + ")"))
            .ToListAsync(ct);
        return (total, elementos);
    }
}
