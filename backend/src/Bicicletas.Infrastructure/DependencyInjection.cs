using Bicicletas.Application.Autenticacion;
using Bicicletas.Application.Contingencias;
using Bicicletas.Application.Estudiantes;
using Bicicletas.Application.Garita;
using Bicicletas.Application.Monitoreo;
using Bicicletas.Application.Retiros;
using Bicicletas.Application.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.Infrastructure.Persistencia.Repositorios;
using Bicicletas.Infrastructure.Seguridad;
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

        services.AddSingleton<IHasherContrasenas, HasherBCrypt>();
        services.AddSingleton<IControlIntentos, ControlIntentosMemoria>();
        services.AddScoped<IUsuarioRepositorio, UsuarioRepositorio>();
        services.AddScoped<IBicicletaRepositorio, BicicletaRepositorio>();
        services.AddScoped<IAuditoriaRepositorio, AuditoriaRepositorio>();
        services.AddScoped<IUnidadDeTrabajo, UnidadDeTrabajo>();
        services.AddScoped<IDescriptorRepositorio, DescriptorRepositorio>();
        services.AddScoped<IEstudianteRepositorio, EstudianteRepositorio>();
        services.AddScoped<IMonitoreoRepositorio, MonitoreoRepositorio>();
        services.AddScoped<IContingenciaRepositorio, ContingenciaRepositorio>();
        services.AddScoped<IGestionUsuariosRepositorio, GestionUsuariosRepositorio>();
        services.AddScoped<IRegistroInvestigacion, RegistroInvestigacion>();
        return services;
    }
}
