/**
 * Fix account issues for users who signed up via invite link
 *
 * This script:
 * 1. Checks if user has their own team account (not just invited teams)
 * 2. Creates team account if missing
 * 3. Provisions trial if not provisioned
 *
 * Usage:
 *   npx tsx scripts/fix-invited-user-account.ts <email>
 *   npx tsx scripts/fix-invited-user-account.ts jamesviper07@yahoo.com
 */

import { createClient } from "@supabase/supabase-js";
import consola from "consola";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
	consola.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
	auth: { persistSession: false },
});

async function main() {
	const email = process.argv[2];
	if (!email) {
		consola.error("Usage: npx tsx scripts/fix-invited-user-account.ts <email>");
		process.exit(1);
	}

	consola.info(`\n🔍 Analyzing account for: ${email}\n`);

	// 1. Find user in auth.users (via admin listUsers with filter)
	const { data: userList, error: authError } = await supabase.auth.admin.listUsers({
		filter: `email.eq.${email}`,
	});

	const authUser = userList?.users?.[0];
	if (authError || !authUser) {
		consola.error(`User not found: ${email}`, authError);
		process.exit(1);
	}

	const userId = authUser.id;
	consola.info(`✅ Found user: ${userId}`);
	consola.info(`   Created: ${authUser.created_at}`);

	// 2. Get user_settings
	const { data: settings } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();

	consola.info("\n📋 User Settings:");
	consola.info(`   legacy_trial_provisioned_at: ${settings?.legacy_trial_provisioned_at || "NOT SET"}`);
	consola.info(`   onboarding_completed: ${settings?.onboarding_completed || false}`);

	// 3. Get all accounts the user is associated with
	const { data: accountUsers } = await supabase
		.schema("accounts")
		.from("account_user")
		.select(
			`
			account_id,
			account_role,
			accounts!inner (
				id,
				name,
				slug,
				personal_account,
				primary_owner_user_id,
				plan_id,
				created_at
			)
		`
		)
		.eq("user_id", userId);

	consola.info("\n🏢 Account Memberships:");
	if (!accountUsers?.length) {
		consola.warn("   No accounts found!");
	} else {
		for (const au of accountUsers) {
			const acc = au.accounts as any;
			const isOwner = acc.primary_owner_user_id === userId;
			const icon = acc.personal_account ? "👤" : "👥";
			consola.info(`   ${icon} ${acc.name || "(unnamed)"} [${au.account_role}]`);
			consola.info(`      ID: ${acc.id}`);
			consola.info(`      Type: ${acc.personal_account ? "Personal" : "Team"}`);
			consola.info(`      Owner: ${isOwner ? "YES (primary)" : "No (invited)"}`);
			consola.info(`      Plan: ${acc.plan_id || "free"}`);
			consola.info(`      Created: ${acc.created_at}`);
		}
	}

	// 4. Check for owned team account
	const ownedTeams = accountUsers?.filter(
		(au) => !(au.accounts as any).personal_account && (au.accounts as any).primary_owner_user_id === userId
	);

	const invitedTeams = accountUsers?.filter(
		(au) => !(au.accounts as any).personal_account && (au.accounts as any).primary_owner_user_id !== userId
	);

	consola.info("\n📊 Summary:");
	consola.info(`   Owned teams: ${ownedTeams?.length || 0}`);
	consola.info(`   Invited teams: ${invitedTeams?.length || 0}`);

	// 5. Check subscriptions
	const accountIds = accountUsers?.map((au) => au.account_id) || [];
	const { data: subscriptions } = await supabase
		.schema("accounts")
		.from("billing_subscriptions")
		.select("*")
		.in("account_id", accountIds);

	consola.info("\n💳 Subscriptions:");
	if (!subscriptions?.length) {
		consola.warn("   No subscriptions found");
	} else {
		for (const sub of subscriptions) {
			consola.info(`   Account: ${sub.account_id}`);
			consola.info(`   Plan: ${sub.plan_name} (${sub.status})`);
			consola.info(`   Trial ends: ${sub.trial_end || "N/A"}`);
		}
	}

	// 6. Diagnose issues
	consola.info("\n🔧 Diagnosis:");

	const issues: string[] = [];

	if (!ownedTeams?.length) {
		issues.push("MISSING_OWNED_TEAM: User has no owned team account");
	}

	if (!settings?.legacy_trial_provisioned_at && !subscriptions?.length) {
		issues.push("NO_TRIAL: User has no trial or subscription");
	}

	if (ownedTeams?.length) {
		const ownedTeamId = (ownedTeams[0].accounts as any).id;
		const hasSubOnOwnedTeam = subscriptions?.some((s) => s.account_id === ownedTeamId);
		if (!hasSubOnOwnedTeam) {
			issues.push("OWNED_TEAM_NO_SUB: Owned team has no subscription/trial");
		}
	}

	if (!issues.length) {
		consola.success("   No issues detected!");
		return;
	}

	for (const issue of issues) {
		consola.warn(`   ⚠️  ${issue}`);
	}

	// 7. Apply fixes
	consola.info("\n🔨 Applying fixes...");

	// Fix: Create owned team if missing
	if (issues.includes("MISSING_OWNED_TEAM")) {
		const userName = email.split("@")[0];
		consola.info("   Creating team account for user...");

		// Create team account
		const { data: newAccount, error: createError } = await supabase
			.schema("accounts")
			.from("accounts")
			.insert({
				name: userName,
				slug: null, // Will be auto-generated or can be null
				personal_account: false,
				primary_owner_user_id: userId,
			})
			.select()
			.single();

		if (createError) {
			consola.error("   Failed to create team account:", createError);
		} else {
			consola.success(`   ✅ Created team account: ${newAccount.id}`);

			// Add user as owner
			const { error: auError } = await supabase.schema("accounts").from("account_user").insert({
				account_id: newAccount.id,
				user_id: userId,
				account_role: "owner",
			});

			if (auError) {
				consola.error("   Failed to add user to team:", auError);
			} else {
				consola.success("   ✅ Added user as owner");
			}
		}
	}

	// Fix: Provision trial on owned team
	if (issues.includes("OWNED_TEAM_NO_SUB") || issues.includes("NO_TRIAL")) {
		// Re-fetch owned teams after potential creation
		const { data: refreshedAccountUsers } = await supabase
			.schema("accounts")
			.from("account_user")
			.select(
				`
				account_id,
				accounts!inner (
					id,
					personal_account,
					primary_owner_user_id
				)
			`
			)
			.eq("user_id", userId);

		const ownedTeam = refreshedAccountUsers?.find(
			(au) => !(au.accounts as any).personal_account && (au.accounts as any).primary_owner_user_id === userId
		);

		if (ownedTeam) {
			const accountId = ownedTeam.account_id;

			// Check if already has subscription
			const { data: existingSub } = await supabase
				.schema("accounts")
				.from("billing_subscriptions")
				.select("id")
				.eq("account_id", accountId)
				.maybeSingle();

			if (!existingSub) {
				consola.info("   Provisioning Pro trial on owned team...");

				// Create trial subscription (14 days)
				const trialEnd = new Date();
				trialEnd.setDate(trialEnd.getDate() + 14);

				const { error: subError } = await supabase.schema("accounts").from("billing_subscriptions").insert({
					account_id: accountId,
					plan_name: "pro",
					status: "trialing",
					trial_end: trialEnd.toISOString(),
				});

				if (subError) {
					consola.error("   Failed to create trial:", subError);
				} else {
					consola.success(`   ✅ Created Pro trial (ends ${trialEnd.toISOString()})`);

					// Update account plan_id
					await supabase.schema("accounts").from("accounts").update({ plan_id: "pro" }).eq("id", accountId);

					// Mark trial as provisioned
					await supabase.from("user_settings").upsert(
						{
							user_id: userId,
							legacy_trial_provisioned_at: new Date().toISOString(),
						},
						{ onConflict: "user_id" }
					);

					consola.success("   ✅ Marked trial as provisioned");
				}
			}
		}
	}

	consola.info("\n✨ Done!");
}

main().catch((err) => {
	consola.error("Script failed:", err);
	process.exit(1);
});
