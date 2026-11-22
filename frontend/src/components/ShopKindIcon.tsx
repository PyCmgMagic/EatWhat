import { ConciergeBell, CupSoda, Soup } from "lucide-react";
import type { shopKinds } from "../api/v2-vocab";

const icons = { food: Soup, drink: CupSoda, buffet: ConciergeBell };

export function ShopKindIcon({
  kind,
  size = 18,
}: {
  kind: (typeof shopKinds)[number]["id"];
  size?: number;
}) {
  const Icon = icons[kind];
  return <Icon aria-hidden="true" size={size} />;
}
