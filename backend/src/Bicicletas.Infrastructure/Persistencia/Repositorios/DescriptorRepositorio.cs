using Bicicletas.Application.Retiros;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

/// <summary>Lee el descriptor de referencia (FLOAT8[128]); este vector nunca se expone por la API.</summary>
public sealed class DescriptorRepositorio(AppDbContext db) : IDescriptorRepositorio
{
    public Task<double[]?> ObtenerVectorDelTitularAsync(Guid idEstudiante, CancellationToken ct) =>
        db.Descriptores.AsNoTracking()
            .Where(d => d.IdEstudiante == idEstudiante)
            .Select(d => d.VectorEmbedding)
            .SingleOrDefaultAsync(ct);
}
