using Bicicletas.Domain.Comun;

namespace Bicicletas.Domain.Bicicletas;

/// <summary>Entidad núcleo del inventario: su estado determina el flujo de la garita (CU-03, CU-04).</summary>
public sealed class Bicicleta
{
    public Guid IdBicicleta { get; private set; }
    public Guid IdEstudiante { get; private set; }
    public string CodigoQr { get; private set; } = string.Empty;
    public string NumeroMarco { get; private set; } = string.Empty;
    public string MarcaModelo { get; private set; } = string.Empty;
    public string Color { get; private set; } = string.Empty;
    public string? RasgosDistintivos { get; private set; }
    public EstadoBicicleta Estado { get; private set; } = EstadoBicicleta.Fuera;

    private Bicicleta() { }   // requerido por EF Core

    public Bicicleta(Guid idBicicleta, Guid idEstudiante, string codigoQr, EstadoBicicleta estado)
    {
        IdBicicleta = idBicicleta;
        IdEstudiante = idEstudiante;
        CodigoQr = codigoQr;
        Estado = estado;
    }

    /// <summary>CU-01: registro de una bicicleta nueva del estudiante, con su código QR (UUID) y estado FUERA.</summary>
    public static Bicicleta Registrar(Guid idEstudiante, string numeroMarco, string marcaModelo, string color, string? rasgosDistintivos) =>
        new(Guid.NewGuid(), idEstudiante, Guid.NewGuid().ToString(), EstadoBicicleta.Fuera)
        {
            NumeroMarco = numeroMarco.Trim().ToUpperInvariant(),
            MarcaModelo = marcaModelo.Trim(),
            Color = color.Trim(),
            RasgosDistintivos = string.IsNullOrWhiteSpace(rasgosDistintivos) ? null : rasgosDistintivos.Trim(),
        };

    /// <summary>RF-05: FUERA → DENTRO. Un segundo ingreso es un conflicto (CU-03, flujo 5a).</summary>
    public void RegistrarIngreso()
    {
        if (Estado == EstadoBicicleta.Dentro)
            throw new ConflictoEstadoException("La bicicleta ya figura DENTRO; se evita duplicar el ingreso.");
        Estado = EstadoBicicleta.Dentro;
    }

    /// <summary>RF-08: DENTRO → FUERA, solo después de una verificación facial satisfactoria.</summary>
    public void RegistrarSalida()
    {
        if (Estado != EstadoBicicleta.Dentro)
            throw new ConflictoEstadoException("La bicicleta no figura DENTRO; no procede el retiro.");
        Estado = EstadoBicicleta.Fuera;
    }
}
