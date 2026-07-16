export class ServerException extends Error {
  constructor(message: string) {
    super(`❌ Ошибка при выполнении запроса: ${message}`);
  }
}