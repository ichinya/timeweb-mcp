import { inspect } from "node:util";
import { failureMessage, RequestFailure, safeFailure } from "./request-failure";

export class ServerException extends Error {
  readonly failure: RequestFailure;

  constructor(input: string | Partial<RequestFailure> = {}) {
    const failure = safeFailure(typeof input === "string" ? {} : input);
    super(failureMessage(failure));
    this.name = "ServerException";
    this.failure = failure;
  }

  get kind() { return this.failure.kind; }
  get outcome() { return this.failure.outcome; }
  get status() { return this.failure.status; }
  get code() { return this.failure.code; }
  get retryAfterMs() { return this.failure.retryAfterMs; }
  toJSON() { return { name: this.name, message: failureMessage(this.failure), ...safeFailure(this.failure) }; }
  [inspect.custom]() { return this.toJSON(); }
}

export function formatRequestError(error: unknown): string {
  try {
    return error instanceof ServerException ? failureMessage(error.failure) : "❌ Внутренняя ошибка обработки результата. Состояние ресурса не подтверждено; перед повтором изменения проверьте его состояние.";
  } catch {
    return "❌ Внутренняя ошибка обработки результата. Состояние ресурса не подтверждено.";
  }
}
