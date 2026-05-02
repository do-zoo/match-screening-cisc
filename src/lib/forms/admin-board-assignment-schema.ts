import { z } from "zod";

export const adminBoardAssignmentUpsertSchema = z.object({
  boardPeriodId: z.string().min(1),
  managementMemberId: z.string().min(1),
  boardRoleId: z.string().min(1),
});

export const adminBoardAssignmentUpdateSchema =
  adminBoardAssignmentUpsertSchema.extend({
    id: z.string().min(1),
  });

export const deleteBoardAssignmentSchema = z.object({
  id: z.string().min(1),
});
