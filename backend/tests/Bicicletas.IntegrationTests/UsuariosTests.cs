using System.Net;
using System.Net.Http.Json;
using Bicicletas.Domain.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>W7 · Gestión de Usuarios: contraseña temporal, restablecimiento e inactivación lógica.</summary>
public sealed class UsuariosTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    private async Task<(HttpClient Cliente, string Token, Guid IdAdmin)> SesionAdminAsync()
    {
        HttpClient cliente = fabrica.CreateClient();
        string correo = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Administrador);
        string token = (await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida)).Token;
        using IServiceScope ambito = fabrica.Services.CreateScope();
        Guid id = await ambito.ServiceProvider.GetRequiredService<AppDbContext>().Usuarios
            .Where(u => u.CorreoInstitucional == correo).Select(u => u.IdUsuario).SingleAsync();
        return (cliente, token, id);
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, string token, string ruta, object? cuerpo = null, HttpMethod? metodo = null)
    {
        using var solicitud = AutenticacionTests.Solicitud(ruta, token, cuerpo, metodo);
        return await cliente.SendAsync(solicitud);
    }

    private async Task<HttpStatusCode> LoginAsync(string correo, string password)
    {
        using HttpClient cliente = fabrica.CreateClient();
        using HttpResponseMessage r = await cliente.PostAsJsonAsync("/api/v1/auth/login", new { correo, password });
        return r.StatusCode;
    }

    [FactConBaseDatos]
    public async Task Crear_DevuelveTemporalUnaVez_YRestablecerInvalidaLaAnterior()
    {
        var (cliente, token, _) = await SesionAdminAsync();
        using (cliente)
        {
            string correo = $"it.vig.{Guid.NewGuid():N}"[..20] + "@UCSM.edu.pe";
            using HttpResponseMessage creada = await EnviarAsync(cliente, token, "/api/v1/usuarios", new { correo, idRol = RolSistema.Garitero });
            Assert.True(creada.StatusCode == HttpStatusCode.Created, await creada.Content.ReadAsStringAsync());
            var cuenta = (await creada.Content.ReadFromJsonAsync<Temporal>())!;
            Assert.Equal(correo.ToLowerInvariant(), cuenta.Correo);
            Assert.Equal(12, cuenta.PasswordTemporal.Length);
            Assert.Equal(HttpStatusCode.OK, await LoginAsync(cuenta.Correo, cuenta.PasswordTemporal));

            using HttpResponseMessage duplicada = await EnviarAsync(cliente, token, "/api/v1/usuarios", new { correo, idRol = RolSistema.Supervisor });
            Assert.Equal(HttpStatusCode.Conflict, duplicada.StatusCode);
            using HttpResponseMessage alumno = await EnviarAsync(cliente, token, "/api/v1/usuarios",
                new { correo = "x.prueba@estudiante.ucsm.edu.pe", idRol = RolSistema.Garitero });
            Assert.Equal(HttpStatusCode.UnprocessableEntity, alumno.StatusCode);

            using HttpResponseMessage nueva = await EnviarAsync(cliente, token, $"/api/v1/usuarios/{cuenta.IdUsuario}/restablecer-password");
            var restablecida = (await nueva.Content.ReadFromJsonAsync<Temporal>())!;
            Assert.Equal(HttpStatusCode.Unauthorized, await LoginAsync(cuenta.Correo, cuenta.PasswordTemporal));
            Assert.Equal(HttpStatusCode.OK, await LoginAsync(cuenta.Correo, restablecida.PasswordTemporal));

            using HttpResponseMessage lista = await EnviarAsync(cliente, token, $"/api/v1/usuarios?rol=2&correo={Uri.EscapeDataString(cuenta.Correo)}", metodo: HttpMethod.Get);
            var pagina = (await lista.Content.ReadFromJsonAsync<Pagina>())!;
            Assert.Equal(1, pagina.Total);
            Assert.True(pagina.Elementos[0].DebeCambiarPassword);
        }
    }

    [FactConBaseDatos]
    public async Task Inactivar_EstudianteBorraSuDescriptor_YNoPuedeIngresar_ElAdminNoSeInactivaASiMismo()
    {
        var (correo, idEstudiante) = await DatosGarita.CrearEstudianteConCuentaAsync(fabrica);
        await DatosGarita.EnrolarAsync(fabrica, idEstudiante, Enumerable.Repeat(0.1, 128).ToArray());
        var (cliente, token, idAdmin) = await SesionAdminAsync();
        using (cliente)
        {
            using HttpResponseMessage r = await EnviarAsync(cliente, token, $"/api/v1/usuarios/{idEstudiante}/estado", new { activo = false }, HttpMethod.Patch);
            Assert.True(r.StatusCode == HttpStatusCode.OK, await r.Content.ReadAsStringAsync());
            using (IServiceScope ambito = fabrica.Services.CreateScope())
                Assert.False(await ambito.ServiceProvider.GetRequiredService<AppDbContext>().Descriptores.AnyAsync(d => d.IdEstudiante == idEstudiante));
            Assert.Equal(HttpStatusCode.Forbidden, await LoginAsync(correo, UsuariosPrueba.PasswordValida));

            using HttpResponseMessage restablecer = await EnviarAsync(cliente, token, $"/api/v1/usuarios/{idEstudiante}/restablecer-password");
            Assert.Equal(HttpStatusCode.Conflict, restablecer.StatusCode);
            using HttpResponseMessage yo = await EnviarAsync(cliente, token, $"/api/v1/usuarios/{idAdmin}/estado", new { activo = false }, HttpMethod.Patch);
            Assert.Equal(HttpStatusCode.Conflict, yo.StatusCode);
        }

        using HttpClient sup = fabrica.CreateClient();
        string tokenSup = (await AutenticacionTests.IniciarSesion(sup, await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Supervisor), UsuariosPrueba.PasswordValida)).Token;
        using HttpResponseMessage prohibido = await EnviarAsync(sup, tokenSup, "/api/v1/usuarios", metodo: HttpMethod.Get);
        Assert.Equal(HttpStatusCode.Forbidden, prohibido.StatusCode);
    }

    internal sealed record Temporal(Guid IdUsuario, string Correo, string Rol, string PasswordTemporal);
    internal sealed record Fila(Guid IdUsuario, string Correo, bool Activo, bool DebeCambiarPassword);
    internal sealed record Pagina(int Total, List<Fila> Elementos);
}
