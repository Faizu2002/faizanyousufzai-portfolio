(()=>{
 const input=document.getElementById('dir-search');
 const grid=document.getElementById('dir-guides');
 if(!input||!grid)return;
 const cards=[...grid.querySelectorAll('.dir-guide')];
 const buttons=[...document.querySelectorAll('[data-filter]')];
 const counter=document.getElementById('dir-status');
 const pageText=document.getElementById('dir-page-status');
 const pageNav=document.getElementById('dir-pagination');
 const empty=document.getElementById('dir-empty');
 const clear=document.getElementById('dir-clear');
 const prev=document.getElementById('dir-prev');
 const next=document.getElementById('dir-next');
 const pageSize=12;
 const allowed=new Set(['all',...buttons.map(b=>b.dataset.filter)]);
 const params=new URLSearchParams(location.search);
 let category=allowed.has(params.get('category'))?params.get('category'):'all';
 let page=1;
 input.value=params.get('q')||'';
 function syncUrl(){
  const u=new URL(location.href);
  if(input.value.trim())u.searchParams.set('q',input.value.trim());else u.searchParams.delete('q');
  if(category!=='all')u.searchParams.set('category',category);else u.searchParams.delete('category');
  history.replaceState(null,'',u.pathname+u.search+u.hash);
 }
 function render(){
  const q=input.value.toLowerCase().trim();
  const matching=cards.filter(card=>(category==='all'||card.dataset.category===category)&&(!q||card.dataset.title.includes(q)));
  const pages=Math.max(1,Math.ceil(matching.length/pageSize));
  page=Math.min(Math.max(1,page),pages);
  const visible=new Set(matching.slice((page-1)*pageSize,page*pageSize));
  for(const c of cards)c.hidden=!visible.has(c);
  buttons.forEach(b=>{const active=b.dataset.filter===category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  empty.hidden=matching.length>0;
  pageNav.hidden=matching.length<=pageSize;
  prev.disabled=page===1;next.disabled=page===pages;
  pageText.textContent='Page '+page+' of '+pages;
  counter.textContent=matching.length?'Showing '+((page-1)*pageSize+1)+'–'+Math.min(page*pageSize,matching.length)+' of '+matching.length+' guides':'0 matching guides';
  clear.hidden=!input.value;
 }
 input.addEventListener('input',()=>{page=1;render();syncUrl()});
 buttons.forEach(b=>b.addEventListener('click',()=>{category=b.dataset.filter;page=1;render();syncUrl()}));
 clear.addEventListener('click',()=>{input.value='';page=1;render();syncUrl();input.focus()});
 prev.addEventListener('click',()=>{if(page>1){page--;render();document.getElementById('browse-guides').scrollIntoView({block:'start'});}});
 next.addEventListener('click',()=>{page++;render();document.getElementById('browse-guides').scrollIntoView({block:'start'});});
 render();
})();