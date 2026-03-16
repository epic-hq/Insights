import Page from "./dashboard";

describe("Dashboard route", () => {
	it("renders the dashboard layout", async ({ renderStub }) => {
		const rendered = await renderStub({
			entries: [
				{
					id: "dashboard",
					path: "/dashboard",
					Component: Page,
				},
			],
		});

		expect(rendered.container.textContent).toContain("Building Your Application");
		expect(rendered.container.textContent).toContain("Data Fetching");
	});
});
