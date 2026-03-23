import ExplainForm from "@/components/ExplainForm";

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      <header className="w-full max-w-2xl mb-8">
        <h1 className="text-2xl font-bold">将棋解説AI</h1>
        <p className="text-sm text-zinc-500 mt-1">
          SFEN を貼り付けて、局面の解説を受けられます
        </p>
      </header>
      <main className="w-full flex flex-col items-center">
        <ExplainForm />
      </main>
    </div>
  );
}
