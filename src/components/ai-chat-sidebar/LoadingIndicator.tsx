"use client";

export function LoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-secondary">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          Thinking...
        </div>
      </div>
    </div>
  );
}
