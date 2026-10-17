using System.Globalization;
using Bicicletas.Domain.Usuarios;

namespace Bicicletas.Api.Seguridad;

/// <summary>
/// Políticas RBAC según el claim id_rol del JWT (P07, mapa de navegación). Todas exigen además que
/// la contraseña temporal ya se haya cambiado: con ese token solo se puede llamar a cambiar-password.
/// </summary>
public static class Politicas
{
    public const string SesionActiva = nameof(SesionActiva);
    public const string Estudiante = nameof(Estudiante);
    public const string OperacionGarita = nameof(OperacionGarita);
    public const string Regularizacion = nameof(Regularizacion);
    public const string Monitoreo = nameof(Monitoreo);
    public const string Administracion = nameof(Administracion);

    public static IServiceCollection AddPoliticasRbac(this IServiceCollection services)
    {
        services.AddAuthorizationBuilder()
            .AddPolicy(SesionActiva, p => ContrasenaDefinitiva(p))
            .AddPolicy(Estudiante, p => ConRoles(p, RolSistema.Estudiante))
            .AddPolicy(OperacionGarita, p => ConRoles(p, RolSistema.Garitero, RolSistema.Supervisor, RolSistema.Administrador))
            .AddPolicy(Regularizacion, p => ConRoles(p, RolSistema.Supervisor, RolSistema.Administrador))
            .AddPolicy(Monitoreo, p => ConRoles(p, RolSistema.Supervisor, RolSistema.Administrador))
            .AddPolicy(Administracion, p => ConRoles(p, RolSistema.Administrador));
        return services;
    }

    private static void ContrasenaDefinitiva(Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder politica) =>
        politica.RequireAuthenticatedUser().RequireClaim(ClaimsSistema.DebeCambiarPassword, "false");

    private static void ConRoles(Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder politica, params short[] roles)
    {
        ContrasenaDefinitiva(politica);
        politica.RequireClaim(ClaimsSistema.IdRol, roles.Select(r => r.ToString(CultureInfo.InvariantCulture)));
    }
}
