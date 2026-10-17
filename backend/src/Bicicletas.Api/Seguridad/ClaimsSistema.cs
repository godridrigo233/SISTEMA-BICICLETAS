namespace Bicicletas.Api.Seguridad;

/// <summary>Nombres de los claims del JWT emitido por la API.</summary>
public static class ClaimsSistema
{
    public const string IdUsuario = "sub";
    public const string IdRol = "id_rol";
    public const string DebeCambiarPassword = "debe_cambiar_password";
}
