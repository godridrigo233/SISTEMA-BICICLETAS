using System.Net;
using System.Net.Http.Json;
using Bicicletas.Api.Seguridad;
using Bicicletas.Domain.Usuarios;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Bicicletas.IntegrationTests;

/// <summary>CC-13: el inicio de sesión admite pocas verificaciones BCrypt simultáneas y rechaza el exceso con 429.</summary>
public sealed class LimiteInicioSesionTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    private static readonly Uri RutaLogin = new("/api/v1/auth/login", UriKind.Relative);
    private static readonly HttpStatusCode[] EstadosEsperados = [HttpStatusCode.OK, HttpStatusCode.TooManyRequests];

    [FactConBaseDatos]
    public async Task Login_ExcesoDeSolicitudesSimultaneas_RechazaConMensajeYReintento()
    {
        string correo = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Estudiante);
        // Una verificación a la vez y sin fila: con diez solicitudes simultáneas, varias deben rechazarse.
        using WebApplicationFactory<Program> limitada = fabrica.WithWebHostBuilder(b => b.ConfigureAppConfiguration(
            (_, c) => c.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Seguridad:InicioSesion:Concurrencia"] = "1",
                ["Seguridad:InicioSesion:Cola"] = "0",
            })));
        using HttpClient cliente = limitada.CreateClient();

        HttpResponseMessage[] respuestas = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ =>
            cliente.PostAsJsonAsync(RutaLogin, new { correo, password = UsuariosPrueba.PasswordValida })));
        try
        {
            Assert.All(respuestas, r => Assert.Contains(r.StatusCode, EstadosEsperados));
            Assert.Contains(respuestas, r => r.StatusCode == HttpStatusCode.OK);
            HttpResponseMessage rechazo = respuestas.First(r => r.StatusCode == HttpStatusCode.TooManyRequests);
            Assert.Equal(LimiteInicioSesion.SegundosReintento.ToString(System.Globalization.CultureInfo.InvariantCulture),
                rechazo.Headers.RetryAfter?.Delta?.TotalSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture));
            AutenticacionTests.Problema? problema = await rechazo.Content.ReadFromJsonAsync<AutenticacionTests.Problema>();
            Assert.Equal(LimiteInicioSesion.Mensaje, problema?.Detail);
        }
        finally
        {
            foreach (HttpResponseMessage r in respuestas) r.Dispose();
        }

        // Pasada la ráfaga, la cuenta sigue operativa: el rechazo por límite no cuenta como intento fallido.
        AutenticacionTests.RespuestaLogin sesion = await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida);
        Assert.Equal(RolSistema.Estudiante, sesion.IdRol);
    }

    [FactConBaseDatos]
    public async Task ConsultasDeLaGarita_NoEstanSujetasAlLimiteDelInicioDeSesion()
    {
        using WebApplicationFactory<Program> limitada = fabrica.WithWebHostBuilder(b => b.ConfigureAppConfiguration(
            (_, c) => c.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Seguridad:InicioSesion:Concurrencia"] = "1",
                ["Seguridad:InicioSesion:Cola"] = "0",
            })));
        using HttpClient cliente = limitada.CreateClient();

        HttpResponseMessage[] respuestas = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ =>
            cliente.GetAsync(new Uri("/health", UriKind.Relative))));
        try
        {
            Assert.DoesNotContain(respuestas, r => r.StatusCode == HttpStatusCode.TooManyRequests);
        }
        finally
        {
            foreach (HttpResponseMessage r in respuestas) r.Dispose();
        }
    }
}
