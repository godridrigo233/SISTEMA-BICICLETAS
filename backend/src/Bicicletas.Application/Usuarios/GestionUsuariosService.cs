using System.Security.Cryptography;
using Bicicletas.Application.Autenticacion;
using Bicicletas.Application.Comun;
using Bicicletas.Domain.Comun;
using Bicicletas.Domain.Usuarios;

namespace Bicicletas.Application.Usuarios;

/// <summary>W7 · Gestión de Usuarios y Roles (solo Administrador). No hay eliminación física: se inactiva.</summary>
public sealed class GestionUsuariosService(
    IGestionUsuariosRepositorio repositorio,
    IHasherContrasenas hasher,
    IControlIntentos intentos)
{
    private const string Dominio = "@ucsm.edu.pe";
    // Sin caracteres ambiguos (0/O, 1/l/I) para dictarla sin errores.
    private const string Letras = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Digitos = "23456789";

    public static string NombreRol(short idRol) => idRol switch
    {
        RolSistema.Estudiante => "Estudiante",
        RolSistema.Garitero => "Garitero",
        RolSistema.Supervisor => "Supervisor",
        _ => "Administrador",
    };

    public async Task<Pagina<UsuarioResumenResponse>> ListarAsync(short? idRol, string? correo, int pagina, int tamano, CancellationToken ct)
    {
        if (idRol is { } r && !RolSistema.EsValido(r))
            throw new ValidacionNegocioException("Rol no válido.");
        pagina = Math.Max(1, pagina);
        tamano = Math.Clamp(tamano, 1, 100);
        var (total, elementos) = await repositorio.ListarAsync(idRol, string.IsNullOrWhiteSpace(correo) ? null : correo.Trim().ToLowerInvariant(),
            (pagina - 1) * tamano, tamano, ct);
        return new Pagina<UsuarioResumenResponse>(total, pagina, tamano, elementos);
    }

    public async Task<ContrasenaTemporalResponse> CrearAsync(CrearUsuarioRequest solicitud, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        string correo = AutenticacionService.NormalizarCorreo(solicitud.Correo);
        if (!correo.EndsWith(Dominio, StringComparison.Ordinal) || correo.Length <= Dominio.Length)
            throw new ValidacionNegocioException("Las cuentas del personal usan el correo institucional @ucsm.edu.pe.");
        if (solicitud.IdRol is < RolSistema.Garitero or > RolSistema.Administrador)
            throw new ValidacionNegocioException("Seleccione Garitero, Supervisor o Administrador.");
        if (await repositorio.ExisteCorreoAsync(correo, ct))
            throw new ConflictoEstadoException("Ya existe una cuenta con ese correo.");

        string temporal = GenerarTemporal();
        var usuario = new Usuario(Guid.NewGuid(), solicitud.IdRol, correo, hasher.Hashear(temporal), debeCambiarPassword: true);
        repositorio.Agregar(usuario);
        await repositorio.GuardarAsync(ct);
        return new ContrasenaTemporalResponse(usuario.IdUsuario, correo, NombreRol(usuario.IdRol), temporal);
    }

    public async Task<ContrasenaTemporalResponse> RestablecerAsync(Guid idUsuario, CancellationToken ct)
    {
        Usuario usuario = await repositorio.ObtenerAsync(idUsuario, ct) ?? throw new RecursoNoEncontradoException("Cuenta no encontrada.");
        if (!usuario.Activo)
            throw new ConflictoEstadoException("No se puede restablecer la contraseña de una cuenta inactiva.");
        string temporal = GenerarTemporal();
        usuario.AsignarPasswordTemporal(hasher.Hashear(temporal));
        await repositorio.GuardarAsync(ct);
        intentos.Reiniciar(usuario.CorreoInstitucional);   // desbloquea la cuenta si estaba bloqueada
        return new ContrasenaTemporalResponse(usuario.IdUsuario, usuario.CorreoInstitucional, NombreRol(usuario.IdRol), temporal);
    }

    public async Task<UsuarioResumenResponse> CambiarEstadoAsync(Guid idUsuario, CambiarEstadoRequest solicitud, Guid idAdministrador, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        bool activo = solicitud.Activo ?? throw new ValidacionNegocioException("Indique si la cuenta queda activa.");
        if (idUsuario == idAdministrador && !activo)
            throw new ConflictoEstadoException("No puede inactivar su propia cuenta.");
        Usuario usuario = await repositorio.ObtenerAsync(idUsuario, ct) ?? throw new RecursoNoEncontradoException("Cuenta no encontrada.");
        if (activo)
        {
            usuario.Activar();
        }
        else
        {
            usuario.Desactivar();
            if (usuario.IdRol == RolSistema.Estudiante)
                await repositorio.EliminarDescriptorAsync(usuario.IdUsuario, ct);
        }
        await repositorio.GuardarAsync(ct);
        return new UsuarioResumenResponse(usuario.IdUsuario, usuario.CorreoInstitucional, usuario.IdRol, NombreRol(usuario.IdRol),
            usuario.CreadoEn, usuario.Activo, usuario.DebeCambiarPassword);
    }

    /// <summary>12 caracteres con letras y dígitos, generados con un RNG criptográfico (OWASP A02).</summary>
    public static string GenerarTemporal()
    {
        char[] clave = new char[12];
        for (int i = 0; i < clave.Length; i++)
            clave[i] = (i % 4 == 3 ? Digitos : Letras)[RandomNumberGenerator.GetInt32(i % 4 == 3 ? Digitos.Length : Letras.Length)];
        RandomNumberGenerator.Shuffle(clave.AsSpan());
        return new string(clave);
    }
}
