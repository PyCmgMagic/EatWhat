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
export const telemetryPages = [
  "HOME",
  "RECOMMEND",
  "SEARCH",
  "RESTAURANT",
  "FOOD",
  "MESSAGE",
  "PROFILE",
  "OTHER",
] as const;
export type TelemetryPage = (typeof telemetryPages)[number];
export type TelemetryProperties =
  | { event: "app_open" | "dish_shuffle" | "comment_success" }
  | { event: "page_view"; page: TelemetryPage }
  | { event: "dish_decide"; foodId?: number; restaurantId?: number }
  | { event: "navigate_shop"; restaurantId: number }
  | { event: "publish_success"; kind: "FOOD" | "RESTAURANT" }
  | { event: "verify_success"; method: "sso" | "email" }
  | { event: "share"; targetType: "FOOD" | "RESTAURANT"; targetId: number }
  | { event: "load_failed"; page: TelemetryPage };

export type TelemetryBatch = {
  consentRevision: number;
  events: {
    eventId: string;
    properties: TelemetryProperties;
  }[];
};
