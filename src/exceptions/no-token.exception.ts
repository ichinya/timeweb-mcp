export class NoTokenException extends Error {
  constructor() {
    super("❌ Не установлены переменные окружения TIMEWEB_TOKEN");
  }
}