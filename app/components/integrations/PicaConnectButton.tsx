/**
 * Pica Connect Button
 *
 * Reusable component for connecting integrations via Pica AuthKit.
 * Pass the userId from your loader - it's sent to the token endpoint
 * via headers as per Pica's documentation.
 */

import { useAuthKit } from "@picahq/authkit";
import { Calendar, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";

/** Pica connection record returned from AuthKit */
interface ConnectionRecord {
	_id: string;
	key: string;
	platform: string;
	name: string;
	environment: string;
	identity?: string;
	identityType?: "user" | "team" | "organization" | "project";
}

interface PicaConnectButtonProps {
	/** User ID for token generation */
	userId: string;
	/** Account ID for storing the connection */
	accountId: string;
	/** The integration to connect (e.g., "google-calendar", "hubspot") */
	platform?: string;
	/** Callback when connection succeeds */
	onSuccess?: (connection: ConnectionRecord) => void;
	/** Callback when connection fails */
	onError?: (error: string) => void;
	/** Button variant */
	variant?: "default" | "outline" | "ghost";
	/** Button size */
	size?: "default" | "sm" | "lg";
	/** Custom button text */
	children?: React.ReactNode;
	/** Additional class names */
	className?: string;
	/** Disabled state */
	disabled?: boolean;
}

export function PicaConnectButton({
	userId,
	accountId,
	platform,
	onSuccess,
	onError,
	variant = "default",
	size = "default",
	children,
	className,
	disabled,
}: PicaConnectButtonProps) {
	const [isConnecting, setIsConnecting] = useState(false);
	const saveFetcher = useFetcher();

	// Handle successful connection - save to our database
	const handleSuccess = useCallback(
		(connection: ConnectionRecord) => {
			setIsConnecting(false);

			// Save connection to our database via API
			saveFetcher.submit(
				{
					connectionId: connection._id,
					connectionKey: connection.key,
					platform: connection.platform,
					accountId,
				},
				{
					method: "POST",
					action: "/api/calendar/save-connection",
				}
			);

			onSuccess?.(connection);
		},
		[accountId, onSuccess, saveFetcher]
	);

	const handleError = useCallback(
		(error: string) => {
			setIsConnecting(false);
			onError?.(error);
		},
		[onError]
	);

	// Build absolute URL for token endpoint
	const tokenUrl = typeof window !== "undefined" ? `${window.location.origin}/api/authkit/token` : "/api/authkit/token";

	const { open } = useAuthKit({
		token: {
			url: tokenUrl,
			headers: {
				"x-user-id": userId,
				"x-account-id": accountId,
			},
		},
		selectedConnection: platform,
		onSuccess: handleSuccess,
		onError: handleError,
		onClose: () => setIsConnecting(false),
	});

	const handleClick = () => {
		setIsConnecting(true);
		open();
	};

	const showLoading = isConnecting || saveFetcher.state !== "idle";
	const isDisabled = disabled || !userId || showLoading;

	return (
		<Button onClick={handleClick} disabled={isDisabled} variant={variant} size={size} className={className}>
			{showLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
			{children || "Connect"}
		</Button>
	);
}
