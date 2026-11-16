import {randomUUID} from 'node:crypto';
// One non-forced Git commit archives both identity and score or changes neither.
export function adminStore(c,fetcher=fetch){
 const base=`https://api.github.com/repos/${c.repo}`;
 async function api(path,method='GET',body){
  const res=await fetcher(base+path,{method,headers:{Authorization:`Bearer ${c.token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Object.assign(Error(res.status===422?'The archive changed. Reload the list before clearing.':'GitHub archive access failed. Check repository access and Contents read/write permission.'),{status:res.status===422?409:503});return res.json();
 }
 async function preview(){
  const ref=await api('/git/ref/heads/'+encodeURIComponent(c.branch)),revision=ref.object.sha;
  const commit=await api('/git/commits/'+revision),tree=await api('/git/trees/'+commit.tree.sha+'?recursive=1');
  if(tree.truncated||!Array.isArray(tree.tree))throw Error('Archive listing incomplete; cleanup refused');
  const allowed=new RegExp('^(results|registrations)/'+c.event+'/([-A-Z0-9]{2,20})\\.json$');
  const files=tree.tree.filter(x=>x.type==='blob'&&allowed.test(x.path));
  if(files.length>1000)throw Error('Too many entries for one cleanup');
  const teams=new Map();
  for(const file of files){const [kind,,name]=file.path.split('/'),id=name.slice(0,-5);let team=teams.get(id);if(!team){team={teamId:id,teamName:id,hasScore:false};teams.set(id,team);}if(kind==='results')team.hasScore=true;}
  // Names are displayed to organisers; private registration keys never leave server.
  for(let i=0;i<files.length;i+=5){await Promise.all(files.slice(i,i+5).map(async file=>{const blob=await api('/git/blobs/'+file.sha);let raw;try{raw=JSON.parse(Buffer.from(blob.content,'base64').toString('utf8'));}catch{throw Error('Invalid archive entry; cleanup refused');}if(typeof raw.teamName==='string')teams.get(file.path.split('/').at(-1).slice(0,-5)).teamName=raw.teamName;}));}
  return {revision,baseTree:commit.tree.sha,files,teams:[...teams.values()].sort((a,b)=>a.teamName.localeCompare(b.teamName))};
 }
 async function clear({revision,teamIds,confirmation}){
  if(confirmation!=='CLEAR'||!Array.isArray(teamIds)||!teamIds.length||teamIds.length>1000||teamIds.some(id=>!/^[-A-Z0-9]{2,20}$/.test(id))||new Set(teamIds).size!==teamIds.length)throw Object.assign(Error('Select teams and type CLEAR.'),{status:400});
  const plan=await preview();if(plan.revision!==revision)throw Object.assign(Error('Results changed since preview. Reload the list and review again.'),{status:409});
  const ids=new Set(teamIds);if(teamIds.some(id=>!plan.teams.some(t=>t.teamId===id)))throw Object.assign(Error('A selected team is no longer in this event.'),{status:409});
  const selected=plan.files.filter(f=>ids.has(f.path.split('/').at(-1).slice(0,-5))),archive='trial-archives/'+c.event+'/'+randomUUID();
  const changes=selected.flatMap(file=>[{path:archive+'/'+file.path,mode:'100644',type:'blob',sha:file.sha},{path:file.path,mode:'100644',type:'blob',sha:null}]);
  const tree=await api('/git/trees','POST',{base_tree:plan.baseTree,tree:changes});
  const commit=await api('/git/commits','POST',{message:`Archive ${teamIds.length} trial teams for ${c.event}`,tree:tree.sha,parents:[revision]});
  // A concurrent submission makes this non-fast-forward; never force or delete its work.
  await api('/git/refs/heads/'+encodeURIComponent(c.branch),'PATCH',{sha:commit.sha,force:false});
  return {cleared:teamIds.length,archive,revision:commit.sha};
 }
 return {preview,clear};
}
