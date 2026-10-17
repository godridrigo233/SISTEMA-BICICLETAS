using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Autenticacion;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api.Controllers;

/// <summary>Autenticación del Login unificado de los cuatro roles (W1, RF-01).</summary>
[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(AutenticacionService autenticacion) : ControllerBase
{
    /// <response code="200">Credenciales válidas: JWT de 30 minutos con el claim id_rol.</response>
    /// <response code="401">Correo o contraseña incorrectos (mensaje genérico).</response>
    /// <response code="403">Cuenta inactiva.</response>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest solicitud, CancellationToken ct) =>
        Ok(await autenticacion.IniciarSesionAsync(solicitud, ct));

    /// <summary>Primer ingreso: reemplaza la contraseña temporal (es la única operación que admite ese token).</summary>
    /// <response code="200">Contraseña cambiada; se devuelve un JWT nuevo sin la marca de contraseña temporal.</response>
    /// <response code="422">Contraseña actual incorrecta o nueva contraseña fuera de la política.</response>
    [HttpPost("cambiar-password")]
    [Authorize]
    public async Task<ActionResult<LoginResponse>> CambiarPassword(CambiarPasswordRequest solicitud, CancellationToken ct)
    {
        Guid idUsuario = Guid.Parse(User.FindFirst(ClaimsSistema.IdUsuario)!.Value);
        return Ok(await autenticacion.CambiarPasswordAsync(idUsuario, solicitud, ct));
    }
}
