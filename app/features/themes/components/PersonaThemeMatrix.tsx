import { ArrowUpDown, Grid3X3, HelpCircle, Info } from "lucide-react"
import { useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

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
	<div className="py-16 text-center">
		<div className="mx-auto max-w-md">
			<div className="mb-6 flex justify-center">
				<div className="rounded-full bg-gray-100 p-6">
					<Grid3X3 className="h-12 w-12 text-gray-400" />
				</div>
			</div>
			<h3 className="mb-3 font-semibold text-gray-900 text-xl">No persona-theme data available</h3>
			<p className="mb-8 text-gray-600">
				Upload interviews and create personas to see the relationship matrix between personas and themes.
			</p>
		</div>
	</div>
)

export function PersonaThemeMatrix({ matrixData: rawMatrixData }: PersonaThemeMatrixProps) {
	const [viewMode, setViewMode] = useState<"coverage" | "strength">("coverage")
	const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
	const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
	const [swapAxes, setSwapAxes] = useState(true)

	// Use only provided data - no mock fallback
	const data = rawMatrixData || []

	// Show empty state if no data
	if (data.length === 0) {
		return <EmptyMatrixState />
	}

	// Extract unique themes and personas from the data
	const themeSet = new Set<string>()
	const personaSet = new Set<string>()
	for (const personaData of data) {
		personaSet.add(personaData.persona)
		for (const theme of personaData.themes) {
			themeSet.add(theme.themeName)
		}
	}
	const themes = Array.from(themeSet)
	const personas = Array.from(personaSet)

	// Create transposed data structure (theme → personas mapping)
	const transposedData = themes.map((themeName) => ({
		theme: themeName,
		personas: personas.map((personaName) => {
			const personaData = data.find((p) => p.persona === personaName)
			const themeData = personaData?.themes.find((t) => t.themeName === themeName)
			return {
				personaName,
				themeId: themeData?.themeId || "",
				nEff: themeData?.nEff || 0,
				coverage: themeData?.coverage || 0,
				wedge: themeData?.wedge || false,
			}
		}),
	}))

	// Determine current orientation data
	const isTransposed = swapAxes
	const _currentMatrixData = isTransposed ? transposedData : data

	const getCellColor = (value: number, isWedge: boolean, mode: "coverage" | "strength") => {
		if (isWedge) {
			return "bg-purple-100 border-purple-300 text-purple-900"
		}

		if (mode === "coverage") {
			if (value >= 0.8) return "bg-blue-100 border-blue-300 text-blue-900"
			if (value >= 0.6) return "bg-blue-50 border-blue-200 text-blue-800"
			if (value >= 0.4) return "bg-gray-100 border-gray-200 text-gray-700"
			return "bg-gray-50 border-gray-100 text-gray-500"
		}
		if (value >= 10) return "bg-green-100 border-green-300 text-green-900"
		if (value >= 7) return "bg-green-50 border-green-200 text-green-800"
		if (value >= 4) return "bg-yellow-50 border-yellow-200 text-yellow-700"
		return "bg-gray-50 border-gray-100 text-gray-500"
	}

	const getCellValue = (themeData: { coverage: number; nEff: number }, mode: "coverage" | "strength") => {
		return mode === "coverage" ? themeData.coverage : themeData.nEff
	}

	const formatCellValue = (value: number, mode: "coverage" | "strength"): string | null => {
		if (value === 0) return "-"
		return mode === "coverage" ? `${Math.round(value * 100)}%` : value.toFixed(1)
	}

	const getPersonaData = (persona: string) => {
		return data.find((p: { persona: string }) => p.persona === persona)
	}

	const getThemeData = (themeName: string) => {
		return data.map(
			(persona: {
				persona: string
				themes: Array<{ themeName: string; coverage?: number; nEff?: number; wedge?: boolean }>
			}) => ({
				persona: persona.persona,
				...persona.themes.find((t: { themeName: string }) => t.themeName === themeName),
			})
		)
	}

	return (
		<TooltipProvider>
			<div className="mx-auto max-w-7xl p-0">
				<div className="mb-4">
					<h1 className="mb-2 text-3xl">Persona × Theme Matrix</h1>
					<p className="text-foreground/60">
						See how themes appear across different user groups. Find opportunities where one group cares much more about
						a theme than others.
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

						<div className="flex items-center gap-4 text-foreground/60 text-sm">
							<Tooltip>
								<TooltipTrigger className="flex cursor-help items-center gap-2">
									<Info className="h-4 w-4" />
									<span>Coverage vs Strength</span>
									<HelpCircle className="h-3 w-3" />
								</TooltipTrigger>
								<TooltipContent className="max-w-sm">
									<div className="space-y-2">
										<p>
											<strong>Coverage:</strong> What percentage of interviews about this theme include this persona?
											High coverage means this theme affects most people in this group.
										</p>
										<p>
											<strong>Strength:</strong> How many pieces of evidence support this theme for this persona? Higher
											numbers mean stronger, more reliable patterns.
										</p>
										<p>
											<strong>Wedge:</strong> Purple cells show where one persona cares much more about a theme than
											others - these are your best opportunities!
										</p>
									</div>
								</TooltipContent>
							</Tooltip>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setSwapAxes(!swapAxes)}
							className="flex items-center gap-2"
						>
							<ArrowUpDown className="h-4 w-4" />
							Swap Axes
						</Button>
						{/* <Button variant="outline" size="sm">
							<Eye className="mr-2 h-4 w-4" />
							View Details
						</Button>
						<Button variant="outline" size="sm">
							<Filter className="mr-2 h-4 w-4" />
							Filter
						</Button> */}
					</div>
				</div>

				{/* Matrix Grid */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Grid3X3 className="h-5 w-5" />
							{viewMode === "coverage" ? "Coverage Matrix" : "Strength Matrix (N_eff)"}
							{isTransposed && <span className="font-normal text-gray-500 text-sm">(Themes × Personas)</span>}
							{!isTransposed && <span className="font-normal text-gray-500 text-sm">(Personas × Themes)</span>}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr>
										<th className="border-b p-3 text-left">{isTransposed ? "Theme" : "Persona"}</th>
										{(isTransposed ? personas : themes).map((header) => (
											<th
												key={header}
												className="cursor-pointer border-b p-3 text-left hover:bg-gray-50"
												onClick={() => {
													if (isTransposed) {
														setSelectedPersona(selectedPersona === header ? null : header)
													} else {
														setSelectedTheme(selectedTheme === header ? null : header)
													}
												}}
											>
												{header}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{isTransposed
										? // Transposed view: themes as rows, personas as columns
											transposedData.map((themeRow) => (
												<tr
													key={themeRow.theme}
													className={`hover:bg-gray-50 ${selectedTheme === themeRow.theme ? "bg-blue-50" : ""}`}
												>
													<td
														className="cursor-pointer border-b p-3 font-medium"
														onClick={() => setSelectedTheme(selectedTheme === themeRow.theme ? null : themeRow.theme)}
													>
														{themeRow.theme}
													</td>
													{themeRow.personas.map((personaCell) => {
														if (!personaCell.nEff && !personaCell.coverage)
															return (
																<td key={personaCell.personaName} className="border-b p-3">
																	-
																</td>
															)

														const value = getCellValue(personaCell, viewMode)
														const colorClass = getCellColor(value, personaCell.wedge, viewMode)

														return (
															<td key={personaCell.personaName} className="border-b p-3">
																<div className={`inline-flex items-center rounded-lg border px-3 py-2 ${colorClass}`}>
																	<span className="font-medium">{formatCellValue(value, viewMode)}</span>
																	{personaCell.wedge && (
																		<Badge
																			variant="outline"
																			className="ml-2 border-purple-600 bg-purple-600 text-white text-xs"
																		>
																			Wedge
																		</Badge>
																	)}
																</div>
															</td>
														)
													})}
												</tr>
											))
										: // Default view: personas as rows, themes as columns
											data.map(
												(personaData: {
													persona: string
													themes: Array<{
														themeId: string
														themeName: string
														nEff: number
														coverage: number
														wedge: boolean
													}>
												}) => (
													<tr
														key={personaData.persona}
														className={`hover:bg-gray-50 ${selectedPersona === personaData.persona ? "bg-blue-50" : ""}`}
													>
														<td
															className="cursor-pointer border-b p-3 font-medium"
															onClick={() =>
																setSelectedPersona(selectedPersona === personaData.persona ? null : personaData.persona)
															}
														>
															{personaData.persona}
														</td>
														{themes.map((themeName) => {
															const themeData = personaData.themes.find(
																(t: { themeName: string }) => t.themeName === themeName
															)
															if (!themeData)
																return (
																	<td key={themeName} className="border-b p-3">
																		-
																	</td>
																)

															const value = getCellValue(themeData, viewMode)
															const colorClass = getCellColor(value, themeData.wedge, viewMode)

															return (
																<td key={themeName} className="border-b p-3">
																	<div className={`inline-flex items-center rounded-lg border px-3 py-2 ${colorClass}`}>
																		<span className="font-medium">{formatCellValue(value, viewMode)}</span>
																		{themeData.wedge && (
																			<Badge
																				variant="outline"
																				className="ml-2 border-purple-600 bg-purple-600 text-white text-xs"
																			>
																				Wedge
																			</Badge>
																		)}
																	</div>
																</td>
															)
														})}
													</tr>
												)
											)}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>

				{/* Legend and Stats */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>How to Read This Matrix</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3">
								<div className="flex items-center gap-3">
									<div className="h-4 w-4 rounded border border-purple-300 bg-purple-100" />
									<span className="text-sm">
										<strong>Purple = Wedge Opportunity:</strong> This persona cares way more about this theme than
										others. Build for them first!
									</span>
								</div>

								{viewMode === "coverage" ? (
									<>
										<div className="mb-2 font-medium text-foreground text-sm">
											Coverage View - How widespread is this theme?
										</div>
										<div className="flex items-center gap-3">
											<div className="h-4 w-4 rounded border border-blue-300 bg-blue-100" />
											<span className="text-sm">80%+ of interviews mention this theme</span>
										</div>
										<div className="flex items-center gap-3">
											<div className="h-4 w-4 rounded border border-blue-200 bg-blue-50" />
											<span className="text-sm">60-80% mention it (common but not universal)</span>
										</div>
										<div className="flex items-center gap-3">
											<div className="h-4 w-4 rounded border border-gray-200 bg-gray-100" />
											<span className="text-sm">40-60% mention it (somewhat important)</span>
										</div>
										<div className="flex items-center gap-3">
											<div className="h-4 w-4 rounded border border-gray-100 bg-gray-50" />
											<span className="text-sm">Less than 40% (niche concern)</span>
										</div>
									</>
								) : (
									<>
										<div className="mb-2 font-medium text-foreground text-sm">
											Strength View - How much evidence do we have?
										</div>
										<div className="flex items-center gap-3">
											<div className="h-4 w-4 rounded border border-green-300 bg-green-100" />
											<span className="text-sm">10+ pieces of evidence (very reliable pattern)</span>
										</div>
										<div className="flex items-center gap-3">
											<div className="h-4 w-4 rounded border border-green-200 bg-green-50" />
											<span className="text-sm">7-10 pieces (solid pattern)</span>
										</div>
										<div className="flex items-center gap-3">
											<div className="h-4 w-4 rounded border border-yellow-200 bg-yellow-50" />
											<span className="text-sm">4-7 pieces (emerging pattern)</span>
										</div>
										<div className="flex items-center gap-3">
											<div className="h-4 w-4 rounded border border-gray-100 bg-gray-50" />
											<span className="text-sm">Less than 4 (weak signal)</span>
										</div>
									</>
								)}
							</div>

							<div className="border-foreground border-t pt-3">
								<p className="text-foreground text-xs">
									<strong>What to look for:</strong> Purple wedges are your best opportunities. High coverage + high
									strength = validated themes worth building for.
								</p>
							</div>
						</CardContent>
					</Card>

					<Card className="">
						<CardHeader>
							<CardTitle>Key Insights</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="text-sm">
								<strong>Strongest Wedges:</strong>
								<ul className="mt-1 ml-4 space-y-1">
									<li>• TBD</li>
								</ul>
							</div>

							<div className="text-sm">
								<strong>Cross-Persona Themes:</strong>
								<ul className="mt-1 ml-4 space-y-1">
									<li>• TBD</li>
								</ul>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Selected Details */}
				{(selectedPersona || selectedTheme) && (
					<Card className="mt-6">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								{selectedPersona && (
									<>
										<span>Deep Dive: {selectedPersona}</span>
										<Badge variant="outline" className="text-xs">
											Persona Analysis
										</Badge>
									</>
								)}
								{selectedTheme && (
									<>
										<span>Theme Analysis: {selectedTheme}</span>
										<Badge variant="outline" className="text-xs">
											Cross-Persona View
										</Badge>
									</>
								)}
							</CardTitle>
						</CardHeader>
						<CardContent>
							{selectedPersona && (
								<div className="space-y-4">
									<div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
										<p className="text-blue-800 text-sm">
											<strong>What this tells you:</strong> These are all the themes that matter to {selectedPersona}.
											Purple wedges show where they care much more than other personas - your best opportunities to
											build something they'll love.
										</p>
									</div>
									{getPersonaData(selectedPersona)
										?.themes.sort((a, b) => {
											// Sort by wedge first, then by coverage * nEff
											if (a.wedge && !b.wedge) return -1
											if (!a.wedge && b.wedge) return 1
											return b.coverage * b.nEff - a.coverage * a.nEff
										})
										.map(
											(theme: {
												themeId: string
												themeName: string
												coverage: number
												nEff: number
												wedge: boolean
											}) => (
												<div
													key={theme.themeId}
													className={`rounded-lg border p-4 ${theme.wedge ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-gray-50"}`}
												>
													<div className="flex items-start justify-between">
														<div className="flex-1">
															<div className="mb-2 flex items-center gap-2">
																<h4 className="font-medium">{theme.themeName}</h4>
																{theme.wedge && (
																	<Badge className="bg-purple-600 text-white text-xs">Wedge Opportunity</Badge>
																)}
															</div>
															<div className="grid grid-cols-2 gap-4 text-sm">
																<div>
																	<span className="text-gray-600">Coverage:</span>
																	<div className="font-medium">{Math.round(theme.coverage * 100)}%</div>
																	<div className="text-gray-500 text-xs">
																		{theme.coverage >= 0.8
																			? "Nearly universal"
																			: theme.coverage >= 0.6
																				? "Very common"
																				: theme.coverage >= 0.4
																					? "Moderately common"
																					: "Niche concern"}
																	</div>
																</div>
																<div>
																	<span className="text-gray-600">Evidence Strength:</span>
																	<div className="font-medium">{theme.nEff.toFixed(1)} pieces</div>
																	<div className="text-gray-500 text-xs">
																		{theme.nEff >= 10
																			? "Very reliable"
																			: theme.nEff >= 7
																				? "Solid pattern"
																				: theme.nEff >= 4
																					? "Emerging pattern"
																					: "Weak signal"}
																	</div>
																</div>
															</div>
															{theme.wedge && (
																<div className="mt-2 rounded bg-purple-100 p-2 text-purple-800 text-xs">
																	<strong>💡 Opportunity:</strong> This persona cares significantly more about this
																	theme than others. Consider building features specifically for them around this need.
																</div>
															)}
														</div>
													</div>
												</div>
											)
										)}
								</div>
							)}

							{selectedTheme && (
								<div className="space-y-4">
									<div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
										<p className="text-green-800 text-sm">
											<strong>What this tells you:</strong> See how "{selectedTheme}" affects different personas. Look
											for big differences - if one group cares way more, that's a wedge opportunity.
										</p>
									</div>
									{getThemeData(selectedTheme)
										.sort((a, b) => {
											// Sort by wedge first, then by coverage * nEff
											const aScore = (a.coverage || 0) * (a.nEff || 0)
											const bScore = (b.coverage || 0) * (b.nEff || 0)
											if (a.wedge && !b.wedge) return -1
											if (!a.wedge && b.wedge) return 1
											return bScore - aScore
										})
										.map((data: { persona: string; coverage?: number; nEff?: number; wedge?: boolean }) => (
											<div
												key={data.persona}
												className={`rounded-lg border p-4 ${data.wedge ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-gray-50"}`}
											>
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<div className="mb-2 flex items-center gap-2">
															<h4 className="font-medium">{data.persona}</h4>
															{data.wedge && (
																<Badge className="bg-purple-600 text-white text-xs">Wedge Opportunity</Badge>
															)}
														</div>
														<div className="grid grid-cols-2 gap-4 text-sm">
															<div>
																<span className="text-gray-600">Coverage:</span>
																<div className="font-medium">{Math.round((data.coverage || 0) * 100)}%</div>
																<div className="text-gray-500 text-xs">
																	{(data.coverage || 0) >= 0.8
																		? "Nearly universal"
																		: (data.coverage || 0) >= 0.6
																			? "Very common"
																			: (data.coverage || 0) >= 0.4
																				? "Moderately common"
																				: "Niche concern"}
																</div>
															</div>
															<div>
																<span className="text-gray-600">Evidence Strength:</span>
																<div className="font-medium">{(data.nEff || 0).toFixed(1)} pieces</div>
																<div className="text-gray-500 text-xs">
																	{(data.nEff || 0) >= 10
																		? "Very reliable"
																		: (data.nEff || 0) >= 7
																			? "Solid pattern"
																			: (data.nEff || 0) >= 4
																				? "Emerging pattern"
																				: "Weak signal"}
																</div>
															</div>
														</div>
														{data.wedge && (
															<div className="mt-2 rounded bg-purple-100 p-2 text-purple-800 text-xs">
																<strong>💡 Wedge Alert:</strong> {data.persona} cares much more about this theme than
																other personas. This is a prime opportunity to build something specifically for them.
															</div>
														)}
													</div>
												</div>
											</div>
										))}
								</div>
							)}
						</CardContent>
					</Card>
				)}
			</div>
		</TooltipProvider>
	)
}
