/**
 * Terms of Service Page for DeepLight
 * Comprehensive terms covering account usage, acceptable use, IP, liability, and more
 */

import { Link, type MetaFunction } from "react-router";
import MainNav from "~/components/navigation/MainNav";

export const meta: MetaFunction = () => {
	return [
		{ title: "Terms of Service | DeepLight" },
		{
			name: "description",
			content:
				"DeepLight Terms of Service - The agreement governing your use of our conversation intelligence platform.",
		},
	];
};

export default function TermsOfServicePage() {
	const lastUpdated = "January 2025";
	const effectiveDate = "January 2025";

	return (
		<div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
			<MainNav />
			<main className="flex-1">
				<div className="container mx-auto max-w-4xl px-4 py-12 md:py-16">
					<div className="mb-8">
						<h1 className="mb-4 font-bold text-4xl tracking-tight md:text-5xl">Terms of Service</h1>
						<p className="text-slate-600">Last updated: {lastUpdated}</p>
						<p className="text-slate-600">Effective date: {effectiveDate}</p>
					</div>

					<div className="prose prose-slate max-w-none">
						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">1. Agreement to Terms</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								These Terms of Service ("Terms") constitute a legally binding agreement between you ("you" or "User")
								and DeepLight ("we," "us," or "Company") governing your access to and use of the DeepLight conversation
								intelligence platform, including any associated websites, applications, and services (collectively, the
								"Service").
							</p>
							<p className="mb-4 text-slate-700 leading-relaxed">
								By accessing or using the Service, you agree to be bound by these Terms and our Privacy Policy. If you
								are using the Service on behalf of an organization, you represent that you have authority to bind that
								organization to these Terms, and "you" refers to both you individually and the organization.
							</p>
							<p className="mb-4 text-slate-700 leading-relaxed">
								If you do not agree to these Terms, you may not access or use the Service.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">2. Description of Service</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								DeepLight is a conversation intelligence platform that enables users to:
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>Record, upload, and transcribe audio and video content</li>
								<li>Analyze conversations using AI-powered tools</li>
								<li>Extract insights, themes, and evidence from recorded content</li>
								<li>Organize and manage research interviews and customer conversations</li>
								<li>Collaborate with team members on analysis and insights</li>
							</ul>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">3. Account Registration and Security</h2>

							<h3 className="mb-3 font-semibold text-xl">3.1 Account Creation</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								To use certain features of the Service, you must register for an account. You agree to:
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>Provide accurate, current, and complete information during registration</li>
								<li>Maintain and promptly update your account information</li>
								<li>Maintain the security and confidentiality of your login credentials</li>
								<li>Be at least 18 years of age (or 16 with parental consent where permitted)</li>
								<li>Accept responsibility for all activities that occur under your account</li>
							</ul>

							<h3 className="mb-3 font-semibold text-xl">3.2 Account Security</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								You are responsible for maintaining the confidentiality of your account credentials. You must notify us
								immediately at{" "}
								<a href="mailto:security@deeplight.io" className="text-orange-600 hover:underline">
									security@deeplight.io
								</a>{" "}
								if you become aware of any unauthorized access to or use of your account.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">4. Subscription and Payment</h2>

							<h3 className="mb-3 font-semibold text-xl">4.1 Subscription Plans</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								The Service is offered under various subscription plans with different features and pricing. Details of
								current plans are available on our pricing page. We reserve the right to modify our plans and pricing
								with reasonable notice.
							</p>

							<h3 className="mb-3 font-semibold text-xl">4.2 Payment Terms</h3>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>Subscription fees are billed in advance on a monthly or annual basis</li>
								<li>Payment is due at the start of each billing period</li>
								<li>All fees are non-refundable except as expressly stated herein or required by law</li>
								<li>You are responsible for all applicable taxes</li>
							</ul>

							<h3 className="mb-3 font-semibold text-xl">4.3 Automatic Renewal</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Subscriptions automatically renew at the end of each billing period unless cancelled. You may cancel
								your subscription at any time through your account settings. Cancellation takes effect at the end of the
								current billing period.
							</p>

							<h3 className="mb-3 font-semibold text-xl">4.4 Free Trials</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								We may offer free trials. At the end of a trial period, your account will automatically convert to a
								paid subscription unless you cancel before the trial ends. We will notify you before conversion and
								provide instructions for cancellation.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">5. User Content and Data</h2>

							<h3 className="mb-3 font-semibold text-xl">5.1 Your Content</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								"User Content" means any audio, video, text, transcripts, documents, or other materials you upload,
								submit, or create using the Service. You retain all ownership rights in your User Content.
							</p>

							<h3 className="mb-3 font-semibold text-xl">5.2 License Grant</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								By uploading User Content, you grant us a limited, non-exclusive, worldwide license to use, process,
								store, and display your User Content solely to provide the Service to you. This license terminates when
								you delete your User Content or close your account.
							</p>

							<h3 className="mb-3 font-semibold text-xl">5.3 AI and Machine Learning</h3>
							<p className="mb-4 rounded-lg border-orange-500 border-l-4 bg-orange-50 p-4 text-slate-700">
								<strong>Important:</strong> We do NOT use your User Content to train our artificial intelligence or
								machine learning models. Your recordings, transcripts, and insights remain confidential and are used
								solely to provide the Service to you.
							</p>

							<h3 className="mb-3 font-semibold text-xl">5.4 Content Responsibilities</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">You represent and warrant that:</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>You own or have the necessary rights to your User Content</li>
								<li>Your User Content does not violate any third-party rights</li>
								<li>Your User Content complies with all applicable laws and these Terms</li>
								<li>
									You have obtained all necessary consents from individuals whose voices or images appear in your
									recordings
								</li>
							</ul>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">6. Recording Consent and Compliance</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								If you use DeepLight to record conversations, you acknowledge and agree that:
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>
									<strong>Consent Requirements:</strong> You are solely responsible for obtaining all legally required
									consents before recording any conversation. Laws regarding recording consent vary by jurisdiction;
									many require consent from all parties.
								</li>
								<li>
									<strong>Compliance:</strong> You will comply with all applicable federal, state, local, and
									international laws regarding the recording of conversations.
								</li>
								<li>
									<strong>Notice:</strong> You will provide appropriate notice to participants that a conversation is
									being recorded.
								</li>
								<li>
									<strong>Prohibited Recordings:</strong> You will not record conversations where recording is
									prohibited by law or where you have not obtained necessary consents.
								</li>
							</ul>
							<p className="mb-4 text-slate-700 leading-relaxed">
								DeepLight provides consent management tools to assist you, but these tools do not substitute for your
								legal obligations.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">7. Acceptable Use Policy</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">You agree not to use the Service to:</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>Violate any applicable law, regulation, or third-party rights</li>
								<li>Upload content that is illegal, defamatory, obscene, threatening, or harassing</li>
								<li>Infringe any intellectual property rights</li>
								<li>Distribute malware, viruses, or other harmful code</li>
								<li>Attempt to gain unauthorized access to the Service, other accounts, or computer systems</li>
								<li>Interfere with or disrupt the Service or its infrastructure</li>
								<li>Reverse engineer, decompile, or disassemble any part of the Service</li>
								<li>Use the Service for competitive analysis or to build a competing product</li>
								<li>Resell, redistribute, or sublicense the Service without authorization</li>
								<li>Circumvent any access controls or usage limits</li>
								<li>Use automated systems (bots, scrapers) to access the Service without permission</li>
								<li>
									Record privileged communications (e.g., attorney-client) without appropriate consideration of
									privilege implications
								</li>
							</ul>
							<p className="mb-4 text-slate-700 leading-relaxed">
								We may investigate and take appropriate action against violations, including suspending or terminating
								your account.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">8. Intellectual Property</h2>

							<h3 className="mb-3 font-semibold text-xl">8.1 Our Intellectual Property</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								The Service, including its software, design, features, content, and documentation, is owned by DeepLight
								and protected by intellectual property laws. Except for the limited license to use the Service granted
								herein, we retain all rights, title, and interest in the Service.
							</p>

							<h3 className="mb-3 font-semibold text-xl">8.2 Trademarks</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								"DeepLight" and our logos are trademarks of DeepLight. You may not use our trademarks without our prior
								written consent.
							</p>

							<h3 className="mb-3 font-semibold text-xl">8.3 Feedback</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								If you provide suggestions, ideas, or feedback about the Service ("Feedback"), you grant us an
								unrestricted, perpetual, irrevocable license to use such Feedback for any purpose without compensation
								or attribution.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">9. Third-Party Services</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								The Service may integrate with or link to third-party services (e.g., CRM systems, calendar apps, video
								conferencing platforms). Your use of such services is governed by their own terms and privacy policies.
								We are not responsible for the content, functionality, or practices of third-party services.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">10. Disclaimer of Warranties</h2>
							<p className="mb-4 rounded-lg bg-slate-100 p-4 font-semibold text-slate-700">
								THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
								IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
								PURPOSE, TITLE, AND NON-INFRINGEMENT.
							</p>
							<p className="mb-4 text-slate-700 leading-relaxed">We do not warrant that:</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>The Service will be uninterrupted, error-free, or secure</li>
								<li>Defects will be corrected</li>
								<li>
									Transcription or AI-generated analysis will be completely accurate (accuracy may vary based on audio
									quality, accents, technical terminology, and other factors)
								</li>
								<li>The Service will meet your specific requirements</li>
							</ul>
							<p className="mb-4 text-slate-700 leading-relaxed">
								You acknowledge that AI-generated content should be reviewed and verified before relying on it for
								important decisions.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">11. Limitation of Liability</h2>
							<p className="mb-4 rounded-lg bg-slate-100 p-4 font-semibold text-slate-700">
								TO THE MAXIMUM EXTENT PERMITTED BY LAW, DEEPLIGHT SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
								SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR USE, ARISING OUT
								OF OR RELATED TO YOUR USE OF THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY.
							</p>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Our total liability for any claims arising from or related to these Terms or the Service shall not
								exceed the greater of: (a) the amounts you paid to us in the twelve (12) months preceding the claim, or
								(b) one hundred dollars ($100).
							</p>
							<p className="mb-4 text-slate-700 leading-relaxed">
								These limitations apply even if DeepLight has been advised of the possibility of such damages and even
								if a remedy fails of its essential purpose.
							</p>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the above
								limitations may not apply to you.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">12. Indemnification</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								You agree to indemnify, defend, and hold harmless DeepLight and its officers, directors, employees, and
								agents from and against any claims, liabilities, damages, losses, costs, and expenses (including
								reasonable attorneys' fees) arising out of or related to:
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>Your use of the Service</li>
								<li>Your User Content</li>
								<li>Your violation of these Terms</li>
								<li>Your violation of any applicable law or third-party rights</li>
								<li>Your failure to obtain required recording consents</li>
							</ul>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">13. Termination</h2>

							<h3 className="mb-3 font-semibold text-xl">13.1 Termination by You</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								You may terminate your account at any time through your account settings or by contacting us. Upon
								termination, you will lose access to the Service and your data.
							</p>

							<h3 className="mb-3 font-semibold text-xl">13.2 Termination by Us</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								We may suspend or terminate your access to the Service:
							</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>For violation of these Terms</li>
								<li>For non-payment of fees</li>
								<li>If required by law</li>
								<li>To protect the security or integrity of the Service</li>
								<li>For any reason with 30 days' notice (for termination without cause)</li>
							</ul>

							<h3 className="mb-3 font-semibold text-xl">13.3 Effect of Termination</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">Upon termination:</p>
							<ul className="mb-4 list-disc space-y-2 pl-6 text-slate-700">
								<li>Your right to access and use the Service immediately ceases</li>
								<li>You may request export of your data within 30 days</li>
								<li>
									We may delete your data after 30 days (or as required by our data retention policy or applicable law)
								</li>
								<li>
									Sections that by their nature should survive termination will survive (including Sections 8, 10, 11,
									12, and 14-17)
								</li>
							</ul>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">14. Dispute Resolution</h2>

							<h3 className="mb-3 font-semibold text-xl">14.1 Informal Resolution</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Before initiating formal dispute resolution, you agree to contact us at{" "}
								<a href="mailto:hello@getupsight.com" className="text-orange-600 hover:underline">
									hello@getupsight.com
								</a>{" "}
								to attempt to resolve any dispute informally.
							</p>

							<h3 className="mb-3 font-semibold text-xl">14.2 Governing Law</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								These Terms shall be governed by and construed in accordance with the laws of the State of Delaware,
								United States, without regard to its conflict of law principles.
							</p>

							<h3 className="mb-3 font-semibold text-xl">14.3 Jurisdiction</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Any legal action or proceeding arising under these Terms shall be brought exclusively in the federal or
								state courts located in Delaware, and you consent to personal jurisdiction in such courts.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">15. Changes to Terms</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								We may modify these Terms at any time. We will notify you of material changes by posting the updated
								Terms on our website and/or sending you an email. Your continued use of the Service after the effective
								date of any changes constitutes acceptance of the modified Terms.
							</p>
							<p className="mb-4 text-slate-700 leading-relaxed">
								If you do not agree to the modified Terms, you must stop using the Service before the changes take
								effect.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">16. General Provisions</h2>

							<h3 className="mb-3 font-semibold text-xl">16.1 Entire Agreement</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								These Terms, together with our Privacy Policy and any other agreements referenced herein, constitute the
								entire agreement between you and DeepLight regarding the Service.
							</p>

							<h3 className="mb-3 font-semibold text-xl">16.2 Severability</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in
								full force and effect.
							</p>

							<h3 className="mb-3 font-semibold text-xl">16.3 Waiver</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								Our failure to enforce any provision of these Terms does not constitute a waiver of that provision or
								any other provision.
							</p>

							<h3 className="mb-3 font-semibold text-xl">16.4 Assignment</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								You may not assign or transfer these Terms without our prior written consent. We may assign these Terms
								without restriction.
							</p>

							<h3 className="mb-3 font-semibold text-xl">16.5 Notices</h3>
							<p className="mb-4 text-slate-700 leading-relaxed">
								We may provide notices to you via email to the address associated with your account or by posting on our
								website.
							</p>
						</section>

						<section className="mb-10">
							<h2 className="mb-4 font-semibold text-2xl">17. Contact Information</h2>
							<p className="mb-4 text-slate-700 leading-relaxed">
								If you have questions about these Terms, please contact us:
							</p>
							<div className="rounded-lg bg-slate-100 p-6">
								<p className="mb-2 text-slate-700">
									<strong>DeepLight</strong>
								</p>
								<p className="mb-2 text-slate-700">
									Email:{" "}
									<a href="mailto:hello@getupsight.com" className="text-orange-600 hover:underline">
										hello@getupsight.com
									</a>
								</p>
								<p className="text-slate-700">
									For general support:{" "}
									<a href="mailto:hello@getupsight.com" className="text-orange-600 hover:underline">
										hello@getupsight.com
									</a>
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
	);
}
