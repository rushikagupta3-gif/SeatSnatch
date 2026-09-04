export function PlaneIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M21 16v-2l-8-5V4.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2.5 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function LogoMark({ className = "w-8 h-8" }) {
  return (
    <div
      className={`${className} rounded-xl flex items-center justify-center shrink-0`}
      style={{ background: "linear-gradient(135deg, var(--navy), var(--chestnut))" }}
    >
      <PlaneIcon className="w-4 h-4 text-white rotate-45" />
    </div>
  );
}
