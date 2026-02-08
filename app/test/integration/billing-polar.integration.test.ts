import { beforeEach, describe, expect, it, vi } from "vitest";
import { loader as checkoutLoader } from "~/routes/api.billing.checkout";
import { loader as portalLoader } from "~/routes/api.billing.portal";
import { action as webhookAction } from "~/routes/api.webhooks.polar";

function createBuilder() {
	const state = {
		eqCalls: [] as Array<[string, unknown]>,
		inCalls: [] as Array<[string, unknown]>,
		updatePayloads: [] as Array<Record<string, unknown>>,
	};
	const maybeSingleQueue: Array<{ data: any; error: any }> = [];
	const singleQueue: Array<{ data: any; error: any }> = [];
	const updateQueue: Array<{ data?: any; error?: any }> = [];

	const builder: any = {
		select: vi.fn(() => builder),
		eq: vi.fn((key: string, value: unknown) => {
			state.eqCalls.push([key, value]);
			return builder;
		}),
		in: vi.fn((key: string, value: unknown) => {
			state.inCalls.push([key, value]);
			return builder;
		}),
		order: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		maybeSingle: vi.fn(async () => maybeSingleQueue.shift() ?? { data: null, error: null }),
		single: vi.fn(async () => singleQueue.shift() ?? { data: null, error: null }),
		update: vi.fn((payload: Record<string, unknown>) => {
			state.updatePayloads.push(payload);
			return {
				eq: vi.fn(async () => updateQueue.shift() ?? { data: null, error: null }),
			};
		}),
	};

	return {
		builder,
		state,
		maybeSingleQueue,
		singleQueue,
		updateQueue,
		reset: () => {
			state.eqCalls = [];
			state.inCalls = [];
			state.updatePayloads = [];
			maybeSingleQueue.length = 0;
			singleQueue.length = 0;
			updateQueue.length = 0;
			builder.select.mockClear();
			builder.eq.mockClear();
			builder.in.mockClear();
			builder.order.mockClear();
			builder.limit.mockClear();
			builder.maybeSingle.mockClear();
			builder.single.mockClear();
			builder.update.mockClear();
		},
	};
}

const mocks = vi.hoisted(() => {
	const mockPolar = {
		checkouts: { create: vi.fn() },
		subscriptions: { update: vi.fn() },
	};

	const mockBillingFns = {
		upsertBillingCustomer: vi.fn(),
		upsertBillingSubscription: vi.fn(),
		provisionPlanEntitlements: vi.fn(),
		grantPlanCredits: vi.fn(),
		revokeEntitlements: vi.fn(),
	};

	const accountUserBuilder = createBuilder();
	const billingSubsBuilder = createBuilder();
	const billingCustomersBuilder = createBuilder();

	const mockSupabaseAdmin = {
		schema: vi.fn(() => ({
			from: vi.fn((table: string) => {
				if (table === "account_user") return accountUserBuilder.builder;
				if (table === "billing_subscriptions") return billingSubsBuilder.builder;
				if (table === "billing_customers") return billingCustomersBuilder.builder;
				throw new Error(`Unexpected table: ${table}`);
			}),
		})),
	};

	const mockGetAuthenticatedUser = vi.fn();

	return {
		mockPolar,
		mockBillingFns,
		accountUserBuilder,
		billingSubsBuilder,
		billingCustomersBuilder,
		mockSupabaseAdmin,
		mockGetAuthenticatedUser,
	};
});

vi.mock("~/env.server", () => ({
	getServerEnv: () => ({
		APP_ENV: "sandbox",
		POLAR_ACCESS_TOKEN: "test-access-token",
		POLAR_WEBHOOK_SECRET: "whsec_test",
		POLAR_PRODUCT_STARTER_MONTHLY: "starter-month",
		POLAR_PRODUCT_STARTER_ANNUAL: "starter-annual",
		POLAR_PRODUCT_PRO_MONTHLY: "pro-month",
		POLAR_PRODUCT_PRO_ANNUAL: "pro-annual",
		POLAR_PRODUCT_TEAM_MONTHLY: "team-month",
		POLAR_PRODUCT_TEAM_ANNUAL: "team-annual",
	}),
}));

vi.mock("@polar-sh/sdk", () => ({
	Polar: vi.fn(() => mocks.mockPolar),
}));

vi.mock("@polar-sh/hono", () => ({
	Webhooks:
		(handlers: {
			onSubscriptionUpdated?: (payload: any) => Promise<void>;
			onSubscriptionActive?: (payload: any) => Promise<void>;
			onSubscriptionCanceled?: (payload: any) => Promise<void>;
			[key: string]: any;
		}) =>
		async (ctx: any) => {
			const payload = await ctx.req.json();
			const data = payload?.data;
			if (data?.currentPeriodStart && typeof data.currentPeriodStart === "string") {
				data.currentPeriodStart = new Date(data.currentPeriodStart);
			}
			if (data?.currentPeriodEnd && typeof data.currentPeriodEnd === "string") {
				data.currentPeriodEnd = new Date(data.currentPeriodEnd);
			}
			if (data?.canceledAt && typeof data.canceledAt === "string") {
				data.canceledAt = new Date(data.canceledAt);
			}
			if (data?.endedAt && typeof data.endedAt === "string") {
				data.endedAt = new Date(data.endedAt);
			}
			if (data?.trialStart && typeof data.trialStart === "string") {
				data.trialStart = new Date(data.trialStart);
			}
			if (data?.trialEnd && typeof data.trialEnd === "string") {
				data.trialEnd = new Date(data.trialEnd);
			}
			switch (payload.type) {
				case "subscription.updated":
					await handlers.onSubscriptionUpdated?.(payload);
					break;
				case "subscription.active":
					await handlers.onSubscriptionActive?.(payload);
					break;
				case "subscription.canceled":
					await handlers.onSubscriptionCanceled?.(payload);
					break;
				default:
					break;
			}
			return ctx.text("OK", 200);
		},
}));

vi.mock("~/lib/billing/polar.server", () => mocks.mockBillingFns);

vi.mock("~/lib/posthog.server", () => ({
	getPostHogServerClient: () => null,
}));

vi.mock("~/lib/supabase/client.server", () => ({
	supabaseAdmin: mocks.mockSupabaseAdmin,
	getAuthenticatedUser: mocks.mockGetAuthenticatedUser,
}));

const buildRequest = (url: string) => new Request(url);

const buildWebhookRequest = (payload: unknown) =>
	new Request("http://localhost/api/webhooks/polar", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"webhook-id": "wh_123",
			"webhook-timestamp": "123",
			"webhook-signature": "sig",
		},
		body: JSON.stringify(payload),
	});

beforeEach(() => {
	mocks.accountUserBuilder.reset();
	mocks.billingSubsBuilder.reset();
	mocks.billingCustomersBuilder.reset();
	mocks.mockPolar.checkouts.create.mockReset();
	mocks.mockPolar.subscriptions.update.mockReset();
	Object.values(mocks.mockBillingFns).forEach((fn) => fn.mockReset());
	mocks.mockGetAuthenticatedUser.mockReset();
});

describe("Billing checkout", () => {
	it("rejects checkout when user is not an owner", async () => {
		mocks.mockGetAuthenticatedUser.mockResolvedValue({
			user: { sub: "user-1", email: "user@example.com" },
			headers: new Headers(),
		});
		mocks.accountUserBuilder.maybeSingleQueue.push({ data: null, error: null });

		const response = await checkoutLoader({
			request: buildRequest("http://localhost/api/billing/checkout?plan=starter"),
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("/pricing?error=owner_required");
		expect(mocks.accountUserBuilder.state.eqCalls).toContainEqual(["account_role", "owner"]);
	});

	it("creates a checkout session for owners", async () => {
		mocks.mockGetAuthenticatedUser.mockResolvedValue({
			user: { sub: "user-1", email: "user@example.com" },
			headers: new Headers(),
		});
		mocks.accountUserBuilder.maybeSingleQueue.push({
			data: { account_id: "acct_1" },
			error: null,
		});
		mocks.billingSubsBuilder.maybeSingleQueue.push({ data: null, error: null });
		mocks.mockPolar.checkouts.create.mockResolvedValue({ id: "chk_1", url: "https://checkout.test/1" });

		const response = await checkoutLoader({
			request: buildRequest("http://localhost/api/billing/checkout?plan=starter"),
		} as any);

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("https://checkout.test/1");
		expect(mocks.mockPolar.checkouts.create).toHaveBeenCalledWith(
			expect.objectContaining({
				products: ["starter-month"],
				metadata: expect.objectContaining({ account_id: "acct_1", user_id: "user-1", plan_id: "starter" }),
			})
		);
	});

	it("updates an existing subscription instead of creating checkout", async () => {
		mocks.mockGetAuthenticatedUser.mockResolvedValue({
			user: { sub: "user-1", email: "user@example.com" },
			headers: new Headers(),
		});
		mocks.accountUserBuilder.maybeSingleQueue.push({
			data: { account_id: "acct_1" },
			error: null,
		});
		mocks.billingSubsBuilder.maybeSingleQueue.push({
			data: { id: "sub_1", plan_name: "Starter", status: "active" },
			error: null,
		});
		mocks.billingSubsBuilder.updateQueue.push({ data: null, error: null });

		const response = await checkoutLoader({
			request: buildRequest("http://localhost/api/billing/checkout?plan=starter"),
		} as any);

		expect(response.status).toBe(302);
		expect(mocks.mockPolar.subscriptions.update).toHaveBeenCalledWith({
			id: "sub_1",
			subscriptionUpdate: { productId: "starter-month" },
		});
	});
});

describe("Billing portal", () => {
	it("rejects portal access when user is not an owner", async () => {
		mocks.mockGetAuthenticatedUser.mockResolvedValue({
			user: { sub: "user-1", email: "user@example.com" },
			headers: new Headers(),
		});
		mocks.accountUserBuilder.singleQueue.push({ data: null, error: { message: "No rows" } });

		const response = await portalLoader({ request: buildRequest("http://localhost/api/billing/portal") } as any);

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("/home?error=owner_required");
		expect(mocks.accountUserBuilder.state.eqCalls).toContainEqual(["account_role", "owner"]);
	});

	it("redirects owners to the Polar portal", async () => {
		mocks.mockGetAuthenticatedUser.mockResolvedValue({
			user: { sub: "user-1", email: "user@example.com" },
			headers: new Headers(),
		});
		mocks.accountUserBuilder.singleQueue.push({ data: { account_id: "acct_1" }, error: null });
		mocks.billingCustomersBuilder.singleQueue.push({ data: { id: "cust_1" }, error: null });

		const response = await portalLoader({ request: buildRequest("http://localhost/api/billing/portal") } as any);
		const location = response.headers.get("Location");

		expect(response.status).toBe(302);
		expect(location).toContain("https://sandbox.polar.sh/portal");
		expect(location).toContain("customer_id=cust_1");
	});
});

describe("Polar webhooks", () => {
	it("rejects missing webhook headers", async () => {
		const response = await webhookAction({
			request: new Request("http://localhost/api/webhooks/polar", { method: "POST" }),
		} as any);

		expect(response.status).toBe(400);
	});

	it("provisions entitlements and credits on plan change", async () => {
		mocks.mockBillingFns.upsertBillingSubscription.mockResolvedValue({ planId: "pro" });
		mocks.billingSubsBuilder.maybeSingleQueue.push({
			data: { price_id: "starter-month", current_period_start: "2025-01-01T00:00:00.000Z" },
			error: null,
		});

		const payload = {
			type: "subscription.updated",
			data: {
				id: "sub_1",
				status: "active",
				seats: 1,
				product: { id: "pro-month" },
				customer: { id: "cust_1", email: "owner@example.com" },
				metadata: { account_id: "acct_1" },
				currentPeriodStart: new Date("2025-02-01T00:00:00.000Z"),
				currentPeriodEnd: new Date("2025-03-01T00:00:00.000Z"),
			},
		};

		const response = await webhookAction({ request: buildWebhookRequest(payload) } as any);

		expect(response.status).toBe(200);
		expect(mocks.mockBillingFns.provisionPlanEntitlements).toHaveBeenCalledWith(
			expect.objectContaining({ accountId: "acct_1", planId: "pro" })
		);
		expect(mocks.mockBillingFns.grantPlanCredits).toHaveBeenCalledWith(
			expect.objectContaining({ accountId: "acct_1", planId: "pro" })
		);
	});

	it("does not revoke entitlements when cancellation is at period end", async () => {
		mocks.mockBillingFns.upsertBillingSubscription.mockResolvedValue({ planId: "starter" });

		const payload = {
			type: "subscription.canceled",
			data: {
				id: "sub_2",
				status: "canceled",
				cancelAtPeriodEnd: true,
				product: { id: "starter-month" },
				customer: { id: "cust_2", email: "owner@example.com" },
				metadata: { account_id: "acct_2" },
				currentPeriodStart: new Date("2025-02-01T00:00:00.000Z"),
				currentPeriodEnd: new Date("2025-03-01T00:00:00.000Z"),
				canceledAt: new Date("2025-02-15T00:00:00.000Z"),
			},
		};

		const response = await webhookAction({ request: buildWebhookRequest(payload) } as any);

		expect(response.status).toBe(200);
		expect(mocks.mockBillingFns.revokeEntitlements).not.toHaveBeenCalled();
	});

	it("revokes entitlements on immediate cancellation", async () => {
		mocks.mockBillingFns.upsertBillingSubscription.mockResolvedValue({ planId: "starter" });

		const payload = {
			type: "subscription.canceled",
			data: {
				id: "sub_3",
				status: "canceled",
				cancelAtPeriodEnd: false,
				product: { id: "starter-month" },
				customer: { id: "cust_3", email: "owner@example.com" },
				metadata: { account_id: "acct_3" },
				currentPeriodStart: new Date("2025-02-01T00:00:00.000Z"),
				currentPeriodEnd: new Date("2025-03-01T00:00:00.000Z"),
				canceledAt: new Date("2025-02-15T00:00:00.000Z"),
			},
		};

		const response = await webhookAction({ request: buildWebhookRequest(payload) } as any);

		expect(response.status).toBe(200);
		expect(mocks.mockBillingFns.revokeEntitlements).toHaveBeenCalledWith({ accountId: "acct_3" });
	});
});
