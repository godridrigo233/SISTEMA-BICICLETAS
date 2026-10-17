using Bicicletas.Application.Autenticacion;
using Bicicletas.Domain.Usuarios;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

/// <summary>Consultas parametrizadas por EF Core (OWASP A03): el correo nunca se concatena en SQL.</summary>
public sealed class UsuarioRepositorio(AppDbContext db) : IUsuarioRepositorio
{
    public Task<Usuario?> ObtenerPorCorreoAsync(string correoNormalizado, CancellationToken ct) =>
        db.Usuarios.SingleOrDefaultAsync(u => u.CorreoInstitucional == correoNormalizado, ct);

    public Task<Usuario?> ObtenerPorIdAsync(Guid idUsuario, CancellationToken ct) =>
        db.Usuarios.SingleOrDefaultAsync(u => u.IdUsuario == idUsuario, ct);

    public Task GuardarCambiosAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
