namespace Bicicletas.Application.Autenticacion;

/// <summary>Puerto de hashing de contraseñas (la implementación vive en Infrastructure).</summary>
public interface IHasherContrasenas
{
    string Hashear(string contrasena);

    bool Verificar(string contrasena, string hash);

    /// <summary>Indica si el hash fue generado con un costo menor al vigente y conviene regenerarlo.</summary>
    bool RequiereRehash(string hash);
}
