import { createClient } from "@supabase/supabase-js";
import { getRehearsalDate } from "./utils/clock";
import { withRehearsalHeader } from "./utils/rehearsalHeader";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    // Tag database requests while rehearsal mode is on (Admin → Debug).
    fetch: (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return fetch(input, withRehearsalHeader(url, init, getRehearsalDate() !== null));
    },
  },
});
