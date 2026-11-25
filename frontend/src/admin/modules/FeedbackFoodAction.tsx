import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { errorMessage } from "../../api/client";
import { FoodEditor } from "./FoodEditor";
import { FoodOwnerTransfer } from "./FoodOwnerTransfer";

export type FoodAction = "edit" | "transfer";

/** Loads the dish a case is about, then opens the same drawer as 菜品管理. */
export function FeedbackFoodAction({
  id,
  action,
  onClose,
}: {
  id: number;
  action: FoodAction;
  onClose: () => void;
}) {
  const { api, toast } = useApp();
  const { data, error } = useQuery({
    queryKey: ["foods", "feedback-target", id],
    queryFn: () => api.food(id),
    // Edits are sent as a diff, so every opening starts from a fresh read.
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const failure = data ? null : error;
  const fail = useRef(() => {});
  fail.current = () => {
    toast(errorMessage(failure), { tone: "error" });
    onClose();
  };
  useEffect(() => {
    if (failure) fail.current();
  }, [failure]);
  if (!data) return null;
  // The detail read may carry the publisher's name only in the profile.
  const food = {
    ...data,
    uploaderName: data.uploaderName || data.user?.displayName,
  };
  return action === "edit" ? (
    <FoodEditor food={food} onClose={onClose} />
  ) : (
    <FoodOwnerTransfer food={food} onClose={onClose} />
  );
}
