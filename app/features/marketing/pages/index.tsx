/**
 * UpSight Marketing Landing Page
 *
 * Emotion-first, anti-SaaS landing page with:
 * - Crowd background → cycling Polaroid portrait carousel
 * - SVG annotation lines from labels INTO the portrait (Thinks/Feels/Uses)
 * - Progressive disclosure of SEO capabilities below the fold
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, type MetaFunction } from "react-router";
import MainNav from "~/components/navigation/MainNav";
import { PATHS } from "~/paths";
import "./landing.css";

export const meta: MetaFunction = () => [
	{
		title: "UpSight — Get Your Customers. Build Conviction.",
	},
	{
		name: "description",
		content:
			"Voice of Customer platform with AI-powered surveys, interview guides, UX research synthesis, and evidence-backed customer intelligence. Turn conversations into decisions you can defend.",
	},
];

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface PersonData {
	name: string;
	role: string;
	imgSrc: string;
	tilt: string;
	annotations: {
		label: string;
		value: string;
		highlight: string;
		side: "left" | "right";
		zone: "head" | "heart" | "hand";
	}[];
}

const PEOPLE: PersonData[] = [
	{
		name: "Sarah",
		role: "Product Lead, Series A",
		imgSrc: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=480&h=640&q=80",
		tilt: "rotate(-2.5deg)",
		annotations: [
			{
				label: "Thinks",
				value: "\u201CThe roadmap is ",
				highlight: "guesswork",
				side: "left",
				zone: "head",
			},
			{
				label: "Feels",
				value: "Evidence-backed ",
				highlight: "priorities",
				side: "right",
				zone: "heart",
			},
			{
				label: "Uses",
				value: "",
				highlight: "Notion",
				side: "right",
				zone: "hand",
			},
		],
	},
	{
		name: "Marcus",
		role: "Founder & CEO",
		imgSrc: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=480&h=640&q=80",
		tilt: "rotate(1.8deg)",
		annotations: [
			{
				label: "Thinks",
				value: "\u201CI heard this ",
				highlight: "3 months ago",
				side: "left",
				zone: "head",
			},
			{
				label: "Feels",
				value: "Team aligned on ",
				highlight: "what to build",
				side: "right",
				zone: "heart",
			},
			{
				label: "Uses",
				value: "",
				highlight: "Zoom",
				side: "right",
				zone: "hand",
			},
		],
	},
	{
		name: "Priya",
		role: "Customer Success Lead",
		imgSrc: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=480&h=640&q=80",
		tilt: "rotate(-1.2deg)",
		annotations: [
			{
				label: "Thinks",
				value: "\u201C",
				highlight: "Nobody",
				side: "left",
				zone: "head",
			},
			{
				label: "Feels",
				value: "Early warning with ",
				highlight: "receipts",
				side: "right",
				zone: "heart",
			},
			{
				label: "Uses",
				value: "",
				highlight: "Intercom",
				side: "right",
				zone: "hand",
			},
		],
	},
];

// Extra text after highlight for each annotation
const ANNO_SUFFIX: Record<string, Record<number, string>> = {
	"0": { 0: "\u201D", 1: "", 2: ", Linear, Slack" },
	"1": { 0: "\u201D", 1: "", 2: ", spreadsheets, memory" },
	"2": { 0: " listens to CS\u201D", 1: "", 2: ", HubSpot, hope" },
};

const BODY_ZONES = { head: 0.18, heart: 0.5, hand: 0.75 } as const;
const CAROUSEL_INTERVAL = 6000;
const LABEL_GAP = 48;

const CAPABILITIES = [
	{
		tag: "Capture",
		title: "Voice of Customer",
		desc: "Ingest conversations from calls, meetings, support tickets, and field notes. Every customer touchpoint in one place.",
	},
	{
		tag: "Engage",
		title: "AI-Powered Surveys",
		desc: "Smart surveys with intelligent follow-up questions. Collect text, audio, and video responses. AI analyzes themes automatically.",
	},
	{
		tag: "Guide",
		title: "Interview Guides & Recording",
		desc: "Plan interview prompts, record live or upload recordings. Auto-transcribe with speaker identification and timestamps.",
	},
	{
		tag: "Analyze",
		title: "UX Research Synthesis",
		desc: "AI extracts themes, personas, and evidence across conversations. Click any insight to see the exact source\u2014the receipts.",
	},
	{
		tag: "Connect",
		title: "AI-Native CRM",
		desc: "Customer intelligence that flows to your whole team. Not another database\u2014a shared reality where every insight is traceable.",
	},
	{
		tag: "Act",
		title: "Evidence-Linked Actions",
		desc: "Turn insights into tasks with evidence attached. Every decision stays grounded in what customers actually said.",
	},
];

// ---------------------------------------------------------------------------
// Annotation positioning engine
// ---------------------------------------------------------------------------

function positionAnnotations(sceneEl: HTMLElement, svgEl: SVGSVGElement, labelEls: HTMLElement[]) {
	const wrap = sceneEl.querySelector<HTMLElement>(".lp-polaroid-wrap");
	const imgEl = sceneEl.querySelector<HTMLElement>(".lp-polaroid-img");
	if (!wrap || !imgEl) return;

	const sceneRect = sceneEl.getBoundingClientRect();
	const wrapRect = wrap.getBoundingClientRect();
	const imgRect = imgEl.getBoundingClientRect();

	const sw = sceneRect.width;
	const sh = sceneRect.height;
	svgEl.setAttribute("viewBox", `0 0 ${sw} ${sh}`);
	svgEl.style.width = `${sw}px`;
	svgEl.style.height = `${sh}px`;

	const imgL = imgRect.left - sceneRect.left;
	const imgT = imgRect.top - sceneRect.top;
	const imgW = imgRect.width;
	const imgH = imgRect.height;
	const wrapL = wrapRect.left - sceneRect.left;
	const wrapR = wrapRect.right - sceneRect.left;

	const delays = ["delay-1", "delay-2", "delay-3"];
	let svgContent = "";

	labelEls.forEach((label, i) => {
		const side = label.dataset.side || "left";
		const zone = (label.dataset.zone || "head") as keyof typeof BODY_ZONES;
		const yPct = BODY_ZONES[zone];
		const dotY = imgT + imgH * yPct;

		if (side === "left") {
			const dotX = imgL + imgW * 0.35;
			label.style.position = "absolute";
			label.style.right = `${sw - wrapL + LABEL_GAP}px`;
			label.style.left = "auto";
			label.style.top = `${dotY}px`;
			label.style.transform = "translateY(-50%)";
			const labelRight = wrapL - LABEL_GAP;
			svgContent += `<line class="${delays[i]}" x1="${labelRight}" y1="${dotY}" x2="${dotX}" y2="${dotY}" />`;
			svgContent += `<circle class="${delays[i]}" cx="${dotX}" cy="${dotY}" r="6" />`;
			svgContent += `<circle class="pulse ${delays[i]}" cx="${dotX}" cy="${dotY}" r="6" />`;
		} else {
			const dotX = imgL + imgW * 0.65;
			label.style.position = "absolute";
			label.style.left = `${wrapR + LABEL_GAP}px`;
			label.style.right = "auto";
			label.style.top = `${dotY}px`;
			label.style.transform = "translateY(-50%)";
			const labelLeft = wrapR + LABEL_GAP;
			svgContent += `<line class="${delays[i]}" x1="${dotX}" y1="${dotY}" x2="${labelLeft}" y2="${dotY}" />`;
			svgContent += `<circle class="${delays[i]}" cx="${dotX}" cy="${dotY}" r="6" />`;
			svgContent += `<circle class="pulse ${delays[i]}" cx="${dotX}" cy="${dotY}" r="6" />`;
		}
	});

	svgEl.innerHTML = svgContent;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LandingPage() {
	const [current, setCurrent] = useState(0);
	const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);
	const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
	const labelRefs = useRef<(HTMLElement | null)[][]>([[], [], []]);
	const timerFillRef = useRef<HTMLDivElement>(null);
	const heroRef = useRef<HTMLElement>(null);

	// Reposition annotations when current changes or on resize
	const reposition = useCallback((idx: number) => {
		const scene = sceneRefs.current[idx];
		const svg = svgRefs.current[idx];
		const labels = labelRefs.current[idx]?.filter(Boolean) as HTMLElement[];
		if (scene && svg && labels?.length) {
			requestAnimationFrame(() => setTimeout(() => positionAnnotations(scene, svg, labels), 80));
		}
	}, []);

	// Carousel auto-rotation
	useEffect(() => {
		let timerStart = performance.now();
		let rafId: number;
		const fill = timerFillRef.current;

		function animate(now: number) {
			const elapsed = now - timerStart;
			const pct = Math.min((elapsed / CAROUSEL_INTERVAL) * 100, 100);
			if (fill) fill.style.width = `${pct}%`;
			rafId = requestAnimationFrame(animate);
		}

		rafId = requestAnimationFrame(animate);
		const interval = setInterval(() => {
			setCurrent((prev) => (prev + 1) % PEOPLE.length);
			timerStart = performance.now();
		}, CAROUSEL_INTERVAL);

		return () => {
			clearInterval(interval);
			cancelAnimationFrame(rafId);
		};
	}, []);

	// Reposition on current change + resize
	useEffect(() => {
		reposition(current);
		const handleResize = () => reposition(current);
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [current, reposition]);

	// Initial positioning after images load
	useEffect(() => {
		const t = setTimeout(() => reposition(0), 400);
		window.addEventListener("load", () => reposition(0));
		return () => clearTimeout(t);
	}, [reposition]);

	// Intersection observer for scroll reveals
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) e.target.classList.add("lp-visible");
				}
			},
			{ threshold: 0.15 }
		);

		document
			.querySelectorAll(".lp-hero, .lp-break, .lp-promises, .lp-capabilities, .lp-cta")
			.forEach((el) => observer.observe(el));

		// Hero visible immediately
		heroRef.current?.classList.add("lp-visible");

		return () => observer.disconnect();
	}, []);

	return (
		<div
			className="lp-page flex min-h-screen flex-col"
			style={{
				background: "var(--lp-bg)",
				color: "var(--lp-text)",
				fontFamily: "'Inter', system-ui, sans-serif",
			}}
		>
			{/* Google Fonts */}
			<link
				href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500&display=swap"
				rel="stylesheet"
			/>

			<MainNav />

			{/* ===== HERO ===== */}
			<section
				className="lp-hero"
				id="hero"
				ref={heroRef}
				style={{
					paddingTop: "calc(clamp(0.5rem, 1.5vw, 1.5rem) + 56px)",
					paddingLeft: "clamp(1.5rem, 4vw, 5rem)",
					paddingRight: "clamp(1.5rem, 4vw, 5rem)",
					paddingBottom: "clamp(0.75rem, 2vw, 2rem)",
				}}
			>
				{/* Crowd bg */}
				<div className="lp-hero-crowd">
					<img
						src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1920&q=80"
						alt="Team meeting"
						loading="eager"
					/>
				</div>

				{/* Headline */}
				<div className="relative z-[2] mb-[clamp(0.25rem,0.8vw,0.75rem)] text-center">
					<p
						className="mb-[clamp(0.2rem,0.5vw,0.5rem)] uppercase tracking-[0.2em]"
						style={{
							fontFamily: "'JetBrains Mono', monospace",
							fontSize: "clamp(0.7rem, 1vw, 0.9rem)",
							color: "var(--lp-amber)",
							opacity: 0.9,
						}}
					>
						Customer Intelligence Platform
					</p>
					<h1
						className="mx-auto"
						style={{
							fontSize: "clamp(2.2rem, 5.5vw, 4.5rem)",
							fontWeight: 900,
							lineHeight: 1.05,
							letterSpacing: "-0.03em",
							maxWidth: "18ch",
						}}
					>
						Get your customers.
						<br />
						<span style={{ color: "var(--lp-amber)" }}>Build conviction.</span>
					</h1>
				</div>

				{/* Portrait Carousel */}
				<div className="lp-portrait-stage">
					{PEOPLE.map((person, pIdx) => (
						<div
							key={person.name}
							ref={(el) => {
								sceneRefs.current[pIdx] = el;
							}}
							className={`lp-portrait-scene ${pIdx === current ? "active" : ""}`}
							data-person={pIdx}
						>
							{/* Scene-level SVG for annotation lines */}
							<svg
								ref={(el) => {
									svgRefs.current[pIdx] = el;
								}}
								className="lp-anno-svg"
							/>

							{/* Polaroid card */}
							<div className="lp-polaroid-wrap relative shrink-0">
								<div className="lp-polaroid" style={{ transform: person.tilt }}>
									<div className="lp-polaroid-img">
										<img src={person.imgSrc} alt={`${person.name}, ${person.role}`} loading="eager" />
									</div>
									<div className="pt-[clamp(4px,0.5vw,8px)] text-center text-[#2a2520]">
										<div
											style={{
												fontSize: "clamp(0.85rem, 1.2vw, 1.05rem)",
												fontWeight: 600,
											}}
										>
											{person.name}
										</div>
										<div
											style={{
												fontSize: "clamp(0.6rem, 0.85vw, 0.75rem)",
												color: "#6b6560",
											}}
										>
											{person.role}
										</div>
									</div>
								</div>
							</div>

							{/* Annotation labels */}
							{person.annotations.map((anno, aIdx) => (
								<div
									key={anno.label}
									ref={(el) => {
										if (!labelRefs.current[pIdx]) labelRefs.current[pIdx] = [];
										labelRefs.current[pIdx][aIdx] = el;
									}}
									className={`lp-anno-label ${anno.side === "left" ? "left-side" : "right-side"} d${aIdx + 1}`}
									data-side={anno.side}
									data-zone={anno.zone}
								>
									<span
										className="block"
										style={{
											fontFamily: "'JetBrains Mono', monospace",
											fontSize: "clamp(0.6rem, 0.85vw, 0.72rem)",
											textTransform: "uppercase",
											letterSpacing: "0.18em",
											color: "var(--lp-amber)",
											marginBottom: "1px",
											fontWeight: 500,
										}}
									>
										// {anno.label}
									</span>
									<span
										style={{
											fontSize: "clamp(1rem, 1.8vw, 1.35rem)",
											fontWeight: 500,
											lineHeight: 1.3,
										}}
									>
										{anno.value}
										<span style={{ color: "var(--lp-sky)" }}>{anno.highlight}</span>
										{ANNO_SUFFIX[String(pIdx)]?.[aIdx] ?? ""}
									</span>
								</div>
							))}
						</div>
					))}
				</div>

				{/* Carousel pips + timer */}
				<div className="relative z-[2] flex flex-col items-center" style={{ marginTop: "clamp(0.5rem, 1vw, 0.8rem)" }}>
					<div className="flex gap-2.5">
						{PEOPLE.map((_, i) => (
							<button
								key={i}
								type="button"
								className={`lp-carousel-pip ${i === current ? "active" : ""}`}
								onClick={() => setCurrent(i)}
								aria-label={`Show person ${i + 1}`}
							/>
						))}
					</div>
					<div
						className="overflow-hidden"
						style={{
							width: "clamp(80px, 12vw, 160px)",
							height: "2px",
							background: "rgba(255,255,255,0.06)",
							borderRadius: "1px",
							marginTop: "clamp(6px, 0.8vw, 10px)",
						}}
					>
						<div ref={timerFillRef} className="lp-timer-fill" />
					</div>
				</div>

				{/* Hero CTA */}
				<div className="relative z-[2] mt-[clamp(0.4rem,0.8vw,0.75rem)] text-center">
					<div className="flex flex-wrap items-center justify-center gap-[clamp(0.5rem,1vw,0.75rem)]">
						<Link
							to={`${PATHS.AUTH.REGISTER}?plan=pro`}
							className="hover:-translate-y-px inline-flex items-center gap-1.5 rounded-md font-bold transition-transform"
							style={{
								fontSize: "clamp(0.8rem, 1.2vw, 1rem)",
								padding: "clamp(10px, 1.2vw, 14px) clamp(24px, 3.5vw, 40px)",
								background: "var(--lp-amber)",
								color: "var(--lp-bg)",
							}}
						>
							Start seeing your customers &rarr;
						</Link>
						<a
							href="https://cal.com/rickmoy"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 rounded-md font-semibold transition-colors hover:border-white/30"
							style={{
								fontSize: "clamp(0.8rem, 1.2vw, 1rem)",
								padding: "clamp(10px, 1.2vw, 14px) clamp(24px, 3.5vw, 40px)",
								background: "rgba(255,255,255,0.08)",
								color: "var(--lp-text)",
								border: "1px solid rgba(255,255,255,0.15)",
								borderRadius: "6px",
							}}
						>
							Get a Demo
						</a>
					</div>
					<p
						className="mx-auto"
						style={{
							fontSize: "clamp(0.8rem, 1.1vw, 0.95rem)",
							color: "var(--lp-dim)",
							fontWeight: 300,
							marginTop: "clamp(0.4rem, 0.8vw, 0.6rem)",
							lineHeight: 1.5,
							maxWidth: "36ch",
						}}
					>
						Start with a{" "}
						<Link
							to={`${PATHS.AUTH.REGISTER}?plan=pro`}
							className="font-medium underline underline-offset-4"
							style={{
								color: "var(--lp-text)",
								textDecorationColor: "rgba(238,238,242,0.3)",
							}}
						>
							smart survey
						</Link>{" "}
						<span style={{ color: "var(--lp-amber)", fontWeight: 500 }}>(personalized by AI)</span> or a{" "}
						<Link
							to={`${PATHS.AUTH.REGISTER}?plan=pro`}
							className="font-medium underline underline-offset-4"
							style={{
								color: "var(--lp-text)",
								textDecorationColor: "rgba(238,238,242,0.3)",
							}}
						>
							conversation
						</Link>
						.
					</p>
				</div>
			</section>

			{/* ===== BREAK ===== */}
			<section
				className="lp-break text-center"
				style={{
					padding: "clamp(4rem, 10vw, 8rem) clamp(1.5rem, 4vw, 5rem)",
					background: "var(--lp-bg)",
					borderTop: "1px solid rgba(255,255,255,0.03)",
				}}
			>
				<h2
					className="lp-rv mx-auto"
					style={{
						fontSize: "clamp(1.6rem, 4vw, 3.2rem)",
						fontWeight: 800,
						lineHeight: 1.2,
						letterSpacing: "-0.02em",
						maxWidth: "22ch",
					}}
				>
					They&rsquo;re telling you.
					<br />
					<span style={{ color: "var(--lp-amber)" }}>Are you getting it?</span>
				</h2>
			</section>

			{/* ===== THINKS / FEELS / USES ===== */}
			<section
				className="lp-promises"
				style={{
					padding: "clamp(4rem, 10vw, 8rem) clamp(1.5rem, 4vw, 5rem)",
					background: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.03), transparent 50%), var(--lp-bg)",
				}}
			>
				<div
					className="mx-auto grid grid-cols-1 md:grid-cols-3"
					style={{
						gap: "clamp(2rem, 4vw, 4rem)",
						maxWidth: "min(95vw, 1000px)",
					}}
				>
					{[
						{
							mono: "Thinks",
							h: "What they\nthink",
							p: "Surface frustrations, beliefs, and objections from real conversations. Not surveys. Not guesses. Their words.",
						},
						{
							mono: "Feels",
							h: "What they\nfeel",
							p: "Understand desires and motivations with evidence you can verify. Click any insight\u2014see exactly who said it, when.",
						},
						{
							mono: "Uses",
							h: "What they\nuse",
							p: "Map tools, workflows, and behaviors across your entire customer base. Patterns emerge in minutes, not weeks of synthesis.",
						},
					].map((item) => (
						<div
							key={item.mono}
							className="lp-rv text-center"
							style={{
								padding: "clamp(1.5rem, 3vw, 3rem) clamp(1rem, 2vw, 2rem)",
							}}
						>
							<p
								className="mb-[clamp(0.75rem,1.5vw,1.5rem)] uppercase tracking-[0.25em]"
								style={{
									fontFamily: "'JetBrains Mono', monospace",
									fontSize: "clamp(0.65rem, 0.95vw, 0.8rem)",
									color: "var(--lp-amber)",
									fontWeight: 500,
								}}
							>
								// {item.mono}
							</p>
							<h3
								style={{
									fontSize: "clamp(1.4rem, 2.8vw, 2.2rem)",
									fontWeight: 800,
									letterSpacing: "-0.02em",
									lineHeight: 1.15,
									marginBottom: "clamp(0.5rem, 1vw, 1rem)",
									whiteSpace: "pre-line",
								}}
							>
								{item.h}
							</h3>
							<p
								className="mx-auto"
								style={{
									fontSize: "clamp(0.85rem, 1.2vw, 1rem)",
									color: "var(--lp-dim)",
									fontWeight: 300,
									lineHeight: 1.65,
									maxWidth: "28ch",
								}}
							>
								{item.p}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* ===== CAPABILITIES ===== */}
			<section
				className="lp-capabilities"
				id="capabilities"
				style={{
					padding: "clamp(4rem, 10vw, 8rem) clamp(1.5rem, 4vw, 5rem)",
					background: "var(--lp-bg2)",
					borderTop: "1px solid rgba(255,255,255,0.03)",
					borderBottom: "1px solid rgba(255,255,255,0.03)",
				}}
			>
				<div className="mb-[clamp(2rem,4vw,4rem)] text-center">
					<p
						className="lp-rv mb-[clamp(0.5rem,1vw,1rem)] uppercase tracking-[0.2em]"
						style={{
							fontFamily: "'JetBrains Mono', monospace",
							fontSize: "clamp(0.7rem, 1vw, 0.85rem)",
							color: "var(--lp-amber)",
						}}
					>
						One platform. Every touchpoint.
					</p>
					<h2
						className="lp-rv"
						style={{
							fontSize: "clamp(1.6rem, 4vw, 3.2rem)",
							fontWeight: 800,
							letterSpacing: "-0.02em",
						}}
					>
						From conversation to conviction.
					</h2>
					<p
						className="lp-rv mx-auto"
						style={{
							fontSize: "clamp(0.85rem, 1.3vw, 1.05rem)",
							color: "var(--lp-dim)",
							fontWeight: 300,
							maxWidth: "50ch",
							marginTop: "clamp(0.5rem, 1vw, 1rem)",
						}}
					>
						Capture customer intelligence from every channel. Turn it into decisions your whole team can defend.
					</p>
				</div>
				<div
					className="mx-auto grid grid-cols-1 md:grid-cols-3"
					style={{
						gap: "clamp(1rem, 2vw, 2rem)",
						maxWidth: "min(95vw, 1000px)",
					}}
				>
					{CAPABILITIES.map((cap) => (
						<div
							key={cap.title}
							className="lp-rv hover:-translate-y-0.5 rounded-lg transition-all duration-300"
							style={{
								padding: "clamp(1.2rem, 2vw, 2rem)",
								border: "1px solid rgba(255,255,255,0.05)",
								background: "rgba(255,255,255,0.01)",
							}}
						>
							<span
								className="mb-[clamp(0.4rem,0.8vw,0.75rem)] block uppercase tracking-[0.12em]"
								style={{
									fontFamily: "'JetBrains Mono', monospace",
									fontSize: "clamp(0.7rem, 1vw, 0.85rem)",
									color: "var(--lp-amber)",
									fontWeight: 500,
								}}
							>
								{cap.tag}
							</span>
							<h4
								style={{
									fontSize: "clamp(0.95rem, 1.4vw, 1.15rem)",
									fontWeight: 700,
									marginBottom: "clamp(0.3rem, 0.6vw, 0.5rem)",
									letterSpacing: "-0.01em",
								}}
							>
								{cap.title}
							</h4>
							<p
								style={{
									fontSize: "clamp(0.8rem, 1.1vw, 0.95rem)",
									color: "var(--lp-dim)",
									fontWeight: 300,
									lineHeight: 1.6,
								}}
							>
								{cap.desc}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* ===== CTA ===== */}
			<section
				className="lp-cta text-center"
				id="cta"
				style={{
					padding: "clamp(5rem, 12vw, 10rem) clamp(1.5rem, 4vw, 5rem)",
					background: "radial-gradient(ellipse at 50% 70%, rgba(245,158,11,0.05), transparent 50%), var(--lp-bg)",
				}}
			>
				<h2
					className="lp-rv"
					style={{
						fontSize: "clamp(1.6rem, 4vw, 3.2rem)",
						fontWeight: 900,
						letterSpacing: "-0.02em",
						marginBottom: "clamp(0.5rem, 1vw, 1rem)",
					}}
				>
					Start with a smart survey
					<br />
					<span style={{ color: "var(--lp-amber)" }}>(personalized by AI)</span> or a conversation.
				</h2>
				<p
					className="lp-rv mx-auto"
					style={{
						fontSize: "clamp(0.95rem, 1.4vw, 1.15rem)",
						color: "var(--lp-dim)",
						fontWeight: 300,
						maxWidth: "40ch",
						marginBottom: "clamp(1.5rem, 3vw, 2.5rem)",
					}}
				>
					See what conviction feels like when it&rsquo;s backed by evidence.
				</p>
				<div className="lp-rv flex flex-wrap items-center justify-center gap-[clamp(0.75rem,1.5vw,1.25rem)]">
					<Link
						to={`${PATHS.AUTH.REGISTER}?plan=pro`}
						className="hover:-translate-y-px inline-flex items-center gap-1.5 rounded-md font-bold transition-transform"
						style={{
							fontSize: "clamp(0.85rem, 1.3vw, 1.05rem)",
							padding: "14px 36px",
							background: "var(--lp-amber)",
							color: "var(--lp-bg)",
						}}
					>
						Start Pro Trial &rarr;
					</Link>
					<a
						href="https://cal.com/rickmoy"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 rounded-md font-semibold transition-colors"
						style={{
							fontSize: "clamp(0.85rem, 1.3vw, 1.05rem)",
							padding: "14px 36px",
							background: "rgba(255,255,255,0.08)",
							color: "var(--lp-text)",
							border: "1px solid rgba(255,255,255,0.15)",
						}}
					>
						Get a Demo
					</a>
				</div>
				<p
					className="lp-rv"
					style={{
						fontSize: "clamp(0.7rem, 1vw, 0.85rem)",
						color: "var(--lp-dim2)",
						marginTop: "clamp(1.5rem, 3vw, 2.5rem)",
						fontWeight: 500,
						letterSpacing: "0.04em",
					}}
				>
					Customer truth, connected.
				</p>
			</section>

			{/* ===== FOOTER ===== */}
			<footer
				className="flex items-center justify-between"
				style={{
					padding: "clamp(1.5rem, 3vw, 2rem) clamp(1.5rem, 4vw, 5rem)",
					fontSize: "clamp(0.55rem, 0.75vw, 0.68rem)",
					color: "var(--lp-dim2)",
					borderTop: "1px solid rgba(255,255,255,0.03)",
				}}
			>
				<span>&copy; 2026 UpSight by DeepLight</span>
				<div className="flex gap-[clamp(1rem,2vw,2rem)]">
					<Link to="/blog" className="transition-colors hover:text-white/50">
						Blog
					</Link>
					<Link to="/terms" className="transition-colors hover:text-white/50">
						Terms
					</Link>
					<Link to="/privacy" className="transition-colors hover:text-white/50">
						Privacy
					</Link>
					<Link to="/about" className="transition-colors hover:text-white/50">
						About
					</Link>
				</div>
			</footer>
		</div>
	);
}
