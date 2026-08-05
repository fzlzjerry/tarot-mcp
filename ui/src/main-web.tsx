import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DrawApp } from "./DrawApp.js";
import { createWebClient } from "./web-client.js";
import "./styles.css";

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const applySystemTheme = (): void => {
  document.documentElement.dataset.theme = systemTheme.matches ? "dark" : "light";
};
applySystemTheme();
systemTheme.addEventListener("change", applySystemTheme);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <DrawApp client={createWebClient()} />
  </StrictMode>,
);
