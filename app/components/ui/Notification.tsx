import { useEffect, useState } from "react";

interface NotificationProps {
	message: string;
	type: "success" | "error" | "info";
	duration?: number;
	onClose: () => void;
}

export default function Notification({ message, type, duration = 5000, onClose }: NotificationProps) {
	const [isVisible, setIsVisible] = useState(true);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(false);
			setTimeout(onClose, 300); // Allow fade out animation
		}, duration);

		return () => clearTimeout(timer);
	}, [duration, onClose]);

	const typeStyles = {
		success:
			"bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200",
		error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200",
		info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200",
	};

	const iconMap = {
		success: "✅",
		error: "❌",
		info: "ℹ️",
	};

	return (
		<div
			className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg border p-4 shadow-lg transition-all duration-300 ${
				isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
			} ${typeStyles[type]}`}
		>
			<div className="flex items-start">
				<div className="mr-3 text-lg">{iconMap[type]}</div>
				<div className="flex-1">
					<p className="font-medium text-sm">{message}</p>
				</div>
				<button
					onClick={() => {
						setIsVisible(false);
						setTimeout(onClose, 300);
					}}
					className="ml-2 text-lg leading-none opacity-70 hover:opacity-100"
				>
					×
				</button>
			</div>
		</div>
	);
}
