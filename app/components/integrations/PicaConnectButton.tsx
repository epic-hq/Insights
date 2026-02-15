/**
 * Pica Connect Button
 *
 * Reusable component for connecting integrations via Pica AuthKit.
 * Pass the userId from your loader - it's sent to the token endpoint
 * via headers as per Pica's documentation.
 */

import { useAuthKit } from "@picahq/authkit";
import { Calendar, Loader2, Mail, type LucideIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";

/** Pica connection record returned from AuthKit
 * Note: Pica SDK types say `_id` but actual API returns `id` — handle both */
interface ConnectionRecord {
  _id?: string;
  id?: string;
  key: string;
  platform: string;
  name: string;
  environment: string;
  identity?: string;
  identityType?: "user" | "team" | "organization" | "project";
  [key: string]: unknown;
}

interface PicaConnectButtonProps {
  /** User ID for token generation */
  userId: string;
  /** Account ID for storing the connection */
  accountId: string;
  /** The integration to connect (e.g., "google-calendar", "gmail") */
  platform?: string;
  /** Route action to save the connection (defaults to calendar) */
  saveAction?: string;
  /** Icon to show on the button */
  icon?: LucideIcon;
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
  saveAction = "/api/calendar/save-connection",
  icon: Icon = Calendar,
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
  const hasSavedRef = useRef(false);

  // Handle successful connection - save to our database
  const handleSuccess = useCallback(
    (connection: ConnectionRecord) => {
      setIsConnecting(false);

      // Guard against duplicate onSuccess calls from AuthKit
      if (hasSavedRef.current) return;
      hasSavedRef.current = true;

      // Pica SDK types say _id but actual API returns id — handle both
      const picaId = connection.id || connection._id || "";

      // Save connection to our database via API
      // Email is fetched server-side via Pica connection API, not from connection.identity
      saveFetcher.submit(
        {
          connectionId: picaId,
          connectionKey: connection.key,
          platform: connection.platform,
          accountId,
        },
        {
          method: "POST",
          action: saveAction,
        },
      );

      onSuccess?.(connection);
    },
    [accountId, saveAction, onSuccess, saveFetcher],
  );

  const handleError = useCallback(
    (error: string) => {
      setIsConnecting(false);
      onError?.(error);
    },
    [onError],
  );

  // Build absolute URL for token endpoint
  const tokenUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/authkit/token`
      : "/api/authkit/token";

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
    hasSavedRef.current = false;
    setIsConnecting(true);
    open();
  };

  const showLoading = isConnecting || saveFetcher.state !== "idle";
  const isDisabled = disabled || !userId || showLoading;

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant={variant}
      size={size}
      className={className}
    >
      {showLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icon className="mr-2 h-4 w-4" />
      )}
      {children || "Connect"}
    </Button>
  );
}
