using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>
/// Verifica que el mapeo de EF Core coincide con el esquema creado por las migraciones V001–V005
/// (enfoque database-first): si una columna o tabla no existe, la consulta falla.
/// </summary>
public sealed class ModeloDatosTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    [FactConBaseDatos]
    public async Task Mapeo_ConsultaLasSeisTablasDeNegocio_SinErrores()
    {
        using IServiceScope ambito = fabrica.Services.CreateScope();
        AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();

        await db.Usuarios.Take(1).ToListAsync();
        await db.Estudiantes.Take(1).ToListAsync();
        await db.Bicicletas.Take(1).ToListAsync();
        await db.Descriptores.Take(1).ToListAsync();
        await db.Auditoria.Take(1).ToListAsync();
        await db.Contingencias.Take(1).ToListAsync();

        Assert.True(await db.Database.CanConnectAsync());
    }
}
