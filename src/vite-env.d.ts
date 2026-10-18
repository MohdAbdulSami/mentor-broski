/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // NOTE: GEMINI_API_KEY is stored exclusively in Supabase Edge Function Secrets (never exposed in browser)
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
