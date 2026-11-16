import {cp} from 'node:fs/promises';
await cp('public','dist',{recursive:true});console.log('Static game and nested artwork copied to dist; Vercel handlers remain in api/.');
