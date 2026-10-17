using Bicicletas.Domain.Bicicletas;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bicicletas.Infrastructure.Persistencia.Configuraciones;

public sealed class BicicletaConfiguracion : IEntityTypeConfiguration<Bicicleta>
{
    public void Configure(EntityTypeBuilder<Bicicleta> builder)
    {
        builder.ToTable("bicicletas");
        builder.HasKey(b => b.IdBicicleta);
        builder.Property(b => b.IdBicicleta).HasColumnName("id_bicicleta").ValueGeneratedNever();
        builder.Property(b => b.IdEstudiante).HasColumnName("id_estudiante");
        builder.Property(b => b.CodigoQr).HasColumnName("codigo_qr").HasMaxLength(36);
        builder.Property(b => b.NumeroMarco).HasColumnName("numero_marco").HasMaxLength(40);
        builder.Property(b => b.MarcaModelo).HasColumnName("marca_modelo").HasMaxLength(50);
        builder.Property(b => b.Color).HasColumnName("color").HasMaxLength(25);
        builder.Property(b => b.RasgosDistintivos).HasColumnName("rasgos_distintivos").HasMaxLength(100);
        builder.Property(b => b.Estado).HasColumnName("estado").HasMaxLength(10)
            .HasConversion(e => ConversionesEnum.AEstado(e), v => ConversionesEnum.DeEstado(v));
    }
}
