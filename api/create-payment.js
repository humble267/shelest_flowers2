// ============================================================
// POST /api/create-payment
// Приймає дані замовлення з форми кошика, формує підписаний
// запит до платіжного шлюзу Portmone і відправляє замовлення
// в Telegram-бот (статус: очікує оплату).
//
// Усі секрети читаються з Environment Variables на Vercel:
//   PORTMONE_PAYEE_ID, PORTMONE_LOGIN, PORTMONE_KEY,
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// ============================================================

const crypto = require("crypto");

const GATEWAY_URL = "https://www.portmone.com.ua/gateway/";

const bin2hex = (value) => Buffer.from(String(value), "utf8").toString("hex");

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Час створення запиту у форматі YmdHis за київським часом
const kyivDt = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const map = {};
  for (const { type, value } of parts) map[type] = value;
  const hour = map.hour === "24" ? "00" : map.hour;
  return `${map.year}${map.month}${map.day}${hour}${map.minute}${map.second}`;
};

// Підпис за алгоритмом Portmone:
// HMAC-SHA256( UPPER(payeeId + dt + hex(orderNumber) + amount) + UPPER(hex(login)), key )
const buildSignature = ({ payeeId, dt, shopOrderNumber, billAmount, login, key }) => {
  let str = `${payeeId}${dt}${bin2hex(shopOrderNumber)}${billAmount}`;
  str = str.toUpperCase() + bin2hex(login).toUpperCase();
  return crypto.createHmac("sha256", key).update(str).digest("hex").toUpperCase();
};

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
    // не блокуємо оформлення, якщо Telegram недоступний
  }
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const payeeId = process.env.PORTMONE_PAYEE_ID;
  const login = process.env.PORTMONE_LOGIN;
  const key = process.env.PORTMONE_KEY;

  if (!payeeId || !login || !key) {
    res.status(500).json({ error: "Оплата ще не налаштована. Зверніться до менеджера." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  const customer = body.customer || {};
  const items = Array.isArray(body.items) ? body.items : [];

  const name = String(customer.name || "").trim();
  const phone = String(customer.phone || "").trim();
  const address = String(customer.address || "").trim();
  const deliveryDate = String(customer.deliveryDate || "").trim();
  const comment = String(customer.comment || "").trim();

  if (!name || !phone || !address || items.length === 0) {
    res.status(400).json({ error: "Не заповнені обовʼязкові поля замовлення" });
    return;
  }

  // Суму рахуємо на сервері — не довіряємо значенню з браузера
  let total = 0;
  for (const item of items) {
    total += (Number(item.price) || 0) * (Number(item.qty) || 1);
  }
  if (total <= 0) {
    res.status(400).json({ error: "Невірна сума замовлення" });
    return;
  }

  const billAmount = total.toFixed(2);
  const shopOrderNumber = `SF${Date.now()}`;
  const dt = kyivDt();
  const signature = buildSignature({ payeeId, dt, shopOrderNumber, billAmount, login, key });

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${host}`;

  const description = `Замовлення ${shopOrderNumber} — SHELYST FLOWERS`;

  const itemsText = items
    .map((item) => {
      const qty = Number(item.qty) || 1;
      const line = (Number(item.price) || 0) * qty;
      return `• ${esc(item.name)} × ${qty} — ${line} грн`;
    })
    .join("\n");

  const tgText =
    `🧾 <b>Нове замовлення</b> (${shopOrderNumber})\n` +
    `⏳ Очікує оплату (Portmone)\n\n` +
    `👤 <b>Імʼя:</b> ${esc(name)}\n` +
    `📞 <b>Телефон:</b> ${esc(phone)}\n` +
    `📍 <b>Адреса:</b> ${esc(address)}` +
    (deliveryDate ? `\n📅 <b>Доставка:</b> ${esc(deliveryDate)}` : "") +
    (comment ? `\n💬 <b>Коментар:</b> ${esc(comment)}` : "") +
    `\n\n${itemsText}\n\n` +
    `💰 <b>Сума:</b> ${billAmount} грн`;

  await sendTelegram(tgText);

  res.status(200).json({
    gatewayUrl: GATEWAY_URL,
    fields: {
      payee_id: payeeId,
      login,
      dt,
      signature,
      shop_order_number: shopOrderNumber,
      bill_amount: billAmount,
      bill_currency: "UAH",
      description,
      lang: "uk",
      encoding: "UTF-8",
      success_url: `${base}/api/portmone-result`,
      failure_url: `${base}/pages/cart.html?payment=cancel`,
    },
  });
};
