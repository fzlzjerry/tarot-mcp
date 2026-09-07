import type { Response } from "express";

export function sendJsonRpcError(
  res: Response,
  status: number,
  code: number,
  message: string,
): void {
  if (res.headersSent) {
    return;
  }

  res.status(status).json({
    jsonrpc: "2.0",
    error: {
      code,
      message,
    },
    id: null,
  });
}
