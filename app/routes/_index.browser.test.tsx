import * as Module from "./_index"

describe("Home route", () => {
	it("should render the dashboard component with data from the loader", async ({ renderStub }) => {
		const { getByText } = await renderStub({
			entries: [
				{
					id: "home",
					path: "/",
					Component: Module.default,
					loader: Module.loader,
				},
			],
		})

		// Check for text that is actually in the Dashboard component
		expect(getByText("Total Interviews")).not.toBeNull()
		expect(getByText("Insights Generated")).not.toBeNull()
	})

	it("should render the dashboard with explicit language set", async ({ renderStub }) => {
		const { getByText } = await renderStub({
			entries: [
				{
					id: "home",
					path: "/",
					Component: Module.default,
					loader: Module.loader,
				},
			],
			i18n: {
				lng: "en",
			},
		})

		// Check for text that is actually in the Dashboard component
		expect(getByText("Themes Identified")).not.toBeNull()
	})
})
