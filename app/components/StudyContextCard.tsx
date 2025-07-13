interface StudyContextProps {
	researchGoal: string
	studyCode: string
	recruitmentChannel: string
	scriptVersion: string
	className?: string
}

export default function StudyContextCard({
	researchGoal,
	studyCode,
	recruitmentChannel,
	scriptVersion,
	className,
}: StudyContextProps) {
	return (
		<div className={`max-w-xl space-y-2 rounded-lg border bg-white p-6 shadow dark:bg-gray-900 ${className ?? ""}`}>
			<h3 className="mb-2 font-semibold text-lg">Study Context</h3>
			<div className="text-sm">
				<span className="font-medium">Research Goal:</span> {researchGoal}
			</div>
			<div className="text-sm">
				<span className="font-medium">Study Code / Folder:</span> {studyCode}
			</div>
			<div className="text-sm">
				<span className="font-medium">Recruitment Channel:</span> {recruitmentChannel}
			</div>
			<div className="text-sm">
				<span className="font-medium">Script Version:</span> {scriptVersion}
			</div>
		</div>
	)
}
