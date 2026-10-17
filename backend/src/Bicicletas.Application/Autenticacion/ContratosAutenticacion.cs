using System.ComponentModel.DataAnnotations;

namespace Bicicletas.Application.Autenticacion;

/// <summary>Cuerpo de POST /api/v1/auth/login (W1 Login unificado).</summary>
public sealed record LoginRequest(
    [Required, EmailAddress, MaxLength(100)] string Correo,
    [Required, MaxLength(128)] string Password);

/// <summary>Respuesta del login: el JWT y los datos mínimos para enrutar por rol en la SPA.</summary>
public sealed record LoginResponse(string Token, DateTime ExpiraEnUtc, short IdRol, bool DebeCambiarPassword);

/// <summary>Token firmado y su vencimiento.</summary>
public sealed record TokenEmitido(string Token, DateTime ExpiraEnUtc);
