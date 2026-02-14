import fs from "node:fs/promises";
import path from "node:path";
import consola from "consola";
import sharp from "sharp";

const LOGO_SVG_PATH = path.join(process.cwd(), "public", "images", "logo.svg");

const OUTPUT_DIR = path.join(process.cwd(), "public", "icons");
const MANIFEST_PATH = path.join(process.cwd(), "public", "manifest.json");

// Standard icon sizes for different devices and use cases
const ICON_SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 192, 256, 384, 512];

async function ensureDir(dir: string) {
	try {
		await fs.mkdir(dir, { recursive: true });
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
	}
}

async function generateIcons() {
	await ensureDir(OUTPUT_DIR);
	await ensureDir(path.dirname(LOGO_SVG_PATH));

	// Read SVG logo from file
	let LOGO_SVG: string;
	try {
		LOGO_SVG = await fs.readFile(LOGO_SVG_PATH, "utf-8");
	} catch (error) {
		consola.error(`Logo file not found at ${LOGO_SVG_PATH}. Please ensure the logo.svg file exists.`);
		throw error;
	}

	// Generate favicon.ico (32x32 as a simple PNG)
	const faviconPath = path.join(process.cwd(), "public", "favicon.ico");

	// Create a favicon with blue icon on transparent background
	const FAVICON_SVG = `<svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<!-- Blue scan-eye icon -->
		<g fill="none" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
			<path d="M3 7V5a2 2 0 0 1 2-2h2" />
			<path d="M17 3h2a2 2 0 0 1 2 2v2" />
			<path d="M21 17v2a2 2 0 0 1-2 2h-2" />
			<path d="M7 21H5a2 2 0 0 1-2-2v-2" />
			<circle cx="12" cy="12" r="1" fill="#2563eb"/>
			<path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0" />
		</g>
	</svg>`;

	await sharp(Buffer.from(FAVICON_SVG)).resize(32, 32).png().toFile(faviconPath);

	// Generate PNG icons in different sizes
	const iconPromises = ICON_SIZES.map(async (size) => {
		const iconPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
		await sharp(Buffer.from(LOGO_SVG)).resize(size, size).png().toFile(iconPath);
		return {
			src: `/icons/icon-${size}x${size}.png`,
			sizes: `${size}x${size}`,
			type: "image/png",
		};
	});

	// Generate Apple touch icon (180x180)
	const appleTouchIconPath = path.join(OUTPUT_DIR, "apple-touch-icon.png");
	await sharp(Buffer.from(LOGO_SVG)).resize(180, 180).png().toFile(appleTouchIconPath);
	consola.log(`Generated ${appleTouchIconPath}`);
	// Generate maskable icon (512x512 with padding)
	const maskableIconPath = path.join(OUTPUT_DIR, "maskable-icon-512x512.png");

	// Create a square canvas with the logo centered
	const canvasSize = 512;
	const logoSize = 400;
	const offset = (canvasSize - logoSize) / 2;

	await sharp({
		create: {
			width: canvasSize,
			height: canvasSize,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite([
			{
				input: await sharp(Buffer.from(LOGO_SVG)).resize(logoSize, logoSize).toBuffer(),
				top: offset,
				left: offset,
			},
		])
		.png()
		.toFile(maskableIconPath);
	consola.log(`Generated ${maskableIconPath}`);

	const icons = await Promise.all(iconPromises);
	const manifest = {
		name: "Insights",
		short_name: "Insights",
		description: "Customer Insights Platform",
		start_url: "/",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#2563eb", // blue-600 from your logo
		icons: [
			...icons.filter((icon) => [192, 384, 512].includes(Number.parseInt(icon.sizes.split("x")[0], 10))),
			{
				src: "/icons/maskable-icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable any",
			},
		],
	};

	await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
	consola.log(`Generated ${MANIFEST_PATH}`);
}

// Execute the icon generation
generateIcons().catch((error) => {
	consola.error("Failed to generate icons:", error);
	process.exit(1);
});
