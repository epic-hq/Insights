/**
 * Generative UI Routes
 *
 * Demo route to showcase PoC components
 */

import { route, type RouteConfig } from "@react-router/dev/routes";

export const generativeUIRoutes: RouteConfig[] = [
  route("demo/gen-ui-live", "./features/generative-ui/pages/demo-live.tsx"),
  route(
    "demo/gen-ui-static",
    "./features/generative-ui/pages/demo-working.tsx",
  ),
  route("demo/gen-ui-v2", "./features/generative-ui/pages/demo-v2.tsx"),
  route("demo/gen-ui-v1", "./features/generative-ui/pages/demo.tsx"),
];
