/* =========================================================
   Word Count — script.js
   Vanilla JS. 100% client-side. No backend, no tracking.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Mobile Nav ---------- */
  const navToggle = document.getElementById("navToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  if (navToggle && mobileMenu) {
    navToggle.addEventListener("click", () => {
      const isOpen = mobileMenu.classList.toggle("open");
      navToggle.classList.toggle("active", isOpen);
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    mobileMenu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        mobileMenu.classList.remove("open");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in-view"));
  }

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll("[data-counter]");
  if (counters.length && "IntersectionObserver" in window) {
    const counterIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseFloat(el.getAttribute("data-counter"));
          const suffix = el.getAttribute("data-suffix") || "";
          const duration = 1400;
          const start = performance.now();
          function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = Math.round(target * eased);
            el.textContent = value.toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          counterIO.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => counterIO.observe(el));
  }

  /* ---------- FAQ Accordion ---------- */
  document.querySelectorAll(".faq-item").forEach((item) => {
    const question = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");
    question.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((openItem) => {
        if (openItem !== item) {
          openItem.classList.remove("open");
          openItem.querySelector(".faq-answer").style.maxHeight = null;
          openItem.querySelector(".faq-question").setAttribute("aria-expanded", "false");
        }
      });
      item.classList.toggle("open", !isOpen);
      question.setAttribute("aria-expanded", (!isOpen).toString());
      answer.style.maxHeight = !isOpen ? answer.scrollHeight + "px" : null;
    });
  });

  /* =========================================================
     WORD COUNT TOOL
     ========================================================= */
  const textarea = document.getElementById("wordCountTextarea");
  if (!textarea) return; // Not on this page (legal pages etc.)

  const els = {
    wordCount: document.getElementById("wordCount"),
    charWithSpaces: document.getElementById("charWithSpaces"),
    charNoSpaces: document.getElementById("charNoSpaces"),
    sentenceCount: document.getElementById("sentenceCount"),
    paragraphCount: document.getElementById("paragraphCount"),
    lineCount: document.getElementById("lineCount"),
    readingTime: document.getElementById("readingTime"),
    speakingTime: document.getElementById("speakingTime"),
    avgWordLength: document.getElementById("avgWordLength"),
    longestWord: document.getElementById("longestWord"),
    shortestWord: document.getElementById("shortestWord"),
    uniqueWords: document.getElementById("uniqueWords"),
    keywordDensity: document.getElementById("keywordDensity"),
    estimatedPages: document.getElementById("estimatedPages"),
    socialLength: document.getElementById("socialLength"),
    languageGuess: document.getElementById("languageGuess"),
    progressFill: document.getElementById("progressFill"),
    progressLabel: document.getElementById("progressLabel"),
    limitInput: document.getElementById("limitInput"),
    noLimitToggle: document.getElementById("noLimitToggle"),
  };

  const buttons = {
    paste: document.getElementById("btnPaste"),
    clear: document.getElementById("btnClear"),
    copy: document.getElementById("btnCopy"),
    download: document.getElementById("btnDownload"),
    upload: document.getElementById("btnUpload"),
    uploadInput: document.getElementById("uploadInput"),
    trim: document.getElementById("btnTrim"),
    singleSpace: document.getElementById("btnSingleSpace"),
    removeExtraLines: document.getElementById("btnRemoveExtraLines"),
  };

  const COMMON_WORDS = {
    en: ["the", "and", "is", "in", "to", "of", "a", "for", "on", "with"],
    es: ["el", "la", "de", "que", "y", "en", "los", "para", "con", "una"],
    fr: ["le", "la", "de", "et", "les", "des", "en", "un", "une", "pour"],
    ur: ["اور", "کے", "میں", "کی", "کا", "ہے", "کو", "سے", "پر", "یہ"],
  };

  function detectLanguage(text) {
    if (/[\u0600-\u06FF]/.test(text)) return "Urdu / Arabic script";
    const lower = text.toLowerCase();
    let best = { lang: "English", score: 0 };
    const labels = { en: "English", es: "Spanish", fr: "French" };
    Object.keys(COMMON_WORDS).forEach((lang) => {
      if (lang === "ur") return;
      let score = 0;
      COMMON_WORDS[lang].forEach((w) => {
        const matches = lower.match(new RegExp("\\b" + w + "\\b", "g"));
        if (matches) score += matches.length;
      });
      if (score > best.score) best = { lang: labels[lang], score };
    });
    return text.trim() ? best.lang : "—";
  }

  function analyze() {
    const raw = textarea.value;
    const trimmed = raw.trim();

    // Words
    const wordsArr = trimmed.length ? trimmed.split(/\s+/).filter(Boolean) : [];
    const wordCount = wordsArr.length;

    // Characters
    const charWithSpaces = raw.length;
    const charNoSpaces = raw.replace(/\s/g, "").length;

    // Sentences
    const sentenceMatches = trimmed.match(/[^.!?]+[.!?]+|\S+$/g);
    const sentenceCount = trimmed ? (sentenceMatches ? sentenceMatches.length : 1) : 0;

    // Paragraphs
    const paragraphs = raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const paragraphCount = paragraphs.length;

    // Lines
    const lineCount = raw.length ? raw.split(/\n/).length : 0;

    // Reading / speaking time
    const readingMins = wordCount / 225;
    const speakingMins = wordCount / 130;

    // Word length stats
    const cleanWords = wordsArr.map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ""));
    const nonEmptyWords = cleanWords.filter(Boolean);
    const avgWordLength = nonEmptyWords.length
      ? (nonEmptyWords.reduce((sum, w) => sum + w.length, 0) / nonEmptyWords.length).toFixed(1)
      : 0;
    let longest = "", shortest = "";
    nonEmptyWords.forEach((w) => {
      if (w.length > longest.length) longest = w;
      if (!shortest || w.length < shortest.length) shortest = w;
    });

    // Unique words
    const lowerWords = nonEmptyWords.map((w) => w.toLowerCase());
    const uniqueWords = new Set(lowerWords).size;

    // Keyword density for "word count"
    const kwMatches = trimmed.toLowerCase().match(/\bword count\b/g);
    const kwDensity = wordCount ? (((kwMatches ? kwMatches.length : 0) / wordCount) * 100).toFixed(2) : "0.00";

    // Estimated pages (approx 250 words/page) & social length
    const estimatedPages = wordCount ? Math.max(1, Math.ceil(wordCount / 250)) : 0;
    const socialLength = charWithSpaces + " / 280";

    // Language
    const language = detectLanguage(raw);

    // Update DOM
    els.wordCount.textContent = wordCount.toLocaleString();
    els.charWithSpaces.textContent = charWithSpaces.toLocaleString();
    els.charNoSpaces.textContent = charNoSpaces.toLocaleString();
    els.sentenceCount.textContent = sentenceCount.toLocaleString();
    els.paragraphCount.textContent = paragraphCount.toLocaleString();
    els.lineCount.textContent = lineCount.toLocaleString();
    els.readingTime.textContent = readingMins < 1 && wordCount ? "< 1 min" : Math.ceil(readingMins) + " min";
    els.speakingTime.textContent = speakingMins < 1 && wordCount ? "< 1 min" : Math.ceil(speakingMins) + " min";
    els.avgWordLength.textContent = avgWordLength;
    els.longestWord.textContent = longest || "—";
    els.shortestWord.textContent = shortest || "—";
    els.uniqueWords.textContent = uniqueWords.toLocaleString();
    els.keywordDensity.textContent = kwDensity + "%";
    els.estimatedPages.textContent = estimatedPages.toLocaleString();
    els.socialLength.textContent = socialLength;
    els.languageGuess.textContent = language;

    updateProgress(charWithSpaces);
  }

  function updateProgress(charCount) {
    if (els.noLimitToggle.checked) {
      els.progressFill.style.width = "0%";
      els.progressLabel.textContent = "No limit mode enabled";
      return;
    }
    const limit = Math.max(1, parseInt(els.limitInput.value, 10) || 5000);
    const pct = Math.min(100, (charCount / limit) * 100);
    els.progressFill.style.width = pct.toFixed(1) + "%";
    els.progressFill.style.background =
      pct >= 100 ? "#DC2626" : "linear-gradient(90deg,var(--primary),var(--accent))";
    els.progressLabel.textContent = charCount.toLocaleString() + " / " + limit.toLocaleString() + " characters";
  }

  textarea.addEventListener("input", analyze);
  els.limitInput.addEventListener("input", () => updateProgress(textarea.value.length));
  els.noLimitToggle.addEventListener("change", () => {
    els.limitInput.disabled = els.noLimitToggle.checked;
    updateProgress(textarea.value.length);
  });

  /* ---------- Toolbar actions ---------- */
  buttons.paste.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      textarea.value += text;
      analyze();
      textarea.focus();
    } catch (e) {
      alert("Clipboard access was blocked by your browser. Please paste manually with Ctrl+V.");
    }
  });

  buttons.clear.addEventListener("click", () => {
    textarea.value = "";
    analyze();
    textarea.focus();
  });

  buttons.copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      flashButton(buttons.copy, "Copied!");
    } catch (e) {
      textarea.select();
      document.execCommand("copy");
      flashButton(buttons.copy, "Copied!");
    }
  });

  buttons.download.addEventListener("click", () => {
    const blob = new Blob([textarea.value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "word-count-text.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  buttons.upload.addEventListener("click", () => buttons.uploadInput.click());
  buttons.uploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      textarea.value = evt.target.result;
      analyze();
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  buttons.trim.addEventListener("click", () => {
    textarea.value = textarea.value.trim();
    analyze();
  });

  buttons.singleSpace.addEventListener("click", () => {
    textarea.value = textarea.value.replace(/[ \t]+/g, " ");
    analyze();
  });

  buttons.removeExtraLines.addEventListener("click", () => {
    textarea.value = textarea.value.replace(/\n{3,}/g, "\n\n");
    analyze();
  });

  function flashButton(btn, tempLabel) {
    const original = btn.textContent;
    btn.textContent = tempLabel;
    setTimeout(() => (btn.textContent = original), 1200);
  }

  /* ---------- Keyboard shortcuts ---------- */
  textarea.addEventListener("keydown", (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "s") {
      e.preventDefault();
      buttons.download.click();
    }
  });

  /* ---------- Contact form validation ---------- */
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let valid = true;
      const name = form.querySelector("#contactName");
      const email = form.querySelector("#contactEmail");
      const message = form.querySelector("#contactMessage");
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      [name, email, message].forEach((field) => field.closest(".form-group").classList.remove("invalid"));

      if (!name.value.trim()) {
        name.closest(".form-group").classList.add("invalid");
        valid = false;
      }
      if (!email.value.trim() || !emailRe.test(email.value.trim())) {
        email.closest(".form-group").classList.add("invalid");
        valid = false;
      }
      if (!message.value.trim()) {
        message.closest(".form-group").classList.add("invalid");
        valid = false;
      }

      const successBox = document.getElementById("formSuccess");
      if (valid) {
        successBox.classList.add("show");
        successBox.textContent = "Thanks! Your message has been received.";
        form.reset();
      } else {
        successBox.classList.remove("show");
      }
    });
  }

  // Initial render
  analyze();
  els.limitInput.disabled = els.noLimitToggle.checked;
})();
