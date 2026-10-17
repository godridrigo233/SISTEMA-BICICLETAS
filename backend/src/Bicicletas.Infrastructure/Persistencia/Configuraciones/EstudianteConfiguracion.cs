using Bicicletas.Domain.Estudiantes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bicicletas.Infrastructure.Persistencia.Configuraciones;

public sealed class EstudianteConfiguracion : IEntityTypeConfiguration<Estudiante>
{
    public void Configure(EntityTypeBuilder<Estudiante> builder)
    {
        builder.ToTable("estudiantes");
        builder.HasKey(e => e.IdEstudiante);
        builder.Property(e => e.IdEstudiante).HasColumnName("id_estudiante").ValueGeneratedNever();
        builder.Property(e => e.CodigoUniversitario).HasColumnName("codigo_universitario").HasMaxLength(10);
        builder.Property(e => e.Dni).HasColumnName("dni").HasMaxLength(8).IsFixedLength();
        builder.Property(e => e.Nombres).HasColumnName("nombres").HasMaxLength(60);
        builder.Property(e => e.Apellidos).HasColumnName("apellidos").HasMaxLength(60);
        builder.Property(e => e.Facultad).HasColumnName("facultad").HasMaxLength(80);
    }
}
