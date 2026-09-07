import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DrawApp } from "./DrawApp.js";
import { createMcpClient } from "./mcp-client.js";
import "./styles/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

const client = createMcpClient();
createRoot(root).render(
  <StrictMode>
    <DrawApp client={client} />
  </StrictMode>,
);

// The client publishes connection failures through DrawClient.subscribeInitial.
void client.connect().catch(() => undefined);
