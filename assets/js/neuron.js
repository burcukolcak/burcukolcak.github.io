/* Neuron web for the home page.
   Space-colonisation growth: targets are scattered over the hero, seeds
   grow toward them and divide only where the targets pull them apart, so
   the growth reaches everywhere and stays one connected structure. Nearby
   tips are then stitched, which puts loops in it. The cursor lights the
   part of the web it is over; on a touch screen the lit area drifts.
   No dependencies. */
(function(){
var cv=document.getElementById('web'), ctx=cv.getContext('2d');
var base=document.createElement('canvas'), bx=base.getContext('2d');
var W=0,H=0,DPR=Math.min(window.devicePixelRatio||1,2);
var segs=[], grid={}, CELL=70, drawn=0, raf=null, t0=performance.now(), accents=[];
var mouse={x:-9e9,y:-9e9}, lit=0, lastTouch=0;
var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var noHover=window.matchMedia&&window.matchMedia('(hover: none)').matches;
var R=200;

function gkey(x,y){ return Math.floor(x/CELL)+','+Math.floor(y/CELL); }
function addSeg(s){
  segs.push(s);
  var k=gkey((s.x0+s.x1)/2,(s.y0+s.y1)/2);
  (grid[k]||(grid[k]=[])).push(segs.length-1);
}

/* ------------------------------------------------------------------
   Space colonisation.
   Instead of placing separate arbors, we scatter targets over the whole
   field and let a few seeds grow toward them. Branches divide only where
   the targets pull them apart, so the growth fills the space it is given
   and arrives everywhere — one continuous structure, no floating pieces.
   Then nearby tips from different branches are stitched together, which
   turns the tree into a web with loops in it.
   ------------------------------------------------------------------ */
function buildNetwork(){
  var D=Math.max(4.5,Math.min(W,H)*0.0085);   // step
  var ATTRACT=D*13, KILL=D*1.5;
  var nA=Math.min(9000,Math.round(W*H/(D*D*4.2)));
  var att=[];
  for(var i=0;i<nA;i++) att.push({x:Math.random()*W, y:Math.random()*H, live:true});

  var nodes=[], ng={};
  function pushNode(x,y,parent){
    nodes.push({x:x,y:y,p:parent,n:0});
    var k=gkey(x,y); (ng[k]||(ng[k]=[])).push(nodes.length-1);
    return nodes.length-1;
  }
  function nodesNear(x,y,r){
    var out=[], g0=Math.floor((x-r)/CELL), g1=Math.floor((x+r)/CELL);
    var h0=Math.floor((y-r)/CELL), h1=Math.floor((y+r)/CELL);
    for(var gx=g0;gx<=g1;gx++) for(var gy=h0;gy<=h1;gy++){
      var b=ng[gx+','+gy]; if(b) out.push.apply(out,b);
    }
    return out;
  }

  // many origins scattered through the field, so no single trunk ever sweeps
  // the whole frame; the stitching below is what makes them one structure
  var seeds=13+Math.floor(Math.random()*6);
  for(var i=0;i<seeds;i++){
    pushNode((0.04+Math.random()*0.92)*W,(0.04+Math.random()*0.92)*H,-1);
  }
  // a placed one, tucked under the Contact link in the top right. It is a
  // seed like any other, so the web grows out of it and stays connected —
  // it is only weighted afterwards so it reads as a deliberate mark.
  var narrow = W < 760;
  accents=[{ x: W - (narrow ? 64 : 96), y: H * (narrow ? 0.22 : 0.165) }];
  for(var i=0;i<accents.length;i++) pushNode(accents[i].x, accents[i].y, -1);

  var guard=0;
  while(guard++<420){
    var pull={}, any=false;
    for(var a=0;a<att.length;a++){
      var A=att[a]; if(!A.live) continue;
      var cand=nodesNear(A.x,A.y,ATTRACT), best=-1, bd=ATTRACT;
      for(var c=0;c<cand.length;c++){
        var N=nodes[cand[c]], d=Math.hypot(N.x-A.x,N.y-A.y);
        if(d<bd){ bd=d; best=cand[c]; }
      }
      if(best<0) continue;
      any=true;
      var v=pull[best]||(pull[best]={x:0,y:0,n:0});
      var L=Math.hypot(A.x-nodes[best].x,A.y-nodes[best].y)||1;
      v.x+=(A.x-nodes[best].x)/L; v.y+=(A.y-nodes[best].y)/L; v.n++;
    }
    if(!any) break;
    for(var key in pull){
      var i0=+key, v=pull[key], N=nodes[i0];
      var L=Math.hypot(v.x,v.y)||1;
      var dx=v.x/L, dy=v.y/L;
      var jitter=0.30;                                   // keeps it from running ruler-straight
      var ang=Math.atan2(dy,dx)+(Math.random()-0.5)*jitter;
      var nx=N.x+Math.cos(ang)*D, ny=N.y+Math.sin(ang)*D;
      if(nx<-0.06*W||nx>1.06*W||ny<-0.06*H||ny>1.06*H) continue;
      pushNode(nx,ny,i0);
    }
    for(var a=0;a<att.length;a++){
      var A=att[a]; if(!A.live) continue;
      var cand=nodesNear(A.x,A.y,KILL);
      for(var c=0;c<cand.length;c++){
        var N=nodes[cand[c]];
        if(Math.hypot(N.x-A.x,N.y-A.y)<KILL){ A.live=false; break; }
      }
    }
    if(nodes.length>14000) break;
  }

  // thickness from how much hangs off each node
  for(var i=nodes.length-1;i>=0;i--){
    nodes[i].n++;
    if(nodes[i].p>=0) nodes[nodes[i].p].n+=nodes[i].n;
  }

  var maxN=1;
  for(var i=0;i<nodes.length;i++) if(nodes[i].n>maxN) maxN=nodes[i].n;

  function bowSeg(x0,y0,x1,y1,w,depth,ink){
    var mx=(x0+x1)/2, my=(y0+y1)/2;
    var ang=Math.atan2(y1-y0,x1-x0), L=Math.hypot(x1-x0,y1-y0);
    var bow=L*0.34*(Math.random()-0.5);
    addSeg({x0:x0,y0:y0,cx:mx-Math.sin(ang)*bow,cy:my+Math.cos(ang)*bow,
            x1:x1,y1:y1,w:w,depth:depth,ink:ink});
  }

  for(var i=0;i<nodes.length;i++){
    var N=nodes[i]; if(N.p<0) continue;
    var P=nodes[N.p];
    var t=Math.pow(N.n/maxN,0.46);
    bowSeg(P.x,P.y,N.x,N.y, 0.30+t*1.15, Math.max(0,8-Math.round(t*8)), 0.62+t*0.62);
  }

  // weight the placed accents: darkest at the mark, fading out
  for(var a=0;a<accents.length;a++){
    var P=accents[a], Rp=58;
    for(var i=0;i<segs.length;i++){
      var S=segs[i];
      var d=Math.hypot((S.x0+S.x1)/2-P.x,(S.y0+S.y1)/2-P.y);
      if(d>Rp*1.7) continue;
      var f=Math.max(0,1-d/(Rp*1.7));
      S.w=Math.max(S.w,0.4+1.7*Math.pow(f,1.2));
      S.ink=Math.max(S.ink||1,0.5+1.25*Math.pow(f,1.1));
    }
  }

  // stitch: join tips that have ended up close to a different branch
  var links=0, want=Math.round(nodes.length*0.14);
  for(var i=0;i<nodes.length && links<want;i++){
    var N=nodes[i];
    if(N.n>8) continue;                       // tips and near-tips
    var cand=nodesNear(N.x,N.y,D*3.2);
    for(var c=0;c<cand.length;c++){
      var j=cand[c]; if(j===i) continue;
      var M=nodes[j];
      if(M.p===i||N.p===j) continue;
      if(M.n>14) continue;
      var d=Math.hypot(M.x-N.x,M.y-N.y);
      if(d<D*0.9||d>D*3.2) continue;
      if(Math.random()<0.75){ bowSeg(N.x,N.y,M.x,M.y,0.42,7,0.5); links++; }
      break;
    }
  }
}

function stroke(c,s,alpha,w){
  c.strokeStyle='rgba(19,19,19,'+alpha+')';
  c.lineWidth=w; c.lineCap='round';
  c.beginPath(); c.moveTo(s.x0,s.y0);
  c.quadraticCurveTo(s.cx,s.cy,s.x1,s.y1); c.stroke();
}
function rest(s){ return Math.max(0.07,(0.30-s.depth*0.016)*(s.ink||1)); }

function advance(){
  if(drawn>=segs.length) return;
  var step=Math.max(40,Math.round(segs.length*0.018));
  var end=Math.min(segs.length,drawn+step);
  for(var i=drawn;i<end;i++) stroke(bx,segs[i],rest(segs[i]),segs[i].w);
  drawn=end;
}

function nearby(x,y,r){
  var out=[], g0=Math.floor((x-r)/CELL), g1=Math.floor((x+r)/CELL);
  var h0=Math.floor((y-r)/CELL), h1=Math.floor((y+r)/CELL);
  for(var gx=g0;gx<=g1;gx++) for(var gy=h0;gy<=h1;gy++){
    var b=grid[gx+','+gy]; if(b) out.push.apply(out,b);
  }
  return out;
}

function frame(now){
  advance();
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(base,0,0,W,H);
  var fx=mouse.x, fy=mouse.y;
  if(noHover && now-lastTouch>2600 && !reduced){
    var t=(now-t0)/1000;
    fx=W*(0.5+0.37*Math.sin(t*0.21)+0.09*Math.sin(t*0.53));
    fy=H*(0.5+0.30*Math.cos(t*0.17)+0.08*Math.cos(t*0.61));
  }
  lit += ((fx>-9e8?1:0)-lit)*0.10;
  if(lit>0.01 && fx>-9e8){
    var ids=nearby(fx,fy,R);
    for(var i=0;i<ids.length;i++){
      var s=segs[ids[i]];
      if(ids[i]>=drawn) continue;
      var dd=Math.hypot((s.x0+s.x1)/2-fx,(s.y0+s.y1)/2-fy);
      if(dd>R) continue;
      var f=Math.pow(1-dd/R,1.3);
      stroke(ctx,s,Math.min(0.20,f*0.20*lit),s.w+2.4*f*lit);
      stroke(ctx,s,Math.min(0.90,f*0.90*lit),s.w+0.6*f*lit);
    }
  }
  raf=requestAnimationFrame(frame);
}

function size(){
  W=cv.clientWidth; H=cv.clientHeight;
  cv.width=W*DPR; cv.height=H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
  base.width=W*DPR; base.height=H*DPR; bx.setTransform(DPR,0,0,DPR,0,0);
  bx.clearRect(0,0,W,H);
  segs=[]; grid={}; drawn=0;
  buildNetwork();
  if(reduced){
    for(var i=0;i<segs.length;i++) stroke(bx,segs[i],rest(segs[i]),segs[i].w);
    drawn=segs.length; ctx.clearRect(0,0,W,H); ctx.drawImage(base,0,0,W,H);
  } else {
    if(raf) cancelAnimationFrame(raf);
    t0=performance.now(); raf=requestAnimationFrame(frame);
  }
}

cv.addEventListener('pointermove',function(e){
  var r=cv.getBoundingClientRect();
  mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top;
  if(e.pointerType!=='mouse') lastTouch=performance.now();
},{passive:true});
cv.addEventListener('pointerdown',function(e){
  var r=cv.getBoundingClientRect();
  mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; lastTouch=performance.now();
},{passive:true});
cv.addEventListener('pointerleave',function(){ mouse.x=-9e9; mouse.y=-9e9; });

window.addEventListener('resize',function(){
  clearTimeout(window.__rz); window.__rz=setTimeout(size,220);
});
size();
})();
