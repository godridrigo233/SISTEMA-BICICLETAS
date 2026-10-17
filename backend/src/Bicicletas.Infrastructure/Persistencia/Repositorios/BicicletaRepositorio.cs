using Bicicletas.Application.Garita;
using Bicicletas.Domain.Bicicletas;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

/// <summary>Consultas parametrizadas con EF Core 10 + Npgsql (OWASP A03).</summary>
public sealed class BicicletaRepositorio(AppDbContext db) : IBicicletaRepositorio
{
    public Task<BicicletaGaritaResponse?> ConsultarPorQrAsync(string codigoQr, CancellationToken ct) =>
        (from b in db.Bicicletas.AsNoTracking()
         join e in db.Estudiantes.AsNoTracking() on b.IdEstudiante equals e.IdEstudiante
         where b.CodigoQr == codigoQr
         select new BicicletaGaritaResponse(
             b.IdBicicleta, b.CodigoQr, b.Estado == EstadoBicicleta.Dentro ? "DENTRO" : "FUERA",
             b.NumeroMarco, b.MarcaModelo, b.Color, b.RasgosDistintivos,
             e.Nombres + " " + e.Apellidos, e.CodigoUniversitario))
        .SingleOrDefaultAsync(ct);

    public async Task<Bicicleta?> ObtenerConBloqueoAsync(Guid idBicicleta, CancellationToken ct)
    {
        // {idBicicleta} se envía como parámetro ($1), nunca como texto concatenado.
        List<Bicicleta> filas = await db.Bicicletas
            .FromSqlInterpolated($"SELECT * FROM bicicletas WHERE id_bicicleta = {idBicicleta} FOR UPDATE")
            .ToListAsync(ct);
        return filas.SingleOrDefault();
    }

    public Task<string?> ObtenerDniTitularAsync(Guid idEstudiante, CancellationToken ct) =>
        db.Estudiantes.AsNoTracking().Where(e => e.IdEstudiante == idEstudiante).Select(e => (string?)e.Dni).SingleOrDefaultAsync(ct);
}
