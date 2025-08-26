import { useState, useEffect } from "react"

export function useDeviceDetection() {
	const [isMobile, setIsMobile] = useState(false)

	useEffect(() => {
		const checkDevice = () => {
			const width = window.innerWidth
			// Use Tailwind's md breakpoint (768px) - mobile phones use bottom nav, tablets+ use top nav
			setIsMobile(width < 768)
		}

		checkDevice()
		window.addEventListener('resize', checkDevice)
		
		return () => window.removeEventListener('resize', checkDevice)
	}, [])

	return {
		isMobile,
		isDesktop: !isMobile
	}
}
