const DEFAULT_SUPABASE_URL = 'https://xuzolqglwlgvsazlojsy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vP0WCXtMMSbgsnXmwjVLFQ_qleCkmhr';

const STATIC_BLOGS = [
  { slug: 'backlink-strategy-built-around-relevance', title: 'Backlink Strategy: Build Relevant Links Without Chasing Metrics' },
  { slug: 'content-for-ai-search', title: 'Content for AI Search: How to Write for AI Overviews and Answer Engines' },
  { slug: 'how-to-fix-core-web-vitals-in-2026', title: 'Core Web Vitals in 2026: How to Fix LCP, INP and CLS' },
  { slug: 'local-maps-seo', title: 'Local Maps SEO: How to Improve Google Maps Visibility' },
  { slug: 'local-search-seo', title: 'Local Search SEO: A Practical Guide to Better Local Visibility' },
  { slug: 'local-seo-analysis', title: 'Local SEO Analysis: A Step-by-Step Audit for Better Visibility' },
  { slug: 'local-seo-for-trades', title: 'Local SEO for Trades: A Simple Plan for More Local Leads' },
  { slug: 'local-seo-ranking', title: 'Local SEO Ranking: How to Improve Local Search Positions' },
  { slug: 'local-seo-tactics', title: 'Local SEO Tactics That Build Real Local Visibility' },
  { slug: 'local-seo-vs-traditional-seo', title: 'Local SEO vs Traditional SEO: What Is the Real Difference?' },
  { slug: 'schema-markup-practical-guide', title: 'Schema Markup: A Practical Guide for Service and Personal Websites' },
  { slug: 'seo-friendly-website-migration', title: 'SEO-Friendly Website Migration: Redesign Without Losing Search Visibility' },
  { slug: 'static-site-cms', title: 'Static Site CMS: How to Manage Content Without a Heavy Website' },
  { slug: 'technical-seo-checklist-small-websites', title: 'Technical SEO Checklist for Small Websites: 2026 Guide' }
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/chat' && request.method === 'POST') return handleChat(request, env);

      if (url.pathname === '/api/profile') return handleProfile(request, env);
      if (url.pathname === '/api/community/comments') return handleCommunityComments(request, env);
      if (url.pathname === '/api/community/likes') return handleCommunityLikes(request, env);
      if (url.pathname === '/api/admin/stats') return handleAdminStats(request, env);
      if (url.pathname === '/api/admin/users') return handleAdminUsers(request, env);
      if (url.pathname === '/api/admin/comments') return handleAdminComments(request, env);
      if (url.pathname === '/api/admin/posts') return handleAdminPosts(request, env);
      if (url.pathname === '/api/admin/posts/import') return handleImportPost(request, env);

      if (url.pathname === '/blog/' || url.pathname === '/blog') return handleBlogIndex(request, env);
      if (url.pathname === '/sitemap.xml') return handleSitemap(request, env);

      const blogMatch = url.pathname.match(/^\/blog\/([a-z0-9-]+)\/?$/i);
      if (blogMatch) {
        const dynamic = await getPostBySlug(env, blogMatch[1]);
        if (dynamic) {
          if (dynamic.status !== 'published') return notFoundHtml();
          return html(renderPost(dynamic), 200);
        }
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.log('Worker error', error);
      if (url.pathname.startsWith('/api/')) return json({ error: safeError(error) }, 500);
      return new Response('Server error', { status: 500 });
    }
  }
};

function supabaseUrl(env) {
  return (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
}

async function db(env, table, { method = 'GET', query = {}, body, headers = {} } = {}) {
  if (!env.SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY is missing in Cloudflare.');
  const url = new URL(`${supabaseUrl(env)}/rest/v1/${table}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const res = await fetch(url, {
    method,
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(body !== undefined && method !== 'GET' ? { Prefer: 'return=representation' } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new Error(data?.message || data?.error || `Database request failed (${res.status})`);
  return data;
}

async function authAdmin(env, path, { method = 'GET', body } = {}) {
  if (!env.SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY is missing in Cloudflare.');
  const res = await fetch(`${supabaseUrl(env)}/auth/v1${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `Auth admin request failed (${res.status})`);
  return data;
}

async function getAuthUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const res = await fetch(`${supabaseUrl(env)}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

async function getProfileById(env, id) {
  const rows = await db(env, 'profiles', { query: { select: 'id,display_name,avatar_url,role,is_banned,created_at', id: `eq.${id}`, limit: 1 } });
  return rows?.[0] || null;
}

async function requireUser(request, env) {
  const user = await getAuthUser(request, env);
  if (!user) throw httpError(401, 'Please log in first.');
  const profile = await getProfileById(env, user.id);
  if (!profile) throw httpError(403, 'User profile not found.');
  return { user, profile };
}

async function requireAdmin(request, env) {
  const session = await requireUser(request, env);
  if (session.profile.role !== 'admin' || session.profile.is_banned) throw httpError(403, 'Admin access required.');
  return session;
}

async function handleProfile(request, env) {
  try {
    const { user, profile } = await requireUser(request, env);
    if (request.method === 'GET') return json({ profile: { ...profile, email: user.email || '' } });
    if (request.method === 'PATCH') {
      const body = await readBody(request);
      const name = cleanText(body.display_name, 50);
      if (name.length < 2) return json({ error: 'Display name must be at least 2 characters.' }, 400);
      const rows = await db(env, 'profiles', { method: 'PATCH', query: { id: `eq.${user.id}` }, body: { display_name: name } });
      return json({ profile: rows?.[0] || { ...profile, display_name: name } });
    }
    return methodNotAllowed();
  } catch (e) { return apiError(e); }
}

async function handleCommunityComments(request, env) {
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const slug = validSlug(url.searchParams.get('post_slug'));
      if (!slug) return json({ error: 'Invalid post.' }, 400);
      const user = await getAuthUser(request, env);
      const query = { select: 'id,user_id,post_slug,comment_text,status,created_at,updated_at', post_slug: `eq.${slug}`, order: 'created_at.desc', limit: 100 };
      if (user) query.or = `(status.eq.approved,user_id.eq.${user.id})`;
      else query.status = 'eq.approved';
      const comments = await db(env, 'comments', { query });
      const ids = [...new Set((comments || []).map(c => c.user_id).filter(Boolean))];
      let profiles = [];
      if (ids.length) profiles = await db(env, 'profiles', { query: { select: 'id,display_name,avatar_url', id: `in.(${ids.join(',')})` } });
      const map = new Map((profiles || []).map(p => [p.id, p]));
      return json({ comments: (comments || []).map(c => ({
        id: c.id,
        comment_text: c.comment_text,
        status: c.status,
        created_at: c.created_at,
        updated_at: c.updated_at,
        display_name: map.get(c.user_id)?.display_name || 'Member',
        avatar_url: map.get(c.user_id)?.avatar_url || null,
        can_edit: !!user && c.user_id === user.id && c.status === 'pending',
        can_delete: !!user && c.user_id === user.id
      })) });
    }

    const { user, profile } = await requireUser(request, env);
    if (profile.is_banned) return json({ error: 'Your account cannot post comments.' }, 403);

    if (request.method === 'POST') {
      const body = await readBody(request);
      const slug = validSlug(body.post_slug);
      const text = cleanText(body.comment_text, 1500, true);
      if (!slug || text.length < 3) return json({ error: 'Please write a valid comment.' }, 400);
      const recent = await db(env, 'comments', { query: { select: 'created_at', user_id: `eq.${user.id}`, order: 'created_at.desc', limit: 1 } });
      if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < 15000) return json({ error: 'Please wait a few seconds before posting again.' }, 429);
      const rows = await db(env, 'comments', { method: 'POST', body: { user_id: user.id, post_slug: slug, comment_text: text, status: 'pending' } });
      return json({ comment: rows?.[0], message: 'Comment submitted for review.' }, 201);
    }

    if (request.method === 'PATCH') {
      const body = await readBody(request);
      const id = validUuid(body.id);
      const text = cleanText(body.comment_text, 1500, true);
      if (!id || text.length < 3) return json({ error: 'Invalid comment.' }, 400);
      const rows = await db(env, 'comments', { query: { select: 'id,user_id,status', id: `eq.${id}`, limit: 1 } });
      const c = rows?.[0];
      if (!c || c.user_id !== user.id || c.status !== 'pending') return json({ error: 'Only your pending comment can be edited.' }, 403);
      const out = await db(env, 'comments', { method: 'PATCH', query: { id: `eq.${id}` }, body: { comment_text: text, updated_at: new Date().toISOString() } });
      return json({ comment: out?.[0] });
    }

    if (request.method === 'DELETE') {
      const body = await readBody(request);
      const id = validUuid(body.id);
      if (!id) return json({ error: 'Invalid comment.' }, 400);
      const rows = await db(env, 'comments', { query: { select: 'id,user_id', id: `eq.${id}`, limit: 1 } });
      if (!rows?.[0] || rows[0].user_id !== user.id) return json({ error: 'You can only delete your own comment.' }, 403);
      await db(env, 'comments', { method: 'DELETE', query: { id: `eq.${id}` } });
      return json({ ok: true });
    }
    return methodNotAllowed();
  } catch (e) { return apiError(e); }
}

async function handleCommunityLikes(request, env) {
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const slug = validSlug(url.searchParams.get('post_slug'));
      if (!slug) return json({ error: 'Invalid post.' }, 400);
      const likes = await db(env, 'likes', { query: { select: 'id,user_id', post_slug: `eq.${slug}`, limit: 5000 } });
      const user = await getAuthUser(request, env);
      return json({ count: likes?.length || 0, liked: !!user && (likes || []).some(x => x.user_id === user.id) });
    }
    if (request.method === 'POST') {
      const { user, profile } = await requireUser(request, env);
      if (profile.is_banned) return json({ error: 'Your account cannot like posts.' }, 403);
      const body = await readBody(request);
      const slug = validSlug(body.post_slug);
      if (!slug) return json({ error: 'Invalid post.' }, 400);
      const existing = await db(env, 'likes', { query: { select: 'id', user_id: `eq.${user.id}`, post_slug: `eq.${slug}`, limit: 1 } });
      let liked;
      if (existing?.[0]) {
        await db(env, 'likes', { method: 'DELETE', query: { id: `eq.${existing[0].id}` } });
        liked = false;
      } else {
        await db(env, 'likes', { method: 'POST', body: { user_id: user.id, post_slug: slug } });
        liked = true;
      }
      const all = await db(env, 'likes', { query: { select: 'id', post_slug: `eq.${slug}`, limit: 5000 } });
      return json({ liked, count: all?.length || 0 });
    }
    return methodNotAllowed();
  } catch (e) { return apiError(e); }
}

async function handleAdminStats(request, env) {
  try {
    await requireAdmin(request, env);
    if (request.method !== 'GET') return methodNotAllowed();
    const [profiles, posts, comments, likes] = await Promise.all([
      db(env, 'profiles', { query: { select: 'id', limit: 5000 } }),
      db(env, 'posts', { query: { select: 'id,status', limit: 5000 } }),
      db(env, 'comments', { query: { select: 'id,status', limit: 5000 } }),
      db(env, 'likes', { query: { select: 'id', limit: 5000 } })
    ]);
    return json({ users: profiles?.length || 0, published_posts: (posts || []).filter(p => p.status === 'published').length + STATIC_BLOGS.filter(s => !(posts || []).some(p => p.slug === s.slug)).length, pending_comments: (comments || []).filter(c => c.status === 'pending').length, likes: likes?.length || 0 });
  } catch (e) { return apiError(e); }
}

async function handleAdminUsers(request, env) {
  try {
    const admin = await requireAdmin(request, env);
    if (request.method === 'GET') {
      const [authData, profiles] = await Promise.all([
        authAdmin(env, '/admin/users?page=1&per_page=1000'),
        db(env, 'profiles', { query: { select: 'id,display_name,role,is_banned,created_at', order: 'created_at.desc', limit: 5000 } })
      ]);
      const pmap = new Map((profiles || []).map(p => [p.id, p]));
      const users = (authData?.users || []).map(u => ({
        id: u.id,
        email: u.email || '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        display_name: pmap.get(u.id)?.display_name || u.user_metadata?.display_name || '',
        role: pmap.get(u.id)?.role || 'user',
        is_banned: !!pmap.get(u.id)?.is_banned || !!u.banned_until
      }));
      return json({ users });
    }
    if (request.method === 'POST') {
      const body = await readBody(request);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const displayName = cleanText(body.display_name, 50);
      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || displayName.length < 2) return json({ error: 'Enter a valid name, email and password.' }, 400);
      const user = await authAdmin(env, '/admin/users', { method: 'POST', body: { email, password, email_confirm: true, user_metadata: { display_name: displayName } } });
      return json({ user }, 201);
    }
    if (request.method === 'PATCH') {
      const body = await readBody(request);
      const id = validUuid(body.id);
      if (!id || id === admin.user.id) return json({ error: 'You cannot ban your own admin account.' }, 400);
      const banned = !!body.banned;
      await authAdmin(env, `/admin/users/${id}`, { method: 'PUT', body: { ban_duration: banned ? '876000h' : 'none' } });
      await db(env, 'profiles', { method: 'PATCH', query: { id: `eq.${id}` }, body: { is_banned: banned } });
      return json({ ok: true, banned });
    }
    if (request.method === 'DELETE') {
      const body = await readBody(request);
      const id = validUuid(body.id);
      if (!id || id === admin.user.id) return json({ error: 'You cannot delete your own admin account.' }, 400);
      await authAdmin(env, `/admin/users/${id}`, { method: 'DELETE', body: { should_soft_delete: false } });
      return json({ ok: true });
    }
    return methodNotAllowed();
  } catch (e) { return apiError(e); }
}

async function handleAdminComments(request, env) {
  try {
    await requireAdmin(request, env);
    if (request.method === 'GET') {
      const comments = await db(env, 'comments', { query: { select: 'id,user_id,post_slug,comment_text,status,created_at,updated_at', order: 'created_at.desc', limit: 1000 } });
      const ids = [...new Set((comments || []).map(c => c.user_id))];
      const profiles = ids.length ? await db(env, 'profiles', { query: { select: 'id,display_name', id: `in.(${ids.join(',')})` } }) : [];
      const map = new Map((profiles || []).map(p => [p.id, p]));
      return json({ comments: (comments || []).map(c => ({ ...c, display_name: map.get(c.user_id)?.display_name || 'Member' })) });
    }
    if (request.method === 'PATCH') {
      const body = await readBody(request);
      const id = validUuid(body.id);
      const status = ['pending', 'approved', 'spam'].includes(body.status) ? body.status : null;
      if (!id || !status) return json({ error: 'Invalid moderation action.' }, 400);
      const rows = await db(env, 'comments', { method: 'PATCH', query: { id: `eq.${id}` }, body: { status, updated_at: new Date().toISOString() } });
      return json({ comment: rows?.[0] });
    }
    if (request.method === 'DELETE') {
      const body = await readBody(request);
      const id = validUuid(body.id);
      if (!id) return json({ error: 'Invalid comment.' }, 400);
      await db(env, 'comments', { method: 'DELETE', query: { id: `eq.${id}` } });
      return json({ ok: true });
    }
    return methodNotAllowed();
  } catch (e) { return apiError(e); }
}

async function handleAdminPosts(request, env) {
  try {
    const admin = await requireAdmin(request, env);
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const slug = validSlug(url.searchParams.get('slug'));
      if (slug) {
        const rows = await db(env, 'posts', { query: { select: '*', slug: `eq.${slug}`, limit: 1 } });
        if (!rows?.[0]) return json({ error: 'Post not found.' }, 404);
        return json({ post: { ...rows[0], source: 'database' } });
      }
      const rows = await db(env, 'posts', { query: { select: '*', order: 'updated_at.desc', limit: 1000 } });
      const slugs = new Set((rows || []).map(p => p.slug));
      const staticRows = STATIC_BLOGS.filter(p => !slugs.has(p.slug)).map(p => ({ ...p, id: null, source: 'static', status: 'published', updated_at: null, created_at: null }));
      return json({ posts: [...(rows || []).map(p => ({ ...p, source: 'database' })), ...staticRows] });
    }
    if (request.method === 'POST' || request.method === 'PATCH') {
      const body = await readBody(request);
      const payload = validatePostPayload(body);
      if (payload.error) return json({ error: payload.error }, 400);
      const now = new Date().toISOString();
      if (request.method === 'POST') {
        const exists = await db(env, 'posts', { query: { select: 'id', slug: `eq.${payload.data.slug}`, limit: 1 } });
        if (exists?.length) return json({ error: 'That slug already exists.' }, 409);
        const rows = await db(env, 'posts', { method: 'POST', body: { ...payload.data, author_id: admin.user.id, published_at: payload.data.status === 'published' ? now : null, created_at: now, updated_at: now } });
        return json({ post: rows?.[0] }, 201);
      }
      const id = validUuid(body.id);
      if (!id) return json({ error: 'Invalid post.' }, 400);
      const old = await db(env, 'posts', { query: { select: 'id,published_at', id: `eq.${id}`, limit: 1 } });
      if (!old?.[0]) return json({ error: 'Post not found.' }, 404);
      const rows = await db(env, 'posts', { method: 'PATCH', query: { id: `eq.${id}` }, body: { ...payload.data, published_at: payload.data.status === 'published' ? (old[0].published_at || now) : null, updated_at: now } });
      return json({ post: rows?.[0] });
    }
    if (request.method === 'DELETE') {
      const body = await readBody(request);
      const id = validUuid(body.id);
      if (!id) return json({ error: 'Invalid post.' }, 400);
      await db(env, 'posts', { method: 'DELETE', query: { id: `eq.${id}` } });
      return json({ ok: true });
    }
    return methodNotAllowed();
  } catch (e) { return apiError(e); }
}

async function handleImportPost(request, env) {
  try {
    const admin = await requireAdmin(request, env);
    if (request.method !== 'POST') return methodNotAllowed();
    const body = await readBody(request);
    const slug = validSlug(body.slug);
    if (!slug || !STATIC_BLOGS.some(p => p.slug === slug)) return json({ error: 'Static post not found.' }, 404);
    const exists = await db(env, 'posts', { query: { select: '*', slug: `eq.${slug}`, limit: 1 } });
    if (exists?.[0]) return json({ post: exists[0] });
    const assetUrl = new URL(`/blog/${slug}`, request.url);
    const asset = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }));
    if (!asset.ok) return json({ error: 'Could not read the existing blog file.' }, 500);
    const source = await asset.text();
    const title = decodeHtml(extractTag(source, 'title') || STATIC_BLOGS.find(p => p.slug === slug)?.title || slug);
    const excerpt = decodeHtml(extractClassText(source, 'dek') || extractMetaDescription(source) || '');
    const content = extractArticleContent(source);
    if (!content) return json({ error: 'Existing article content could not be parsed.' }, 500);
    const metaTitle = title;
    const metaDescription = extractMetaDescription(source) || excerpt;
    const now = new Date().toISOString();
    const rows = await db(env, 'posts', { method: 'POST', body: { title, slug, excerpt, content, primary_keyword: slug.replace(/-/g, ' '), meta_title: metaTitle, meta_description: metaDescription, featured_image: 'https://faizanyousufzai.online/assets/images/og-home.jpg', status: 'published', author_id: admin.user.id, published_at: now, created_at: now, updated_at: now } });
    return json({ post: rows?.[0] }, 201);
  } catch (e) { return apiError(e); }
}

async function getPostBySlug(env, slug) {
  const rows = await db(env, 'posts', { query: { select: '*', slug: `eq.${slug}`, limit: 1 } });
  return rows?.[0] || null;
}

async function handleBlogIndex(request, env) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/blog/', request.url).toString(), request));
  if (!asset.ok || request.method !== 'GET') return asset;
  try {
    const posts = await db(env, 'posts', { query: { select: 'title,slug,excerpt,status,updated_at,published_at', status: 'eq.published', order: 'published_at.desc', limit: 50 } });
    if (!posts?.length) return asset;
    let text = await asset.text();
    const newPosts = posts.filter(p => !text.includes(`/blog/${p.slug}`));
    if (!newPosts.length) return html(text, 200, asset.headers);
    const cards = newPosts.map(p => `<article class="post-card"><span class="tag">Latest</span><h3><a href="/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h3><p>${escapeHtml(p.excerpt || '')}</p><a class="read" href="/blog/${escapeHtml(p.slug)}">Read article →</a></article>`).join('');
    const section = `<section class="cluster"><div class="wrap"><div class="cluster-head"><div><span class="eyebrow">New from the CMS</span><h2>Latest posts</h2></div><p>New articles published from the secure admin panel.</p></div><div class="blog-grid">${cards}</div></div></section>`;
    text = text.replace('</main>', `${section}</main>`);
    return html(text, 200, asset.headers);
  } catch (e) {
    console.log('Blog index injection failed', e);
    return asset;
  }
}

async function handleSitemap(request, env) {
  const asset = await env.ASSETS.fetch(request);
  if (!asset.ok || request.method !== 'GET') return asset;
  try {
    const posts = await db(env, 'posts', { query: { select: 'slug,status,updated_at,published_at', status: 'eq.published', limit: 1000 } });
    let xml = await asset.text();
    for (const p of posts || []) {
      const loc = `https://faizanyousufzai.online/blog/${p.slug}`;
      if (xml.includes(`<loc>${loc}</loc>`)) continue;
      const lastmod = (p.updated_at || p.published_at || new Date().toISOString()).slice(0, 10);
      xml = xml.replace('</urlset>', `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url></urlset>`);
    }
    return new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  } catch (e) {
    console.log('Sitemap injection failed', e);
    return asset;
  }
}

function validatePostPayload(body) {
  const title = cleanText(body.title, 180);
  const slug = validSlug(body.slug);
  const content = sanitizeAdminHtml(String(body.content || '')).trim();
  const status = ['draft', 'published'].includes(body.status) ? body.status : 'draft';
  if (title.length < 4) return { error: 'Title is too short.' };
  if (!slug) return { error: 'Use a clean lowercase slug with hyphens.' };
  if (content.replace(/<[^>]*>/g, '').trim().length < 50) return { error: 'Post content is too short.' };
  return { data: {
    title,
    slug,
    excerpt: cleanText(body.excerpt, 320, true),
    content,
    primary_keyword: cleanText(body.primary_keyword, 120),
    meta_title: cleanText(body.meta_title || title, 180),
    meta_description: cleanText(body.meta_description || body.excerpt, 320, true),
    featured_image: safeUrl(body.featured_image) || 'https://faizanyousufzai.online/assets/images/og-home.jpg',
    status
  } };
}

function renderPost(post) {
  const canonical = `https://faizanyousufzai.online/blog/${escapeHtml(post.slug)}`;
  const title = escapeHtml(post.meta_title || post.title);
  const h1 = escapeHtml(post.title);
  const desc = escapeHtml(post.meta_description || post.excerpt || '');
  const image = escapeHtml(safeUrl(post.featured_image) || 'https://faizanyousufzai.online/assets/images/og-home.jpg');
  const prepared = prepareContent(post.content || '');
  const published = (post.published_at || post.created_at || new Date().toISOString()).slice(0, 10);
  const modified = (post.updated_at || post.published_at || post.created_at || new Date().toISOString()).slice(0, 10);
  const read = Math.max(1, Math.round(stripTags(prepared.html).split(/\s+/).filter(Boolean).length / 200));
  const toc = prepared.headings.length ? `<aside class="toc"><b>On this page</b>${prepared.headings.map(h => `<a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>`).join('')}<a class="toc-cta" href="#community">Join the discussion</a></aside>` : '';
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.meta_description || post.excerpt || '', datePublished: published, dateModified: modified, author: { '@type': 'Person', name: 'Faizan Khan Yousufzai', url: 'https://faizanyousufzai.online/about' }, publisher: { '@type': 'Person', name: 'Faizan Khan Yousufzai' }, mainEntityOfPage: canonical, image });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${desc}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon-96x96.png" sizes="96x96" type="image/png"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="shortcut icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#0e1211"><meta property="og:type" content="article"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${image}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${desc}"><meta name="twitter:image" content="${image}"><link rel="stylesheet" href="/assets/css/blog.css"><link rel="stylesheet" href="/assets/css/community.css"><script type="application/ld+json">${schema.replace(/</g, '\\u003c')}</script></head><body><a class="skip-link" href="#main">Skip to content</a><div class="reading-progress" aria-hidden="true"></div>${blogHeader()}<main id="main"><section class="blog-hero"><div class="wrap"><span class="eyebrow">Blog</span><h1>${h1}</h1><p class="dek">${escapeHtml(post.excerpt || post.meta_description || '')}</p><div class="byline"><span>By <a href="/about">Faizan Khan Yousufzai</a></span><span>Updated ${escapeHtml(formatDateHuman(modified))}</span><span>${read} min read</span></div></div></section><section class="section"><div class="wrap"><div class="content-grid"><article class="prose">${prepared.html}</article>${toc}</div></div></section></main>${blogFooter()}<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script><script src="/assets/js/supabase-config.js"></script><script src="/assets/js/blog.js"></script><script src="/assets/js/community.js"></script></body></html>`;
}

function blogHeader() {
  return `<header class="topbar"><div class="wrap nav"><a aria-label="Faizan Yousufzai home" class="brand" href="/"><img alt="Faizan Yousufzai logo" height="45" src="/assets/images/faizan-logo.webp" width="45"><span>Faizan Yousufzai</span></a><nav aria-label="Main navigation" class="navlinks"><a href="/">Home</a><a href="/services">Services</a><a href="/portfolio">Case Studies</a><a href="/about">About</a><a aria-current="page" href="/blog/">Blog</a><a href="/tools/">Tools</a><a href="/contact">Contact</a></nav><a class="btn small" href="https://wa.me/923182203481" rel="noopener" target="_blank">Let's Talk <span class="arrow">↗</span></a><button aria-expanded="false" aria-label="Open navigation" class="menu">☰</button></div></header>`;
}

function blogFooter() {
  return `<footer class="footer"><div class="wrap"><div class="footer-grid"><div><a class="brand" href="/"><img alt="Faizan Yousufzai logo" height="65" src="/assets/images/faizan-logo.webp" width="65"><span>Faizan Yousufzai</span></a><p style="max-width:480px;margin-top:16px">SEO specialist and web developer focused on useful content, clean technical SEO, fast websites, and search-friendly structure.</p><div class="socials"><a aria-label="Facebook" class="social-link" href="https://www.facebook.com/faizan.khan.32265/" rel="me noopener" target="_blank"><img alt="" src="/assets/icons/facebook.svg"></a><a aria-label="LinkedIn" class="social-link" href="https://www.linkedin.com/in/faizan-usufzai" rel="me noopener" target="_blank"><img alt="" src="/assets/icons/linkedin.svg"></a><a aria-label="YouTube" class="social-link" href="https://youtube.com/@faizan-khan-yousufzai-seo?si=2aJzsXAuo_EF-E17" rel="me noopener" target="_blank"><img alt="" src="/assets/icons/youtube.svg"></a></div></div><div><h3>Explore</h3><p><a href="/about">About</a><br><a href="/portfolio">Case Studies</a><br><a href="/blog/">Blog</a><br><a href="/tools/">Free Tools</a><br><a href="/write-for-us">Write For Us</a></p></div><div><h3>Services</h3><p><a href="/technical-seo">Technical SEO</a><br><a href="/on-page-seo">On-Page SEO</a><br><a href="/off-page-seo">Off-Page SEO</a><br><a href="/web-development">Web Development</a><br><a href="/contact">Contact</a></p></div></div><div class="copyright">© <span data-year></span> Faizan Khan Yousufzai. Built with HTML, CSS and JavaScript. <a href="/privacy-policy">Privacy</a></div></div></footer>`;
}

function prepareContent(raw) {
  let html = sanitizeAdminHtml(raw);
  const used = new Set();
  let n = 0;
  html = html.replace(/<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, inner) => {
    n++;
    let idMatch = attrs.match(/\sid=["']([^"']+)["']/i);
    let id = idMatch ? idMatch[1] : slugify(stripTags(inner)) || `${tag}-${n}`;
    let base = id, i = 2;
    while (used.has(id)) id = `${base}-${i++}`;
    used.add(id);
    const cleanAttrs = attrs.replace(/\sid=["'][^"']+["']/i, '');
    return `<${tag}${cleanAttrs} id="${escapeHtml(id)}">${inner}</${tag}>`;
  });
  const headings = [];
  html.replace(/<(h2|h3)[^>]*\sid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi, (_, tag, id, inner) => {
    headings.push({ level: tag.toLowerCase(), id, text: decodeHtml(stripTags(inner)).trim() });
    return _;
  });
  return { html, headings };
}

function sanitizeAdminHtml(input) {
  let s = String(input || '');
  s = s.replace(/<(script|iframe|object|embed|form|input|button|textarea|select|option|style|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<(script|iframe|object|embed|form|input|button|textarea|select|option|style|link|meta)[^>]*\/?>/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  s = s.replace(/\sstyle\s*=\s*(["']).*?\1/gi, '');
  s = s.replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
  return s;
}

async function handleChat(request, env) {
  try {
    const body = await request.json();
    const message = String(body.message || '').trim();
    if (!message) return json({ error: 'Message required' }, 400);
    if (message.length > 1500) return json({ error: 'Message too long' }, 400);
    const prompt = `You are Ayra, the AI website assistant for Faizan Yousufzai.\n\nABOUT FAIZAN:\nFaizan Yousufzai is an SEO Specialist and Web Developer.\nWebsite: https://faizanyousufzai.online\nServices: Technical SEO, On-Page SEO, Off-Page SEO, SEO Audits, Keyword Research, Semantic SEO, Content Optimization, Schema Markup, Core Web Vitals, Website Speed Optimization, Web Development, WordPress Development, Responsive Website Development.\nProjects: HANAB.pk, ToolsForAll, FaizanYousufzai.online.\nContact: WhatsApp +92 318 2203481, LinkedIn https://www.linkedin.com/in/faizan-usufzai\n\nBe friendly, helpful and professional. Keep replies short unless more detail is needed. Never invent clients, rankings, revenue, years of experience or results. Current page: ${body.page || '/'}\nVisitor says: ${message}`;
    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 400 } }) });
    if (!geminiResponse.ok) { console.log(await geminiResponse.text()); return json({ error: 'Ayra is unavailable right now.' }, 500); }
    const data = await geminiResponse.json();
    return json({ reply: data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not answer that right now.' });
  } catch (error) { console.log(error); return json({ error: 'Something went wrong.' }, 500); }
}

function extractArticleContent(source) {
  const m = source.match(/<article[^>]*class=["'][^"']*\bprose\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/i);
  return m ? m[1].trim() : '';
}
function extractTag(source, tag) { const m = source.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')); return m ? stripTags(m[1]).trim() : ''; }
function extractClassText(source, cls) { const m = source.match(new RegExp(`<[^>]+class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i')); return m ? stripTags(m[1]).trim() : ''; }
function extractMetaDescription(source) {
  let m = source.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i);
  if (!m) m = source.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  return m ? decodeHtml(m[1]).trim() : '';
}
function stripTags(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function slugify(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 90); }
function decodeHtml(s) { return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' '); }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function cleanText(value, max = 200, multiline = false) { let s = String(value || '').replace(/\u0000/g, '').trim(); if (!multiline) s = s.replace(/\s+/g, ' '); return s.slice(0, max); }
function safeUrl(v) { const s = String(v || '').trim(); if (!s) return ''; try { const u = new URL(s, 'https://faizanyousufzai.online'); if (!['http:', 'https:'].includes(u.protocol)) return ''; return u.toString(); } catch { return ''; } }
function validSlug(v) { const s = String(v || '').trim().toLowerCase(); return /^[a-z0-9][a-z0-9-]{0,119}$/.test(s) ? s : null; }
function validUuid(v) { const s = String(v || '').trim(); return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null; }
function formatDateHuman(v) { try { return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(v)); } catch { return v; } }
function safeJson(text) { try { return JSON.parse(text); } catch { return { error: text.slice(0, 300) }; } }
async function readBody(request) { try { return await request.json(); } catch { return {}; } }
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
function safeError(e) { return e?.message || 'Something went wrong.'; }
function apiError(e) { return json({ error: safeError(e) }, e?.status || 500); }
function methodNotAllowed() { return json({ error: 'Method not allowed.' }, 405); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } }); }
function html(content, status = 200, baseHeaders = null) { const h = new Headers(baseHeaders || {}); h.delete('Content-Length'); h.delete('Content-Encoding'); h.delete('ETag'); h.set('Content-Type', 'text/html; charset=utf-8'); h.set('X-Content-Type-Options', 'nosniff'); h.set('Referrer-Policy', 'strict-origin-when-cross-origin'); h.set('X-Frame-Options', 'SAMEORIGIN'); h.set('Cache-Control', 'public, max-age=60'); return new Response(content, { status, headers: h }); }
function notFoundHtml() { return html('<!doctype html><html><head><meta name="robots" content="noindex"><title>Post not found</title></head><body><main><h1>Post not found</h1><p><a href="/blog/">Back to blog</a></p></main></body></html>', 404); }
