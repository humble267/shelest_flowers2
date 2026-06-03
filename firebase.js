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
          if (window.CART) window.CART.clear();
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

        saveCart: async (uid, items) => {
          await db.collection("users").doc(uid).collection("cart").doc("items")
            .set({ items, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        },

        loadCart: async (uid) => {
          const doc = await db.collection("users").doc(uid).collection("cart").doc("items").get();
          return doc.exists ? (doc.data().items || []) : [];
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
          // Favorites
          try {
            const favs = await window.FB.getFavorites(user.uid);
            window.FB.favorites = new Set(favs.map((f) => f.productId));
            _updateFavBtns();
          } catch {}

          // Cart: merge localStorage + Firestore, save merged back
          if (window.CART) {
            try {
              const localItems = window.CART.getItems();
              const savedItems = await window.FB.loadCart(user.uid);
              const merged = new Map();
              savedItems.forEach((item) => { if (item.id) merged.set(item.id, item); });
              localItems.forEach((item) => {
                if (!item.id) return;
                if (merged.has(item.id)) {
                  merged.get(item.id).qty = Math.max(merged.get(item.id).qty || 1, item.qty || 1);
                } else {
                  merged.set(item.id, item);
                }
              });
              window.CART.load(Array.from(merged.values()));
              await window.FB.saveCart(user.uid, window.CART.getItems());
              try { localStorage.removeItem("shelyst_cart_v1"); } catch {}
            } catch (err) {
              console.error("[FB] cart sync failed:", err);
            }
          }

          // Header user info
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
          if (window.CART) window.CART.loadFromStorage();
        }
      });

      // Favorites toggle on product cards
      document.addEventListener("click", async (e) => {
        const favBtn = e.target.closest(".catalog-product__fav");
        if (!favBtn) return;
        e.preventDefault();
        e.stopPropagation();

        if (!window.FB.currentUser) {
          window.showToast("Увійдіть, щоб зберігати товари в обране", {
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
          window.showToast("Не вдалося оновити обране. Спробуйте ще раз.", { variant: "error" });
        } finally {
          favBtn.disabled = false;
        }
      });

      window.dispatchEvent(new CustomEvent("fb:ready"));
    })
    .catch((err) => console.error("[FB] SDK load failed:", err));
})();
