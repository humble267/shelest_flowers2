(function () {
  const FB_VERSION = "10.14.1";
  const BASE = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  loadScript(`${BASE}/firebase-app-compat.js`)
    .then(() => Promise.all([
      loadScript(`${BASE}/firebase-auth-compat.js`),
      loadScript(`${BASE}/firebase-firestore-compat.js`),
    ]))
    .then(() => {
      if (!firebase.apps.length) {
        firebase.initializeApp({
          apiKey: "AIzaSyCjjTFB3tFCnYcpPOfVhdEXHyudKl6j1FU",
          authDomain: "flowers-63817.firebaseapp.com",
          projectId: "flowers-63817",
          storageBucket: "flowers-63817.firebasestorage.app",
          messagingSenderId: "598325937086",
          appId: "1:598325937086:web:1fc7ecb877b989c13e6fef",
        });
      }

      const auth = firebase.auth();
      const db = firebase.firestore();
      auth.languageCode = "uk";

      const isInner = window.location.pathname.includes("/pages/");
      const prefix = isInner ? "../" : "";

      window.FB = {
        auth,
        db,
        currentUser: null,
        favorites: new Set(),

        signIn: (email, password) =>
          auth.signInWithEmailAndPassword(email, password),

        signUp: async (email, password, name, phone) => {
          const cred = await auth.createUserWithEmailAndPassword(email, password);
          try {
            sessionStorage.setItem(
              "shelyst_pending_profile",
              JSON.stringify({ uid: cred.user.uid, name, phone: phone || "" }),
            );
          } catch {}
          try {
            await cred.user.updateProfile({ displayName: name });
            await db.collection("users").doc(cred.user.uid).set({
              name,
              phone: phone || "",
              address: "",
              email,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
          } catch (err) {
            console.error("[FB] signUp profile write failed:", err);
            try { await cred.user.delete(); } catch (delErr) {
              console.error("[FB] rollback of Auth user failed:", delErr);
            }
            const wrapped = new Error(err?.message || "Profile write failed");
            wrapped.code = "shelyst/profile-write-failed";
            throw wrapped;
          }
          return cred;
        },

        signOut: async () => {
          try { sessionStorage.removeItem("shelyst_pending_profile"); } catch {}
          window.FB.favorites = new Set();
          await auth.signOut();
        },

        getUserProfile: async (uid) => {
          const doc = await db.collection("users").doc(uid).get();
          return doc.exists ? doc.data() : null;
        },

        updateUserProfile: async (uid, data) => {
          await db.collection("users").doc(uid).set(data, { merge: true });
          if (data.name && auth.currentUser) {
            await auth.currentUser.updateProfile({ displayName: data.name });
          }
          try {
            const profile = await window.FB.getUserProfile(uid);
            _updateHeaderUser(auth.currentUser, profile);
          } catch {}
        },

        addToFavorites: async (uid, product) => {
          await db.collection("users").doc(uid).collection("favorites")
            .doc(product.id).set({
              productId: product.id,
              productName: product.name,
              productImage: product.image || "",
              price: product.price,
              addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
          window.FB.favorites.add(product.id);
          _updateFavBtns();
        },

        removeFromFavorites: async (uid, productId) => {
          await db.collection("users").doc(uid).collection("favorites")
            .doc(productId).delete();
          window.FB.favorites.delete(productId);
          _updateFavBtns();
        },

        getFavorites: async (uid) => {
          const snap = await db.collection("users").doc(uid)
            .collection("favorites").orderBy("addedAt", "desc").get();
          return snap.docs.map((d) => d.data());
        },

        addOrder: async (uid, product) => {
          await db.collection("users").doc(uid).collection("orders").add({
            productId: product.productId,
            productName: product.productName,
            productImage: product.productImage || "",
            price: product.price,
            status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        },

        getOrders: async (uid) => {
          const snap = await db.collection("users").doc(uid)
            .collection("orders").orderBy("createdAt", "desc").get();
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        },
      };

      function _updateFavBtns() {
        document.querySelectorAll(".catalog-product__fav").forEach((btn) => {
          const active = window.FB.favorites.has(btn.dataset.productId);
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-label", active ? "Видалити з обраного" : "Додати до обраного");
        });
      }

      const _favObserver = new MutationObserver((mutations) => {
        const hasNewFavBtn = mutations.some((m) =>
          Array.from(m.addedNodes).some(
            (n) =>
              n.nodeType === 1 &&
              (n.matches?.(".catalog-product__fav") ||
                n.querySelector?.(".catalog-product__fav")),
          ),
        );
        if (hasNewFavBtn) _updateFavBtns();
      });
      _favObserver.observe(document.body, { childList: true, subtree: true });

      let _toastTimer = null;
      function _showToast(message, options = {}) {
        const existing = document.getElementById("shelyst-toast");
        if (existing) existing.remove();
        if (_toastTimer) clearTimeout(_toastTimer);

        const toast = document.createElement("div");
        toast.id = "shelyst-toast";
        toast.className = `shelyst-toast${options.variant === "error" ? " is-error" : ""}`;
        const actionMarkup = options.actionHref
          ? `<a class="shelyst-toast__btn" href="${options.actionHref}">${options.actionLabel || "Увійти"}</a>`
          : "";
        toast.innerHTML = `
          <p class="shelyst-toast__msg">${message}</p>
          <div class="shelyst-toast__actions">
            ${actionMarkup}
            <button type="button" class="shelyst-toast__close" aria-label="Закрити">×</button>
          </div>
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("is-visible"));

        const dismiss = () => {
          toast.classList.remove("is-visible");
          setTimeout(() => toast.remove(), 300);
        };
        toast.querySelector(".shelyst-toast__close").addEventListener("click", dismiss);
        _toastTimer = setTimeout(dismiss, options.duration || 5000);
      }
      window.FB._showToast = _showToast;

      function _updateHeaderUser(user, profile) {
        const btn = document.getElementById("header-user-btn");
        const label = document.getElementById("header-user-label");
        if (!btn || !label) return;
        if (user) {
          const name = profile?.name || user.displayName || "Кабінет";
          label.textContent = name.split(" ")[0];
          btn.href = `${prefix}pages/cabinet.html`;
          btn.classList.add("is-logged");
        } else {
          label.textContent = "Увійти";
          btn.href = `${prefix}pages/login.html`;
          btn.classList.remove("is-logged");
        }
      }

      auth.onAuthStateChanged(async (user) => {
        window.FB.currentUser = user;
        if (user) {
          try {
            const favs = await window.FB.getFavorites(user.uid);
            window.FB.favorites = new Set(favs.map((f) => f.productId));
            _updateFavBtns();
          } catch {}
          try {
            const profile = await window.FB.getUserProfile(user.uid);
            _updateHeaderUser(user, profile);
          } catch {
            _updateHeaderUser(user, null);
          }
        } else {
          window.FB.favorites = new Set();
          _updateFavBtns();
          _updateHeaderUser(null, null);
        }
      });

      // Favorites toggle on product cards
      document.addEventListener("click", async (e) => {
        const favBtn = e.target.closest(".catalog-product__fav");
        if (!favBtn) return;
        e.preventDefault();
        e.stopPropagation();

        if (!window.FB.currentUser) {
          _showToast("Увійдіть, щоб зберігати товари в обране", {
            actionHref: `${prefix}pages/login.html`,
            actionLabel: "Увійти",
          });
          return;
        }

        const productId = favBtn.dataset.productId;
        const isActive = window.FB.favorites.has(productId);
        favBtn.disabled = true;
        try {
          if (isActive) {
            await window.FB.removeFromFavorites(window.FB.currentUser.uid, productId);
          } else {
            await window.FB.addToFavorites(window.FB.currentUser.uid, {
              id: productId,
              name: favBtn.dataset.productName,
              image: favBtn.dataset.productImage,
              price: Number(favBtn.dataset.productPrice),
            });
          }
        } catch (err) {
          console.error("[FB] favorites:", err);
          _showToast("Не вдалося оновити обране. Спробуйте ще раз.", { variant: "error" });
        } finally {
          favBtn.disabled = false;
        }
      });

      // Save order when user clicks "Купити" (Telegram link)
      document.addEventListener("click", (e) => {
        const buyBtn = e.target.closest(".catalog-product__button[data-product-id]");
        if (!buyBtn || !window.FB.currentUser) return;
        window.FB.addOrder(window.FB.currentUser.uid, {
          productId: buyBtn.dataset.productId,
          productName: buyBtn.dataset.productName,
          productImage: buyBtn.dataset.productImage || "",
          price: Number(buyBtn.dataset.productPrice),
        }).catch(() => {});
      });

      window.dispatchEvent(new CustomEvent("fb:ready"));
    })
    .catch((err) => console.error("[FB] SDK load failed:", err));
})();
