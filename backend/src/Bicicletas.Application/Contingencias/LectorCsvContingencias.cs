using Bicicletas.Domain.Comun;

namespace Bicicletas.Application.Contingencias;

/// <summary>
/// Lee el CSV exportado de la plantilla de la garita: folio;fecha_hora;tipo;codigo;dni;vigilante.
/// Acepta «;» (Excel en español) o «,» y el BOM de UTF-8.
/// </summary>
public static class LectorCsvContingencias
{
    public const int MaximoFilas = 500;
    private static readonly string[] Encabezado = ["folio", "fecha_hora", "tipo", "codigo", "dni", "vigilante"];

    public static IReadOnlyList<(int Fila, FilaContingencia Datos)> Leer(string contenido)
    {
        ArgumentNullException.ThrowIfNull(contenido);
        string[] lineas = contenido.TrimStart('﻿').Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        if (lineas.Length == 0 || string.IsNullOrWhiteSpace(lineas[0]))
            throw new ValidacionNegocioException("El archivo está vacío.");

        char separador = lineas[0].Contains(';', StringComparison.Ordinal) ? ';' : ',';
        string[] columnas = Partir(lineas[0], separador).Select(c => c.ToLowerInvariant()).ToArray();
        if (!columnas.Take(Encabezado.Length).SequenceEqual(Encabezado, StringComparer.Ordinal))
            throw new ValidacionNegocioException("Encabezado no válido. Use la plantilla: " + string.Join(';', Encabezado) + ".");

        var filas = new List<(int, FilaContingencia)>();
        for (int i = 1; i < lineas.Length; i++)
        {
            if (string.IsNullOrWhiteSpace(lineas[i].Replace(separador, ' ')))
                continue;
            string[] c = Partir(lineas[i], separador);
            string? Celda(int k) => k < c.Length && c[k].Length > 0 ? c[k] : null;
            filas.Add((i + 1, new FilaContingencia(Celda(0), Celda(1), Celda(2), Celda(3), Celda(4), Celda(5))));
            if (filas.Count > MaximoFilas)
                throw new ValidacionNegocioException($"El archivo supera el máximo de {MaximoFilas} filas.");
        }
        return filas.Count == 0 ? throw new ValidacionNegocioException("El archivo no tiene filas de datos.") : filas;
    }

    private static string[] Partir(string linea, char separador) =>
        linea.Split(separador).Select(c => c.Trim().Trim('"').Trim()).ToArray();
}
