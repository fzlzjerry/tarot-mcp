/**
 * Typed domain errors. The MCP service layer catches these and maps them to
 * failed tool results; unexpected errors keep propagating to the transport.
 */
export class TarotDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class SessionNotFoundError extends TarotDomainError {}

export class InvalidSpreadTypeError extends TarotDomainError {}
