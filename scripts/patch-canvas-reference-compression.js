const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const canvasPath = path.join(repoRoot, 'assets', 'Canvas-B8bY9_QL.js');
const indexPath = path.join(repoRoot, 'assets', 'index-DglIsp_g.js');
let source = fs.readFileSync(canvasPath, 'utf8');
const marker = 'HJM_CANVAS_REFERENCE_MAX_SIDE=2048';
const urlMarker = 'function hjmReferenceUrlToDataUrl';

const original = 'async function Fg(e){if(typeof e!="string"||!e.startsWith("data:"))return e;const t=["image/jpeg","image/png","image/webp"],n=e.match(/^data:([^;]+);/),o=n?n[1]:"";if(!o||t.includes(o))return e;console.log(`[ImageUtil] Unsupported mime type: ${o}, converting to image/jpeg...`);try{return await a6(e,"image/jpeg")}catch(r){return console.error("[ImageUtil] Conversion failed:",r),e}}function a6(e,t="image/jpeg"){return new Promise((n,o)=>{const r=new Image;r.onload=()=>{const a=document.createElement("canvas");a.width=r.width,a.height=r.height,a.getContext("2d").drawImage(r,0,0),n(a.toDataURL(t,.9))},r.onerror=o,r.src=e})}';
const replacementV1 = 'const HJM_CANVAS_REFERENCE_MAX_SIDE=2048,HJM_CANVAS_REFERENCE_MAX_BYTES=4*1024*1024;function hjmImageDataUrlBytes(e){const t=String(e||"").indexOf(",");if(t<0)return 0;const n=String(e).slice(t+1).replace(/=+$/g,"");return Math.floor(n.length*3/4)}async function Fg(e){if(typeof e!="string"||!e.startsWith("data:"))return e;const t=["image/jpeg","image/png","image/webp"],n=e.match(/^data:([^;]+);/),o=(n?n[1]:"").toLowerCase();if(!o||!o.startsWith("image/"))return e;try{return await a6(e,!t.includes(o),HJM_CANVAS_REFERENCE_MAX_SIDE,.9,HJM_CANVAS_REFERENCE_MAX_BYTES)}catch(r){return console.error("[ImageUtil] Outbound reference compression failed:",r),e}}function a6(e,t=!1,n=HJM_CANVAS_REFERENCE_MAX_SIDE,o=.9,r=HJM_CANVAS_REFERENCE_MAX_BYTES){return new Promise((a,i)=>{const s=new Image;s.onload=()=>{if(!t&&Math.max(s.width,s.height)<=n&&hjmImageDataUrlBytes(e)<=r){a(e);return}const l=document.createElement("canvas"),u=l.getContext("2d");if(!u){i(new Error("Canvas 2D context is unavailable"));return}let c=Math.min(1,n/Math.max(s.width,s.height)),d=Math.max(1,Math.round(s.width*c)),f=Math.max(1,Math.round(s.height*c));const h=()=>{l.width=d,l.height=f,u.imageSmoothingEnabled=!0,u.imageSmoothingQuality="high",u.clearRect(0,0,d,f),u.drawImage(s,0,0,d,f);let e=o,v=l.toDataURL("image/webp",e);for(;hjmImageDataUrlBytes(v)>r&&e>.5;)e=Math.max(.5,e-.08),v=l.toDataURL("image/webp",e);if(hjmImageDataUrlBytes(v)>r&&Math.max(d,f)>1024){d=Math.max(1,Math.round(d*.85)),f=Math.max(1,Math.round(f*.85)),h();return}if(hjmImageDataUrlBytes(v)>r){i(new Error("Compressed reference image still exceeds the outbound limit"));return}a(v)};h()},s.onerror=i,s.src=e})}';
const replacement = 'const HJM_CANVAS_REFERENCE_MAX_SIDE=2048,HJM_CANVAS_REFERENCE_MAX_BYTES=4*1024*1024;function hjmImageDataUrlBytes(e){const t=String(e||"").indexOf(",");if(t<0)return 0;const n=String(e).slice(t+1).replace(/=+$/g,"");return Math.floor(n.length*3/4)}async function hjmReferenceUrlToDataUrl(e){const t=String(e||"").trim();if(!t||t.startsWith("data:"))return t;if(!t.startsWith("/")&&!t.startsWith("blob:")&&!/^https?:\/\//i.test(t))return t;try{const n=t.startsWith("blob:")?t:new URL(t,window.location.href).href;if(!t.startsWith("blob:")&&new URL(n).origin!==window.location.origin)return t;const o=await fetch(n,{credentials:"same-origin"});if(!o.ok)return t;const r=await o.blob();if(!String(r.type||"").startsWith("image/"))return t;return await new Promise((a,i)=>{const s=new FileReader;s.onload=()=>a(String(s.result||t)),s.onerror=i,s.readAsDataURL(r)})}catch{return t}}async function Fg(e){if(typeof e!="string")return e;const t=await hjmReferenceUrlToDataUrl(e);if(!t.startsWith("data:"))return e;const n=["image/jpeg","image/png","image/webp"],o=t.match(/^data:([^;]+);/),r=(o?o[1]:"").toLowerCase();if(!r||!r.startsWith("image/"))return e;try{return await a6(t,!n.includes(r),HJM_CANVAS_REFERENCE_MAX_SIDE,.9,HJM_CANVAS_REFERENCE_MAX_BYTES)}catch(a){return console.error("[ImageUtil] Outbound reference compression failed:",a),e}}function a6(e,t=!1,n=HJM_CANVAS_REFERENCE_MAX_SIDE,o=.9,r=HJM_CANVAS_REFERENCE_MAX_BYTES){return new Promise((a,i)=>{const s=new Image;s.onload=()=>{if(!t&&Math.max(s.width,s.height)<=n&&hjmImageDataUrlBytes(e)<=r){a(e);return}const l=document.createElement("canvas"),u=l.getContext("2d");if(!u){i(new Error("Canvas 2D context is unavailable"));return}let c=Math.min(1,n/Math.max(s.width,s.height)),d=Math.max(1,Math.round(s.width*c)),f=Math.max(1,Math.round(s.height*c));const h=()=>{l.width=d,l.height=f,u.imageSmoothingEnabled=!0,u.imageSmoothingQuality="high",u.clearRect(0,0,d,f),u.drawImage(s,0,0,d,f);let e=o,v=l.toDataURL("image/webp",e);for(;hjmImageDataUrlBytes(v)>r&&e>.5;)e=Math.max(.5,e-.08),v=l.toDataURL("image/webp",e);if(hjmImageDataUrlBytes(v)>r&&Math.max(d,f)>1024){d=Math.max(1,Math.round(d*.85)),f=Math.max(1,Math.round(f*.85)),h();return}if(hjmImageDataUrlBytes(v)>r){i(new Error("Compressed reference image still exceeds the outbound limit"));return}a(v)};h()},s.onerror=i,s.src=e})}';
const invalidUrlCheck = '!/^https?:///i.test(t)';
const validUrlCheck = '!new RegExp("^https?://","i").test(t)';
const safeReplacement = replacement.replace(invalidUrlCheck, validUrlCheck);

if (source.includes(invalidUrlCheck)) {
  source = source.replace(invalidUrlCheck, validUrlCheck);
  fs.writeFileSync(canvasPath, source, 'utf8');
}

if (!source.includes(urlMarker)) {
  const before = source.includes(marker) ? replacementV1 : original;
  const first = source.indexOf(before);
  if (first < 0) throw new Error('Canvas reference conversion anchor was not found');
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error('Canvas reference conversion anchor is not unique');
  }
  source = source.replace(before, safeReplacement);
  fs.writeFileSync(canvasPath, source, 'utf8');
}

const oldCanvasUrls = [
  'Canvas-B8bY9_QL.js?v=20260717reversecopy1',
  'Canvas-B8bY9_QL.js?v=20260721refcompress1'
];
const newCanvasUrl = 'Canvas-B8bY9_QL.js?v=20260721refcompress2';
let indexSource = fs.readFileSync(indexPath, 'utf8');
if (!indexSource.includes(newCanvasUrl)) {
  const oldCanvasUrl = oldCanvasUrls.find(value => indexSource.split(value).length - 1 === 2);
  if (!oldCanvasUrl) throw new Error('Expected 2 old Canvas URLs, found no supported cache query');
  indexSource = indexSource.split(oldCanvasUrl).join(newCanvasUrl);
  fs.writeFileSync(indexPath, indexSource, 'utf8');
}

console.log('Canvas reference compression patch and cache query are applied');
