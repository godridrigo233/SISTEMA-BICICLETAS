// Misma política que la API (ReglasContrasena): 10–128 caracteres, con letras y números.
export const cumplePolitica = (valor) =>
  valor.length >= 10 && valor.length <= 128 && /\p{L}/u.test(valor) && /\d/.test(valor);
