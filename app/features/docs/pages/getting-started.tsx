import { ArrowLeft, CheckCircle2, Zap } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function GettingStarted() {
	return (
		<div className="container mx-auto max-w-4xl px-4 py-12">
			<Link to="/docs">
				<Button variant="ghost" size="sm" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Docs
				</Button>
			</Link>

			<h1 className="mb-4 font-bold text-4xl tracking-tight">Getting Started</h1>
			<p className="mb-8 text-lg text-muted-foreground">
				Everything you need to set up your first research project and start gathering insights
			</p>

			<div className="space-y-8">
				{/* Step 1 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
								1
							</span>
							Create Your Project
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground">
							Start by creating a new project from your dashboard. Give it a clear name that describes what you're
							researching.
						</p>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Click "New Project" from your dashboard</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Enter a descriptive project name</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Invite team members if needed</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Step 2 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
								2
							</span>
							Set Up Your Research Project
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground">
							Use our AI-powered setup assistant (via chat or form) to define your research. Answer 8 key questions and
							our AI will automatically generate your complete research plan including decision questions, research
							questions, and interview prompts.
						</p>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Describe your business and customer problem</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Define your ideal customers and target roles</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Specify your offerings and competitors</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Set your research goal, unknowns, decisions, and assumptions</span>
							</div>
						</div>
						<div className="rounded-lg border-blue-500 border-l-4 bg-blue-50 p-3 dark:bg-blue-950/20">
							<p className="font-medium text-sm">💡 AI-Powered Setup</p>
							<p className="mt-1 text-muted-foreground text-sm">
								After you answer all 8 questions, our AI automatically generates a complete research plan with strategic
								decision questions, tactical research questions, and ready-to-use interview prompts—saving you hours of
								planning work.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Step 3 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
								3
							</span>
							Review Your Research Plan
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground">
							After setup, your AI-generated research plan is ready! Review the decision questions, research questions,
							and interview prompts. Customize them if needed—you're in full control.
						</p>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Review AI-generated decision questions (strategic goals)</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Check research questions (tactical interview focus areas)</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Review interview prompts (specific questions to ask)</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Refine or add custom questions as needed</span>
							</div>
						</div>
						<div className="rounded-lg border-green-500 border-l-4 bg-green-50 p-3 dark:bg-green-950/20">
							<p className="font-medium text-sm">✨ Smart Generation</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Questions are automatically linked: Interview prompts connect to research questions, which connect to
								decision questions—giving you a clear hierarchy from strategic goals down to specific interview
								questions.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Quick Survey Option */}
				<Card className="border-purple-200 bg-purple-50/50 dark:border-purple-900/30 dark:bg-purple-950/20">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
							Quick Option: Send a Survey Instead
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground">
							Don't have interviews yet? Skip straight to collecting feedback by creating an AI-powered survey. Our AI
							will help you design questions based on your research plan — just tell it what you want to learn.
						</p>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">
									Go to <strong>Ask</strong> in your project sidebar and create a new survey
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">
									Use <strong>AI-generated questions</strong> — describe your goal and the AI creates survey questions
									tied to your research plan
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">
									Choose a response mode: <strong>Form</strong> (standard), <strong>Chat</strong> (conversational AI),
									or <strong>Voice</strong> (spoken)
								</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Distribute via link, email, QR code, or embed on your website</span>
							</div>
						</div>
						<div className="rounded-lg border-purple-500 border-l-4 bg-purple-50 p-3 dark:bg-purple-950/30">
							<p className="font-medium text-sm">⚡ Fastest way to start collecting insights</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Surveys can start collecting responses in minutes. Read the{" "}
								<Link to="/docs/survey-distribution" className="text-primary underline">
									Survey Distribution guide
								</Link>{" "}
								for detailed setup and sharing options, or the{" "}
								<Link to="/docs/sending-surveys" className="text-primary underline">
									Email Distribution guide
								</Link>{" "}
								to send via Mailchimp or other email platforms.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Step 4 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
								4
							</span>
							Start Conducting Interviews
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground">
							Upload interview recordings or transcripts. Our AI will automatically extract insights and link them to
							your research questions.
						</p>
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Click "Add Interview" from the Connect section</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Upload audio, video, or text files</span>
							</div>
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
								<span className="text-sm">Wait for AI analysis (usually 2-5 minutes)</span>
							</div>
						</div>
						<div className="rounded-lg border-amber-500 border-l-4 bg-amber-50 p-3 dark:bg-amber-950/20">
							<p className="font-medium text-sm">⚡ Supported Formats</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Audio: MP3, WAV, M4A • Video: MP4, MOV • Text: TXT, MD, DOCX
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Next Steps */}
				<Card className="border-primary/20 bg-primary/5">
					<CardHeader>
						<CardTitle>Next Steps</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground">Once you've uploaded 5-10 interviews, you can:</p>
						<ul className="space-y-2 text-muted-foreground text-sm">
							<li className="flex items-start gap-2">
								<span className="text-primary">→</span>
								<span>
									<strong>Review auto-generated themes:</strong> Navigate to Themes page to see 3-7 strategic patterns
									automatically discovered from your evidence
								</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-primary">→</span>
								<span>
									<strong>Enrich themes:</strong> Click "Enrich Themes" to add pain points, jobs-to-be-done, and desired
									outcomes to each theme
								</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-primary">→</span>
								<span>
									<strong>Analyze segmentation:</strong> View which organizations and people mentioned each theme to
									identify persona-specific patterns
								</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-primary">→</span>
								<span>
									<strong>Validate with evidence:</strong> Drill into verbatim quotes to validate insights and gather
									customer voice for presentations
								</span>
							</li>
							<li className="flex items-start gap-2">
								<span className="text-primary">→</span>
								<span>Create opportunities based on discovered insights</span>
							</li>
						</ul>

						<div className="mt-4 rounded-lg border-blue-500 border-l-4 bg-blue-50 p-3 dark:bg-blue-950/20">
							<p className="font-medium text-sm">📚 Learn More</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Read the{" "}
								<Link to="/docs/analyzing-insights" className="text-primary underline">
									Analyzing Insights & Themes
								</Link>{" "}
								guide to understand how evidence extraction, theme generation, and enrichment work.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
