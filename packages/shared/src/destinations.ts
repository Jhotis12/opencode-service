import { z } from "zod";

export const DestinationKindSchema = z.enum(["telegram_chat", "whatsapp", "email", "webhook", "custom"]);
export type DestinationKind = z.infer<typeof DestinationKindSchema>;

export const ProjectDestinationSchema = z.object({
  id: z.string().min(1),
  projectSlug: z.string().min(1),
  kind: DestinationKindSchema,
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(1_000),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProjectDestination = z.infer<typeof ProjectDestinationSchema>;

export const CreateProjectDestinationSchema = z.object({
  kind: DestinationKindSchema,
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(1_000),
});
export type CreateProjectDestinationInput = z.infer<typeof CreateProjectDestinationSchema>;

export const UpdateProjectDestinationSchema = z.object({
  kind: DestinationKindSchema.optional(),
  label: z.string().min(1).max(120).optional(),
  value: z.string().min(1).max(1_000).optional(),
});
export type UpdateProjectDestinationInput = z.infer<typeof UpdateProjectDestinationSchema>;
