import { Memory } from "@mastra/memory";
import { getSharedPostgresStore } from "./storage/postgres-singleton";

export const memory = new Memory({
	storage: getSharedPostgresStore(),
})