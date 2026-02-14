import { type RouteConfig, route } from "@react-router/dev/routes";

export default [route("/api/tts", "./features/tts/api/tts.ts")] satisfies RouteConfig;
