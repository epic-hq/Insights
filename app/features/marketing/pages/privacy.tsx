/**
 * Privacy Policy Page for DeepLight
 * Comprehensive privacy policy covering data collection, usage, rights, and compliance
 */

import { Link, type MetaFunction } from "react-router"
import MainNav from "~/components/navigation/MainNav"

export const meta: MetaFunction = () => {
	return [
		{ title: "Privacy Policy | DeepLight" },
		{
			name: "description",
			content: "DeepLight Privacy Policy - Learn how we collect, use, and protect your personal information.",
		},
	]
}

export default function PrivacyPolicyPage() {
	const lastUpdated = "January 2025"

	return (
		<div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
			<MainNav />
			<main className="flex-1">
				<div className="container mx-auto max-w-4xl px-4 py-12 md:py-16">
					<div className="mb-8">
						<h1 className="mb-4 font-bold text-4xl tracking-tight md:text-5xl">Privacy Policy</h1>
						<p className="text-slate-600">Last updated: {lastUpdated}</p>
					</div>

					<div className="prose prose-slate max-w-none">
						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">1. Introduction</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								DeepLight ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains
								how we collect, use, disclose, and safeguard your information when you use our conversation intelligence
								platform and related services (collectively, the "Service").
							</p>
							<p className="mb-4 text-slate-700 leading-relaxed">
								By using our Service, you consent to the data practices described in this policy. If you do not agree
								with our policies and practices, please do not use our Service.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">2. Information We Collect</h2>

							<h3 className="mb-3 font-semibold text-xl">2.1 Information You Provide</h3>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>
									<strong>Account Information:</strong> Name, email address, company name, job title, and phone number
									when you register for an account.
								</li>
								<li>
									<strong>Audio and Video Content:</strong> Interview recordings, meeting recordings, and other
									audio/video content you upload or record through our Service.
								</li>
								<li>
									<strong>Transcripts and Analysis:</strong> Text transcriptions and AI-generated analysis of your
									audio/video content.
								</li>
								<li>
									<strong>Payment Information:</strong> Billing address and payment details (processed securely through
									our payment processor).
								</li>
								<li>
									<strong>Communications:</strong> Information you provide when contacting our support team or
									participating in surveys.
								</li>
							</ul>

							<h3 className="mb-3 font-semibold text-xl">2.2 Information Collected Automatically</h3>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>
									<strong>Usage Data:</strong> Pages visited, features used, time spent on the Service, and actions
									taken.
								</li>
								<li>
									<strong>Device Information:</strong> IP address, browser type, operating system, device identifiers,
									and screen resolution.
								</li>
								<li>
									<strong>Cookies and Tracking Technologies:</strong> Session cookies, analytics cookies, and similar
									technologies (see Section 7).
								</li>
							</ul>

							<h3 className="mb-3 font-semibold text-xl">2.3 Information from Third Parties</h3>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>
									<strong>Integration Data:</strong> Information from services you connect to DeepLight (e.g., calendar
									integrations, CRM systems).
								</li>
								<li>
									<strong>Single Sign-On:</strong> Basic profile information from identity providers if you use SSO.
								</li>
							</ul>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">3. How We Use Your Information</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">We use the information we collect to:</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>Provide, maintain, and improve our Service</li>
								<li>Process and transcribe your audio/video content</li>
								<li>Generate AI-powered insights and analysis from your content</li>
								<li>Process payments and manage your subscription</li>
								<li>Send transactional emails and service notifications</li>
								<li>Respond to your requests and provide customer support</li>
								<li>Analyze usage patterns to improve user experience</li>
								<li>Protect against fraud, abuse, and security threats</li>
								<li>Comply with legal obligations</li>
							</ul>
							<p className="mb-4 rounded-lg border-orange-500 border-l-4 bg-orange-50 p-4 text-slate-700">
								<strong>Important:</strong> We do NOT use your audio recordings, transcripts, or customer data to train
								our AI models. Your content remains yours and is only processed to provide the Service to you.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">4. How We Share Your Information</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								We do not sell your personal information. We may share your information in the following circumstances:
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>
									<strong>Service Providers:</strong> With trusted third-party vendors who assist in operating our
									Service (e.g., cloud hosting, payment processing, analytics).
								</li>
								<li>
									<strong>Within Your Organization:</strong> With other members of your team or organization as
									configured in your account settings.
								</li>
								<li>
									<strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, with
									appropriate confidentiality protections.
								</li>
								<li>
									<strong>Legal Requirements:</strong> When required by law, legal process, or government request.
								</li>
								<li>
									<strong>Protection of Rights:</strong> To protect the rights, property, or safety of DeepLight, our
									users, or the public.
								</li>
								<li>
									<strong>With Your Consent:</strong> For any other purpose with your explicit consent.
								</li>
							</ul>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">5. Data Retention</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								We retain your information for as long as your account is active or as needed to provide the Service.
								Specific retention periods:
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>
									<strong>Account Information:</strong> Retained while your account is active and for a reasonable
									period after closure for legal and business purposes.
								</li>
								<li>
									<strong>Recordings and Transcripts:</strong> Retained according to your account settings. Default
									retention is 3 years, with options for shorter periods available.
								</li>
								<li>
									<strong>Usage Data:</strong> Retained for 24 months for analytics purposes.
								</li>
								<li>
									<strong>Deleted Content:</strong> Recoverable from trash for 30 days before permanent deletion.
								</li>
							</ul>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Enterprise customers may configure custom retention policies. Upon account termination, you may request
								data export within 30 days.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">6. Your Rights and Choices</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Depending on your location, you may have the following rights regarding your personal information:
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>
									<strong>Access:</strong> Request a copy of the personal information we hold about you.
								</li>
								<li>
									<strong>Correction:</strong> Request correction of inaccurate or incomplete information.
								</li>
								<li>
									<strong>Deletion:</strong> Request deletion of your personal information (subject to legal retention
									requirements).
								</li>
								<li>
									<strong>Portability:</strong> Request a machine-readable copy of your data.
								</li>
								<li>
									<strong>Objection:</strong> Object to certain processing of your information.
								</li>
								<li>
									<strong>Restriction:</strong> Request restriction of processing in certain circumstances.
								</li>
								<li>
									<strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent.
								</li>
							</ul>
							<p className="mb-4 text-slate-700 leading-relaxed">
								To exercise these rights, please contact us at{" "}
								<a href="mailto:privacy@deeplight.io" className="text-orange-600 hover:underline">
									privacy@deeplight.io
								</a>
								. We will respond to your request within 30 days.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">7. Cookies and Tracking Technologies</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">We use the following types of cookies:</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>
									<strong>Essential Cookies:</strong> Required for the Service to function properly (e.g.,
									authentication, security).
								</li>
								<li>
									<strong>Analytics Cookies:</strong> Help us understand how visitors interact with our Service to
									improve user experience.
								</li>
								<li>
									<strong>Preference Cookies:</strong> Remember your settings and preferences.
								</li>
							</ul>
							<p className="mb-4 text-slate-700 leading-relaxed">
								You can control cookies through your browser settings. Note that disabling certain cookies may affect
								the functionality of the Service.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">8. Data Security</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								We implement industry-standard security measures to protect your information:
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>Encryption of data in transit (TLS 1.2+) and at rest (AES-256)</li>
								<li>Regular security assessments and penetration testing</li>
								<li>Access controls and authentication requirements</li>
								<li>Secure data centers with SOC 2 Type II certification</li>
								<li>Employee security training and background checks</li>
							</ul>
							<p className="mb-4 text-slate-700 leading-relaxed">
								While we strive to protect your information, no method of transmission over the Internet is 100% secure.
								We cannot guarantee absolute security.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">9. International Data Transfers</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Your information may be transferred to and processed in countries other than your own. We ensure
								appropriate safeguards are in place, including:
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
								<li>Data Processing Agreements with all subprocessors</li>
								<li>Compliance with applicable data protection frameworks</li>
							</ul>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">10. Recording Consent</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								If you use DeepLight to record conversations, you are responsible for obtaining appropriate consent from
								all participants in accordance with applicable laws. Many jurisdictions require all-party consent for
								recording conversations. DeepLight provides tools to help you obtain and document consent, but the legal
								responsibility remains with you.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">11. California Privacy Rights (CCPA/CPRA)</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								California residents have additional rights under the California Consumer Privacy Act (CCPA) and
								California Privacy Rights Act (CPRA):
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>Right to know what personal information is collected and how it's used</li>
								<li>Right to delete personal information (with certain exceptions)</li>
								<li>Right to opt-out of the sale or sharing of personal information</li>
								<li>Right to correct inaccurate personal information</li>
								<li>Right to limit use of sensitive personal information</li>
								<li>Right to non-discrimination for exercising privacy rights</li>
							</ul>
							<p className="mb-4 text-slate-700 leading-relaxed">
								We do not sell personal information as defined under CCPA/CPRA.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">12. European Privacy Rights (GDPR)</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you have
								additional rights under the General Data Protection Regulation (GDPR):
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>
									<strong>Legal Basis:</strong> We process your data based on contract performance, legitimate
									interests, legal obligations, or your consent.
								</li>
								<li>
									<strong>Data Protection Authority:</strong> You have the right to lodge a complaint with your local
									supervisory authority.
								</li>
								<li>
									<strong>Data Protection Officer:</strong> You may contact our DPO at{" "}
									<a href="mailto:dpo@deeplight.io" className="text-orange-600 hover:underline">
										dpo@deeplight.io
									</a>
								</li>
							</ul>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">13. Children's Privacy</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Our Service is not intended for children under 16 years of age. We do not knowingly collect personal
								information from children under 16. If we learn we have collected information from a child under 16, we
								will delete it promptly. If you believe we have collected information from a child, please contact us.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">14. Changes to This Policy</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								We may update this Privacy Policy from time to time. We will notify you of material changes by posting
								the new policy on this page and updating the "Last Updated" date. For significant changes, we will
								provide additional notice via email or through the Service.
							</p>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Your continued use of the Service after any changes constitutes acceptance of the updated policy.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">15. Contact Us</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								If you have questions about this Privacy Policy or our data practices, please contact us:
							</p>
							<div className="rounded-lg bg-slate-100 p-6">
								<p className="mb-2 text-slate-700">
									<strong>DeepLight</strong>
								</p>
								<p className="mb-2 text-slate-700">
									Email:{" "}
									<a href="mailto:privacy@deeplight.io" className="text-orange-600 hover:underline">
										privacy@deeplight.io
									</a>
								</p>
								<p className="text-slate-700">
									For data subject requests, please email{" "}
									<a href="mailto:privacy@deeplight.io" className="text-orange-600 hover:underline">
										privacy@deeplight.io
									</a>{" "}
									with the subject line "Data Subject Request."
								</p>
							</div>
						</section>
					</div>
				</div>
			</main>

			<footer className="flex w-full shrink-0 flex-col items-center gap-2 border-t bg-white px-4 py-6 text-gray-600 sm:flex-row md:px-6">
				<p className="text-xs">&copy; 2025 DeepLight. All rights reserved.</p>
				<nav className="flex gap-4 sm:ml-auto sm:gap-6">
					<Link to="/terms" className="text-xs underline-offset-4 hover:underline">
						Terms of Service
					</Link>
					<Link to="/privacy" className="text-xs underline-offset-4 hover:underline">
						Privacy
					</Link>
					<Link to="/about" className="text-xs underline-offset-4 hover:underline">
						About
					</Link>
				</nav>
			</footer>
		</div>
	)
}
