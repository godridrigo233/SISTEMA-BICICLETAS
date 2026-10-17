using Bicicletas.Infrastructure.Persistencia;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.Infrastructure;

/// <summary>Registro de la capa de acceso a datos (composición desde la API).</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfraestructura(this IServiceCollection services)
    {
        // La cadena de conexión llega por la variable de entorno ConnectionStrings__Principal (Render).
        services.AddDbContext<AppDbContext>((proveedor, opciones) =>
        {
            string cadena = proveedor.GetRequiredService<IConfiguration>().GetConnectionString("Principal")
                ?? throw new InvalidOperationException("Falta la variable de entorno ConnectionStrings__Principal.");
            opciones.UseNpgsql(cadena);
        });
        return services;
    }
}
