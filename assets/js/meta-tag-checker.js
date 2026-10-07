(() => {
  const htmlInput = document.getElementById('html-input');
  const pageUrl = document.getElementById('page-url');
  const analyzeButton = document.getElementById('analyze-meta');
  const resetButton = document.getElementById('reset-meta');
  const exampleButton = document.getElementById('load-example');
  const message = document.getElementById('tool-message');
  const results = document.getElementById('meta-results');

  if (!htmlInput || !analyzeButton || !results) return;

  const $ = (id) => document.getElementById(id);

  const getMeta = (doc, name) => {
    const el = [...doc.querySelectorAll('meta')].find((node) =>
      (node.getAttribute('name') || '').toLowerCase() === name.toLowerCase()
    );
    return el?.getAttribute('content')?.trim() || '';
  };

  const getProperty = (doc, property) => {
    const el = [...doc.querySelectorAll('meta')].find((node) =>
      (node.getAttribute('property') || '').toLowerCase() === property.toLowerCase()
    );
    return el?.getAttribute('content')?.trim() || '';
  };

  const textWidth = (text, font) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return 0;
    context.font = font;
    return Math.round(context.measureText(text || '').width);
  };

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const classifyTitle = (value) => {
    const n = [...value].length;
    if (!n) return {label:'Missing', type:'bad', score:0, advice:'Add a clear, unique title tag that matches the page topic.'};
    if (n < 30) return {label:'Short', type:'warn', score:65, advice:'The title is quite short. Check whether it clearly describes the page and main topic.'};
    if (n <= 60) return {label:'Good length', type:'good', score:100, advice:'The title is within a common review range. Now check clarity, intent and uniqueness.'};
    return {label:'Long', type:'warn', score:70, advice:'The title may be truncated or rewritten. Put the most useful wording near the beginning.'};
  };

  const classifyDescription = (value) => {
    const n = [...value].length;
    if (!n) return {label:'Missing', type:'bad', score:0, advice:'Add a useful description that explains the page and supports the search result snippet.'};
    if (n < 70) return {label:'Short', type:'warn', score:60, advice:'The description is short. Make sure it gives enough context and a reason to visit the page.'};
    if (n <= 160) return {label:'Good length', type:'good', score:100, advice:'The description is within a common review range. Check that it is specific and useful.'};
    return {label:'Long', type:'warn', score:70, advice:'The description may be shortened in search results. Keep the main message near the start.'};
  };

  const setStatus = (id, data) => {
    const el = $(id);
    el.textContent = data.label;
    el.className = 'mtc-status ' + data.type;
  };

  const setMeter = (id, percent, type) => {
    const el = $(id);
    el.style.width = Math.max(3, Math.min(100, percent)) + '%';
    el.dataset.state = type;
  };

  const normalizeUrl = (value) => {
    const raw = clean(value);
    if (!raw) return '';
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw).href;
    } catch {
      return raw;
    }
  };

  const siteLabel = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'Website';
    }
  };

  const analyze = () => {
    const source = htmlInput.value.trim();

    if (!source) {
      message.textContent = 'Paste some HTML first.';
      message.className = 'mtc-message error';
      results.hidden = true;
      return;
    }

    let doc;
    try {
      doc = new DOMParser().parseFromString(source, 'text/html');
    } catch {
      message.textContent = 'I could not read that HTML. Please paste the page source again.';
      message.className = 'mtc-message error';
      results.hidden = true;
      return;
    }

    const title = clean(doc.querySelector('title')?.textContent || '');
    const description = clean(getMeta(doc, 'description'));
    const canonical = clean(doc.querySelector('link[rel~="canonical"]')?.getAttribute('href') || '');
    const robots = clean(getMeta(doc, 'robots'));
    const viewport = clean(getMeta(doc, 'viewport'));
    const lang = clean(doc.documentElement?.getAttribute('lang') || '');
    const ogTitle = clean(getProperty(doc, 'og:title'));
    const ogDescription = clean(getProperty(doc, 'og:description'));

    const titleState = classifyTitle(title);
    const descriptionState = classifyDescription(description);
    const titleChars = [...title].length;
    const descriptionChars = [...description].length;
    const titlePixels = textWidth(title, '20px Arial');
    const descriptionPixels = textWidth(description, '14px Arial');

    $('title-value').textContent = title || 'No title found';
    $('description-value').textContent = description || 'No meta description found';
    $('title-chars').textContent = titleChars;
    $('description-chars').textContent = descriptionChars;
    $('title-pixels').textContent = titlePixels;
    $('description-pixels').textContent = descriptionPixels;
    $('title-advice').textContent = titleState.advice;
    $('description-advice').textContent = descriptionState.advice;

    setStatus('title-status', titleState);
    setStatus('description-status', descriptionState);
    setMeter('title-meter', titleChars / 60 * 100, titleState.type);
    setMeter('description-meter', descriptionChars / 160 * 100, descriptionState.type);

    $('canonical-value').textContent = canonical || 'Not found';
    $('robots-value').textContent = robots || 'Not found';
    $('viewport-value').textContent = viewport || 'Not found';
    $('lang-value').textContent = lang || 'Not found';
    $('og-title-value').textContent = ogTitle || 'Not found';
    $('og-description-value').textContent = ogDescription || 'Not found';

    const extras = [canonical, robots, viewport, lang].filter(Boolean).length;
    const score = Math.round(
      (titleState.score * 0.38) +
      (descriptionState.score * 0.38) +
      ((extras / 4) * 24)
    );

    $('overall-score').textContent = score;
    $('hero-score').textContent = score;

    const url = normalizeUrl(pageUrl.value) || canonical || 'https://example.com/page';
    $('preview-site').textContent = siteLabel(url);
    $('preview-url').textContent = url;
    $('preview-title').textContent = title || 'Your page title will appear here';
    $('preview-description').textContent = description || 'Your meta description will appear here after analysis.';

    message.textContent = 'Analysis complete. Review the results below.';
    message.className = 'mtc-message success';
    results.hidden = false;
    results.scrollIntoView({behavior:'smooth', block:'start'});
  };

  analyzeButton.addEventListener('click', analyze);

  resetButton?.addEventListener('click', () => {
    htmlInput.value = '';
    pageUrl.value = '';
    message.textContent = '';
    message.className = 'mtc-message';
    results.hidden = true;
    $('hero-score').textContent = '--';
    htmlInput.focus();
  });

  exampleButton?.addEventListener('click', () => {
    pageUrl.value = 'https://example.com/technical-seo-guide';
    htmlInput.value = `<!doctype html>
<html lang="en">
<head>
  <title>Technical SEO Guide: Crawl, Index & Fix Search Issues</title>
  <meta name="description" content="Learn how technical SEO helps search engines crawl and index your website. Review practical checks for robots, canonicals, redirects and page performance.">
  <meta name="robots" content="index,follow">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="canonical" href="https://example.com/technical-seo-guide">
  <meta property="og:title" content="Technical SEO Guide">
  <meta property="og:description" content="A practical technical SEO guide for better crawling and indexing.">
</head>
<body></body>
</html>`;
    message.textContent = 'Example loaded. Click “Analyze meta tags”.';
    message.className = 'mtc-message';
  });

  htmlInput.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') analyze();
  });
})();