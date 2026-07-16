import { PromptNames } from "../types/prompt-names.enum";
import { ResourceNames } from "../types/resource-names.enum";

export const createAppPrompt = {
  name: PromptNames.CREATE_APP_PROMPT,
  title: "Промпт для создания приложения в Timeweb Cloud",
  description: `Объясняет модели, как создать приложение в Timeweb Cloud с автоматическим определением параметров проекта.`,
  config: {
    title: "Промпт для создания приложения в Timeweb Cloud",
    description:
      "Помогает пользователю создать приложение в Timeweb Cloud с автоматическим определением параметров проекта",
  },
  handler: async () => {
    const prompt = `Создание приложения в Timeweb Cloud. Твоя задача - помочь пользователю создать приложение с автоматическим определением всех необходимых параметров.
Проанализируй структуру проекта. Если есть файлы docker или docker-compose, то это backend приложение с типом docker или docker-compose.
Определи тип приложения (frontend/backend) по структуре проекта.
Определи фреймворк по package.json, конфигурационным файлам и структуре директорий.
ВЫПОЛНИ КОМАНДУ В ТЕРМИНАЛЕ ДЛЯ ПОЛУЧЕНИЯ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ИЗ .env ФАЙЛА.
Получи URL репозитория из .git/config.
Получи активную ветку origin из .git/HEAD.
Получи SHA коммита из .git/refs/remotes/origin/HEAD.
Получи список тарифов через ресурс ${ResourceNames.ALLOWED_PRESETS} и найди нужный в зависимостиот типа приложения.
Настройки деплоя через ресурс ${ResourceNames.DEPLOY_SETTINGS} и найди нужный в зависимости от типа приложения и фремворка.
Список провайдеров через ресурс ${ResourceNames.VCS_PROVIDERS}.
Список репозиториев через ресурс ${ResourceNames.VCS_PROVIDER_REPOSITORIES}, и найди нужный в зависимости от URL подключенного репозитория.
Если в ресурсе ${ResourceNames.VCS_PROVIDER_REPOSITORIES} нет нужного - создай новый.

Пример работы
1. Анализирую структуру проекта
2. Определяю тип и фремворк: frontend (React)
3. Получаю Git информацию
4. Выбираю подходящий пресет
5. Получаю настройки деплоя для React
6. Настраиваю VCS провайдер
7. Создаю приложение`;

    return {
      messages: [
        {
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: "Ты помощник по работе с облаком Timeweb Cloud. Ты помогаешь пользователю создать приложение в Timeweb Cloud с автоматическим определением параметров проекта.",
          },
        },
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: prompt,
          },
        },
      ],
    };
  },
};
