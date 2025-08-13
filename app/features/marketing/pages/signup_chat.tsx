import { Timeline } from "~/components/ui/timeline"
import "./timeline.css"

interface TimelineItem {
	id: string
	title: string
	description: string
	timestamp: Date
	status: "completed" | "active" | "pending"
}

export default function SignupChat() {
	const items: TimelineItem[] = [
		{
			id: "1",
			title: "SignUp Completed",
			description: "Let's get to know you",
			timestamp: new Date("2024-01-15T09:00:00"),
			status: "completed",
		},
		{
			id: "2",
			title: "Under Review",
			description: "Reviewing your app",
			timestamp: new Date("2024-02-01T10:30:00"),
			status: "active",
		},
		{
			id: "3",
			title: "Something great!!",
			description: "You'll hear from us soon",
			timestamp: new Date("2024-02-15T14:00:00"),
			status: "pending",
		},
	]

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-black dark:bg-black dark:text-slate-100">
			<div className=" font-bold text-2xl text-blue-500">Thanks for joining UpSight!</div>
			<div className="rounded-lg bg-gray-900 p-8 shadow-lg dark:bg-gray-800">
				<Timeline
					items={items}
					variant="compact"
					showConnectors={false}
					showTimestamps={false}
					className="text-blue-500 dark:text-blue-500"
				/>
				{/* <h1 className="text-center text-3xl text-white dark:text-white">Signup Chat</h1> */}
			</div>
		</div>
	)
}
