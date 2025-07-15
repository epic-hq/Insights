import { RemixI18Next } from "remix-i18next/server"
import i18n from "~/localization/i18n" // your i18n configuration file
import { resources } from "./resource"

const i18next = new RemixI18Next({
	detection: {
		supportedLanguages: i18n.supportedLngs,
		fallbackLanguage: i18n.fallbackLng,
		// Use searchParams for query parameter detection
		order: ['searchParams', 'cookie', 'header']
		// Note: 'searchParams' is the correct property name for remix-i18next
		// The query parameter name defaults to 'lng'
	},
	// This is the configuration for i18next used
	// when translating messages server-side only
	i18next: {
		...i18n,
		resources,
	},
})

export default i18next
