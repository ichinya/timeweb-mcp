import { RequestFailure } from "./request-failure";
import { ServerException } from "./server.exception";

export class NoTokenException extends ServerException {
  constructor(context: Partial<RequestFailure> = {}) {
    super({ ...context, kind: "local", outcome: "not_sent", reason: "missing_token" });
    this.name = "NoTokenException";
  }
}
