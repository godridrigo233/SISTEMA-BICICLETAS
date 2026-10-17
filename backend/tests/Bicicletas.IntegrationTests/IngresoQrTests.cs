using System.Net;
using System.Net.Http.Json;
using Bicicletas.Domain.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>CU-03: identificación por QR e ingreso atómico.</summary>
public sealed class IngresoQrTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    private async Task<(HttpClient Cliente, string Token)> SesionAsync(short rol)
    {
        HttpClient cliente = fabrica.CreateClient();
        string correo = await UsuariosPrueba.CrearAsync(fabrica, rol);
        var sesion = await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida);
        return (cliente, sesion.Token);
    }

    [FactConBaseDatos]
    public async Task ConsultarPorQr_Registrada200_FormatoInvalido400_Inexistente404()
    {
        var bici = await DatosGarita.CrearBicicletaAsync(fabrica);
        var (cliente, token) = await SesionAsync(RolSistema.Garitero);
        using (cliente)
        {
            using var ok = AutenticacionTests.Solicitud($"/api/v1/bicicletas/{bici.CodigoQr}", token, metodo: HttpMethod.Get);
            using HttpResponseMessage r200 = await cliente.SendAsync(ok);
            Assert.True(r200.StatusCode == HttpStatusCode.OK, await r200.Content.ReadAsStringAsync());
            Bicicleta? cuerpo = await r200.Content.ReadFromJsonAsync<Bicicleta>();
            Assert.Equal("FUERA", cuerpo?.Estado);
            Assert.Equal("ALUMNO DE PRUEBA", cuerpo?.Titular);

            using var mal = AutenticacionTests.Solicitud("/api/v1/bicicletas/no-es-un-uuid", token, metodo: HttpMethod.Get);
            using HttpResponseMessage r400 = await cliente.SendAsync(mal);
            Assert.Equal(HttpStatusCode.BadRequest, r400.StatusCode);

            using var nada = AutenticacionTests.Solicitud($"/api/v1/bicicletas/{Guid.NewGuid()}", token, metodo: HttpMethod.Get);
            using HttpResponseMessage r404 = await cliente.SendAsync(nada);
            Assert.Equal(HttpStatusCode.NotFound, r404.StatusCode);
        }
    }

    [FactConBaseDatos]
    public async Task RegistrarIngreso_Fuera_PasaADentroYAudita_ElSegundoIngresoDa409()
    {
        var bici = await DatosGarita.CrearBicicletaAsync(fabrica);
        var (cliente, token) = await SesionAsync(RolSistema.Garitero);
        using (cliente)
        {
            using var primero = AutenticacionTests.Solicitud("/api/v1/ingresos/registrar", token, new { idBicicleta = bici.IdBicicleta, latenciaMs = 420 });
            using HttpResponseMessage r1 = await cliente.SendAsync(primero);
            Assert.True(r1.StatusCode == HttpStatusCode.OK, await r1.Content.ReadAsStringAsync());

            using var segundo = AutenticacionTests.Solicitud("/api/v1/ingresos/registrar", token, new { idBicicleta = bici.IdBicicleta });
            using HttpResponseMessage r2 = await cliente.SendAsync(segundo);
            Assert.Equal(HttpStatusCode.Conflict, r2.StatusCode);
        }

        using IServiceScope ambito = fabrica.Services.CreateScope();
        AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();
        string estado = await db.Database.SqlQuery<string>($"SELECT estado AS \"Value\" FROM bicicletas WHERE id_bicicleta = {bici.IdBicicleta}").SingleAsync();
        int eventos = await db.Database.SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM auditoria_accesos WHERE id_bicicleta = {bici.IdBicicleta} AND tipo_evento = 'INGRESO' AND resultado = 'EXITOSO' AND distancia_euclidiana IS NULL AND latencia_ms = 420").SingleAsync();
        Assert.Equal("DENTRO", estado);
        Assert.Equal(1, eventos);
    }

    [FactConBaseDatos]
    public async Task RegistrarIngreso_ConRolEstudiante_Devuelve403()
    {
        var bici = await DatosGarita.CrearBicicletaAsync(fabrica);
        var (cliente, token) = await SesionAsync(RolSistema.Estudiante);
        using (cliente)
        {
            using var solicitud = AutenticacionTests.Solicitud("/api/v1/ingresos/registrar", token, new { idBicicleta = bici.IdBicicleta });
            using HttpResponseMessage respuesta = await cliente.SendAsync(solicitud);
            Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
        }
    }

    internal sealed record Bicicleta(Guid IdBicicleta, string Estado, string Titular, string MarcaModelo);
}
