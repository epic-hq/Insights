import type { Context } from "hono";
import type { TFunction } from "i18next";
import { type AppLoadContext, createContext, RouterContextProvider } from "react-router";
import { type ClientEnvVars, getClientEnv, getServerEnv, type ServerEnv } from "~/env.server";

export const getLoadContext = async (_c: Context) => {
	// get the locale from the context
	// const locale = i18next.getLocale(c)
	// get t function for the default namespace
	// const t = await i18next.getFixedT(c)
	// get the server environment
	const env = getServerEnv();

	const loadContextInstance = {
		// lang: locale,
		// t,
		isProductionDeployment: env.APP_ENV === "production",
		env,
		clientEnv: getClientEnv(),
		// We do not add this to AppLoadContext type because it's not needed in the loaders, but it's used above to handle requests
		// body: c.body,
	};

	const context = new RouterContextProvider();
	context.set(loadContext, loadContextInstance);

	return context;
};

declare module "react-router" {
	interface AppLoadContext {
		lang: string;
		t: TFunction;
		isProductionDeployment: boolean;
		env: ServerEnv;
		clientEnv: ClientEnvVars;
	}
}
interface LoadContext extends Awaited<ReturnType<typeof getLoadContext>> {}

export const loadContext = createContext<AppLoadContext>();

/**
 * Declare our loaders and actions context type
 */
declare module "react-router" {
	interface AppLoadContext extends Omit<LoadContext, "body"> {}
}
