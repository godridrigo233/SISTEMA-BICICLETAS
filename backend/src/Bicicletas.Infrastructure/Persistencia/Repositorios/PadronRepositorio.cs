using Bicicletas.Application.Usuarios;
using Bicicletas.Domain.Estudiantes;
using Bicicletas.Domain.Usuarios;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia.Repositorios;

public sealed class PadronRepositorio(AppDbContext db) : IPadronRepositorio
{
    public async Task<IReadOnlyList<EstudianteExistente>> BuscarEstudiantesAsync(IReadOnlyCollection<string> codigos,
        IReadOnlyCollection<string> dnis, IReadOnlyCollection<string> correos, CancellationToken ct) =>
        await (from e in db.Estudiantes.AsNoTracking()
               join u in db.Usuarios.AsNoTracking() on e.IdEstudiante equals u.IdUsuario
               where codigos.Contains(e.CodigoUniversitario) || dnis.Contains(e.Dni) || correos.Contains(u.CorreoInstitucional)
               select new EstudianteExistente(e.CodigoUniversitario, e.Dni, u.CorreoInstitucional))
              .ToListAsync(ct);

    public async Task<IReadOnlySet<string>> CorreosEnUsoAsync(IReadOnlyCollection<string> correos, CancellationToken ct) =>
        (await db.Usuarios.AsNoTracking().Where(u => correos.Contains(u.CorreoInstitucional))
            .Select(u => u.CorreoInstitucional).ToListAsync(ct)).ToHashSet(StringComparer.Ordinal);

    public async Task InsertarAsync(IReadOnlyList<NuevoEstudiante> estudiantes, string hashPendiente, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(estudiantes);
        await using var transaccion = await db.Database.BeginTransactionAsync(ct);
        var ids = estudiantes.Select(_ => Guid.NewGuid()).ToList();
        // Primero las cuentas y luego el padrón (FK estudiantes → usuarios); EF Core agrupa los INSERT en lotes.
        for (int i = 0; i < estudiantes.Count; i++)
            db.Usuarios.Add(new Usuario(ids[i], RolSistema.Estudiante, estudiantes[i].Correo, hashPendiente, debeCambiarPassword: true));
        await db.SaveChangesAsync(ct);
        for (int i = 0; i < estudiantes.Count; i++)
        {
            NuevoEstudiante e = estudiantes[i];
            db.Estudiantes.Add(Estudiante.DelPadron(ids[i], e.CodigoUniversitario, e.Dni, e.Nombres, e.Apellidos, e.Facultad));
        }
        await db.SaveChangesAsync(ct);
        await transaccion.CommitAsync(ct);
    }
}
