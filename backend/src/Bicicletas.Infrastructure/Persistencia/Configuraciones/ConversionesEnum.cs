using Bicicletas.Domain.Auditoria;
using Bicicletas.Domain.Bicicletas;

namespace Bicicletas.Infrastructure.Persistencia.Configuraciones;

/// <summary>Traducción entre los enums del dominio y los valores de texto de los CHECK de la base.</summary>
internal static class ConversionesEnum
{
    public static string AEstado(EstadoBicicleta estado) => estado == EstadoBicicleta.Dentro ? "DENTRO" : "FUERA";

    public static EstadoBicicleta DeEstado(string valor) => valor == "DENTRO" ? EstadoBicicleta.Dentro : EstadoBicicleta.Fuera;

    public static string ATipo(TipoEvento tipo) => tipo == TipoEvento.Ingreso ? "INGRESO" : "RETIRO";

    public static TipoEvento DeTipo(string valor) => valor == "INGRESO" ? TipoEvento.Ingreso : TipoEvento.Retiro;

    public static string AResultado(ResultadoAcceso resultado) => resultado switch
    {
        ResultadoAcceso.Exitoso => "EXITOSO",
        ResultadoAcceso.Denegado => "DENEGADO",
        _ => "MANUAL",
    };

    public static ResultadoAcceso DeResultado(string valor) => valor switch
    {
        "EXITOSO" => ResultadoAcceso.Exitoso,
        "DENEGADO" => ResultadoAcceso.Denegado,
        _ => ResultadoAcceso.Manual,
    };
}
