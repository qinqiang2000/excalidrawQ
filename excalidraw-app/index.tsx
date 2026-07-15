import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import { runStorageCleanup } from "./data/storageCleanup";

import ExcalidrawApp from "./App";

// garbage-collect storage orphaned by dead sessions before the app starts
// saving, so a quota-poisoned browser heals itself on load
runStorageCleanup();

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();
root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
