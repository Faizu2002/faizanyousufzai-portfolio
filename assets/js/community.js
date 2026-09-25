(()=>{
  if(!window.getSupabase)return;
  const sb=window.getSupabase();
  const article=document.querySelector('.prose');
  const slug=location.pathname.replace(/^\/blog\//,'').replace(/\/$/,'').replace(/\.html$/,'');
  if(!article||!slug||slug==='index')return;

  const nav=document.querySelector('.navlinks');
  if(nav&&!nav.querySelector('[data-auth-nav]')){
    const a=document.createElement('a');a.href='/login/';a.textContent='Login';a.dataset.authNav='1';nav.appendChild(a);
    sb.auth.getSession().then(({data:{session}})=>{if(session){a.textContent='Account';a.href='/account/';}}).catch(()=>{});
  }

  const wrap=document.createElement('section');wrap.className='community';wrap.id='community';
  wrap.innerHTML=`<div class="community-card"><div class="community-head"><div><span class="eyebrow">Community</span><h2>Like & discuss</h2></div><button class="like-button" id="like-btn" type="button">♡ <span id="like-count">0</span> Likes</button></div><div class="community-message" id="community-message"></div><div id="comment-auth"></div><form class="comment-form" id="comment-form" hidden><textarea id="comment-text" maxlength="1500" placeholder="Add a helpful comment..." required></textarea><button class="btn" type="submit">Post comment</button><div class="comment-status">New comments are reviewed before they appear publicly.</div></form><div class="comment-list" id="comment-list"><div class="community-empty">Loading comments...</div></div></div>`;
  const related=document.querySelector('.related');
  if(related)related.parentNode.insertBefore(wrap,related);else article.parentNode.parentNode.appendChild(wrap);

  const likeBtn=document.getElementById('like-btn'),likeCount=document.getElementById('like-count'),authBox=document.getElementById('comment-auth'),form=document.getElementById('comment-form'),list=document.getElementById('comment-list'),msg=document.getElementById('community-message');
  let session=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const show=(text,type='ok')=>{msg.textContent=text;msg.className=`community-message show ${type}`;setTimeout(()=>msg.className='community-message',4000)};
  const api=async(path,options={})=>{const headers={'Content-Type':'application/json',...(options.headers||{})};if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;const r=await fetch(path,{...options,headers});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d};
  const date=v=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));

  async function loadSession(){const {data}=await sb.auth.getSession();session=data.session||null;if(session){form.hidden=false;authBox.innerHTML=`<div class="comment-login">Signed in as <strong>${esc(session.user.email||'member')}</strong>. <a href="/account/">Account</a></div>`;}else{form.hidden=true;authBox.innerHTML='<div class="comment-login"><a href="/login/?next='+encodeURIComponent(location.pathname)+'">Log in</a> or <a href="/signup/">create an account</a> to like and comment.</div>';}}
  async function loadLikes(){try{const d=await api(`/api/community/likes?post_slug=${encodeURIComponent(slug)}`);likeCount.textContent=d.count||0;likeBtn.classList.toggle('liked',!!d.liked);likeBtn.firstChild.nodeValue=d.liked?'♥ ':'♡ ';}catch{}}
  async function loadComments(){try{const d=await api(`/api/community/comments?post_slug=${encodeURIComponent(slug)}`);if(!d.comments?.length){list.innerHTML='<div class="community-empty">No comments yet. Start the discussion.</div>';return;}list.innerHTML=d.comments.map(c=>`<article class="comment-item" data-id="${esc(c.id)}"><div class="comment-meta"><span><span class="comment-name">${esc(c.display_name||'Member')}</span>${c.status&&c.status!=='approved'?`<span class="comment-badge">${esc(c.status)}</span>`:''}</span><time>${esc(date(c.created_at))}</time></div><p>${esc(c.comment_text)}</p>${c.can_edit||c.can_delete?`<div class="comment-actions">${c.can_edit?'<button type="button" data-edit>Edit</button>':''}${c.can_delete?'<button type="button" data-delete>Delete</button>':''}</div>`:''}</article>`).join('');}catch(err){list.innerHTML=`<div class="community-empty">${esc(err.message)}</div>`}}

  likeBtn.addEventListener('click',async()=>{if(!session){location.href='/login/?next='+encodeURIComponent(location.pathname);return;}likeBtn.disabled=true;try{const d=await api('/api/community/likes',{method:'POST',body:JSON.stringify({post_slug:slug})});likeCount.textContent=d.count;likeBtn.classList.toggle('liked',d.liked);likeBtn.firstChild.nodeValue=d.liked?'♥ ':'♡ ';}catch(err){show(err.message,'err')}finally{likeBtn.disabled=false}});
  form.addEventListener('submit',async e=>{e.preventDefault();const text=document.getElementById('comment-text').value.trim();if(text.length<3)return show('Comment is too short.','err');const btn=form.querySelector('button');btn.disabled=true;try{await api('/api/community/comments',{method:'POST',body:JSON.stringify({post_slug:slug,comment_text:text})});document.getElementById('comment-text').value='';show('Comment submitted for review.');await loadComments();}catch(err){show(err.message,'err')}finally{btn.disabled=false}});
  list.addEventListener('click',async e=>{const item=e.target.closest('.comment-item');if(!item)return;const id=item.dataset.id;if(e.target.matches('[data-delete]')){if(!confirm('Delete this comment?'))return;try{await api('/api/community/comments',{method:'DELETE',body:JSON.stringify({id})});await loadComments();}catch(err){show(err.message,'err')}}if(e.target.matches('[data-edit]')){const p=item.querySelector('p');const next=prompt('Edit comment:',p.textContent);if(next===null)return;try{await api('/api/community/comments',{method:'PATCH',body:JSON.stringify({id,comment_text:next.trim()})});await loadComments();}catch(err){show(err.message,'err')}}});

  (async()=>{await loadSession();await Promise.all([loadLikes(),loadComments()]);sb.auth.onAuthStateChange(async()=>{await loadSession();await Promise.all([loadLikes(),loadComments()])})})();
})();
