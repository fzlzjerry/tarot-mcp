import { CliUsageError, parseArgs } from "../mcp/args.js";

describe("parseArgs", () => {
  it("defaults to stdio on port 3000", () => {
    expect(parseArgs([], {})).toEqual({
      transport: "stdio",
      port: 3000,
      host: "0.0.0.0",
    });
  });

  it("parses transport, port, and host flags", () => {
    expect(
      parseArgs(
        ["--transport", "http", "--port", "8080", "--host", "127.0.0.1"],
        {},
      ),
    ).toEqual({ transport: "http", port: 8080, host: "127.0.0.1" });
  });

  it("returns 'help' for --help and -h", () => {
    expect(parseArgs(["--help"], {})).toBe("help");
    expect(parseArgs(["-h"], {})).toBe("help");
  });

  it("rejects unknown transports, arguments, and invalid ports", () => {
    expect(() => parseArgs(["--transport", "websocket"], {})).toThrow(
      CliUsageError,
    );
    expect(() => parseArgs(["--port", "70000"], {})).toThrow(CliUsageError);
    expect(() => parseArgs(["--port", "abc"], {})).toThrow(CliUsageError);
    expect(() => parseArgs(["--bogus"], {})).toThrow(CliUsageError);
    expect(() => parseArgs(["--host"], {})).toThrow(CliUsageError);
  });

  it("honors PORT/HOST env only for HTTP transports", () => {
    const env = { PORT: "4000", HOST: "10.0.0.5" };

    expect(parseArgs(["--transport", "http"], env)).toEqual({
      transport: "http",
      port: 4000,
      host: "10.0.0.5",
    });

    // stdio launches must ignore the HTTP listener env vars
    expect(parseArgs([], env)).toEqual({
      transport: "stdio",
      port: 3000,
      host: "0.0.0.0",
    });
  });

  it("prefers explicit flags over env vars", () => {
    expect(
      parseArgs(["--transport", "http", "--port", "9999"], { PORT: "4000" }),
    ).toMatchObject({ port: 9999 });
  });
});
