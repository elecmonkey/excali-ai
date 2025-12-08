"use client";

export function LoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          Thinking...
        </div>
      </div>
    </div>
  );
}
