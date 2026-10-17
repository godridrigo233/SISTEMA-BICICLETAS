using Bicicletas.Domain.Biometria;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bicicletas.Infrastructure.Persistencia.Configuraciones;

public sealed class DescriptorBiometricoConfiguracion : IEntityTypeConfiguration<DescriptorBiometrico>
{
    public void Configure(EntityTypeBuilder<DescriptorBiometrico> builder)
    {
        builder.ToTable("descriptores_biometricos");
        builder.HasKey(d => d.IdDescriptor);
        builder.Property(d => d.IdDescriptor).HasColumnName("id_descriptor").ValueGeneratedNever();
        builder.Property(d => d.IdEstudiante).HasColumnName("id_estudiante");
        builder.Property(d => d.VectorEmbedding).HasColumnName("vector_embedding").HasColumnType("double precision[]");
        builder.Property(d => d.VersionModelo).HasColumnName("version_modelo").HasMaxLength(20);
        builder.Property(d => d.ActualizadoEn).HasColumnName("actualizado_en");
        builder.Property(d => d.ConsentimientoEn).HasColumnName("consentimiento_en");
        builder.HasIndex(d => d.IdEstudiante).IsUnique();
    }
}
