using Bicicletas.Domain.Contingencias;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bicicletas.Infrastructure.Persistencia.Configuraciones;

public sealed class ContingenciaIngresoConfiguracion : IEntityTypeConfiguration<ContingenciaIngreso>
{
    public void Configure(EntityTypeBuilder<ContingenciaIngreso> builder)
    {
        builder.ToTable("contingencias_ingreso");
        builder.HasKey(c => c.IdContingencia);
        builder.Property(c => c.IdContingencia).HasColumnName("id_contingencia").ValueGeneratedNever();
        builder.Property(c => c.IdBicicleta).HasColumnName("id_bicicleta");
        builder.Property(c => c.HoraIngresoManual).HasColumnName("hora_ingreso_manual");
        builder.Property(c => c.FolioBitacora).HasColumnName("folio_bitacora").HasMaxLength(20);
        builder.Property(c => c.IdSupervisor).HasColumnName("id_supervisor");
        builder.Property(c => c.EstadoConciliacion).HasColumnName("estado_conciliacion").HasMaxLength(12);
        builder.Property(c => c.TimestampCarga).HasColumnName("timestamp_carga").ValueGeneratedOnAdd();
        builder.Property(c => c.TipoEvento).HasColumnName("tipo_evento").HasMaxLength(10)
            .HasConversion(t => ConversionesEnum.ATipo(t), v => ConversionesEnum.DeTipo(v));
        builder.Property(c => c.DniPresentado).HasColumnName("dni_presentado").HasMaxLength(8).IsFixedLength();
        builder.Property(c => c.MotivoObservacion).HasColumnName("motivo_observacion").HasMaxLength(200);
        builder.Property(c => c.IdVigilante).HasColumnName("id_vigilante");
        builder.Property(c => c.IdAuditoria).HasColumnName("id_auditoria");
        builder.Property(c => c.OrigenCarga).HasColumnName("origen_carga").HasMaxLength(10);
    }
}
