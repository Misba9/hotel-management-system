import React from "react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { posColors } from "./pos-theme";

export type PosIconName =
  | "sales"
  | "orders"
  | "dine"
  | "parcel"
  | "pending"
  | "cash"
  | "upi"
  | "card"
  | "avg"
  | "search"
  | "plus"
  | "bell"
  | "history"
  | "user"
  | "logout"
  | "clock"
  | "print"
  | "pay"
  | "refund"
  | "kitchen"
  | "table"
  | "star"
  | "trending"
  | "trash"
  | "minus"
  | "more"
  | "help";

type Props = { name: PosIconName; size?: number; color?: string };

const featherMap: Partial<Record<PosIconName, keyof typeof Feather.glyphMap>> = {
  search: "search",
  plus: "plus",
  bell: "bell",
  history: "clock",
  user: "user",
  logout: "log-out",
  clock: "clock",
  print: "printer",
  pay: "credit-card",
  refund: "rotate-ccw",
  table: "grid",
  star: "star",
  trending: "trending-up",
  trash: "trash-2",
  minus: "minus",
  more: "more-horizontal",
  help: "help-circle"
};

export function PosIcon({ name, size = 18, color = posColors.textSecondary }: Props) {
  if (name === "sales") return <Feather name="dollar-sign" size={size} color={color} />;
  if (name === "orders") return <Feather name="shopping-bag" size={size} color={color} />;
  if (name === "dine") return <MaterialCommunityIcons name="silverware-fork-knife" size={size} color={color} />;
  if (name === "parcel") return <Feather name="package" size={size} color={color} />;
  if (name === "pending") return <Feather name="alert-circle" size={size} color={color} />;
  if (name === "cash") return <MaterialCommunityIcons name="cash" size={size} color={color} />;
  if (name === "upi") return <MaterialCommunityIcons name="cellphone" size={size} color={color} />;
  if (name === "card") return <Feather name="credit-card" size={size} color={color} />;
  if (name === "avg") return <Feather name="bar-chart-2" size={size} color={color} />;
  if (name === "kitchen") return <MaterialCommunityIcons name="pot-steam" size={size} color={color} />;

  const feather = featherMap[name];
  if (feather) return <Feather name={feather} size={size} color={color} />;
  return <Feather name="circle" size={size} color={color} />;
}
