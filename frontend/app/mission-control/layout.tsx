import Sidebar from "@/components/layout/Sidebar";
import ShadowBanner from "@/components/safety/ShadowBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <ShadowBanner />
        <main className="flex-1 overflow-y-auto pl-6 pr-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
