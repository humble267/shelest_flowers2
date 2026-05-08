const isInnerPage = window.location.pathname.includes("/pages/");
const assetPrefix = isInnerPage ? "../" : "";

const TELEGRAM_USERNAME = "shelyst_flowers";
const CONTACT_PHONE_DISPLAY = "097 00 000...";
const CONTACT_PHONE_HREF = "tel:09700000";
const CONTACT_TELEGRAM_URL = `https://t.me/${TELEGRAM_USERNAME}`;
const CATALOG_CSV_URLS = {
  categories:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTU78b1Jh7CCVUnmeYlZBcDtIk2hLeUWTXZDM2J_28Vm--KZIk2_jf9ocbPYkgedsleK2C7lZGCS0LY/pub?gid=0&single=true&output=csv",
  products:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTU78b1Jh7CCVUnmeYlZBcDtIk2hLeUWTXZDM2J_28Vm--KZIk2_jf9ocbPYkgedsleK2C7lZGCS0LY/pub?gid=333893780&single=true&output=csv",
};

const categoryPageRoutes = {
  ready: `${assetPrefix}pages/bukety.html`,
  "all-flowers": `${assetPrefix}pages/troyandy.html`,
  classic: `${assetPrefix}pages/kvity.html`,
  popular: `${assetPrefix}pages/kvity-v-korobtsi.html`,
  sale: `${assetPrefix}pages/aktsiyni.html`,
};

const categoryImageMap = {
  ready: `${assetPrefix}images/cat-letters.jpg`,
  "all-flowers": `${assetPrefix}images/cat-mixed.jpg`,
  classic: `${assetPrefix}images/cat-exclusive.jpg`,
  popular: `${assetPrefix}images/cat-basket.jpg`,
  sale: `${assetPrefix}images/cat-box.jpg`,
};

const categoryTitleOverrides = {
  popular: "Усі букети",
};

let catalogDataPromise = null;
let _heroAutoplayId = null;
let _galleryAutoplayId = null;

const CSV_CACHE_KEY = "shelyst_catalog_v1";
const CSV_CACHE_TTL = 30 * 60 * 1000;

const loadCachedCatalog = () => {
  try {
    const raw = localStorage.getItem(CSV_CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CSV_CACHE_TTL) {
      localStorage.removeItem(CSV_CACHE_KEY);
      return null;
    }
    return data;
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
          <a href="${prefix}pages/pro-nas.html">Про нас</a>
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
              <a href="${prefix}pages/kvity.html">Класичні композиції</a>
              <a href="${prefix}pages/kvity-v-korobtsi.html">Усі букети</a>
              <a class="catalog-nav__sale" href="${prefix}pages/aktsiyni.html">Акційні</a>
            </nav>

            <div class="mobile-links" aria-label="Службові посилання">
              <a href="${prefix}pages/kyiv.html">Петропавлівська Борщагівка</a>
              <a href="${prefix}pages/pro-nas.html">Про нас</a>
              <a href="${prefix}pages/oplata.html">Оплата</a>
              <a href="${prefix}pages/kontakty.html">Контакти</a>
              <a href="${prefix}pages/kontakty.html">${CONTACT_PHONE_DISPLAY}</a>
              <a href="${prefix}pages/kontakty.html">Графік: щодня 09:00 - 21:00</a>
            </div>
          </div>

          <a class="search-link" href="${prefix}pages/poshuk.html" aria-label="Пошук">
            <span class="search-link__icon" aria-hidden="true"></span>
            <span>Пошук</span>
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
        <a href="${prefix}pages/bukety.html">Готові композиції</a>
        <a href="${prefix}pages/troyandy.html">Усі квіти</a>
        <a href="${prefix}pages/kvity.html">Класичні композиції</a>
        <a href="${prefix}pages/kvity-v-korobtsi.html">Усі букети</a>
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

  if (product.isPopular) {
    categoryIds.add("popular");
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

const loadCatalogData = async () => {
  if (!catalogDataPromise) {
    const cached = loadCachedCatalog();

    if (cached) {
      catalogDataPromise = Promise.resolve(cached);
    } else {
      catalogDataPromise = Promise.all([
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
              telegramText: cleanValue(row.telegramText),
              visible: cleanValue(row.visible),
              description: cleanValue(row.description),
            }))
            .filter((product) => product.id && product.name),
        };
        saveCatalogToCache(result);
        return result;
      });
    }
  }

  try {
    return await catalogDataPromise;
  } catch (error) {
    catalogDataPromise = null;
    throw error;
  }
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
    ? `<a class="catalog-product__button" href="${escapeHtml(getTelegramUrl(product))}" target="_blank" rel="noreferrer">Купити</a>`
    : `<span class="catalog-product__button is-disabled" aria-disabled="true">Купити</span>`;

  return `
    <article class="catalog-product${isAvailable ? "" : " is-unavailable"}">
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
    ? `<a class="product-detail__button" href="${escapeHtml(getTelegramUrl(product))}" target="_blank" rel="noreferrer">Купити</a>`
    : `<span class="product-detail__button is-disabled" aria-disabled="true">Купити</span>`;
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
          <span>Оформлення замовлення відбувається через Telegram-чат магазину.</span>
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

  if (!catalogPage) {
    return;
  }

  const eyebrow = catalogPage.querySelector("[data-catalog-eyebrow]");
  const title = catalogPage.querySelector("[data-catalog-title]");
  const lead = catalogPage.querySelector("[data-catalog-lead]");
  const content = catalogPage.querySelector("[data-catalog-content]");
  const queryCategoryId = new URLSearchParams(window.location.search).get(
    "category",
  );
  const fallbackCategoryId = cleanValue(catalogPage.dataset.categoryId);
  const activeCategoryId = cleanValue(queryCategoryId) || fallbackCategoryId;

  if (!content || !activeCategoryId) {
    return;
  }

  content.innerHTML = buildCatalogState("Завантажуємо каталог...");

  try {
    const { categories, products } = await loadCatalogData();
    const visibleCategories = categories.filter((category) =>
      isVisibleEntity(category.visible),
    );
    const visibleProducts = products.filter((product) =>
      isVisibleEntity(product.visible),
    );

    const activeCategory = visibleCategories.find(
      (category) => category.id === activeCategoryId,
    );

    if (!activeCategory) {
      content.innerHTML = buildCatalogState(
        "Цей розділ тимчасово недоступний.",
      );
      return;
    }

    const parentCategory = activeCategory.parent
      ? visibleCategories.find((category) => category.id === activeCategory.parent)
      : null;

    if (eyebrow) {
      eyebrow.textContent = parentCategory
        ? getCategoryDisplayTitle(parentCategory)
        : "Каталог";
    }

    if (title) {
      title.textContent = getCategoryDisplayTitle(activeCategory);
    }

    if (lead) {
      lead.textContent = getCatalogLead(activeCategory, parentCategory);
    }

    document.title = `${getCategoryDisplayTitle(activeCategory)} | SHELYST FLOWERS`;

    if (activeCategory.type === "subcategories") {
      const childCategories = sortByOrder(
        visibleCategories.filter(
          (category) => category.parent === activeCategory.id,
        ),
      );

      content.innerHTML = childCategories.length
        ? `
            <div class="catalog-groups__grid">
              ${childCategories.map((category) => buildSubcategoryCard(category)).join("")}
            </div>
          `
        : buildCatalogState("У цій категорії ще немає підкатегорій.");

      bindPageTransitions(content);
      return;
    }

    const categoryProducts = visibleProducts.filter((product) =>
      productHasCategory(product, activeCategory.id),
    );

    content.innerHTML = categoryProducts.length
      ? `
          <div class="catalog-products__grid">
            ${categoryProducts.map((product) => buildProductCard(product)).join("")}
          </div>
        `
      : buildCatalogState("У цій категорії поки що немає товарів.");

    bindPageTransitions(content);
    applyImageFallbacks(content);
  } catch (error) {
    logCatalogError("catalog-page", error);
    content.innerHTML = buildCatalogState(getCatalogErrorText(error));
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
    const { categories, products } = await loadCatalogData();
    const visibleCategories = categories.filter((category) =>
      isVisibleEntity(category.visible),
    );
    const visibleProducts = products.filter((product) =>
      isVisibleEntity(product.visible),
    );
    const product = visibleProducts.find((item) => item.id === productId);

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
    url: `${assetPrefix}pages/kvity.html`,
    keywords: "класичні композиції квіти",
  },
  {
    title: "Усі букети",
    description: "Окрема добірка букетів магазину для швидкого перегляду.",
    url: `${assetPrefix}pages/kvity-v-korobtsi.html`,
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
    url: `${assetPrefix}pages/pro-nas.html`,
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
renderHomeCategories();
renderCatalogPage();
renderProductPage();

window.addEventListener("pagehide", () => {
  window.clearInterval(_heroAutoplayId);
  window.clearInterval(_galleryAutoplayId);
});
