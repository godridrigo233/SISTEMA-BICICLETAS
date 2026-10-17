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

        Assert.True(respuesta.StatusCode == HttpStatusCode.OK, await respuesta.Content.ReadAsStringAsync());
        RespuestaLogin? cuerpo = await respuesta.Content.ReadFromJsonAsync<RespuestaLogin>();
        Assert.NotNull(cuerpo);
        Assert.Equal(RolSistema.Garitero, cuerpo.IdRol);
        Assert.False(cuerpo.DebeCambiarPassword);

        var token = new JsonWebToken(cuerpo.Token);
        Assert.Equal("2", token.GetClaim("id_rol").Value);
        Assert.InRange(token.ValidTo - token.ValidFrom, TimeSpan.FromMinutes(29), TimeSpan.FromMinutes(31));
    }

    [FactConBaseDatos]
    public async Task Login_ClaveIncorrectaOCorreoInexistente_MismoMensajeGenerico401()
    {
        string correo = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Estudiante);
        using HttpClient cliente = fabrica.CreateClient();

        using HttpResponseMessage claveMala = await cliente.PostAsJsonAsync(RutaLogin,
            new { correo, password = "ClaveIncorrecta1" });
        using HttpResponseMessage correoMalo = await cliente.PostAsJsonAsync(RutaLogin,
            new { correo = $"no.existe.{Guid.NewGuid():N}@ucsm.edu.pe", password = "ClaveIncorrecta1" });

        Assert.Equal(HttpStatusCode.Unauthorized, claveMala.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, correoMalo.StatusCode);
        string? detalleClave = await Detalle(claveMala);
        Assert.Equal(detalleClave, await Detalle(correoMalo));
        Assert.Equal("Credenciales inválidas.", detalleClave);
    }

    [FactConBaseDatos]
    public async Task Login_CincoIntentosFallidos_BloqueaAunqueLuegoLaClaveSeaCorrecta()
    {
        string correo = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Supervisor);
        using HttpClient cliente = fabrica.CreateClient();

        for (int i = 0; i < 5; i++)
        {
            using HttpResponseMessage fallo = await cliente.PostAsJsonAsync(RutaLogin,
                new { correo, password = "ClaveIncorrecta1" });
            Assert.Equal(HttpStatusCode.Unauthorized, fallo.StatusCode);
        }

        using HttpResponseMessage bloqueado = await cliente.PostAsJsonAsync(RutaLogin,
            new { correo, password = UsuariosPrueba.PasswordValida });

        Assert.Equal((HttpStatusCode)423, bloqueado.StatusCode);
    }

    [FactConBaseDatos]
    public async Task CambiarPassword_PrimerIngreso_EmiteTokenSinMarcaYAnulaLaTemporal()
    {
        string correo = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Garitero, debeCambiarPassword: true);
        using HttpClient cliente = fabrica.CreateClient();
        RespuestaLogin temporal = await IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida);
        Assert.True(temporal.DebeCambiarPassword);

        using var debil = Solicitud("/api/v1/auth/cambiar-password", temporal.Token,
            new { passwordActual = UsuariosPrueba.PasswordValida, passwordNueva = "corta1" });
        using HttpResponseMessage rechazo = await cliente.SendAsync(debil);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, rechazo.StatusCode);

        using var valida = Solicitud("/api/v1/auth/cambiar-password", temporal.Token,
            new { passwordActual = UsuariosPrueba.PasswordValida, passwordNueva = "MiBicicleta2026" });
        using HttpResponseMessage cambio = await cliente.SendAsync(valida);
        Assert.True(cambio.StatusCode == HttpStatusCode.OK, await cambio.Content.ReadAsStringAsync());
        RespuestaLogin? nuevo = await cambio.Content.ReadFromJsonAsync<RespuestaLogin>();
        Assert.False(nuevo!.DebeCambiarPassword);

        using HttpResponseMessage conTemporal = await cliente.PostAsJsonAsync(RutaLogin,
            new { correo, password = UsuariosPrueba.PasswordValida });
        Assert.Equal(HttpStatusCode.Unauthorized, conTemporal.StatusCode);
        RespuestaLogin conPropia = await IniciarSesion(cliente, correo, "MiBicicleta2026");
        Assert.False(conPropia.DebeCambiarPassword);
    }

    internal static async Task<RespuestaLogin> IniciarSesion(HttpClient cliente, string correo, string password)
    {
        using HttpResponseMessage respuesta = await cliente.PostAsJsonAsync(RutaLogin, new { correo, password });
        Assert.True(respuesta.StatusCode == HttpStatusCode.OK, await respuesta.Content.ReadAsStringAsync());
        return (await respuesta.Content.ReadFromJsonAsync<RespuestaLogin>())!;
    }

    internal static HttpRequestMessage Solicitud(string ruta, string token, object? cuerpo = null, HttpMethod? metodo = null)
    {
        var mensaje = new HttpRequestMessage(metodo ?? HttpMethod.Post, new Uri(ruta, UriKind.Relative));
        mensaje.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        if (cuerpo is not null)
            mensaje.Content = JsonContent.Create(cuerpo);
        return mensaje;
    }

    private static async Task<string?> Detalle(HttpResponseMessage respuesta) =>
        (await respuesta.Content.ReadFromJsonAsync<Problema>())?.Detail;

    internal sealed record Problema(string? Title, string? Detail);

    internal sealed record RespuestaLogin(string Token, DateTime ExpiraEnUtc, short IdRol, bool DebeCambiarPassword);
}
