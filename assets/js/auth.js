(()=>{
  const cfg=window.SITE_AUTH; const sb=window.getSupabase();
  const page=document.body.dataset.authPage||'';
  const requestedNext=new URLSearchParams(location.search).get('next');
  const safeNext=requestedNext&&requestedNext.startsWith('/')&&!requestedNext.startsWith('//')?requestedNext:null;
  const status=document.querySelector('[data-auth-status]');
  const show=(msg,type='ok')=>{if(!status)return;status.textContent=msg;status.className=`form-status show ${type}`;};
  const clear=()=>{if(status)status.className='form-status';};
  const token=()=>window.turnstileToken||'';
  const resetCaptcha=()=>{window.turnstileToken=''; if(window.turnstile&&window.turnstileWidgetId!==undefined){try{window.turnstile.reset(window.turnstileWidgetId)}catch{}}};
  window.onTurnstileSuccess=t=>{window.turnstileToken=t};
  window.onTurnstileExpired=()=>{window.turnstileToken=''};
  window.renderTurnstile=()=>{
    const el=document.getElementById('turnstile');
    if(!el||!window.turnstile)return;
    window.turnstileWidgetId=window.turnstile.render(el,{sitekey:cfg.turnstileSiteKey,callback:window.onTurnstileSuccess,'expired-callback':window.onTurnstileExpired,theme:'light'});
  };
  const api=async(path,options={})=>{
    const {data:{session}}=await sb.auth.getSession();
    const headers={'Content-Type':'application/json',...(options.headers||{})};
    if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
    const r=await fetch(path,{...options,headers}); const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Request failed'); return data;
  };

  if(page==='login'){
    const form=document.getElementById('login-form');
    form?.addEventListener('submit',async e=>{e.preventDefault();clear();const email=form.email.value.trim(),password=form.password.value;
      if(!token())return show('Please complete the security check.','err');
      const btn=form.querySelector('button[type=submit]');btn.disabled=true;
      const {error}=await sb.auth.signInWithPassword({email,password,options:{captchaToken:token()}});btn.disabled=false;resetCaptcha();
      if(error)return show(error.message,'err');
      try{const p=await api('/api/profile');location.href=p.profile?.role==='admin'?'/admin/':(safeNext||'/account/');}catch{location.href=safeNext||'/account/';}
    });
    document.getElementById('forgot-link')?.addEventListener('click',async e=>{e.preventDefault();clear();const email=form.email.value.trim();if(!email)return show('Enter your email first.','err');if(!token())return show('Complete the security check first.','err');
      try{const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/reset-password/`,captchaToken:token()});resetCaptcha();if(error)return show(error.message,'err');show('Password reset email sent. Check your inbox.');}catch(err){resetCaptcha();show(err.message||'Could not send reset email.','err');}
    });
    sb.auth.getSession().then(async({data:{session}})=>{if(session){try{const p=await api('/api/profile');location.href=p.profile?.role==='admin'?'/admin/':'/account/';}catch{}}});
  }

  if(page==='signup'){
    const form=document.getElementById('signup-form');
    form?.addEventListener('submit',async e=>{e.preventDefault();clear();const display_name=form.display_name.value.trim(),email=form.email.value.trim(),password=form.password.value,confirm=form.confirm_password.value;
      if(display_name.length<2)return show('Please enter your name.','err'); if(password.length<8)return show('Use at least 8 characters for the password.','err'); if(password!==confirm)return show('Passwords do not match.','err'); if(!token())return show('Please complete the security check.','err');
      const btn=form.querySelector('button[type=submit]');btn.disabled=true;
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name},emailRedirectTo:`${location.origin}/login/?verified=1`,captchaToken:token()}});btn.disabled=false;resetCaptcha();
      if(error)return show(error.message,'err'); form.reset(); show(data.session?'Account created. You are signed in.':'Account created. Please verify your email before signing in.');
    });
  }

  if(page==='reset'){
    const form=document.getElementById('reset-form');
    form?.addEventListener('submit',async e=>{e.preventDefault();clear();const password=form.password.value,confirm=form.confirm_password.value;if(password.length<8)return show('Use at least 8 characters.','err');if(password!==confirm)return show('Passwords do not match.','err');
      const {error}=await sb.auth.updateUser({password});if(error)return show(error.message,'err');show('Password updated. Redirecting to login...');setTimeout(async()=>{await sb.auth.signOut();location.href='/login/';},900);
    });
  }

  if(page==='account'){
    const name=document.getElementById('account-name'),email=document.getElementById('account-email'),role=document.getElementById('account-role'),form=document.getElementById('profile-form');
    (async()=>{const {data:{session}}=await sb.auth.getSession();if(!session)return location.href='/login/?next=/account/';email.textContent=session.user.email||'';try{const p=await api('/api/profile');name.textContent=p.profile?.display_name||'Member';role.textContent=p.profile?.role||'user';form.display_name.value=p.profile?.display_name||'';}catch(err){show(err.message,'err')}})();
    form?.addEventListener('submit',async e=>{e.preventDefault();clear();try{const out=await api('/api/profile',{method:'PATCH',body:JSON.stringify({display_name:form.display_name.value.trim()})});name.textContent=out.profile.display_name;show('Profile updated.');}catch(err){show(err.message,'err')}});
    document.getElementById('logout-btn')?.addEventListener('click',async()=>{await sb.auth.signOut();location.href='/login/';});
  }
})();
