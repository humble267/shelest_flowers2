// ============================================================
// PAGE LOADER
// ============================================================
(function initPageLoader() {
  const loader = document.getElementById("pageLoader");
  if (!loader) return;

  const MIN_DURATION = 1800;
  const EXIT_DURATION = 680;
  const startTime = performance.now();

  function dismissLoader() {
    loader.classList.add("is-exiting");
    setTimeout(() => {
      loader.remove();
      document.body.classList.remove("loader-active");
      document.body.classList.add("page-revealed");
    }, EXIT_DURATION);
  }

  function tryDismiss() {
    const elapsed = performance.now() - startTime;
    const wait = Math.max(0, MIN_DURATION - elapsed);
    setTimeout(dismissLoader, wait);
  }

  if (document.readyState === "complete") {
    tryDismiss();
  } else {
    window.addEventListener("load", tryDismiss, { once: true });
  }
})();

const isInnerPage = window.location.pathname.includes("/pages/");
const assetPrefix = isInnerPage ? "../" : "";

const TELEGRAM_USERNAME = "e_smnk";
const CONTACT_PHONE_DISPLAY = "097 00 000...";
const CONTACT_PHONE_HREF = "tel:09700000";
const CONTACT_TELEGRAM_URL = `https://t.me/${TELEGRAM_USERNAME}`;
const CATALOG_CSV_URLS = {
  categories:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTU78b1Jh7CCVUnmeYlZBcDtIk2hLeUWTXZDM2J_28Vm--KZIk2_jf9ocbPYkgedsleK2C7lZGCS0LY/pub?gid=0&single=true&output=csv",
  products:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTU78b1Jh7CCVUnmeYlZBcDtIk2hLeUWTXZDM2J_28Vm--KZIk2_jf9ocbPYkgedsleK2C7lZGCS0LY/pub?gid=333893780&single=true&output=csv",
  toys:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTU78b1Jh7CCVUnmeYlZBcDtIk2hLeUWTXZDM2J_28Vm--KZIk2_jf9ocbPYkgedsleK2C7lZGCS0LY/pub?gid=1465537961&single=true&output=csv",
  balloons:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTU78b1Jh7CCVUnmeYlZBcDtIk2hLeUWTXZDM2J_28Vm--KZIk2_jf9ocbPYkgedsleK2C7lZGCS0LY/pub?gid=744079993&single=true&output=csv",
};

// ============================================================
// TOAST (global, used by cart and firebase.js)
// ============================================================
let _globalToastTimer = null;
window.showToast = (message, options = {}) => {
  const existing = document.getElementById("shelyst-toast");
  if (existing) existing.remove();
  if (_globalToastTimer) clearTimeout(_globalToastTimer);

  const toast = document.createElement("div");
  toast.id = "shelyst-toast";
  toast.className = `shelyst-toast${options.variant === "error" ? " is-error" : ""}`;
  const actionMarkup = options.actionHref
    ? `<a class="shelyst-toast__btn" href="${options.actionHref}">${options.actionLabel || "Детальніше"}</a>`
    : "";
  toast.innerHTML = `<p class="shelyst-toast__msg">${message}</p><div class="shelyst-toast__actions">${actionMarkup}<button type="button" class="shelyst-toast__close" aria-label="Закрити">×</button></div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));

  const dismiss = () => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 300);
  };
  toast.querySelector(".shelyst-toast__close").addEventListener("click", dismiss);
  _globalToastTimer = setTimeout(dismiss, options.duration || 4000);
};

// ============================================================
// CART
// ============================================================
window.CART = (() => {
  const STORAGE_KEY = "shelyst_cart_v1";
  const _items = new Map();

  const _persist = () => {
    const arr = Array.from(_items.values());
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch {}
    _updateBadge();
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: arr }));
    if (window.FB && window.FB.currentUser && window.FB.saveCart) {
      window.FB.saveCart(window.FB.currentUser.uid, arr).catch(() => {});
    }
  };

  const load = (savedItems) => {
    _items.clear();
    (savedItems || []).forEach((item) => {
      if (item && item.id) _items.set(item.id, { ...item, qty: Math.max(1, item.qty || 1) });
    });
    _updateBadge();
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: Array.from(_items.values()) }));
  };

  const loadFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) load(JSON.parse(raw));
    } catch {}
  };

  const add = (product) => {
    const existing = _items.get(product.id);
    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      _items.set(product.id, { ...product, qty: 1 });
    }
    _persist();
  };

  const remove = (productId) => { _items.delete(productId); _persist(); };

  const setQty = (productId, qty) => {
    const q = Math.max(0, Math.round(qty));
    if (q === 0) { remove(productId); return; }
    const item = _items.get(productId);
    if (item) { item.qty = q; _persist(); }
  };

  const getItems = () => Array.from(_items.values());
  const getCount = () => Array.from(_items.values()).reduce((s, i) => s + (i.qty || 1), 0);
  const getTotal = () => Array.from(_items.values()).reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const clear = () => {
    _items.clear();
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    _updateBadge();
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: [] }));
  };
  const has = (productId) => _items.has(productId);

  const toTelegramMessage = () => {
    const fmt = (n) => new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(n);
    const lines = Array.from(_items.values()).map((item) => {
      const name = item.telegramText || item.name;
      return `• ${name} × ${item.qty || 1} — ${fmt(item.price * (item.qty || 1))} грн`;
    });
    return `Привіт! Хочу замовити:\n${lines.join("\n")}\nЗагальна сума: ${fmt(getTotal())} грн`;
  };

  function _updateBadge() {
    const badge = document.getElementById("header-cart-badge");
    if (!badge) return;
    const count = getCount();
    badge.textContent = count;
    badge.hidden = count === 0;
  }

  loadFromStorage();

  return { add, remove, setQty, getItems, getCount, getTotal, clear, has, load, loadFromStorage, toTelegramMessage, _updateBadge };
})();

const categoryPageRoutes = {
  "all-bouquets": `${assetPrefix}pages/bukety.html`,
  "all-flowers": `${assetPrefix}pages/troyandy.html`,
  "mono-bouquets": `${assetPrefix}pages/bukety.html?filter=mono-bouquets`,
  "mixed-bouquets": `${assetPrefix}pages/bukety.html?filter=mixed-bouquets`,
  sale: `${assetPrefix}pages/aktsiyni.html`,
};

const categoryImageMap = {
  "all-bouquets": `${assetPrefix}images/cat-letters.jpg`,
  "all-flowers": `${assetPrefix}images/cat-mixed.jpg`,
  "mono-bouquets": `${assetPrefix}images/cat-exclusive.jpg`,
  "mixed-bouquets": `${assetPrefix}images/cat-basket.jpg`,
  sale: `${assetPrefix}images/cat-box.jpg`,
};

const categoryTitleOverrides = {};

const BOUQUET_FILTER_IDS = ["mono-bouquets", "mixed-bouquets", "sale"];

const TOY_FILTER_IDS = ["L", "M", "S", "sale"];
const TOY_FILTER_LABELS = {
  L: "L-size іграшки",
  M: "M-size іграшки",
  S: "S-size іграшки",
  sale: "Акційні",
};

const BALLOON_FILTER_IDS = ["mixed", "bd"];
const BALLOON_FILTER_LABELS = {
  mixed: "Зібрані кулькові композиції",
  bd: "Акційні",
};

let catalogDataPromise = null;
let toysDataPromise = null;
let balloonsDataPromise = null;
let _heroAutoplayId = null;
let _galleryAutoplayId = null;

const CSV_CACHE_KEY = "shelyst_catalog_v2";
const CSV_CACHE_TTL = 2 * 60 * 1000;
const TOYS_CACHE_KEY = "shelyst_toys_v1";
const BALLOONS_CACHE_KEY = "shelyst_balloons_v2";

const loadCachedCatalog = () => {
  try {
    const raw = localStorage.getItem(CSV_CACHE_KEY);
    if (!raw) return null;
    const { data } = JSON.parse(raw);
    return data ?? null;
  } catch {
    return null;
  }
};

const saveCatalogToCache = (data) => {
  try {
    localStorage.setItem(
      CSV_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch {
    // quota exceeded or private browsing
  }
};

const buildHeaderMarkup = (prefix) => `
  <header class="site-header">
    <div class="topbar">
      <div class="container topbar__inner">
        <nav class="topbar__nav" aria-label="Додаткова навігація">
          <a href="${prefix}pages/kyiv.html">Петропавлівська Борщагівка</a>
          <a href="${prefix}index.html#about">Про нас</a>
          <a href="${prefix}pages/oplata.html">Оплата</a>
          <a href="${prefix}pages/kontakty.html">Контакти</a>
        </nav>
        <div class="topbar__actions">
          <a href="${prefix}pages/kontakty.html">${CONTACT_PHONE_DISPLAY}</a>
          <a href="${prefix}pages/kontakty.html">Графік: щодня 09:00 - 21:00</a>
        </div>
      </div>
    </div>

    <div class="main-nav">
      <div class="container main-nav__inner">
        <button
          class="menu-toggle"
          type="button"
          aria-label="Відкрити меню"
          aria-expanded="false"
          aria-controls="site-menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <a class="brand" href="${prefix}index.html" aria-label="SHELYST FLOWERS">
          <img src="${prefix}images/logo.png" alt="Логотип SHELYST FLOWERS" />
        </a>

        <div class="main-nav__content">
          <div class="main-nav__panel" id="site-menu">
            <div class="main-nav__panel-head">
              <p>SHELYST FLOWERS</p>
              <button class="menu-close" type="button" aria-label="Закрити меню">
                <span></span>
                <span></span>
              </button>
            </div>

            <nav class="catalog-nav" aria-label="Категорії каталогу">
              <a href="${prefix}pages/bukety.html">Готові композиції</a>
              <a href="${prefix}pages/troyandy.html">Усі квіти</a>
              <a href="${prefix}pages/igrashky.html">М'які іграшки</a>
              <a href="${prefix}pages/kulky.html">Кульки</a>
              <a class="catalog-nav__sale" href="${prefix}pages/aktsiyni.html">Акційні пропозиції</a>
            </nav>

            <div class="mobile-links" aria-label="Службові посилання">
              <a href="${prefix}pages/kyiv.html">Петропавлівська Борщагівка</a>
              <a href="${prefix}index.html#about">Про нас</a>
              <a href="${prefix}pages/oplata.html">Оплата</a>
              <a href="${prefix}pages/kontakty.html">Контакти</a>
              <a href="${prefix}pages/kontakty.html">${CONTACT_PHONE_DISPLAY}</a>
              <a href="${prefix}pages/kontakty.html">Графік: щодня 09:00 - 21:00</a>
            </div>
          </div>

          <a class="cart-link" id="header-cart-btn" href="${prefix}pages/cart.html" aria-label="Кошик">
            <svg class="cart-link__icon" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M2 2.5h2.5l2.5 10a2 2 0 0 0 2 1.5h8a2 2 0 0 0 2-1.5L21 6H6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="9" cy="18" r="1.5" stroke="currentColor" stroke-width="1.4"/>
              <circle cx="16" cy="18" r="1.5" stroke="currentColor" stroke-width="1.4"/>
            </svg>
            <span class="cart-link__badge" id="header-cart-badge" hidden>0</span>
          </a>

          <a class="user-link" id="header-user-btn" href="${prefix}pages/login.html" aria-label="Особистий кабінет">
            <svg class="user-link__icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.6"/>
              <path d="M3 18c0-3.866 3.134-6 7-6s7 2.134 7 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            <span id="header-user-label">Увійти</span>
          </a>
        </div>
      </div>
    </div>

    <button class="menu-backdrop" type="button" aria-label="Закрити меню"></button>
  </header>
`;

const buildFooterMarkup = (prefix) => `
  <footer class="site-footer">
    <div class="container site-footer__inner">
      <div class="site-footer__brand">
        <h2>SHELYST FLOWERS</h2>
        <p>
          Каталог квітів і композицій для особливих моментів. Оформлення
          замовлення відбувається через особистий Telegram-чат магазину.
        </p>
      </div>

      <nav class="site-footer__nav" aria-label="Навігація у футері">
        <a href="${prefix}pages/bukety.html">Усі букети</a>
        <a href="${prefix}pages/troyandy.html">Усі квіти</a>
        <a href="${prefix}pages/bukety.html?filter=mono-bouquets">Моно букети</a>
        <a href="${prefix}pages/bukety.html?filter=mixed-bouquets">Збірні букети</a>
        <a href="${prefix}pages/aktsiyni.html">Акційні</a>
      </nav>

      <div class="site-footer__contacts">
        <p class="site-footer__label">Контактна інформація</p>
        <span>Телефон: <a href="${CONTACT_PHONE_HREF}">${CONTACT_PHONE_DISPLAY}</a></span>
        <span>Місто: Петропавлівська Борщагівка</span>
        <span>Адреса: ваша адреса магазину</span>
        <span>Telegram: <a href="${CONTACT_TELEGRAM_URL}" target="_blank" rel="noreferrer">@${TELEGRAM_USERNAME}</a></span>
        <span>Графік: щодня 09:00 - 21:00</span>
      </div>

      <div class="site-footer__note">
        <p>Каталог SHELYST FLOWERS</p>
        <span>Створено для зручного вибору та швидкого переходу до замовлення.</span>
      </div>
    </div>
  </footer>
`;

const cleanValue = (value) => String(value ?? "").trim();
const normalizeFlag = (value) => cleanValue(value).toLowerCase();
const isVisibleEntity = (value) => normalizeFlag(value) !== "no";
const isAvailableEntity = (value) => normalizeFlag(value) !== "no";
const parseNumber = (value) => {
  const normalized = cleanValue(value).replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseBoolean = (value) => {
  const normalized = normalizeFlag(value);
  return (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "1" ||
    normalized === "так"
  );
};

const formatPrice = (value) =>
  `${new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))} грн`;

const getDiscountedPrice = (price, discount) =>
  Math.max(0, Math.round(price - (price * discount) / 100));

const getEffectivePrice = (item) => {
  const discount = Math.max(0, Math.round(item.discount || 0));
  return discount > 0 ? getDiscountedPrice(item.price, discount) : item.price;
};

const escapeHtml = (value) =>
  cleanValue(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeCssUrl = (value) =>
  cleanValue(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll(")", "\\)");

const createCatalogError = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
};

const getCatalogErrorText = (error) => {
  switch (error?.code) {
    case "papaparse_missing":
      return "Не завантажилася бібліотека PapaParse з CDN. Перевірте доступ до jsDelivr.";
    case "csv_network_error":
      return "Не вдалося отримати CSV із Google Sheets. Перевірте доступність посилання або мережі.";
    case "csv_parse_error":
      return "CSV завантажився, але не вдалося коректно прочитати його структуру.";
    case "csv_empty_error":
      return "Google Sheets CSV повернув порожні дані.";
    default:
      return "Не вдалося завантажити каталог. Перевірте доступність Google Sheets CSV.";
  }
};

const logCatalogError = (scope, error) => {
  const code = error?.code || "unknown_error";
  const message = error?.message || "Unknown error";
  const details = error?.details || {};

  console.group(`[catalog] ${scope}: ${code}`);
  console.error(message);

  if (Object.keys(details).length) {
    console.info("details:", details);
  }

  console.groupEnd();
};

const resolveCategoryUrl = (categoryId) =>
  categoryPageRoutes[categoryId] ??
  `${assetPrefix}pages/troyandy.html?category=${encodeURIComponent(categoryId)}`;

const resolveProductUrl = (productId) =>
  `${assetPrefix}pages/product.html?id=${encodeURIComponent(productId)}`;

const resolveCategoryImage = (category) =>
  cleanValue(category.image) || categoryImageMap[category.id] || "";

const getCategoryDisplayTitle = (category) =>
  categoryTitleOverrides[category.id] || category.title;

const getProductCategoryIds = (product) => {
  const categoryIds = new Set();

  if (product.category) {
    categoryIds.add(product.category);
  }

  if (product.isSale) {
    categoryIds.add("sale");
  }

  return [...categoryIds];
};

const productHasCategory = (product, categoryId) =>
  getProductCategoryIds(product).includes(categoryId);

const getTelegramUrl = (product) =>
  `${CONTACT_TELEGRAM_URL}?text=${encodeURIComponent(
    cleanValue(product.telegramText) || cleanValue(product.name),
  )}`;

const sortByOrder = (items) =>
  [...items].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }

    return a.title.localeCompare(b.title, "uk");
  });

const bindPageTransitions = (root = document) => {
  root.querySelectorAll("a[href]").forEach((link) => {
    if (link.dataset.transitionBound === "true") {
      return;
    }

    const rawHref = link.getAttribute("href");

    if (
      !rawHref ||
      rawHref.startsWith("#") ||
      rawHref.startsWith("mailto:") ||
      rawHref.startsWith("tel:") ||
      rawHref.startsWith("javascript:")
    ) {
      return;
    }

    link.dataset.transitionBound = "true";

    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      ) {
        return;
      }

      const destination = new URL(link.href, window.location.href);
      const isMobileHeaderLink =
        window.innerWidth <= 980 && !!link.closest(".main-nav__panel");

      if (destination.href === window.location.href) {
        return;
      }

      if (destination.origin !== window.location.origin) {
        return;
      }

      if (isMobileHeaderLink) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      document.body.classList.add("is-leaving");

      window.setTimeout(() => {
        window.location.assign(destination.href);
      }, 420);
    });
  });
};

const parseCsv = (url) =>
  new Promise((resolve, reject) => {
    if (!window.Papa) {
      reject(
        createCatalogError(
          "papaparse_missing",
          "PapaParse is not loaded from CDN.",
          { url },
        ),
      );
      return;
    }

    window.Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors?.length && !results.data?.length) {
          reject(
            createCatalogError(
              "csv_parse_error",
              results.errors[0].message || "CSV parse failed.",
              {
                url,
                errors: results.errors,
              },
            ),
          );
          return;
        }

        if (!results.data?.length) {
          reject(
            createCatalogError("csv_empty_error", "CSV returned no rows.", {
              url,
            }),
          );
          return;
        }

        resolve(results.data ?? []);
      },
      error: (error) => {
        reject(
          createCatalogError(
            "csv_network_error",
            error?.message || "Failed to fetch CSV.",
            {
              url,
              originalError: error,
            },
          ),
        );
      },
    });
  });

const fetchCatalogFromNetwork = () =>
  Promise.all([
    parseCsv(CATALOG_CSV_URLS.categories),
    parseCsv(CATALOG_CSV_URLS.products),
  ]).then(([categoriesRows, productsRows]) => {
    const result = {
      categories: categoriesRows
        .map((row) => ({
          id: cleanValue(row.id),
          title: cleanValue(row.title),
          parent: cleanValue(row.parent),
          type: cleanValue(row.type) || "products",
          order: parseNumber(row.order),
          visible: cleanValue(row.visible),
          image: cleanValue(row.image),
        }))
        .filter((category) => category.id && category.title),
      products: productsRows
        .map((row) => ({
          id: cleanValue(row.id),
          name: cleanValue(row.name),
          price: parseNumber(row.price),
          image: cleanValue(row.image),
          available: cleanValue(row.available),
          discount: parseNumber(row.discount),
          category: cleanValue(row.category),
          isPopular: parseBoolean(row.isPopular),
          isSale: parseBoolean(row.isSale),
          isAllBouquets: parseBoolean(row["isAll-bouquets"]),
          telegramText: cleanValue(row.telegramText),
          visible: cleanValue(row.visible),
          description: cleanValue(row.description),
        }))
        .filter((product) => product.id && product.name),
    };
    saveCatalogToCache(result);
    return result;
  });

const loadCatalogData = async () => {
  if (!catalogDataPromise) {
    const cached = loadCachedCatalog();

    if (cached) {
      catalogDataPromise = Promise.resolve(cached);
      fetchCatalogFromNetwork().catch(() => {});
    } else {
      catalogDataPromise = fetchCatalogFromNetwork();
      catalogDataPromise.catch(() => { catalogDataPromise = null; });
    }
  }

  return await catalogDataPromise;
};

const loadCachedToys = () => {
  try {
    const raw = localStorage.getItem(TOYS_CACHE_KEY);
    if (!raw) return null;
    const { data } = JSON.parse(raw);
    return data ?? null;
  } catch {
    return null;
  }
};

const saveToysToCache = (data) => {
  try {
    localStorage.setItem(TOYS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // quota exceeded or private browsing
  }
};

const fetchToysFromNetwork = () =>
  parseCsv(CATALOG_CSV_URLS.toys).then((rows) => {
    const result = rows
      .map((row) => ({
        id: cleanValue(row.id),
        name: cleanValue(row.name),
        price: parseNumber(row.price),
        image: cleanValue(row.image),
        available: cleanValue(row.available),
        discount: parseNumber(row.discount),
        category: cleanValue(row.category),
        isAllToys: parseBoolean(row["isAll-toys"]),
        isSale: parseBoolean(row.isSale),
        telegramText: cleanValue(row.telegramText),
        visible: cleanValue(row.visible),
        description: cleanValue(row.description),
      }))
      .filter((toy) => toy.id && toy.name);
    saveToysToCache(result);
    return result;
  });

const loadToysData = async () => {
  if (!toysDataPromise) {
    const cached = loadCachedToys();
    if (cached) {
      toysDataPromise = Promise.resolve(cached);
      fetchToysFromNetwork().catch(() => {});
    } else {
      toysDataPromise = fetchToysFromNetwork();
      toysDataPromise.catch(() => { toysDataPromise = null; });
    }
  }
  return await toysDataPromise;
};

const loadCachedBalloons = () => {
  try {
    const raw = localStorage.getItem(BALLOONS_CACHE_KEY);
    if (!raw) return null;
    const { data } = JSON.parse(raw);
    return data ?? null;
  } catch {
    return null;
  }
};

const saveBalloonsToCache = (data) => {
  try {
    localStorage.setItem(BALLOONS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // quota exceeded or private browsing
  }
};

const fetchBalloonsFromNetwork = () =>
  parseCsv(CATALOG_CSV_URLS.balloons).then((rows) => {
    const result = rows
      .map((row) => ({
        id: cleanValue(row.id),
        name: cleanValue(row.name),
        price: parseNumber(row.price),
        image: cleanValue(row.image),
        available: cleanValue(row.available),
        discount: parseNumber(row.discount),
        category: cleanValue(row.category).toLowerCase(),
        isAllBalloons: parseBoolean(row["isAll-balloons"]),
        isForBD: parseBoolean(row.isForBD),
        telegramText: cleanValue(row.telegramText),
        visible: cleanValue(row.visible),
        description: cleanValue(row.description),
      }))
      .filter((balloon) => balloon.id && balloon.name);
    saveBalloonsToCache(result);
    return result;
  });

const loadBalloonsData = async () => {
  if (!balloonsDataPromise) {
    const cached = loadCachedBalloons();
    if (cached) {
      balloonsDataPromise = Promise.resolve(cached);
      fetchBalloonsFromNetwork().catch(() => {});
    } else {
      balloonsDataPromise = fetchBalloonsFromNetwork();
      balloonsDataPromise.catch(() => { balloonsDataPromise = null; });
    }
  }
  return await balloonsDataPromise;
};

const buildCatalogState = (message) => `
  <div class="catalog-page__state">
    <p>${escapeHtml(message)}</p>
  </div>
`;

const buildCategoryCard = (category) => {
  const image = resolveCategoryImage(category);
  const saleClass = category.id === "sale" ? " category-card__title-sale" : "";
  const imageStyle = image ? ` style="--card-image: url('${escapeCssUrl(image)}')"` : "";
  const categoryTitle = getCategoryDisplayTitle(category);

  return `
    <a class="category-card" href="${escapeHtml(resolveCategoryUrl(category.id))}">
      <div
        class="category-card__image"
        ${imageStyle}
        aria-label="${escapeHtml(categoryTitle)}"
      ></div>
      <div class="category-card__footer">
        <span class="${saleClass.trim()}">${escapeHtml(categoryTitle)}</span>
        <span class="category-card__arrow" aria-hidden="true">›</span>
      </div>
    </a>
  `;
};

const buildSubcategoryCard = (category) => {
  const image = resolveCategoryImage(category);
  const categoryTitle = getCategoryDisplayTitle(category);
  const imageMarkup = image
    ? `<img class="catalog-group-card__img" src="${escapeHtml(image)}" alt="${escapeHtml(categoryTitle)}" loading="lazy" />`
    : "";

  return `
    <a class="catalog-group-card" href="${escapeHtml(resolveCategoryUrl(category.id))}">
      <div class="catalog-group-card__media${image ? "" : " is-empty"}">
        ${imageMarkup}
        <span class="catalog-group-card__placeholder">Фото скоро</span>
      </div>
      <div class="catalog-group-card__footer">
        <h2>${escapeHtml(categoryTitle)}</h2>
        <span class="catalog-group-card__arrow" aria-hidden="true">›</span>
      </div>
    </a>
  `;
};

const buildProductCard = (product) => {
  const discount = Math.max(0, Math.round(product.discount));
  const isAvailable = isAvailableEntity(product.available);
  const currentPrice =
    discount > 0 ? getDiscountedPrice(product.price, discount) : product.price;
  const productUrl = resolveProductUrl(product.id);
  const imageMarkup = product.image
    ? `<img class="catalog-product__img" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
    : "";
  const buyControl = isAvailable
    ? `<button class="catalog-product__button" type="button" data-add-to-cart data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.name)}" data-product-image="${escapeHtml(product.image)}" data-product-price="${currentPrice}" data-telegram-text="${escapeHtml(product.telegramText)}">Купити</button>`
    : `<span class="catalog-product__button is-disabled" aria-disabled="true">Купити</span>`;
  const favBtn = `<button class="catalog-product__fav" type="button" aria-label="Додати до обраного" data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.name)}" data-product-image="${escapeHtml(product.image)}" data-product-price="${currentPrice}"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M9 14S3 10.5 3 6.5A3.5 3.5 0 0 1 9 4a3.5 3.5 0 0 1 6 2.5C15 10.5 9 14 9 14z" stroke="currentColor" stroke-width="1.5"/></svg></button>`;

  return `
    <article class="catalog-product${isAvailable ? "" : " is-unavailable"}">
      ${favBtn}
      <a class="catalog-product__media${product.image ? "" : " is-empty"}" href="${escapeHtml(productUrl)}">
        ${
          discount > 0
            ? `<span class="catalog-product__badge">-${discount}%</span>`
            : ""
        }
        ${imageMarkup}
        <span class="catalog-product__placeholder">Фото скоро</span>
      </a>

      <div class="catalog-product__body">
        <span class="catalog-product__status ${
          isAvailable ? "is-available" : "is-unavailable"
        }">
          ${isAvailable ? "В наявності" : "Немає в наявності"}
        </span>

        <h2>
          <a class="catalog-product__title-link" href="${productUrl}">
            ${escapeHtml(product.name)}
          </a>
        </h2>

        <div class="catalog-product__price">
          <span class="catalog-product__price-current">${formatPrice(currentPrice)}</span>
          ${
            discount > 0
              ? `<span class="catalog-product__price-old">${formatPrice(product.price)}</span>`
              : ""
          }
        </div>

        <div class="catalog-product__actions">
          <a class="catalog-product__details" href="${escapeHtml(productUrl)}">Детальніше</a>
          ${buyControl}
        </div>
      </div>
    </article>
  `;
};

const applyImageFallbacks = (root) => {
  root
    .querySelectorAll(
      ".catalog-product__img, .catalog-group-card__img, .product-detail__img",
    )
    .forEach((image) => {
    image.addEventListener(
      "error",
      () => {
        const media =
          image.closest(".catalog-product__media") ||
          image.closest(".catalog-group-card__media") ||
          image.closest(".product-detail__media");

        image.remove();
        media?.classList.add("is-empty");
      },
      { once: true },
    );
  });
};

const getCatalogLead = (category, parentCategory) => {
  if (category.type === "subcategories") {
    return "Оберіть потрібну підкатегорію, щоб перейти до конкретних позицій каталогу.";
  }

  if (parentCategory) {
    return `Добірка товарів у підкатегорії “${getCategoryDisplayTitle(category)}”, доступних для замовлення через Telegram.`;
  }

  if (category.id === "popular") {
    return "У цьому розділі зібрані букети з окремої добірки магазину.";
  }

  if (category.id === "sale") {
    return "Тут зібрані акційні позиції зі знижками та вигідними пропозиціями.";
  }

  if (category.id === "ready") {
    return "Готові композиції для швидкого вибору та замовлення у кілька натискань.";
  }

  return `У цьому розділі зібрані товари категорії “${getCategoryDisplayTitle(category)}”.`;
};

const getProductLead = (product, category) => {
  if (category) {
    return `Композиція з категорії “${getCategoryDisplayTitle(category)}”, доступна для замовлення через Telegram.`;
  }

  return "Оберіть зручний спосіб замовлення та переходьте до оформлення через Telegram.";
};

const buildProductDetail = (product, categories) => {
  const discount = Math.max(0, Math.round(product.discount));
  const isAvailable = isAvailableEntity(product.available);
  const currentPrice =
    discount > 0 ? getDiscountedPrice(product.price, discount) : product.price;
  const buyControl = isAvailable
    ? `<button class="product-detail__button" type="button" data-add-to-cart data-product-id="${escapeHtml(product.id)}" data-product-name="${escapeHtml(product.name)}" data-product-image="${escapeHtml(product.image)}" data-product-price="${currentPrice}" data-telegram-text="${escapeHtml(product.telegramText)}">До кошика</button>`
    : `<span class="product-detail__button is-disabled" aria-disabled="true">До кошика</span>`;
  const description = product.description
    ? `<div class="product-detail__description"><p>${escapeHtml(product.description)}</p></div>`
    : "";
  const categoriesMarkup = categories.length
    ? `
        <div class="product-detail__categories">
          ${categories
            .map(
              (category) =>
                `<span class="product-detail__category-tag">${escapeHtml(getCategoryDisplayTitle(category))}</span>`,
            )
            .join("")}
        </div>
      `
    : "";
  const imageMarkup = product.image
    ? `<img class="product-detail__img" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="eager" />`
    : "";

  return `
    <section class="product-detail">
      <div class="product-detail__gallery">
        <div class="product-detail__media${product.image ? "" : " is-empty"}">
          ${
            discount > 0
              ? `<span class="product-detail__badge">-${discount}%</span>`
              : ""
          }
          ${imageMarkup}
          <span class="product-detail__placeholder">Фото скоро</span>
        </div>
      </div>

      <div class="product-detail__panel">
        <div class="product-detail__meta">
          <span class="product-detail__availability ${
            isAvailable ? "is-available" : "is-unavailable"
          }">
            ${isAvailable ? "В наявності" : "Немає в наявності"}
          </span>
          <span class="product-detail__article">Артикул: ${escapeHtml(product.id)}</span>
        </div>

        ${categoriesMarkup}

        <div class="product-detail__price">
          <span class="product-detail__price-current">${formatPrice(currentPrice)}</span>
          ${
            discount > 0
              ? `<span class="product-detail__price-old">${formatPrice(product.price)}</span>`
              : ""
          }
        </div>

        <div class="product-detail__purchase">
          ${buyControl}
        </div>

        <div class="product-detail__notice">
          <span>Додайте товар до кошика та оформте замовлення через Telegram.</span>
        </div>

        ${description}
      </div>
    </section>
  `;
};

const renderHomeCategories = async () => {
  const homeCategoriesRoot = document.querySelector("[data-home-categories]");

  if (!homeCategoriesRoot) {
    return;
  }

  try {
    const { categories } = await loadCatalogData();
    const rootCategories = sortByOrder(
      categories.filter(
        (category) => !category.parent && isVisibleEntity(category.visible),
      ),
    );

    if (!rootCategories.length) {
      return;
    }

    homeCategoriesRoot.innerHTML = rootCategories
      .map((category) => buildCategoryCard(category))
      .join("");
    bindPageTransitions(homeCategoriesRoot);
  } catch (error) {
    logCatalogError("home-categories", error);
  }
};

const renderCatalogPage = async () => {
  const catalogPage = document.querySelector("[data-catalog-page]");
  if (!catalogPage) return;

  const eyebrow = catalogPage.querySelector("[data-catalog-eyebrow]");
  const title = catalogPage.querySelector("[data-catalog-title]");
  const lead = catalogPage.querySelector("[data-catalog-lead]");
  const content = catalogPage.querySelector("[data-catalog-content]");
  const filtersEl = catalogPage.querySelector("[data-catalog-filters]");
  const queryCategoryId = new URLSearchParams(window.location.search).get("category");
  const fallbackCategoryId = cleanValue(catalogPage.dataset.categoryId);
  const activeCategoryId = cleanValue(queryCategoryId) || fallbackCategoryId;

  if (!content || !activeCategoryId) return;

  const { wrapper: searchEl, input: searchInput, initialQuery } = mountCatalogSearch(catalogPage, filtersEl || content);
  let searchQuery = initialQuery;
  let _abortRef = {};

  content.innerHTML = buildCatalogState("Завантажуємо каталог...");

  try {
    const { categories, products } = await loadCatalogData();
    const visibleCategories = categories.filter((category) => isVisibleEntity(category.visible));
    const visibleProducts = products.filter((product) => isVisibleEntity(product.visible));

    const activeCategory = visibleCategories.find((category) => category.id === activeCategoryId);
    if (!activeCategory) {
      content.innerHTML = buildCatalogState("Цей розділ тимчасово недоступний.");
      return;
    }

    const parentCategory = activeCategory.parent
      ? visibleCategories.find((category) => category.id === activeCategory.parent)
      : null;

    if (eyebrow) eyebrow.textContent = parentCategory ? getCategoryDisplayTitle(parentCategory) : "Каталог";
    if (title) title.textContent = getCategoryDisplayTitle(activeCategory);
    if (lead) lead.textContent = getCatalogLead(activeCategory, parentCategory);
    document.title = `${getCategoryDisplayTitle(activeCategory)} | SHELYST FLOWERS`;

    if (activeCategory.type === "subcategories") {
      const childCatIds = visibleCategories
        .filter((c) => c.parent === activeCategory.id)
        .map((c) => c.id);
      const allChildProducts = visibleProducts.filter((p) => childCatIds.includes(p.category));

      const rerender = () => {
        _abortRef.cancelled = true;
        _abortRef = {};
        const token = _abortRef;
        const q = searchQuery.trim();

        if (q) {
          const matched = allChildProducts.filter((p) => matchesSearch(p, searchQuery));
          if (matched.length > 0) {
            content.innerHTML = `<div class="catalog-products__grid">${matched.map(buildProductCard).join("")}</div>`;
            bindPageTransitions(content);
            applyImageFallbacks(content);
          } else if (q.length >= 2) {
            scheduleCrossCatalogRedirect(q, "flowers", content, token);
          } else {
            content.innerHTML = buildCatalogState("Нічого не знайдено.");
          }
          return;
        }

        const childCategories = sortByOrder(visibleCategories.filter((c) => c.parent === activeCategory.id));
        content.innerHTML = childCategories.length
          ? `<div class="catalog-groups__grid">${childCategories.map(buildSubcategoryCard).join("")}</div>`
          : buildCatalogState("У цій категорії ще немає підкатегорій.");
        bindPageTransitions(content);
      };

      searchInput?.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        searchEl.classList.toggle("has-query", !!searchQuery);
        rerender();
      });
      bindCatalogSearchClear(searchEl, () => {
        searchQuery = "";
        _abortRef.cancelled = true;
        _abortRef = {};
        rerender();
      });
      rerender();
      return;
    }

    const categoryProducts = visibleProducts.filter((product) =>
      productHasCategory(product, activeCategory.id),
    );
    let sortOrder = null;

    const renderGrid = () => {
      _abortRef.cancelled = true;
      _abortRef = {};
      const token = _abortRef;

      const filtered = categoryProducts.filter((p) => matchesSearch(p, searchQuery));
      if (filtered.length === 0 && searchQuery.trim().length >= 2) {
        scheduleCrossCatalogRedirect(searchQuery.trim(), "flowers", content, token);
        return;
      }

      const sorted = [...filtered];
      if (sortOrder === "asc") sorted.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
      else if (sortOrder === "desc") sorted.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));

      content.innerHTML = sorted.length
        ? `<div class="catalog-products__grid">${sorted.map(buildProductCard).join("")}</div>`
        : buildCatalogState("У цій категорії поки що немає товарів.");
      bindPageTransitions(content);
      applyImageFallbacks(content);
    };

    const renderSort = () => {
      if (!filtersEl) return;
      filtersEl.innerHTML = buildSortMarkup(sortOrder);
      filtersEl.querySelectorAll("[data-sort]").forEach((btn) => {
        btn.addEventListener("click", () => {
          sortOrder = sortOrder === btn.dataset.sort ? null : btn.dataset.sort;
          renderSort();
          renderGrid();
        });
      });
    };

    searchInput?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      searchEl.classList.toggle("has-query", !!searchQuery);
      renderGrid();
    });
    bindCatalogSearchClear(searchEl, () => {
      searchQuery = "";
      _abortRef.cancelled = true;
      _abortRef = {};
      renderGrid();
    });

    renderSort();
    renderGrid();
  } catch (error) {
    logCatalogError("catalog-page", error);
    content.innerHTML = buildCatalogState(getCatalogErrorText(error));
  }
};

const buildSortMarkup = (sortOrder) => `
  <div class="bouquets-filters">
    <div class="bouquets-filters__sort">
      <button class="bouquets-sort__btn${sortOrder === "asc" ? " is-active" : ""}" type="button" data-sort="asc">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 1.5v10M2.5 5.5l4-4 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Від дешевших
      </button>
      <button class="bouquets-sort__btn${sortOrder === "desc" ? " is-active" : ""}" type="button" data-sort="desc">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 11.5v-10M2.5 7.5l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Від дорожчих
      </button>
    </div>
  </div>
`;

// ============================================================
// CATALOG INLINE SEARCH — utilities
// ============================================================

const matchesSearch = (item, query) => {
  const q = cleanValue(query).toLowerCase();
  if (!q) return true;
  return (
    (item.name || "").toLowerCase().includes(q) ||
    (item.description || "").toLowerCase().includes(q)
  );
};

const buildCatalogSearchBar = () => `
  <div class="catalog-search__inner">
    <svg class="catalog-search__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" stroke-width="1.6"/>
      <path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
    <input
      class="catalog-search__input"
      type="search"
      placeholder="Пошук за назвою..."
      autocomplete="off"
      data-catalog-search-input
    />
    <button class="catalog-search__clear" type="button" aria-label="Очистити пошук" data-catalog-search-clear>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
`;

const CATALOG_SEARCH_REGISTRY = [
  {
    key: "bouquets",
    label: "Готові композиції",
    getUrl: (q) => `${assetPrefix}pages/bukety.html?q=${encodeURIComponent(q)}`,
    getProducts: async () => {
      const { products } = await loadCatalogData();
      return products.filter(
        (p) =>
          isVisibleEntity(p.visible) &&
          (p.isAllBouquets || p.category === "mono-bouquets" || p.category === "mixed-bouquets"),
      );
    },
  },
  {
    key: "flowers",
    label: "Усі квіти",
    getUrl: (q) => `${assetPrefix}pages/troyandy.html?q=${encodeURIComponent(q)}`,
    getProducts: async () => {
      const { categories, products } = await loadCatalogData();
      const visibleCats = categories.filter((c) => isVisibleEntity(c.visible));
      const flowerCatIds = visibleCats.filter((c) => c.parent === "all-flowers").map((c) => c.id);
      return products.filter((p) => isVisibleEntity(p.visible) && flowerCatIds.includes(p.category));
    },
  },
  {
    key: "toys",
    label: "М'які іграшки",
    getUrl: (q) => `${assetPrefix}pages/igrashky.html?q=${encodeURIComponent(q)}`,
    getProducts: async () => {
      const toys = await loadToysData();
      return toys.filter((t) => isVisibleEntity(t.visible));
    },
  },
  {
    key: "balloons",
    label: "Кульки",
    getUrl: (q) => `${assetPrefix}pages/kulky.html?q=${encodeURIComponent(q)}`,
    getProducts: async () => {
      const balloons = await loadBalloonsData();
      return balloons.filter((b) => isVisibleEntity(b.visible));
    },
  },
];

const findInOtherCatalogs = async (query, excludeKey) => {
  const others = CATALOG_SEARCH_REGISTRY.filter((c) => c.key !== excludeKey);
  const results = await Promise.allSettled(
    others.map(async (catalog) => {
      const products = await catalog.getProducts();
      const count = products.filter((p) => matchesSearch(p, query)).length;
      return { catalog, count };
    }),
  );
  const found = results
    .filter((r) => r.status === "fulfilled" && r.value.count > 0)
    .map((r) => r.value)
    .sort((a, b) => b.count - a.count);
  return found.length > 0 ? found[0] : null;
};

const mountCatalogSearch = (page, beforeEl) => {
  const wrapper = document.createElement("div");
  wrapper.className = "catalog-search";
  wrapper.innerHTML = buildCatalogSearchBar();
  if (beforeEl) {
    beforeEl.parentNode.insertBefore(wrapper, beforeEl);
  } else {
    page.appendChild(wrapper);
  }
  const input = wrapper.querySelector("[data-catalog-search-input]");
  const urlQ = cleanValue(new URLSearchParams(window.location.search).get("q"));
  if (urlQ) {
    input.value = urlQ;
    wrapper.classList.add("has-query");
  }
  return { wrapper, input, initialQuery: urlQ };
};

const bindCatalogSearchClear = (wrapper, onClear) => {
  wrapper.addEventListener("click", (e) => {
    if (!e.target.closest("[data-catalog-search-clear]")) return;
    const input = wrapper.querySelector("[data-catalog-search-input]");
    if (input) input.value = "";
    wrapper.classList.remove("has-query");
    onClear();
  });
};

const scheduleCrossCatalogRedirect = (query, excludeKey, contentEl, abortRef, delayMs = 600) => {
  const token = abortRef;
  contentEl.innerHTML = buildCatalogState("Шукаємо у інших розділах...");
  setTimeout(async () => {
    if (token.cancelled) return;
    const found = await findInOtherCatalogs(query, excludeKey);
    if (token.cancelled) return;
    if (found) {
      document.body.classList.add("is-leaving");
      setTimeout(() => window.location.assign(found.catalog.getUrl(query)), 420);
    } else {
      if (!token.cancelled) contentEl.innerHTML = buildCatalogState("Нічого не знайдено.");
    }
  }, delayMs);
};

const buildBouquetsFilters = (categories, activeCategory, sortOrder) => {
  const allLabel = "Всі";
  const activeLabel = activeCategory === "all"
    ? allLabel
    : (categories.find((c) => c.id === activeCategory) ? getCategoryDisplayTitle(categories.find((c) => c.id === activeCategory)) : allLabel);

  const chips = [
    `<button class="bouquets-chip${activeCategory === "all" ? " is-active" : ""}" type="button" data-filter-cat="all">Всі</button>`,
    ...categories.map(
      (c) =>
        `<button class="bouquets-chip${activeCategory === c.id ? " is-active" : ""}" type="button" data-filter-cat="${escapeHtml(c.id)}">${escapeHtml(getCategoryDisplayTitle(c))}</button>`,
    ),
  ].join("");

  return `
    <div class="bouquets-filters">
      <div class="bouquets-filters__top">
        <button class="bouquets-cats-toggle" type="button" aria-expanded="false">
          <span class="bouquets-cats-toggle__label">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1" y="2.5" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="6.25" width="8" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="10" width="5" height="1.5" rx="0.75" fill="currentColor"/></svg>
            ${escapeHtml(activeLabel)}
          </span>
          <svg class="bouquets-cats-toggle__chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="bouquets-filters__sort">
          <button class="bouquets-sort__btn${sortOrder === "asc" ? " is-active" : ""}" type="button" data-sort="asc">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 1.5v10M2.5 5.5l4-4 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Від дешевших
          </button>
          <button class="bouquets-sort__btn${sortOrder === "desc" ? " is-active" : ""}" type="button" data-sort="desc">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 11.5v-10M2.5 7.5l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Від дорожчих
          </button>
        </div>
      </div>
      <div class="bouquets-filters__cats">${chips}</div>
    </div>
  `;
};

const renderBouquetsPage = async () => {
  const page = document.querySelector("[data-bouquets-page]");
  if (!page) return;

  const filtersEl = page.querySelector("[data-bouquets-filters]");
  const contentEl = page.querySelector("[data-bouquets-content]");
  if (!contentEl) return;

  const { wrapper: searchEl, input: searchInput, initialQuery } = mountCatalogSearch(page, filtersEl || contentEl);
  let searchQuery = initialQuery;
  let _abortRef = {};

  contentEl.innerHTML = buildCatalogState("Завантажуємо каталог...");

  try {
    const { categories, products } = await loadCatalogData();
    const visibleCategories = categories.filter((c) => isVisibleEntity(c.visible));
    const visibleProducts = products.filter((p) => isVisibleEntity(p.visible));

    const bouquetCategories = BOUQUET_FILTER_IDS.map((id) =>
      visibleCategories.find((c) => c.id === id),
    ).filter(Boolean);

    const allBouquetProducts = visibleProducts.filter(
      (p) => p.isAllBouquets || p.category === "mono-bouquets" || p.category === "mixed-bouquets",
    );

    const urlFilter = new URLSearchParams(window.location.search).get("filter");
    let activeCategory = urlFilter && BOUQUET_FILTER_IDS.includes(urlFilter) ? urlFilter : "all";
    let sortOrder = null;

    const getFilteredProducts = () => {
      let result =
        activeCategory === "all"
          ? allBouquetProducts.filter((p) => matchesSearch(p, searchQuery))
          : allBouquetProducts.filter((p) => productHasCategory(p, activeCategory) && matchesSearch(p, searchQuery));
      if (sortOrder === "asc") result.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
      else if (sortOrder === "desc") result.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
      return result;
    };

    const renderGrid = () => {
      _abortRef.cancelled = true;
      _abortRef = {};
      const token = _abortRef;

      const filtered = getFilteredProducts();
      if (filtered.length === 0 && searchQuery.trim().length >= 2) {
        scheduleCrossCatalogRedirect(searchQuery.trim(), "bouquets", contentEl, token);
        return;
      }

      contentEl.innerHTML = filtered.length
        ? `<div class="catalog-products__grid">${filtered.map(buildProductCard).join("")}</div>`
        : buildCatalogState("У цій категорії поки що немає товарів.");
      bindPageTransitions(contentEl);
      applyImageFallbacks(contentEl);
    };

    const renderFilters = () => {
      if (!filtersEl) return;
      filtersEl.innerHTML = buildBouquetsFilters(bouquetCategories, activeCategory, sortOrder);

      const toggleBtn = filtersEl.querySelector(".bouquets-cats-toggle");
      const catsPanel = filtersEl.querySelector(".bouquets-filters__cats");
      if (toggleBtn && catsPanel) {
        toggleBtn.addEventListener("click", () => {
          const isOpen = toggleBtn.getAttribute("aria-expanded") === "true";
          toggleBtn.setAttribute("aria-expanded", String(!isOpen));
          catsPanel.classList.toggle("is-open", !isOpen);
        });
      }

      filtersEl.querySelectorAll("[data-filter-cat]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeCategory = btn.dataset.filterCat;
          if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
          if (catsPanel) catsPanel.classList.remove("is-open");
          renderFilters();
          renderGrid();
        });
      });

      filtersEl.querySelectorAll("[data-sort]").forEach((btn) => {
        btn.addEventListener("click", () => {
          sortOrder = sortOrder === btn.dataset.sort ? null : btn.dataset.sort;
          renderFilters();
          renderGrid();
        });
      });
    };

    searchInput?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      searchEl.classList.toggle("has-query", !!searchQuery);
      renderFilters();
      renderGrid();
    });
    bindCatalogSearchClear(searchEl, () => {
      searchQuery = "";
      _abortRef.cancelled = true;
      _abortRef = {};
      renderFilters();
      renderGrid();
    });

    renderFilters();
    renderGrid();
  } catch (error) {
    logCatalogError("bouquets-page", error);
    contentEl.innerHTML = buildCatalogState(getCatalogErrorText(error));
  }
};

const renderToysPage = async () => {
  const page = document.querySelector("[data-toys-page]");
  if (!page) return;

  const filtersEl = page.querySelector("[data-toys-filters]");
  const contentEl = page.querySelector("[data-toys-content]");
  if (!contentEl) return;

  const { wrapper: searchEl, input: searchInput, initialQuery } = mountCatalogSearch(page, filtersEl || contentEl);
  let searchQuery = initialQuery;
  let _abortRef = {};

  contentEl.innerHTML = buildCatalogState("Завантажуємо каталог...");

  try {
    const toys = await loadToysData();
    const visibleToys = toys.filter((t) => isVisibleEntity(t.visible));

    const filterCategories = TOY_FILTER_IDS.map((id) => ({ id, title: TOY_FILTER_LABELS[id] }));
    const allToyProducts = visibleToys.filter((t) => t.isAllToys);

    const urlFilter = new URLSearchParams(window.location.search).get("filter");
    let activeCategory = urlFilter && TOY_FILTER_IDS.includes(urlFilter) ? urlFilter : "all";
    let sortOrder = null;

    const getFilteredToys = () => {
      let result;
      if (activeCategory === "all") {
        result = allToyProducts.filter((t) => matchesSearch(t, searchQuery));
      } else if (activeCategory === "sale") {
        result = visibleToys.filter((t) => t.isSale && matchesSearch(t, searchQuery));
      } else {
        result = visibleToys.filter((t) => t.category === activeCategory && matchesSearch(t, searchQuery));
      }
      if (sortOrder === "asc") result.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
      else if (sortOrder === "desc") result.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
      return result;
    };

    const renderGrid = () => {
      _abortRef.cancelled = true;
      _abortRef = {};
      const token = _abortRef;

      const filtered = getFilteredToys();
      if (filtered.length === 0 && searchQuery.trim().length >= 2) {
        scheduleCrossCatalogRedirect(searchQuery.trim(), "toys", contentEl, token);
        return;
      }

      contentEl.innerHTML = filtered.length
        ? `<div class="catalog-products__grid">${filtered.map(buildProductCard).join("")}</div>`
        : buildCatalogState("У цій категорії поки що немає товарів.");
      bindPageTransitions(contentEl);
      applyImageFallbacks(contentEl);
    };

    const renderFilters = () => {
      if (!filtersEl) return;
      filtersEl.innerHTML = buildBouquetsFilters(filterCategories, activeCategory, sortOrder);

      filtersEl.querySelectorAll("[data-filter-cat]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeCategory = btn.dataset.filterCat;
          renderFilters();
          renderGrid();
        });
      });

      filtersEl.querySelectorAll("[data-sort]").forEach((btn) => {
        btn.addEventListener("click", () => {
          sortOrder = sortOrder === btn.dataset.sort ? null : btn.dataset.sort;
          renderFilters();
          renderGrid();
        });
      });
    };

    searchInput?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      searchEl.classList.toggle("has-query", !!searchQuery);
      renderFilters();
      renderGrid();
    });
    bindCatalogSearchClear(searchEl, () => {
      searchQuery = "";
      _abortRef.cancelled = true;
      _abortRef = {};
      renderFilters();
      renderGrid();
    });

    renderFilters();
    renderGrid();
  } catch (error) {
    logCatalogError("toys-page", error);
    contentEl.innerHTML = buildCatalogState(getCatalogErrorText(error));
  }
};

const renderBalloonsPage = async () => {
  const page = document.querySelector("[data-balloons-page]");
  if (!page) return;

  const filtersEl = page.querySelector("[data-balloons-filters]");
  const contentEl = page.querySelector("[data-balloons-content]");
  if (!contentEl) return;

  const { wrapper: searchEl, input: searchInput, initialQuery } = mountCatalogSearch(page, filtersEl || contentEl);
  let searchQuery = initialQuery;
  let _abortRef = {};

  contentEl.innerHTML = buildCatalogState("Завантажуємо каталог...");

  try {
    const balloons = await loadBalloonsData();
    const visibleBalloons = balloons.filter((b) => isVisibleEntity(b.visible));

    const filterCategories = BALLOON_FILTER_IDS.map((id) => ({ id, title: BALLOON_FILTER_LABELS[id] }));
    const allBalloonProducts = visibleBalloons.filter((b) => b.isAllBalloons);

    const urlFilter = new URLSearchParams(window.location.search).get("filter");
    let activeCategory = urlFilter && BALLOON_FILTER_IDS.includes(urlFilter) ? urlFilter : "all";
    let sortOrder = null;

    const getFilteredBalloons = () => {
      let result;
      if (activeCategory === "all") {
        result = allBalloonProducts.filter((b) => matchesSearch(b, searchQuery));
      } else if (activeCategory === "bd") {
        result = visibleBalloons.filter((b) => (b.isForBD || b.category === "forbd") && matchesSearch(b, searchQuery));
      } else {
        result = visibleBalloons.filter((b) => b.category === activeCategory && matchesSearch(b, searchQuery));
      }
      if (sortOrder === "asc") result.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
      else if (sortOrder === "desc") result.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
      return result;
    };

    const renderGrid = () => {
      _abortRef.cancelled = true;
      _abortRef = {};
      const token = _abortRef;

      const filtered = getFilteredBalloons();
      if (filtered.length === 0 && searchQuery.trim().length >= 2) {
        scheduleCrossCatalogRedirect(searchQuery.trim(), "balloons", contentEl, token);
        return;
      }

      contentEl.innerHTML = filtered.length
        ? `<div class="catalog-products__grid">${filtered.map(buildProductCard).join("")}</div>`
        : buildCatalogState("У цій категорії поки що немає товарів.");
      bindPageTransitions(contentEl);
      applyImageFallbacks(contentEl);
    };

    const renderFilters = () => {
      if (!filtersEl) return;
      filtersEl.innerHTML = buildBouquetsFilters(filterCategories, activeCategory, sortOrder);

      filtersEl.querySelectorAll("[data-filter-cat]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeCategory = btn.dataset.filterCat;
          renderFilters();
          renderGrid();
        });
      });

      filtersEl.querySelectorAll("[data-sort]").forEach((btn) => {
        btn.addEventListener("click", () => {
          sortOrder = sortOrder === btn.dataset.sort ? null : btn.dataset.sort;
          renderFilters();
          renderGrid();
        });
      });
    };

    searchInput?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      searchEl.classList.toggle("has-query", !!searchQuery);
      renderFilters();
      renderGrid();
    });
    bindCatalogSearchClear(searchEl, () => {
      searchQuery = "";
      _abortRef.cancelled = true;
      _abortRef = {};
      renderFilters();
      renderGrid();
    });

    renderFilters();
    renderGrid();
  } catch (error) {
    logCatalogError("balloons-page", error);
    contentEl.innerHTML = buildCatalogState(getCatalogErrorText(error));
  }
};

const renderSalePage = async () => {
  const page = document.querySelector("[data-sale-page]");
  if (!page) return;

  const filtersEl = page.querySelector("[data-sale-filters]");
  const contentEl = page.querySelector("[data-sale-content]");
  if (!contentEl) return;

  const { wrapper: searchEl, input: searchInput, initialQuery } = mountCatalogSearch(page, filtersEl || contentEl);
  let searchQuery = initialQuery;
  let _abortRef = {};

  contentEl.innerHTML = buildCatalogState("Завантажуємо каталог...");

  try {
    const [catalogResult, toysResult, balloonsResult] = await Promise.allSettled([
      loadCatalogData(),
      loadToysData(),
      loadBalloonsData(),
    ]);

    let saleFlowers = [];
    let saleToys = [];
    let saleBalloons = [];

    if (catalogResult.status === "fulfilled") {
      const { products } = catalogResult.value;
      saleFlowers = products.filter((p) => isVisibleEntity(p.visible) && p.isSale);
    }

    if (toysResult.status === "fulfilled") {
      saleToys = toysResult.value.filter((t) => isVisibleEntity(t.visible) && t.isSale);
    }

    if (balloonsResult.status === "fulfilled") {
      saleBalloons = balloonsResult.value.filter(
        (b) => isVisibleEntity(b.visible) && (b.isForBD || b.category === "forbd"),
      );
    }

    const filterCategories = [
      { id: "flowers", title: "Квіти" },
      { id: "toys", title: "Іграшки" },
      { id: "balloons", title: "Кульки" },
    ];

    let activeCategory = "all";
    let sortOrder = null;

    const getFiltered = () => {
      let base;
      if (activeCategory === "flowers") base = [...saleFlowers];
      else if (activeCategory === "toys") base = [...saleToys];
      else if (activeCategory === "balloons") base = [...saleBalloons];
      else base = [...saleFlowers, ...saleToys, ...saleBalloons];

      let result = base.filter((p) => matchesSearch(p, searchQuery));
      if (sortOrder === "asc") result.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
      else if (sortOrder === "desc") result.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
      return result;
    };

    const renderGrid = () => {
      _abortRef.cancelled = true;
      _abortRef = {};

      const filtered = getFiltered();
      contentEl.innerHTML = filtered.length
        ? `<div class="catalog-products__grid">${filtered.map(buildProductCard).join("")}</div>`
        : buildCatalogState(searchQuery.trim() ? "Нічого не знайдено." : "У цьому розділі поки що немає акційних товарів.");
      bindPageTransitions(contentEl);
      applyImageFallbacks(contentEl);
    };

    const renderFilters = () => {
      if (!filtersEl) return;
      filtersEl.innerHTML = buildBouquetsFilters(filterCategories, activeCategory, sortOrder);

      filtersEl.querySelectorAll("[data-filter-cat]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeCategory = btn.dataset.filterCat;
          renderFilters();
          renderGrid();
        });
      });

      filtersEl.querySelectorAll("[data-sort]").forEach((btn) => {
        btn.addEventListener("click", () => {
          sortOrder = sortOrder === btn.dataset.sort ? null : btn.dataset.sort;
          renderFilters();
          renderGrid();
        });
      });
    };

    searchInput?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      searchEl.classList.toggle("has-query", !!searchQuery);
      renderFilters();
      renderGrid();
    });
    bindCatalogSearchClear(searchEl, () => {
      searchQuery = "";
      _abortRef.cancelled = true;
      _abortRef = {};
      renderFilters();
      renderGrid();
    });

    renderFilters();
    renderGrid();
  } catch (error) {
    logCatalogError("sale-page", error);
    contentEl.innerHTML = buildCatalogState(getCatalogErrorText(error));
  }
};

const renderProductPage = async () => {
  const productPage = document.querySelector("[data-product-page]");

  if (!productPage) {
    return;
  }

  const title = productPage.querySelector("[data-product-title]");
  const lead = productPage.querySelector("[data-product-lead]");
  const content = productPage.querySelector("[data-product-content]");
  const productId = cleanValue(
    new URLSearchParams(window.location.search).get("id"),
  );

  if (!content || !productId) {
    if (content) {
      content.innerHTML = buildCatalogState("Товар не знайдено.");
    }
    return;
  }

  content.innerHTML = buildCatalogState("Завантажуємо товар...");

  try {
    const [catalogResult, toysResult, balloonsResult] = await Promise.allSettled([
      loadCatalogData(),
      loadToysData(),
      loadBalloonsData(),
    ]);

    let visibleCategories = [];
    const allVisibleProducts = [];

    if (catalogResult.status === "fulfilled") {
      const { categories, products } = catalogResult.value;
      visibleCategories = categories.filter((c) => isVisibleEntity(c.visible));
      allVisibleProducts.push(...products.filter((p) => isVisibleEntity(p.visible)));
    }

    if (toysResult.status === "fulfilled") {
      allVisibleProducts.push(...toysResult.value.filter((t) => isVisibleEntity(t.visible)));
    }

    if (balloonsResult.status === "fulfilled") {
      allVisibleProducts.push(...balloonsResult.value.filter((b) => isVisibleEntity(b.visible)));
    }

    const product = allVisibleProducts.find((item) => item.id === productId);

    if (!product) {
      content.innerHTML = buildCatalogState("Товар не знайдено.");
      return;
    }

    const productCategories = getProductCategoryIds(product)
      .map((categoryId) => visibleCategories.find((item) => item.id === categoryId))
      .filter(Boolean);
    const primaryCategory =
      visibleCategories.find((item) => item.id === product.category) || null;
    const eyebrow = productPage.querySelector("[data-product-eyebrow]");

    if (eyebrow) {
      eyebrow.textContent = primaryCategory
        ? getCategoryDisplayTitle(primaryCategory)
        : "SHELYST FLOWERS";
    }

    if (title) {
      title.textContent = product.name;
    }

    if (lead) {
      lead.textContent = getProductLead(product, primaryCategory);
    }

    document.title = `${product.name} | SHELYST FLOWERS`;
    content.innerHTML = buildProductDetail(product, productCategories);
    bindPageTransitions(content);
    applyImageFallbacks(content);
  } catch (error) {
    logCatalogError("product-page", error);
    content.innerHTML = buildCatalogState(getCatalogErrorText(error));
  }
};

if (!document.querySelector(".site-header")) {
  document.body.insertAdjacentHTML("afterbegin", buildHeaderMarkup(assetPrefix));
  window.CART._updateBadge();
}

if (!document.querySelector(".site-footer")) {
  document.body.insertAdjacentHTML("beforeend", buildFooterMarkup(assetPrefix));
}

if (isInnerPage) {
  document.querySelectorAll(".content-page__card").forEach((card) => {
    if (!card.querySelector(".content-page__back")) {
      card.insertAdjacentHTML(
        "afterbegin",
        `<a class="content-page__back" href="${assetPrefix}index.html">← Головна</a>`,
      );
    }
  });
}

const searchCatalog = [
  {
    title: "Готові композиції",
    description: "Розділ з готовими композиціями для швидкого вибору.",
    url: `${assetPrefix}pages/bukety.html`,
    keywords: "букети готові композиції квіти",
  },
  {
    title: "Усі квіти",
    description: "Усі доступні квіти магазину в одному розділі.",
    url: `${assetPrefix}pages/troyandy.html`,
    keywords: "усі квіти троянди каталог",
  },
  {
    title: "Класичні композиції",
    description: "Стримані та елегантні композиції для особливих моментів.",
    url: `${assetPrefix}pages/bukety.html?filter=classic`,
    keywords: "класичні композиції квіти",
  },
  {
    title: "Усі букети",
    description: "Окрема добірка букетів магазину для швидкого перегляду.",
    url: `${assetPrefix}pages/bukety.html?filter=popular`,
    keywords: "усі букети популярні композиції добірка",
  },
  {
    title: "Акційні",
    description: "Спеціальні пропозиції та акційні композиції.",
    url: `${assetPrefix}pages/aktsiyni.html`,
    keywords: "акційні знижки акції",
  },
  {
    title: "Про нас",
    description: "Історія, стиль і підхід SHELYST FLOWERS.",
    url: `${assetPrefix}index.html#about`,
    keywords: "про нас магазин shelyst flowers",
  },
  {
    title: "Оплата",
    description: "Інформація про оформлення та оплату через Telegram.",
    url: `${assetPrefix}pages/oplata.html`,
    keywords: "оплата telegram замовлення",
  },
  {
    title: "Контакти",
    description: "Телефон, локація, адреса та графік роботи магазину.",
    url: `${assetPrefix}pages/kontakty.html`,
    keywords: "контакти телефон адреса графік telegram",
  },
];

const renderSearchPage = () => {
  const searchPage = document.querySelector("[data-search-page]");
  const searchInput = document.querySelector("[data-search-input]");
  const searchResults = document.querySelector("[data-search-results]");

  if (!searchPage || !searchInput || !searchResults) {
    return;
  }

  const renderResults = (query) => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredItems = normalizedQuery
      ? searchCatalog.filter((item) =>
          `${item.title} ${item.description} ${item.keywords}`
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : searchCatalog;

    if (!filteredItems.length) {
      searchResults.innerHTML = `
        <div class="search-page__empty">
          <p>Нічого не знайдено. Спробуйте інший запит.</p>
        </div>
      `;
      return;
    }

    searchResults.innerHTML = filteredItems
      .map(
        (item) => `
          <a class="search-page__result" href="${item.url}">
            <h2>${item.title}</h2>
            <p>${item.description}</p>
          </a>
        `,
      )
      .join("");

    bindPageTransitions(searchResults);
  };

  renderResults(searchInput.value);
  searchInput.addEventListener("input", (event) => {
    renderResults(event.target.value);
  });
  searchInput.focus();
};

const slides = Array.from(document.querySelectorAll(".hero-slide"));
const dots = Array.from(document.querySelectorAll(".hero-slider__dots button"));
const aboutToggle = document.querySelector(".about-toggle");
const aboutContent = document.querySelector(".about-card__content");
const aboutGallerySlides = Array.from(
  document.querySelectorAll(".about-gallery__slide"),
);
const aboutGalleryDots = Array.from(
  document.querySelectorAll(".about-gallery__dots button"),
);
const menuToggle = document.querySelector(".menu-toggle");
const menuClose = document.querySelector(".menu-close");
const menuBackdrop = document.querySelector(".menu-backdrop");

const openMenu = () => {
  document.body.classList.add("menu-open");
  menuToggle?.setAttribute("aria-expanded", "true");
};

const closeMenu = () => {
  document.body.classList.remove("menu-open");
  menuToggle?.setAttribute("aria-expanded", "false");
};

menuToggle?.addEventListener("click", openMenu);
menuClose?.addEventListener("click", closeMenu);
menuBackdrop?.addEventListener("click", closeMenu);

window.addEventListener("resize", () => {
  if (window.innerWidth > 980) {
    closeMenu();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
  }
});

if (aboutToggle && aboutContent) {
  aboutToggle.addEventListener("click", () => {
    const isExpanded = aboutToggle.getAttribute("aria-expanded") === "true";
    aboutToggle.setAttribute("aria-expanded", String(!isExpanded));
    aboutToggle.textContent = isExpanded ? "Розгорнути" : "Згорнути";
    aboutContent.hidden = false;
    aboutContent.classList.toggle("is-open", !isExpanded);

    if (isExpanded) {
      window.setTimeout(() => {
        aboutContent.hidden = true;
      }, 320);
    }
  });
}

if (slides.length && dots.length) {
  let activeIndex = 0;

  const setActiveSlide = (nextIndex) => {
    slides[activeIndex].classList.remove("is-active");
    dots[activeIndex].classList.remove("is-active");

    activeIndex = nextIndex;

    slides[activeIndex].classList.add("is-active");
    dots[activeIndex].classList.add("is-active");
  };

  const startAutoplay = () => {
    _heroAutoplayId = window.setInterval(() => {
      const nextIndex = (activeIndex + 1) % slides.length;
      setActiveSlide(nextIndex);
    }, 5200);
  };

  const resetAutoplay = () => {
    window.clearInterval(_heroAutoplayId);
    startAutoplay();
  };

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      setActiveSlide(index);
      resetAutoplay();
    });
  });

  startAutoplay();
}

if (aboutGallerySlides.length && aboutGalleryDots.length) {
  let activeGalleryIndex = 0;

  const setActiveGallerySlide = (nextIndex) => {
    aboutGallerySlides[activeGalleryIndex].classList.remove("is-active");
    aboutGalleryDots[activeGalleryIndex].classList.remove("is-active");

    activeGalleryIndex = nextIndex;

    aboutGallerySlides[activeGalleryIndex].classList.add("is-active");
    aboutGalleryDots[activeGalleryIndex].classList.add("is-active");
  };

  const startGalleryAutoplay = () => {
    _galleryAutoplayId = window.setInterval(() => {
      const nextIndex = (activeGalleryIndex + 1) % aboutGallerySlides.length;
      setActiveGallerySlide(nextIndex);
    }, 4600);
  };

  const resetGalleryAutoplay = () => {
    window.clearInterval(_galleryAutoplayId);
    startGalleryAutoplay();
  };

  aboutGalleryDots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      setActiveGallerySlide(index);
      resetGalleryAutoplay();
    });
  });

  startGalleryAutoplay();
}

bindPageTransitions();
renderSearchPage();
renderCatalogPage();
renderBouquetsPage();
renderToysPage();
renderBalloonsPage();
renderSalePage();
renderProductPage();

window.addEventListener("pagehide", () => {
  window.clearInterval(_heroAutoplayId);
  window.clearInterval(_galleryAutoplayId);
});

// Add to cart — global handler
document.addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-add-to-cart]");
  if (!addBtn || addBtn.disabled) return;
  e.preventDefault();

  const product = {
    id: addBtn.dataset.productId,
    name: addBtn.dataset.productName,
    image: addBtn.dataset.productImage || "",
    price: Number(addBtn.dataset.productPrice) || 0,
    telegramText: addBtn.dataset.telegramText || "",
  };

  window.CART.add(product);

  addBtn.classList.add("is-added");
  setTimeout(() => addBtn.classList.remove("is-added"), 1200);

  window.showToast(`«${product.name}» додано до кошика`, {
    actionHref: `${assetPrefix}pages/cart.html`,
    actionLabel: "Кошик →",
    duration: 3000,
  });
});

(function () {
  const s = document.createElement("script");
  s.src = `${assetPrefix}firebase.js`;
  document.body.appendChild(s);
})();
