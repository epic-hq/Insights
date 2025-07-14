import { consola } from "consola"

/** Detect Remix “browser” bundle */
const isBrowser = typeof window !== "undefined"

export const log = consola.withTag(isBrowser ? "client" : "server")
