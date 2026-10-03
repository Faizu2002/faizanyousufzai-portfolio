(()=>{
  "use strict";
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const num=(id,fallback=0)=>{const el=document.getElementById(id);const v=el?Number(el.value):NaN;return Number.isFinite(v)?v:fallback};
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const pkr=v=>new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(Number.isFinite(v)?v:0).replace("PKR","Rs").trim();
  const nfmt=(v,d=2)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:d}).format(Number.isFinite(v)?v:0);
  const setStatus=(el,text,type="")=>{if(!el)return;el.textContent=text;el.classList.remove("error","success");if(type)el.classList.add(type)};

  function initAge(){
    const b=$("#birthDate"),t=$("#targetDate"); if(!b||!t)return;
    const status=$("#ageStatus"),results=$("#ageResults"),extra=$("#ageExtra");
    const localDateString=d=>{const pad=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
    const parse=v=>{if(!v)return null;const [y,m,d]=v.split("-").map(Number);return new Date(y,m-1,d)};
    const dim=(y,m)=>new Date(y,m+1,0).getDate();
    const age=(start,end)=>{let years=end.getFullYear()-start.getFullYear();let anchor=new Date(start.getFullYear()+years,start.getMonth(),Math.min(start.getDate(),dim(start.getFullYear()+years,start.getMonth())));if(anchor>end){years--;anchor=new Date(start.getFullYear()+years,start.getMonth(),Math.min(start.getDate(),dim(start.getFullYear()+years,start.getMonth())))}let months=0,next=new Date(anchor);while(months<12){let y=next.getFullYear(),m=next.getMonth()+1;y+=Math.floor(m/12);m%=12;const cand=new Date(y,m,Math.min(start.getDate(),dim(y,m)));if(cand<=end){months++;next=cand}else break}const days=Math.round((Date.UTC(end.getFullYear(),end.getMonth(),end.getDate())-Date.UTC(next.getFullYear(),next.getMonth(),next.getDate()))/86400000);const totalDays=Math.round((Date.UTC(end.getFullYear(),end.getMonth(),end.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000);return{years,months,days,totalDays}};
    const run=()=>{const start=parse(b.value),end=parse(t.value);if(!start||!end){setStatus(status,"Please choose both dates.","error");results.hidden=true;extra.hidden=true;return}if(start>end){setStatus(status,"Birth date must be before or the same as the target date.","error");results.hidden=true;extra.hidden=true;return}const a=age(start,end);$("#yearsResult").textContent=a.years;$("#monthsResult").textContent=a.months;$("#daysResult").textContent=a.days;results.hidden=false;extra.hidden=false;extra.innerHTML=`That is <strong>${a.totalDays.toLocaleString()}</strong> total days between the selected dates.`;setStatus(status,"Age calculated successfully.","success")};
    $("#calculateAgeBtn")?.addEventListener("click",run);$("#todayBtn")?.addEventListener("click",()=>{t.value=localDateString(new Date());if(b.value)run()});$("#resetAgeBtn")?.addEventListener("click",()=>{b.value="";t.value=localDateString(new Date());results.hidden=true;extra.hidden=true;setStatus(status,"Choose both dates to calculate age.")});t.value=localDateString(new Date());
  }

  function initImage(){
    const input=$("#imageInput"),format=$("#formatSelect"),quality=$("#qualityRange");if(!input||!format||!quality)return;
    const qv=$("#qualityValue"),hint=$("#qualityHint"),convert=$("#convertBtn"),reset=$("#resetImageBtn"),status=$("#imageStatus"),preview=$("#imagePreview"),wrap=$("#previewWrap"),meta=$("#fileMeta"),download=$("#downloadImage");let file=null,img=null,inputUrl=null,lastUrl=null;
    const ext=t=>({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif","image/gif":"gif","image/bmp":"bmp"}[t]||"img");const base=n=>n.replace(/\.[^.]+$/,'');
    const revoke=()=>{if(lastUrl){URL.revokeObjectURL(lastUrl);lastUrl=null}};const revokeInput=()=>{if(inputUrl){URL.revokeObjectURL(inputUrl);inputUrl=null}};
    const updateQuality=()=>{qv.textContent=quality.value;const lossy=["image/jpeg","image/webp","image/avif"].includes(format.value);quality.disabled=!lossy;hint.textContent=lossy?"Used by JPG, WebP and supported AVIF export.":"Quality setting is not used for this output format."};quality.addEventListener("input",()=>qv.textContent=quality.value);format.addEventListener("change",updateQuality);updateQuality();
    function resetAll(){revoke();revokeInput();input.value="";file=null;img=null;preview.removeAttribute("src");wrap.hidden=true;download.hidden=true;download.removeAttribute("href");convert.disabled=true;setStatus(status,"Select an image to begin.")}
    reset?.addEventListener("click",resetAll);
    input.addEventListener("change",()=>{revoke();revokeInput();download.hidden=true;file=input.files&&input.files[0];if(!file){resetAll();return}if(file.size>60*1024*1024){setStatus(status,"Please choose an image smaller than 60 MB for reliable browser processing.","error");convert.disabled=true;return}inputUrl=URL.createObjectURL(file);const image=new Image();image.onload=()=>{img=image;preview.src=inputUrl;wrap.hidden=false;convert.disabled=false;meta.textContent=`${file.name} · ${image.naturalWidth} × ${image.naturalHeight} · ${(file.size/1024).toFixed(1)} KB`;setStatus(status,"Image ready to convert.","success")};image.onerror=()=>{revokeInput();setStatus(status,"This browser could not read that image file.","error");convert.disabled=true};image.src=inputUrl});
    function canvasData(){const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext("2d",{willReadFrequently:true});if(format.value==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height)}ctx.drawImage(img,0,0);return{c,ctx}}
    function bmpBlob(ctx,w,h){const rgba=ctx.getImageData(0,0,w,h).data,row=Math.ceil((w*3)/4)*4,size=54+row*h,b=new ArrayBuffer(size),v=new DataView(b);const u16=(o,n)=>v.setUint16(o,n,true),u32=(o,n)=>v.setUint32(o,n,true),i32=(o,n)=>v.setInt32(o,n,true);v.setUint8(0,0x42);v.setUint8(1,0x4d);u32(2,size);u32(10,54);u32(14,40);i32(18,w);i32(22,h);u16(26,1);u16(28,24);u32(34,row*h);let p=54;for(let y=h-1;y>=0;y--){for(let x=0;x<w;x++){const i=(y*w+x)*4;v.setUint8(p++,rgba[i+2]);v.setUint8(p++,rgba[i+1]);v.setUint8(p++,rgba[i])}while((p-54)%row!==0)v.setUint8(p++,0)}return new Blob([b],{type:"image/bmp"})}
    function gifBlob(ctx,w,h){const rgba=ctx.getImageData(0,0,w,h).data,palette=new Uint8Array(256*3);for(let i=0;i<256;i++){palette[i*3]=((i>>5)&7)*255/7;palette[i*3+1]=((i>>2)&7)*255/7;palette[i*3+2]=(i&3)*255/3}const indices=new Uint8Array(w*h);for(let i=0,p=0;i<rgba.length;i+=4,p++)indices[p]=((rgba[i]>>5)<<5)|((rgba[i+1]>>5)<<2)|(rgba[i+2]>>6);const out=[];const bytes=s=>{for(let i=0;i<s.length;i++)out.push(s.charCodeAt(i))};const le=n=>out.push(n&255,(n>>8)&255);bytes("GIF89a");le(w);le(h);out.push(0xF7,0,0);for(const x of palette)out.push(x);out.push(0x2C);le(0);le(0);le(w);le(h);out.push(0,8);const min=8,clear=1<<min,eoi=clear+1;let codeSize=min+1,next=eoi+1,dict=new Map(),bitBuf=0,bitCount=0,data=[];const emit=code=>{bitBuf|=code<<bitCount;bitCount+=codeSize;while(bitCount>=8){data.push(bitBuf&255);bitBuf>>=8;bitCount-=8}};const resetDict=()=>{dict=new Map();codeSize=min+1;next=eoi+1};emit(clear);let prefix=indices[0]||0;for(let i=1;i<indices.length;i++){const k=indices[i],key=prefix+","+k;if(dict.has(key))prefix=dict.get(key);else{emit(prefix);if(next<4096){dict.set(key,next++);if(next===(1<<codeSize)&&codeSize<12)codeSize++}else{emit(clear);resetDict()}prefix=k}}emit(prefix);emit(eoi);if(bitCount>0)data.push(bitBuf&255);for(let i=0;i<data.length;i+=255){const chunk=data.slice(i,i+255);out.push(chunk.length,...chunk)}out.push(0,0x3B);return new Blob([new Uint8Array(out)],{type:"image/gif"})}
    const canvasBlob=(c,type,q)=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error(type==="image/avif"?"AVIF export is not supported by this browser. Try WebP instead.":"Could not create this format in your browser.")),type,q));
    convert?.addEventListener("click",async()=>{if(!img||!file)return;convert.disabled=true;download.hidden=true;setStatus(status,"Converting image...");try{const{c,ctx}=canvasData();let blob;if(format.value==="image/bmp")blob=bmpBlob(ctx,c.width,c.height);else if(format.value==="image/gif")blob=gifBlob(ctx,c.width,c.height);else blob=await canvasBlob(c,format.value,Number(quality.value)/100);revoke();lastUrl=URL.createObjectURL(blob);download.href=lastUrl;download.download=`${base(file.name)}.${ext(format.value)}`;download.textContent=`Download ${ext(format.value).toUpperCase()} (${(blob.size/1024).toFixed(1)} KB)`;download.hidden=false;setStatus(status,"Conversion complete. Your file is ready.","success")}catch(e){setStatus(status,e.message||"Conversion failed in this browser.","error")}finally{convert.disabled=false}});
  }

  function initSolarCapacity(){
    const rows=$("#applianceRows");if(!rows)return;const status=$("#solarCapacityStatus"),results=$("#solarCapacityResults"),note=$("#solarCapacityNote");
    const presets={fan:["Ceiling fan",80,1,8],led:["LED bulb",12,6,6],fridge:["Refrigerator",200,1,10],ac1:["1 ton inverter AC",1200,1,6],ac15:["1.5 ton inverter AC",1800,1,6],tv:["LED TV",100,1,4],laptop:["Laptop",65,1,6],desktop:["Desktop PC",250,1,6],washing:["Washing machine",500,1,1],pump:["Water pump",750,1,1],iron:["Iron",1200,1,.5],microwave:["Microwave",1200,1,.3],custom:["Custom appliance",100,1,1]};
    const row=(name,w,q,h)=>{const tr=document.createElement("tr");tr.innerHTML=`<td><input class="tools-appliance-name" type="text" value="${name.replace(/"/g,"&quot;")}" aria-label="Appliance name"></td><td><input class="ap-watts" type="number" min="1" step="1" value="${w}" aria-label="Watts"></td><td><input class="ap-qty" type="number" min="1" step="1" value="${q}" aria-label="Quantity"></td><td><input class="ap-hours" type="number" min="0" max="24" step="0.1" value="${h}" aria-label="Hours per day"></td><td class="tools-energy-cell">0 kWh</td><td><button class="tools-remove" type="button" aria-label="Remove appliance">×</button></td>`;rows.appendChild(tr);updateRow(tr)};
    const updateRow=tr=>{const w=Number($(".ap-watts",tr)?.value)||0,q=Number($(".ap-qty",tr)?.value)||0,h=Number($(".ap-hours",tr)?.value)||0;$(".tools-energy-cell",tr).textContent=`${nfmt(w*q*h/1000,2)} kWh`};
    const defaults=()=>{rows.innerHTML="";row(...presets.fan);row(...presets.led);row(...presets.fridge);row(...presets.ac15)};
    rows.addEventListener("input",e=>{const tr=e.target.closest("tr");if(tr)updateRow(tr)});rows.addEventListener("click",e=>{const btn=e.target.closest(".tools-remove");if(btn){btn.closest("tr").remove();if(!rows.children.length)row(...presets.custom)}});
    $("#addApplianceBtn")?.addEventListener("click",()=>{const key=$("#appliancePreset").value;row(...(presets[key]||presets.custom))});
    function calc(){let connectedW=0,daily=0;$$('tr',rows).forEach(tr=>{const w=Number($(".ap-watts",tr).value)||0,q=Number($(".ap-qty",tr).value)||0,h=Number($(".ap-hours",tr).value)||0;connectedW+=w*q;daily+=w*q*h/1000});const sun=num("peakSunHours"),eff=clamp(num("systemEfficiency"),1,100)/100,margin=clamp(num("solarMargin"),0,100)/100,panelW=num("panelWatt"),sim=clamp(num("simultaneousLoad"),1,100)/100,backup=Math.max(0,num("backupHours")),dod=clamp(num("batteryDoD"),1,100)/100,invEff=clamp(num("batteryInvEfficiency"),1,100)/100;if(daily<=0||sun<=0||panelW<=0){setStatus(status,"Enter valid appliance usage, sun hours and panel wattage.","error");results.hidden=true;note.hidden=true;return}const solarKw=(daily/(sun*eff))*(1+margin),panels=Math.ceil(solarKw*1000/panelW),simKw=connectedW*sim/1000,inverterKw=simKw*1.25,battery=backup>0?(simKw*backup)/(dod*invEff):0;$("#solarDailyEnergy").textContent=nfmt(daily,2);$("#solarSystemSize").textContent=nfmt(solarKw,2);$("#solarPanelCount").textContent=panels;$("#solarInverterSize").textContent=nfmt(inverterKw,2);$("#solarBatterySize").textContent=nfmt(battery,2);results.hidden=false;note.hidden=false;note.innerHTML=`Estimated connected load: <strong>${nfmt(connectedW/1000,2)} kW</strong>. Estimated simultaneous load: <strong>${nfmt(simKw,2)} kW</strong>. A ${nfmt(panelW,0)} W panel assumption gives ${panels} panels. Final inverter and battery selection should also account for surge load, roof limits and manufacturer specifications.`;setStatus(status,"Solar sizing estimate calculated.","success")}
    $("#calculateSolarCapacityBtn")?.addEventListener("click",calc);$("#resetSolarCapacityBtn")?.addEventListener("click",()=>{defaults();$("#peakSunHours").value=5;$("#systemEfficiency").value=80;$("#solarMargin").value=15;$("#panelWatt").value=585;$("#simultaneousLoad").value=70;$("#backupHours").value=4;$("#batteryDoD").value=80;$("#batteryInvEfficiency").value=90;results.hidden=true;note.hidden=true;setStatus(status,"Add or edit appliances, then calculate.")});defaults();
  }

  function initSolarRoi(){
    if(!$("#roiSystemSize"))return;const status=$("#solarRoiStatus"),results=$("#solarRoiResults"),note=$("#solarRoiNote");
    function calc(){const size=num("roiSystemSize"),cost=num("roiSystemCost"),sun=num("roiSunHours"),perf=clamp(num("roiPerformance"),1,100)/100,self=clamp(num("roiSelfUse"),0,100)/100,importRate=num("roiImportTariff"),exportRate=num("roiExportRate"),maint=clamp(num("roiMaintenance"),0,100)/100,degrade=clamp(num("roiDegradation"),0,20)/100,years=Math.round(clamp(num("roiYears"),1,30));if(size<=0||cost<=0||sun<=0||importRate<0||exportRate<0){setStatus(status,"Enter valid positive system, cost and generation assumptions.","error");results.hidden=true;note.hidden=true;return}const annualGen=size*sun*365*perf,maintAmount=cost*maint;let cumulative=0,payback=null,periodBenefit=0,year1Net=0;for(let y=1;y<=years;y++){const gen=annualGen*Math.pow(1-degrade,y-1),gross=gen*(self*importRate+(1-self)*exportRate),net=gross-maintAmount;if(y===1)year1Net=net;const before=cumulative;cumulative+=net;periodBenefit+=net;if(payback===null&&cumulative>=cost&&net>0)payback=(y-1)+((cost-before)/net)}const netGain=periodBenefit-cost,roi=cost?netGain/cost*100:0;$("#roiAnnualGeneration").textContent=nfmt(annualGen,0);$("#roiAnnualSaving").textContent=pkr(year1Net);$("#roiPayback").textContent=payback===null?`>${years} yrs`:`${nfmt(payback,1)} yrs`;$("#roiPeriodGain").textContent=pkr(netGain);$("#roiPercent").textContent=`${nfmt(roi,1)}%`;results.hidden=false;note.hidden=false;const selfKwh=annualGen*self,exportKwh=annualGen*(1-self);note.innerHTML=`Year 1 generation estimate: <strong>${nfmt(annualGen,0)} kWh</strong>, including about <strong>${nfmt(selfKwh,0)} kWh</strong> self-used and <strong>${nfmt(exportKwh,0)} kWh</strong> exported. This simple model keeps electricity and export rates constant and does not include financing, tax, inverter replacement or tariff inflation.`;setStatus(status,"Solar ROI estimate calculated.","success")}
    const basis=$("#roiExportBasis"),exportRate=$("#roiExportRate"),exportHint=$("#roiExportHint");
    const setBasis=()=>{if(!basis||!exportRate)return;if(basis.value==="naepp"){exportRate.value=8.13;if(exportHint)exportHint.textContent="CY 2026 NAEPP forecast: Rs 8.13/kWh. Editable."}else if(basis.value==="nappp"){exportRate.value=25.32;if(exportHint)exportHint.textContent="CY 2026 NAPPP forecast: Rs 25.32/kWh for eligible legacy agreements until expiry. Editable."}else if(exportHint){exportHint.textContent="Enter the current export credit that applies to your agreement."}};
    basis?.addEventListener("change",setBasis);
    $("#calculateSolarRoiBtn")?.addEventListener("click",calc);$("#resetSolarRoiBtn")?.addEventListener("click",()=>{const vals={roiSystemSize:10,roiSystemCost:1200000,roiSunHours:5,roiPerformance:80,roiSelfUse:70,roiImportTariff:55,roiExportRate:8.13,roiMaintenance:1,roiDegradation:.5,roiYears:25};Object.entries(vals).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v});if(basis)basis.value="naepp";setBasis();results.hidden=true;note.hidden=true;setStatus(status,"Edit the assumptions to match your quotation and electricity bill.")});
  }

  function initFbr(){
    if(!$("#fbrProceeds"))return;const status=$("#fbrStatus"),results=$("#fbrResults"),note=$("#fbrNote");
    function calc(){const proceeds=num("fbrProceeds"),period=$("#fbrPeriod").value,pseb=$("#fbrPseb").value==="yes",rate=pseb?.0025:.01;if(proceeds<0){setStatus(status,"Enter a valid export proceeds amount.","error");results.hidden=true;note.hidden=true;return}const tax=proceeds*rate,net=proceeds-tax;let annual=null;if(period==="monthly")annual=tax*12;else if(period==="annual")annual=tax;$("#fbrRate").textContent=`${(rate*100).toFixed(2)}%`;$("#fbrTax").textContent=pkr(tax);$("#fbrNet").textContent=pkr(net);$("#fbrAnnualTax").textContent=annual===null?"—":pkr(annual);results.hidden=false;note.hidden=false;note.innerHTML=pseb?`The <strong>0.25%</strong> estimate uses the Section 154A rate for export proceeds of computer software, IT services or IT-enabled services by a person registered with PSEB.`:`The <strong>1%</strong> estimate uses the Section 154A “any other case” rate. Confirm that your receipt falls under this section before relying on the result.`;setStatus(status,"Withholding estimate calculated using Tax Year 2027 rates.","success")}
    $("#calculateFbrBtn")?.addEventListener("click",calc);$("#resetFbrBtn")?.addEventListener("click",()=>{$("#fbrProceeds").value=500000;$("#fbrPeriod").value="single";$("#fbrPseb").value="yes";results.hidden=true;note.hidden=true;setStatus(status,"Rates updated for Tax Year 2027 under Finance Act 2026.")});
  }

  function initSalaryTax(){
    if(!$("#salaryAmount"))return;
    const status=$("#salaryTaxStatus"),results=$("#salaryTaxResults"),note=$("#salaryTaxNote"),yearEl=$("#salaryTaxYear"),periodEl=$("#salaryPeriod"),rows=$("#salarySlabRows"),heading=$("#salarySlabHeading");
    const taxYears={
      2027:{label:"2026-27",taxYear:"Tax Year 2027",surcharge:null,slabs:[[600000,0,0,0],[1200000,0,.01,600000],[2200000,6000,.11,1200000],[3200000,116000,.20,2200000],[4100000,316000,.25,3200000],[5600000,541000,.29,4100000],[7000000,976000,.32,5600000],[Infinity,1424000,.35,7000000]],table:[["Up to Rs 600,000","0%"],["Rs 600,001 to Rs 1,200,000","1% of amount above Rs 600,000"],["Rs 1,200,001 to Rs 2,200,000","Rs 6,000 + 11% above Rs 1,200,000"],["Rs 2,200,001 to Rs 3,200,000","Rs 116,000 + 20% above Rs 2,200,000"],["Rs 3,200,001 to Rs 4,100,000","Rs 316,000 + 25% above Rs 3,200,000"],["Rs 4,100,001 to Rs 5,600,000","Rs 541,000 + 29% above Rs 4,100,000"],["Rs 5,600,001 to Rs 7,000,000","Rs 976,000 + 32% above Rs 5,600,000"],["Above Rs 7,000,000","Rs 1,424,000 + 35% above Rs 7,000,000"]]},
      2026:{label:"2025-26",taxYear:"Tax Year 2026",surcharge:{threshold:10000000,rate:.09},slabs:[[600000,0,0,0],[1200000,0,.01,600000],[2200000,6000,.11,1200000],[3200000,116000,.23,2200000],[4100000,346000,.30,3200000],[Infinity,616000,.35,4100000]],table:[["Up to Rs 600,000","0%"],["Rs 600,001 to Rs 1,200,000","1% of amount above Rs 600,000"],["Rs 1,200,001 to Rs 2,200,000","Rs 6,000 + 11% above Rs 1,200,000"],["Rs 2,200,001 to Rs 3,200,000","Rs 116,000 + 23% above Rs 2,200,000"],["Rs 3,200,001 to Rs 4,100,000","Rs 346,000 + 30% above Rs 3,200,000"],["Above Rs 4,100,000","Rs 616,000 + 35% above Rs 4,100,000"],["Surcharge above Rs 10,000,000","9% of calculated income tax"]]},
      2025:{label:"2024-25",taxYear:"Tax Year 2025",surcharge:{threshold:10000000,rate:.10},slabs:[[600000,0,0,0],[1200000,0,.05,600000],[2200000,30000,.15,1200000],[3200000,180000,.25,2200000],[4100000,430000,.30,3200000],[Infinity,700000,.35,4100000]],table:[["Up to Rs 600,000","0%"],["Rs 600,001 to Rs 1,200,000","5% of amount above Rs 600,000"],["Rs 1,200,001 to Rs 2,200,000","Rs 30,000 + 15% above Rs 1,200,000"],["Rs 2,200,001 to Rs 3,200,000","Rs 180,000 + 25% above Rs 2,200,000"],["Rs 3,200,001 to Rs 4,100,000","Rs 430,000 + 30% above Rs 3,200,000"],["Above Rs 4,100,000","Rs 700,000 + 35% above Rs 4,100,000"],["Surcharge above Rs 10,000,000","10% of calculated income tax"]]},
      2024:{label:"2023-24",taxYear:"Tax Year 2024",surcharge:null,slabs:[[600000,0,0,0],[1200000,0,.025,600000],[2400000,15000,.125,1200000],[3600000,165000,.225,2400000],[6000000,435000,.275,3600000],[Infinity,1095000,.35,6000000]],table:[["Up to Rs 600,000","0%"],["Rs 600,001 to Rs 1,200,000","2.5% of amount above Rs 600,000"],["Rs 1,200,001 to Rs 2,400,000","Rs 15,000 + 12.5% above Rs 1,200,000"],["Rs 2,400,001 to Rs 3,600,000","Rs 165,000 + 22.5% above Rs 2,400,000"],["Rs 3,600,001 to Rs 6,000,000","Rs 435,000 + 27.5% above Rs 3,600,000"],["Above Rs 6,000,000","Rs 1,095,000 + 35% above Rs 6,000,000"]]},
      2023:{label:"2022-23",taxYear:"Tax Year 2023",surcharge:null,slabs:[[600000,0,0,0],[1200000,0,.025,600000],[2400000,15000,.125,1200000],[3600000,165000,.20,2400000],[6000000,405000,.25,3600000],[12000000,1005000,.325,6000000],[Infinity,2955000,.35,12000000]],table:[["Up to Rs 600,000","0%"],["Rs 600,001 to Rs 1,200,000","2.5% of amount above Rs 600,000"],["Rs 1,200,001 to Rs 2,400,000","Rs 15,000 + 12.5% above Rs 1,200,000"],["Rs 2,400,001 to Rs 3,600,000","Rs 165,000 + 20% above Rs 2,400,000"],["Rs 3,600,001 to Rs 6,000,000","Rs 405,000 + 25% above Rs 3,600,000"],["Rs 6,000,001 to Rs 12,000,000","Rs 1,005,000 + 32.5% above Rs 6,000,000"],["Above Rs 12,000,000","Rs 2,955,000 + 35% above Rs 12,000,000"]]}
    };
    const selected=()=>taxYears[Number(yearEl.value)]||taxYears[2027];
    function renderSlabs(){const y=selected();heading.textContent="Salary tax slabs "+y.label;rows.innerHTML=y.table.map(([range,rate])=>"<tr><td>"+range+"</td><td>"+rate+"</td></tr>").join("");setStatus(status,"Using FBR salaried-person slabs for "+y.label+" / "+y.taxYear+".");results.hidden=true;note.hidden=true}
    function annualTax(income,y){const slab=y.slabs.find(s=>income<=s[0])||y.slabs[y.slabs.length-1];let tax=slab[1]+Math.max(0,income-slab[3])*slab[2];let surcharge=0;if(y.surcharge&&income>y.surcharge.threshold){surcharge=tax*y.surcharge.rate;tax+=surcharge}return{tax,surcharge,rate:slab[2]}}
    function calc(){const raw=num("salaryAmount"),period=periodEl.value,y=selected();if(raw<0){setStatus(status,"Enter a valid salary amount.","error");results.hidden=true;note.hidden=true;return}const annual=period==="monthly"?raw*12:raw,monthlyGross=annual/12,out=annualTax(annual,y),monthlyTax=out.tax/12,takeHome=Math.max(0,monthlyGross-monthlyTax),effective=annual>0?out.tax/annual*100:0;$("#salaryAnnualIncome").textContent=pkr(annual);$("#salaryAnnualTax").textContent=pkr(out.tax);$("#salaryMonthlyTax").textContent=pkr(monthlyTax);$("#salaryTakeHome").textContent=pkr(takeHome);$("#salaryEffectiveRate").textContent=nfmt(effective,2)+"%";results.hidden=false;note.hidden=false;const extra=out.surcharge>0?" A surcharge of <strong>"+pkr(out.surcharge)+"</strong> is included for this selected year.":"";note.innerHTML="For <strong>"+y.label+"</strong>, the entered salary equals <strong>"+pkr(annual)+"</strong> per year. Estimated tax is <strong>"+pkr(out.tax)+"</strong> annually, or about <strong>"+pkr(monthlyTax)+"</strong> per month."+extra+" This is a slab-based estimate and may differ from actual payroll withholding.";setStatus(status,"Salary tax calculated using "+y.label+" / "+y.taxYear+" slabs.","success")}
    yearEl.addEventListener("change",renderSlabs);
    $("#calculateSalaryTaxBtn")?.addEventListener("click",calc);
    $("#resetSalaryTaxBtn")?.addEventListener("click",()=>{yearEl.value="2027";periodEl.value="monthly";$("#salaryAmount").value=150000;renderSlabs()});
    renderSlabs();
  }

  function initZakat(){
    if(!$("#zakatCash"))return;
    const status=$("#zakatStatus"),results=$("#zakatResults"),note=$("#zakatNote"),basis=$("#zakatNisabBasis"),silverField=$("#zakatSilverRateField"),customField=$("#zakatCustomNisabField");
    const TOLA_GRAMS=11.6638038;
    function toggleNisabFields(){
      const v=basis.value;
      silverField.hidden=v!=="silver";
      customField.hidden=v!=="custom";
      results.hidden=true;note.hidden=true;
      if(v==="gold")setStatus(status,"Enter the current 24K gold price per gram to calculate the gold-based Nisab.");
      else if(v==="silver")setStatus(status,"Enter the current silver price per gram to calculate the silver-based Nisab.");
      else if(v==="pakistan2026")setStatus(status,"Using Pakistan 2026 bank-deduction threshold of Rs 503,529 as the selected reference.");
      else setStatus(status,"Enter your custom Nisab amount, then calculate.");
    }
    function calc(){
      const cash=Math.max(0,num("zakatCash")),receivables=Math.max(0,num("zakatReceivables")),investments=Math.max(0,num("zakatInvestments")),other=Math.max(0,num("zakatOther")),liabilities=Math.max(0,num("zakatLiabilities"));
      const goldWeight=Math.max(0,num("zakatGoldWeight")),unit=$("#zakatGoldUnit").value,purity=clamp(num("zakatGoldPurity",24),1,24),goldRate=Math.max(0,num("zakatGoldRate")),silverRate=Math.max(0,num("zakatSilverRate"));
      const goldGrams=unit==="tola"?goldWeight*TOLA_GRAMS:goldWeight;
      if(goldWeight>0&&goldRate<=0){setStatus(status,"Enter the current 24K gold price per gram to value your gold.","error");results.hidden=true;note.hidden=true;return}
      const goldValue=goldGrams*(purity/24)*goldRate;
      const assets=cash+receivables+investments+other+goldValue;
      const net=Math.max(0,assets-liabilities);
      let nisab=0,label="";
      if(basis.value==="silver"){if(silverRate<=0){setStatus(status,"Enter the current silver price per gram for the silver Nisab.","error");results.hidden=true;note.hidden=true;return}nisab=612.36*silverRate;label="silver Nisab (612.36 g)"}
      else if(basis.value==="gold"){if(goldRate<=0){setStatus(status,"Enter the current 24K gold price per gram for the gold Nisab.","error");results.hidden=true;note.hidden=true;return}nisab=87.48*goldRate;label="gold Nisab (87.48 g)"}
      else if(basis.value==="pakistan2026"){nisab=503529;label="Pakistan 2026 bank-deduction threshold"}
      else {nisab=Math.max(0,num("zakatCustomNisab"));label="custom Nisab"}
      const eligible=net>=nisab&&nisab>0,zakat=eligible?net*.025:0;
      $("#zakatAssetsTotal").textContent=pkr(assets);
      $("#zakatGoldValue").textContent=pkr(goldValue);
      $("#zakatNetWealth").textContent=pkr(net);
      $("#zakatNisabResult").textContent=pkr(nisab);
      $("#zakatDue").textContent=pkr(zakat);
      results.hidden=false;note.hidden=false;
      const goldText=goldWeight>0?" Gold included: <strong>"+nfmt(goldGrams,2)+" g</strong> at "+purity+"K, valued at <strong>"+pkr(goldValue)+"</strong>.":"";
      if(eligible){note.innerHTML="Net Zakatable wealth of <strong>"+pkr(net)+"</strong> is at or above the selected <strong>"+label+"</strong> of <strong>"+pkr(nisab)+"</strong>. At 2.5%, the arithmetic estimate is <strong>"+pkr(zakat)+"</strong>."+goldText+" Confirm asset eligibility and hawl with the scholarly guidance you follow.";setStatus(status,"Zakat estimate calculated at 2.5%.","success")}
      else {note.innerHTML="Net Zakatable wealth of <strong>"+pkr(net)+"</strong> is below the selected <strong>"+label+"</strong> of <strong>"+pkr(nisab)+"</strong>, so this calculator shows <strong>Rs 0</strong> due under that selected threshold."+goldText;setStatus(status,"Net wealth is below the selected Nisab reference.","success")}
    }
    basis.addEventListener("change",toggleNisabFields);
    $("#calculateZakatBtn")?.addEventListener("click",calc);
    $("#resetZakatBtn")?.addEventListener("click",()=>{
      $("#zakatCash").value=500000;$("#zakatReceivables").value=0;$("#zakatInvestments").value=0;$("#zakatOther").value=0;$("#zakatGoldWeight").value=0;$("#zakatGoldUnit").value="gram";$("#zakatGoldPurity").value="24";$("#zakatGoldRate").value="";basis.value="silver";$("#zakatSilverRate").value="";$("#zakatCustomNisab").value=503529;$("#zakatLiabilities").value=0;results.hidden=true;note.hidden=true;toggleNisabFields();
    });
    toggleNisabFields();
  }

  function initNust(){
    if(!$("#nustNetMarks"))return;const status=$("#nustStatus"),results=$("#nustResults"),note=$("#nustNote");
    function calc(){const marks=num("nustNetMarks"),total=num("nustNetTotal"),hssc=num("nustHssc"),ssc=num("nustSsc");if(total<=0||marks<0||marks>total||hssc<0||hssc>100||ssc<0||ssc>100){setStatus(status,"Check the marks and percentages. NET marks cannot exceed total marks, and percentages must be 0 to 100.","error");results.hidden=true;note.hidden=true;return}const netPct=marks/total*100,netPart=netPct*.75,hPart=hssc*.15,sPart=ssc*.10,agg=netPart+hPart+sPart;$("#nustNetPct").textContent=`${nfmt(netPct,2)}%`;$("#nustNetContribution").textContent=nfmt(netPart,2);$("#nustAcademicContribution").textContent=nfmt(hPart+sPart,2);$("#nustAggregate").textContent=`${nfmt(agg,2)}%`;results.hidden=false;note.hidden=false;note.innerHTML=`Breakdown: NET <strong>${nfmt(netPart,2)}</strong> + HSSC/equivalent <strong>${nfmt(hPart,2)}</strong> + SSC/equivalent <strong>${nfmt(sPart,2)}</strong> = <strong>${nfmt(agg,2)}%</strong>. This calculates the published weightage only; it does not predict the closing merit.`;setStatus(status,"NUST aggregate calculated.","success")}
    $("#calculateNustBtn")?.addEventListener("click",calc);$("#resetNustBtn")?.addEventListener("click",()=>{$("#nustNetMarks").value=150;$("#nustNetTotal").value=200;$("#nustHssc").value=85;$("#nustSsc").value=90;results.hidden=true;note.hidden=true;setStatus(status,"Official NET-basis weightages: NET 75%, HSSC 15%, SSC 10%.")});
  }

  function initFast(){
    if(!$("#fastProgram"))return;const program=$("#fastProgram"),weights=$("#fastWeights"),status=$("#fastStatus"),results=$("#fastResults"),note=$("#fastNote");const map={computing:{test:50,hssc:40,ssc:10,label:"Computing"},business:{test:50,hssc:40,ssc:10,label:"Business"},engineering:{test:33,hssc:50,ssc:17,label:"Engineering"}};
    function updateWeights(){const w=map[program.value];weights.innerHTML=`<span>Test <strong>${w.test}%</strong></span><span>HSSC <strong>${w.hssc}%</strong></span><span>SSC <strong>${w.ssc}%</strong></span>`;results.hidden=true;note.hidden=true}
    function calc(){const test=num("fastTest"),hssc=num("fastHssc"),ssc=num("fastSsc"),w=map[program.value];if([test,hssc,ssc].some(v=>v<0||v>100)){setStatus(status,"All percentages must be between 0 and 100.","error");results.hidden=true;note.hidden=true;return}const tp=test*w.test/100,hp=hssc*w.hssc/100,sp=ssc*w.ssc/100,agg=tp+hp+sp;$("#fastTestContribution").textContent=nfmt(tp,2);$("#fastHsscContribution").textContent=nfmt(hp,2);$("#fastSscContribution").textContent=nfmt(sp,2);$("#fastAggregate").textContent=`${nfmt(agg,2)}%`;results.hidden=false;note.hidden=false;note.innerHTML=`${w.label} formula: test <strong>${w.test}%</strong> + HSSC <strong>${w.hssc}%</strong> + SSC <strong>${w.ssc}%</strong>. Enter an admission-test percentage that already reflects any applicable negative marking. Final cut-offs are set by FAST.`;setStatus(status,"FAST aggregate calculated.","success")}
    program.addEventListener("change",updateWeights);$("#calculateFastBtn")?.addEventListener("click",calc);$("#resetFastBtn")?.addEventListener("click",()=>{program.value="computing";$("#fastTest").value=75;$("#fastHssc").value=85;$("#fastSsc").value=90;updateWeights();setStatus(status,"Select a program group because FAST uses different weights for engineering.")});updateWeights();
  }

  document.addEventListener("DOMContentLoaded",()=>{initImage();initAge();initSolarCapacity();initSolarRoi();initFbr();initSalaryTax();initZakat();initNust();initFast()});
})();


/* __ADSTERRA_CONTENT_PAGES__ */
(() => {
  const src = "https://abscloud.org/1/6175d04997ebb3aaf3273dc66b66464c";

  if (document.querySelector(`script[src="${src}"]`)) return;

  const loadAdsterra = () => {
    if (document.querySelector(`script[src="${src}"]`)) return;

    const script = document.createElement("script");
    script.setAttribute("data-cfasync", "false");
    script.src = src;
    document.body.appendChild(script);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAdsterra, { once: true });
  } else {
    loadAdsterra();
  }
})();
