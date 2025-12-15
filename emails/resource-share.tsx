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

type ResourceShareEmailProps = {
        appName?: string
        inviterName?: string
        resourceName: string
        resourceType: string
        resourceUrl: string
        note?: string
}

export default function ResourceShareEmail({
        appName = "Upsight",
        inviterName = "A teammate",
        resourceName,
        resourceType,
        resourceUrl,
        note,
}: ResourceShareEmailProps) {
        const previewText = `${inviterName} shared a ${resourceType} with you on ${appName}`

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
                                                        {inviterName} shared a {resourceType}
                                                </Heading>
                                                <Text style={muted}>{resourceName}</Text>

                                                {note ? <Text style={text}>{note}</Text> : null}

                                                <Section style={ctaSection}>
                                                        <Button href={resourceUrl} style={button}>
                                                                Open {resourceType}
                                                        </Button>
                                                </Section>

                                                <Text style={muted}>
                                                        If the button above doesn’t work, copy and paste this link into your browser:
                                                </Text>
                                                <Link href={resourceUrl} style={link}>
                                                        {resourceUrl}
                                                </Link>

                                                <Hr style={hr} />

                                                <Text style={muted}>
                                                        You’re receiving this email because a teammate wanted you to review this {resourceType} in
                                                        {" "}
                                                        {appName}. If this wasn’t expected, you can ignore this email.
                                                </Text>
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
