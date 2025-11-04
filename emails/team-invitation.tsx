import * as React from "react"
import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components"

type InvitationEmailProps = {
	appName?: string
	inviterName?: string
	teamName?: string
	inviteUrl: string
	supportEmail?: string
	inviteeEmail?: string | null
}

export default function InvitationEmail({
	appName = "Upsight",
	inviterName = "A teammate",
	teamName = "Upsight team",
	inviteUrl = "https://getupsight.com",
	supportEmail = "support@getupsight.com",
	inviteeEmail,
}: InvitationEmailProps) {
	const previewText = `${inviterName} invited you to join ${teamName} on ${appName}`

	return (
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Section style={header}>
						<Heading style={h1}>{appName}</Heading>
					</Section>

					<Section style={content}>
						<Heading as="h2" style={h2}>
							You’re invited to join {teamName}
						</Heading>
						{inviteeEmail ? (
							<Text style={muted}>Invitation for {inviteeEmail}</Text>
						) : null}

						<Text style={text}>
							{inviterName} has invited you to collaborate with the team <strong>{teamName}</strong> on {appName}.
						</Text>

						<Section style={ctaSection}>
							<Button href={inviteUrl} style={button}>
								Accept invitation
							</Button>
						</Section>

						<Text style={muted}>
							If the button above doesn’t work, copy and paste this link into your browser:
						</Text>
						<Link href={inviteUrl} style={link}>
							{inviteUrl}
						</Link>

						<Hr style={hr} />

						<Text style={muted}>
							If you didn’t expect this invitation, you can safely ignore this email or contact us at {" "}
							<Link href={`mailto:${supportEmail}`} style={link}>
								{supportEmail}
							</Link>
							.
						</Text>
					</Section>

					<Section style={footer}>
						<Text style={footnote}>© {new Date().getFullYear()} {appName}. All rights reserved.</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}

const main: React.CSSProperties = {
	backgroundColor: "#f7f7f8",
	margin: 0,
	padding: 24,
	WebkitFontSmoothing: "antialiased",
	MozOsxFontSmoothing: "grayscale",
	fontFamily:
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif",
}

const container: React.CSSProperties = {
	maxWidth: 560,
	margin: "0 auto",
	backgroundColor: "#ffffff",
	borderRadius: 12,
	overflow: "hidden",
	border: "1px solid #ececee",
}

const header: React.CSSProperties = {
	background: "#ffffff",
	color: "#111111",
	padding: "20px 24px",
	borderBottom: "1px solid #ececee",
}

const content: React.CSSProperties = {
	padding: "24px",
}

const h1: React.CSSProperties = {
	margin: 0,
	fontSize: 18,
	fontWeight: 600,
	letterSpacing: "-0.01em",
}

const h2: React.CSSProperties = {
	margin: 0,
	marginBottom: 8,
	fontSize: 20,
	lineHeight: 1.3,
	letterSpacing: "-0.01em",
}

const text: React.CSSProperties = {
	margin: "8px 0 16px",
	lineHeight: 1.6,
	color: "#222222",
	fontSize: 14,
}

const ctaSection: React.CSSProperties = {
	margin: "20px 0 8px",
}

const button: React.CSSProperties = {
	backgroundColor: "#111111",
	color: "#ffffff",
	padding: "12px 16px",
	borderRadius: 8,
	textDecoration: "none",
	display: "inline-block",
	fontWeight: 600,
}

const link: React.CSSProperties = {
	color: "#111111",
	textDecoration: "underline",
	wordBreak: "break-all",
}

const hr: React.CSSProperties = {
	borderColor: "#ececee",
	margin: "20px 0",
}

const muted: React.CSSProperties = {
	color: "#6b7280",
	fontSize: 13,
}

const footer: React.CSSProperties = {
	padding: "0 24px 24px",
}

const footnote: React.CSSProperties = {
	color: "#888",
	fontSize: 12,
}
