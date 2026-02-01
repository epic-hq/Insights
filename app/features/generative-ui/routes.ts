/**
 * Generative UI Routes
 *
 * Demo route to showcase PoC components
 */

import type { RouteConfig } from "@react-router/dev/routes";

export const generativeUIRoutes: RouteConfig[] = [
  {
    path: "/demo/gen-ui",
    file: "features/generative-ui/pages/demo-live.tsx",
  },
  // Other demos
  {
    path: "/demo/gen-ui-live",
    file: "features/generative-ui/pages/demo-live.tsx",
  },
  {
    path: "/demo/gen-ui-v2",
    file: "features/generative-ui/pages/demo-v2.tsx",
  },
  {
    path: "/demo/gen-ui-v1",
    file: "features/generative-ui/pages/demo.tsx",
  },
];
