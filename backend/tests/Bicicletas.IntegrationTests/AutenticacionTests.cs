using System.Net;
using System.Net.Http.Json;
using Bicicletas.Domain.Usuarios;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Bicicletas.IntegrationTests;

public sealed class AutenticacionTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    private static readonly Uri RutaLogin = new("/api/v1/auth/login", UriKind.Relative);

    [FactConBaseDatos]
    public async Task Login_CredencialesValidas_DevuelveJwtConClaimIdRol()
    {
        string correo = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Garitero);
        using HttpClient cliente = fabrica.CreateClient();

        using HttpResponseMessage respuesta = await cliente.PostAsJsonAsync(RutaLogin,
            new { correo = correo.ToUpperInvariant(), password = UsuariosPrueba.PasswordValida });

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        RespuestaLogin? cuerpo = await respuesta.Content.ReadFromJsonAsync<RespuestaLogin>();
        Assert.NotNull(cuerpo);
        Assert.Equal(RolSistema.Garitero, cuerpo.IdRol);
        Assert.False(cuerpo.DebeCambiarPassword);

        var token = new JsonWebToken(cuerpo.Token);
        Assert.Equal("2", token.GetClaim("id_rol").Value);
        Assert.InRange(token.ValidTo - token.ValidFrom, TimeSpan.FromMinutes(29), TimeSpan.FromMinutes(31));
    }

    internal sealed record RespuestaLogin(string Token, DateTime ExpiraEnUtc, short IdRol, bool DebeCambiarPassword);
}
