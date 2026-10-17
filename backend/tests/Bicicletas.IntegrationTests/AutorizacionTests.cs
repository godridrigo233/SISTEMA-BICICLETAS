using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Bicicletas.Api.Controllers;
using Bicicletas.Api.Seguridad;
using Bicicletas.Domain.Usuarios;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>Matriz RBAC del mapa de navegación (P07, Figura 1) y casos de acceso denegado.</summary>
public sealed class AutorizacionTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    public static TheoryData<string, short, bool> Matriz => new()
    {
        { Politicas.Estudiante, RolSistema.Estudiante, true },
        { Politicas.Estudiante, RolSistema.Garitero, false },
        { Politicas.OperacionGarita, RolSistema.Garitero, true },
        { Politicas.OperacionGarita, RolSistema.Supervisor, true },
        { Politicas.OperacionGarita, RolSistema.Administrador, true },
        { Politicas.OperacionGarita, RolSistema.Estudiante, false },
        { Politicas.Regularizacion, RolSistema.Supervisor, true },
        { Politicas.Regularizacion, RolSistema.Administrador, true },
        { Politicas.Regularizacion, RolSistema.Garitero, false },
        { Politicas.Monitoreo, RolSistema.Garitero, false },
        { Politicas.Administracion, RolSistema.Administrador, true },
        { Politicas.Administracion, RolSistema.Supervisor, false },
    };

    [Theory]
    [MemberData(nameof(Matriz))]
    public async Task Politica_SegunRol_PermiteODeniega(string politica, short idRol, bool permitido)
    {
        IAuthorizationService autorizacion = fabrica.Services.GetRequiredService<IAuthorizationService>();

        AuthorizationResult resultado = await autorizacion.AuthorizeAsync(Usuario(idRol, debeCambiar: false), politica);

        Assert.Equal(permitido, resultado.Succeeded);
    }

    [Fact]
    public async Task Politica_ConContrasenaTemporal_DeniegaAunConElRolCorrecto()
    {
        IAuthorizationService autorizacion = fabrica.Services.GetRequiredService<IAuthorizationService>();

        AuthorizationResult resultado = await autorizacion.AuthorizeAsync(
            Usuario(RolSistema.Administrador, debeCambiar: true), Politicas.Administracion);

        Assert.False(resultado.Succeeded);
    }

    [FactConBaseDatos]
    public async Task Sesion_SinToken401_ConTemporal403_ConDefinitiva200()
    {
        using HttpClient cliente = fabrica.CreateClient();
        using HttpResponseMessage sinToken = await cliente.GetAsync(new Uri("/api/v1/auth/sesion", UriKind.Relative));
        Assert.Equal(HttpStatusCode.Unauthorized, sinToken.StatusCode);

        string temporal = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Supervisor, debeCambiarPassword: true);
        var tokenTemporal = await AutenticacionTests.IniciarSesion(cliente, temporal, UsuariosPrueba.PasswordValida);
        using var conTemporal = AutenticacionTests.Solicitud("/api/v1/auth/sesion", tokenTemporal.Token, metodo: HttpMethod.Get);
        using HttpResponseMessage prohibido = await cliente.SendAsync(conTemporal);
        Assert.Equal(HttpStatusCode.Forbidden, prohibido.StatusCode);

        string definitiva = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Supervisor);
        var tokenDefinitivo = await AutenticacionTests.IniciarSesion(cliente, definitiva, UsuariosPrueba.PasswordValida);
        using var conDefinitiva = AutenticacionTests.Solicitud("/api/v1/auth/sesion", tokenDefinitivo.Token, metodo: HttpMethod.Get);
        using HttpResponseMessage permitido = await cliente.SendAsync(conDefinitiva);
        Assert.Equal(HttpStatusCode.OK, permitido.StatusCode);
        SesionResponse? sesion = await permitido.Content.ReadFromJsonAsync<SesionResponse>();
        Assert.Equal(RolSistema.Supervisor, sesion?.IdRol);
    }

    [FactConBaseDatos]
    public async Task Login_CuentaInactivaConClaveCorrecta_Devuelve403()
    {
        string correo = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Estudiante, activo: false);
        using HttpClient cliente = fabrica.CreateClient();

        using HttpResponseMessage respuesta = await cliente.PostAsJsonAsync(
            new Uri("/api/v1/auth/login", UriKind.Relative), new { correo, password = UsuariosPrueba.PasswordValida });

        Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
    }

    private static ClaimsPrincipal Usuario(short idRol, bool debeCambiar) =>
        new(new ClaimsIdentity(
        [
            new Claim(ClaimsSistema.IdUsuario, Guid.NewGuid().ToString()),
            new Claim(ClaimsSistema.IdRol, idRol.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new Claim(ClaimsSistema.DebeCambiarPassword, debeCambiar ? "true" : "false"),
        ], authenticationType: "Pruebas"));
}
