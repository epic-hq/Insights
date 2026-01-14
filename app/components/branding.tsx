export const Logo = ({ size = 8 }: { size?: number }) => {
	return (
		<svg
			className={`lucide lucide-scan-eye-icon h-${size} w-${size} text-brand`}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-label="Scan Eye Icon"
		>
			<path d="M3 7V5a2 2 0 0 1 2-2h2" />
			<path d="M17 3h2a2 2 0 0 1 2 2v2" />
			<path d="M21 17v2a2 2 0 0 1-2 2h-2" />
			<path d="M7 21H5a2 2 0 0 1-2-2v-2" />
			<circle cx="12" cy="12" r="1" />
			<path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0" />
		</svg >
	)
}

export const LogoBrand = () => {
	return (
		<div className="flex items-center gap-2">
			<Logo />
			<div className="font-semibold font-stretch-75% text-brand text-xl">UpSight</div>
		</div>
	)
}
