import { spawn } from "node:child_process";
import path from "node:path";

/**
 * With the stdio transport, stdout is the JSON-RPC channel. Any stray
 * logging on stdout corrupts the protocol, so every stdout line must parse
 * as JSON.
 */
describe("stdio transport stdout purity", () => {
  it("emits only JSON-RPC on stdout while logs go to stderr", async () => {
    const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");
    const child = spawn(tsxBin, ["src/index.ts"], {
      cwd: process.cwd(),
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const initialize = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "jest-stdio", version: "1.0.0" },
      },
    };

    try {
      // Wait for startup, send initialize, wait for the response.
      const deadline = Date.now() + 15000;
      while (!stderr.includes("stdio_server_started") && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      child.stdin.write(JSON.stringify(initialize) + "\n");

      while (!stdout.includes('"serverInfo"') && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } finally {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }

    const stdoutLines = stdout.split("\n").filter((line) => line.trim() !== "");
    expect(stdoutLines.length).toBeGreaterThan(0);
    for (const line of stdoutLines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    const response = JSON.parse(stdoutLines[0]);
    expect(response.result.serverInfo.name).toBe("tarot-mcp-server");

    // Human-readable logs landed on stderr, not stdout.
    expect(stderr).toContain("server_starting");
    expect(stderr).toContain("stdio_server_started");
  }, 20000);
});
