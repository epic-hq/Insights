/** @jsxImportSource react */
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

// Define supported languages directly since we're having import issues
const supportedLanguages = ["en"];

export function LanguageSwitcher() {
	const { i18n } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();

	const handleLanguageChange = (newLanguage: string) => {
		// Only proceed if the language is different
		if (newLanguage === i18n.language) return;

		// Parse the current search params
		const searchParams = new URLSearchParams(location.search);

		// Set or update the lng query parameter to match remix-i18next's default
		searchParams.set("lng", newLanguage);

		// Navigate to the same path but with updated query parameters
		navigate({
			pathname: location.pathname,
			search: searchParams.toString(),
			hash: location.hash,
		});
	};

	return (
		<div className="fixed top-2 right-4 z-50">
			<div className="flex items-center space-x-2">
				{supportedLanguages.map((lang) => (
					<button
						key={lang}
						onClick={() => handleLanguageChange(lang)}
						className={`rounded px-2 py-1 text-sm ${
							i18n.language === lang ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
						}`}
					>
						{lang.toUpperCase()}
					</button>
				))}
			</div>
		</div>
	);
}
