using Bicicletas.Domain.Auditoria;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bicicletas.Infrastructure.Persistencia.Configuraciones;

public sealed class AuditoriaAccesoConfiguracion : IEntityTypeConfiguration<AuditoriaAcceso>
{
    public void Configure(EntityTypeBuilder<AuditoriaAcceso> builder)
    {
        builder.ToTable("auditoria_accesos");
        builder.HasKey(a => a.IdAuditoria);
        builder.Property(a => a.IdAuditoria).HasColumnName("id_auditoria").UseIdentityAlwaysColumn();
        builder.Property(a => a.IdBicicleta).HasColumnName("id_bicicleta");
        builder.Property(a => a.TipoEvento).HasColumnName("tipo_evento").HasMaxLength(10)
            .HasConversion(t => ConversionesEnum.ATipo(t), v => ConversionesEnum.DeTipo(v));
        builder.Property(a => a.DistanciaEuclidiana).HasColumnName("distancia_euclidiana");
        builder.Property(a => a.IdVigilante).HasColumnName("id_vigilante");
        builder.Property(a => a.Resultado).HasColumnName("resultado").HasMaxLength(15)
            .HasConversion(r => ConversionesEnum.AResultado(r), v => ConversionesEnum.DeResultado(v));
        builder.Property(a => a.TimestampEvento).HasColumnName("timestamp_evento");
        builder.Property(a => a.LatenciaMs).HasColumnName("latencia_ms");
    }
}
