import { useEffect, useState } from "react";

interface ClientOnlyProps {
	children: React.ReactNode;
	fallback?: React.ReactNode;
}

/**
 * Renders children only on the client side to avoid SSR hydration issues
 * Useful for components that use browser-only APIs or have complex client state
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
	const [hasMounted, setHasMounted] = useState(false);

	useEffect(() => {
		setHasMounted(true);
	}, []);

	if (!hasMounted) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
