import React, { useCallback, useEffect, useState } from 'react';
import { CV_SECTIONS } from '../../constants/cvSections';

interface NavigationMenuProps {
	scrollContainerRef: React.RefObject<HTMLElement | null>;
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({ scrollContainerRef }) => {
	const [activeAnchor, setActiveAnchor] = useState<string>(CV_SECTIONS[0]?.anchorId ?? '');

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const visibleEntry = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

				if (visibleEntry?.target?.id) {
					setActiveAnchor(visibleEntry.target.id);
				}
			},
			{
				root: container,
				threshold: 0.25,
				rootMargin: '-20% 0px -60% 0px',
			},
		);

		const targets: HTMLElement[] = [];
		CV_SECTIONS.forEach((section) => {
			const element = container.querySelector<HTMLElement>(`#${section.anchorId}`);
			if (element) {
				targets.push(element);
				observer.observe(element);
			}
		});

		return () => {
			targets.forEach((element) => observer.unobserve(element));
			observer.disconnect();
		};
	}, [scrollContainerRef]);

	const handleNavigate = useCallback(
		(anchorId: string) => {
			const container = scrollContainerRef.current;
			if (!container) {
				return;
			}

			const target = container.querySelector<HTMLElement>(`#${anchorId}`);
			if (target) {
				target.scrollIntoView({ behavior: 'smooth', block: 'start' });
				setActiveAnchor(anchorId);
			}
		},
		[scrollContainerRef],
	);

	if (!CV_SECTIONS.length) {
		return null;
	}

	return (
		<div className="mb-4">
			<div className="rounded-2xl border border-theme bg-white/95 backdrop-blur px-4 py-3 shadow-sm">
				<nav className="flex gap-2 overflow-x-auto text-sm font-medium pb-1">
					{CV_SECTIONS.map((section) => {
						const isActive = activeAnchor === section.anchorId;
						return (
							<button
								key={section.anchorId}
								type="button"
								onClick={() => handleNavigate(section.anchorId)}
								className={`whitespace-nowrap rounded-xl px-4 py-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
									isActive
										? 'bg-green text-white shadow-lg shadow-blue-600/30'
										: 'bg-[var(--bg-raised)]/70 text-secondary-color hover:text-green-house'
								}`}
								aria-pressed={isActive}
							>
								{section.label}
							</button>
						);
					})}
				</nav>
			</div>
		</div>
	);
};

export default NavigationMenu;
