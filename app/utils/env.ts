// This will return the process.env on the server and window.env on the client
export const polyEnv = typeof process !== "undefined" ? process.env : (window as { env?: Record<string, string | undefined> }).env;
