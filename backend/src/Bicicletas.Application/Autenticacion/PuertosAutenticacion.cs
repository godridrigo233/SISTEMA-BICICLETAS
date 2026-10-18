using Bicicletas.Domain.Usuarios;

namespace Bicicletas.Application.Autenticacion;

/// <summary>Acceso a la tabla usuarios (lo implementa Infrastructure).</summary>
public interface IUsuarioRepositorio
{
    Task<Usuario?> ObtenerPorCorreoAsync(string correoNormalizado, CancellationToken ct);

    Task<Usuario?> ObtenerPorIdAsync(Guid idUsuario, CancellationToken ct);

    /// <summary>Código universitario y DNI del padrón para validar la activación de la cuenta.</summary>
    Task<(string Codigo, string Dni)?> ObtenerDatosPadronAsync(Guid idEstudiante, CancellationToken ct);

    Task GuardarCambiosAsync(CancellationToken ct);
}

/// <summary>Emisión del JWT con el claim id_rol (lo implementa la capa Api).</summary>
public interface IGeneradorToken
{
    TokenEmitido Generar(Usuario usuario);
}
