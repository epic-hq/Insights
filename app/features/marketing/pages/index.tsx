/**
 * UpSight Marketing Landing Page
 *
 * Emotion-first, anti-SaaS landing page with:
 * - Crowd background → cycling Polaroid portrait carousel
 * - SVG annotation lines from labels INTO the portrait (Thinks/Feels/Uses)
 * - Progressive disclosure of SEO capabilities below the fold
 * - PostHog A/B tested hero headline (3 variants)
 * - Use-case category chips for buyer self-selection
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, type LinksFunction, type MetaFunction } from "react-router";
import MarketingNav from "~/components/navigation/MarketingNav";
import { usePostHogExperiment } from "~/hooks/usePostHogExperiment";
import { PATHS } from "~/paths";
import "./landing.css";

export const links: LinksFunction = () => [
	{
		rel: "canonical",
		href: "https://getupsight.com",
	},
	{
		rel: "preload",
		href: "/images/hero/crowd-1280.avif",
		as: "image",
		type: "image/avif",
	},
	{
		rel: "preconnect",
		href: "https://fonts.googleapis.com",
	},
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous" as const,
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500&display=swap",
	},
];

export const meta: MetaFunction = () => [
	{
		title: "UpSight — The Best Way to Understand Your Customers",
	},
	{
		name: "description",
		content:
			"AI-powered customer research platform — surveys, conversation analysis, and customer interviews for product, research, and sales teams. Turn conversations into evidence your whole team can act on.",
	},
];

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface PersonData {
	name: string;
	role: string;
	imgSrc: string;
	imgSrcSet: string;
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
		imgSrc: "/images/hero/sarah-320.webp",
		imgSrcSet: "/images/hero/sarah-240.webp 240w, /images/hero/sarah-320.webp 320w, /images/hero/sarah-480.webp 480w",
		tilt: "rotate(-2.5deg)",
		annotations: [
			{
				label: "Engage",
				value: '"We keep talking to the ',
				highlight: "same 5 users",
				side: "left",
				zone: "head",
			},
			{
				label: "Understand",
				value: "Needs ",
				highlight: "evidence, not opinions",
				side: "right",
				zone: "heart",
			},
			{
				label: "Serve",
				value: "Ship what ",
				highlight: "customers asked for",
				side: "right",
				zone: "hand",
			},
		],
	},
	{
		name: "Marcus",
		role: "Founder & CEO",
		imgSrc: "/images/hero/marcus-320.webp",
		imgSrcSet:
			"/images/hero/marcus-240.webp 240w, /images/hero/marcus-320.webp 320w, /images/hero/marcus-480.webp 480w",
		tilt: "rotate(1.8deg)",
		annotations: [
			{
				label: "Engage",
				value: '"I know exactly ',
				highlight: "who to talk to",
				side: "left",
				zone: "head",
			},
			{
				label: "Understand",
				value: "Wants ",
				highlight: "signal, not noise",
				side: "right",
				zone: "heart",
			},
			{
				label: "Serve",
				value: "Build ",
				highlight: "conviction to act",
				side: "right",
				zone: "hand",
			},
		],
	},
	{
		name: "Priya",
		role: "Customer Success Lead",
		imgSrc: "/images/hero/priya-320.webp",
		imgSrcSet: "/images/hero/priya-240.webp 240w, /images/hero/priya-320.webp 320w, /images/hero/priya-480.webp 480w",
		tilt: "rotate(-1.2deg)",
		annotations: [
			{
				label: "Engage",
				value: '"I need to hear from ',
				highlight: "at-risk accounts",
				side: "left",
				zone: "head",
			},
			{
				label: "Understand",
				value: "Spots ",
				highlight: "churn signals early",
				side: "right",
				zone: "heart",
			},
			{
				label: "Serve",
				value: "Retain the ",
				highlight: "right customers",
				side: "right",
				zone: "hand",
			},
		],
	},
];

// Extra text after highlight for each annotation
const ANNO_SUFFIX: Record<string, Record<number, string>> = {
	"0": {
		0: " — who else matters?",
		1: " to prioritize.",
		2: ", not just features.",
	},
	"1": {
		0: '."',
		1: ", not guesses.",
		2: " fast.",
	},
	"2": {
		0: " — before it's too late.",
		1: ", across every signal.",
		2: ".",
	},
};

// ---------------------------------------------------------------------------
// Hero headline A/B variants (PostHog experiment: homepage-hero-headline)
// ---------------------------------------------------------------------------

interface HeroVariant {
	headline: [string, string]; // [line1, line2 (amber)]
	subline: string;
}

const HERO_VARIANTS: Record<string, HeroVariant> = {
	control: {
		headline: ["The best way to", "understand your customers."],
		subline: "AI-powered surveys and conversation analysis for product, research, and sales teams.",
	},
	outcome: {
		headline: ["Turn conversations into", "evidence you can act on."],
		subline: "AI surveys. Conversation analysis. Insights with receipts — for your whole team.",
	},
	category: {
		headline: ["AI-powered customer research —", "surveys to conversation analysis."],
		subline: "Understand what your customers really think. Ship with conviction.",
	},
};

// ---------------------------------------------------------------------------
// Use-case category chips for buyer self-selection
// ---------------------------------------------------------------------------

const USE_CASE_CHIPS = [
	{ label: "AI Surveys", href: "#capabilities" },
	{ label: "Conversation Analysis", href: "#capabilities" },
	{ label: "Customer Interviews", href: "#capabilities" },
	{ label: "Sales Intelligence", href: "#capabilities" },
	{ label: "Research Ops", href: "#capabilities" },
];

// ---------------------------------------------------------------------------
// Condensed "For Teams" grid shown just below the hero
// ---------------------------------------------------------------------------

const TEAM_CARDS = [
	{
		tag: "Product",
		line: "Build the right thing — with evidence, not opinions.",
	},
	{
		tag: "Research",
		line: "Insights with receipts. Every theme traceable to a voice.",
	},
	{
		tag: "Sales",
		line: "Win with proof. Walk into every deal knowing what matters.",
	},
	{
		tag: "Consultants",
		line: "From interviews to deliverables in hours, not weeks.",
	},
];

const BODY_ZONES = { head: 0.18, heart: 0.5, hand: 0.75 } as const;
const CAROUSEL_INTERVAL = 6000;
const LABEL_GAP = 48;

const CAPABILITIES = [
	{
		tag: "For Founders",
		title: "Stop debating. Start knowing.",
		desc: "One place where every customer conversation becomes evidence you can act on. No more opinions — just signal.",
	},
	{
		tag: "For Product",
		title: "Build the right thing.",
		desc: "See patterns across calls, tickets, and interviews. Prioritize with evidence, not whoever speaks loudest.",
	},
	{
		tag: "For Sales",
		title: "Win with proof.",
		desc: "Turn customer evidence into your playbook. Walk into every deal knowing what matters — backed by proof, not hunches.",
	},
	{
		tag: "For CS",
		title: "See churn before it happens.",
		desc: "Surface risk signals from conversations. Act before the renewal call — not after the cancellation email.",
	},
	{
		tag: "For Consultants",
		title: "From interviews to deliverables in hours.",
		desc: "Stakeholder synthesis that used to take weeks. Every recommendation traceable to a voice.",
	},
	{
		tag: "For Research",
		title: "Research that actually ships.",
		desc: "Insights with receipts. Click any theme — see who said it, when, and why it matters. Evidence that drives decisions.",
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

	// PostHog A/B experiment — returns "control" | "outcome" | "category"
	const { variant } = usePostHogExperiment("homepage-hero-headline", "control");
	const heroContent = HERO_VARIANTS[variant] ?? HERO_VARIANTS.control;

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
			<MarketingNav />

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
				<div className="lp-hero-crowd opacity-25">
					<picture>
						<source
							sizes="100vw"
							srcSet="/images/hero/crowd-640.avif 640w, /images/hero/crowd-960.avif 960w, /images/hero/crowd-1280.avif 1280w, /images/hero/crowd-1600.avif 1600w, /images/hero/crowd-1920.avif 1920w"
							type="image/avif"
						/>
						<img
							alt="Team meeting"
							decoding="async"
							fetchPriority="high"
							height={1280}
							loading="eager"
							sizes="100vw"
							src="/images/hero/crowd-1280.webp"
							srcSet="/images/hero/crowd-640.webp 640w, /images/hero/crowd-960.webp 960w, /images/hero/crowd-1280.webp 1280w, /images/hero/crowd-1600.webp 1600w, /images/hero/crowd-1920.webp 1920w"
							width={1920}
						/>
					</picture>
				</div>

				{/* Headline — A/B tested via PostHog */}
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
							maxWidth: "22ch",
						}}
					>
						{heroContent.headline[0]}
						<br />
						<span style={{ color: "var(--lp-amber)" }}>{heroContent.headline[1]}</span>
					</h1>
					<p
						className="mx-auto"
						style={{
							fontSize: "clamp(0.95rem, 1.3vw, 1.15rem)",
							color: "var(--lp-dim)",
							fontWeight: 300,
							lineHeight: 1.5,
							maxWidth: "42ch",
							marginTop: "clamp(0.5rem, 1vw, 0.75rem)",
						}}
					>
						{heroContent.subline}
					</p>

					{/* Use-case category chips */}
					<div
						className="mx-auto mt-[clamp(0.6rem,1.2vw,1rem)] flex flex-wrap items-center justify-center gap-[clamp(0.35rem,0.7vw,0.5rem)]"
						style={{ maxWidth: "600px" }}
					>
						{USE_CASE_CHIPS.map((chip) => (
							<a
								key={chip.label}
								href={chip.href}
								className="lp-use-case-chip"
							>
								{chip.label}
							</a>
						))}
					</div>
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
										<img
											alt={`${person.name}, ${person.role}`}
											decoding="async"
											fetchPriority={pIdx === 0 ? "high" : "low"}
											height={640}
											loading={pIdx === 0 ? "eager" : "lazy"}
											sizes="(max-width: 768px) 50vw, 280px"
											src={person.imgSrc}
											srcSet={person.imgSrcSet}
											width={480}
										/>
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
											fontSize: "clamp(0.75rem, 1.05vw, 0.9rem)",
											textTransform: "uppercase",
											letterSpacing: "0.18em",
											color: "var(--lp-amber)",
											marginBottom: "2px",
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
							fontSize: "clamp(0.85rem, 1.2vw, 1rem)",
							color: "var(--lp-dim)",
							fontWeight: 400,
							marginTop: "clamp(0.6rem, 1vw, 0.8rem)",
							lineHeight: 1.6,
							maxWidth: "44ch",
						}}
					>
						Start with an{" "}
						<Link
							to={`${PATHS.AUTH.REGISTER}?plan=pro`}
							className="font-semibold underline underline-offset-4"
							style={{
								color: "var(--lp-amber)",
								textDecorationColor: "rgba(245,158,11,0.4)",
							}}
						>
							AI-powered survey
						</Link>
						{" "}or analyze a{" "}
						<Link
							to={`${PATHS.AUTH.REGISTER}?plan=pro`}
							className="font-semibold underline underline-offset-4"
							style={{
								color: "var(--lp-sky)",
								textDecorationColor: "rgba(56,189,248,0.4)",
							}}
						>
							customer conversation
						</Link>
						. Get evidence in minutes.
					</p>
				</div>
			</section>

			{/* ===== FOR TEAMS — condensed grid just below hero ===== */}
			<section
				className="lp-capabilities"
				style={{
					padding: "clamp(2.5rem, 6vw, 5rem) clamp(1.5rem, 4vw, 5rem)",
					background: "var(--lp-bg)",
					borderTop: "1px solid rgba(255,255,255,0.03)",
				}}
			>
				<div
					className="mx-auto grid grid-cols-2 md:grid-cols-4"
					style={{
						gap: "clamp(0.75rem, 1.5vw, 1.25rem)",
						maxWidth: "min(95vw, 900px)",
					}}
				>
					{TEAM_CARDS.map((card) => (
						<div
							key={card.tag}
							className="lp-rv rounded-lg"
							style={{
								padding: "clamp(1rem, 1.5vw, 1.5rem)",
								border: "1px solid rgba(255,255,255,0.06)",
								background: "rgba(255,255,255,0.02)",
							}}
						>
							<span
								className="mb-[clamp(0.3rem,0.5vw,0.5rem)] block uppercase tracking-[0.14em]"
								style={{
									fontFamily: "'JetBrains Mono', monospace",
									fontSize: "clamp(0.65rem, 0.9vw, 0.78rem)",
									color: "var(--lp-amber)",
									fontWeight: 500,
								}}
							>
								{card.tag}
							</span>
							<p
								style={{
									fontSize: "clamp(0.78rem, 1.05vw, 0.9rem)",
									color: "var(--lp-dim)",
									fontWeight: 300,
									lineHeight: 1.5,
								}}
							>
								{card.line}
							</p>
						</div>
					))}
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
					Every team talks to customers.
					<br />
					<span style={{ color: "var(--lp-amber)" }}>Few truly know them.</span>
				</h2>
			</section>

			{/* ===== ENGAGE / UNDERSTAND / SERVE ===== */}
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
							mono: "Engage",
							color: "rgb(251,191,36)",
							h: "Know who\nto reach",
							p: "See who to talk to, what to ask, and what you've already learned. Your next outreach is informed, not random.",
						},
						{
							mono: "Understand",
							color: "rgb(56,189,248)",
							h: "See what\nmatters",
							p: "Every insight links to who said it and why it matters. Cross-source, grounded, and verifiable. Not just AI summaries.",
						},
						{
							mono: "Serve",
							color: "rgb(52,211,153)",
							h: "Deliver what\nthey need",
							p: "Turn evidence into action. Build the right product, close the right deals, retain the right customers.",
						},
					].map((item) => (
						<div
							key={item.mono}
							className="lp-rv text-center"
							style={{
								padding: "clamp(1.5rem, 3vw, 3rem) clamp(1rem, 2vw, 2rem)",
							}}
						>
							<span
								className="mb-[clamp(0.75rem,1.5vw,1.5rem)] uppercase tracking-[0.25em]"
								style={{
									fontFamily: "'JetBrains Mono', monospace",
									fontSize: "clamp(0.65rem, 0.95vw, 0.8rem)",
									color: item.color,
									fontWeight: 500,
								}}
							>
								// {item.mono}
							</span>
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
						Customer truth, connected.
					</p>
					<h2
						className="lp-rv"
						style={{
							fontSize: "clamp(1.6rem, 4vw, 3.2rem)",
							fontWeight: 800,
							letterSpacing: "-0.02em",
						}}
					>
						Customer truth your whole team can use.
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
						Customer truth that flows across your whole team — grounded in real customer evidence.
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
							<h3
								style={{
									fontSize: "clamp(0.95rem, 1.4vw, 1.15rem)",
									fontWeight: 700,
									marginBottom: "clamp(0.3rem, 0.6vw, 0.5rem)",
									letterSpacing: "-0.01em",
								}}
							>
								{cap.title}
							</h3>
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
					Start with one project.
					<br />
					<span style={{ color: "var(--lp-amber)" }}>Five conversations.</span>
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
					See what happens when your whole team shares the same customer truth.
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
					Engage. Understand. Serve.
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
					<Link to="/blog" className="transition-colors hover:text-white/80">
						Blog
					</Link>
					<Link to="/terms" className="transition-colors hover:text-white/80">
						Terms
					</Link>
					<Link to="/privacy" className="transition-colors hover:text-white/80">
						Privacy
					</Link>
					<Link to={PATHS.ABOUT} className="transition-colors hover:text-white/80">
						About
					</Link>
				</div>
			</footer>
		</div>
	);
}
