(function(){
  "use strict";
  var expo=function(t){return t===1?1:1-Math.pow(2,-10*t)};
  var inOutQuart=function(t){return t<.5?8*t*t*t*t:1-Math.pow(-2*t+2,4)/2};
  var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  var touch=matchMedia("(hover: none)").matches;

  /* ---------- preloader ---------- */
  var pre=document.getElementById("preload");
  function hidePre(){if(pre)setTimeout(function(){pre.classList.add("done")},700)}
  if(document.readyState==="complete")hidePre();else addEventListener("load",hidePre);

  /* ---------- smooth inertia scroll ---------- */
  /* lerp = how quickly the page catches up to the wheel (lower = silkier). Try .05 – .12 */
  var lenis=null,tasks=[];
  if(window.Lenis&&!reduce){
    lenis=new Lenis({lerp:.075,smoothWheel:true,wheelMultiplier:.85,touchMultiplier:1.4,syncTouch:false});
  }
  /* ONE animation loop drives scroll, cursor and snow */
  (function raf(t){
    if(lenis)lenis.raf(t);
    for(var i=0;i<tasks.length;i++)tasks[i](t);
    requestAnimationFrame(raf);
  })(0);

  function goTo(t){
    if(lenis)lenis.scrollTo(t,{offset:-80,duration:2.4,easing:inOutQuart});
    else window.scrollTo({top:t.getBoundingClientRect().top+scrollY-80,behavior:"smooth"});
  }
  [].slice.call(document.querySelectorAll('a[href^="#"]')).forEach(function(a){
    a.addEventListener("click",function(e){
      var id=a.getAttribute("href");if(id.length<2)return;
      var t=document.querySelector(id);if(!t)return;
      e.preventDefault();goTo(t);
    });
  });

  /* ---------- progress bar, active link, parallax, aurora hue ---------- */
  var bar=document.getElementById("progress");
  var map=[].slice.call(document.querySelectorAll(".links a")).map(function(a){return{a:a,s:document.querySelector(a.getAttribute("href"))}});
  var fill=document.querySelector(".timeline .fill"),tl=document.querySelector(".timeline");
  var aurora=document.querySelector(".aurora"),root=document.documentElement;
  var toneSecs=[].slice.call(document.querySelectorAll("section[data-tone]"));
  var ticking=false,lastActive=null,lastHue=-1;
  function update(){
    ticking=false;
    var y0=window.scrollY,h=root.scrollHeight-innerHeight;
    bar.style.transform="scaleX("+(h>0?y0/h:0)+")";
    var y=y0+innerHeight*.4,cur=null;
    for(var i=0;i<map.length;i++){if(map[i].s&&map[i].s.offsetTop<=y)cur=map[i]}
    if(cur!==lastActive){
      map.forEach(function(m){m.a.classList.toggle("sg-active",m===cur)});
      lastActive=cur;
    }
    if(tl){var r=tl.getBoundingClientRect(),p=(innerHeight*.6-r.top)/r.height;fill.style.transform="scaleY("+Math.max(0,Math.min(1,p))+")"}
    if(!reduce){
      if(y0<innerHeight*1.2){
        root.style.setProperty("--py",(y0*-.12).toFixed(1)+"px");
        root.style.setProperty("--ty",(y0*.06).toFixed(1)+"px");
      }
      if(aurora)aurora.style.marginTop=(y0*-.03).toFixed(1)+"px";
      var mid=y0+innerHeight*.5,tone=200;
      for(var k=0;k<toneSecs.length;k++){if(toneSecs[k].offsetTop<=mid)tone=+toneSecs[k].dataset.tone}
      if(tone!==lastHue){lastHue=tone;root.style.setProperty("--hue",(tone-200)+"deg")}
    }
  }
  function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(update)}}
  addEventListener("scroll",onScroll,{passive:true});update();

  /* ---------- split headings into words ---------- */
  document.querySelectorAll("[data-split]").forEach(function(el){
    (function walk(node){
      [].slice.call(node.childNodes).forEach(function(n){
        if(n.nodeType===3){
          var frag=document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function(w){
            if(!w.trim()){frag.appendChild(document.createTextNode(w));return}
            var o=document.createElement("span");o.className="w";var i=document.createElement("span");i.textContent=w;o.appendChild(i);frag.appendChild(o);
          });
          node.replaceChild(frag,n);
        }else if(n.nodeType===1&&!n.classList.contains("w"))walk(n);
      });
    })(el);
    el.querySelectorAll(".w>span").forEach(function(s,i){s.style.transitionDelay=(i*70)+"ms"});
  });

  /* ---------- reveal on scroll ---------- */
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){
      e.target.classList.add("in");io.unobserve(e.target);
      /* clear stagger delay after reveal so hover/tilt respond instantly */
      setTimeout(function(){e.target.style.transitionDelay="0ms"},1400);
    }
  })},{threshold:.15,rootMargin:"0px 0px -6% 0px"});
  document.querySelectorAll("[data-r],[data-split]").forEach(function(el,i){
    if(el.hasAttribute("data-r")&&!el.closest("#home"))el.style.transitionDelay=((i%4)*90)+"ms";
    io.observe(el);
  });

  /* ---------- count-up numbers ---------- */
  var co=new IntersectionObserver(function(es){es.forEach(function(e){
    if(!e.isIntersecting)return;co.unobserve(e.target);
    var el=e.target,end=+el.dataset.count,t0=null,plus=el.hasAttribute("data-plus");
    (function step(ts){t0=t0||ts;var p=Math.min((ts-t0)/1800,1);el.textContent=Math.round(end*expo(p)).toLocaleString("en-US")+(plus&&p===1?"+":"");if(p<1)requestAnimationFrame(step)})(performance.now());
  })},{threshold:.6});
  document.querySelectorAll("[data-count]").forEach(function(el){co.observe(el)});

  /* ---------- spotlight on cards ---------- */
  document.querySelectorAll(".card,.stat").forEach(function(c){
    c.addEventListener("pointermove",function(e){var r=c.getBoundingClientRect();
      c.style.setProperty("--mx",(e.clientX-r.left)+"px");c.style.setProperty("--my",(e.clientY-r.top)+"px")});
  });

  /* ---------- magnetic buttons + 3D tilt (desktop only) ---------- */
  if(!touch&&!reduce){
    [].forEach.call(document.querySelectorAll(".mag"),function(el){
      el.addEventListener("pointermove",function(e){
        var r=el.getBoundingClientRect();
        el.style.transform="translate3d("+((e.clientX-r.left-r.width/2)*.25)+"px,"+((e.clientY-r.top-r.height/2)*.35)+"px,0)";
      });
      el.addEventListener("pointerleave",function(){el.style.transform=""});
    });
    [].forEach.call(document.querySelectorAll(".tilt"),function(c){
      c.addEventListener("pointerenter",function(){c.style.transitionDelay="0ms"});
      c.addEventListener("pointermove",function(e){
        var r=c.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;
        c.style.transform="perspective(900px) rotateX("+(-py*7).toFixed(2)+"deg) rotateY("+(px*9).toFixed(2)+"deg) translateY(-8px)";
      });
      c.addEventListener("pointerleave",function(){c.style.transform=""});
    });
  }

  /* ---------- github-style heat map ---------- */
  var heat=document.getElementById("heat"),lv=["rgba(159,227,255,.07)","rgba(79,184,255,.3)","rgba(79,184,255,.55)","rgba(159,227,255,.8)","#fff"];
  for(var i=0;i<26*7;i++){var c=document.createElement("i"),r=Math.random();
    c.style.background=lv[r<.3?0:r<.55?1:r<.8?2:r<.93?3:4];c.style.transitionDelay=(i*6)+"ms";heat.appendChild(c)}

  /* ---------- custom cursor ---------- */
  var cur=document.querySelector(".cursor"),cx=0,cy=0,tx=0,ty=0;
  addEventListener("pointermove",function(e){tx=e.clientX;ty=e.clientY},{passive:true});
  tasks.push(function(){
    cx+=(tx-cx)*.16;cy+=(ty-cy)*.16;
    cur.style.transform="translate3d("+cx+"px,"+cy+"px,0)";
  });
  document.querySelectorAll("a,.btn,.card,.proj").forEach(function(el){
    el.addEventListener("pointerenter",function(){cur.classList.add("hover")});
    el.addEventListener("pointerleave",function(){cur.classList.remove("hover")});
  });

  /* ---------- falling snow + leaves (leaves fall on the LEFT side) ---------- */
  var greens=["#6fcf9a","#9be3b5","#4fb88a","#b8f0c8","#e8b866","#d98e4a"];
  var cv=document.getElementById("snow"),ctx=cv.getContext("2d"),W,H,flakes=[],leaves=[],dpr=Math.min(devicePixelRatio||1,2);
  function size(){W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
  size();addEventListener("resize",size);
  for(var k=0;k<90;k++)flakes.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.8+.4,s:Math.random()*.6+.2,d:Math.random()*Math.PI*2});
  var mx=0;addEventListener("pointermove",function(e){mx=(e.clientX/innerWidth-.5)},{passive:true});

  function spawn(l,first){
    if(Math.random()<.65){l.x=-20-Math.random()*40;l.y=Math.random()*H*.7}
    else{l.x=Math.random()*W*.12;l.y=-20-Math.random()*40}
    l.vx=.35+Math.random()*.6;l.vy=.6+Math.random()*.8;
    l.ph=Math.random()*6.28;l.rot=Math.random()*6.28;l.rs=(Math.random()-.5)*.04;
    l.sz=6+Math.random()*9;l.col=greens[(Math.random()*greens.length)|0];
    l.wait=first?Math.random()*700:Math.random()*90;
    if(first&&Math.random()<.5){l.x=Math.random()*W*.25;l.y=Math.random()*H*.8}
  }
  for(var q=0;q<30;q++){var lf={};spawn(lf,true);leaves.push(lf)}

  function drawLeaf(l){
    var s=l.sz,flip=Math.cos(l.ph*.8);
    ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.rot);ctx.scale(Math.max(.25,Math.abs(flip)),1);
    ctx.globalAlpha=.9;ctx.fillStyle=l.col;
    ctx.beginPath();ctx.moveTo(0,-s);
    ctx.bezierCurveTo(s*.8,-s*.4,s*.8,s*.5,0,s);
    ctx.bezierCurveTo(-s*.8,s*.5,-s*.8,-s*.4,0,-s);ctx.fill();
    ctx.globalAlpha=.4;ctx.strokeStyle="#0a1a33";ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(0,s);ctx.stroke();
    ctx.restore();
  }

  if(!reduce)tasks.push(function(){
    if(document.hidden)return;
    ctx.clearRect(0,0,W,H);
    for(var i=0;i<flakes.length;i++){
      var f=flakes[i];
      f.y+=f.s;f.d+=.01;f.x+=Math.sin(f.d)*.3+mx*.4;
      if(f.y>H){f.y=-5;f.x=Math.random()*W}if(f.x>W)f.x=0;if(f.x<0)f.x=W;
      ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,6.283);ctx.fillStyle="rgba(200,235,255,"+(.25+f.r/4)+")";ctx.fill();
    }
    for(var j=0;j<leaves.length;j++){
      var l=leaves[j];
      if(l.wait>0){l.wait--;continue}
      l.ph+=.035;l.rot+=l.rs+Math.sin(l.ph)*.015;
      l.x+=l.vx*.6+Math.sin(l.ph)*.9;
      l.y+=l.vy;
      if(l.y>H+20||l.x>W*.55)spawn(l);
      drawLeaf(l);
    }
  });

  document.getElementById("yr").textContent=new Date().getFullYear();
})();