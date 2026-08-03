/* ==========================================================================
   Colour Picker — script.js
   Vanilla JS only. No dependencies.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- Colour math ---------------- */

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function hexToRgb(hex) {
    hex = hex.replace("#", "").trim();
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    if (d !== 0) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
  }

  function rgbToCmyk(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    const c = (1 - r - k) / (1 - k);
    const m = (1 - g - k) / (1 - k);
    const y = (1 - b - k) / (1 - k);
    return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
  }

  function relativeLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function contrastRatio(rgb1, rgb2) {
    const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b) + 0.05;
    const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b) + 0.05;
    return l1 > l2 ? l1 / l2 : l2 / l1;
  }

  /* ---------------- State ---------------- */

  const state = { r: 91, g: 79, b: 232, a: 1 };
  const DEFAULT_STATE = { r: 91, g: 79, b: 232, a: 1 };
  const HISTORY_KEY = "colourpicker_history";
  const FAV_KEY = "colourpicker_favorites";

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  /* ---------------- Toast ---------------- */

  let toastTimer;
  function showToast(msg) {
    const toast = $("#toast");
    if (!toast) return;
    toast.querySelector(".toast-msg").textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function copyText(text, label) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast(label + " copied"))
        .catch(() => fallbackCopy(text, label));
    } else {
      fallbackCopy(text, label);
    }
  }

  function fallbackCopy(text, label) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); showToast(label + " copied"); }
    catch (e) { showToast("Copy failed"); }
    document.body.removeChild(ta);
  }

  /* ---------------- Core render ---------------- */

  function currentRgbaString() {
    return `rgba(${state.r}, ${state.g}, ${state.b}, ${state.a})`;
  }
  function currentRgbString() {
    return `rgb(${state.r}, ${state.g}, ${state.b})`;
  }

  function setState(newState, opts) {
    opts = opts || {};
    Object.assign(state, newState);
    state.r = clamp(Math.round(state.r), 0, 255);
    state.g = clamp(Math.round(state.g), 0, 255);
    state.b = clamp(Math.round(state.b), 0, 255);
    state.a = clamp(state.a, 0, 1);
    render();
    if (!opts.skipHistory) addToHistory();
  }

  function render() {
    const hex = rgbToHex(state.r, state.g, state.b);
    const hsl = rgbToHsl(state.r, state.g, state.b);
    const hsv = rgbToHsv(state.r, state.g, state.b);
    const cmyk = rgbToCmyk(state.r, state.g, state.b);

    // native color input + preview
    const nativeInput = $("#native-color");
    if (nativeInput) nativeInput.value = hex;

    const previewFill = $("#preview-fill");
    if (previewFill) previewFill.style.background = currentRgbaString();

    const hexField = $("#hex-input");
    if (hexField && document.activeElement !== hexField) hexField.value = hex.replace("#", "");

    ["r", "g", "b"].forEach(ch => {
      const numInput = $("#rgb-" + ch);
      if (numInput && document.activeElement !== numInput) numInput.value = state[ch];
      const slider = $("#slider-" + ch);
      if (slider && document.activeElement !== slider) slider.value = state[ch];
      const sliderVal = $("#slider-" + ch + "-val");
      if (sliderVal) sliderVal.textContent = state[ch];
    });

    const aSlider = $("#slider-a");
    if (aSlider && document.activeElement !== aSlider) aSlider.value = Math.round(state.a * 100);
    const aVal = $("#slider-a-val");
    if (aVal) aVal.textContent = Math.round(state.a * 100) + "%";

    setText("#out-hex", hex);
    setText("#out-rgb", currentRgbString());
    setText("#out-rgba", currentRgbaString());
    setText("#out-hsl", `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`);
    setText("#out-hsv", `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`);
    setText("#out-cmyk", `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`);

    // contrast
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    const ratioWhite = contrastRatio(state, white);
    const ratioBlack = contrastRatio(state, black);
    const bestText = ratioWhite >= ratioBlack ? "White" : "Black";
    const bestRatio = Math.max(ratioWhite, ratioBlack);
    const contrastOut = $("#contrast-ratio");
    if (contrastOut) contrastOut.textContent = bestRatio.toFixed(2) + " : 1";
    const contrastText = $("#contrast-text");
    if (contrastText) contrastText.textContent = bestText;
    const contrastBadge = $("#contrast-badge");
    if (contrastBadge) {
      contrastBadge.textContent = bestRatio >= 4.5 ? "AA Pass" : (bestRatio >= 3 ? "AA Large only" : "Fails AA");
    }

    renderShadesTintsTones();
    renderGradientPreview();
    updateHeroChip(hex);
  }

  function setText(sel, val) {
    const el = $(sel);
    if (el) el.textContent = val;
  }

  /* ---------------- Copy buttons ---------------- */

  $$("[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-copy");
      const el = $(target);
      if (el) copyText(el.textContent, btn.getAttribute("data-label") || "Value");
    });
  });

  /* ---------------- Native color input ---------------- */

  const nativeColor = $("#native-color");
  if (nativeColor) {
    nativeColor.addEventListener("input", e => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) setState(rgb);
    });
  }

  /* ---------------- HEX field ---------------- */

  const hexInput = $("#hex-input");
  if (hexInput) {
    hexInput.addEventListener("input", e => {
      const rgb = hexToRgb(e.target.value);
      if (rgb) setState(rgb, { skipHistory: true });
    });
    hexInput.addEventListener("change", () => addToHistory());
  }

  /* ---------------- RGB number fields ---------------- */

  ["r", "g", "b"].forEach(ch => {
    const el = $("#rgb-" + ch);
    if (el) {
      el.addEventListener("input", e => {
        const v = clamp(parseInt(e.target.value || "0", 10), 0, 255);
        setState({ [ch]: v }, { skipHistory: true });
      });
      el.addEventListener("change", () => addToHistory());
    }
  });

  /* ---------------- Sliders ---------------- */

  ["r", "g", "b"].forEach(ch => {
    const el = $("#slider-" + ch);
    if (el) {
      el.addEventListener("input", e => setState({ [ch]: parseInt(e.target.value, 10) }, { skipHistory: true }));
      el.addEventListener("change", () => addToHistory());
    }
  });
  const aSlider = $("#slider-a");
  if (aSlider) {
    aSlider.addEventListener("input", e => setState({ a: parseInt(e.target.value, 10) / 100 }, { skipHistory: true }));
    aSlider.addEventListener("change", () => addToHistory());
  }

  /* ---------------- Random ---------------- */

  const randomBtn = $("#random-btn");
  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      setState({
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256),
        a: 1
      });
      showToast("Random colour generated");
    });
  }

  /* ---------------- Reset ---------------- */

  const resetBtn = $("#reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      setState(Object.assign({}, DEFAULT_STATE));
      showToast("Colour reset");
    });
  }

  /* ---------------- History ---------------- */

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
  }
  function addToHistory() {
    const hex = rgbToHex(state.r, state.g, state.b);
    let list = getHistory().filter(h => h !== hex);
    list.unshift(hex);
    if (list.length > 20) list = list.slice(0, 20);
    saveHistory(list);
    renderHistory();
  }
  function renderHistory() {
    const wrap = $("#history-grid");
    if (!wrap) return;
    const list = getHistory();
    if (!list.length) { wrap.innerHTML = '<span class="swatch-empty">Your recent colours will appear here.</span>'; return; }
    wrap.innerHTML = list.map(hex =>
      `<button class="swatch" style="background:${hex}" title="${hex}" aria-label="Use colour ${hex}" data-hex="${hex}"></button>`
    ).join("");
    wrap.querySelectorAll("[data-hex]").forEach(sw => {
      sw.addEventListener("click", () => {
        const rgb = hexToRgb(sw.getAttribute("data-hex"));
        if (rgb) setState(rgb, { skipHistory: true });
      });
    });
  }

  /* ---------------- Favorites ---------------- */

  function getFavorites() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveFavorites(list) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
  }
  function renderFavorites() {
    const wrap = $("#favorites-grid");
    if (!wrap) return;
    const list = getFavorites();
    if (!list.length) { wrap.innerHTML = '<span class="swatch-empty">No favourite colours saved yet.</span>'; return; }
    wrap.innerHTML = list.map(hex =>
      `<button class="swatch" style="background:${hex}" title="Remove ${hex}" aria-label="Remove favourite ${hex}" data-hex="${hex}"></button>`
    ).join("");
    wrap.querySelectorAll("[data-hex]").forEach(sw => {
      sw.addEventListener("click", () => {
        const hex = sw.getAttribute("data-hex");
        const rgb = hexToRgb(hex);
        if (rgb) setState(rgb, { skipHistory: true });
      });
      sw.addEventListener("dblclick", e => {
        e.stopPropagation();
        const hex = sw.getAttribute("data-hex");
        saveFavorites(getFavorites().filter(h => h !== hex));
        renderFavorites();
        showToast("Favourite removed");
      });
    });
  }
  const addFavBtn = $("#add-favorite-btn");
  if (addFavBtn) {
    addFavBtn.addEventListener("click", () => {
      const hex = rgbToHex(state.r, state.g, state.b);
      const list = getFavorites();
      if (list.includes(hex)) { showToast("Already in favourites"); return; }
      list.unshift(hex);
      saveFavorites(list.slice(0, 40));
      renderFavorites();
      showToast("Added to favourites");
    });
  }

  /* ---------------- Shades / tints / tones ---------------- */

  function renderShadesTintsTones() {
    const hsl = rgbToHsl(state.r, state.g, state.b);
    fillScale("#shades-strip", i => {
      const l = clamp(hsl.l - i * 9, 4, 96);
      return hslToRgb(hsl.h, hsl.s, l);
    });
    fillScale("#tints-strip", i => {
      const l = clamp(hsl.l + i * 8, 4, 97);
      return hslToRgb(hsl.h, clamp(hsl.s - i * 2, 0, 100), l);
    });
    fillScale("#tones-strip", i => {
      const s = clamp(hsl.s - i * 10, 0, 100);
      return hslToRgb(hsl.h, s, hsl.l);
    });
  }

  function fillScale(sel, fn) {
    const wrap = $(sel);
    if (!wrap) return;
    let html = "";
    for (let i = 0; i < 9; i++) {
      const rgb = fn(i);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      html += `<div class="scale-swatch" style="background:${hex}" data-hex="${hex}" role="button" tabindex="0" aria-label="Use colour ${hex}"><small>${hex}</small></div>`;
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll("[data-hex]").forEach(sw => {
      const activate = () => {
        const rgb = hexToRgb(sw.getAttribute("data-hex"));
        if (rgb) setState(rgb);
      };
      sw.addEventListener("click", activate);
      sw.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
    });
  }

  /* ---------------- Gradient generator ---------------- */

  let gradientSecond = "#FF5C7A";
  let gradientType = "linear";
  let gradientAngle = 120;

  function renderGradientPreview() {
    const hex1 = rgbToHex(state.r, state.g, state.b);
    const el = $("#gradient-preview");
    const codeEl = $("#gradient-code");
    if (!el) return;
    let css;
    if (gradientType === "linear") {
      css = `linear-gradient(${gradientAngle}deg, ${hex1}, ${gradientSecond})`;
    } else {
      css = `radial-gradient(circle, ${hex1}, ${gradientSecond})`;
    }
    el.style.background = css;
    if (codeEl) codeEl.textContent = `background: ${css};`;
  }

  const gradSecondInput = $("#gradient-second");
  if (gradSecondInput) {
    gradSecondInput.addEventListener("input", e => { gradientSecond = e.target.value; renderGradientPreview(); });
  }
  const gradAngleInput = $("#gradient-angle");
  if (gradAngleInput) {
    gradAngleInput.addEventListener("input", e => { gradientAngle = e.target.value; renderGradientPreview(); });
  }
  $$("[data-gradient-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      gradientType = btn.getAttribute("data-gradient-type");
      $$("[data-gradient-type]").forEach(b => b.classList.remove("btn-primary"));
      $$("[data-gradient-type]").forEach(b => b.classList.add("btn-ghost"));
      btn.classList.remove("btn-ghost");
      btn.classList.add("btn-primary");
      renderGradientPreview();
    });
  });

  /* ---------------- Popular colours ---------------- */

  $$("[data-popular-hex]").forEach(card => {
    card.addEventListener("click", () => {
      const rgb = hexToRgb(card.getAttribute("data-popular-hex"));
      if (rgb) { setState(rgb); window.scrollTo({ top: $("#tool").offsetTop - 90, behavior: "smooth" }); }
    });
  });

  /* ---------------- Download PNG ---------------- */

  const downloadBtn = $("#download-btn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 800; canvas.height = 800;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = currentRgbaString();
      ctx.fillRect(0, 0, 800, 800);
      const hex = rgbToHex(state.r, state.g, state.b);
      const link = document.createElement("a");
      link.download = `colour-picker-${hex.replace("#", "")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("PNG downloaded");
    });
  }

  /* ---------------- Fullscreen preview ---------------- */

  const fullscreenBtn = $("#fullscreen-btn");
  const fullscreenOverlay = $("#fullscreen-preview");
  if (fullscreenBtn && fullscreenOverlay) {
    fullscreenBtn.addEventListener("click", () => {
      fullscreenOverlay.style.background = currentRgbaString();
      $("#fp-code").textContent = rgbToHex(state.r, state.g, state.b);
      fullscreenOverlay.classList.add("show");
    });
    $("#fp-close").addEventListener("click", () => fullscreenOverlay.classList.remove("show"));
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") fullscreenOverlay.classList.remove("show");
    });
  }

  /* ---------------- Eyedropper ---------------- */

  const eyedropperBtn = $("#eyedropper-btn");
  if (eyedropperBtn) {
    if (!("EyeDropper" in window)) {
      eyedropperBtn.disabled = true;
      eyedropperBtn.title = "Eyedropper isn't supported in this browser";
    }
    eyedropperBtn.addEventListener("click", async () => {
      if (!("EyeDropper" in window)) {
        showToast("Eyedropper not supported in this browser");
        return;
      }
      try {
        const dropper = new window.EyeDropper();
        const result = await dropper.open();
        const rgb = hexToRgb(result.sRGBHex);
        if (rgb) setState(rgb);
      } catch (e) { /* user cancelled */ }
    });
  }

  /* ---------------- Hero chip demo cycle ---------------- */

  function updateHeroChip(hex) {
    const chip = $("#hero-chip-code");
    const swatch = $("#hero-chip-swatch");
    if (chip) chip.textContent = hex;
    if (swatch) swatch.style.background = hex;
  }

  /* ---------------- Init tool ---------------- */

  render();
  renderHistory();
  renderFavorites();

  /* ---------------- FAQ accordion ---------------- */

  $$(".faq-item").forEach(item => {
    const q = item.querySelector(".faq-q");
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      $$(".faq-item.open").forEach(o => { o.classList.remove("open"); o.querySelector(".faq-q").setAttribute("aria-expanded", "false"); });
      if (!isOpen) { item.classList.add("open"); q.setAttribute("aria-expanded", "true"); }
    });
  });

  /* ---------------- Mobile nav ---------------- */

  const navToggle = $("#nav-toggle");
  const mainNav = $("#main-nav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");
      navToggle.classList.toggle("open", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
    mainNav.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => {
        mainNav.classList.remove("open");
        navToggle.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------------- Scroll progress + back to top ---------------- */

  const progressBar = $("#scroll-progress");
  const backToTop = $("#back-to-top");
  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const pct = height > 0 ? (scrollTop / height) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + "%";
    if (backToTop) backToTop.classList.toggle("show", scrollTop > 480);
  }, { passive: true });

  if (backToTop) {
    backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ---------------- Reveal on scroll ---------------- */

  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("in"));
  }

  /* ---------------- Stat counters ---------------- */

  const statEls = $$("[data-count-to]");
  if (statEls.length) {
    const io2 = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.getAttribute("data-count-to"), 10);
        const suffix = el.getAttribute("data-suffix") || "";
        const duration = 1400;
        const start = performance.now();
        function tick(now) {
          const p = clamp((now - start) / duration, 0, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(eased * target).toLocaleString() + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        io2.unobserve(el);
      });
    }, { threshold: 0.4 });
    statEls.forEach(el => io2.observe(el));
  }

  /* ---------------- Contact form ---------------- */

  const contactForm = $("#contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", e => {
      e.preventDefault();
      let valid = true;
      const name = $("#field-name");
      const email = $("#field-email");
      const message = $("#field-message");

      const nameErr = $("#error-name");
      const emailErr = $("#error-email");
      const messageErr = $("#error-message");

      if (!name.value.trim()) { nameErr.textContent = "Please enter your name."; valid = false; }
      else nameErr.textContent = "";

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email.value.trim())) { emailErr.textContent = "Please enter a valid email address."; valid = false; }
      else emailErr.textContent = "";

      if (message.value.trim().length < 10) { messageErr.textContent = "Message should be at least 10 characters."; valid = false; }
      else messageErr.textContent = "";

      const successBox = $("#form-success");
      if (valid) {
        successBox.classList.add("show");
        successBox.textContent = "Thanks! Your message has been noted. This form does not send data anywhere (no backend).";
        contactForm.reset();
      } else {
        successBox.classList.remove("show");
      }
    });
  }

})();
