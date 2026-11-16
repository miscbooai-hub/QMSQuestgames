// Small legal endgame engine for the three-piece mate-in-two unlock.
// Coordinates: a8=0 ... h1=63. No pawns/castling/en-passant occur here.
const row=s=>Math.floor(s/8),col=s=>s%8;
const adjacent=(a,b)=>Math.max(Math.abs(row(a)-row(b)),Math.abs(col(a)-col(b)))===1;
const kingDirections=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
export const squareName=s=>'abcdefgh'[col(s)]+(8-row(s));
export function queenAttacks(p,square){if(p.q===null||p.q===square)return false;const dr=row(square)-row(p.q),dc=col(square)-col(p.q);if(dr!==0&&dc!==0&&Math.abs(dr)!==Math.abs(dc))return false;const sr=Math.sign(dr),sc=Math.sign(dc);for(let r=row(p.q)+sr,c=col(p.q)+sc;r!==row(square)||c!==col(square);r+=sr,c+=sc)if(r*8+c===p.w)return false;return true;}
export const blackInCheck=p=>adjacent(p.w,p.b)||queenAttacks(p,p.b);
export function blackMoves(p){const moves=[];for(const [dr,dc]of kingDirections){const r=row(p.b)+dr,c=col(p.b)+dc;if(r<0||r>7||c<0||c>7)continue;const to=r*8+c;if(to===p.w||adjacent(to,p.w))continue;const next={...p,b:to,q:to===p.q?null:p.q};if(!blackInCheck(next))moves.push({piece:'b',from:p.b,to,position:next});}return moves;}
export function whiteMoves(p){const moves=[];for(const [dr,dc]of kingDirections){const r=row(p.w)+dr,c=col(p.w)+dc;if(r<0||r>7||c<0||c>7)continue;const to=r*8+c;if(to===p.q||to===p.b||adjacent(to,p.b))continue;moves.push({piece:'w',from:p.w,to,position:{...p,w:to}});}if(p.q!==null)for(const [dr,dc]of kingDirections)for(let r=row(p.q)+dr,c=col(p.q)+dc;r>=0&&r<8&&c>=0&&c<8;r+=dr,c+=dc){const to=r*8+c;if(to===p.w||to===p.b)break;moves.push({piece:'q',from:p.q,to,position:{...p,q:to}});}return moves;}
export const isCheckmate=p=>blackInCheck(p)&&blackMoves(p).length===0;
export const isStalemate=p=>!blackInCheck(p)&&blackMoves(p).length===0;
export const mateInOne=p=>whiteMoves(p).filter(m=>isCheckmate(m.position));
export function mateInTwoKeys(p){return whiteMoves(p).filter(m=>{const replies=blackMoves(m.position);return replies.length>0&&replies.every(r=>mateInOne(r.position).length>0);});}
export function legalEndgame(p){return p&&Number.isInteger(p.w)&&Number.isInteger(p.b)&&[p.w,p.b].every(s=>s>=0&&s<64)&&(p.q===null||Number.isInteger(p.q)&&p.q>=0&&p.q<64)&&p.w!==p.b&&p.q!==p.w&&p.q!==p.b&&!adjacent(p.w,p.b);}
export const CHESS_START={w:3,q:4,b:0};
export function newChess(){return {version:1,position:{...CHESS_START},selected:null,moves:0,history:[],lastWhite:null,lastBlack:null};}
export function validChess(c){return !!c&&c.version===1&&legalEndgame(c.position)&&[null,'w','q'].includes(c.selected)&&Number.isInteger(c.moves)&&c.moves>=0&&c.moves<=2&&Array.isArray(c.history)&&c.history.length<=4&&c.history.every(s=>typeof s==='string');}
export function chessTargets(c){return c.selected?whiteMoves(c.position).filter(m=>m.piece===c.selected):[];}
export function chessTap(original,square){if(!validChess(original))throw Error('Invalid chess puzzle');const c=structuredClone(original);if(!Number.isInteger(square)||square<0||square>63)return {chess:c,won:false,message:'Choose a square on the board.'};const piece=square===c.position.w?'w':square===c.position.q?'q':null;
 if(piece){c.selected=c.selected===piece?null:piece;return {chess:c,won:false,message:c.selected?(piece==='w'?'King':'Queen')+' selected. Tap a marked destination.':'Tap your king or queen to select it.'};}
 const move=chessTargets(c).find(m=>m.to===square);if(!move)return {chess:c,won:false,message:c.selected?'That square is not a legal move. Choose a marked destination.':'First tap one of your white pieces.'};
 c.position=move.position;c.moves++;c.selected=null;c.lastWhite={from:move.from,to:move.to};c.lastBlack=null;c.history.push((move.piece==='w'?'K':'Q')+squareName(move.to)+(blackInCheck(c.position)?'+':''));
 if(isCheckmate(c.position))return {chess:c,won:true,message:'Checkmate in two! Evidence unlocked.'};
 if(c.moves>=2||isStalemate(c.position))return {chess:newChess(),won:false,message:isStalemate(c.position)?'Stalemate is a draw. Try a different first move.':'Not checkmate in two. The board is reset—try again.'};
 const replies=blackMoves(c.position),reply=replies.find(m=>mateInOne(m.position).length===0)||replies[0];
 c.position=reply.position;c.lastBlack={from:reply.from,to:reply.to};c.history.push('…K'+squareName(reply.to));
 return {chess:c,won:false,message:'Black moved to '+squareName(reply.to)+'. Your second move: find checkmate.'};
}
