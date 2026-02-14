export function MarqueeTips({ tips, className = "" }: { tips: string[]; className?: string }) {
	if (!tips || tips.length === 0) return null;

	const duplicatedTips = tips.concat(tips).map((tip, index) => ({ tip, id: `${tip}-${index}` }));
	return (
		<div className={`relative overflow-hidden ${className}`}>
			<div className="animate-marquee whitespace-nowrap text-slate-600 text-xs will-change-transform">
				{duplicatedTips.map(({ tip, id }) => (
					<span key={id} className="mx-6 inline-flex items-center">
						{tip}
					</span>
				))}
			</div>
			<style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 14s linear infinite;
        }
      `}</style>
		</div>
	);
}
