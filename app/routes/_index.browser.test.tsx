import Page from "./dashboard";

describe("Dashboard route", () => {
	it("renders the dashboard layout", async ({ renderStub }) => {
		const { getByText } = await renderStub({
			entries: [
				{
					id: "dashboard",
					path: "/dashboard",
					Component: Page,
				},
			],
		});

		expect(getByText("Building Your Application")).not.toBeNull();
		expect(getByText("Data Fetching")).not.toBeNull();
	});
});
