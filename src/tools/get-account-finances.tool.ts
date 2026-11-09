import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { getAccountFinancesAction } from "../actions/get-account-finances.action";

const inputSchema = {};

const handler = async () => {
  try {
    const f = await getAccountFinancesAction();
    const hoursLeft = f.hours_left == null ? "—" : `${f.hours_left} ч`;
    return createToolResponse(
      `💰 Финансы аккаунта (${f.currency}):\n\n` +
        `Баланс: ${f.balance}\n` +
        `Абонентская плата: ${f.monthly_fee}/мес (${f.hourly_fee}/час)\n` +
        `Стоимость услуг: ${f.monthly_cost}/мес (${f.hourly_cost}/час)\n` +
        `Всего оплачено за всё время: ${f.total_paid}\n` +
        `Часов работы оплачено: ${hoursLeft}\n` +
        `Скидка: ${f.discount_percent}% (до ${f.discount_end_date_at ?? "—"})\n` +
        `Автоплатёж: ${f.autopay_card_info ?? "не подключен"}`
    );
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const getAccountFinancesTool = {
  name: ToolNames.GET_ACCOUNT_FINANCES,
  title: "Финансы аккаунта",
  description:
    "Возвращает баланс, абонентскую плату, стоимость услуг, скидку и данные автоплатежа. Используй для ответа на вопросы 'сколько денег осталось', 'сколько тратим в месяц', 'когда кончатся деньги' (hours_left).",
  inputSchema,
  handler,
};
