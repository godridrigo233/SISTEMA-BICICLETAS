using System.Globalization;
using System.Security.Claims;
using System.Text;
using Bicicletas.Application.Autenticacion;
using Bicicletas.Domain.Usuarios;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Bicicletas.Api.Seguridad;

/// <summary>
/// Emite el JWT firmado con HMAC-SHA256. Solo contiene el identificador, el rol y la marca de
/// contraseña temporal: ningún dato personal ni biométrico viaja en el token.
/// </summary>
public sealed class GeneradorJwt(IOptions<OpcionesJwt> opciones, TimeProvider reloj) : IGeneradorToken
{
    public TokenEmitido Generar(Usuario usuario)
    {
        ArgumentNullException.ThrowIfNull(usuario);
        OpcionesJwt config = opciones.Value;
        DateTime ahora = reloj.GetUtcNow().UtcDateTime;
        DateTime expira = ahora.AddMinutes(config.MinutosVigencia);

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = config.Emisor,
            IssuedAt = ahora,
            NotBefore = ahora,
            Expires = expira,
            Subject = new ClaimsIdentity(
            [
                new Claim(ClaimsSistema.IdUsuario, usuario.IdUsuario.ToString()),
                new Claim(ClaimsSistema.IdRol, usuario.IdRol.ToString(CultureInfo.InvariantCulture)),
                new Claim(ClaimsSistema.DebeCambiarPassword, usuario.DebeCambiarPassword ? "true" : "false"),
            ]),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.ClaveFirma)),
                SecurityAlgorithms.HmacSha256),
        };

        return new TokenEmitido(new JsonWebTokenHandler().CreateToken(descriptor), expira);
    }
}
