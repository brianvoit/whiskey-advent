import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AppThemeProvider } from "./theme";
import { captureInviteFromUrl } from "./utils/invite";

// Before anything reads the URL: keep an invite token through sign-in.
captureInviteFromUrl();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </React.StrictMode>
);