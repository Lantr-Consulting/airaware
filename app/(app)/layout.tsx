import { MobileNav, Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { GuidanceBanner } from "@/components/ui";

/* The product shell — sidebar + topbar around every app screen.
   The marketing landing at "/" renders outside this group, bare. */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <GuidanceBanner />
        <MobileNav />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-5 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
