namespace Bicicletas.Domain.Comun;

/// <summary>Regla de negocio violada por el estado actual; la API la traduce a HTTP 409.</summary>
public sealed class ConflictoEstadoException(string mensaje) : Exception(mensaje);

/// <summary>Recurso inexistente; la API la traduce a HTTP 404.</summary>
public sealed class RecursoNoEncontradoException(string mensaje) : Exception(mensaje);

/// <summary>Datos de entrada que no cumplen una regla de negocio; la API la traduce a HTTP 422.</summary>
public sealed class ValidacionNegocioException(string mensaje) : Exception(mensaje);
