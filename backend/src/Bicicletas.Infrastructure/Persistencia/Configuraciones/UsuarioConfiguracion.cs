using Bicicletas.Domain.Usuarios;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bicicletas.Infrastructure.Persistencia.Configuraciones;

public sealed class UsuarioConfiguracion : IEntityTypeConfiguration<Usuario>
{
    public void Configure(EntityTypeBuilder<Usuario> builder)
    {
        builder.ToTable("usuarios");
        builder.HasKey(u => u.IdUsuario);
        builder.Property(u => u.IdUsuario).HasColumnName("id_usuario").ValueGeneratedNever();
        builder.Property(u => u.IdRol).HasColumnName("id_rol");
        builder.Property(u => u.CorreoInstitucional).HasColumnName("correo_institucional").HasMaxLength(100);
        builder.Property(u => u.PasswordHash).HasColumnName("password_hash").HasMaxLength(255);
        builder.Property(u => u.Activo).HasColumnName("activo");
        builder.Property(u => u.CreadoEn).HasColumnName("creado_en").ValueGeneratedOnAdd();
        builder.Property(u => u.DebeCambiarPassword).HasColumnName("debe_cambiar_password");
        builder.HasIndex(u => u.CorreoInstitucional).IsUnique();
    }
}
