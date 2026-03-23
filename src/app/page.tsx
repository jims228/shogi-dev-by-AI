import Chat from "@/components/Chat";

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 border-b dark:border-zinc-700 flex-shrink-0">
        <h1 className="text-xl font-bold">将棋解説AI</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          SFEN を貼り付けて、局面の解説を受けられます
        </p>
      </header>
      <Chat />
    </div>
  );
}
