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
}
