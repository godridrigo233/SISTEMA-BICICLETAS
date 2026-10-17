using System.Net;
using System.Net.Http.Json;
using Bicicletas.Domain.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>W5 · Historial personal y W6 · Monitoreo: filtros, paginación, RBAC y exportación CSV.</summary>
public sealed class HistorialMonitoreoTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    private async Task<(HttpClient Cliente, string Token)> SesionAsync(string correo)
    {
        HttpClient cliente = fabrica.CreateClient();
        var sesion = await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida);
        return (cliente, sesion.Token);
    }

    private static async Task<HttpResponseMessage> GetAsync(HttpClient cliente, string token, string ruta)
    {
        using var solicitud = AutenticacionTests.Solicitud(ruta, token, metodo: HttpMethod.Get);
        return await cliente.SendAsync(solicitud);
    }

    /// <summary>Inserta movimientos de auditoría para una bicicleta (operador = el propio dueño, basta para la FK).</summary>
    private async Task AuditarAsync(Guid idBicicleta, Guid idOperador, params (string Tipo, string Resultado)[] eventos)
    {
        using IServiceScope ambito = fabrica.Services.CreateScope();
        AppDbContext db = ambito.ServiceProvider.GetRequiredService<AppDbContext>();
        foreach (var (tipo, resultado) in eventos)
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO auditoria_accesos (id_bicicleta, tipo_evento, id_vigilante, resultado, latencia_ms)
                VALUES ({idBicicleta}, {tipo}, {idOperador}, {resultado}, 800)
                """);
        }
    }

    private async Task<Guid> RegistrarBicicletaPropiaAsync(Guid idEstudiante)
    {
        Guid id = Guid.NewGuid();
        using IServiceScope ambito = fabrica.Services.CreateScope();
        await ambito.ServiceProvider.GetRequiredService<AppDbContext>().Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO bicicletas (id_bicicleta, id_estudiante, codigo_qr, numero_marco, marca_modelo, color, estado)
            VALUES ({id}, {idEstudiante}, {Guid.NewGuid().ToString()}, {"IT-H-" + id.ToString("N")[..8]}, 'Trek', 'Azul', 'FUERA')
            """);
        return id;
    }

    [FactConBaseDatos]
    public async Task Historial_SoloMovimientosPropios_ConFiltroYPaginacion()
    {
        var (correo, idEstudiante) = await DatosGarita.CrearEstudianteConCuentaAsync(fabrica);
        Guid propia = await RegistrarBicicletaPropiaAsync(idEstudiante);
        await AuditarAsync(propia, idEstudiante, ("INGRESO", "EXITOSO"), ("RETIRO", "DENEGADO"), ("RETIRO", "EXITOSO"));
        var ajena = await DatosGarita.CrearBicicletaAsync(fabrica);
        await AuditarAsync(ajena.IdBicicleta, ajena.IdEstudiante, ("INGRESO", "EXITOSO"));

        var (cliente, token) = await SesionAsync(correo);
        using (cliente)
        {
            using HttpResponseMessage todo = await GetAsync(cliente, token, "/api/v1/estudiante/historial?tamano=2");
            Assert.True(todo.StatusCode == HttpStatusCode.OK, await todo.Content.ReadAsStringAsync());
            var pagina = (await todo.Content.ReadFromJsonAsync<Pagina<Movimiento>>())!;
            Assert.Equal(3, pagina.Total);
            Assert.Equal(2, pagina.Elementos.Count);
            Assert.All(pagina.Elementos, m => Assert.Equal("Trek (Azul)", m.Bicicleta));

            using HttpResponseMessage retiros = await GetAsync(cliente, token, "/api/v1/estudiante/historial?tipo=RETIRO");
            Assert.Equal(2, (await retiros.Content.ReadFromJsonAsync<Pagina<Movimiento>>())!.Total);

            using HttpResponseMessage invalido = await GetAsync(cliente, token, "/api/v1/estudiante/historial?tipo=OTRO");
            Assert.Equal(HttpStatusCode.UnprocessableEntity, invalido.StatusCode);
            using HttpResponseMessage rango = await GetAsync(cliente, token, "/api/v1/estudiante/historial?desde=2026-10-10&hasta=2026-10-01");
            Assert.Equal(HttpStatusCode.UnprocessableEntity, rango.StatusCode);

            using HttpResponseMessage monitoreo = await GetAsync(cliente, token, "/api/v1/monitoreo/resumen");
            Assert.Equal(HttpStatusCode.Forbidden, monitoreo.StatusCode);
        }
    }

    [FactConBaseDatos]
    public async Task Monitoreo_ResumenEventosYCsv_ParaSupervisor()
    {
        var bici = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        await AuditarAsync(bici.IdBicicleta, bici.IdEstudiante, ("INGRESO", "EXITOSO"), ("RETIRO", "MANUAL"));

        var (cliente, token) = await SesionAsync(await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Supervisor));
        using (cliente)
        {
            using HttpResponseMessage resumen = await GetAsync(cliente, token, "/api/v1/monitoreo/resumen");
            Assert.True(resumen.StatusCode == HttpStatusCode.OK, await resumen.Content.ReadAsStringAsync());
            var kpi = (await resumen.Content.ReadFromJsonAsync<Resumen>())!;
            Assert.True(kpi.BicicletasDentro >= 1);
            Assert.True(kpi.IngresosHoy >= 1);
            Assert.True(kpi.MovimientosManualesHoy >= 1);

            using HttpResponseMessage manuales = await GetAsync(cliente, token, "/api/v1/monitoreo/eventos?registro=DERIVACION&tamano=100");
            Assert.True(manuales.StatusCode == HttpStatusCode.OK, await manuales.Content.ReadAsStringAsync());
            var pagina = (await manuales.Content.ReadFromJsonAsync<Pagina<Evento>>())!;
            Assert.All(pagina.Elementos, e => Assert.Equal("DERIVACION", e.Registro));
            Assert.Contains(pagina.Elementos, e => e.Resultado == "MANUAL" && e.Bicicleta == "Marca Prueba (Rojo)");

            using HttpResponseMessage csv = await GetAsync(cliente, token, "/api/v1/monitoreo/eventos/exportar?tipo=INGRESO");
            Assert.Equal(HttpStatusCode.OK, csv.StatusCode);
            Assert.Equal("text/csv", csv.Content.Headers.ContentType?.MediaType);
            string contenido = await csv.Content.ReadAsStringAsync();
            Assert.StartsWith("Fecha y hora (Perú);Tipo;Resultado;Registro", contenido.TrimStart('﻿'), StringComparison.Ordinal);
            Assert.DoesNotContain(";RETIRO;", contenido, StringComparison.Ordinal);

            using HttpResponseMessage invalido = await GetAsync(cliente, token, "/api/v1/monitoreo/eventos?registro=X");
            Assert.Equal(HttpStatusCode.UnprocessableEntity, invalido.StatusCode);
        }

        var (garita, tokenGarita) = await SesionAsync(await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Garitero));
        using (garita)
        {
            using HttpResponseMessage prohibido = await GetAsync(garita, tokenGarita, "/api/v1/monitoreo/eventos");
            Assert.Equal(HttpStatusCode.Forbidden, prohibido.StatusCode);
        }
    }

    internal sealed record Pagina<T>(int Total, int NumeroPagina, int TamanoPagina, List<T> Elementos);

    internal sealed record Movimiento(DateTime FechaUtc, string TipoEvento, string Resultado, string Registro, string Bicicleta);

    internal sealed record Evento(long IdAuditoria, string TipoEvento, string Resultado, string Registro, string? Folio, string Bicicleta);

    internal sealed record Resumen(int BicicletasDentro, int IngresosHoy, int RetirosHoy, int RechazosHoy, int MovimientosManualesHoy);
}
