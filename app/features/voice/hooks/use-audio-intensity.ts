"use client"

import { useCallback, useEffect, useState } from "react"

export function useAudioIntensity(stream: MediaStream | null) {
	const [intensity, setIntensity] = useState(0)
	const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

	const AMPLIFICATION = 5
	const MIN_THRESHOLD = 0.05

	useEffect(() => {
		if (!stream) return

		const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
		const analyserNode = audioContext.createAnalyser()
		analyserNode.fftSize = 256
		const source = audioContext.createMediaStreamSource(stream)
		source.connect(analyserNode)

		setAnalyser(analyserNode)

		return () => {
			source.disconnect()
			audioContext.close()
		}
	}, [stream])

	const getIntensity = useCallback(() => {
		if (!analyser) return 0

		const dataArray = new Uint8Array(analyser.frequencyBinCount)
		analyser.getByteFrequencyData(dataArray)

		// Calculate the average intensity
		const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length

		// Normalize to 0-1 range
		const amplified = average * AMPLIFICATION
		return (amplified > 255 ? 255 : amplified) / 255
	}, [analyser])

	useEffect(() => {
		if (!analyser) return

		let animationFrameId: number

		const updateIntensity = () => {
			setIntensity(getIntensity())
			animationFrameId = requestAnimationFrame(updateIntensity)
		}

		updateIntensity()

		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId)
			}
		}
	}, [analyser, getIntensity])

	return intensity > MIN_THRESHOLD ? intensity : 0
}
