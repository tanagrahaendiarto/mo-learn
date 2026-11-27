"use client";

/**
 * Global error boundary — menampilkan ErrorState yang ramah saat data
 * gagal diambil (backend mati, timeout proxy, provider error).
 * Tidak pernah mengganti error dengan fixture demo.
 */

import { ErrorState } from "@/components/states";
import { PixelButton } from "@/components/PixelButton";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[48rem] px-md py-3xl md:px-xl">
      <ErrorState
        title="Unable to Load Data"
        description={
          error.message ||
          "The biological data service is unreachable. Check that the backend is running, then try again."
        }
        action={
          <div className="mt-md flex flex-wrap justify-center gap-sm">
            <PixelButton variant="primary" size="md" onClick={reset}>
              Try Again
            </PixelButton>
          </div>
        }
      />
    </main>
  );
}
