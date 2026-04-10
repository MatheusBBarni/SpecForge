import { Button, Card, CardContent, CardHeader } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { Terminal } from "iconoir-react";
import { useEffect, useState } from "react";

import { useAppStore } from "./store/useAppStore";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

function App() {
  const count = useAppStore((state) => state.count);
  const increment = useAppStore((state) => state.increment);
  const [message, setMessage] = useState("Run `bun run tauri dev` to connect the Rust backend.");

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void invoke<string>("greet", { name: "SpecForge" })
      .then(setMessage)
      .catch(() => setMessage("Tauri backend detected."));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/70 p-2 shadow-2xl">
        <CardHeader className="flex items-center gap-3 px-6 pt-6">
          <Terminal />
          <div>
            <h1 className="text-2xl font-semibold text-white">SpecForge</h1>
            <p className="text-sm text-slate-400">
              Tauri + React + HeroUI + Tailwind + Iconoir + Zustand
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-6 pb-6 pt-2">
          <p className="text-sm leading-6 text-slate-300">{message}</p>
          <Button variant="primary" onPress={increment}>
            Zustand counter: {count}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default App;
