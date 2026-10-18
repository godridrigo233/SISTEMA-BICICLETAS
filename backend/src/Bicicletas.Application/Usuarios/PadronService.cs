using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Bicicletas.Application.Autenticacion;
using Bicicletas.Domain.Comun;

namespace Bicicletas.Application.Usuarios;

/// <summary>
/// Carga del padrón institucional (W7, solo Administrador). Cada estudiante nuevo recibe una cuenta
/// «pendiente de activación»: su hash corresponde a un secreto aleatorio que nadie conoce, así que
/// solo puede entrar tras activarla él mismo con su código y DNI (POST /auth/activar).
/// </summary>
public sealed partial class PadronService(IPadronRepositorio repositorio, IHasherContrasenas hasher)
{
    public const int MaximoFilas = 3_000;
    private const string DominioEstudiante = "@estudiante.ucsm.edu.pe";
    private static readonly string[] Encabezado = ["codigo_universitario", "dni", "nombres", "apellidos", "facultad", "correo"];

    public async Task<IReadOnlyList<FilaPadronResponse>> PrevisualizarAsync(ArchivoPadronRequest archivo, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(archivo);
        return (await RevisarAsync(Leer(archivo.Contenido), ct)).Select(r => r.Fila).ToList();
    }

    public async Task<ResultadoPadronResponse> ImportarAsync(ArchivoPadronRequest archivo, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(archivo);
        var revisadas = await RevisarAsync(Leer(archivo.Contenido), ct);
        var nuevos = revisadas.Where(r => r.Nuevo is not null).Select(r => r.Nuevo!).ToList();
        if (nuevos.Count > 0)
        {
            // Un solo hash por carga (BCrypt es costoso a propósito); el secreto se descarta al instante.
            string hashPendiente = hasher.Hashear(Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));
            await repositorio.InsertarAsync(nuevos, hashPendiente, ct);
        }
        var filas = revisadas.Select(r => r.Fila).ToList();
        return new ResultadoPadronResponse(nuevos.Count, filas.Count(f => f.Estado == "YA_REGISTRADO"), filas.Count(f => f.Estado == "ERROR"), filas);
    }

    private static List<(int Numero, string[] Celdas)> Leer(string contenido)
    {
        string[] lineas = contenido.TrimStart('﻿').Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        if (lineas.Length == 0 || string.IsNullOrWhiteSpace(lineas[0]))
            throw new ValidacionNegocioException("El archivo está vacío.");
        char separador = lineas[0].Contains(';', StringComparison.Ordinal) ? ';' : ',';
        string[] columnas = Partir(lineas[0], separador).Select(c => c.ToLowerInvariant()).ToArray();
        if (!columnas.Take(Encabezado.Length).SequenceEqual(Encabezado, StringComparer.Ordinal))
            throw new ValidacionNegocioException("Encabezado no válido. Use la plantilla: " + string.Join(';', Encabezado) + ".");

        var filas = new List<(int, string[])>();
        for (int i = 1; i < lineas.Length; i++)
        {
            if (string.IsNullOrWhiteSpace(lineas[i].Replace(separador, ' ')))
                continue;
            filas.Add((i + 1, Partir(lineas[i], separador)));
            if (filas.Count > MaximoFilas)
                throw new ValidacionNegocioException($"El archivo supera el máximo de {MaximoFilas} filas; divídalo en partes.");
        }
        return filas.Count == 0 ? throw new ValidacionNegocioException("El archivo no tiene filas de datos.") : filas;
    }

    private static string[] Partir(string linea, char separador) =>
        linea.Split(separador).Select(c => c.Trim().Trim('"').Trim()).ToArray();

    private async Task<List<(FilaPadronResponse Fila, NuevoEstudiante? Nuevo)>> RevisarAsync(List<(int Numero, string[] Celdas)> filas, CancellationToken ct)
    {
        var datos = filas.Select(f =>
        {
            string Celda(int k) => k < f.Celdas.Length ? f.Celdas[k] : string.Empty;
            return (f.Numero, Codigo: Celda(0), Dni: Celda(1), Nombres: Celda(2).ToUpperInvariant(), Apellidos: Celda(3).ToUpperInvariant(),
                Facultad: Celda(4), Correo: AutenticacionService.NormalizarCorreo(Celda(5)));
        }).ToList();

        IReadOnlyList<EstudianteExistente> existentes = await repositorio.BuscarEstudiantesAsync(
            datos.Select(d => d.Codigo).Distinct(StringComparer.Ordinal).ToList(),
            datos.Select(d => d.Dni).Distinct(StringComparer.Ordinal).ToList(),
            datos.Select(d => d.Correo).Distinct(StringComparer.Ordinal).ToList(), ct);
        IReadOnlySet<string> correosEnUso = await repositorio.CorreosEnUsoAsync(datos.Select(d => d.Correo).Distinct(StringComparer.Ordinal).ToList(), ct);

        var codigosArchivo = new HashSet<string>(StringComparer.Ordinal);
        var dnisArchivo = new HashSet<string>(StringComparer.Ordinal);
        var correosArchivo = new HashSet<string>(StringComparer.Ordinal);
        var resultado = new List<(FilaPadronResponse, NuevoEstudiante?)>();
        foreach (var d in datos)
        {
            EstudianteExistente? mismo = existentes.FirstOrDefault(e =>
                e.CodigoUniversitario == d.Codigo && e.Dni.Trim() == d.Dni && e.Correo == d.Correo);
            string? error =
                !Codigo().IsMatch(d.Codigo) ? "El código universitario debe tener de 6 a 10 dígitos."
                : !Dni().IsMatch(d.Dni) ? "El DNI debe tener 8 dígitos."
                : d.Nombres.Length is 0 or > 60 ? "Nombres obligatorios (máximo 60 caracteres)."
                : d.Apellidos.Length is 0 or > 60 ? "Apellidos obligatorios (máximo 60 caracteres)."
                : d.Facultad.Length is 0 or > 80 ? "Facultad obligatoria (máximo 80 caracteres)."
                : !Correo().IsMatch(d.Correo) || d.Correo.Length > 100 ? $"El correo debe ser institucional {DominioEstudiante}."
                : !codigosArchivo.Add(d.Codigo) || !dnisArchivo.Add(d.Dni) || !correosArchivo.Add(d.Correo) ? "Código, DNI o correo repetido dentro del archivo."
                : mismo is not null ? null
                : existentes.Any(e => e.CodigoUniversitario == d.Codigo) ? "El código ya pertenece a otro estudiante registrado."
                : existentes.Any(e => e.Dni.Trim() == d.Dni) ? "El DNI ya está registrado con otro código."
                : correosEnUso.Contains(d.Correo) ? "El correo ya tiene una cuenta en el sistema."
                : null;

            string estado = error is not null ? "ERROR" : mismo is not null ? "YA_REGISTRADO" : "NUEVO";
            var fila = new FilaPadronResponse(d.Numero, d.Codigo, d.Dni, d.Nombres, d.Apellidos, d.Facultad, d.Correo, estado, error);
            resultado.Add((fila, estado == "NUEVO" ? new NuevoEstudiante(d.Codigo, d.Dni, d.Nombres, d.Apellidos, d.Facultad, d.Correo) : null));
        }
        return resultado;
    }

    [GeneratedRegex("^[0-9]{6,10}$")]
    private static partial Regex Codigo();

    [GeneratedRegex("^[0-9]{8}$")]
    private static partial Regex Dni();

    [GeneratedRegex(@"^[a-z0-9._%+\-]+@estudiante\.ucsm\.edu\.pe$")]
    private static partial Regex Correo();
}
