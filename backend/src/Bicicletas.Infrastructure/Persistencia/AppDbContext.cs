using Bicicletas.Domain.Auditoria;
using Bicicletas.Domain.Bicicletas;
using Bicicletas.Domain.Biometria;
using Bicicletas.Domain.Contingencias;
using Bicicletas.Domain.Estudiantes;
using Bicicletas.Domain.Usuarios;
using Microsoft.EntityFrameworkCore;

namespace Bicicletas.Infrastructure.Persistencia;

/// <summary>
/// Contexto de EF Core en modo database-first: el esquema lo definen las migraciones SQL
/// (database/migrations) y aquí solo se mapea. EF Core nunca crea ni altera tablas.
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> opciones) : DbContext(opciones)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Estudiante> Estudiantes => Set<Estudiante>();
    public DbSet<Bicicleta> Bicicletas => Set<Bicicleta>();
    public DbSet<DescriptorBiometrico> Descriptores => Set<DescriptorBiometrico>();
    public DbSet<AuditoriaAcceso> Auditoria => Set<AuditoriaAcceso>();
    public DbSet<ContingenciaIngreso> Contingencias => Set<ContingenciaIngreso>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
