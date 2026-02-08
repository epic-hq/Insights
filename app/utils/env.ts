// This will return the process.env on the server and window.env on the client
export const polyEnv =
	typeof process !== "undefined" ? process.env : (window as { env?: Record<string, string | undefined> }).env;

// Helper to get NODE_ENV from either server or client
export const getNodeEnv = () => polyEnv?.NODE_ENV || "development";

// Helper to check if we're in production
export const isProduction = () => getNodeEnv() === "production";

// Helper to check if we're in development
export const isDevelopment = () => getNodeEnv() === "development";
