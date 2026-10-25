using System.Net;
using Bicicletas.IntegrationTests.Infraestructura;

namespace Bicicletas.IntegrationTests;

/// <summary>Verifica la presencia de cabeceras de seguridad HTTP globales (OWASP ZAP / OWASP A05).</summary>
public sealed class CabecerasSeguridadTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    [Fact]
    public async Task GetHealth_RespondeConCabecerasDeSeguridad()
    {
        using HttpClient cliente = fabrica.CreateClient();

        using HttpResponseMessage respuesta = await cliente.GetAsync(new Uri("/health", UriKind.Relative));

        VerificarCabecerasSeguridad(respuesta);
    }

    [Fact]
    public async Task EndpointProtegido_SinToken_Responde401ConCabecerasDeSeguridad()
    {
        using HttpClient cliente = fabrica.CreateClient();

        using HttpResponseMessage respuesta = await cliente.GetAsync(new Uri("/api/v1/auth/sesion", UriKind.Relative));

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
        VerificarCabecerasSeguridad(respuesta);
    }

    private static void VerificarCabecerasSeguridad(HttpResponseMessage respuesta)
    {
        Assert.True(respuesta.Headers.TryGetValues("Strict-Transport-Security", out var hsts));
        Assert.Equal("max-age=31536000; includeSubDomains", Assert.Single(hsts));

        Assert.True(respuesta.Headers.TryGetValues("X-Content-Type-Options", out var xContentType));
        Assert.Equal("nosniff", Assert.Single(xContentType));

        Assert.True(respuesta.Headers.TryGetValues("X-Frame-Options", out var xFrame));
        Assert.Equal("DENY", Assert.Single(xFrame));

        Assert.True(respuesta.Headers.TryGetValues("Referrer-Policy", out var referrerPolicy));
        Assert.Equal("no-referrer", Assert.Single(referrerPolicy));

        Assert.True(respuesta.Headers.TryGetValues("Cache-Control", out var cacheControl));
        Assert.Equal("no-store", Assert.Single(cacheControl));
    }
}
