import type { ReactNode } from "react";
import { LearningAccessProvider } from "@/components/LearningAccess";
import { IS_DEMO_MODE } from "@/lib/api";

export default function EntityLayout({ children }: { children: ReactNode }) {
  const enabled = !IS_DEMO_MODE && process.env.MOLEARN_AI_UI_ENABLED === "true";
  return <LearningAccessProvider enabled={enabled}>{children}</LearningAccessProvider>;
}
