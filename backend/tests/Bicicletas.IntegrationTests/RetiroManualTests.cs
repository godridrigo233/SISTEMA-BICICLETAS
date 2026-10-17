using System.Net;
using System.Net.Http.Json;
using Bicicletas.Domain.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>Derivación al Supervisor (CU-04): retiro manual con verificación del DNI del titular.</summary>
public sealed class RetiroManualTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    private const string Ruta = "/api/v1/retiros/manual";

    private async Task<T> ConsultarAsync<T>(FormattableString sql)
    {
        using IServiceScope ambito = fabrica.Services.CreateScope();
        return await ambito.ServiceProvider.GetRequiredService<AppDbContext>().Database.SqlQuery<T>(sql).SingleAsync();
    }

    private async Task<HttpResponseMessage> RetirarAsync(short rol, Guid idBicicleta, string dni)
    {
        HttpClient cliente = fabrica.CreateClient();
        string correo = await UsuariosPrueba.CrearAsync(fabrica, rol);
        var sesion = await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida);
        using var solicitud = AutenticacionTests.Solicitud(Ruta, sesion.Token, new { idBicicleta, dniVerificado = dni });
        return await cliente.SendAsync(solicitud);
    }

    private Task<string> DniDelTitularAsync(Guid idEstudiante) =>
        ConsultarAsync<string>($"SELECT dni AS \"Value\" FROM estudiantes WHERE id_estudiante = {idEstudiante}");

    [FactConBaseDatos]
    public async Task RetiroManual_DniCorrecto_PasaAFueraYAuditaManualSinDistancia()
    {
        var bici = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        using HttpResponseMessage r = await RetirarAsync(RolSistema.Supervisor, bici.IdBicicleta, await DniDelTitularAsync(bici.IdEstudiante));

        Assert.True(r.StatusCode == HttpStatusCode.OK, await r.Content.ReadAsStringAsync());
        Assert.Equal("FUERA", (await r.Content.ReadFromJsonAsync<Respuesta>())!.EstadoActualizado);
        Assert.Equal("FUERA", await ConsultarAsync<string>($"SELECT estado AS \"Value\" FROM bicicletas WHERE id_bicicleta = {bici.IdBicicleta}"));
        Assert.Equal("DERIVACION", await ConsultarAsync<string>($"""
            SELECT registro AS "Value" FROM v_monitoreo_auditoria
             WHERE id_bicicleta = {bici.IdBicicleta} AND tipo_evento = 'RETIRO' AND resultado = 'MANUAL' AND distancia_euclidiana IS NULL
            """));
    }

    [FactConBaseDatos]
    public async Task RetiroManual_DniDistinto_Responde422YLaBicicletaSigueDentro()
    {
        var bici = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        string dni = await DniDelTitularAsync(bici.IdEstudiante);
        string otro = dni == "00000001" ? "00000002" : "00000001";

        using HttpResponseMessage r = await RetirarAsync(RolSistema.Administrador, bici.IdBicicleta, otro);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, r.StatusCode);
        Assert.Equal("DENTRO", await ConsultarAsync<string>($"SELECT estado AS \"Value\" FROM bicicletas WHERE id_bicicleta = {bici.IdBicicleta}"));
        Assert.Equal(0, await ConsultarAsync<int>($"SELECT count(*)::int AS \"Value\" FROM auditoria_accesos WHERE id_bicicleta = {bici.IdBicicleta}"));
    }

    [FactConBaseDatos]
    public async Task RetiroManual_GariteroNoAutoriza_YBicicletaFueraEsConflicto()
    {
        var dentro = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        using HttpResponseMessage garitero = await RetirarAsync(RolSistema.Garitero, dentro.IdBicicleta, await DniDelTitularAsync(dentro.IdEstudiante));
        Assert.Equal(HttpStatusCode.Forbidden, garitero.StatusCode);

        var fuera = await DatosGarita.CrearBicicletaAsync(fabrica, "FUERA");
        using HttpResponseMessage conflicto = await RetirarAsync(RolSistema.Supervisor, fuera.IdBicicleta, await DniDelTitularAsync(fuera.IdEstudiante));
        Assert.Equal(HttpStatusCode.Conflict, conflicto.StatusCode);
    }

    internal sealed record Respuesta(string Resultado, string EstadoActualizado);
}
