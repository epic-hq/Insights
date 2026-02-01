/**
 * Generative UI Routes
 *
 * Demo route to showcase PoC components
 */

import type { RouteConfig } from "@react-router/dev/routes";

export const generativeUIRoutes: RouteConfig[] = [
  {
    path: "/demo/gen-ui",
    file: "features/generative-ui/pages/demo-v2.tsx",
  },
  // V1 demo kept for reference
  {
    path: "/demo/gen-ui-v1",
    file: "features/generative-ui/pages/demo.tsx",
  },
];
