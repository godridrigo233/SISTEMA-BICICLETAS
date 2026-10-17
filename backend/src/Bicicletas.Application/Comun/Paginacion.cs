using System.ComponentModel.DataAnnotations;
using Bicicletas.Domain.Comun;

namespace Bicicletas.Application.Comun;

/// <summary>Página de resultados: la consulta nunca devuelve la tabla completa (RNF-01).</summary>
public sealed record Pagina<T>(int Total, int NumeroPagina, int TamanoPagina, IReadOnlyList<T> Elementos);

/// <summary>Filtros comunes de los listados de movimientos (W5 y W6), recibidos por query string.</summary>
public class FiltroMovimientos
{
    public DateOnly? Desde { get; init; }
    public DateOnly? Hasta { get; init; }

    /// <summary>INGRESO o RETIRO.</summary>
    public string? Tipo { get; init; }

    [Range(1, 100_000)]
    public int Pagina { get; init; } = 1;

    [Range(1, 100)]
    public int Tamano { get; init; } = 20;

    internal (DateTime? DesdeUtc, DateTime? HastaUtc) RangoUtc()
    {
        if (Desde is { } d && Hasta is { } h && d > h)
            throw new ValidacionNegocioException("La fecha «desde» no puede ser posterior a «hasta».");
        return (Desde is { } desde ? HoraPeru.InicioDelDiaUtc(desde) : null,
                Hasta is { } hasta ? HoraPeru.InicioDelDiaUtc(hasta.AddDays(1)) : null);
    }

    internal static string? Validar(string? valor, string campo, string[] permitidos)
    {
        if (string.IsNullOrWhiteSpace(valor))
            return null;
        string normalizado = valor.Trim().ToUpperInvariant();
        return permitidos.Contains(normalizado, StringComparer.Ordinal)
            ? normalizado
            : throw new ValidacionNegocioException($"Valor no válido para «{campo}». Use: {string.Join(", ", permitidos)}.");
    }
}

/// <summary>
/// Perú usa UTC−5 todo el año (sin horario de verano), así que «hoy» se calcula con un desfase fijo
/// y no depende de que la imagen Docker incluya la base de zonas horarias.
/// </summary>
public static class HoraPeru
{
    public static readonly TimeSpan Desfase = TimeSpan.FromHours(-5);

    public static DateTime InicioDelDiaUtc(DateOnly dia) =>
        new DateTimeOffset(dia.ToDateTime(TimeOnly.MinValue), Desfase).UtcDateTime;

    public static DateOnly Hoy(TimeProvider reloj)
    {
        ArgumentNullException.ThrowIfNull(reloj);
        return DateOnly.FromDateTime(reloj.GetUtcNow().ToOffset(Desfase).DateTime);
    }
}
