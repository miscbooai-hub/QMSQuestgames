import {readFileSync} from 'node:fs';
import {gameSettings} from '../public/device-admin.js';
const defaults=JSON.parse(readFileSync(new URL('../public/game-settings.json',import.meta.url),'utf8'));
export function eventSettings(env=process.env){return gameSettings({mode:env.GAME_MODE||defaults.mode,batchId:env.EVENT_BATCH||defaults.batchId});}
