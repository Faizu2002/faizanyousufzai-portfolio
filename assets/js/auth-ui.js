/* =========================================================
   FaizanYousufzai.online — Global Auth UI
   Supabase Auth + Cloudflare Turnstile
========================================================= */

(() => {
  'use strict';

  if (window.__FAIZAN_AUTH_UI_LOADED__) return;
  window.__FAIZAN_AUTH_UI_LOADED__ = true;

  const SUPABASE_URL =
    'https://xuzolqglwlgvsazlojsy.supabase.co';

  const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_vP0WCXtMMSbgsnXmwjVLFQ_qleCkmhr';

  const SUPABASE_CDN =
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  const CONFIG_JS =
    '/assets/js/supabase-config.js';

  const AUTH_CSS =
    '/assets/css/auth-ui.css';

  const TURNSTILE_CDN =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';


  let sb = null;
  let currentUser = null;
  let currentProfile = null;


  const captcha = {
    login: {
      widgetId: null,
      token: ''
    },

    signup: {
      widgetId: null,
      token: ''
    },

    reset: {
      widgetId: null,
      token: ''
    }
  };


  /* =========================================================
     HELPERS
  ========================================================= */

  const $ = (selector, root = document) =>
    root.querySelector(selector);


  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];


  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }


  function cleanName(value = '') {
    return String(value)
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 50);
  }


  function nameFromEmail(email = '') {
    return String(email).split('@')[0] || 'Member';
  }


  function userName() {
    return (
      currentProfile?.display_name ||
      currentUser?.user_metadata?.display_name ||
      currentUser?.user_metadata?.full_name ||
      nameFromEmail(currentUser?.email)
    );
  }


  function initials(name = '') {
    const parts = String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) return 'A';

    return parts
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  }


  function friendlyError(error) {
    const message = String(
      error?.message ||
      error ||
      'Something went wrong.'
    );

    const lower = message.toLowerCase();


    if (
      lower.includes('invalid login credentials')
    ) {
      return 'Email or password is incorrect.';
    }


    if (
      lower.includes('email not confirmed')
    ) {
      return 'Please confirm your email before logging in.';
    }


    if (
      lower.includes('user already registered')
    ) {
      return 'An account with this email already exists.';
    }


    if (
      lower.includes('password should be at least')
    ) {
      return 'Password must be at least 8 characters.';
    }


    if (
      lower.includes('captcha') ||
      lower.includes('captcha_token')
    ) {
      return 'Please complete the security check and try again.';
    }


    if (
      lower.includes('rate limit')
    ) {
      return 'Too many attempts. Please try again shortly.';
    }


    return message;
  }


  function busy(
    button,
    state,
    text = 'Please wait…'
  ) {
    if (!button) return;

    if (state) {

      button.dataset.oldText =
        button.textContent;

      button.textContent = text;

      button.disabled = true;

    } else {

      button.textContent =
        button.dataset.oldText ||
        button.textContent;

      button.disabled = false;
    }
  }


  /* =========================================================
     LOAD CSS
  ========================================================= */

  function loadAuthCss() {

  return new Promise(resolve => {

    const existing =
      document.querySelector(
        'link[data-auth-ui-css]'
      );


    if (existing) {

      if (existing.sheet) {
        resolve();
        return;
      }

      existing.addEventListener(
        'load',
        resolve,
        { once: true }
      );

      existing.addEventListener(
        'error',
        resolve,
        { once: true }
      );

      return;
    }


    const alreadyLoaded =
      [...document.styleSheets]
        .some(sheet => {

          try {

            return (
              sheet.href &&
              sheet.href.includes(
                '/assets/css/auth-ui.css'
              )
            );

          } catch {

            return false;
          }

        });


    if (alreadyLoaded) {

      resolve();

      return;
    }


    const link =
      document.createElement('link');


    link.rel = 'stylesheet';

    link.href =
      '/assets/css/auth-ui.css';


    link.dataset.authUiCss =
      'true';


    link.onload = resolve;

    link.onerror = resolve;


    document.head.appendChild(
      link
    );

  });

}


  /* =========================================================
     SCRIPT LOADER
  ========================================================= */

  function loadScript(
    src,
    test,
    matcher
  ) {

    return new Promise(
      (resolve, reject) => {

        if (test?.()) {

          resolve();

          return;
        }


        const existing =
          [...document.scripts]
            .find(script => {

              if (matcher) {
                return matcher(script);
              }

              return script.src === src;
            });


        if (existing) {

          let attempts = 0;


          const timer =
            setInterval(() => {

              attempts++;


              if (test?.()) {

                clearInterval(timer);

                resolve();

              } else if (attempts >= 60) {

                clearInterval(timer);

                reject(
                  new Error(
                    'Required script did not initialize.'
                  )
                );

              }

            }, 50);


          return;
        }


        const script =
          document.createElement('script');


        script.src = src;

        script.async = true;


        script.onload = () => {

          let attempts = 0;


          const timer =
            setInterval(() => {

              attempts++;


              if (
                !test ||
                test()
              ) {

                clearInterval(timer);

                resolve();

              } else if (
                attempts >= 60
              ) {

                clearInterval(timer);

                reject(
                  new Error(
                    'Required script did not initialize.'
                  )
                );

              }

            }, 50);

        };


        script.onerror = () => {

          reject(
            new Error(
              'Could not load required script.'
            )
          );

        };


        document.head.appendChild(script);
      }
    );
  }


  /* =========================================================
     SUPABASE
  ========================================================= */

  async function ensureSupabase() {

    if (!window.supabase?.createClient) {

      await loadScript(
        SUPABASE_CDN,

        () =>
          !!window.supabase?.createClient,

        script =>
          script.src.includes(
            '@supabase/supabase-js'
          )
      );

    }


    if (
      !window.SITE_AUTH ||
      typeof window.getSupabase !==
        'function'
    ) {

      try {

        await loadScript(
          CONFIG_JS,

          () =>
            !!window.SITE_AUTH ||
            typeof window.getSupabase ===
              'function',

          script =>
            script.src.includes(
              '/assets/js/supabase-config.js'
            )
        );

      } catch (error) {

        console.warn(
          'Could not load supabase-config.js',
          error
        );

      }

    }


    if (
      typeof window.getSupabase ===
      'function'
    ) {

      try {

        const shared =
          window.getSupabase();


        if (
          shared?.auth?.getSession
        ) {

          sb = shared;

          return sb;
        }

      } catch {}
    }


    if (
      window.faizanAuthClient
        ?.auth?.getSession
    ) {

      sb =
        window.faizanAuthClient;

      return sb;
    }


    if (!sb) {

      sb =
        window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY,
          {

            auth: {

              persistSession: true,

              autoRefreshToken: true,

              detectSessionInUrl: true

            }

          }
        );


      window.faizanAuthClient = sb;
    }


    return sb;
  }


  /* =========================================================
     TURNSTILE
  ========================================================= */

  function siteKey() {

    return String(
      window.SITE_AUTH
        ?.turnstileSiteKey ||
      ''
    ).trim();
  }


  async function ensureTurnstile() {

    await ensureSupabase();


    if (!siteKey()) {

      throw new Error(
        'Turnstile site key was not found in supabase-config.js.'
      );
    }


    if (
      window.turnstile?.render
    ) {

      return window.turnstile;
    }


    await loadScript(
      TURNSTILE_CDN,

      () =>
        !!window.turnstile?.render,

      script =>
        script.src.includes(
          'challenges.cloudflare.com/turnstile'
        )
    );


    return window.turnstile;
  }


  function captchaToken(type) {

    return (
      captcha[type]?.token ||
      ''
    );
  }


  function resetCaptcha(type) {

    const state =
      captcha[type];


    if (!state) return;


    state.token = '';


    if (
      state.widgetId !== null &&
      window.turnstile?.reset
    ) {

      try {

        window.turnstile.reset(
          state.widgetId
        );

      } catch {}

    }
  }


  async function renderCaptcha(type) {

    const state =
      captcha[type];


    if (!state) return;


    const container =
      document.querySelector(
        `[data-fy-captcha="${type}"]`
      );


    if (!container) return;


    const turnstile =
      await ensureTurnstile();


    if (
      state.widgetId !== null
    ) {

      return;
    }


    state.widgetId =
      turnstile.render(
        container,
        {

          sitekey:
            siteKey(),

          theme:
            'light',

          callback(token) {

            state.token =
              token || '';

            clearMessage();

          },

          'expired-callback'() {

            state.token = '';

          },

          'timeout-callback'() {

            state.token = '';

          },

          'error-callback'() {

            state.token = '';

            showMessage(
              'Security check could not load. Please refresh and try again.',
              'error'
            );

          }

        }
      );
  }


  function scheduleCaptcha(type) {

    if (
      !captcha[type]
    ) {
      return;
    }


    requestAnimationFrame(() => {

      renderCaptcha(type)
        .catch(error => {

          showMessage(
            friendlyError(error),
            'error'
          );

        });

    });
  }


  /* =========================================================
     PROFILE API
  ========================================================= */

  async function accessToken() {

    const client =
      await ensureSupabase();


    const {
      data,
      error
    } =
      await client.auth.getSession();


    if (error) {
      throw error;
    }


    return (
      data?.session
        ?.access_token ||
      ''
    );
  }


  async function profileApi(
    method = 'GET',
    body
  ) {

    const token =
      await accessToken();


    if (!token) {

      throw new Error(
        'Please log in first.'
      );

    }


    const response =
      await fetch(
        '/api/profile',
        {

          method,

          headers: {

            'Content-Type':
              'application/json',

            Accept:
              'application/json',

            Authorization:
              `Bearer ${token}`

          },

          body:
            body === undefined
              ? undefined
              : JSON.stringify(body)

        }
      );


    const data =
      await response
        .json()
        .catch(() => ({}));


    if (!response.ok) {

      const error =
        new Error(
          data.error ||
          data.message ||
          'Profile request failed.'
        );


      error.status =
        response.status;


      throw error;
    }


    return data;
  }


  async function loadProfile() {

    if (!currentUser) {

      currentProfile = null;

      return;
    }


    try {

      const result =
        await profileApi();


      currentProfile =
        result.profile || null;

    } catch {

      currentProfile = null;

    }
  }


  /* =========================================================
     CREATE GLOBAL UI
  ========================================================= */

  function ensureUi() {

    if (
      document.getElementById(
        'fy-auth-ui'
      )
    ) {
      return;
    }


    const shell =
      document.createElement('div');


    shell.id =
      'fy-auth-ui';


    shell.innerHTML = `

      <div
        class="fy-auth-modal"
        id="fy-auth-modal"
        hidden
      >

        <button
          class="fy-auth-backdrop"
          type="button"
          data-auth-close
          aria-label="Close"
        ></button>


        <section
          class="fy-auth-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fy-auth-title"
        >

          <div class="fy-auth-dialog-head">

            <div>

              <span
                class="fy-auth-kicker"
                id="fy-auth-kicker"
              >
                ACCOUNT
              </span>

              <h2 id="fy-auth-title">
                Welcome back
              </h2>

            </div>


            <button
              type="button"
              class="fy-auth-x"
              data-auth-close
              aria-label="Close"
            >
              ×
            </button>

          </div>


          <div
            class="fy-auth-tabs"
            id="fy-auth-tabs"
          >

            <button
              type="button"
              class="active"
              data-auth-tab="login"
            >
              Login
            </button>

            <button
              type="button"
              data-auth-tab="signup"
            >
              Sign Up
            </button>

          </div>


          <div
            class="fy-auth-message"
            id="fy-auth-message"
            hidden
          ></div>


          <!-- LOGIN -->

          <form
            class="fy-auth-form"
            id="fy-login-form"
            data-panel="login"
          >

            <label>

              <span>Email</span>

              <input
                name="email"
                type="email"
                autocomplete="email"
                required
                placeholder="you@example.com"
              >

            </label>


            <label>

              <span>Password</span>

              <div class="fy-password-field">

                <input
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  minlength="8"
                  placeholder="Your password"
                >

                <button
                  type="button"
                  data-password-toggle
                >
                  Show
                </button>

              </div>

            </label>


            <div class="fy-turnstile-wrap">

              <div
                data-fy-captcha="login"
              ></div>

            </div>


            <button
              class="fy-auth-submit"
              type="submit"
            >
              Login
            </button>


            <button
              type="button"
              class="fy-auth-text-button"
              data-open-panel="reset"
            >
              Forgot password?
            </button>

          </form>


          <!-- SIGNUP -->

          <form
            class="fy-auth-form"
            id="fy-signup-form"
            data-panel="signup"
            hidden
          >

            <label>

              <span>Name</span>

              <input
                name="display_name"
                type="text"
                autocomplete="name"
                required
                minlength="2"
                maxlength="50"
                placeholder="Your name"
              >

            </label>


            <label>

              <span>Email</span>

              <input
                name="email"
                type="email"
                autocomplete="email"
                required
                placeholder="you@example.com"
              >

            </label>


            <label>

              <span>Password</span>

              <div class="fy-password-field">

                <input
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="8"
                  placeholder="At least 8 characters"
                >

                <button
                  type="button"
                  data-password-toggle
                >
                  Show
                </button>

              </div>

            </label>


            <label>

              <span>
                Confirm password
              </span>

              <div class="fy-password-field">

                <input
                  name="confirm_password"
                  type="password"
                  autocomplete="new-password"
                  required
                  minlength="8"
                  placeholder="Repeat password"
                >

                <button
                  type="button"
                  data-password-toggle
                >
                  Show
                </button>

              </div>

            </label>


            <div class="fy-turnstile-wrap">

              <div
                data-fy-captcha="signup"
              ></div>

            </div>


            <button
              class="fy-auth-submit"
              type="submit"
            >
              Create Account
            </button>

          </form>


          <!-- FORGOT PASSWORD -->

          <form
            class="fy-auth-form"
            id="fy-reset-form"
            data-panel="reset"
            hidden
          >

            <p class="fy-auth-panel-copy">

              Enter your email and
              we'll send you a secure
              password recovery link.

            </p>


            <label>

              <span>Email</span>

              <input
                name="email"
                type="email"
                autocomplete="email"
                required
                placeholder="you@example.com"
              >

            </label>


            <div class="fy-turnstile-wrap">

              <div
                data-fy-captcha="reset"
              ></div>

            </div>


            <button
              class="fy-auth-submit"
              type="submit"
            >
              Send Recovery Link
            </button>


            <button
              type="button"
              class="fy-auth-text-button"
              data-open-panel="login"
            >
              Back to login
            </button>

          </form>


          <!-- EDIT NAME -->

          <form
            class="fy-auth-form"
            id="fy-name-form"
            data-panel="name"
            hidden
          >

            <p class="fy-auth-panel-copy">

              Change the name shown
              on your account and
              community profile.

            </p>


            <label>

              <span>Name</span>

              <input
                name="display_name"
                type="text"
                autocomplete="name"
                required
                minlength="2"
                maxlength="50"
              >

            </label>


            <button
              class="fy-auth-submit"
              type="submit"
            >
              Save Name
            </button>

          </form>


          <!-- EDIT EMAIL -->

          <form
            class="fy-auth-form"
            id="fy-email-form"
            data-panel="email"
            hidden
          >

            <p class="fy-auth-panel-copy">

              A confirmation email may
              be sent before your new
              email becomes active.

            </p>


            <label>

              <span>New email</span>

              <input
                name="email"
                type="email"
                autocomplete="email"
                required
              >

            </label>


            <button
              class="fy-auth-submit"
              type="submit"
            >
              Change Email
            </button>

          </form>


          <!-- PASSWORD -->

          <form
            class="fy-auth-form"
            id="fy-password-form"
            data-panel="password"
            hidden
          >

            <label>

              <span>New password</span>

              <div class="fy-password-field">

                <input
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  minlength="8"
                  required
                  placeholder="At least 8 characters"
                >

                <button
                  type="button"
                  data-password-toggle
                >
                  Show
                </button>

              </div>

            </label>


            <label>

              <span>
                Confirm password
              </span>

              <div class="fy-password-field">

                <input
                  name="confirm_password"
                  type="password"
                  autocomplete="new-password"
                  minlength="8"
                  required
                  placeholder="Repeat password"
                >

                <button
                  type="button"
                  data-password-toggle
                >
                  Show
                </button>

              </div>

            </label>


            <button
              class="fy-auth-submit"
              type="submit"
            >
              Update Password
            </button>

          </form>

        </section>

      </div>


      <div
        class="fy-auth-toast"
        id="fy-auth-toast"
        role="status"
        aria-live="polite"
        hidden
      ></div>
    `;


    document.body.appendChild(
      shell
    );
  }


  /* =========================================================
     HEADER
  ========================================================= */

  function headerNav() {

    return (
      document.querySelector(
        '.topbar .nav'
      ) ||

      document.querySelector(
        'header .nav'
      ) ||

      document.querySelector(
        '.nav'
      )
    );
  }


  function ensureHeaderAuth() {

    let root =
      document.getElementById(
        'fy-auth-nav'
      );


    if (root) {

      return root;
    }


    const nav =
      headerNav();


    if (!nav) {

      return null;
    }


    root =
      document.createElement(
        'div'
      );


    root.id =
      'fy-auth-nav';


    root.className =
      'fy-auth-nav';


    const mobileMenu =
      nav.querySelector('.menu');


    if (mobileMenu) {

      nav.insertBefore(
        root,
        mobileMenu
      );

    } else {

      nav.appendChild(root);

    }


    return root;
  }


  function renderHeader() {

    const root =
      ensureHeaderAuth();


    if (!root) return;


    if (!currentUser) {

      root.innerHTML = `

        <button
          type="button"
          class="fy-auth-login"
          data-open-auth="login"
        >
          Login
        </button>

        <button
          type="button"
          class="fy-auth-signup"
          data-open-auth="signup"
        >
          Sign Up
        </button>
      `;


      return;
    }


    const name =
      userName();


    const email =
      currentUser.email || '';


    const avatar =
      initials(name);


    const admin =
      currentProfile?.role ===
      'admin';


    root.innerHTML = `

      <div class="fy-account">

        <button
          type="button"
          class="fy-account-trigger"
          aria-expanded="false"
        >

          <span class="fy-account-avatar">

            ${escapeHtml(avatar)}

          </span>

          <span
            class="fy-account-trigger-text"
          >
            Account
          </span>

          <span
            class="fy-account-chevron"
          >
            ⌄
          </span>

        </button>


        <div
          class="fy-account-menu"
          id="fy-account-menu"
          hidden
        >

          <div class="fy-account-summary">

            <span
              class="fy-account-avatar large"
            >
              ${escapeHtml(avatar)}
            </span>


            <div>

              <strong>

                ${escapeHtml(name)}

              </strong>

              <small>

                ${escapeHtml(email)}

              </small>

            </div>

          </div>


          <div
            class="fy-account-divider"
          ></div>


          <button
            type="button"
            data-account="name"
          >

            <span>Edit name</span>

            <b>↗</b>

          </button>


          <button
            type="button"
            data-account="email"
          >

            <span>Change email</span>

            <b>↗</b>

          </button>


          <button
            type="button"
            data-account="password"
          >

            <span>
              Change password
            </span>

            <b>↗</b>

          </button>


          ${
            admin
              ? `

                <a
                  class="fy-account-admin"
                  href="/admin/"
                >

                  <span>
                    Admin dashboard
                  </span>

                  <b>↗</b>

                </a>

              `
              : ''
          }


          <div
            class="fy-account-divider"
          ></div>


          <button
            type="button"
            class="fy-account-logout"
            data-account="logout"
          >

            <span>Logout</span>

            <b>→</b>

          </button>

        </div>

      </div>
    `;
  }


  /* =========================================================
     MODAL
  ========================================================= */

  const panelInfo = {

    login: {
      kicker: 'ACCOUNT',
      title: 'Welcome back',
      tabs: true
    },

    signup: {
      kicker: 'CREATE ACCOUNT',
      title: 'Join the site',
      tabs: true
    },

    reset: {
      kicker: 'RECOVERY',
      title: 'Reset password',
      tabs: false
    },

    name: {
      kicker: 'ACCOUNT SETTINGS',
      title: 'Change your name',
      tabs: false
    },

    email: {
      kicker: 'ACCOUNT SETTINGS',
      title: 'Change your email',
      tabs: false
    },

    password: {
      kicker: 'ACCOUNT SETTINGS',
      title: 'Change password',
      tabs: false
    }

  };


  function showMessage(
    message,
    type = 'info'
  ) {

    const box =
      document.getElementById(
        'fy-auth-message'
      );


    if (!box) return;


    if (!message) {

      box.hidden = true;

      box.textContent = '';

      box.removeAttribute(
        'data-type'
      );

      return;
    }


    box.textContent =
      message;


    box.dataset.type =
      type;


    box.hidden = false;
  }


  function clearMessage() {

    showMessage('');
  }


  function showPanel(name) {

    const modal =
      document.getElementById(
        'fy-auth-modal'
      );


    if (!modal) return;


    const info =
      panelInfo[name] ||
      panelInfo.login;


    $$('[data-panel]', modal)
      .forEach(panel => {

        panel.hidden =
          panel.dataset.panel !==
          name;

      });


    const tabs =
      document.getElementById(
        'fy-auth-tabs'
      );


    if (tabs) {

      tabs.hidden =
        !info.tabs;
    }


    $$('[data-auth-tab]', modal)
      .forEach(button => {

        button.classList.toggle(
          'active',
          button.dataset.authTab ===
            name
        );

      });


    const kicker =
      document.getElementById(
        'fy-auth-kicker'
      );


    const title =
      document.getElementById(
        'fy-auth-title'
      );


    if (kicker) {

      kicker.textContent =
        info.kicker;
    }


    if (title) {

      title.textContent =
        info.title;
    }


    if (name === 'name') {

      const input =
        document.querySelector(
          '#fy-name-form [name="display_name"]'
        );


      if (input) {

        input.value =
          userName();
      }

    }


    if (name === 'email') {

      const input =
        document.querySelector(
          '#fy-email-form [name="email"]'
        );


      if (input) {

        input.value =
          currentUser?.email ||
          '';
      }

    }


    clearMessage();


    if (
      !modal.hidden &&
      captcha[name]
    ) {

      scheduleCaptcha(name);
    }
  }


  function openModal(
    name = 'login'
  ) {

    ensureUi();


    const modal =
      document.getElementById(
        'fy-auth-modal'
      );


    if (!modal) return;


    showPanel(name);


    modal.hidden = false;


    document.body.classList.add(
      'fy-auth-modal-open'
    );


    requestAnimationFrame(() => {

      modal.classList.add(
        'open'
      );


      scheduleCaptcha(name);


      const input =
        modal.querySelector(
          `[data-panel="${name}"] input`
        );


      input?.focus({
        preventScroll: true
      });

    });
  }


  function closeModal() {

    const modal =
      document.getElementById(
        'fy-auth-modal'
      );


    if (
      !modal ||
      modal.hidden
    ) {
      return;
    }


    modal.classList.remove(
      'open'
    );


    document.body.classList.remove(
      'fy-auth-modal-open'
    );


    setTimeout(() => {

      modal.hidden = true;

      clearMessage();

    }, 160);
  }


  /* =========================================================
     ACCOUNT DROPDOWN
  ========================================================= */

  function toggleAccount(
    force
  ) {

    const menu =
      document.getElementById(
        'fy-account-menu'
      );


    const trigger =
      document.querySelector(
        '.fy-account-trigger'
      );


    if (
      !menu ||
      !trigger
    ) {
      return;
    }


    const open =
      typeof force === 'boolean'
        ? force
        : menu.hidden;


    menu.hidden =
      !open;


    trigger.setAttribute(
      'aria-expanded',
      String(open)
    );
  }


  /* =========================================================
     TOAST
  ========================================================= */

  function toast(
    message,
    type = 'success'
  ) {

    const box =
      document.getElementById(
        'fy-auth-toast'
      );


    if (!box) return;


    box.textContent =
      message;


    box.dataset.type =
      type;


    box.hidden = false;


    requestAnimationFrame(() => {

      box.classList.add(
        'show'
      );

    });


    clearTimeout(
      toast.timer
    );


    toast.timer =
      setTimeout(() => {

        box.classList.remove(
          'show'
        );


        setTimeout(() => {

          box.hidden = true;

        }, 180);

      }, 3600);
  }


  /* =========================================================
     REFRESH SESSION
  ========================================================= */

  async function refreshSession(
    session = null
  ) {

    const client =
      await ensureSupabase();


    if (
      session?.user
    ) {

      currentUser =
        session.user;

    } else {

      const {
        data
      } =
        await client.auth.getUser();


      currentUser =
        data?.user || null;
    }


    if (currentUser) {

      await loadProfile();

    } else {

      currentProfile = null;
    }


    renderHeader();
  }


  /* =========================================================
     LOGIN
  ========================================================= */

  async function login(form) {

    clearMessage();


    const button =
      form.querySelector(
        'button[type="submit"]'
      );


    const email =
      form.email.value
        .trim()
        .toLowerCase();


    const password =
      form.password.value;


    const captchaToken =
      captchaTokenForLogin();


    if (!captchaToken) {

      showMessage(
        'Please complete the security check.',
        'error'
      );


      scheduleCaptcha(
        'login'
      );


      return;
    }


    busy(
      button,
      true,
      'Logging in…'
    );


    try {

      const client =
        await ensureSupabase();


      const {
        data,
        error
      } =
        await client.auth
          .signInWithPassword({

            email,

            password,

            options: {

              captchaToken

            }

          });


      if (error) {

        throw error;
      }


      await refreshSession(
        data.session
      );


      form.reset();


      closeModal();


      toast(
        'Logged in successfully.'
      );


    } catch (error) {

      showMessage(
        friendlyError(error),
        'error'
      );


    } finally {

      resetCaptcha(
        'login'
      );


      busy(
        button,
        false
      );
    }
  }


  function captchaTokenForLogin() {

    return captchaToken(
      'login'
    );
  }


  /* =========================================================
     SIGNUP
  ========================================================= */

  async function signup(form) {

    clearMessage();


    const button =
      form.querySelector(
        'button[type="submit"]'
      );


    const displayName =
      cleanName(
        form.display_name.value
      );


    const email =
      form.email.value
        .trim()
        .toLowerCase();


    const password =
      form.password.value;


    const confirmPassword =
      form.confirm_password.value;


    const token =
      captchaToken(
        'signup'
      );


    if (
      displayName.length < 2
    ) {

      showMessage(
        'Please enter your name.',
        'error'
      );

      return;
    }


    if (
      password.length < 8
    ) {

      showMessage(
        'Password must be at least 8 characters.',
        'error'
      );

      return;
    }


    if (
      password !==
      confirmPassword
    ) {

      showMessage(
        'Passwords do not match.',
        'error'
      );

      return;
    }


    if (!token) {

      showMessage(
        'Please complete the security check.',
        'error'
      );


      scheduleCaptcha(
        'signup'
      );


      return;
    }


    busy(
      button,
      true,
      'Creating account…'
    );


    try {

      const client =
        await ensureSupabase();


      const {
        data,
        error
      } =
        await client.auth.signUp({

          email,

          password,

          options: {

            data: {

              display_name:
                displayName

            },

            emailRedirectTo:
              `${location.origin}/login/?verified=1`,

            captchaToken:
              token

          }

        });


      if (error) {

        throw error;
      }


      form.reset();


      if (
        data.session &&
        data.user
      ) {

        await refreshSession(
          data.session
        );


        closeModal();


        toast(
          'Account created. You are signed in.'
        );

      } else {

        showPanel(
          'login'
        );


        showMessage(
          'Account created. Please verify your email before signing in.',
          'success'
        );

      }


    } catch (error) {

      showMessage(
        friendlyError(error),
        'error'
      );


    } finally {

      resetCaptcha(
        'signup'
      );


      busy(
        button,
        false
      );
    }
  }


  /* =========================================================
     FORGOT PASSWORD
  ========================================================= */

  async function forgotPassword(
    form
  ) {

    clearMessage();


    const button =
      form.querySelector(
        'button[type="submit"]'
      );


    const email =
      form.email.value
        .trim()
        .toLowerCase();


    const token =
      captchaToken(
        'reset'
      );


    if (!email) {

      showMessage(
        'Enter your email first.',
        'error'
      );

      return;
    }


    if (!token) {

      showMessage(
        'Please complete the security check.',
        'error'
      );


      scheduleCaptcha(
        'reset'
      );


      return;
    }


    busy(
      button,
      true,
      'Sending…'
    );


    try {

      const client =
        await ensureSupabase();


      const {
        error
      } =
        await client.auth
          .resetPasswordForEmail(
            email,
            {

              redirectTo:
                `${location.origin}/reset-password/`,

              captchaToken:
                token

            }
          );


      if (error) {

        throw error;
      }


      form.reset();


      showMessage(
        'Password reset email sent. Check your inbox.',
        'success'
      );


    } catch (error) {

      showMessage(
        friendlyError(error),
        'error'
      );


    } finally {

      resetCaptcha(
        'reset'
      );


      busy(
        button,
        false
      );
    }
  }


  /* =========================================================
     CHANGE NAME
  ========================================================= */

  async function changeName(
    form
  ) {

    clearMessage();


    if (!currentUser) {

      return;
    }


    const button =
      form.querySelector(
        'button[type="submit"]'
      );


    const name =
      cleanName(
        form.display_name.value
      );


    if (
      name.length < 2
    ) {

      showMessage(
        'Name must be at least 2 characters.',
        'error'
      );

      return;
    }


    busy(
      button,
      true,
      'Saving…'
    );


    try {

      const client =
        await ensureSupabase();


      const {
        error
      } =
        await client.auth
          .updateUser({

            data: {

              ...currentUser
                .user_metadata,

              display_name:
                name

            }

          });


      if (error) {

        throw error;
      }


      const result =
        await profileApi(
          'PATCH',
          {

            display_name:
              name

          }
        );


      currentProfile =
        result.profile || {
          ...(currentProfile || {}),
          display_name: name
        };


      const {
        data
      } =
        await client.auth
          .getUser();


      currentUser =
        data.user ||
        currentUser;


      renderHeader();


      closeModal();


      toast(
        'Name updated.'
      );


    } catch (error) {

      showMessage(
        friendlyError(error),
        'error'
      );


    } finally {

      busy(
        button,
        false
      );
    }
  }


  /* =========================================================
     CHANGE EMAIL
  ========================================================= */

  async function changeEmail(
    form
  ) {

    clearMessage();


    if (!currentUser) {

      return;
    }


    const button =
      form.querySelector(
        'button[type="submit"]'
      );


    const email =
      form.email.value
        .trim()
        .toLowerCase();


    if (!email) {

      showMessage(
        'Enter a valid email address.',
        'error'
      );

      return;
    }


    if (
      email ===
      String(
        currentUser.email || ''
      ).toLowerCase()
    ) {

      showMessage(
        'This is already your current email.',
        'error'
      );

      return;
    }


    busy(
      button,
      true,
      'Updating…'
    );


    try {

      const client =
        await ensureSupabase();


      const {
        error
      } =
        await client.auth
          .updateUser({

            email

          });


      if (error) {

        throw error;
      }


      closeModal();


      toast(
        'Email change requested. Check your inbox for confirmation.'
      );


    } catch (error) {

      showMessage(
        friendlyError(error),
        'error'
      );


    } finally {

      busy(
        button,
        false
      );
    }
  }


  /* =========================================================
     CHANGE PASSWORD
  ========================================================= */

  async function changePassword(
    form
  ) {

    clearMessage();


    if (!currentUser) {

      return;
    }


    const button =
      form.querySelector(
        'button[type="submit"]'
      );


    const password =
      form.password.value;


    const confirmPassword =
      form.confirm_password.value;


    if (
      password.length < 8
    ) {

      showMessage(
        'Password must be at least 8 characters.',
        'error'
      );

      return;
    }


    if (
      password !==
      confirmPassword
    ) {

      showMessage(
        'Passwords do not match.',
        'error'
      );

      return;
    }


    busy(
      button,
      true,
      'Updating…'
    );


    try {

      const client =
        await ensureSupabase();


      const {
        error
      } =
        await client.auth
          .updateUser({

            password

          });


      if (error) {

        throw error;
      }


      form.reset();


      closeModal();


      toast(
        'Password updated successfully.'
      );


    } catch (error) {

      showMessage(
        friendlyError(error),
        'error'
      );


    } finally {

      busy(
        button,
        false
      );
    }
  }


  /* =========================================================
     LOGOUT
  ========================================================= */

  async function logout() {

    toggleAccount(false);


    try {

      const client =
        await ensureSupabase();


      const {
        error
      } =
        await client.auth.signOut();


      if (error) {

        throw error;
      }


      currentUser = null;

      currentProfile = null;


      renderHeader();


      toast(
        'You are logged out.'
      );


    } catch (error) {

      toast(
        friendlyError(error),
        'error'
      );
    }
  }


  /* =========================================================
     EVENTS
  ========================================================= */

  function bindEvents() {

    document.addEventListener(
      'click',
      event => {

        const authButton =
          event.target.closest(
            '[data-open-auth]'
          );


        if (authButton) {

          openModal(
            authButton.dataset
              .openAuth ||
            'login'
          );

          return;
        }


        const close =
          event.target.closest(
            '[data-auth-close]'
          );


        if (close) {

          closeModal();

          return;
        }


        const tab =
          event.target.closest(
            '[data-auth-tab]'
          );


        if (tab) {

          showPanel(
            tab.dataset.authTab
          );

          return;
        }


        const panelButton =
          event.target.closest(
            '[data-open-panel]'
          );


        if (panelButton) {

          showPanel(
            panelButton.dataset
              .openPanel
          );

          return;
        }


        const passToggle =
          event.target.closest(
            '[data-password-toggle]'
          );


        if (passToggle) {

          const wrap =
            passToggle.closest(
              '.fy-password-field'
            );


          const input =
            wrap?.querySelector(
              'input'
            );


          if (!input) return;


          if (
            input.type ===
            'password'
          ) {

            input.type =
              'text';

            passToggle.textContent =
              'Hide';

          } else {

            input.type =
              'password';

            passToggle.textContent =
              'Show';

          }


          return;
        }


        const accountTrigger =
          event.target.closest(
            '.fy-account-trigger'
          );


        if (accountTrigger) {

          event.stopPropagation();

          toggleAccount();

          return;
        }


        const accountAction =
          event.target.closest(
            '[data-account]'
          );


        if (accountAction) {

          event.stopPropagation();


          const type =
            accountAction.dataset
              .account;


          toggleAccount(false);


          if (
            type === 'logout'
          ) {

            logout();

          } else if (
            type === 'name' ||
            type === 'email' ||
            type === 'password'
          ) {

            openModal(type);

          }


          return;
        }


        if (
          !event.target.closest(
            '.fy-account'
          )
        ) {

          toggleAccount(false);
        }

      }
    );


    document.addEventListener(
      'keydown',
      event => {

        if (
          event.key !==
          'Escape'
        ) {
          return;
        }


        const modal =
          document.getElementById(
            'fy-auth-modal'
          );


        if (
          modal &&
          !modal.hidden
        ) {

          closeModal();

        } else {

          toggleAccount(false);

        }

      }
    );


    document
      .getElementById(
        'fy-login-form'
      )
      ?.addEventListener(
        'submit',
        event => {

          event.preventDefault();

          login(
            event.currentTarget
          );

        }
      );


    document
      .getElementById(
        'fy-signup-form'
      )
      ?.addEventListener(
        'submit',
        event => {

          event.preventDefault();

          signup(
            event.currentTarget
          );

        }
      );


    document
      .getElementById(
        'fy-reset-form'
      )
      ?.addEventListener(
        'submit',
        event => {

          event.preventDefault();

          forgotPassword(
            event.currentTarget
          );

        }
      );


    document
      .getElementById(
        'fy-name-form'
      )
      ?.addEventListener(
        'submit',
        event => {

          event.preventDefault();

          changeName(
            event.currentTarget
          );

        }
      );


    document
      .getElementById(
        'fy-email-form'
      )
      ?.addEventListener(
        'submit',
        event => {

          event.preventDefault();

          changeEmail(
            event.currentTarget
          );

        }
      );


    document
      .getElementById(
        'fy-password-form'
      )
      ?.addEventListener(
        'submit',
        event => {

          event.preventDefault();

          changePassword(
            event.currentTarget
          );

        }
      );
  }


  /* =========================================================
     INIT
  ========================================================= */

  async function init() {

    loadAuthCss();

    ensureUi();

    ensureHeaderAuth();

    bindEvents();

    renderHeader();


    try {

      const client =
        await ensureSupabase();


      const {
        data
      } =
        await client.auth
          .getSession();


      if (
        data.session
      ) {

        currentUser =
          data.session.user;


        await loadProfile();

      } else {

        currentUser = null;

        currentProfile = null;
      }


      renderHeader();


      client.auth
        .onAuthStateChange(
          (
            event,
            session
          ) => {

            setTimeout(
              async () => {

                currentUser =
                  session?.user ||
                  null;


                if (
                  currentUser
                ) {

                  await loadProfile();

                } else {

                  currentProfile =
                    null;

                }


                renderHeader();


                if (
                  event ===
                  'PASSWORD_RECOVERY'
                ) {

                  /*
                   * Your existing recovery email
                   * redirects to /reset-password/,
                   * so normally this modal will
                   * not be needed.
                   */

                }

              },
              0
            );

          }
        );


    } catch (error) {

      console.error(
        'Auth UI initialization error:',
        error
      );
    }
  }


  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once: true
      }
    );

  } else {

    init();

  }

})();
