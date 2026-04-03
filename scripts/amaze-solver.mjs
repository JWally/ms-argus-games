#!/usr/bin/env node
// ── AMAZE Solver: Greedy vs Simulated Annealing ──────────────────────────
//
// Usage:  node scripts/amaze-solver.mjs [size=12] [trials=5] [iters=300000]
//
// For each trial:
//   1. Generate a random maze
//   2. Compute lower bound (minimum possible moves for this maze)
//   3. Run greedy baseline
//   4. Strip redundant moves from greedy (free wins)
//   5. Run SA initialized from trimmed greedy
//   6. Report all three vs the lower bound

const size  = parseInt(process.argv[2]) || 12;
const TRIALS = parseInt(process.argv[3]) || 5;
const ITERS  = parseInt(process.argv[4]) || 300_000;

// ── Direction constants ───────────────────────────────────────────────────

const DIRS    = ['n','s','e','w'];
const DELTA   = { n:[-1,0], s:[1,0], e:[0,1], w:[0,-1] };
const OPP     = { n:'s', s:'n', e:'w', w:'e' };
const PERPS   = { n:['e','w'], s:['e','w'], e:['n','s'], w:['n','s'] };

// ── Maze generation (recursive backtracker) ───────────────────────────────

function generateMaze(sz) {
  const walls = Array.from({length: sz}, () =>
    Array.from({length: sz}, () => ({n:true,s:true,e:true,w:true}))
  );
  const vis = Array.from({length: sz}, () => new Array(sz).fill(false));
  const stk = [[0,0]];
  vis[0][0] = true;
  while (stk.length) {
    const [r,c] = stk[stk.length-1];
    const nbrs = [];
    for (const d of DIRS) {
      const [dr,dc] = DELTA[d];
      const nr=r+dr, nc=c+dc;
      if (nr>=0&&nr<sz&&nc>=0&&nc<sz&&!vis[nr][nc]) nbrs.push([d,nr,nc]);
    }
    if (!nbrs.length) { stk.pop(); continue; }
    const [d,nr,nc] = nbrs[Math.floor(Math.random()*nbrs.length)];
    walls[r][c][d] = false;
    walls[nr][nc][OPP[d]] = false;
    vis[nr][nc] = true;
    stk.push([nr,nc]);
  }
  return walls;
}

// ── Slide simulation (matches engine.ts junction-stop mechanic) ───────────

function doSlide(walls, sz, r, c, dir, painted) {
  const [dr,dc] = DELTA[dir];
  const [p1,p2] = PERPS[dir];
  let nr=r, nc=c, moved=false, gained=0;
  while (!walls[nr][nc][dir]) {
    nr+=dr; nc+=dc; moved=true;
    if (!painted[nr*sz+nc]) { gained++; }
    if (!walls[nr][nc][p1]||!walls[nr][nc][p2]) break;
  }
  return moved ? {r:nr, c:nc, gained} : null;
}

// ── Full sequence simulation ──────────────────────────────────────────────
// Returns { moveCount, won, r, c, painted }

function simulate(walls, sz, moves) {
  const painted = new Uint8Array(sz*sz);
  painted[0] = 1;
  let paintedCount=1, r=0, c=0, moveCount=0;
  for (const dir of moves) {
    const res = doSlide(walls, sz, r, c, dir, painted);
    if (!res) continue;
    r = res.r; c = res.c;
    // apply paint
    const [dr,dc] = DELTA[dir]; const [p1,p2] = PERPS[dir];
    let tr=r-(r-res.r ? Math.sign(res.r-r)*0 : 0), tc=c; // re-walk to paint
    // Re-walk from old position to apply paint
    let or2=r, oc2=c; // we need old r,c... restructure below
    moveCount++;
    paintedCount += res.gained; // approximation — see full walk below
    if (paintedCount===sz*sz) return {moveCount,won:true,r,c,painted};
  }
  return {moveCount, won:paintedCount===sz*sz, r, c, painted};
}

// Full simulation that tracks exact paint (walks through each slide)
function simulateFull(walls, sz, moves) {
  const painted = new Uint8Array(sz*sz);
  painted[0]=1;
  let paintedCount=1, r=0, c=0, moveCount=0;
  for (const dir of moves) {
    const [dr,dc] = DELTA[dir];
    const [p1,p2] = PERPS[dir];
    let tr=r, tc=c, moved=false;
    while (!walls[tr][tc][dir]) {
      tr+=dr; tc+=dc; moved=true;
      if (!painted[tr*sz+tc]) { painted[tr*sz+tc]=1; paintedCount++; }
      if (!walls[tr][tc][p1]||!walls[tr][tc][p2]) break;
    }
    if (moved) { r=tr; c=tc; moveCount++; }
    if (paintedCount===sz*sz) return {moveCount,won:true,r,c,painted};
  }
  return {moveCount, won:paintedCount===sz*sz, r, c, painted};
}

// ── Greedy solver ─────────────────────────────────────────────────────────

function greedySolve(walls, sz, r0=0, c0=0, initPainted=null, initCount=1) {
  const painted = initPainted ? new Uint8Array(initPainted) : new Uint8Array(sz*sz);
  if (!initPainted) painted[0]=1;
  let r=r0, c=c0, paintedCount=initCount;
  const moves=[];
  const MAX=sz*sz*8;

  while (paintedCount<sz*sz && moves.length<MAX) {
    let bestDir=null, bestGain=0;
    for (const dir of DIRS) {
      const [dr,dc]=DELTA[dir]; const [p1,p2]=PERPS[dir];
      let tr=r,tc=c,g=0;
      while(!walls[tr][tc][dir]){tr+=dr;tc+=dc;if(!painted[tr*sz+tc])g++;if(!walls[tr][tc][p1]||!walls[tr][tc][p2])break;}
      if(g>bestGain){bestGain=g;bestDir=dir;}
    }

    if (bestDir) {
      const [dr,dc]=DELTA[bestDir];const [p1,p2]=PERPS[bestDir];
      while(!walls[r][c][bestDir]){r+=dr;c+=dc;if(!painted[r*sz+c]){painted[r*sz+c]=1;paintedCount++;}if(!walls[r][c][p1]||!walls[r][c][p2])break;}
      moves.push(bestDir);
    } else {
      const path = bfsProgress(walls,sz,r,c,painted);
      if (!path.length) break;
      for (const dir of path) {
        const [dr,dc]=DELTA[dir];const [p1,p2]=PERPS[dir];
        while(!walls[r][c][dir]){r+=dr;c+=dc;if(!painted[r*sz+c]){painted[r*sz+c]=1;paintedCount++;}if(!walls[r][c][p1]||!walls[r][c][p2])break;}
        moves.push(dir);
      }
    }
  }
  return moves;
}

function bfsProgress(walls, sz, r, c, painted) {
  const vis=new Set([`${r},${c}`]);
  const q=[{r,c,path:[]}];
  while(q.length){
    const{r:cr,c:cc,path}=q.shift();
    for(const dir of DIRS){
      const[dr,dc]=DELTA[dir];const[p1,p2]=PERPS[dir];
      let tr=cr,tc=cc,g=0;
      while(!walls[tr][tc][dir]){tr+=dr;tc+=dc;if(!painted[tr*sz+tc])g++;if(!walls[tr][tc][p1]||!walls[tr][tc][p2])break;}
      if(g>0) return path;
    }
    for(const dir of DIRS){
      const[dr,dc]=DELTA[dir];const[p1,p2]=PERPS[dir];
      let tr=cr,tc=cc,moved=false;
      while(!walls[tr][tc][dir]){tr+=dr;tc+=dc;moved=true;if(!walls[tr][tc][p1]||!walls[tr][tc][p2])break;}
      if(moved){const k=`${tr},${tc}`;if(!vis.has(k)){vis.add(k);q.push({r:tr,c:tc,path:[...path,dir]});}}
    }
  }
  return [];
}

// ── Redundant move trimmer ────────────────────────────────────────────────
// Removes any move that can be deleted without losing full coverage.

function trimRedundant(walls, sz, moves) {
  let cur = [...moves];
  let i = 0;
  while (i < cur.length) {
    const candidate = [...cur.slice(0,i), ...cur.slice(i+1)];
    const res = simulateFull(walls, sz, candidate);
    if (res.won) {
      cur = candidate; // deleted move was redundant
    } else {
      i++;
    }
  }
  return cur;
}

// ── Energy function ───────────────────────────────────────────────────────
// Energy = moves to full coverage.
// If sequence doesn't complete alone, append greedy suffix from final state.

function energy(walls, sz, moves, maxLen) {
  if (moves.length > maxLen) return Infinity;
  const res = simulateFull(walls, sz, moves);
  if (res.won) return res.moveCount;
  const suffix = greedySolve(walls, sz, res.r, res.c, res.painted, res.paintedCount);
  return res.moveCount + suffix.length;
}

// ── SA neighbor operators ─────────────────────────────────────────────────

function neighbor(moves, rng) {
  const n = moves.length;
  if (n === 0) return [DIRS[Math.floor(rng()*4)]];
  const op = rng();
  const arr = [...moves];

  if (op < 0.30) {
    // Replace one move
    const i = Math.floor(rng()*n);
    arr[i] = DIRS[Math.floor(rng()*4)];

  } else if (op < 0.55) {
    // Swap two moves
    const i=Math.floor(rng()*n), j=Math.floor(rng()*n);
    [arr[i],arr[j]]=[arr[j],arr[i]];

  } else if (op < 0.72) {
    // Reverse a short segment (2-opt)
    const i=Math.floor(rng()*n);
    const len=Math.floor(rng()*8)+2;
    const j=Math.min(i+len,n);
    arr.splice(i,j-i,...moves.slice(i,j).reverse());

  } else if (op < 0.86) {
    // Delete 1–3 moves
    const i=Math.floor(rng()*n);
    const len=Math.min(Math.floor(rng()*3)+1, n-i);
    arr.splice(i,len);

  } else {
    // Insert 1–2 random moves
    const i=Math.floor(rng()*(n+1));
    const count=Math.floor(rng()*2)+1;
    for(let k=0;k<count;k++) arr.splice(i+k,0,DIRS[Math.floor(rng()*4)]);
  }

  return arr;
}

// ── Lower bound via junction tree ─────────────────────────────────────────
// Build the slide-graph, find its tree structure, compute:
//   lower_bound = 2 * E - (longest path from (0,0) to any reachable node)
// Every edge must be traversed at least once; we save L traversals on the
// "trunk" (the deepest path we take last and never backtrack from).

function lowerBound(walls, sz) {
  // Build adjacency list of stopping-position graph.
  const adj = new Map();
  const visit = new Set(['0,0']);
  const q = [{r:0,c:0}];
  adj.set('0,0',[]);

  while (q.length) {
    const{r,c}=q.shift();
    const key=`${r},${c}`;
    for (const dir of DIRS) {
      const[dr,dc]=DELTA[dir];const[p1,p2]=PERPS[dir];
      let tr=r,tc=c,moved=false;
      while(!walls[tr][tc][dir]){tr+=dr;tc+=dc;moved=true;if(!walls[tr][tc][p1]||!walls[tr][tc][p2])break;}
      if(!moved) continue;
      const dest=`${tr},${tc}`;
      adj.get(key).push(dest);
      if(!visit.has(dest)){
        visit.add(dest);
        adj.set(dest,[]);
        q.push({r:tr,c:tc});
      }
    }
  }

  const E = [...adj.values()].reduce((s,v)=>s+v.length,0)/2;

  // BFS from '0,0' to find maximum depth.
  const dist=new Map([['0,0',0]]);
  const bq=[['0,0']];
  let maxDist=0;
  while(bq.length){
    const[k]=bq.shift();
    for(const nb of adj.get(k)){
      if(!dist.has(nb)){dist.set(nb,dist.get(k)+1);maxDist=Math.max(maxDist,dist.get(nb));bq.push([nb]);}
    }
  }

  return Math.round(2*E - maxDist);
}

// ── Simulated Annealing ───────────────────────────────────────────────────

function runSA(walls, sz, initial, iters) {
  // Simple xorshift RNG for speed.
  let seed = Date.now() ^ (Math.random()*2**32>>>0);
  function rng() {
    seed ^= seed<<13; seed ^= seed>>17; seed ^= seed<<5;
    return (seed>>>0)/2**32;
  }

  const maxLen = Math.ceil(initial.length * 2.5);
  let cur  = [...initial];
  let curE = energy(walls, sz, cur, maxLen);
  let best = [...cur];
  let bestE = curE;

  // Temperature schedule: cool from T0 so that at end T ≈ 0.5
  const T0 = 15;
  const cooling = Math.pow(0.5/T0, 1/iters);  // T0 * cooling^iters = 0.5
  let T = T0;

  let accepted=0, improved=0;

  for (let i=0; i<iters; i++) {
    const next  = neighbor(cur, rng);
    const nextE = energy(walls, sz, next, maxLen);

    if (nextE < Infinity) {
      const delta = nextE - curE;
      if (delta<0 || rng()<Math.exp(-delta/T)) {
        cur=next; curE=nextE; accepted++;
        if(curE<bestE){ best=[...cur]; bestE=curE; improved++; }
      }
    }

    T *= cooling;
  }

  return { score: bestE, moves: best, accepted, improved };
}

// ── Main ──────────────────────────────────────────────────────────────────

const COL = { reset:'\x1b[0m', dim:'\x1b[2m', green:'\x1b[32m', yellow:'\x1b[33m', cyan:'\x1b[36m', bold:'\x1b[1m' };
const pad  = (s,n) => String(s).padStart(n);

const sz = size;
console.log(`\n${COL.bold}AMAZE Solver — ${sz}×${sz} | ${TRIALS} trials | ${ITERS.toLocaleString()} SA iterations${COL.reset}\n`);
console.log(`${'─'.repeat(68)}`);
console.log(`${COL.dim}  #   lower-bound   greedy   trimmed   SA         vs-greedy   vs-bound${COL.reset}`);
console.log(`${'─'.repeat(68)}`);

let totals = { lb:0, greedy:0, trim:0, sa:0 };

for (let t=0; t<TRIALS; t++) {
  const walls = generateMaze(sz);

  const lb      = lowerBound(walls, sz);
  const greedy  = greedySolve(walls, sz);
  const trimmed = trimRedundant(walls, sz, greedy);

  process.stdout.write(`  ${pad(t+1,2)}  ${pad(lb,6)}       ${pad(greedy.length,6)}   ${pad(trimmed.length,6)}    (running...)\r`);

  const t0   = Date.now();
  const sa   = runSA(walls, sz, trimmed, ITERS);
  const secs = ((Date.now()-t0)/1000).toFixed(1);

  const vsGreedy = greedy.length - sa.score;
  const vsBound  = sa.score - lb;

  const vsGreedyStr = vsGreedy>0 ? `${COL.green}-${vsGreedy}${COL.reset}` : `${COL.dim}  0${COL.reset}`;
  const vsBoundStr  = vsBound===0 ? `${COL.green}OPTIMAL${COL.reset}` : `${COL.yellow}+${vsBound}${COL.reset}`;

  console.log(`  ${pad(t+1,2)}  ${pad(lb,6)}       ${pad(greedy.length,6)}   ${pad(trimmed.length,6)}    ${pad(sa.score,4)} (${secs}s)   ${vsGreedyStr.padStart(8)}   ${vsBoundStr}`);

  totals.lb+=lb; totals.greedy+=greedy.length; totals.trim+=trimmed.length; totals.sa+=sa.score;
}

console.log(`${'─'.repeat(68)}`);
const avg = k => (totals[k]/TRIALS).toFixed(1);
console.log(`${COL.bold}  avg ${pad(avg('lb'),9)}  ${pad(avg('greedy'),9)}  ${pad(avg('trim'),9)}  ${pad(avg('sa'),5)}${COL.reset}`);
console.log();
console.log(`${COL.dim}lower-bound = 2×E − depth, where E = edges in junction tree, depth = longest slide-path from start${COL.reset}`);
console.log();
