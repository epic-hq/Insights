import { QrCode } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

interface QRCodeButtonProps {
	url: string
	onClick: () => void
}

export function QRCodeButton({ url, onClick }: QRCodeButtonProps) {
	return (
		<TooltipProvider delayDuration={0}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" size="sm" onClick={onClick} className="h-8 w-8 p-0">
						<div className="relative">
							<QrCode className="h-4 w-4" />
							{/* Small QR code preview */}
							<div className="-bottom-1 -right-1 absolute h-3 w-3 rounded border border-white bg-white shadow-xs">
								<QRCodeSVG value={url} size={12} level="L" bgColor="#ffffff" fgColor="#000000" />
							</div>
						</div>
						<span className="sr-only">Show QR code</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Show QR code</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}
