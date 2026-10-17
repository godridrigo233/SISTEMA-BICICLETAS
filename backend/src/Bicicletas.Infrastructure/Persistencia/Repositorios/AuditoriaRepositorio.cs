using Bicicletas.Application.Garita;
using Bicicletas.Domain.Auditoria;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

/// <summary>Solo inserta: la tabla rechaza UPDATE y DELETE por trigger (V002).</summary>
public sealed class AuditoriaRepositorio(AppDbContext db) : IAuditoriaRepositorio
{
    public void Registrar(AuditoriaAcceso evento) => db.Auditoria.Add(evento);
}
