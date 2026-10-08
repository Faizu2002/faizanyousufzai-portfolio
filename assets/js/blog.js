(()=>{
  const menu=document.querySelector('.menu');
  const nav=document.querySelector('.navlinks');
  if(menu&&nav){
    menu.addEventListener('click',()=>{
      const open=nav.classList.toggle('open');
      menu.setAttribute('aria-expanded',String(open));
    });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
      nav.classList.remove('open');
      menu.setAttribute('aria-expanded','false');
    }));
  }

  document.querySelectorAll('[data-year]').forEach(el=>{
    el.textContent=new Date().getFullYear();
  });

  const bar=document.querySelector('.reading-progress');
  const article=document.querySelector('.prose');
  if(bar&&article){
    const update=()=>{
      const rect=article.getBoundingClientRect();
      const start=window.scrollY+rect.top;
      const range=Math.max(1,article.offsetHeight-window.innerHeight);
      const pct=Math.min(100,Math.max(0,((window.scrollY-start+120)/range)*100));
      bar.style.width=`${pct}%`;
    };
    window.addEventListener('scroll',update,{passive:true});
    window.addEventListener('resize',update);
    update();
  }

  const tocLinks=[...document.querySelectorAll('.toc a[href^="#"]')];
  const headings=[...document.querySelectorAll('.prose h2[id], .prose h3[id]')];
  if(tocLinks.length&&headings.length&&'IntersectionObserver' in window){
    const map=new Map(tocLinks.map(a=>[a.getAttribute('href').slice(1),a]));
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting);
      if(!visible.length)return;
      tocLinks.forEach(a=>a.classList.remove('active'));
      const active=map.get(visible[0].target.id);
      if(active)active.classList.add('active');
    },{rootMargin:'-20% 0px -70% 0px'});
    headings.forEach(h=>observer.observe(h));
  }
})();

/* =========================================================
   GLOBAL AUTH LOADER
   Paste this ONCE at the END of:
   1) /assets/js/main.js
   2) /assets/js/blog.js
========================================================= */

(() => {
  if (
    window.__FAIZAN_AUTH_LOADER__ ||
    document.querySelector('script[data-faizan-auth-ui]')
  ) return;

  window.__FAIZAN_AUTH_LOADER__ = true;

  const script = document.createElement('script');
  script.src = '/assets/js/auth-ui.js';
  script.dataset.faizanAuthUi = 'true';
  document.head.appendChild(script);
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


/* __SITE_BANNER_ADS__: no pop-under */
(() => {
  if (document.querySelector("script[data-faizan-site-ads]")) return;
  const script = document.createElement("script");
  script.src = "/assets/js/site-ads.js";
  script.setAttribute("data-faizan-site-ads", "");
  document.head.appendChild(script);
})();
