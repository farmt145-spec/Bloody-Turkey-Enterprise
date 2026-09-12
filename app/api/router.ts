import { productionRouter } from "./production-router";
import { farmRouter } from "./farm-router";
import { orgRouter } from "./org-router";
import { dailyRouter, feedProgramRouter } from "./daily-router";
import { createRouter, publicQuery } from "./middleware";
import { erpRouter, notificationsRouter } from "./erp-router";
import { analyticsRouter, aiRouter } from "./analytics-router";
import { nutritionRouter } from "./nutrition-router";
import { commandRouter } from "./command-router";
import { gapRouter } from "./gap-router";
import { transferRouter } from "./transfer-router";
import { workspaceRouter } from "./workspace-router";
import { slaughterRouter } from "./slaughter-router";
import { geneticsRouter } from "./genetics-router";
import { obchodRouter } from "./obchod-router";
import { normyRouter } from "./normy-router";
import { reportsRouter } from "./reports-router";
import { adminRouter } from "./admin-router";
import { authRouter } from "./auth-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  workspace: workspaceRouter,
  farm: farmRouter,
  org: orgRouter,
  daily: dailyRouter,
  feedProgram: feedProgramRouter,
  erp: erpRouter,
  notifications: notificationsRouter,
  analytics: analyticsRouter,
  ai: aiRouter,
  nutrition: nutritionRouter,
  command: commandRouter,
  gap: gapRouter,
  transfer: transferRouter,
  slaughter: slaughterRouter,
  genetics: geneticsRouter,
  obchod: obchodRouter,
  normy: normyRouter,
  reports: reportsRouter,
  admin: adminRouter,
  auth: authRouter,
  production: productionRouter,
});

export type AppRouter = typeof appRouter;
