export const SESSION_KEY='qms-session-v1';
export function gameSettings(raw){if(!raw||!['testing','frozen'].includes(raw.mode)||!['a','b','c','d','e','f','g'].includes(raw.batchId))throw Error('Game setup is unavailable');return {mode:raw.mode,batchId:raw.batchId};}
// Deliberately scoped to this game on this browser. No server or score API calls.
export function resetDevice(storage,settings){if(gameSettings(settings).mode!=='testing')throw Error('Device reset is disabled for the frozen event');storage.removeItem(SESSION_KEY);storage.removeItem('qms-run-history');}
// Rewind only the local testing run. Never carry an official submission credential.
export function replayTestMission(state,settings,index){if(gameSettings(settings).mode!=='testing')throw Error('Mission replay is disabled for the frozen event');if(!state||!Array.isArray(state.run)||!Number.isInteger(index)||index<0||index>=state.run.length)throw Error('Choose a completed mission');return {...state,run:state.run.slice(0,index),miniGame:null,active:null,stage:'intro',attemptId:globalThis.crypto.randomUUID(),practiceReplay:true,submission:'local',teamCode:'',registrationToken:''};}
