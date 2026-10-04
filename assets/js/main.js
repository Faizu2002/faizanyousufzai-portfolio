
document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // Mobile Navigation
  // =========================
  const menuButton = document.querySelector(".menu");
  const nav = document.querySelector(".navlinks");

  if (menuButton && nav) {
    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();

      const isOpen = nav.classList.toggle("open");

      menuButton.setAttribute(
        "aria-expanded",
        isOpen ? "true" : "false"
      );
    });

    // Close menu when clicking a nav link
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    });

    // Close menu when clicking outside
    document.addEventListener("click", (event) => {
      if (
        nav.classList.contains("open") &&
        !nav.contains(event.target) &&
        !menuButton.contains(event.target)
      ) {
        nav.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });

    // Close with Escape key
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        nav.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });

    // Reset menu when returning to desktop
    window.addEventListener("resize", () => {
      if (window.innerWidth > 980) {
        nav.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  // =========================
  // Reveal Animations
  // =========================
  const revealElements = document.querySelectorAll("[data-reveal]");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.animate(
              [
                {
                  opacity: 0,
                  transform: "translateY(18px)"
                },
                {
                  opacity: 1,
                  transform: "translateY(0)"
                }
              ],
              {
                duration: 550,
                easing: "cubic-bezier(.2,.8,.2,1)",
                fill: "both"
              }
            );

            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12
      }
    );

    revealElements.forEach((element) => {
      observer.observe(element);
    });
  }

  // =========================
  // Dynamic Copyright Year
  // =========================
  document.querySelectorAll("[data-year]").forEach((year) => {
    year.textContent = new Date().getFullYear();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "https://ayra-api-vercel.vercel.app/api/chat";

  const wrapper = document.createElement("div");

  wrapper.innerHTML = `
    <button class="ayra-toggle" type="button" aria-label="Open Ayra chat">
      <span>✦</span>
    </button>

    <div class="ayra-chat" aria-live="polite">
      <div class="ayra-header">
        <div>
          <strong>Ayra</strong>
          <small>Faizan's AI Assistant</small>
        </div>

        <button class="ayra-close" type="button" aria-label="Close chat">
          ×
        </button>
      </div>

      <div class="ayra-messages">
        <div class="ayra-message bot">
          Hi, I'm Ayra 👋
          <br>
          Ask me about Faizan's SEO services, web development, projects, or how to get in touch.
        </div>
      </div>

      <div class="ayra-quick">
        <button type="button" data-message="Tell me about Faizan's SEO services">
          SEO Services
        </button>

        <button type="button" data-message="Tell me about Faizan's web development services">
          Web Development
        </button>

        <button type="button" data-message="Show me Faizan's projects">
          View Projects
        </button>

        <button type="button" data-message="How can I contact Faizan?">
          Contact Faizan
        </button>
      </div>

      <form class="ayra-form">
        <input
          type="text"
          class="ayra-input"
          placeholder="Ask Ayra..."
          maxlength="1500"
          autocomplete="off"
          required
        >

        <button type="submit" class="ayra-send" aria-label="Send message">
          ➤
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(wrapper);

  const toggle = wrapper.querySelector(".ayra-toggle");
  const chat = wrapper.querySelector(".ayra-chat");
  const close = wrapper.querySelector(".ayra-close");
  const form = wrapper.querySelector(".ayra-form");
  const input = wrapper.querySelector(".ayra-input");
  const messages = wrapper.querySelector(".ayra-messages");
  const quickButtons = wrapper.querySelectorAll(".ayra-quick button");

  let chatHistory = [];

  try {
    const savedHistory = sessionStorage.getItem("ayra_history");

    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);

      if (Array.isArray(parsed)) {
        chatHistory = parsed.slice(-10);

        chatHistory.forEach(item => {
          if (item.role === "user") {
            addMessage(item.text, "user", false);
          }

          if (item.role === "model") {
            addMessage(item.text, "bot", false);
          }
        });
      }
    }
  } catch (error) {
    console.warn("Could not restore Ayra history:", error);
  }

  toggle.addEventListener("click", () => {
    chat.classList.toggle("open");

    if (chat.classList.contains("open")) {
      setTimeout(() => input.focus(), 100);
    }
  });

  close.addEventListener("click", () => {
    chat.classList.remove("open");
  });

  quickButtons.forEach(button => {
    button.addEventListener("click", () => {
      const message = button.dataset.message || button.textContent.trim();

      input.value = message;
      form.requestSubmit();
    });
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message) {
      return;
    }

    addMessage(message, "user");

    chatHistory.push({
      role: "user",
      text: message
    });

    saveHistory();

    input.value = "";
    input.disabled = true;

    const loadingMessage = addMessage("Ayra is typing...", "bot", false);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: message,
          page: window.location.pathname,
          title: document.title,
          history: chatHistory.slice(-6)
        })
      });

      const rawResponse = await response.text();

      if (loadingMessage) {
        loadingMessage.remove();
      }

      let data;

      try {
        data = JSON.parse(rawResponse);
      } catch (error) {
        console.error("Ayra JSON parse error:", error);

        addMessage(
          "I received an unexpected response from the server. Please try again.",
          "bot"
        );

        return;
      }

      if (!response.ok) {
        console.error("Ayra API error:", data);

        addMessage(
          data.error || "Ayra is unavailable right now.",
          "bot"
        );

        return;
      }

      if (!data.reply) {
        addMessage(
          "I couldn't generate a reply right now. Please try again.",
          "bot"
        );

        return;
      }

      addMessage(data.reply, "bot");

      chatHistory.push({
        role: "model",
        text: data.reply
      });

      saveHistory();

    } catch (error) {
      console.error("Ayra connection error:", error);

      if (loadingMessage) {
        loadingMessage.remove();
      }

      addMessage(
        "I couldn't connect to Ayra's server right now.",
        "bot"
      );
    } finally {
      input.disabled = false;
      input.focus();
    }
  });

  function addMessage(text, type, shouldScroll = true) {
    const messageElement = document.createElement("div");

    messageElement.className = `ayra-message ${type}`;

    const formattedText = String(text)
      .replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      .replace(/\n/g, "<br>");

    messageElement.innerHTML = formattedText;

    messages.appendChild(messageElement);

    if (shouldScroll) {
      messages.scrollTop = messages.scrollHeight;
    }

    return messageElement;
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(
        "ayra_history",
        JSON.stringify(chatHistory.slice(-10))
      );
    } catch (error) {
      console.warn("Could not save Ayra history:", error);
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const whatsapp = document.createElement("a");

  whatsapp.href =
    "https://wa.me/923182203481?text=Hi%20Faizan%2C%20I%20visited%20your%20website%20and%20want%20to%20discuss%20a%20project.";

  whatsapp.className = "whatsapp-sticky";
  whatsapp.target = "_blank";
  whatsapp.rel = "noopener";
  whatsapp.setAttribute(
    "aria-label",
    "Chat with Faizan on WhatsApp"
  );

  whatsapp.innerHTML = `
    <span class="whatsapp-icon">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M19.11 17.2c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.16.25-.64.81-.79.98-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.34-.77-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.02 2.57c.12.16 1.75 2.67 4.24 3.75.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29z"/>
        <path d="M16.03 3.2c-6.99 0-12.67 5.68-12.67 12.67 0 2.23.58 4.41 1.69 6.32L3.25 28.8l6.76-1.77a12.6 12.6 0 0 0 6.01 1.53h.01c6.99 0 12.67-5.68 12.67-12.67S23.02 3.2 16.03 3.2zm0 23.23h-.01c-1.88 0-3.72-.51-5.32-1.47l-.38-.23-4.01 1.05 1.07-3.91-.25-.4a10.48 10.48 0 0 1-1.61-5.59c0-5.79 4.71-10.5 10.51-10.5s10.5 4.71 10.5 10.5-4.71 10.55-10.5 10.55z"/>
      </svg>
    </span>

    <span class="whatsapp-text">
      Chat with Faizan
    </span>
  `;

  document.body.appendChild(whatsapp);
});

/* =========================================================
   GLOBAL AUTH LOADER
   Load heavy auth code only when the visitor interacts.
   A fallback timer keeps the account UI available on idle pages.
========================================================= */

(() => {
  if (
    window.__FAIZAN_AUTH_LOADER__ ||
    document.querySelector('script[data-faizan-auth-ui]')
  ) return;

  let loaded = false;

  const loadAuthUi = () => {
    if (loaded || document.querySelector('script[data-faizan-auth-ui]')) return;

    loaded = true;
    window.__FAIZAN_AUTH_LOADER__ = true;

    const script = document.createElement('script');
    script.src = '/assets/js/auth-ui.js';
    script.defer = true;
    script.dataset.faizanAuthUi = 'true';
    document.head.appendChild(script);
  };

  const interactionEvents = ['pointerdown', 'touchstart'];

  interactionEvents.forEach((eventName) => {
    window.addEventListener(eventName, loadAuthUi, {
      once: true,
      passive: true
    });
  });

  window.addEventListener('keydown', loadAuthUi, { once: true });

  // Keep the existing auth experience available even if a visitor only reads.
  window.setTimeout(loadAuthUi, 12000);
})();


/* __FAIZAN_LEGAL_FOOTER__ */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".copyright").forEach((el) => {
    if (el.querySelector('a[href="/terms"]')) return;
    const privacy = el.querySelector('a[href="/privacy-policy"]');
    const sep = document.createTextNode(" · ");
    const terms = document.createElement("a");
    terms.href = "/terms";
    terms.textContent = "Terms";
    if (privacy) {
      privacy.after(sep, terms);
    } else {
      el.append(sep, terms);
    }
  });
});
