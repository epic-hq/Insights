import { useSearchParams } from "react-router"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export default function Page() {
	const [searchParams] = useSearchParams()

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-2xl">Sorry, something went wrong.</CardTitle>
						</CardHeader>
						<CardContent>
							{searchParams?.get("error") ? (
								<p className="text-muted-foreground text-sm">Code error: {searchParams?.get("error")}</p>
							) : (
								<p className="text-muted-foreground text-sm">An unspecified error occurred.</p>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}
