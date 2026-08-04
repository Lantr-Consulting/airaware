"use client";
import { useLanguage } from "@/lib/language";
import { Sidebar as EnSidebar, MobileNav as EnMobileNav } from "./sidebar.en";
import { Sidebar as ZhSidebar, MobileNav as ZhMobileNav } from "./sidebar.zh";
export function Sidebar() { return useLanguage() === "en" ? <EnSidebar /> : <ZhSidebar />; }
export function MobileNav() { return useLanguage() === "en" ? <EnMobileNav /> : <ZhMobileNav />; }
