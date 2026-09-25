# Faizan Yousufzai Portfolio - Flat URL Build

All public pages are flat `.html` files. No page requires a folder containing `index.html`.

Examples:
- `/services.html`
- `/contact.html`
- `/technical-seo.html`
- `/hanab-case-study.html`

For XAMPP, place the contents of this folder directly inside `C:/xampp/htdocs/` and open `http://localhost/`.
If you place the site in a subfolder, CSS/JS/images still work because asset paths are relative. The favicon block intentionally uses root-relative paths as requested.

The `.htaccess` file redirects previous folder-style URLs to the new `.html` URLs with 301 redirects.
