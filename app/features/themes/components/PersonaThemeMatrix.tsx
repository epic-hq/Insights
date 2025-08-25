import React, { useState } from "react"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Grid3X3, Users, TrendingUp, Info, Eye, Filter } from "lucide-react"

interface PersonaThemeMatrixProps {
	matrixData: Array<{
		persona: string
		themes: Array<{
			themeId: string
			themeName: string
			nEff: number
			coverage: number
			wedge: boolean
		}>
	}>
}

// Empty state component for when no matrix data is available
const EmptyMatrixState = () => (
	<div className="text-center py-16">
		<div className="mx-auto max-w-md">
			<div className="mb-6 flex justify-center">
				<div className="rounded-full bg-gray-100 p-6">
					<Grid3X3 className="h-12 w-12 text-gray-400" />
				</div>
			</div>
			<h3 className="font-semibold text-gray-900 text-xl mb-3">No persona-theme data available</h3>
			<p className="text-gray-600 mb-8">
				Upload interviews and create personas to see the relationship matrix between personas and themes.
			</p>
		</div>
	</div>
)

export function PersonaThemeMatrix({ matrixData }: PersonaThemeMatrixProps) {
	const [viewMode, setViewMode] = useState<"coverage" | "strength">("coverage")
	const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
	const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
	
	// Use provided data or fallback to mock data
	const data = matrixData.length > 0 ? matrixData : mockMatrixData
	
	// Extract unique themes from the data
	const themeSet = new Set<string>()
	for (const personaData of data) {
		for (const theme of personaData.themes) {
			themeSet.add(theme.themeName)
		}
	}
	const themes = Array.from(themeSet)

	const getCellColor = (value: number, isWedge: boolean, mode: "coverage" | "strength") => {
		if (isWedge) {
			return "bg-purple-100 border-purple-300 text-purple-900"
		}

		if (mode === "coverage") {
			if (value >= 0.8) return "bg-blue-100 border-blue-300 text-blue-900"
			if (value >= 0.6) return "bg-blue-50 border-blue-200 text-blue-800"
			if (value >= 0.4) return "bg-gray-100 border-gray-200 text-gray-700"
			return "bg-gray-50 border-gray-100 text-gray-500"
		} else {
			if (value >= 10) return "bg-green-100 border-green-300 text-green-900"
			if (value >= 7) return "bg-green-50 border-green-200 text-green-800"
			if (value >= 4) return "bg-yellow-50 border-yellow-200 text-yellow-700"
			return "bg-gray-50 border-gray-100 text-gray-500"
		}
	}

	const getCellValue = (themeData: any, mode: "coverage" | "strength") => {
		return mode === "coverage" ? themeData.coverage : themeData.nEff
	}

	const formatCellValue = (value: number, mode: "coverage" | "strength") => {
		return mode === "coverage" ? `${Math.round(value * 100)}%` : value.toFixed(1)
	}

	const getPersonaData = (persona: string) => {
		return data.find((p) => p.persona === persona)
	}

	const getThemeData = (themeName: string) => {
		return data.map((persona) => ({
			persona: persona.persona,
			...persona.themes.find((t) => t.themeName === themeName),
		}))
	}

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<div className="mb-8">
				<h1 className="text-3xl mb-2">Persona × Theme Matrix</h1>
				<p className="text-gray-600">
					Visualize theme coverage and strength across different personas to identify wedge opportunities.
				</p>
			</div>

			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
						<SelectTrigger className="w-48">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="coverage">Coverage View</SelectItem>
							<SelectItem value="strength">Strength View (N_eff)</SelectItem>
						</SelectContent>
					</Select>

					<div className="flex items-center gap-2 text-sm text-gray-600">
						<Info className="w-4 h-4" />
						<span>Purple cells indicate strong wedge opportunities</span>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm">
						<Eye className="w-4 h-4 mr-2" />
						View Details
					</Button>
					<Button variant="outline" size="sm">
						<Filter className="w-4 h-4 mr-2" />
						Filter
					</Button>
				</div>
			</div>

			{/* Matrix Grid */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Grid3X3 className="w-5 h-5" />
						{viewMode === "coverage" ? "Coverage Matrix" : "Strength Matrix (N_eff)"}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr>
									<th className="text-left p-3 border-b">Persona</th>
									{themes.map((theme) => (
										<th
											key={theme}
											className="text-left p-3 border-b cursor-pointer hover:bg-gray-50"
											onClick={() => setSelectedTheme(selectedTheme === theme ? null : theme)}
										>
											{theme}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{data.map((personaData) => (
									<tr
										key={personaData.persona}
										className={`hover:bg-gray-50 ${selectedPersona === personaData.persona ? "bg-blue-50" : ""}`}
									>
										<td
											className="p-3 border-b font-medium cursor-pointer"
											onClick={() =>
												setSelectedPersona(selectedPersona === personaData.persona ? null : personaData.persona)
											}
										>
											{personaData.persona}
										</td>
										{themes.map((themeName) => {
											const themeData = personaData.themes.find((t) => t.themeName === themeName)
											if (!themeData)
												return (
													<td key={themeName} className="p-3 border-b">
														-
													</td>
												)

											const value = getCellValue(themeData, viewMode)
											const colorClass = getCellColor(value, themeData.wedge, viewMode)

											return (
												<td key={themeName} className="p-3 border-b">
													<div className={`inline-flex items-center px-3 py-2 rounded-lg border ${colorClass}`}>
														<span className="font-medium">{formatCellValue(value, viewMode)}</span>
														{themeData.wedge && (
															<Badge
																variant="outline"
																className="ml-2 text-xs bg-purple-600 text-white border-purple-600"
															>
																Wedge
															</Badge>
														)}
													</div>
												</td>
											)
										})}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>

			{/* Legend and Stats */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Legend</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-center gap-3">
							<div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
							<span className="text-sm">
								<strong>Wedge Opportunity:</strong> Strong, concentrated signal within this persona
							</span>
						</div>

						{viewMode === "coverage" ? (
							<>
								<div className="flex items-center gap-3">
									<div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
									<span className="text-sm">High Coverage (80%+)</span>
								</div>
								<div className="flex items-center gap-3">
									<div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
									<span className="text-sm">Medium Coverage (60-80%)</span>
								</div>
								<div className="flex items-center gap-3">
									<div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
									<span className="text-sm">Low Coverage (40-60%)</span>
								</div>
							</>
						) : (
							<>
								<div className="flex items-center gap-3">
									<div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
									<span className="text-sm">Strong Evidence (N_eff ≥ 10)</span>
								</div>
								<div className="flex items-center gap-3">
									<div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
									<span className="text-sm">Moderate Evidence (N_eff 7-10)</span>
								</div>
								<div className="flex items-center gap-3">
									<div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
									<span className="text-sm">Emerging Evidence (N_eff 4-7)</span>
								</div>
							</>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Key Insights</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="text-sm">
							<strong>Strongest Wedges:</strong>
							<ul className="mt-1 ml-4 space-y-1">
								<li>• Operations Managers → Manual inventory pain</li>
								<li>• Business Owners → Willingness to pay premium</li>
								<li>• Data Analysts → Data accuracy concerns</li>
							</ul>
						</div>

						<div className="text-sm">
							<strong>Cross-Persona Themes:</strong>
							<ul className="mt-1 ml-4 space-y-1">
								<li>• Manual inventory pain (broad but varying intensity)</li>
								<li>• Data accuracy concerns (critical for all technical roles)</li>
							</ul>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Selected Details */}
			{(selectedPersona || selectedTheme) && (
				<Card className="mt-6">
					<CardHeader>
						<CardTitle>
							{selectedPersona && `${selectedPersona} Details`}
							{selectedTheme && `${selectedTheme} Across Personas`}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{selectedPersona && (
							<div className="space-y-4">
								{getPersonaData(selectedPersona)?.themes.map((theme) => (
									<div key={theme.themeId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
										<div>
											<h4 className="font-medium">{theme.themeName}</h4>
											<p className="text-sm text-gray-600">
												Coverage: {Math.round(theme.coverage * 100)}% • Strength: {theme.nEff.toFixed(1)}
											</p>
										</div>
										{theme.wedge && <Badge className="bg-purple-600 text-white">Wedge</Badge>}
									</div>
								))}
							</div>
						)}

						{selectedTheme && (
							<div className="space-y-4">
								{getThemeData(selectedTheme).map((data) => (
									<div key={data.persona} className="flex items-center justify-between p-3 bg-gray-50 rounded">
										<div>
											<h4 className="font-medium">{data.persona}</h4>
											<p className="text-sm text-gray-600">
												Coverage: {Math.round((data.coverage || 0) * 100)}% • Strength: {(data.nEff || 0).toFixed(1)}
											</p>
										</div>
										{data.wedge && <Badge className="bg-purple-600 text-white">Wedge</Badge>}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	)
}
