using System.Net;
using Bicicletas.Domain.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>
/// Fase B de la tesis: con el modo de investigación activo, el descriptor capturado en la garita se
/// conserva seudonimizado (vinculado a la cuenta y a su auditoría) para el cálculo fuera de línea.
/// </summary>
public sealed class InvestigacionFaseBTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    private static double[] Vector(double desplazamiento = 0) =>
        Enumerable.Range(0, 128).Select(i => Math.Sin(i) / 5 + desplazamiento).ToArray();

    [FactConBaseDatos]
    public async Task Retiro_ConModoInvestigacion_GuardaElDescriptorVinculadoASuAuditoria()
    {
        using WebApplicationFactory<Program> investigacion = fabrica.WithWebHostBuilder(b =>
            b.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(
                new Dictionary<string, string?> { ["Investigacion:FaseBHabilitada"] = "true" })));
        var bici = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        await DatosGarita.EnrolarAsync(fabrica, bici.IdEstudiante, Vector());
        string correo = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Garitero);
        double[] capturado = Vector(0.1);   // d ≈ 1.13 > θ: también se registra el intento DENEGADO

        using HttpClient cliente = investigacion.CreateClient();
        var sesion = await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida);
        using var solicitud = AutenticacionTests.Solicitud("/api/v1/retiros/autorizar", sesion.Token,
            new { idBicicleta = bici.IdBicicleta, descriptorCapturado = capturado, latenciaMs = 700 });
        using HttpResponseMessage respuesta = await cliente.SendAsync(solicitud);
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);

        using IServiceScope ambito = fabrica.Services.CreateScope();
        AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();
        var fila = await db.Database.SqlQuery<FilaCaptura>($"""
            SELECT c.vector_embedding AS "Vector", c.distancia_euclidiana AS "Distancia", c.latencia_ms AS "Latencia",
                   c.version_modelo AS "Version", a.resultado AS "Resultado"
            FROM investigacion_capturas c JOIN auditoria_accesos a ON a.id_auditoria = c.id_auditoria
            WHERE c.id_estudiante = {bici.IdEstudiante}
            """).SingleAsync();

        Assert.Equal(128, fila.Vector.Length);
        Assert.Equal(capturado[7], fila.Vector[7], 10);
        Assert.InRange(fila.Distancia, 1.1, 1.2);
        Assert.True(fila.Latencia >= 700);
        Assert.Equal("face-api.js-0.22.2-ssd", fila.Version);
        Assert.Equal("DENEGADO", fila.Resultado);
    }

    private sealed class FilaCaptura
    {
        public double[] Vector { get; set; } = [];
        public double Distancia { get; set; }
        public int? Latencia { get; set; }
        public string Version { get; set; } = "";
        public string Resultado { get; set; } = "";
    }
}
