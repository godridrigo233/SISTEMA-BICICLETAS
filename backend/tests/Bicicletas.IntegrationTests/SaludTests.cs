using System.Net;
using System.Net.Http.Json;
using Bicicletas.IntegrationTests.Infraestructura;

namespace Bicicletas.IntegrationTests;

public sealed class SaludTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    [FactConBaseDatos]
    public async Task Health_ConBaseDeDatosDisponible_Responde200()
    {
        using HttpClient cliente = fabrica.CreateClient();

        using HttpResponseMessage respuesta = await cliente.GetAsync(new Uri("/health", UriKind.Relative));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        EstadoSalud? cuerpo = await respuesta.Content.ReadFromJsonAsync<EstadoSalud>();
        Assert.Equal("OK", cuerpo?.BaseDatos);
    }

    [FactConBaseDatos]
    public async Task Health_ConMetodoHead_Responde200SinCuerpo()
    {
        using HttpClient cliente = fabrica.CreateClient();
        using HttpRequestMessage solicitud = new(HttpMethod.Head, new Uri("/health", UriKind.Relative));

        using HttpResponseMessage respuesta = await cliente.SendAsync(solicitud);

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
    }

    private sealed record EstadoSalud(string Estado, string BaseDatos);
}
