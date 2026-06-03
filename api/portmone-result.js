// ============================================================
// POST /api/portmone-result
// Portmone повертає сюди браузер користувача після спроби оплати
// (це success_url). Перевіряємо RESULT, повідомляємо в Telegram
// про успішну оплату і робимо редірект на сторінку подяки.
// ============================================================

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const sendTelegram = async (text) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // ignore
  }
};

const redirect = (res, location) => {
  res.writeHead(302, { Location: location });
  res.end();
};

module.exports = async (req, res) => {
  let body = req.body;
  if (typeof body === "string") {
    body = Object.fromEntries(new URLSearchParams(body));
  }
  body = body || {};

  // Portmone може повертати ключі у різному регістрі — нормалізуємо
  const get = (key) =>
    body[key] ?? body[key.toUpperCase()] ?? body[key.toLowerCase()] ?? "";

  const result = String(get("RESULT")).trim();
  const order = get("SHOPORDERNUMBER");
  const amount = get("BILL_AMOUNT");
  const approval = get("APPROVALCODE");
  const cardMask = get("CARD_MASK");
  const receiptUrl = get("RECEIPT_URL");

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${host}`;

  if (result === "0") {
    const tgText =
      `✅ <b>Замовлення оплачено</b> (${esc(order)})\n` +
      `💰 Сума: ${esc(amount)} грн\n` +
      (cardMask ? `💳 Картка: ${esc(cardMask)}\n` : "") +
      (approval ? `🔑 Код авторизації: ${esc(approval)}\n` : "") +
      (receiptUrl ? `🧾 Квитанція: ${esc(receiptUrl)}\n` : "") +
      `\nPortmone підтвердив оплату.`;

    await sendTelegram(tgText);
    redirect(res, `${base}/pages/zamovlennya-prijnyato.html?order=${encodeURIComponent(order)}`);
    return;
  }

  // Невдала / скасована оплата
  redirect(res, `${base}/pages/cart.html?payment=fail`);
};
