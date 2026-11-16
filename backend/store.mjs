function legacyCodes(value){try{return JSON.parse(value||'{}');}catch{return {};}}
import {createHash,timingSafeEqual} from 'node:crypto';
import {eventSettings} from './settings.mjs';
import {VERSION,validateRun,rank} from '../public/core.js';
export function config(env=process.env){if(!env.GITHUB_TOKEN||!/^[-\w.]+\/[-\w.]+$/.test(env.RESULTS_REPO||'')||!/^[-\w]{1,50}$/.test(env.EVENT_ID||''))throw Error('Score service not configured');const setup=eventSettings(env);return {batchId:setup.batchId,token:env.GITHUB_TOKEN,repo:env.RESULTS_REPO,event:env.EVENT_ID,branch:env.RESULTS_BRANCH||'main',codes:legacyCodes(env.TEAM_CODES)};}
export function authenticate(c,teamId,code){const expected=c.codes[teamId];if(typeof expected!=='string'||!expected||typeof code!=='string')return false;return timingSafeEqual(createHash('sha256').update(expected).digest(),createHash('sha256').update(code).digest());}
export function resolveTeamId(c,code){if(typeof code!=='string'||!code||code.length>100){const e=Error('Enter your organiser-issued event team code');e.status=403;throw e;}if(!c.codes||typeof c.codes!=='object'||Array.isArray(c.codes)||!Object.keys(c.codes).length){const e=Error('The organiser has not configured event team codes');e.status=503;throw e;}const matches=Object.keys(c.codes).filter(id=>/^[-A-Z0-9]{2,20}$/.test(id)&&authenticate(c,id,code));if(matches.length!==1){const e=Error(matches.length?'This event code matches multiple teams. Ask the organiser to assign unique codes.':'Event team code is incorrect');e.status=matches.length?503:403;throw e;}return matches[0];}
export function normalise(body){if(body?.version!==VERSION||!/^[-A-Z0-9]{2,20}$/.test(body.teamId||'')||!/^[-a-f0-9]{36}$/.test(body.attemptId||'')||typeof body.teamName!=='string'||!body.teamName.trim()||body.teamName.length>40)throw Error('Invalid result identity');const batchId=body.batchId??'a';const run=validateRun(body.run,batchId);return {version:VERSION,batchId,teamId:body.teamId,teamName:body.teamName.trim(),attemptId:body.attemptId,run,score:run.reduce((n,r)=>n+r.score,0),elapsedMs:run.reduce((n,r)=>n+r.elapsedMs,0)};}
export function fingerprint(record){const {receivedAt,...stable}=record;return createHash('sha256').update(JSON.stringify(stable)).digest('hex');}
export function createStore(c,fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))){
 const base=`https://api.github.com/repos/${c.repo}`;
 async function request(path,init={}){return fetcher(base+path,{...init,headers:{Authorization:`Bearer ${c.token}`,Accept:'application/vnd.github+json','Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(12000)});}
 async function read(path){const res=await request(`/contents/${path}?ref=${encodeURIComponent(c.branch)}`);if(res.status===404)return null;if(!res.ok)throw Error('GitHub read unavailable; retry later');const file=await res.json();return JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));}
 async function register(body){
  const teamName=String(body?.teamName||'').normalize('NFKC').trim().replace(/\s+/g,' '),key=teamName.toLocaleLowerCase('en-US');
  if(!teamName||teamName.length>40||/[\u0000-\u001f\u007f]/.test(teamName)||!/^[-a-f0-9]{36}$/.test(body?.attemptId||'')||!/^[-a-f0-9]{72}$/.test(body?.registrationToken||''))throw Error('Enter a team name of 1–40 characters');
  const teamId='QMS-'+createHash('sha256').update(key).digest('hex').slice(0,16).toUpperCase(),path=`registrations/${c.event}/${teamId}.json`,tokenHash=createHash('sha256').update(body.registrationToken).digest('hex');
  const registration={teamId,teamName,nameKey:key,attemptId:body.attemptId,tokenHash,batchId:c.batchId};
  const same=old=>{if(old.nameKey!==key||old.attemptId!==body.attemptId||old.tokenHash!==tokenHash){const e=Error('That team name is already registered. Choose a different name.');e.status=409;throw e;}return {teamId,teamName:old.teamName,batchId:old.batchId};};
  for(let n=0;n<4;n++){
   const old=await read(path);if(old)return same(old);
   let res;try{res=await request(`/contents/${path}`,{method:'PUT',body:JSON.stringify({message:`Register ${c.event} ${teamId}`,branch:c.branch,content:Buffer.from(JSON.stringify(registration)).toString('base64')})});}catch{const saved=await read(path);if(saved)return same(saved);}
   if(res?.ok)return same(registration);
   const saved=await read(path);if(saved)return same(saved);
   if(res&&![409,422,429,403,500,502,503,504].includes(res.status))throw Error('Team registration storage unavailable');
   const delay=Number(res?.headers?.get('retry-after')||0)*1000;if(delay>3000)throw Error('Registration rate limited; retry shortly');
   if(n<3)await sleep(Math.max(delay,400*2**n));
  }throw Error('Registration busy. Your name is retained; retry shortly.');
 }
 async function authorise(record,token){
  if(typeof token!=='string'||!/^[-a-f0-9]{72}$/.test(token))return false;
  const saved=await read(`registrations/${c.event}/${record.teamId}.json`);
  return !!saved&&saved.attemptId===record.attemptId&&saved.batchId===record.batchId&&saved.teamName===record.teamName&&saved.tokenHash===createHash('sha256').update(token).digest('hex');
 }
 return {register,authorise,async write(record){const path=`results/${c.event}/${record.teamId}.json`;const same=old=>{if(fingerprint(normalise(old))!==fingerprint(record)){const e=Error('This team already has a different official result. Contact the organiser.');e.status=409;throw e;}return {receipt:old.attemptId,duplicate:true};};
   const old=await read(path);if(old)return same(old);
   for(let n=0;n<4;n++){let res;try{res=await request(`/contents/${path}`,{method:'PUT',body:JSON.stringify({message:`Record ${c.event} ${record.teamId}`,branch:c.branch,content:Buffer.from(JSON.stringify({...record,receivedAt:new Date().toISOString()},null,2)).toString('base64')})});}catch{const saved=await read(path);if(saved)return same(saved);if(n===3)throw Error('Write status unknown; retry the saved result');}
    if(res?.ok)return {receipt:record.attemptId,duplicate:false};
    const saved=await read(path);if(saved)return same(saved);
    if(res&&![409,422,429,403,500,502,503,504].includes(res.status))throw Error('GitHub rejected result storage');
    const retryAfter=Number(res?.headers?.get('retry-after')||0)*1000;
    if(retryAfter>3000)throw Error('Provider rate limit; retry later');
    if(n<3)await sleep(Math.max(retryAfter,Math.min(3000,400*2**n+Math.random()*200)));
   }throw Error('Score archive busy. Retry the saved result.');
 },async list(){const res=await request(`/contents/results/${c.event}?ref=${encodeURIComponent(c.branch)}`);if(res.status===404)return [];if(!res.ok)throw Error('Score archive unavailable');const files=await res.json();if(!Array.isArray(files)||files.length>=1000)throw Error('Score archive exceeds event limit');const rows=[];for(let i=0;i<files.length;i+=5){const batch=await Promise.all(files.slice(i,i+5).filter(f=>f.type==='file'&&/^[-A-Z0-9]{2,20}\.json$/.test(f.name)).map(async f=>{const raw=await read(f.path);const r=normalise(raw);if(r.batchId!==(c.batchId||'a'))throw Error('Event archive contains a different question batch');if(raw.teamId+'.json'!==f.name)throw Error('Invalid archived team file');return {teamId:r.teamId,teamName:r.teamName,score:r.score,elapsedMs:r.elapsedMs};}));rows.push(...batch);}return rank(rows);}};
}
