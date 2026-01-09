import { QRCodeSVG } from "qrcode.react"
import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog"

interface QRCodeModalProps {
	isOpen: boolean
	onClose: () => void
	url: string
	title: string
}

export function QRCodeModal({ isOpen, onClose, url, title }: QRCodeModalProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>QR Code for {title}</DialogTitle>
					<DialogDescription>Scan this QR code to open the research link</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col items-center space-y-4">
					<div className="rounded-lg border bg-white p-4">
						<QRCodeSVG value={url} size={256} level="H" includeMargin={true} bgColor="#ffffff" fgColor="#000000" />
					</div>

					<div className="w-full space-y-2">
						<div className="text-center font-medium text-muted-foreground text-sm">Research Link URL</div>
						<div className="rounded-md bg-muted p-3">
							<p className="break-all text-center font-mono text-sm">{url}</p>
						</div>
					</div>

					<div className="flex w-full justify-end space-x-2">
						<Button variant="outline" onClick={onClose}>
							Close
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
