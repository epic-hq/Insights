import { useState, useEffect } from "react"

export function useDeviceDetection() {
	const [isMobile, setIsMobile] = useState(false)
	const [isTablet, setIsTablet] = useState(false)

	useEffect(() => {
		const checkDevice = () => {
			const userAgent = navigator.userAgent.toLowerCase()
			const width = window.innerWidth

			// Mobile detection
			const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
			const isMobileDevice = mobileRegex.test(userAgent) || width < 768

			// Tablet detection  
			const isTabletDevice = (width >= 768 && width < 1024) || 
				(/ipad/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent)))

			setIsMobile(isMobileDevice && !isTabletDevice)
			setIsTablet(isTabletDevice)
		}

		checkDevice()
		window.addEventListener('resize', checkDevice)
		
		return () => window.removeEventListener('resize', checkDevice)
	}, [])

	return {
		isMobile,
		isTablet,
		isDesktop: !isMobile && !isTablet
	}
}
