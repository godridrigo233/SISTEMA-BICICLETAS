using System.Net;
using System.Net.Http.Json;
using Bicicletas.Domain.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>CU-04: la decisión biométrica se toma en el servidor y todo intento queda auditado.</summary>
public sealed class RetiroFacialTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    private static readonly Uri Ruta = new("/api/v1/retiros/autorizar", UriKind.Relative);

    private static double[] Vector(double desplazamiento = 0) =>
        Enumerable.Range(0, 128).Select(i => Math.Sin(i) / 5 + desplazamiento).ToArray();

    private async Task<(HttpClient Cliente, string Token)> SesionGaritaAsync()
    {
        HttpClient cliente = fabrica.CreateClient();
        string correo = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Garitero);
        var sesion = await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida);
        return (cliente, sesion.Token);
    }

    private async Task<T> ConsultarAsync<T>(FormattableString sql)
    {
        using IServiceScope ambito = fabrica.Services.CreateScope();
        AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Database.SqlQuery<T>(sql).SingleAsync();
    }

    private async Task<RespuestaRetiro> RetirarAsync(Guid idBicicleta, double[] descriptor, HttpStatusCode esperado = HttpStatusCode.OK)
    {
        var (cliente, token) = await SesionGaritaAsync();
        using (cliente)
        {
            using var solicitud = AutenticacionTests.Solicitud(Ruta.ToString(), token, new { idBicicleta, descriptorCapturado = descriptor, latenciaMs = 900 });
            using HttpResponseMessage respuesta = await cliente.SendAsync(solicitud);
            Assert.True(respuesta.StatusCode == esperado, await respuesta.Content.ReadAsStringAsync());
            return esperado == HttpStatusCode.OK ? (await respuesta.Content.ReadFromJsonAsync<RespuestaRetiro>())! : new RespuestaRetiro("", "", 0, 0);
        }
    }

    [FactConBaseDatos]
    public async Task Retiro_DescriptorDelTitular_AutorizaPasaAFueraYAuditaExitoso()
    {
        var bici = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        await DatosGarita.EnrolarAsync(fabrica, bici.IdEstudiante, Vector());

        RespuestaRetiro r = await RetirarAsync(bici.IdBicicleta, Vector(0.01));   // d = √(128·0.0001) ≈ 0.113

        Assert.Equal("AUTORIZADO", r.Resultado);
        Assert.Equal("FUERA", r.EstadoActualizado);
        Assert.InRange(r.DistanciaEuclidiana, 0.11, 0.12);
        Assert.Equal("FUERA", await ConsultarAsync<string>($"SELECT estado AS \"Value\" FROM bicicletas WHERE id_bicicleta = {bici.IdBicicleta}"));
        Assert.Equal(1, await ConsultarAsync<int>($"SELECT count(*)::int AS \"Value\" FROM auditoria_accesos WHERE id_bicicleta = {bici.IdBicicleta} AND tipo_evento = 'RETIRO' AND resultado = 'EXITOSO' AND distancia_euclidiana IS NOT NULL"));
    }

    [FactConBaseDatos]
    public async Task Retiro_RostroDeOtraPersona_DeniegaQuedaDentroYAuditaDenegado()
    {
        var bici = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        double[] referencia = Vector();
        await DatosGarita.EnrolarAsync(fabrica, bici.IdEstudiante, referencia);

        RespuestaRetiro r = await RetirarAsync(bici.IdBicicleta, Vector(0.1));   // d ≈ 1.13 > θ

        Assert.Equal("DENEGADO", r.Resultado);
        Assert.Equal("DENTRO", await ConsultarAsync<string>($"SELECT estado AS \"Value\" FROM bicicletas WHERE id_bicicleta = {bici.IdBicicleta}"));
        Assert.Equal(1, await ConsultarAsync<int>($"SELECT count(*)::int AS \"Value\" FROM auditoria_accesos WHERE id_bicicleta = {bici.IdBicicleta} AND resultado = 'DENEGADO'"));

        // El descriptor capturado no se persiste: el titular conserva un solo descriptor, sin cambios.
        Assert.Equal(1, await ConsultarAsync<int>($"SELECT count(*)::int AS \"Value\" FROM descriptores_biometricos WHERE id_estudiante = {bici.IdEstudiante}"));
        Assert.Equal(referencia[5], await ConsultarAsync<double>($"SELECT vector_embedding[6] AS \"Value\" FROM descriptores_biometricos WHERE id_estudiante = {bici.IdEstudiante}"), 10);
    }

    [FactConBaseDatos]
    public async Task Retiro_CasosInvalidos_Responden422y409()
    {
        var dentro = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        await DatosGarita.EnrolarAsync(fabrica, dentro.IdEstudiante, Vector());
        await RetirarAsync(dentro.IdBicicleta, new double[64], HttpStatusCode.UnprocessableEntity);

        var fuera = await DatosGarita.CrearBicicletaAsync(fabrica, "FUERA");
        await DatosGarita.EnrolarAsync(fabrica, fuera.IdEstudiante, Vector());
        await RetirarAsync(fuera.IdBicicleta, Vector(), HttpStatusCode.Conflict);

        var sinEnrolar = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        await RetirarAsync(sinEnrolar.IdBicicleta, Vector(), HttpStatusCode.Conflict);
    }

    internal sealed record RespuestaRetiro(string Resultado, string EstadoActualizado, double DistanciaEuclidiana, double UmbralTheta);
}
