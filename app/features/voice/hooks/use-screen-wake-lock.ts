import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type WakeLockState = "idle" | "active" | "error" | "unsupported"

type UseScreenWakeLockResult = {
	enable: () => Promise<boolean>
	release: () => Promise<void>
	state: WakeLockState
	error: string | null
	isWakeLockSupported: boolean
	shouldSuggestManualWorkaround: boolean
	shouldSuggestPwa: boolean
}

/**
 * Handles requesting and releasing the Screen Wake Lock API where available.
 * Falls back to manual guidance for older iOS browsers that do not support it.
 */
export const useScreenWakeLock = (): UseScreenWakeLockResult => {
	const wakeLockSentinel = useRef<WakeLockSentinel | null>(null)
	const shouldRemainActive = useRef(false)
	const [state, setState] = useState<WakeLockState>("idle")
	const [error, setError] = useState<string | null>(null)

	const isClient = typeof window !== "undefined"
	const isIOS = useMemo(() => {
		if (!isClient) return false
		return /iPad|iPhone|iPod/.test(navigator.userAgent)
	}, [isClient])

	const isWakeLockSupported = useMemo(() => {
		if (!isClient) return false
		return "wakeLock" in navigator
	}, [isClient])

	const [isStandalone, setIsStandalone] = useState(false)

	useEffect(() => {
		if (!isClient) return
		const mediaQuery = window.matchMedia("(display-mode: standalone)")
		const updateStandalone = () => setIsStandalone(mediaQuery.matches)

		updateStandalone()

		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener("change", updateStandalone)
			return () => mediaQuery.removeEventListener("change", updateStandalone)
		}

		return () => {}
	}, [isClient])

	const releaseWakeLock = useCallback(async () => {
		shouldRemainActive.current = false

		if (wakeLockSentinel.current) {
			try {
				await wakeLockSentinel.current.release()
			} catch (err) {
				setError((err as Error).message)
			}
			wakeLockSentinel.current = null
		}

		setState(isWakeLockSupported ? "idle" : "unsupported")
	}, [isWakeLockSupported])

	const requestWakeLock = useCallback(async (): Promise<boolean> => {
		if (!isClient) return false

		setError(null)
		shouldRemainActive.current = true

		if (isWakeLockSupported) {
			try {
				const sentinel = await navigator.wakeLock.request("screen")
				wakeLockSentinel.current = sentinel
				setState("active")

				sentinel.addEventListener("release", () => {
					wakeLockSentinel.current = null
					if (shouldRemainActive.current && document.visibilityState === "visible") {
						requestWakeLock().catch((err) => setError((err as Error).message))
					} else {
						setState("idle")
					}
				})

				return true
			} catch (err) {
				setError((err as Error).message)
				setState("error")
				return false
			}
		}

		// Older iOS Safari has no Screen Wake Lock support. We cannot programmatically
		// keep the display awake, so we fall back to user guidance.
		setState("unsupported")
		return false
	}, [isClient, isWakeLockSupported])

	useEffect(() => {
		if (!isClient || !isWakeLockSupported) return

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible" && shouldRemainActive.current && !wakeLockSentinel.current) {
				requestWakeLock().catch((err) => setError((err as Error).message))
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
	}, [isClient, isWakeLockSupported, requestWakeLock])

	useEffect(() => {
		return () => {
			releaseWakeLock().catch(() => {
				// Ignore cleanup errors on unmount
			})
		}
	}, [releaseWakeLock])

	return {
		enable: requestWakeLock,
		release: releaseWakeLock,
		state,
		error,
		isWakeLockSupported,
		shouldSuggestManualWorkaround: isIOS && !isWakeLockSupported,
		shouldSuggestPwa: isIOS && !isWakeLockSupported && !isStandalone,
	}
}
