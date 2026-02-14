/**
 * Admin page for detecting and fixing stuck interviews
 * Provides "now and forever" solution for stuck interview recovery
 */

import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { Route } from "./+types/stuck-interviews";

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const apiUrl = `${url.origin}/api/fix-stuck-interview`;

	const response = await fetch(apiUrl, {
		headers: {
			cookie: request.headers.get("cookie") || "",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch stuck interviews: ${response.statusText}`);
	}

	const data = await response.json();
	return data;
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");
	const interviewId = formData.get("interviewId");

	const url = new URL(request.url);
	const apiUrl = `${url.origin}/api/fix-stuck-interview`;

	if (intent === "fix-one") {
		const response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				cookie: request.headers.get("cookie") || "",
			},
			body: JSON.stringify({ interviewId }),
		});

		if (!response.ok) {
			const error = await response.json();
			return { success: false, error: error.error };
		}

		const result = await response.json();
		return { success: true, message: result.message };
	}

	if (intent === "fix-all") {
		const response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				cookie: request.headers.get("cookie") || "",
			},
			body: JSON.stringify({ fixAll: true }),
		});

		if (!response.ok) {
			const error = await response.json();
			return { success: false, error: error.error };
		}

		const result = await response.json();
		return { success: true, message: result.message, fixed: result.fixed };
	}

	return { success: false, error: "Invalid intent" };
}

export default function StuckInterviews({ loaderData }: Route.ComponentProps) {
	const data = loaderData as Awaited<ReturnType<typeof loader>>;
	const fetcher = useFetcher();
	const revalidator = useRevalidator();

	// Auto-refresh every 30 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			revalidator.revalidate();
		}, 30000);
		return () => clearInterval(interval);
	}, [revalidator]);

	const isLoading = fetcher.state !== "idle";
	const stuckCount = data.stuckInterviews?.length || 0;

	return (
		<div className="container mx-auto space-y-6 py-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-3xl">Stuck Interviews</h1>
					<p className="text-muted-foreground">Detect and fix interviews stuck in processing</p>
				</div>
				<Button variant="outline" size="sm" onClick={() => revalidator.revalidate()}>
					<RefreshCw className="mr-2 h-4 w-4" />
					Refresh
				</Button>
			</div>

			{/* Summary Card */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						{stuckCount > 0 ? (
							<>
								<AlertCircle className="h-5 w-5 text-orange-500" />
								{stuckCount} Stuck Interview{stuckCount !== 1 ? "s" : ""}
							</>
						) : (
							<>
								<CheckCircle className="h-5 w-5 text-green-500" />
								No Stuck Interviews
							</>
						)}
					</CardTitle>
					<CardDescription>
						{stuckCount > 0 ? (
							<>
								Found {stuckCount} interview{stuckCount !== 1 ? "s" : ""} that may be stuck. Click "Fix All" to restart
								processing.
							</>
						) : (
							<>All interviews are processing normally. Auto-refreshing every 30 seconds.</>
						)}
					</CardDescription>
				</CardHeader>
				{stuckCount > 0 && (
					<CardContent>
						<fetcher.Form method="post">
							<input type="hidden" name="intent" value="fix-all" />
							<Button type="submit" disabled={isLoading}>
								{isLoading ? "Fixing..." : "Fix All"}
							</Button>
						</fetcher.Form>
					</CardContent>
				)}
			</Card>

			{/* Action Result */}
			{fetcher.data && (
				<Card className={fetcher.data.success ? "border-green-500" : "border-destructive"}>
					<CardContent className="pt-6">
						<p className={fetcher.data.success ? "text-green-600" : "text-destructive"}>
							{fetcher.data.success ? (
								<>
									✓ {fetcher.data.message}
									{fetcher.data.fixed && ` (${fetcher.data.fixed} fixed)`}
								</>
							) : (
								<>✗ {fetcher.data.error}</>
							)}
						</p>
					</CardContent>
				</Card>
			)}

			{/* Stuck Interviews Table */}
			{stuckCount > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Stuck Interviews</CardTitle>
						<CardDescription>Interviews that are stuck in processing without active Trigger.dev tasks</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Interview ID</TableHead>
									<TableHead>Project</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Has Transcript</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.stuckInterviews.map((interview: any) => (
									<TableRow key={interview.id}>
										<TableCell className="font-mono text-xs">{interview.id.slice(0, 8)}...</TableCell>
										<TableCell>{interview.project_name || "—"}</TableCell>
										<TableCell>
											<Badge variant="outline">{interview.status}</Badge>
										</TableCell>
										<TableCell>
											{interview.transcript_id ? (
												<Badge variant="default">Yes</Badge>
											) : (
												<Badge variant="secondary">No</Badge>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{new Date(interview.created_at).toLocaleString()}
										</TableCell>
										<TableCell>
											<fetcher.Form method="post" className="inline">
												<input type="hidden" name="intent" value="fix-one" />
												<input type="hidden" name="interviewId" value={interview.id} />
												<Button variant="outline" size="sm" type="submit" disabled={isLoading}>
													Restart
												</Button>
											</fetcher.Form>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{/* Detection Criteria */}
			<Card>
				<CardHeader>
					<CardTitle>Detection Criteria</CardTitle>
					<CardDescription>How we identify stuck interviews</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<p>An interview is considered "stuck" if:</p>
					<ul className="ml-6 list-disc space-y-1 text-muted-foreground">
						<li>Status is "processing" or "uploaded"</li>
						<li>No active Trigger.dev run in the last 5 minutes</li>
						<li>Created more than 5 minutes ago</li>
					</ul>
					<p className="pt-2">Fix actions will:</p>
					<ul className="ml-6 list-disc space-y-1 text-muted-foreground">
						<li>Mark as "ready" if transcript exists</li>
						<li>Mark as "error" if no transcript</li>
						<li>Restart processing where it left off</li>
					</ul>
				</CardContent>
			</Card>
		</div>
	);
}
