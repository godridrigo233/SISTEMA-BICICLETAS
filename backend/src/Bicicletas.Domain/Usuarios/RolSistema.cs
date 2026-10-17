namespace Bicicletas.Domain.Usuarios;

/// <summary>Catálogo RBAC (tabla roles, V005). El valor coincide con el claim id_rol del JWT.</summary>
public static class RolSistema
{
    public const short Estudiante = 1;
    public const short Garitero = 2;
    public const short Supervisor = 3;
    public const short Administrador = 4;

    public static bool EsValido(short idRol) => idRol is >= Estudiante and <= Administrador;
}
