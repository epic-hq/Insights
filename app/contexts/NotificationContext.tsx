import { createContext, type ReactNode, useContext, useState } from "react";
import Notification from "~/components/ui/Notification";

interface NotificationData {
	id: string;
	message: string;
	type: "success" | "error" | "info";
	duration?: number;
}

interface NotificationContextType {
	showNotification: (message: string, type: "success" | "error" | "info", duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
	const [notifications, setNotifications] = useState<NotificationData[]>([]);

	const showNotification = (message: string, type: "success" | "error" | "info", duration = 5000) => {
		const id = Math.random().toString(36).substr(2, 9);
		const notification: NotificationData = { id, message, type, duration };

		setNotifications((prev) => [...prev, notification]);
	};

	const removeNotification = (id: string) => {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
	};

	return (
		<NotificationContext.Provider value={{ showNotification }}>
			{children}
			<div className="fixed top-0 right-0 z-50 space-y-2 p-4">
				{notifications.map((notification, index) => (
					<div key={notification.id} style={{ top: `${index * 80}px` }} className="relative">
						<Notification
							message={notification.message}
							type={notification.type}
							duration={notification.duration}
							onClose={() => removeNotification(notification.id)}
						/>
					</div>
				))}
			</div>
		</NotificationContext.Provider>
	);
}

export function useNotification() {
	const context = useContext(NotificationContext);
	if (context === undefined) {
		throw new Error("useNotification must be used within a NotificationProvider");
	}
	return context;
}
