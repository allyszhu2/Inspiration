interface IconProps {
  size?: number;
  filled?: boolean;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const SearchIcon = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.8-3.8" />
  </svg>
);

export const GridIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
  </svg>
);

export const ListIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M9 6h12M9 12h12M9 18h12" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth={2.6} />
  </svg>
);

export const TimelineIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3v18" />
    <circle cx="12" cy="7" r="2.2" fill="currentColor" stroke="none" />
    <path d="M12 7h6M12 14h-6" />
    <circle cx="12" cy="14" r="2.2" fill="currentColor" stroke="none" />
  </svg>
);

export const PlusIcon = ({ size = 26 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const StarIcon = ({ size = 16, filled = false }: IconProps) => (
  <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
    <path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z" />
  </svg>
);

export const SparkIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z" />
  </svg>
);

export const CloseIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const CameraIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 8h2.5l1.8-2.5h7.4L17.5 8H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.4" />
  </svg>
);

export const PhotoIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 18 5-5 3 3 4-4 4 4" />
  </svg>
);

export const QuoteIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 15a5 5 0 0 1 5-9v4a5 5 0 0 1-5 5zM14 15a5 5 0 0 1 5-9v4a5 5 0 0 1-5 5z" />
  </svg>
);

export const LinkIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M10 14a4 4 0 0 0 6 .4l3-3a4 4 0 1 0-5.7-5.7l-1.2 1.2" />
    <path d="M14 10a4 4 0 0 0-6-.4l-3 3a4 4 0 1 0 5.7 5.7l1.2-1.2" />
  </svg>
);

export const NoteIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);

export const MoreIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);
