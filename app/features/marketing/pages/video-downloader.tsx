/**
 * Apollo Video Downloader — bookmarklet utility page
 *
 * Public page at /video-downloader that provides a drag-to-bookmark tool
 * for downloading call recordings from Apollo.io share links.
 */

import type { LinksFunction, MetaFunction } from "react-router";
import MarketingNav from "~/components/navigation/MarketingNav";

export const meta: MetaFunction = () => {
	return [
		{ title: "Video Downloader | UpSight" },
		{
			name: "description",
			content:
				"Download call recordings from Apollo.io with one click. Drag the bookmarklet to your bookmarks bar and download videos from any Apollo share link.",
		},
	];
};

export const links: LinksFunction = () => [
	{
		rel: "canonical",
		href: "https://getupsight.com/video-downloader",
	},
];

// The bookmarklet JS — minified into a javascript: URL
// What it does:
// 1. Finds <video> or <source src="..."> on the page
// 2. Grabs the direct media URL (e.g. GCS signed URL)
// 3. Creates a hidden <a download> and clicks it to trigger browser download
// 4. Names file using conversation ID from the URL hash
const BOOKMARKLET_CODE = `javascript:void(function(){try{var v=document.querySelector('video[src],video source[src],source[src]');if(!v){var vids=document.querySelectorAll('video');for(var i=0;i<vids.length;i++){var s=vids[i].querySelector('source[src]');if(s){v=s;break}if(vids[i].src){v=vids[i];break}}}if(!v){alert('No video found on this page. Make sure the recording has loaded.');return}var url=v.src||v.getAttribute('src');if(!url||url.startsWith('blob:')){alert('Video uses a blob URL that cannot be downloaded directly. Try: right-click the video > Save Video As.');return}var name='apollo-recording';try{var m=window.location.hash.match(/conversation[s-]*(?:shares)?\\/([a-f0-9-]+)/i);if(m)name=m[1]}catch(e){}var ext=url.match(/\\.(mp4|webm|mov)/i);ext=ext?ext[1]:'mp4';var a=document.createElement('a');a.href=url;a.download=name+'.'+ext;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a)},1000)}catch(e){alert('Error: '+e.message)}})()`;

export default function VideoDownloaderPage() {
	return (
		<div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
			<MarketingNav />
			<main className="flex-1">
				<div className="container mx-auto max-w-2xl px-4 py-12 md:py-20">
					{/* Header */}
					<div className="mb-10 text-center">
						<h1 className="mb-3 font-bold text-3xl tracking-tight md:text-4xl">Video Downloader</h1>
						<p className="text-lg text-slate-600 dark:text-slate-400">
							Download call recordings from Apollo.io share links with one click.
						</p>
					</div>

					{/* Bookmarklet drag area */}
					<div className="mb-12 rounded-2xl border-2 border-slate-300 border-dashed bg-white/60 px-8 py-10 text-center backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/60">
						<p className="mb-5 font-medium text-slate-700 text-sm dark:text-slate-300">
							Drag this button to your bookmarks bar
						</p>
						{/* biome-ignore lint: bookmarklet requires href with javascript: */}
						<a
							href={BOOKMARKLET_CODE}
							className="inline-block cursor-grab select-none rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-7 py-3 font-semibold text-base text-white shadow-blue-500/25 shadow-lg transition-opacity hover:opacity-90 active:cursor-grabbing"
							onClick={(e) => {
								e.preventDefault();
								alert(
									"Don't click — drag this button to your bookmarks bar! If you can't see the bookmarks bar, press Cmd+Shift+B (Mac) or Ctrl+Shift+B (Windows)."
								);
							}}
						>
							Download Apollo Video
						</a>
						<p className="mt-4 text-slate-500 text-xs dark:text-slate-500">
							Can't see the bookmarks bar?{" "}
							<kbd className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-700">
								Cmd+Shift+B
							</kbd>{" "}
							(Mac) or{" "}
							<kbd className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-700">
								Ctrl+Shift+B
							</kbd>{" "}
							(Windows)
						</p>
					</div>

					{/* Steps */}
					<div className="space-y-10">
						<section>
							<h2 className="mb-5 font-semibold text-xl">
								Setup <span className="font-normal text-slate-500 text-sm">(one time)</span>
							</h2>
							<ol className="space-y-4">
								<Step n={1}>
									<strong>Show your bookmarks bar</strong> if it's hidden.
									<br />
									<span className="text-slate-500">
										Chrome/Brave:{" "}
										<kbd className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">
											Cmd+Shift+B
										</kbd>{" "}
										(Mac) or{" "}
										<kbd className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">
											Ctrl+Shift+B
										</kbd>{" "}
										(Windows)
									</span>
								</Step>
								<Step n={2}>
									<strong>Drag the purple button</strong> above onto your bookmarks bar.
									<br />
									<span className="text-slate-500">You'll see "Download Apollo Video" appear as a bookmark.</span>
								</Step>
							</ol>
						</section>

						<section>
							<h2 className="mb-5 font-semibold text-xl">To download a recording</h2>
							<ol className="space-y-4">
								<Step n={1}>
									<strong>Open the Apollo share link</strong> in your browser.
									<br />
									<span className="text-slate-500">
										Make sure you're logged into Apollo and can see the video player.
									</span>
								</Step>
								<Step n={2}>
									<strong>Wait for the video to load</strong> — you should see the video player on the page.
								</Step>
								<Step n={3}>
									<strong>Click "Download Apollo Video"</strong> in your bookmarks bar.
									<br />
									<span className="text-slate-500">
										The video file will start downloading to your Downloads folder.
									</span>
								</Step>
								<Step n={4}>
									<strong>Upload the downloaded file</strong> to UpSight using the file upload option.
								</Step>
							</ol>
						</section>
					</div>

					{/* Note */}
					<div className="mt-10 rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-amber-900 text-sm dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
						<strong>Note:</strong> You must be logged into Apollo.io in the same browser for this to work. The
						bookmarklet finds the video URL on the page and triggers a download — it does not send any data anywhere.
					</div>
				</div>
			</main>
		</div>
	);
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
	return (
		<li className="flex gap-4">
			<span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 font-bold text-purple-700 text-sm dark:bg-purple-900/40 dark:text-purple-300">
				{n}
			</span>
			<div className="pt-0.5 text-[15px] leading-relaxed">{children}</div>
		</li>
	);
}
