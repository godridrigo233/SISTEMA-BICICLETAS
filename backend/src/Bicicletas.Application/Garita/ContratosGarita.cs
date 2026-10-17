using System.ComponentModel.DataAnnotations;

namespace Bicicletas.Application.Garita;

/// <summary>Datos que W2 muestra al escanear el QR para el cotejo visual del vigilante (sin fotografías).</summary>
public sealed record BicicletaGaritaResponse(
    Guid IdBicicleta,
    string CodigoQr,
    string Estado,
    string NumeroMarco,
    string MarcaModelo,
    string Color,
    string? RasgosDistintivos,
    string Titular,
    string CodigoUniversitario);

/// <summary>Cuerpo de POST /api/v1/ingresos/registrar (CU-03).</summary>
public sealed record IngresoRequest(
    [Required] Guid IdBicicleta,
    [Range(0, 60_000)] int? LatenciaMs);

public sealed record MovimientoResponse(string Resultado, string EstadoActualizado);
