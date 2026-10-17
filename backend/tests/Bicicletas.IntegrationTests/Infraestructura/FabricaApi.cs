using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Bicicletas.IntegrationTests.Infraestructura;

/// <summary>Levanta la API en memoria contra la base de datos de pruebas del pipeline.</summary>
public sealed class FabricaApi : WebApplicationFactory<Program>
{
    public static string? CadenaPruebas => Environment.GetEnvironmentVariable("ConnectionStrings__Pruebas");

    public const string ClaveFirmaPruebas = "clave-de-firma-solo-para-pruebas-de-integracion-0123456789";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuracion) => configuracion.AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["ConnectionStrings:Principal"] = CadenaPruebas,
                ["Jwt:ClaveFirma"] = ClaveFirmaPruebas,
                ["Jwt:Emisor"] = "bicicletas-ucsm-pruebas",
            }));
    }
}
