/**
 * Email deshabilitado: la comunicación por correo fue reemplazada por mensajería en tiempo real (Pusher).
 * Este módulo se mantiene solo para compatibilidad y lanza errores si se intenta usar.
 */

type MailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
};

export function getTransporter() {
  throw new Error("EMAIL_DISABLED: el envío por email fue deshabilitado. Usa la mensajería interna.");
}

export async function sendMail(_opts: MailOptions) {
  throw new Error("EMAIL_DISABLED: el envío por email fue deshabilitado. Usa la mensajería interna.");
}
