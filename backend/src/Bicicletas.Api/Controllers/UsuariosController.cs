using Bicicletas.Api.Seguridad;
using Bicicletas.Application.Comun;
using Bicicletas.Application.Usuarios;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bicicletas.Api.Controllers;

/// <summary>W7 · Gestión de Usuarios y Roles. Solo Administrador.</summary>
[ApiController]
[Route("api/v1/usuarios")]
[Authorize(Policy = Politicas.Administracion)]
public sealed class UsuariosController(GestionUsuariosService servicio) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Pagina<UsuarioResumenResponse>>> Listar([FromQuery] short? rol, [FromQuery] string? correo,
        [FromQuery] int pagina = 1, [FromQuery] int tamano = 20, CancellationToken ct = default) =>
        Ok(await servicio.ListarAsync(rol, correo, pagina, tamano, ct));

    /// <response code="201">Cuenta creada; la contraseña temporal se devuelve una sola vez.</response>
    /// <response code="409">El correo ya tiene una cuenta.</response>
    [HttpPost]
    public async Task<ActionResult<ContrasenaTemporalResponse>> Crear(CrearUsuarioRequest solicitud, CancellationToken ct)
    {
        ContrasenaTemporalResponse creada = await servicio.CrearAsync(solicitud, ct);
        return Created($"/api/v1/usuarios/{creada.IdUsuario}", creada);
    }

    [HttpPost("{id:guid}/restablecer-password")]
    public async Task<ActionResult<ContrasenaTemporalResponse>> Restablecer(Guid id, CancellationToken ct) =>
        Ok(await servicio.RestablecerAsync(id, ct));

    /// <summary>Activa o inactiva la cuenta; al inactivar a un estudiante se elimina su descriptor biométrico.</summary>
    [HttpPatch("{id:guid}/estado")]
    public async Task<ActionResult<UsuarioResumenResponse>> CambiarEstado(Guid id, CambiarEstadoRequest solicitud, CancellationToken ct) =>
        Ok(await servicio.CambiarEstadoAsync(id, solicitud,
            Guid.Parse(User.FindFirst(ClaimsSistema.IdUsuario)!.Value), ct));
}
