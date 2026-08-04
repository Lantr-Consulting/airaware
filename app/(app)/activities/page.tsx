"use client";

import { useLanguage } from "@/lib/language";
import EnglishPage from "./page.en";
import ChinesePage from "./page.zh";

export default function LocalizedPage() {
  const language = useLanguage();
  return language === "en" ? <EnglishPage /> : <ChinesePage />;
}
