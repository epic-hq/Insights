import type { AppLoadContext as BaseAppLoadContext } from "react-router";
import type { TFunction } from "i18next";
import type { ClientEnvVars } from "~/env.server";

interface ServerEnv {
	APP_ENV: string;
	// Add other environment variables as needed
}

declare module "react-router" {
	interface AppLoadContext extends BaseAppLoadContext {
		/** Current language code (e.g., 'en', 'es') */
		lang: string;

		/** i18next translation function */
		t: TFunction;

		/** Whether the app is running in production mode */
		isProductionDeployment: boolean;

		/** Server-side environment variables */
		env: ServerEnv;

		/** Client-side environment variables */
		clientEnv: ClientEnvVars;
	}
}
