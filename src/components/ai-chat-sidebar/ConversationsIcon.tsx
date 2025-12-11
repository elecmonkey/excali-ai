export function ConversationsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 16 16"
      className={className}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <polygon points="14.25 14.25 14.25 5.25 4.75 5.25 4.75 11.25 10.75 11.25" />
        <path d="m4.75 7.25-3 3v-8.5h10v3" />
      </g>
    </svg>
  );
}
