using System.ComponentModel.DataAnnotations;

namespace Bicicletas.Api.Seguridad;

/// <summary>Configuración del JWT (variables de entorno Jwt__ClaveFirma, Jwt__Emisor).</summary>
public sealed class OpcionesJwt
{
    public const string Seccion = "Jwt";

    /// <summary>Clave HMAC-SHA256: mínimo 32 caracteres; nunca se versiona.</summary>
    [Required, MinLength(32)]
    public string ClaveFirma { get; set; } = string.Empty;

    [Required]
    public string Emisor { get; set; } = string.Empty;

    /// <summary>Vigencia del token (P05: 30 minutos).</summary>
    [Range(5, 120)]
    public int MinutosVigencia { get; set; } = 30;
}
