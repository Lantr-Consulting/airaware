import { TopBar } from "@/components/topbar";
import { GuidanceBanner } from "@/components/ui";

/* The product shell — one compact navigation bar around every app screen.
   The marketing landing at "/" renders outside this group, bare. */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <TopBar />
      <GuidanceBanner />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
