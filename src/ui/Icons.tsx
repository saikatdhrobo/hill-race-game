import type { SVGProps } from 'react';

const base = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 4.5 19 12 7 19.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="6" y="4.5" width="4" height="15" rx="1.4" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const RestartIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M20 11a8 8 0 1 0-2.6 6.4" />
    <path d="M20 4.5V11h-6.2" />
  </svg>
);

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
  </svg>
);

export const GearIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 2.6 15H2.5a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 2.6h.1A2 2 0 1 1 13 2.6V2.6a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21.4 9v.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.9 1.9z" />
  </svg>
);

export const CoinIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" fill="url(#coinGrad)" stroke="none" />
    <circle cx="12" cy="12" r="5.4" opacity="0.5" />
    <defs>
      <linearGradient id="coinGrad" x1="6" y1="4" x2="18" y2="20">
        <stop offset="0" stopColor="#ffe9a8" />
        <stop offset="0.55" stopColor="#ffbe3d" />
        <stop offset="1" stopColor="#d8890b" />
      </linearGradient>
    </defs>
  </svg>
);

export const LockIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2.2}>
    <rect x="4.5" y="10" width="15" height="10.5" rx="2.4" />
    <path d="M8.2 10V7.6a3.8 3.8 0 0 1 7.6 0V10" />
  </svg>
);

export const GasIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 20h10" />
    <path d="M7 20V6.4A2.4 2.4 0 0 1 9.4 4h3.2A2.4 2.4 0 0 1 15 6.4V20" />
    <path d="M7 11h8" />
    <path d="M17 9.5v6.2a2.3 2.3 0 0 0 4.5 0V9.2l-2.6-2.6" />
  </svg>
);

export const BrakeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="7.4" />
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    <path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2" />
  </svg>
);

export const TiltUpIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 16.5a8 8 0 0 1 15 0" />
    <path d="M17.4 13.6 19.8 16.6 16.2 16.4" fill="currentColor" stroke="none" />
    <path d="M8 16.5h.01" />
  </svg>
);

export const TiltDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 9.5a8 8 0 0 1 15 0" />
    <path d="M17.4 12.4 19.8 9.4 16.2 9.6" fill="currentColor" stroke="none" />
    <path d="M8 9.5h.01" />
  </svg>
);

export const SoundOnIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3.2L12 5.2v13.6L7.2 14.5H4z" />
    <path d="M16 8.8a4.4 4.4 0 0 1 0 6.4" />
    <path d="M18.8 6.4a7.8 7.8 0 0 1 0 11.2" />
  </svg>
);

export const SoundOffIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3.2L12 5.2v13.6L7.2 14.5H4z" />
    <path d="m16.5 9.5 5 5M21.5 9.5l-5 5" />
  </svg>
);

export const FlagIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 21V4" />
    <path d="M6 4.8h10.5l-1.8 3.6 1.8 3.6H6z" fill="currentColor" stroke="none" opacity="0.9" />
  </svg>
);

export const MountainIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 19 9 7l3.6 6.6L15 9.5 21 19z" />
  </svg>
);
