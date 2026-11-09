import { useCallback, useContext, useEffect, useState } from "react";
import { AppContext } from "../app/state";
import { errorMessage } from "../api/client";
import type { ToastOptions } from "../app/toast";

/** Operation feedback is emitted at action time, including identical retries. */
export function useFeedbackState(tone: ToastOptions["tone"] = "error") {
  const app = useContext(AppContext);
  const toast = app?.toast;
  const [message, setMessage] = useState("");
  const report = useCallback(
    (text: string) => {
      setMessage(text);
      if (text) toast?.(text, { tone });
    },
    [toast, tone],
  );
  return [message, report] as const;
}

/** Compatibility boundary for controllers that expose an Error as state. */
export function ToastError({ error }: { error: unknown }) {
  const app = useContext(AppContext);
  const toast = app?.toast;
  useEffect(() => {
    if (error)
      toast?.(typeof error === "string" ? error : errorMessage(error), {
        tone: "error",
      });
  }, [error, toast]);
  return null;
}
