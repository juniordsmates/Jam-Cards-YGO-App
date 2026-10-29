const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const SearchIcon = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

export const DeckIcon = () => (
  <svg {...base}>
    <rect x="7" y="3" width="12" height="16" rx="2" />
    <path d="M5 6.5v12A2.5 2.5 0 0 0 7.5 21H15" />
    <path d="m11 9 2 2 2-2" />
  </svg>
);

export const CollectionIcon = () => (
  <svg {...base}>
    <rect x="3" y="10" width="18" height="11" rx="2" />
    <path d="M7 10V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V10" />
    <path d="M10 14.5h4" />
  </svg>
);

export const HelpIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.9" />
    <path d="M12 17.2h.01" />
  </svg>
);

export const ComboIcon = () => (
  <svg {...base}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="8" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <path d="M8.3 7.1 15.6 7.6M7.2 8.2l3.6 7.7M16.9 10.2l-3.7 5.9" />
  </svg>
);

export const ExitIcon = () => (
  <svg {...base}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 16l-4-4 4-4" />
    <path d="M6 12h10" />
  </svg>
);

export const BackIcon = () => (
  <svg {...base}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
