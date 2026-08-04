"use client";
import { useLanguage } from "@/lib/language";
import { DayTimeline as EnDayTimeline } from "./day-timeline.en";
import { BandLegend as EnBandLegend } from "./day-timeline.en";
import { DayTimeline as ZhDayTimeline } from "./day-timeline.zh";
import { BandLegend as ZhBandLegend } from "./day-timeline.zh";
import type { ComponentProps } from "react";
type Props = ComponentProps<typeof ZhDayTimeline>;
export function DayTimeline(props: Props) { return useLanguage() === "en" ? <EnDayTimeline {...props} /> : <ZhDayTimeline {...props} />; }
export function BandLegend() { return useLanguage() === "en" ? <EnBandLegend /> : <ZhBandLegend />; }
