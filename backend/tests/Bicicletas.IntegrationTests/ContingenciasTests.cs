using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Bicicletas.Domain.Usuarios;
using Bicicletas.Infrastructure.Persistencia;
using Bicicletas.IntegrationTests.Infraestructura;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bicicletas.IntegrationTests;

/// <summary>W3 · CU-06 con CC-10: importación CSV con autocompletado, conciliación y revisión de observados.</summary>
public sealed class ContingenciasTests(FabricaApi fabrica) : IClassFixture<FabricaApi>
{
    private const string Encabezado = "folio;fecha_hora;tipo;codigo;dni;vigilante";

    /// <summary>Hora de Perú hace <paramref name="minutos"/> minutos, en el formato de la plantilla.</summary>
    private static string Hace(int minutos) =>
        DateTimeOffset.UtcNow.AddMinutes(-minutos).ToOffset(TimeSpan.FromHours(-5)).ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture);

    private static string Folio() => "IT-" + Guid.NewGuid().ToString("N")[..8];

    private async Task<T> ConsultarAsync<T>(FormattableString sql)
    {
        using IServiceScope ambito = fabrica.Services.CreateScope();
        return await ambito.ServiceProvider.GetRequiredService<AppDbContext>().Database.SqlQuery<T>(sql).SingleAsync();
    }

    private Task<string> DniAsync(Guid idEstudiante) =>
        ConsultarAsync<string>($"SELECT dni AS \"Value\" FROM estudiantes WHERE id_estudiante = {idEstudiante}");

    private Task<string> EstadoAsync(Guid idBicicleta) =>
        ConsultarAsync<string>($"SELECT estado AS \"Value\" FROM bicicletas WHERE id_bicicleta = {idBicicleta}");

    private async Task<(HttpClient Cliente, string Token)> SesionAsync(short rol)
    {
        HttpClient cliente = fabrica.CreateClient();
        string correo = await UsuariosPrueba.CrearAsync(fabrica, rol);
        return (cliente, (await AutenticacionTests.IniciarSesion(cliente, correo, UsuariosPrueba.PasswordValida)).Token);
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, string token, string ruta, object? cuerpo = null, HttpMethod? metodo = null)
    {
        using var solicitud = AutenticacionTests.Solicitud(ruta, token, cuerpo, metodo);
        return await cliente.SendAsync(solicitud);
    }

    private async Task<Guid> IdContingenciaAsync(string folio) =>
        await ConsultarAsync<Guid>($"SELECT id_contingencia AS \"Value\" FROM contingencias_ingreso WHERE folio_bitacora = {folio}");

    [FactConBaseDatos]
    public async Task Csv_PrevisualizaConAutocompletado_ImportaSoloValidas_YRechazaDuplicados()
    {
        var fuera = await DatosGarita.CrearBicicletaAsync(fabrica, "FUERA");
        var dentro = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        string marco = await ConsultarAsync<string>($"SELECT numero_marco AS \"Value\" FROM bicicletas WHERE id_bicicleta = {dentro.IdBicicleta}");
        string garitero = await UsuariosPrueba.CrearAsync(fabrica, RolSistema.Garitero);
        string f1 = Folio(), f2 = Folio();
        string csv = string.Join('\n',
            Encabezado,
            $"{f1};{Hace(120)};INGRESO;{fuera.CodigoQr};;{garitero}",
            $"{f2};{Hace(90)};retiro;{marco.ToLowerInvariant()};{await DniAsync(dentro.IdEstudiante)};",
            $"{Folio()};{Hace(80)};INGRESO;NO-EXISTE;;",
            $"{Folio()};{Hace(70)};RETIRO;{fuera.CodigoQr};;",
            $"{Folio()};{Hace(-60)};INGRESO;{fuera.CodigoQr};;",
            $"{Folio()};{Hace(60)};INGRESO;{fuera.CodigoQr};;nadie@ucsm.edu.pe");

        var (cliente, token) = await SesionAsync(RolSistema.Supervisor);
        using (cliente)
        {
            using HttpResponseMessage previa = await EnviarAsync(cliente, token, "/api/v1/contingencias/csv/previsualizar", new { contenido = csv });
            Assert.True(previa.StatusCode == HttpStatusCode.OK, await previa.Content.ReadAsStringAsync());
            var filas = (await previa.Content.ReadFromJsonAsync<List<FilaPrevia>>())!;
            Assert.Equal([true, true, false, false, false, false], filas.Select(f => f.Valida));
            Assert.Equal("ALUMNO DE PRUEBA — Marca Prueba / Rojo", filas[0].Bicicleta);
            Assert.Equal("Código no registrado.", filas[2].Error);
            Assert.Equal("Un retiro requiere el DNI presentado.", filas[3].Error);
            Assert.Equal("La fecha y hora no puede ser futura.", filas[4].Error);
            Assert.Equal("Vigilante no registrado o inactivo.", filas[5].Error);
            Assert.Equal(0, await ConsultarAsync<int>($"SELECT count(*)::int AS \"Value\" FROM contingencias_ingreso WHERE folio_bitacora = {f1}"));

            using HttpResponseMessage importar = await EnviarAsync(cliente, token, "/api/v1/contingencias/csv/importar", new { contenido = csv });
            Assert.True(importar.StatusCode == HttpStatusCode.OK, await importar.Content.ReadAsStringAsync());
            var resultado = (await importar.Content.ReadFromJsonAsync<Importacion>())!;
            Assert.Equal(2, resultado.Insertadas);
            Assert.Equal("CSV", await ConsultarAsync<string>($"SELECT origen_carga AS \"Value\" FROM contingencias_ingreso WHERE folio_bitacora = {f2}"));

            // Subir el mismo archivo otra vez no duplica movimientos.
            using HttpResponseMessage repetido = await EnviarAsync(cliente, token, "/api/v1/contingencias/csv/importar", new { contenido = csv });
            Assert.Equal(HttpStatusCode.UnprocessableEntity, repetido.StatusCode);
            using HttpResponseMessage previa2 = await EnviarAsync(cliente, token, "/api/v1/contingencias/csv/previsualizar", new { contenido = csv });
            Assert.Equal("Ya cargado (duplicado).", (await previa2.Content.ReadFromJsonAsync<List<FilaPrevia>>())![0].Error);

            using HttpResponseMessage malo = await EnviarAsync(cliente, token, "/api/v1/contingencias/csv/previsualizar", new { contenido = "a;b;c\n1;2;3" });
            Assert.Equal(HttpStatusCode.UnprocessableEntity, malo.StatusCode);
        }
    }

    [FactConBaseDatos]
    public async Task Conciliar_IngresoPasaADentro_YRetiroConDniErradoQuedaObservadoHastaRevisar()
    {
        var fuera = await DatosGarita.CrearBicicletaAsync(fabrica, "FUERA");
        var dentro = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        string dniReal = await DniAsync(dentro.IdEstudiante);
        string dniErrado = dniReal == "00000001" ? "00000002" : "00000001";
        string fIngreso = Folio(), fRetiro = Folio();

        var (cliente, token) = await SesionAsync(RolSistema.Supervisor);
        using (cliente)
        {
            using (HttpResponseMessage r = await EnviarAsync(cliente, token, "/api/v1/contingencias/fila",
                new { folio = fIngreso, fechaHora = Hace(100), tipo = "INGRESO", codigo = fuera.CodigoQr }))
                Assert.True(r.StatusCode == HttpStatusCode.Created, await r.Content.ReadAsStringAsync());
            using (HttpResponseMessage r = await EnviarAsync(cliente, token, "/api/v1/contingencias/fila",
                new { folio = fRetiro, fechaHora = Hace(50), tipo = "RETIRO", codigo = dentro.CodigoQr, dni = dniErrado }))
                Assert.Equal(HttpStatusCode.Created, r.StatusCode);

            using HttpResponseMessage pendientes = await EnviarAsync(cliente, token, "/api/v1/contingencias/pendientes", metodo: HttpMethod.Get);
            Assert.Contains((await pendientes.Content.ReadFromJsonAsync<List<Pendiente>>())!, p => p.Folio == fIngreso && p.Origen == "MANUAL");

            Guid idIngreso = await IdContingenciaAsync(fIngreso);
            using HttpResponseMessage ci = await EnviarAsync(cliente, token, $"/api/v1/contingencias/{idIngreso}/conciliar");
            Assert.Equal("CONCILIADO", (await ci.Content.ReadFromJsonAsync<Resultado>())!.Resultado);
            Assert.Equal("DENTRO", await EstadoAsync(fuera.IdBicicleta));
            Assert.Equal("CONTINGENCIA", await ConsultarAsync<string>($"""
                SELECT registro AS "Value" FROM v_monitoreo_auditoria WHERE id_bicicleta = {fuera.IdBicicleta} AND resultado = 'MANUAL'
                """));

            Guid idRetiro = await IdContingenciaAsync(fRetiro);
            using HttpResponseMessage cr = await EnviarAsync(cliente, token, $"/api/v1/contingencias/{idRetiro}/conciliar");
            Assert.Equal("OBSERVADO", (await cr.Content.ReadFromJsonAsync<Resultado>())!.Resultado);
            Assert.Equal("DENTRO", await EstadoAsync(dentro.IdBicicleta));

            using HttpResponseMessage detalle = await EnviarAsync(cliente, token, $"/api/v1/contingencias/{idRetiro}", metodo: HttpMethod.Get);
            var d = (await detalle.Content.ReadFromJsonAsync<Detalle>())!;
            Assert.Equal(dniReal[..4] + " ****", d.DniTitularParcial);
            Assert.Equal(dniErrado, d.DniAnotado);

            using HttpResponseMessage noReconoce = await EnviarAsync(cliente, token, $"/api/v1/contingencias/{idRetiro}/revisar",
                new { resolucion = "NO_RECONOCE", motivo = "Llamada al titular, niega el retiro" });
            Assert.Equal("OBSERVADO", (await noReconoce.Content.ReadFromJsonAsync<Resultado>())!.Resultado);

            using HttpResponseMessage corregido = await EnviarAsync(cliente, token, $"/api/v1/contingencias/{idRetiro}/revisar",
                new { resolucion = "ERROR_DIGITACION", dniCorregido = dniReal, motivo = "Se transcribió mal el folio físico" });
            Assert.True(corregido.StatusCode == HttpStatusCode.OK, await corregido.Content.ReadAsStringAsync());
            Assert.Equal("CONCILIADO", (await corregido.Content.ReadFromJsonAsync<Resultado>())!.Resultado);
            Assert.Equal("FUERA", await EstadoAsync(dentro.IdBicicleta));

            using HttpResponseMessage otraVez = await EnviarAsync(cliente, token, $"/api/v1/contingencias/{idRetiro}/conciliar");
            Assert.Equal(HttpStatusCode.Conflict, otraVez.StatusCode);
        }
    }

    [FactConBaseDatos]
    public async Task ConfirmadoPorTitular_ConciliaYConciliarLote_DevuelveResumen_GariteroNoAccede()
    {
        var dentro = await DatosGarita.CrearBicicletaAsync(fabrica, "DENTRO");
        string folio = Folio();
        var (cliente, token) = await SesionAsync(RolSistema.Administrador);
        using (cliente)
        {
            using (await EnviarAsync(cliente, token, "/api/v1/contingencias/fila",
                new { folio, fechaHora = Hace(30), tipo = "RETIRO", codigo = dentro.CodigoQr, dni = "99999999" })) { }
            using HttpResponseMessage lote = await EnviarAsync(cliente, token, "/api/v1/contingencias/conciliar-lote");
            Assert.True(lote.StatusCode == HttpStatusCode.OK, await lote.Content.ReadAsStringAsync());
            Assert.Contains((await lote.Content.ReadFromJsonAsync<Lote>())!.Detalle, r => r.Folio == folio && r.Resultado == "OBSERVADO");

            Guid id = await IdContingenciaAsync(folio);
            using HttpResponseMessage sinMotivo = await EnviarAsync(cliente, token, $"/api/v1/contingencias/{id}/revisar",
                new { resolucion = "CONFIRMADO_TITULAR", motivo = "" });
            Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);
            using HttpResponseMessage confirmado = await EnviarAsync(cliente, token, $"/api/v1/contingencias/{id}/revisar",
                new { resolucion = "CONFIRMADO_TITULAR", motivo = "Retiró un tercero autorizado por el titular" });
            Assert.Equal("CONCILIADO", (await confirmado.Content.ReadFromJsonAsync<Resultado>())!.Resultado);
            Assert.Equal("FUERA", await EstadoAsync(dentro.IdBicicleta));
        }

        var (garita, tokenGarita) = await SesionAsync(RolSistema.Garitero);
        using (garita)
        {
            using HttpResponseMessage prohibido = await EnviarAsync(garita, tokenGarita, "/api/v1/contingencias/pendientes", metodo: HttpMethod.Get);
            Assert.Equal(HttpStatusCode.Forbidden, prohibido.StatusCode);
        }
    }

    internal sealed record FilaPrevia(int Fila, string Folio, string? Bicicleta, bool Valida, string? Error);
    internal sealed record Importacion(int Insertadas, int ConError);
    internal sealed record Pendiente(Guid IdContingencia, string Folio, string Origen, string Estado);
    internal sealed record Resultado(string Folio, string Tipo, string Resultado);
    internal sealed record Detalle(string? DniAnotado, string DniTitularParcial, string Estado);
    internal sealed record Lote(int Conciliados, int Observados, int Conflictos, List<Resultado> Detalle);
}
