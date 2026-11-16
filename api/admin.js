import {createHash,timingSafeEqual} from 'node:crypto';
import {config} from '../backend/store.mjs';
import {adminStore} from '../backend/admin-store.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
 const expected=process.env.ADMIN_KEY||'',supplied=req.headers?.['x-admin-key'];
 if(expected.length<20)return res.status(503).json({error:'Organiser cleanup is disabled. Configure ADMIN_KEY with at least 20 characters in Vercel and redeploy.'});
 if(typeof supplied!=='string'||supplied.length>256||!timingSafeEqual(createHash('sha256').update(expected).digest(),createHash('sha256').update(supplied).digest()))return res.status(403).json({error:'Incorrect organiser key'});
 try{if(Number(req.headers?.['content-length'])>30000)return res.status(413).json({error:'Request too large'});const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(JSON.stringify(body||{}).length>30000)return res.status(413).json({error:'Request too large'});const c=config(),store=adminStore(c);
  if(body?.action==='preview'){const p=await store.preview();return res.status(200).json({eventId:c.event,revision:p.revision,teams:p.teams});}
  if(body?.action==='clear')return res.status(200).json(await store.clear(body));
  return res.status(400).json({error:'Choose preview or clear'});
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Cleanup unavailable; no successful change confirmed. Reload the list to check the current state.'});}
}
