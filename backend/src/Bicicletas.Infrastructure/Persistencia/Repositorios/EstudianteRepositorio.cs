using Bicicletas.Application.Estudiantes;
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
}
