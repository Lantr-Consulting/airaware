"use client";
import { useLanguage } from "@/lib/language";
import { PlanItemCard as EnPlanItemCard } from "./plan-item-card.en";
import { PlanItemCard as ZhPlanItemCard } from "./plan-item-card.zh";
import type { ComponentProps } from "react";
type Props = ComponentProps<typeof ZhPlanItemCard>;
export function PlanItemCard(props: Props) { return useLanguage() === "en" ? <EnPlanItemCard {...props} /> : <ZhPlanItemCard {...props} />; }
