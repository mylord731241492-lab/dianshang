import{r as g}from"./index-DglIsp_g.js";

const d="ai-canvas-image-history";
const i=200;
const l=g([]);

const o=(a="")=>{
  const s=String(a||"").trim();
  return s.startsWith("data:image/png;base64,/uploads/")?s.slice(22):s;
};

const c=a=>{
  const s=o(a);
  return!!(s&&!s.startsWith("data:")&&!s.startsWith("blob:"));
};

const n=()=>{
  var a;
  try{
    const s=l.value.map(r=>({
      ...r,
      url:c(r.url)?o(r.url):"",
      assetId:r.assetId||"",
      localFileName:r.localFileName||"",
      assetKind:r.assetKind||"",
      width:r.width||0,
      height:r.height||0,
      requestedSize:r.requestedSize||""
    }));
    localStorage.setItem(d,JSON.stringify(s));
  }catch(s){
    console.error("Failed to save image history:",s);
    (a=window.$message)==null||a.warning("图片历史保存失败，可能是浏览器存储空间不足");
  }
};

const b=a=>({
  id:a.id||`server_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
  url:o(a.url||a.imageUrl||a.resultUrl||a.result_url||""),
  assetId:a.assetId||"",
  localFileName:a.localFileName||"",
  assetKind:a.assetKind||"generated",
  label:a.label||"生成图片",
  prompt:a.prompt||"",
  model:a.model||a.modelKey||a.model_key||"",
  size:a.size||a.requestedSize||"",
  requestedSize:a.requestedSize||a.size||"",
  width:Number(a.width||0)||0,
  height:Number(a.height||0)||0,
  quality:a.quality||"",
  clarity:a.clarity||"",
  nodeId:a.nodeId||"",
  createdAt:a.createdAt||a.created_at||new Date().toISOString()
});

const v=async()=>{
  try{
    const t=localStorage.getItem("auth_token");
    if(!t)return;
    const s=await fetch("/api/user/generations",{headers:{Authorization:`Bearer ${t}`}});
    if(!s.ok)return;
    const r=await s.json();
    const e=Array.isArray(r.items)?r.items:Array.isArray(r.data)?r.data:[];
    if(!e.length)return;
    const u=new Set(l.value.map(t=>t.assetId||t.localFileName||t.url).filter(Boolean));
    const h=e.map(b).filter(t=>(t.url||t.assetId||t.localFileName)&&!u.has(t.assetId||t.localFileName||t.url));
    if(h.length){
      l.value=[...h,...l.value].slice(0,i);
      n();
    }
  }catch(a){
    console.warn("Failed to sync server image history:",a);
  }
};

const y=()=>{
  try{
    const a=localStorage.getItem(d);
    if(a){
      const s=JSON.parse(a);
      l.value=Array.isArray(s)?s.map(r=>({...r,url:o(r==null?void 0:r.url)})).filter(r=>(r==null?void 0:r.url)||(r==null?void 0:r.assetId)||(r==null?void 0:r.localFileName)):[];
    }
  }catch(a){
    console.error("Failed to load image history:",a);
    l.value=[];
  }
  v();
};

const I=a=>{
  if(!(a!=null&&a.url)&&!(a!=null&&a.assetId)&&!(a!=null&&a.localFileName))return null;
  const s=o(a.url);
  const r=(a.assetId||a.localFileName)&&!c(s)?"":s;
  const e={
    id:`history_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    url:r,
    assetId:a.assetId||"",
    localFileName:a.localFileName||"",
    assetKind:a.assetKind||"",
    label:a.label||"生成图片",
    prompt:a.prompt||"",
    model:a.model||"",
    size:a.size||"",
    requestedSize:a.requestedSize||a.size||"",
    width:Number(a.width||a.assetWidth||0)||0,
    height:Number(a.height||a.assetHeight||0)||0,
    quality:a.quality||"",
    clarity:a.clarity||"",
    nodeId:a.nodeId||"",
    createdAt:a.createdAt||new Date().toISOString()
  };
  const u=e.assetId||e.localFileName||e.url;
  l.value=[e,...l.value.filter(t=>(t.assetId||t.localFileName||t.url)!==u)].slice(0,i);
  n();
  return e;
};

const p=a=>{
  l.value=l.value.filter(s=>s.id!==a);
  n();
};

const S=()=>{
  l.value=[];
  n();
};

export{I as a,l as b,S as c,y as i,p as r};
