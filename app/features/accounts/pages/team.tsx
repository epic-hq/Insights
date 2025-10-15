import { ArrowLeft, BookOpen, Calendar, Code, Edit, Settings, Share, Trash2, Users } from "lucide-react"
import { useState } from "react"
import { PageContainer } from "~/components/layout/PageContainer"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

interface ResearchProject {
	id: string
	org_id: string
	code: string | null
	title: string
	description: string | null
	created_at: string
}

const mockProject: ResearchProject = {
	id: "1",
	org_id: "org-1",
	code: "RP-2024-001",
	title: "Machine Learning Applications in Healthcare",
	description:
		"This comprehensive research project explores the revolutionary potential of deep learning algorithms in medical image analysis and diagnostic assistance within radiology departments. Our team is investigating how artificial intelligence can enhance the accuracy and speed of medical diagnoses, particularly in the detection of anomalies in X-rays, MRIs, and CT scans. The project aims to develop a robust framework that can assist healthcare professionals in making more informed decisions while maintaining the highest standards of patient care and data privacy.",
	created_at: "2024-01-15T10:30:00Z",
}

export default function ProjectDetail() {
	const [project] = useState<ResearchProject>(mockProject)

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	return (
		<div className="min-h-screen bg-gray-50/50">
			<PageContainer size="lg" padded={false} className="max-w-5xl p-6">
				{/* Header */}
				<div className="mb-8">
					<div className="mb-6 flex items-center gap-4">
						<Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Projects
						</Button>
					</div>

					<div className="rounded-lg border border-gray-200 bg-white p-6">
						<div className="mb-4 flex items-start justify-between">
							<div className="flex-1">
								{project.code && (
									<Badge variant="secondary" className="mb-3 border-blue-200 bg-blue-50 text-blue-700">
										<Code className="mr-1 h-3 w-3" />
										{project.code}
									</Badge>
								)}
								<h1 className="mb-2 font-bold text-3xl text-gray-900">{project.title}</h1>
								<div className="flex items-center text-gray-500 text-sm">
									<Calendar className="mr-1 h-4 w-4" />
									Created on {formatDate(project.created_at)}
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm">
									<Share className="mr-2 h-4 w-4" />
									Share
								</Button>
								<Button variant="outline" size="sm">
									<Edit className="mr-2 h-4 w-4" />
									Edit
								</Button>
								<Button variant="outline" size="sm" className="bg-transparent text-red-600 hover:text-red-700">
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</Button>
							</div>
						</div>

						<Separator className="my-6" />

						<div className="space-y-4">
							<div>
								<h3 className="mb-2 font-semibold text-gray-900 text-lg">Description</h3>
								<p className="text-gray-700 leading-relaxed">
									{project.description || "No description provided for this project."}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Tabs Section */}
				<Tabs defaultValue="overview" className="space-y-6">
					<TabsList className="border border-gray-200 bg-white">
						<TabsTrigger value="overview" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
							<BookOpen className="mr-2 h-4 w-4" />
							Overview
						</TabsTrigger>
						<TabsTrigger value="team" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
							<Users className="mr-2 h-4 w-4" />
							Team
						</TabsTrigger>
						<TabsTrigger value="settings" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
							<Settings className="mr-2 h-4 w-4" />
							Settings
						</TabsTrigger>
					</TabsList>

					<TabsContent value="overview" className="space-y-6">
						<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
							<Card className="border-gray-200 bg-white">
								<CardHeader>
									<CardTitle className="text-lg">Project Information</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div>
										<label className="font-medium text-gray-500 text-sm">Project ID</label>
										<p className="font-mono text-gray-900 text-sm">{project.id}</p>
									</div>
									<div>
										<label className="font-medium text-gray-500 text-sm">Organization ID</label>
										<p className="font-mono text-gray-900 text-sm">{project.org_id}</p>
									</div>
									<div>
										<label className="font-medium text-gray-500 text-sm">Project Code</label>
										<p className="text-gray-900">{project.code || "Not assigned"}</p>
									</div>
								</CardContent>
							</Card>

							<Card className="border-gray-200 bg-white">
								<CardHeader>
									<CardTitle className="text-lg">Timeline</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div>
										<label className="font-medium text-gray-500 text-sm">Created</label>
										<p className="text-gray-900">{formatDate(project.created_at)}</p>
									</div>
									<div>
										<label className="font-medium text-gray-500 text-sm">Status</label>
										<Badge className="border-green-200 bg-green-50 text-green-700">Active</Badge>
									</div>
									<div>
										<label className="font-medium text-gray-500 text-sm">Last Updated</label>
										<p className="text-gray-900">2 hours ago</p>
									</div>
								</CardContent>
							</Card>
						</div>

						<Card className="border-gray-200 bg-white">
							<CardHeader>
								<CardTitle className="text-lg">Recent Activity</CardTitle>
								<CardDescription>Latest updates and changes to this project</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<div className="flex items-start gap-3">
										<div className="mt-2 h-2 w-2 rounded-full bg-blue-500" />
										<div>
											<p className="text-gray-900 text-sm">Project description updated</p>
											<p className="text-gray-500 text-xs">2 hours ago</p>
										</div>
									</div>
									<div className="flex items-start gap-3">
										<div className="mt-2 h-2 w-2 rounded-full bg-green-500" />
										<div>
											<p className="text-gray-900 text-sm">Project created</p>
											<p className="text-gray-500 text-xs">{formatDate(project.created_at)}</p>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="team">
						<Card className="border-gray-200 bg-white">
							<CardHeader>
								<CardTitle className="text-lg">Team Members</CardTitle>
								<CardDescription>People working on this research project</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-gray-500">Team management features coming soon...</p>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="settings">
						<Card className="border-gray-200 bg-white">
							<CardHeader>
								<CardTitle className="text-lg">Project Settings</CardTitle>
								<CardDescription>Configure project preferences and permissions</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-gray-500">Settings panel coming soon...</p>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</PageContainer>
		</div>
	)
}
