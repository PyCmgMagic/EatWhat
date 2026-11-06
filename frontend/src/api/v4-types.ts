export type PushCategory =
  "COMMENTS" | "LIKES_AND_FAVORITES" | "FOLLOWS" | "SYSTEM";
export type PushCommand = {
  commandId: string;
  operation:
    | "CREATE"
    | "REFRESH"
    | "ENABLE"
    | "DISABLE"
    | "UNBIND"
    | "TRANSFER"
    | "SETTINGS";
  bindingId?: string;
  capability?: string;
  deviceToken?: string;
  expectedGeneration?: number;
  expectedTokenGeneration?: number;
  expectedPreferenceRevision?: number;
  category?: PushCategory;
  observedCloseFrontier?: string;
};
export type TelemetryConsentInput = {
  enabled?: boolean;
  policyVersion: string;
  expectedRevision: number;
};
export type TelemetryEvent =
  | "app_open"
  | "page_view"
  | "dish_shuffle"
  | "dish_decide"
  | "navigate_shop"
  | "publish_success"
  | "comment_success"
  | "verify_success"
  | "share"
  | "load_failed";
export type TelemetryBatch = {
  consentRevision: number;
  events: { eventId: string; properties: { event: TelemetryEvent } }[];
};
