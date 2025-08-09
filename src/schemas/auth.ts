import { z } from "zod";

// Esquemas reutilizables
export const emailSchema = z.string().email("Correo inválido");
export const strongPasswordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Debe contener una mayúscula")
  .regex(/[a-z]/, "Debe contener una minúscula")
  .regex(/[0-9]/, "Debe contener un número");

export const userTypeEnum = z.enum(["buyer", "seller"], {
  required_error: "Selecciona un tipo de cuenta",
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, "Mínimo 6 caracteres"),
  remember: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(2, "Ingresa tu nombre")
      .max(60, "Demasiado largo"),
    lastName: z
      .string()
      .min(2, "Ingresa tu apellido")
      .max(60, "Demasiado largo"),
    email: emailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string(),
    userType: userTypeEnum,
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Debes aceptar los términos" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
