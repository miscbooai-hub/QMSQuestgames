import {config,authenticate,normalise,createStore} from '../backend/store.mjs';
let cached=null,expires=0;
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{let c;try{c=config();}catch{return res.status(503).json({error:'Shared scoring is not configured. Your result remains on this device.'});}const store=createStore(c);
 if(req.method==='GET'){if(!cached||Date.now()>expires){cached={rows:await store.list(),updatedAt:new Date().toISOString()};expires=Date.now()+30000;}return res.status(200).json(cached);}
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'});}
 if(Number(req.headers['content-length'])>12000)return res.status(413).json({error:'Result too large'});
 let record;try{const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(JSON.stringify(body).length>12000)throw Error();record=normalise(body);}catch{return res.status(400).json({error:'Invalid result. Five valid mission records are required.'});}
 if(!authenticate(c,record.teamId,req.headers['x-team-code']))return res.status(403).json({error:'Team ID or event team code is incorrect'});
 if(record.batchId!==c.batchId)return res.status(409).json({error:'This result uses a different question batch from the event. Contact the organiser.'});const result=await store.write(record);expires=0;return res.status(200).json(result);
 }catch(e){return res.status(e.status||503).json({error:e.status===409?e.message:'Scoring service is currently unavailable or busy. Your result stays saved on this phone.'});}}
