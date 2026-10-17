namespace Bicicletas.Domain.Biometria;

/// <summary>
/// Regla de decisión de la verificación facial 1:1 (RF-06, RF-07, RNF-04).
/// El umbral θ se calibró con el Dataset Primario Local UCSM y se inyecta por configuración
/// (Biometria:UmbralTheta) para poder recalibrarlo sin recompilar.
/// </summary>
public sealed class PoliticaBiometrica
{
    public const int Dimensiones = 128;
    public const double UmbralPorDefecto = 0.37;

    public PoliticaBiometrica(double umbralTheta = UmbralPorDefecto)
    {
        if (umbralTheta <= 0 || umbralTheta >= 2)
            throw new ArgumentOutOfRangeException(nameof(umbralTheta), "El umbral debe estar en (0, 2).");
        UmbralTheta = umbralTheta;
    }

    public double UmbralTheta { get; }

    /// <summary>Distancia euclidiana entre el descriptor registrado y el capturado en la garita.</summary>
    public static double Distancia(IReadOnlyList<double> referencia, IReadOnlyList<double> capturado)
    {
        ValidarDescriptor(referencia, nameof(referencia));
        ValidarDescriptor(capturado, nameof(capturado));

        double suma = 0;
        for (int i = 0; i < Dimensiones; i++)
        {
            double diferencia = referencia[i] - capturado[i];
            suma += diferencia * diferencia;
        }
        return Math.Sqrt(suma);
    }

    /// <summary>La identidad se confirma si la distancia es menor o igual a θ.</summary>
    public bool EsCoincidente(double distancia) => distancia <= UmbralTheta;

    private static void ValidarDescriptor(IReadOnlyList<double> descriptor, string nombre)
    {
        if (descriptor.Count != Dimensiones)
            throw new ArgumentException($"El descriptor debe tener exactamente {Dimensiones} valores.", nombre);
        foreach (double valor in descriptor)
        {
            if (!double.IsFinite(valor))
                throw new ArgumentException("El descriptor contiene valores no numéricos.", nombre);
        }
    }
}
