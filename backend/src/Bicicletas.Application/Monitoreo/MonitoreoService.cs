using System.Buffers;
using System.Globalization;
using System.Text;
using Bicicletas.Application.Comun;

namespace Bicicletas.Application.Monitoreo;

/// <summary>W6 · Monitoreo y Reportes (Supervisor y Administrador): indicadores, bitácora y exportación CSV.</summary>
public sealed class MonitoreoService(IMonitoreoRepositorio repositorio, TimeProvider reloj)
{
    /// <summary>Tope de filas por exportación para no saturar la API ni el pooler de Supabase.</summary>
    public const int MaximoFilasCsv = 10_000;

    private static readonly string[] Tipos = ["INGRESO", "RETIRO"];
    private static readonly string[] Resultados = ["EXITOSO", "DENEGADO", "MANUAL"];
    private static readonly string[] Registros = ["AUTOMATICO", "CONTINGENCIA", "DERIVACION"];
    private static readonly SearchValues<char> InicioDeFormula = SearchValues.Create("=+-@\t\r");
    private static readonly SearchValues<char> RequiereComillas = SearchValues.Create(";\"\n\r");

    public Task<ResumenMonitoreoResponse> ResumenAsync(CancellationToken ct) =>
        repositorio.ResumenAsync(HoraPeru.InicioDelDiaUtc(HoraPeru.Hoy(reloj)), ct);

    public async Task<Pagina<EventoMonitoreoResponse>> ConsultarAsync(FiltroMonitoreo filtro, CancellationToken ct)
    {
        CriteriosMonitoreo criterios = Criterios(filtro);
        var (total, elementos) = await repositorio.ConsultarEventosAsync(criterios, (filtro.Pagina - 1) * filtro.Tamano, filtro.Tamano, ct);
        return new Pagina<EventoMonitoreoResponse>(total, filtro.Pagina, filtro.Tamano, elementos);
    }

    /// <summary>CSV con separador «;» y BOM UTF-8 para que Excel en español lo abra con tildes y columnas.</summary>
    public async Task<byte[]> ExportarCsvAsync(FiltroMonitoreo filtro, CancellationToken ct)
    {
        var (_, elementos) = await repositorio.ConsultarEventosAsync(Criterios(filtro), 0, MaximoFilasCsv, ct);
        var csv = new StringBuilder();
        csv.AppendLine("Fecha y hora (Perú);Tipo;Resultado;Registro;Folio;Distancia;Latencia (ms);Bicicleta;Código universitario;Operador");
        foreach (EventoMonitoreoResponse e in elementos)
        {
            string fecha = new DateTimeOffset(e.FechaUtc, TimeSpan.Zero).ToOffset(HoraPeru.Desfase)
                .ToString("dd/MM/yyyy HH:mm:ss", CultureInfo.InvariantCulture);
            csv.AppendJoin(';', fecha, e.TipoEvento, e.Resultado, e.Registro, Celda(e.Folio),
                    e.DistanciaEuclidiana?.ToString("0.0000", CultureInfo.InvariantCulture) ?? string.Empty,
                    e.LatenciaMs?.ToString(CultureInfo.InvariantCulture) ?? string.Empty,
                    Celda(e.Bicicleta), Celda(e.CodigoUniversitario), Celda(e.Operador))
                .AppendLine();
        }
        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(csv.ToString())];
    }

    private static CriteriosMonitoreo Criterios(FiltroMonitoreo filtro)
    {
        ArgumentNullException.ThrowIfNull(filtro);
        var (desde, hasta) = filtro.RangoUtc();
        return new CriteriosMonitoreo(desde, hasta,
            FiltroMovimientos.Validar(filtro.Tipo, "tipo", Tipos),
            FiltroMovimientos.Validar(filtro.Resultado, "resultado", Resultados),
            FiltroMovimientos.Validar(filtro.Registro, "registro", Registros));
    }

    /// <summary>
    /// Escapa la celda y neutraliza la inyección de fórmulas (CSV injection, OWASP): un texto que empieza
    /// con = + - @ se antepone con un apóstrofo para que Excel no lo ejecute.
    /// </summary>
    public static string Celda(string? valor)
    {
        if (string.IsNullOrEmpty(valor))
            return string.Empty;
        string texto = valor.AsSpan().IndexOfAny(InicioDeFormula) == 0 ? "'" + valor : valor;
        return texto.AsSpan().ContainsAny(RequiereComillas) ? "\"" + texto.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"" : texto;
    }
}
