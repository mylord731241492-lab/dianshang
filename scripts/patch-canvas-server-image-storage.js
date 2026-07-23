const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function replaceExact(relativePath, before, after, expectedCount = 1) {
  const filePath = path.join(rootDir, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');

  if (source.includes(after) && !source.includes(before)) {
    console.log(`OK ${relativePath} already patched`);
    return;
  }

  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${relativePath}: expected ${expectedCount} patch target(s), found ${count}`);
  }

  fs.writeFileSync(filePath, source.split(before).join(after), 'utf8');
  console.log(`OK ${relativePath} patched (${count})`);
}

replaceExact(
  'assets/projects-BtxGnToV.js',
  '):(pe(b,N),{fileName:N,mode:"download"});if(e.url.startsWith("data:"))',
  '):{fileName:N,mode:"server",serverUrl:e.url,clientAutoDownloadDisabled:!0};if(e.url.startsWith("data:"))'
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  ')):(!it||it.mode!=="download")&&((dt=window.$message)==null||dt.warning("图片生成成功，但未保存到本地文件夹"))',
  ')):(!it||it.mode!=="download"&&it.mode!=="server")&&((dt=window.$message)==null||dt.warning("图片生成成功，但未保存到本地文件夹"))'
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  'projects-BtxGnToV.js?v=20260714opperf4',
  'projects-BtxGnToV.js?v=20260715serverstore1'
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  'size:P.size||"1:1",ratio:P.size||"1:1"',
  'ratio:String(P.size||"1:1").replace(/[xX×]/g,":")'
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  'ne=B(null);let F=null,promptSaveTimer=null;const generationSubmitLocked=B(!1),D=[],G=',
  'ne=B(null);let F=null,promptSaveTimer=null;const D=[],G='
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  'const{prompt:de,refImages:Ie}=_e.value;if(generationSubmitLocked.value||I(r)){(Lt=window.$message)==null||Lt.warning("已有生图任务正在处理中，请等待完成后再试");return}if(!de&&Ie.length===0){(Lt=window.$message)==null||Lt.warning("请先输入提示词，或连接图片节点作为参考图");return}generationSubmitLocked.value=!0;if(_s())',
  'const{prompt:de,refImages:Ie}=_e.value;if(!de&&Ie.length===0){(Lt=window.$message)==null||Lt.warning("请先输入提示词，或连接图片节点作为参考图");return}if(_s())'
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  'finally{generationSubmitLocked.value=!1,await tu().catch(()=>null),Ae()}};',
  'finally{await tu().catch(()=>null),Ae()}};'
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  'disabled:!Ce.value||I(r)||generationSubmitLocked.value,onClick:fe',
  'disabled:!Ce.value,onClick:fe'
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  'w(),b(Math.max(90,Number(_.progress||90)),"等待返回结果",_.status||"running",A,{taskId:x,id:x,task:_,status:_.status||"running"});let M=null;',
  'w();const taskStatus=_.status||"pending",taskProgress=taskStatus==="pending"?Math.max(6,Math.min(20,Number(_.progress||6))):Math.max(40,Math.min(99,Number(_.progress||40)));b(taskProgress,taskStatus==="pending"?"排队中":"等待返回结果",taskStatus,A,{taskId:x,id:x,task:_,status:taskStatus});let M=null;'
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  'const le=Math.max(18,Math.min(99,Number(M.progress||0)));if(M.status==="success"){',
  'const le=M.status==="pending"?Math.max(6,Math.min(20,Number(M.progress||6))):Math.max(40,Math.min(99,Number(M.progress||40)));if(M.status==="success"){'
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  'b(le,"生成任务处理中",M.status||"running",A,{taskId:x,id:x,task:M,status:M.status||"running"})',
  'b(le,M.status==="pending"?"排队中":"生成任务处理中",M.status||"running",A,{taskId:x,id:x,task:M,status:M.status||"running"})'
);

replaceExact(
  'assets/Canvas-B8bY9_QL.js',
  'const r=async()=>{var i,s;await((i=navigator.clipboard)==null?void 0:i.writeText(t.value)),(s=window.$message)==null||s.success("提示词已复制")};return(a,i)=>',
  'const r=async()=>{var i,s;try{const l=String(t.value||"");if(!l)throw new Error("没有可复制的提示词");let u=!1;if(typeof navigator!="undefined"&&navigator.clipboard&&window.isSecureContext)try{await navigator.clipboard.writeText(l),u=!0}catch{}if(!u){const d=document.createElement("textarea");d.value=l,d.setAttribute("readonly",""),d.style.position="fixed",d.style.opacity="0",d.style.pointerEvents="none",d.style.left="-9999px",document.body.appendChild(d),d.focus(),d.select(),d.setSelectionRange(0,d.value.length);try{u=document.execCommand("copy")}finally{document.body.removeChild(d)}}if(!u)throw new Error("浏览器拒绝写入剪贴板");(i=window.$message)==null||i.success("提示词已复制")}catch(l){console.warn("复制提示词失败:",l),(s=window.$message)==null||s.error("复制失败，请手动选择提示词")}};return(a,i)=>'
);

replaceExact(
  'assets/index-DglIsp_g.js',
  'Canvas-B8bY9_QL.js?v=20260717multisubmit1',
  'Canvas-B8bY9_QL.js?v=20260717reversecopy1',
  2
);
