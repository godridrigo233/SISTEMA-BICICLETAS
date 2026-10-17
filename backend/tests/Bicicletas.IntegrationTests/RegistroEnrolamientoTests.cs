using System.Net;
using System.Net.Http.Json;
using Bicicletas.Domain.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>CU-01: registro de bicicleta y enrolamiento facial (W4).</summary>
public sealed class RegistroEnrolamientoTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    [FactConBaseDatos]
    public async Task Estudiante_RegistraBicicletaYSeEnrola_ElMarcoDuplicadoDa409()
    {
        var (correo, idEstudiante) = await DatosGarita.CrearEstudianteConCuentaAsync(fabrica);
        using HttpClient cliente = fabrica.CreateClient();
        string token = (await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida)).Token;
        string marco = $"MK-{Guid.NewGuid():N}"[..20];

        using var alta = AutenticacionTests.Solicitud("/api/v1/estudiante/bicicletas", token,
            new { numeroMarco = marco, marcaModelo = "Trek Marlin 5", color = "Azul", rasgosDistintivos = "Canasta delantera" });
        using HttpResponseMessage creada = await cliente.SendAsync(alta);
        Assert.True(creada.StatusCode == HttpStatusCode.Created, await creada.Content.ReadAsStringAsync());
        Bici? bici = await creada.Content.ReadFromJsonAsync<Bici>();
        Assert.True(Guid.TryParse(bici?.CodigoQr, out _));
        Assert.Equal("FUERA", bici?.Estado);

        using var repetida = AutenticacionTests.Solicitud("/api/v1/estudiante/bicicletas", token,
            new { numeroMarco = marco.ToLowerInvariant(), marcaModelo = "Otra", color = "Rojo" });
        using HttpResponseMessage conflicto = await cliente.SendAsync(repetida);
        Assert.Equal(HttpStatusCode.Conflict, conflicto.StatusCode);

        double[] vector = Enumerable.Range(0, 128).Select(i => i / 1000.0).ToArray();
        using var sinConsentimiento = AutenticacionTests.Solicitud("/api/v1/estudiante/enrolamiento", token,
            new { descriptor = vector, consentimientoAceptado = false, versionModelo = "face-api-0.22.2" }, HttpMethod.Put);
        using HttpResponseMessage r422 = await cliente.SendAsync(sinConsentimiento);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, r422.StatusCode);

        using var enrolar = AutenticacionTests.Solicitud("/api/v1/estudiante/enrolamiento", token,
            new { descriptor = vector, consentimientoAceptado = true, versionModelo = "face-api-0.22.2" }, HttpMethod.Put);
        using HttpResponseMessage r204 = await cliente.SendAsync(enrolar);
        Assert.Equal(HttpStatusCode.NoContent, r204.StatusCode);

        using var perfil = AutenticacionTests.Solicitud("/api/v1/estudiante/perfil", token, metodo: HttpMethod.Get);
        using HttpResponseMessage rPerfil = await cliente.SendAsync(perfil);
        Perfil? datos = await rPerfil.Content.ReadFromJsonAsync<Perfil>();
        Assert.True(datos?.Enrolado);
        Assert.Single(datos!.Bicicletas);

        using IServiceScope ambito = fabrica.Services.CreateScope();
        AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.Descriptores.CountAsync(d => d.IdEstudiante == idEstudiante));
    }

    [FactConBaseDatos]
    public async Task Perfil_ConRolGaritero_Devuelve403()
    {
        string correo = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Garitero);
        using HttpClient cliente = fabrica.CreateClient();
        string token = (await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida)).Token;
        using var perfil = AutenticacionTests.Solicitud("/api/v1/estudiante/perfil", token, metodo: HttpMethod.Get);
        using HttpResponseMessage respuesta = await cliente.SendAsync(perfil);
        Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
    }

    internal sealed record Bici(Guid IdBicicleta, string CodigoQr, string Estado);

    internal sealed record Perfil(string Nombres, bool Enrolado, List<Bici> Bicicletas);
}
