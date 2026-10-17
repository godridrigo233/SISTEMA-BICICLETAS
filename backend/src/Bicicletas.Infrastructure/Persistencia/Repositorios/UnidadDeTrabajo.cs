using Bicicletas.Application.Garita;
using Microsoft.EntityFrameworkCore.Storage;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

/// <summary>Una transacción por caso de uso; sin COMMIT explícito, al liberarse hace ROLLBACK.</summary>
public sealed class UnidadDeTrabajo(AppDbContext db) : IUnidadDeTrabajo
{
    public async Task<ITransaccion> IniciarAsync(CancellationToken ct) =>
        new TransaccionEf(await db.Database.BeginTransactionAsync(ct));

    public Task GuardarAsync(CancellationToken ct) => db.SaveChangesAsync(ct);

    private sealed class TransaccionEf(IDbContextTransaction transaccion) : ITransaccion
    {
        public Task ConfirmarAsync(CancellationToken ct) => transaccion.CommitAsync(ct);

        public ValueTask DisposeAsync() => transaccion.DisposeAsync();
    }
}
