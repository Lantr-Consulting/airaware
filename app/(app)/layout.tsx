import { TopBar } from "@/components/topbar";
import { Sidebar } from "@/components/sidebar";
import { DemoBanner } from "@/components/demo-banner";
import { GuidanceBanner } from "@/components/ui";

/* The product shell. A sidebar rail on desktop, the compact top bar on
   mobile. The marketing landing at "/" renders outside this group, bare. */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="lg:hidden">
          <TopBar />
        </div>
        <DemoBanner />
        <main className="app-main mx-auto flex w-full max-w-[1240px] flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-6 lg:px-8">
          {children}
          <GuidanceBanner />
        </main>
      </div>
    </div>
  );
}
