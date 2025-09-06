import { z } from "zod";

// Evento genérico de actualización de conversación (bandeja / previews / contadores)
export const ConvUpdateEventSchema = z.object({
  conversation_id: z.string().min(1),
  // Metadatos opcionales que pueden venir del backend
  owner_id: z.union([z.string(), z.number()]).optional(),
  user_id: z.union([z.string(), z.number()]).optional(),
  counterparty_id: z.union([z.string(), z.number()]).optional(),
  sender_id: z.union([z.string(), z.number()]).optional(),
  sender_name: z.string().optional(),
  counterparty_name: z.string().optional(),
  preview: z.string().optional(),
  subject: z.string().optional(),
  topic: z.string().optional(),
  message_text: z.string().optional(),
  created_at: z.string().optional(),
  last_created_at: z.string().optional(),
});
export type ConvUpdateEvent = z.infer<typeof ConvUpdateEventSchema>;

// Evento de nuevo mensaje (ventanas de conversación e inbox)
export const MessageNewEventSchema = z.object({
  conversation_id: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  body: z.string().optional(),
  preview: z.string().optional(),
  created_at: z.string().optional(),
  sender_id: z.union([z.string(), z.number()]).optional(),
  sender_name: z.string().optional(),
  sender_email: z.string().optional(),
  avatar_url: z.string().optional(),
  owner_id: z.union([z.string(), z.number()]).optional(),
  user_id: z.union([z.string(), z.number()]).optional(),
  counterparty_id: z.union([z.string(), z.number()]).optional(),
});
export type MessageNewEvent = z.infer<typeof MessageNewEventSchema>;

// Evento de conversación leída (mínimo requerido)
export const ConvReadEventSchema = z.object({
  conversation_id: z.string().min(1),
});
export type ConvReadEvent = z.infer<typeof ConvReadEventSchema>;
