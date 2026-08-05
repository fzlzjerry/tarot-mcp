import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DrawApp } from "./DrawApp.js";
import { createWebClient } from "./web-client.js";
import "./styles.css";

// One committed theme: the deck is midnight indigo and gold, and so is the app.
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <DrawApp client={createWebClient()} />
  </StrictMode>,
);
