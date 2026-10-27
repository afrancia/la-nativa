/* ==========================================================
   La Nativa — Carta digital
   Vanilla JS modular: datos → render → filtros → animación
   ========================================================== */

(() => {
  "use strict";

  /* ---------- Configuración ---------- */
  const CONFIG = {
    dataUrl: "menu.json",
    defaultCategory: "Pedidas",
    staggerMs: 70,
    maxStaggerMs: 420,
    currency: "S/",
    fallbackImage: "assets/icono.svg",
  };

  /* ---------- Referencias al DOM ---------- */
  const dom = {
    container: document.getElementById("menu-container"),
    filters: document.getElementById("filters"),
    status: document.getElementById("status"),
    tagline: document.getElementById("tagline"),
    ubicacion: document.getElementById("ubicacion"),
    horario: document.getElementById("horario"),
    year: document.getElementById("year"),
    pagos: document.getElementById("pagos"),
    pagosTitulo: document.getElementById("pagos-titulo"),
    pagosTexto: document.getElementById("pagos-texto"),
    pagosGrid: document.getElementById("pagos-grid"),
  };

  /* ---------- Estado ---------- */
  const state = {
    platos: [],
    category: CONFIG.defaultCategory,
    observer: null,
  };

  /* ---------- Utilidades ---------- */
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const slugify = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const formatPrice = (value) => {
    const n = Number(value);
    const hasDecimals = !Number.isInteger(n);
    return `${CONFIG.currency} ${hasDecimals ? n.toFixed(2) : n}`;
  };

  /* ---------- Datos ---------- */
  async function loadData() {
    const response = await fetch(CONFIG.dataUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  /* ---------- Render: tarjetas ---------- */
  function createCard(plato) {
    const card = el("article", "card");
    card.dataset.categoria = plato.categoria;

    card.append(createMedia(plato));

    const body = el("div", "card__body");

    const top = el("div", "card__top");
    top.append(
      el("h2", "card__name", plato.nombre),
      el("span", "card__price", formatPrice(plato.precio))
    );

    const desc = el("p", "card__desc", plato.descripcion);

    const foot = el("div", "card__foot");
    if (plato.etiqueta_ux) {
      foot.append(el("span", `tag tag--${slugify(plato.etiqueta_ux)}`, plato.etiqueta_ux));
    }
    foot.append(el("span", "card__cat", plato.categoria));

    body.append(top, desc, foot);
    card.append(body);
    return card;
  }

  /* Imagen del plato. Si el archivo no existe, se muestra el isotipo de la marca. */
  function createMedia(plato) {
    const figure = el("figure", "card__media");
    const img = el("img", "card__img");
    img.src = plato.imagen || CONFIG.fallbackImage;
    img.alt = `${plato.nombre}`;
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 400;
    img.height = 300;

    img.addEventListener("error", () => {
      img.src = CONFIG.fallbackImage;
      figure.classList.add("card__media--fallback");
    }, { once: true });

    figure.append(img);
    return figure;
  }

  function renderMenu(platos) {
    dom.container.replaceChildren();

    if (!platos.length) {
      dom.container.append(el("p", "menu__msg", "No hay platos en esta categoría por ahora."));
      return;
    }

    const fragment = document.createDocumentFragment();
    platos.forEach((plato, index) => {
      const card = createCard(plato);
      const delay = Math.min(index * CONFIG.staggerMs, CONFIG.maxStaggerMs);
      card.style.setProperty("--delay", `${delay}ms`);
      fragment.append(card);
    });
    dom.container.append(fragment);

    observeCards();
  }

  /* ---------- Animación al hacer scroll ---------- */
  function setupObserver() {
    if (!("IntersectionObserver" in window)) return null;

    return new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
  }

  function observeCards() {
    const cards = dom.container.querySelectorAll(".card");
    if (!state.observer) {
      // Sin soporte: mostrar todo de inmediato
      cards.forEach((card) => card.classList.add("is-visible"));
      return;
    }
    cards.forEach((card) => state.observer.observe(card));
  }

  /* ---------- Filtros ---------- */
  function getVisiblePlatos() {
    if (state.category === "Pedidas"){
        return state.platos.filter((p) => p.destacado);
    }
    return state.platos.filter((p) => p.categoria === state.category)
  }

  function updateFilterButtons() {
    dom.filters.querySelectorAll(".filter-btn").forEach((btn) => {
      const active = btn.dataset.categoria === state.category;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function setCategory(category) {
    if (category === state.category) return;
    state.category = category;
    updateFilterButtons();

    const platos = getVisiblePlatos();
    renderMenu(platos);
    dom.status.textContent = `${platos.length} ${platos.length === 1 ? "plato" : "platos"} en ${category}`;
  }

  function bindFilters() {
    dom.filters.addEventListener("click", (event) => {
      const btn = event.target.closest(".filter-btn");
      if (!btn) return;
      setCategory(btn.dataset.categoria);
    });
  }

  /* ---------- Render: negocio y pagos ---------- */
  function renderNegocio(negocio = {}) {
    if (negocio.eslogan) dom.tagline.textContent = negocio.eslogan;
    if (negocio.ubicacion) dom.ubicacion.textContent = negocio.ubicacion;
    if (negocio.horario) {
      dom.horario.textContent = `Horario: ${negocio.horario}`;
      dom.horario.hidden = false;
    }
  }

  function createQr(metodo) {
    const img = el("img", "pago__qr");
    img.src = metodo.qr;
    img.alt = `Código QR para pagar con ${metodo.nombre}`;
    img.loading = "lazy";
    img.width = 220;
    img.height = 220;

    // Si aún no subiste el QR, se muestra un recuadro indicativo
    img.addEventListener("error", () => {
      const placeholder = el("div", "pago__qr pago__qr--placeholder", `Coloca aquí tu QR de ${metodo.nombre}`);
      placeholder.setAttribute("role", "img");
      placeholder.setAttribute("aria-label", `Espacio para el QR de ${metodo.nombre}`);
      img.replaceWith(placeholder);
    }, { once: true });

    return img;
  }

  function renderPagos(pagos) {
    if (!pagos || !Array.isArray(pagos.metodos) || !pagos.metodos.length) return;

    if (pagos.titulo) dom.pagosTitulo.textContent = pagos.titulo;
    dom.pagosTexto.textContent = pagos.texto || "";

    const fragment = document.createDocumentFragment();
    pagos.metodos.forEach((metodo) => {
      const box = el("article", "pago");
      box.append(el("h3", "pago__name", metodo.nombre), createQr(metodo));

      const meta = el("p", "pago__meta");
      const titular = el("strong", null, metodo.titular || "");
      meta.append(titular);
      if (metodo.numero) meta.append(document.createElement("br"), document.createTextNode(metodo.numero));
      box.append(meta);

      fragment.append(box);
    });

    dom.pagosGrid.replaceChildren(fragment);
    dom.pagos.hidden = false;
  }

  /* ---------- Errores ---------- */
  function showError(error) {
    console.error("[La Nativa] No se pudo cargar la carta:", error);
    dom.container.replaceChildren();

    const msg = el("p", "menu__msg");
    msg.append(
      el("strong", null, "No pudimos cargar la carta."),
      document.createElement("br"),
      document.createTextNode(
        window.location.protocol === "file:"
          ? "Abre el sitio desde un servidor local (por ejemplo, la extensión Live Server de VS Code) o súbelo a un hosting."
          : "Revisa tu conexión e intenta nuevamente."
      )
    );
    dom.container.append(msg);
  }

  /* ---------- Inicio ---------- */
  async function init() {
    dom.year.textContent = new Date().getFullYear();
    state.observer = setupObserver();
    bindFilters();

    try {
      const data = await loadData();
      state.platos = Array.isArray(data.platos) ? data.platos : [];
      renderNegocio(data.negocio);
      renderMenu(getVisiblePlatos());
      renderPagos(data.pagos);
    } catch (error) {
      showError(error);
    }
  }

  init();
})();
