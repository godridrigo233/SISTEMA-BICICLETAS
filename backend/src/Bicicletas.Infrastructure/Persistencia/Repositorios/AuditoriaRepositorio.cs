using Bicicletas.Application.Garita;
using Bicicletas.Domain.Auditoria;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

/// <summary>Solo inserta: la tabla rechaza UPDATE y DELETE por trigger (V002).</summary>
public sealed class AuditoriaRepositorio(AppDbContext db) : IAuditoriaRepositorio
{
    public void Registrar(AuditoriaAcceso evento) => db.Auditoria.Add(evento);

    public async Task<int> ContarRechazosConsecutivosAsync(Guid idEstudiante, CancellationToken ct)
    {
        DateTime? enrolado = await db.Descriptores.AsNoTracking()
            .Where(d => d.IdEstudiante == idEstudiante).Select(d => d.ActualizadoEn).SingleOrDefaultAsync(ct);
        List<ResultadoAcceso> recientes = await (
                from a in db.Auditoria.AsNoTracking()
                join b in db.Bicicletas.AsNoTracking() on a.IdBicicleta equals b.IdBicicleta
                where b.IdEstudiante == idEstudiante && a.TipoEvento == TipoEvento.Retiro
                      && (enrolado == null || a.TimestampEvento > enrolado)
                orderby a.TimestampEvento descending, a.IdAuditoria descending
                select a.Resultado)
            .Take(PoliticaRevision.Maximo)
            .ToListAsync(ct);
        return recientes.TakeWhile(r => r == ResultadoAcceso.Denegado).Count();
    }
}
