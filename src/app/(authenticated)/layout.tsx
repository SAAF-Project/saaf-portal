import Navbar from "@/components/Navbar";
import SessionProvider from "@/components/SessionProvider";
import FeedbackButton from "@/components/FeedbackButton";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-6">
          {children}
        </main>
        <FeedbackButton />
      </div>
    </SessionProvider>
  );
}
