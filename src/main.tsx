// Must run before the Supabase client is created (App imports it), see auth-recovery.ts
import "./lib/auth-recovery";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
