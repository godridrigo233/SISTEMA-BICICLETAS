using Bicicletas.Domain.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.Infrastructure.Seguridad;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests.Infraestructura;

/// <summary>Crea cuentas sintéticas con correo único para cada prueba.</summary>
public static class UsuariosPrueba
{
    public const string PasswordValida = "Bicicleta2026";

    public static async Task<string> CrearAsync(FabricaApi fabrica, short idRol,
        bool activo = true, bool debeCambiarPassword = false, string password = PasswordValida)
    {
        ArgumentNullException.ThrowIfNull(fabrica);
        string dominio = idRol == RolSistema.Estudiante ? "@estudiante.ucsm.edu.pe" : "@ucsm.edu.pe";
        string correo = $"it.{Guid.NewGuid():N}{dominio}";
        var usuario = new Usuario(Guid.NewGuid(), idRol, correo, new HasherBCrypt().Hashear(password), debeCambiarPassword);
        if (!activo)
            usuario.Desactivar();

        using IServiceScope ambito = fabrica.Services.CreateScope();
        AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Usuarios.Add(usuario);
        await db.SaveChangesAsync();
        return correo;
    }
}
