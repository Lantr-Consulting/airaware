"use client";
import { useLanguage } from "@/lib/language";
import { TopBar as EnTopBar } from "./topbar.en";
import { TopBar as ZhTopBar } from "./topbar.zh";
export function TopBar() { return useLanguage() === "en" ? <EnTopBar /> : <ZhTopBar />; }
