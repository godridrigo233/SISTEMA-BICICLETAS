using Bicicletas.Application.Autenticacion;

namespace Bicicletas.Infrastructure.Seguridad;

/// <summary>
/// Hash de contraseñas con BCrypt de costo 12 (RNF-02, OWASP A02). Las cuentas antiguas con costo
/// menor (p. ej., $2a$10$) se siguen verificando y se regeneran con costo 12 al iniciar sesión.
/// </summary>
public sealed class HasherBCrypt : IHasherContrasenas
{
    public const int Costo = 12;

    public string Hashear(string contrasena) =>
        BCrypt.Net.BCrypt.HashPassword(contrasena, workFactor: Costo);

    public bool Verificar(string contrasena, string hash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(contrasena, hash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            return false;   // hash corrupto o con formato desconocido: se trata como credencial inválida
        }
    }

    public bool RequiereRehash(string hash) => BCrypt.Net.BCrypt.PasswordNeedsRehash(hash, Costo);
}
