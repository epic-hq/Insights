/**
 * InterviewTasks — persistent tasks section for the interview detail page.
 * Shows linked tasks and uses the full TaskCreateModal for creating new tasks.
 */
import { Briefcase, Plus } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { TaskCreateModal } from "~/features/tasks/components/TaskCreateModal";

interface TaskItem {
	id: string;
	title: string;
	status: string;
	due_date: string | null;
}

interface InterviewTasksProps {
	tasks: TaskItem[];
	routes: {
		tasks: {
			detail: (id: string) => string;
			index: () => string;
		};
	};
}

export function InterviewTasks({ tasks, routes }: InterviewTasksProps) {
	return (
		<div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Briefcase className="h-5 w-5 text-amber-500" />
					<h3 className="font-semibold text-base text-foreground">Tasks</h3>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant="secondary">{tasks.length}</Badge>
					<TaskCreateModal
						extraFormFields={{ intent: "create-task" }}
						trigger={
							<Button variant="ghost" size="icon" className="h-7 w-7">
								<Plus className="h-4 w-4" />
							</Button>
						}
					/>
				</div>
			</div>

			{tasks.length > 0 && (
				<div className="space-y-2">
					{tasks.slice(0, 6).map((task) => (
						<div
							key={task.id}
							className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2"
						>
							<div className="min-w-0">
								<Link
									to={routes.tasks.detail(task.id)}
									className="line-clamp-1 font-medium text-foreground text-sm hover:text-primary"
								>
									{task.title}
								</Link>
								<div className="mt-1 flex items-center gap-2 text-muted-foreground text-xs">
									<span className="uppercase tracking-wide">{task.status.replaceAll("_", " ")}</span>
									{task.due_date ? (
										<span>Due {new Date(task.due_date).toLocaleDateString()}</span>
									) : (
										<span>No due date</span>
									)}
								</div>
							</div>
						</div>
					))}
					{tasks.length > 6 && (
						<Link to={routes.tasks.index()} className="text-primary text-xs hover:underline">
							View all tasks
						</Link>
					)}
				</div>
			)}
		</div>
	);
}
