export function toSpanishErrorMessage(err: unknown, fallback: string): string {
  const raw =
    typeof err === "string"
      ? err
      : typeof err === "object" && err && "message" in err
      ? String((err as any).message)
      : "";

  const msg = raw.trim();

  // Mapeo de errores comunes de Supabase/Auth
  const dict: Array<[pattern: RegExp, es: string]> = [
    [/invalid login credentials/i, "Credenciales inválidas"],
    [/email not confirmed/i, "Debes verificar tu correo"],
    [/user already registered/i, "El usuario ya está registrado"],
    [/invalid email/i, "Correo electrónico inválido"],
    [/password.*(too short|at least)/i, "La contraseña no cumple con la longitud mínima"],
    [/token has expired|invalid token/i, "El enlace o token es inválido o ha expirado"],
    [/too many requests/i, "Has realizado demasiados intentos. Intenta más tarde"],
    [/rate limit/i, "Has realizado demasiados intentos. Intenta más tarde"],
    [/network|fetch failed/i, "Problemas de conexión. Intenta nuevamente"],
    // Backend DB/trigger al crear usuario
    [/database error saving new user/i, "Error de base de datos al crear tu usuario. Estamos ajustando el perfil. Intenta nuevamente en unos minutos."],
    [/unexpected_failure/i, "Ocurrió un error inesperado. Intenta nuevamente más tarde."],
    // Redirect URL no verificada en Supabase
    [/verified redirectTo url|for security purposes.*redirectto/i, "URL de redirección no permitida. Configura las Allowed Redirect URLs en Supabase > Authentication > URL Configuration."],
    // SMTP/Email provider fallando
    [/(smtp|error sending|connection refused|dial tcp|econnrefused)/i, "No se pudo enviar el correo de verificación. Revisa la configuración de correo o inténtalo más tarde."],
  ];

  for (const [pattern, es] of dict) {
    if (pattern.test(msg)) return es;
  }

  // Si viene un mensaje pero no está mapeado, preferimos el fallback en español
  return fallback;
}
