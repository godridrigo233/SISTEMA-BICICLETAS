using Bicicletas.IntegrationTests.Infraestructura;

namespace Bicicletas.IntegrationTests;

/// <summary>Solo el dominio del frontend puede llamar a la API desde el navegador (OWASP A05).</summary>
public sealed class CorsTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    [Theory]
    [InlineData(FabricaApi.OrigenPermitidoPruebas, true)]
    [InlineData("https://sitio-malicioso.example", false)]
    public async Task Preflight_SoloElOrigenConfigurado_RecibeAutorizacion(string origen, bool permitido)
    {
        using HttpClient cliente = fabrica.CreateClient();
        using var solicitud = new HttpRequestMessage(HttpMethod.Options, new Uri("/api/v1/auth/login", UriKind.Relative));
        solicitud.Headers.Add("Origin", origen);
        solicitud.Headers.Add("Access-Control-Request-Method", "POST");
        solicitud.Headers.Add("Access-Control-Request-Headers", "content-type");

        using HttpResponseMessage respuesta = await cliente.SendAsync(solicitud);

        Assert.Equal(permitido, respuesta.Headers.Contains("Access-Control-Allow-Origin"));
    }
}
