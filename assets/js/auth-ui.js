/* =========================================================
   FaizanYousufzai.online — Global Auth UI
   Supabase Auth + profile/account dropdown
   Load this file once through main.js and blog.js.
========================================================= */

(() => {
  'use strict';

  if (window.__FAIZAN_AUTH_UI_LOADED__) return;
  window.__FAIZAN_AUTH_UI_LOADED__ = true;

  const SUPABASE_URL = 'https://xuzolqglwlgvsazlojsy.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vP0WCXtMMSbgsnXmwjVLFQ_qleCkmhr';
  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const AUTH_CSS = '/assets/css/auth-ui.css';

  let client = null;
  let currentUser = null;
  let currentProfile = null;
  let authSubscription = null;

  /* -----------------------------
     Helpers
  ----------------------------- */

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $$(selector, root = document) {
    return [...root.querySelectorAll(selector)];
  }

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function cleanName(value = '') {
    return String(value).trim().replace(/\s+/g, ' ').slice(0, 50);
  }

  function emailPrefix(email = '') {
    return String(email).split('@')[0] || 'Member';
  }

  function displayNameFor(user, profile) {
    return (
      profile?.display_name ||
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      emailPrefix(user?.email)
    );
  }

  function initialsFor(name = '') {
    const parts = String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) return 'A';

    return parts
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function setButtonBusy(button, busy, busyText = 'Please wait…') {
    if (!button) return;

    if (busy) {
      button.dataset.oldText = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    } else {
      button.textContent = button.dataset.oldText || button.textContent;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  function friendlyError(error) {
    const raw = String(error?.message || error || 'Something went wrong.').trim();

    const lower = raw.toLowerCase();

    if (lower.includes('invalid login credentials')) {
      return 'Email or password is incorrect.';
    }

    if (lower.includes('email not confirmed')) {
      return 'Please confirm your email before logging in.';
    }

    if (lower.includes('user already registered')) {
      return 'An account with this email already exists.';
    }

    if (lower.includes('password should be at least')) {
      return 'Password must be at least 8 characters.';
    }

    if (lower.includes('same password')) {
      return 'Please choose a different password.';
    }

    if (lower.includes('rate limit')) {
      return 'Too many attempts. Please try again in a little while.';
    }

    return raw;
  }

  /* -----------------------------
     Asset loading
  ----------------------------- */

  function loadCssOnce() {
    if (
      document.querySelector('link[data-faizan-auth-css]') ||
      [...document.styleSheets].some(sheet => {
        try {
          return sheet.href && sheet.href.includes('/assets/css/auth-ui.css');
        } catch {
          return false;
        }
      })
    ) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = AUTH_CSS;
    link.dataset.faizanAuthCss = 'true';
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts]
        .find(script => script.src === src || script.src.includes('@supabase/supabase-js'));

      if (existing) {
        if (window.supabase?.createClient) {
          resolve();
          return;
        }

        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Could not load authentication library.')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';

      script.addEventListener('load', resolve, { once: true });
      script.addEventListener(
        'error',
        () => reject(new Error('Could not load authentication library.')),
        { once: true }
      );

      document.head.appendChild(script);
    });
  }

  function findExistingSupabaseClient() {
    try {
      if (
        typeof supabaseClient !== 'undefined' &&
        supabaseClient?.auth?.getSession
      ) {
        return supabaseClient;
      }
    } catch {}

    const possible = [
      window.supabaseClient,
      window.faizanSupabase,
      window.supabaseDb,
      window.sbClient
    ];

    return possible.find(item => item?.auth?.getSession) || null;
  }

  async function getClient() {
    if (client?.auth?.getSession) return client;

    const existing = findExistingSupabaseClient();

    if (existing) {
      client = existing;
      window.faizanAuthClient = client;
      return client;
    }

    if (!window.supabase?.createClient) {
      await loadScript(SUPABASE_CDN);
    }

    if (!window.supabase?.createClient) {
      throw new Error('Authentication could not be initialized.');
    }

    client = window.supabase.createClient(
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

    window.faizanAuthClient = client;

    return client;
  }

  /* -----------------------------
     Profile API
  ----------------------------- */

  async function getAccessToken() {
    const supabase = await getClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    return data?.session?.access_token || '';
  }

  async function profileRequest(method = 'GET', body) {
    const token = await getAccessToken();

    if (!token) {
      throw new Error('Please log in first.');
    }

    const response = await fetch('/api/profile', {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data?.error ||
        data?.message ||
        `Profile request failed (${response.status})`
      );
      error.status = response.status;
      throw error;
    }

    return data;
  }

  async function tryCreateOwnProfile(user, displayName) {
    const supabase = await getClient();

    try {
      const payload = {
        id: user.id,
        display_name: cleanName(displayName) || emailPrefix(user.email)
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;

      return payload;
    } catch (error) {
      console.warn('Profile auto-create was not available:', error);
      return null;
    }
  }

  async function loadProfile(user) {
    if (!user) return null;

    try {
      const data = await profileRequest('GET');
      return data?.profile || null;
    } catch (error) {
      if (error?.status === 403) {
        const fallbackName = displayNameFor(user, null);
        await tryCreateOwnProfile(user, fallbackName);

        try {
          const retry = await profileRequest('GET');
          return retry?.profile || null;
        } catch {}
      }

      return null;
    }
  }

  /* -----------------------------
     Global UI
  ----------------------------- */

  function ensureUi() {
    if ($('#fy-auth-ui')) return;

    const shell = document.createElement('div');
    shell.id = 'fy-auth-ui';

    shell.innerHTML = `
      <div class="fy-auth-modal" id="fy-auth-modal" hidden>
        <button
          class="fy-auth-backdrop"
          type="button"
          data-auth-close
          aria-label="Close account dialog"
        ></button>

        <section
          class="fy-auth-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fy-auth-dialog-title"
        >
          <div class="fy-auth-dialog-head">
            <div>
              <span class="fy-auth-kicker" id="fy-auth-kicker">ACCOUNT</span>
              <h2 id="fy-auth-dialog-title">Welcome</h2>
            </div>

            <button
              class="fy-auth-x"
              type="button"
              data-auth-close
              aria-label="Close"
            >×</button>
          </div>

          <div class="fy-auth-tabs" id="fy-auth-tabs">
            <button type="button" data-auth-tab="login" class="active">Login</button>
            <button type="button" data-auth-tab="signup">Sign Up</button>
          </div>

          <div class="fy-auth-message" id="fy-auth-message" hidden></div>

          <form class="fy-auth-form" id="fy-login-form" data-auth-panel="login">
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
                  minlength="8"
                  required
                  placeholder="Your password"
                >
                <button type="button" data-toggle-password>Show</button>
              </div>
            </label>

            <button class="fy-auth-submit" type="submit">Login</button>

            <button
              class="fy-auth-text-button"
              type="button"
              data-auth-open-panel="reset"
            >
              Forgot password?
            </button>
          </form>

          <form class="fy-auth-form" id="fy-signup-form" data-auth-panel="signup" hidden>
            <label>
              <span>Name</span>
              <input
                name="display_name"
                type="text"
                autocomplete="name"
                minlength="2"
                maxlength="50"
                required
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
                  minlength="8"
                  required
                  placeholder="At least 8 characters"
                >
                <button type="button" data-toggle-password>Show</button>
              </div>
            </label>

            <label>
              <span>Confirm password</span>
              <div class="fy-password-field">
                <input
                  name="confirm_password"
                  type="password"
                  autocomplete="new-password"
                  minlength="8"
                  required
                  placeholder="Repeat password"
                >
                <button type="button" data-toggle-password>Show</button>
              </div>
            </label>

            <button class="fy-auth-submit" type="submit">Create Account</button>

            <p class="fy-auth-fine">
              You may be asked to confirm your email before your first login.
            </p>
          </form>

          <form class="fy-auth-form" id="fy-reset-form" data-auth-panel="reset" hidden>
            <p class="fy-auth-panel-copy">
              Enter your account email and I’ll send a secure password recovery link.
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

            <button class="fy-auth-submit" type="submit">Send Recovery Link</button>

            <button
              class="fy-auth-text-button"
              type="button"
              data-auth-open-panel="login"
            >
              Back to login
            </button>
          </form>

          <form class="fy-auth-form" id="fy-name-form" data-auth-panel="name" hidden>
            <p class="fy-auth-panel-copy">
              This name is used for your account and community profile.
            </p>

            <label>
              <span>Name</span>
              <input
                name="display_name"
                type="text"
                autocomplete="name"
                minlength="2"
                maxlength="50"
                required
              >
            </label>

            <button class="fy-auth-submit" type="submit">Save Name</button>
          </form>

          <form class="fy-auth-form" id="fy-email-form" data-auth-panel="email" hidden>
            <p class="fy-auth-panel-copy">
              Supabase may require confirmation from your current or new email address.
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

            <button class="fy-auth-submit" type="submit">Change Email</button>
          </form>

          <form class="fy-auth-form" id="fy-password-form" data-auth-panel="password" hidden>
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
                <button type="button" data-toggle-password>Show</button>
              </div>
            </label>

            <label>
              <span>Confirm new password</span>
              <div class="fy-password-field">
                <input
                  name="confirm_password"
                  type="password"
                  autocomplete="new-password"
                  minlength="8"
                  required
                  placeholder="Repeat new password"
                >
                <button type="button" data-toggle-password>Show</button>
              </div>
            </label>

            <button class="fy-auth-submit" type="submit">Update Password</button>
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

    document.body.appendChild(shell);

    bindModalEvents();
  }

  function findHeaderNav() {
    return $('.topbar .nav') || $('header .nav') || $('.nav');
  }

  function ensureNavRoot() {
    let root = $('#fy-auth-nav');

    if (root) return root;

    const nav = findHeaderNav();
    if (!nav) return null;

    root = document.createElement('div');
    root.id = 'fy-auth-nav';
    root.className = 'fy-auth-nav';
    root.setAttribute('aria-label', 'Account');

    const menu = $('.menu', nav);

    if (menu) {
      nav.insertBefore(root, menu);
    } else {
      nav.appendChild(root);
    }

    return root;
  }

  function renderNav() {
    const root = ensureNavRoot();
    if (!root) return;

    if (!currentUser) {
      root.innerHTML = `
        <button class="fy-auth-login" type="button" data-open-auth="login">
          Login
        </button>
        <button class="fy-auth-signup" type="button" data-open-auth="signup">
          Sign Up
        </button>
      `;

      return;
    }

    const name = displayNameFor(currentUser, currentProfile);
    const email = currentUser.email || currentProfile?.email || '';
    const initials = initialsFor(name);
    const isAdmin = currentProfile?.role === 'admin';

    root.innerHTML = `
      <div class="fy-account">
        <button
          class="fy-account-trigger"
          type="button"
          aria-expanded="false"
          aria-controls="fy-account-menu"
        >
          <span class="fy-account-avatar">${escapeHtml(initials)}</span>
          <span class="fy-account-trigger-text">Account</span>
          <span class="fy-account-chevron" aria-hidden="true">⌄</span>
        </button>

        <div class="fy-account-menu" id="fy-account-menu" hidden>
          <div class="fy-account-summary">
            <span class="fy-account-avatar large">${escapeHtml(initials)}</span>
            <div>
              <strong>${escapeHtml(name)}</strong>
              <small>${escapeHtml(email)}</small>
            </div>
          </div>

          <div class="fy-account-divider"></div>

          <button type="button" data-account-action="name">
            <span>Edit name</span>
            <b>↗</b>
          </button>

          <button type="button" data-account-action="email">
            <span>Change email</span>
            <b>↗</b>
          </button>

          <button type="button" data-account-action="password">
            <span>Change password</span>
            <b>↗</b>
          </button>

          ${isAdmin ? `
            <a class="fy-account-admin" href="/admin/">
              <span>Admin dashboard</span>
              <b>↗</b>
            </a>
          ` : ''}

          <div class="fy-account-divider"></div>

          <button class="fy-account-logout" type="button" data-account-action="logout">
            <span>Logout</span>
            <b>→</b>
          </button>
        </div>
      </div>
    `;
  }

  /* -----------------------------
     Modal
  ----------------------------- */

  const panelMeta = {
    login: {
      kicker: 'ACCOUNT',
      title: 'Welcome back',
      showTabs: true
    },
    signup: {
      kicker: 'CREATE ACCOUNT',
      title: 'Join the site',
      showTabs: true
    },
    reset: {
      kicker: 'RECOVERY',
      title: 'Reset password',
      showTabs: false
    },
    name: {
      kicker: 'ACCOUNT SETTINGS',
      title: 'Change your name',
      showTabs: false
    },
    email: {
      kicker: 'ACCOUNT SETTINGS',
      title: 'Change your email',
      showTabs: false
    },
    password: {
      kicker: 'ACCOUNT SETTINGS',
      title: 'Change password',
      showTabs: false
    }
  };

  function showMessage(message = '', type = 'info') {
    const box = $('#fy-auth-message');
    if (!box) return;

    if (!message) {
      box.hidden = true;
      box.textContent = '';
      box.removeAttribute('data-type');
      return;
    }

    box.textContent = message;
    box.dataset.type = type;
    box.hidden = false;
  }

  function showPanel(panelName) {
    const modal = $('#fy-auth-modal');
    if (!modal) return;

    const meta = panelMeta[panelName] || panelMeta.login;

    $$('.fy-auth-form', modal).forEach(panel => {
      panel.hidden = panel.dataset.authPanel !== panelName;
    });

    const tabs = $('#fy-auth-tabs', modal);
    if (tabs) tabs.hidden = !meta.showTabs;

    $$('[data-auth-tab]', modal).forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.authTab === panelName
      );
    });

    const kicker = $('#fy-auth-kicker', modal);
    const title = $('#fy-auth-dialog-title', modal);

    if (kicker) kicker.textContent = meta.kicker;
    if (title) title.textContent = meta.title;

    if (panelName === 'name') {
      const input = $('#fy-name-form input[name="display_name"]');
      if (input) input.value = displayNameFor(currentUser, currentProfile);
    }

    if (panelName === 'email') {
      const input = $('#fy-email-form input[name="email"]');
      if (input) input.value = currentUser?.email || '';
    }

    showMessage();
  }

  function openModal(panel = 'login') {
    ensureUi();

    const modal = $('#fy-auth-modal');
    if (!modal) return;

    showPanel(panel);

    modal.hidden = false;
    document.body.classList.add('fy-auth-modal-open');

    requestAnimationFrame(() => {
      modal.classList.add('open');

      const input = $(`[data-auth-panel="${panel}"] input`, modal);
      input?.focus({ preventScroll: true });
    });
  }

  function closeModal() {
    const modal = $('#fy-auth-modal');
    if (!modal || modal.hidden) return;

    modal.classList.remove('open');
    document.body.classList.remove('fy-auth-modal-open');

    window.setTimeout(() => {
      modal.hidden = true;
      showMessage();
    }, 160);
  }

  function toggleAccountMenu(force) {
    const menu = $('#fy-account-menu');
    const trigger = $('.fy-account-trigger');

    if (!menu || !trigger) return;

    const shouldOpen =
      typeof force === 'boolean'
        ? force
        : menu.hidden;

    menu.hidden = !shouldOpen;
    trigger.setAttribute('aria-expanded', String(shouldOpen));
  }

  function toast(message, type = 'success') {
    const box = $('#fy-auth-toast');
    if (!box) return;

    box.textContent = message;
    box.dataset.type = type;
    box.hidden = false;

    clearTimeout(toast.timer);

    toast.timer = window.setTimeout(() => {
      box.classList.remove('show');

      window.setTimeout(() => {
        box.hidden = true;
      }, 170);
    }, 3800);

    requestAnimationFrame(() => box.classList.add('show'));
  }

  /* -----------------------------
     Auth actions
  ----------------------------- */

  async function refreshUser(sessionOverride) {
    const supabase = await getClient();

    let user = sessionOverride?.user || null;

    if (!user) {
      const { data, error } = await supabase.auth.getUser();

      if (!error) user = data?.user || null;
    }

    currentUser = user;
    currentProfile = user ? await loadProfile(user) : null;

    renderNav();

    window.dispatchEvent(
      new CustomEvent('faizan-auth-changed', {
        detail: {
          user: currentUser,
          profile: currentProfile
        }
      })
    );
  }

  async function handleLogin(form) {
    const submit = $('button[type="submit"]', form);
    const formData = new FormData(form);

    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');

    setButtonBusy(submit, true, 'Logging in…');
    showMessage();

    try {
      const supabase = await getClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await refreshUser(data?.session);

      form.reset();
      closeModal();
      toast('Logged in successfully.');
    } catch (error) {
      showMessage(friendlyError(error), 'error');
    } finally {
      setButtonBusy(submit, false);
    }
  }

  async function handleSignup(form) {
    const submit = $('button[type="submit"]', form);
    const formData = new FormData(form);

    const displayName = cleanName(formData.get('display_name'));
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirm_password') || '');

    if (displayName.length < 2) {
      showMessage('Please enter your name.', 'error');
      return;
    }

    if (password.length < 8) {
      showMessage('Password must be at least 8 characters.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showMessage('Passwords do not match.', 'error');
      return;
    }

    setButtonBusy(submit, true, 'Creating account…');
    showMessage();

    try {
      const supabase = await getClient();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      if (data?.session && data?.user) {
        await tryCreateOwnProfile(data.user, displayName);
        await refreshUser(data.session);

        form.reset();
        closeModal();
        toast('Account created. You are now logged in.');
      } else {
        form.reset();
        showPanel('login');
        showMessage(
          'Account created. Check your email to confirm it, then log in.',
          'success'
        );
      }
    } catch (error) {
      showMessage(friendlyError(error), 'error');
    } finally {
      setButtonBusy(submit, false);
    }
  }

  async function handleReset(form) {
    const submit = $('button[type="submit"]', form);
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim().toLowerCase();

    setButtonBusy(submit, true, 'Sending…');
    showMessage();

    try {
      const supabase = await getClient();

      const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/`
        }
      );

      if (error) throw error;

      form.reset();
      showMessage(
        'Recovery email sent. Open the link in your inbox to continue.',
        'success'
      );
    } catch (error) {
      showMessage(friendlyError(error), 'error');
    } finally {
      setButtonBusy(submit, false);
    }
  }

  async function handleNameChange(form) {
    if (!currentUser) return;

    const submit = $('button[type="submit"]', form);
    const formData = new FormData(form);
    const displayName = cleanName(formData.get('display_name'));

    if (displayName.length < 2) {
      showMessage('Name must be at least 2 characters.', 'error');
      return;
    }

    setButtonBusy(submit, true, 'Saving…');
    showMessage();

    try {
      const supabase = await getClient();

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          ...currentUser.user_metadata,
          display_name: displayName
        }
      });

      if (metadataError) throw metadataError;

      try {
        const data = await profileRequest('PATCH', {
          display_name: displayName
        });

        currentProfile = data?.profile || currentProfile;
      } catch (profileError) {
        await tryCreateOwnProfile(currentUser, displayName);

        try {
          const retry = await profileRequest('PATCH', {
            display_name: displayName
          });

          currentProfile = retry?.profile || currentProfile;
        } catch {
          currentProfile = {
            ...(currentProfile || {}),
            display_name: displayName
          };
        }
      }

      const { data: userData } = await supabase.auth.getUser();
      currentUser = userData?.user || currentUser;

      renderNav();
      closeModal();
      toast('Name updated.');
    } catch (error) {
      showMessage(friendlyError(error), 'error');
    } finally {
      setButtonBusy(submit, false);
    }
  }

  async function handleEmailChange(form) {
    if (!currentUser) return;

    const submit = $('button[type="submit"]', form);
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim().toLowerCase();

    if (!email) {
      showMessage('Enter a valid email address.', 'error');
      return;
    }

    if (email === String(currentUser.email || '').toLowerCase()) {
      showMessage('This is already your current email.', 'error');
      return;
    }

    setButtonBusy(submit, true, 'Updating…');
    showMessage();

    try {
      const supabase = await getClient();

      const { error } = await supabase.auth.updateUser({
        email
      });

      if (error) throw error;

      closeModal();
      toast(
        'Email change requested. Check your inbox for any confirmation email.'
      );
    } catch (error) {
      showMessage(friendlyError(error), 'error');
    } finally {
      setButtonBusy(submit, false);
    }
  }

  async function handlePasswordChange(form) {
    if (!currentUser) return;

    const submit = $('button[type="submit"]', form);
    const formData = new FormData(form);

    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirm_password') || '');

    if (password.length < 8) {
      showMessage('Password must be at least 8 characters.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showMessage('Passwords do not match.', 'error');
      return;
    }

    setButtonBusy(submit, true, 'Updating…');
    showMessage();

    try {
      const supabase = await getClient();

      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) throw error;

      form.reset();
      closeModal();
      toast('Password updated successfully.');
    } catch (error) {
      showMessage(friendlyError(error), 'error');
    } finally {
      setButtonBusy(submit, false);
    }
  }

  async function logout() {
    toggleAccountMenu(false);

    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      currentUser = null;
      currentProfile = null;

      renderNav();
      toast('You are logged out.');
    } catch (error) {
      toast(friendlyError(error), 'error');
    }
  }

  /* -----------------------------
     Event binding
  ----------------------------- */

  function bindModalEvents() {
    const ui = $('#fy-auth-ui');
    if (!ui || ui.dataset.bound === 'true') return;

    ui.dataset.bound = 'true';

    ui.addEventListener('click', event => {
      const close = event.target.closest('[data-auth-close]');
      if (close) {
        closeModal();
        return;
      }

      const tab = event.target.closest('[data-auth-tab]');
      if (tab) {
        showPanel(tab.dataset.authTab);
        return;
      }

      const opener = event.target.closest('[data-auth-open-panel]');
      if (opener) {
        showPanel(opener.dataset.authOpenPanel);
        return;
      }

      const toggle = event.target.closest('[data-toggle-password]');
      if (toggle) {
        const wrap = toggle.closest('.fy-password-field');
        const input = $('input', wrap);

        if (!input) return;

        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        toggle.textContent = showing ? 'Show' : 'Hide';
      }
    });

    $('#fy-login-form')?.addEventListener('submit', event => {
      event.preventDefault();
      handleLogin(event.currentTarget);
    });

    $('#fy-signup-form')?.addEventListener('submit', event => {
      event.preventDefault();
      handleSignup(event.currentTarget);
    });

    $('#fy-reset-form')?.addEventListener('submit', event => {
      event.preventDefault();
      handleReset(event.currentTarget);
    });

    $('#fy-name-form')?.addEventListener('submit', event => {
      event.preventDefault();
      handleNameChange(event.currentTarget);
    });

    $('#fy-email-form')?.addEventListener('submit', event => {
      event.preventDefault();
      handleEmailChange(event.currentTarget);
    });

    $('#fy-password-form')?.addEventListener('submit', event => {
      event.preventDefault();
      handlePasswordChange(event.currentTarget);
    });
  }

  function bindDocumentEvents() {
    if (document.documentElement.dataset.faizanAuthEvents === 'true') return;

    document.documentElement.dataset.faizanAuthEvents = 'true';

    document.addEventListener('click', event => {
      const authOpen = event.target.closest('[data-open-auth]');
      if (authOpen) {
        openModal(authOpen.dataset.openAuth || 'login');
        return;
      }

      const trigger = event.target.closest('.fy-account-trigger');
      if (trigger) {
        event.stopPropagation();
        toggleAccountMenu();
        return;
      }

      const action = event.target.closest('[data-account-action]');
      if (action) {
        event.stopPropagation();

        const type = action.dataset.accountAction;
        toggleAccountMenu(false);

        if (type === 'logout') {
          logout();
        } else if (['name', 'email', 'password'].includes(type)) {
          openModal(type);
        }

        return;
      }

      if (
        !event.target.closest('.fy-account') &&
        !event.target.closest('.fy-account-menu')
      ) {
        toggleAccountMenu(false);
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;

      const modal = $('#fy-auth-modal');

      if (modal && !modal.hidden) {
        closeModal();
      } else {
        toggleAccountMenu(false);
      }
    });
  }

  /* -----------------------------
     Init
  ----------------------------- */

  async function init() {
    loadCssOnce();
    ensureUi();
    ensureNavRoot();
    bindDocumentEvents();

    renderNav();

    try {
      const supabase = await getClient();

      const { data } = await supabase.auth.getSession();

      await refreshUser(data?.session || null);

      const result = supabase.auth.onAuthStateChange(
        (event, session) => {
          // Supabase recommends keeping callback work light.
          window.setTimeout(() => {
            refreshUser(session).catch(console.error);

            if (event === 'PASSWORD_RECOVERY') {
              openModal('password');
            }
          }, 0);
        }
      );

      authSubscription =
        result?.data?.subscription ||
        result?.subscription ||
        null;

      window.addEventListener(
        'pagehide',
        () => {
          authSubscription?.unsubscribe?.();
        },
        { once: true }
      );
    } catch (error) {
      console.error('Global auth UI failed to initialize:', error);
      renderNav();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
