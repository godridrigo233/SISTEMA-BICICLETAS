using Bicicletas.Application.Usuarios;
using Bicicletas.Domain.Usuarios;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

public sealed class GestionUsuariosRepositorio(AppDbContext db) : IGestionUsuariosRepositorio
{
    public async Task<(int Total, IReadOnlyList<UsuarioResumenResponse> Elementos)> ListarAsync(short? idRol, string? correo,
        int saltar, int tomar, CancellationToken ct)
    {
        IQueryable<Usuario> consulta = db.Usuarios.AsNoTracking();
        if (idRol is { } r)
            consulta = consulta.Where(u => u.IdRol == r);
        if (correo is not null)
            consulta = consulta.Where(u => u.CorreoInstitucional.Contains(correo));
        int total = await consulta.CountAsync(ct);
        List<Usuario> filas = await consulta.OrderBy(u => u.IdRol).ThenBy(u => u.CorreoInstitucional).Skip(saltar).Take(tomar).ToListAsync(ct);
        return (total, filas.Select(u => new UsuarioResumenResponse(u.IdUsuario, u.CorreoInstitucional, u.IdRol,
            GestionUsuariosService.NombreRol(u.IdRol), u.CreadoEn, u.Activo, u.DebeCambiarPassword)).ToList());
    }

    public Task<bool> ExisteCorreoAsync(string correo, CancellationToken ct) =>
        db.Usuarios.AnyAsync(u => u.CorreoInstitucional == correo, ct);

    public Task<Usuario?> ObtenerAsync(Guid idUsuario, CancellationToken ct) =>
        db.Usuarios.SingleOrDefaultAsync(u => u.IdUsuario == idUsuario, ct);

    public void Agregar(Usuario usuario) => db.Usuarios.Add(usuario);

    // Se marca para borrar y se confirma en el mismo SaveChanges que la inactivación (atomicidad).
    public async Task EliminarDescriptorAsync(Guid idEstudiante, CancellationToken ct)
    {
        var descriptor = await db.Descriptores.SingleOrDefaultAsync(d => d.IdEstudiante == idEstudiante, ct);
        if (descriptor is not null)
            db.Descriptores.Remove(descriptor);
    }

    public Task GuardarAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
