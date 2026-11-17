using System.Net;
using System.Net.Http.Json;
using Bicicletas.Domain.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>D-25: «Últimos movimientos» de W2 se reconstruye desde la auditoría al volver a iniciar sesión.</summary>
public sealed class MovimientosGaritaTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    private const string Ruta = "/api/v1/garita/movimientos-recientes";

    private async Task<(HttpClient Cliente, string Token, string Correo)> SesionAsync(short rol)
    {
        HttpClient cliente = fabrica.CreateClient();
        string correo = await UsuariosPrueba.CrearAsync(fabrica, rol);
        var sesion = await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida);
        return (cliente, sesion.Token, correo);
    }

    private static async Task RegistrarIngresoAsync(HttpClient cliente, string token, Guid idBicicleta)
    {
        using var solicitud = AutenticacionTests.Solicitud("/api/v1/ingresos/registrar", token, new { idBicicleta, latenciaMs = 300 });
        using HttpResponseMessage respuesta = await cliente.SendAsync(solicitud);
        Assert.True(respuesta.StatusCode == HttpStatusCode.OK, await respuesta.Content.ReadAsStringAsync());
    }

    private static async Task<List<Movimiento>> ConsultarAsync(HttpClient cliente, string token)
    {
        using var solicitud = AutenticacionTests.Solicitud(Ruta, token, metodo: HttpMethod.Get);
        using HttpResponseMessage respuesta = await cliente.SendAsync(solicitud);
        Assert.True(respuesta.StatusCode == HttpStatusCode.OK, await respuesta.Content.ReadAsStringAsync());
        return (await respuesta.Content.ReadFromJsonAsync<List<Movimiento>>())!;
    }

    [FactConBaseDatos]
    public async Task MovimientosRecientes_TrasUnNuevoInicioDeSesion_DevuelveSoloLosDelOperadorEnElDia()
    {
        var propia = await DatosGarita.CrearBicicletaAsync(fabrica);
        var ajena = await DatosGarita.CrearBicicletaAsync(fabrica);
        var (clienteA, tokenA, correoA) = await SesionAsync(RolSistema.Garitero);
        var (clienteB, tokenB, _) = await SesionAsync(RolSistema.Garitero);
        using (clienteB)
            await RegistrarIngresoAsync(clienteB, tokenB, ajena.IdBicicleta);

        using (clienteA)
        {
            await RegistrarIngresoAsync(clienteA, tokenA, propia.IdBicicleta);

            // Un movimiento del mismo operador de hace dos días no corresponde al turno actual.
            using (IServiceScope ambito = fabrica.Services.CreateScope())
            {
                AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();
                Guid idA = await db.Usuarios.Where(u => u.CorreoInstitucional == correoA).Select(u => u.IdUsuario).SingleAsync();
                DateTime anteayer = DateTime.UtcNow.AddDays(-2);
                await db.Database.ExecuteSqlInterpolatedAsync($"""
                    INSERT INTO auditoria_accesos (id_bicicleta, tipo_evento, id_vigilante, resultado, latencia_ms, timestamp_evento)
                    VALUES ({propia.IdBicicleta}, 'RETIRO', {idA}, 'EXITOSO', 500, {anteayer})
                    """);
            }
        }

        // Nueva sesión del mismo operador: la tabla no depende del estado de la página anterior.
        using HttpClient nuevo = fabrica.CreateClient();
        var sesion = await AutenticacionTests.IniciarSesion(nuevo, correoA, UsuariosPrueba.PasswordValida);
        List<Movimiento> lista = await ConsultarAsync(nuevo, sesion.Token);

        Movimiento unico = Assert.Single(lista);
        Assert.Equal("INGRESO", unico.TipoEvento);
        Assert.Equal("EXITOSO", unico.Resultado);
        Assert.Equal("ALUMNO DE PRUEBA", unico.Titular);
        Assert.Equal("Marca Prueba / Rojo", unico.Bicicleta);
    }

    [FactConBaseDatos]
    public async Task MovimientosRecientes_ConRolEstudiante_Devuelve403()
    {
        var (cliente, token, _) = await SesionAsync(RolSistema.Estudiante);
        using (cliente)
        {
            using var solicitud = AutenticacionTests.Solicitud(Ruta, token, metodo: HttpMethod.Get);
            using HttpResponseMessage respuesta = await cliente.SendAsync(solicitud);
            Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
        }
    }

    internal sealed record Movimiento(long IdAuditoria, DateTime FechaUtc, string TipoEvento, string Resultado, string Titular, string Bicicleta);
}
