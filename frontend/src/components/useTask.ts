import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { accessPromptPresented, errorMessage } from "../api/client";
import { useRef } from "react";
export function useTask(
  message?: string,
  after?: () => void,
  keys: string[] = [],
) {
  const { toast } = useApp(),
    cache = useQueryClient(),
    locked = useRef(false);
  const task = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      await Promise.all(
        keys.map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
      if (message) toast(message, { tone: "success" });
      after?.();
    },
    onError: (error) => toast(errorMessage(error), { tone: "error" }),
    onSettled: () => {
      locked.current = false;
    },
  });
  return {
    ...task,
    error: accessPromptPresented(task.error) ? null : task.error,
    errorText: task.error ? errorMessage(task.error) : "",
    run: (fn: () => Promise<unknown>) => {
      if (!locked.current) {
        locked.current = true;
        task.mutate(fn);
      }
    },
  };
}
