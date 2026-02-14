import remixI18n from "./i18n.server";

describe("Remix I18n", () => {
	it("returns the correct default language from the request", async () => {
		const request = new Request("http://localhost:3000");
		const defaultLanguage = await remixI18n.getLocale(request);
		expect(defaultLanguage).toBe("en");
	});

	it("returns the correct default language from the request if search param lang is invalid", async () => {
		const request = new Request("http://localhost:3000?lng=invalid");
		const defaultLanguage = await remixI18n.getLocale(request);
		expect(defaultLanguage).toBe("en");
	});

	it("returns the default language when specified language in search params is not supported", async () => {
		const request = new Request("http://localhost:3000?lng=bs");
		const defaultLanguage = await remixI18n.getLocale(request);
		expect(defaultLanguage).toBe("en");
	});
});
