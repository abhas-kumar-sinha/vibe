import { projectsRouter } from "@/modules/projects/server/procedures";
import { messagesRouter } from "@/modules/messages/server/procedures";
import { fragmentsRouter } from "@/modules/fragments/server/procedures";
import { createTRPCRouter } from "../init";
import { usageRouter } from "@/modules/usage/server/procedures";

export const appRouter = createTRPCRouter({
  messages: messagesRouter,
  projects: projectsRouter,
  fragments: fragmentsRouter,
  usage: usageRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
