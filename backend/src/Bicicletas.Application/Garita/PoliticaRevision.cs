namespace Bicicletas.Application.Garita;

/// <summary>
/// Protocolo ante rechazos consecutivos (P05): al tercer retiro DENEGADO seguido se genera una alerta de
/// revisión biométrica. No elimina ni reemplaza el descriptor, porque los rechazos pueden deberse a la
/// iluminación, lentes o cambios de apariencia; el titular puede actualizar su enrolamiento en W4.
/// </summary>
public static class PoliticaRevision
{
    public const int RechazosParaAlerta = 3;

    /// <summary>Tope de intentos que se revisan; basta con saber si se alcanzó la alerta.</summary>
    public const int Maximo = 10;

    public static bool RequiereRevision(int rechazosConsecutivos) => rechazosConsecutivos >= RechazosParaAlerta;
}
