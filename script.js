(function(){
  "use strict";
  var $=function(s,c){return(c||document).querySelector(s)},
      $$=function(s,c){return[].slice.call((c||document).querySelectorAll(s))};
  var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))},
      lerp=function(a,b,t){return a+(b-a)*t},
      ease=function(k,dt){return 1-Math.pow(1-k,dt)},               /* frame-rate independent smoothing */
      ss=function(a,b,x){x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)},
      expo=function(t){return t===1?1:1-Math.pow(2,-10*t)},
      inOutQuart=function(t){return t<.5?8*t*t*t*t:1-Math.pow(-2*t+2,4)/2};
  var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,
      touch=matchMedia("(hover: none)").matches;
  var tasks=[],lenis=null,vw=innerWidth,vh=innerHeight;

  /* ================= SMOOTH SCROLL ================= */
  /* lerp: lower = silkier but floatier. Good range .06 – .11 */
  if(window.Lenis&&!reduce){
    lenis=new Lenis({lerp:.08,smoothWheel:true,wheelMultiplier:.9,touchMultiplier:1.5,syncTouch:false});
    lenis.stop();                                   /* locked until the loader finishes */
  }

  /* ONE loop drives scroll -> UI update -> canvas (always in sync, no 1-frame lag) */
  var lastT=0;
  (function raf(t){
    var dt=Math.min((t-lastT)/16.667,3)||1;lastT=t;
    if(lenis)lenis.raf(t);
    for(var i=0;i<tasks.length;i++)tasks[i](t,dt);
    requestAnimationFrame(raf);
  })(0);

  /* ================= LOADER ================= */
  var ldn=$("#ldn"),ldb=$("#ldb"),loader=$("#loader"),lp=0,loaded=document.readyState==="complete";
  document.body.classList.add("lock");
  addEventListener("load",function(){loaded=true});
  (function tick(){
    lp+=(loaded?4:.7)*(1+Math.random()*.6);
    if(!loaded)lp=Math.min(lp,90);
    var v=Math.min(100,Math.floor(lp));
    ldn.textContent=v;ldb.style.transform="scaleX("+v/100+")";
    if(v<100)return requestAnimationFrame(tick);
    setTimeout(function(){
      loader.classList.add("done");
      document.body.classList.remove("lock");
      document.body.classList.add("ready");
      if(lenis)lenis.start();
      $$("#home [data-r]").forEach(function(e,i){setTimeout(function(){e.classList.add("in")},500+i*140)});
    },250);
  })();

  /* anchor links */
  $$('a[href^="#"]').forEach(function(a){a.addEventListener("click",function(e){
    var id=a.getAttribute("href");if(id.length<2)return;
    var t=$(id);if(!t)return;e.preventDefault();
    if(lenis)lenis.scrollTo(t,{offset:id==="#skills"?0:-10,duration:2.6,easing:inOutQuart});
    else t.scrollIntoView({behavior:"smooth"});
  })});

  /* ================= SPLIT TEXT ================= */
  $$("[data-split]").forEach(function(el){
    (function walk(node){
      [].slice.call(node.childNodes).forEach(function(n){
        if(n.nodeType===3){
          var f=document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function(w){
            if(!w.trim()){f.appendChild(document.createTextNode(w));return}
            var o=document.createElement("span");o.className="w";
            var i=document.createElement("span");i.textContent=w;o.appendChild(i);f.appendChild(o);
          });
          node.replaceChild(f,n);
        }else if(n.nodeType===1&&!n.classList.contains("w"))walk(n);
      });
    })(el);
    $$(".w>span",el).forEach(function(s,i){s.style.transitionDelay=(i*70)+"ms"});
  });

  /* statement words (scroll-scrubbed highlight) */
  var st=$("#statement"),sw=[];
  if(st){
    var words=st.textContent.trim().split(/\s+/);st.textContent="";
    words.forEach(function(w,i){
      var s=document.createElement("span");s.className="sw";s.textContent=w;st.appendChild(s);
      if(i<words.length-1)st.appendChild(document.createTextNode(" "));sw.push(s);
    });
  }

  /* ================= REVEALS ================= */
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){
      var el=e.target;el.classList.add("in");io.unobserve(el);
      setTimeout(function(){el.style.transitionDelay="0ms"},1500);
    }
  })},{threshold:.15,rootMargin:"0px 0px -6% 0px"});
  $$("[data-r],[data-split]").forEach(function(el,i){
    if(el.hasAttribute("data-r")&&!el.closest("#home"))el.style.transitionDelay=((i%4)*90)+"ms";
    if(!el.closest("#home"))io.observe(el);
  });

  /* count-up */
  var co=new IntersectionObserver(function(es){es.forEach(function(e){
    if(!e.isIntersecting)return;co.unobserve(e.target);
    var el=e.target,end=+el.dataset.count,t0=null,plus=el.hasAttribute("data-plus");
    (function step(ts){
      t0=t0||ts;var p=Math.min((ts-t0)/2000,1);
      el.textContent=Math.round(end*expo(p)).toLocaleString("en-US")+(plus&&p===1?"+":"");
      if(p<1)requestAnimationFrame(step);
    })(performance.now());
  })},{threshold:.6});
  $$("[data-count]").forEach(function(el){co.observe(el)});

  /* heat map */
  var heat=$("#heat"),lv=["rgba(168,230,255,.07)","rgba(90,192,255,.3)","rgba(90,192,255,.55)","rgba(168,230,255,.8)","#fff"];
  for(var h=0;h<26*7;h++){
    var c=document.createElement("i"),r=Math.random();
    c.style.background=lv[r<.3?0:r<.55?1:r<.8?2:r<.93?3:4];
    c.style.transitionDelay=(h*6)+"ms";heat.appendChild(c);
  }

  /* ================= SCROLL ENGINE (cached metrics, zero layout reads per frame) ================= */
  var bar=$("#progress"),hs=$("#skills"),track=$("#track"),steps=$$("#steps li"),
      navMap=$$(".top nav a").map(function(a){return{a:a,s:$(a.getAttribute("href")),top:0}}),
      M={max:1,stTop:0,stH:1,hsTop:0,hsTotal:1,trackMax:0,stepC:[]},
      P=0,lastLim=0,lastNav=-2,lastStep=-2,lastTx=null;

  function absTop(el){return el.getBoundingClientRect().top+(window.scrollY||0)}
  function sizeHS(){
    if(innerWidth<=760){hs.style.height="auto";return}
    hs.style.height=(track.scrollWidth-innerWidth+innerHeight*1.15)+"px";
  }
  function measure(){
    vw=innerWidth;vh=innerHeight;sizeHS();
    M.max=document.documentElement.scrollHeight-vh;
    if(st){M.stTop=absTop(st);M.stH=st.offsetHeight}
    M.hsTop=absTop(hs);M.hsTotal=Math.max(1,hs.offsetHeight-vh);M.trackMax=Math.max(0,track.scrollWidth-vw);
    M.stepC=steps.map(function(li){return absTop(li)+li.offsetHeight/2});
    navMap.forEach(function(m){m.top=m.s?absTop(m.s):0});
    lastTx=null;lastNav=-2;lastStep=-2;
    update(lenis?lenis.scroll:window.scrollY);
  }

  function update(y){
    P=M.max>0?clamp(y/M.max,0,1):0;
    bar.style.transform="scaleX("+P.toFixed(4)+")";

    /* active nav link (only touches the DOM when it changes) */
    var mid=y+vh*.4,ni=-1;
    for(var i=0;i<navMap.length;i++)if(navMap[i].top<=mid)ni=i;
    if(ni!==lastNav){navMap.forEach(function(m,k){m.a.classList.toggle("on",k===ni)});lastNav=ni}

    /* scroll-scrubbed statement */
    if(st&&sw.length){
      var t=clamp((vh*.85-(M.stTop-y))/(M.stH+vh*.35),0,1),
          lim=Math.min(sw.length,Math.round(t*sw.length*1.05));
      if(lim!==lastLim){
        var a=Math.min(lim,lastLim),b=Math.max(lim,lastLim);
        for(var k=a;k<b&&k<sw.length;k++)sw[k].classList.toggle("on",k<lim);
        lastLim=lim;
      }
    }

    /* horizontal skills */
    if(vw>760){
      var tx=-clamp((y-M.hsTop)/M.hsTotal,0,1)*M.trackMax;
      if(tx!==lastTx){track.style.transform="translate3d("+tx.toFixed(2)+"px,0,0)";lastTx=tx}
    }else if(lastTx!==0){track.style.transform="";lastTx=0}

    /* roadmap focus */
    var c50=y+vh*.5,best=-1,bd=1e9;
    for(var s=0;s<M.stepC.length;s++){var d=Math.abs(M.stepC[s]-c50);if(d<bd){bd=d;best=s}}
    if(bd>vh*.45)best=-1;
    if(best!==lastStep){steps.forEach(function(li,k){li.classList.toggle("act",k===best)});lastStep=best}
  }

  /* Lenis drives updates in sync with its own frame; native scroll is the fallback */
  if(lenis)lenis.on("scroll",function(l){update(l.scroll)});
  else{
    var tk=false;
    addEventListener("scroll",function(){if(!tk){tk=true;requestAnimationFrame(function(){tk=false;update(window.scrollY)})}},{passive:true});
  }

  var rz=0;
  function queueMeasure(){cancelAnimationFrame(rz);rz=requestAnimationFrame(function(){measure();buildScene()})}
  addEventListener("resize",queueMeasure);
  addEventListener("load",queueMeasure);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(queueMeasure);
  if(window.ResizeObserver)new ResizeObserver(function(){
    if(document.documentElement.scrollHeight-vh!==M.max)queueMeasure();
  }).observe(document.body);

  /* ================= CURSOR + MAGNETIC ================= */
  if(!touch){
    var cu=$("#cursor"),cx=0,cy=0,tx2=0,ty2=0;
    addEventListener("pointermove",function(e){tx2=e.clientX;ty2=e.clientY},{passive:true});
    tasks.push(function(t,dt){
      var k=ease(.2,dt);cx+=(tx2-cx)*k;cy+=(ty2-cy)*k;
      cu.style.transform="translate3d("+cx.toFixed(1)+"px,"+cy.toFixed(1)+"px,0)";
    });
    document.addEventListener("pointerover",function(e){
      cu.classList.toggle("hover",!!(e.target.closest&&e.target.closest("a,.btn,.sk,.stat")));
    });
    if(!reduce)$$(".mag").forEach(function(el){
      var r=null;
      el.addEventListener("pointerenter",function(){r=el.getBoundingClientRect()});
      el.addEventListener("pointermove",function(e){
        if(!r)r=el.getBoundingClientRect();
        el.style.transform="translate3d("+((e.clientX-r.left-r.width/2)*.28).toFixed(1)+"px,"+((e.clientY-r.top-r.height/2)*.38).toFixed(1)+"px,0)";
      });
      el.addEventListener("pointerleave",function(){r=null;el.style.transform=""});
    });
  }

  /* ================= ICE WORLD SCENE =================
     Mountain layers are pre-rendered once (offscreen) and only blitted each frame -> far less GPU/CPU work. */
  var cv=$("#scene"),g=cv.getContext("2d",{alpha:false}),W,H,dpr=1,layers=[],flakes=[],stars=[],mx=0,tmx=0;
  var skyTopA=[18,52,104],skyTopB=[2,5,13],skyBotA=[96,170,220],skyBotB=[6,16,34],DARK=[2,5,13];
  var mtn=[[120,190,240],[64,128,190],[26,62,112],[9,24,48]];
  var mix=function(a,b,t){return"rgb("+Math.round(lerp(a[0],b[0],t))+","+Math.round(lerp(a[1],b[1],t))+","+Math.round(lerp(a[2],b[2],t))+")"};

  function buildScene(){
    dpr=Math.min(devicePixelRatio||1,1.75);
    W=innerWidth;H=innerHeight;
    cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);g.setTransform(dpr,0,0,dpr,0,0);
    layers=[];
    for(var L=0;L<4;L++){
      var amp=H*(.3-L*.04),base=H*(.6+L*.085),LH=Math.ceil(amp*1.3+H*.3),lw=W+80,step=14,s=L*17.3+3.1;
      var oc=document.createElement("canvas");oc.width=Math.round(lw*dpr);oc.height=Math.round(LH*dpr);
      var o=oc.getContext("2d");o.setTransform(dpr,0,0,dpr,0,0);
      var pts=[];
      for(var x=0;x<=lw;x+=step){
        var n=x/W,hh=Math.abs(Math.sin(n*(2+L*.9)+s))*.55+Math.sin(n*(7+L*3)+s*2)*.18+Math.sin(n*(19+L*6)+s*3)*.05;
        pts.push([x,amp*(1-hh)]);
      }
      var bottom=mix(mtn[Math.min(L+1,3)],DARK,.85),fg=o.createLinearGradient(0,0,0,LH);
      fg.addColorStop(0,mix(mtn[L],DARK,.1));fg.addColorStop(1,bottom);
      o.fillStyle=fg;o.beginPath();o.moveTo(0,LH);
      pts.forEach(function(p){o.lineTo(p[0],p[1])});
      o.lineTo(lw,LH);o.closePath();o.fill();
      o.strokeStyle="rgba(234,247,255,"+(.28-L*.05)+")";o.lineWidth=1;o.beginPath();
      pts.forEach(function(p,q){q?o.lineTo(p[0],p[1]):o.moveTo(p[0],p[1])});o.stroke();
      layers.push({c:oc,y0:base-amp,lw:lw,lh:LH,bottom:bottom});
    }
    stars=[];for(var k=0;k<130;k++)stars.push({x:Math.random()*W,y:Math.random()*H*.85,r:Math.random()*1.1+.2,t:Math.random()*6});
    var count=W<700?70:130;flakes=[];
    for(var f=0;f<count;f++)flakes.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*2+.4,s:Math.random()*.7+.25,d:Math.random()*6.28});
  }
  addEventListener("pointermove",function(e){tmx=e.clientX/innerWidth-.5},{passive:true});

  var sp=0,sv=0,prevY=0;
  tasks.push(function(t,dt){
    if(document.hidden||!W)return;
    var y=lenis?lenis.scroll:window.scrollY;
    sp+=(P-sp)*ease(.07,dt);                              /* eased scene progress */
    sv+=(Math.abs(y-prevY)-sv)*ease(.08,dt);prevY=y;     /* scroll speed -> snow boost */
    mx+=(tmx-mx)*ease(.05,dt);
    var p=sp;

    /* sky */
    var sk=g.createLinearGradient(0,0,0,H);
    sk.addColorStop(0,mix(skyTopA,skyTopB,ss(0,.55,p)));
    sk.addColorStop(1,mix(skyBotA,skyBotB,ss(0,.5,p)));
    g.fillStyle=sk;g.fillRect(0,0,W,H);

    /* stars */
    var sa=ss(.1,.6,p);
    if(sa>.01){
      g.fillStyle="#cfeeff";
      for(var i=0;i<stars.length;i++){
        var s=stars[i];g.globalAlpha=sa*(.4+.6*Math.abs(Math.sin(t*.001+s.t)));g.fillRect(s.x,s.y,s.r,s.r);
      }
      g.globalAlpha=1;
    }

    /* moon */
    var ma=1-ss(.3,.7,p);
    if(ma>.01){
      var mxp=W*.74,myp=H*(.26-p*.35),mr=Math.min(W,H)*.09,mg=g.createRadialGradient(mxp,myp,0,mxp,myp,mr*4);
      mg.addColorStop(0,"rgba(234,247,255,.95)");mg.addColorStop(.22,"rgba(168,230,255,.5)");mg.addColorStop(1,"rgba(168,230,255,0)");
      g.globalAlpha=ma;g.fillStyle=mg;g.fillRect(mxp-mr*4,myp-mr*4,mr*8,mr*8);g.globalAlpha=1;
    }

    /* aurora (limited region, additive) */
    g.globalCompositeOperation="lighter";
    var aa=.05+.2*ss(.05,.6,p);
    [[.3,"90,255,200",.9],[.7,"90,170,255",1.3]].forEach(function(o,j){
      var ax=W*(o[0]+Math.sin(t*.0002*o[2]+j)*.12),ay=H*(.3+Math.cos(t*.00017*o[2])*.08),
          ag=g.createRadialGradient(ax,ay,0,ax,ay,W*.5);
      ag.addColorStop(0,"rgba("+o[1]+","+aa.toFixed(3)+")");ag.addColorStop(1,"rgba("+o[1]+",0)");
      g.fillStyle=ag;g.fillRect(0,0,W,H*.85);
    });
    g.globalCompositeOperation="source-over";

    /* mountains: just blit the pre-rendered layers */
    for(var L=0;L<layers.length;L++){
      var a=1-ss(.2+L*.06,.75,p);if(a<=.01)continue;
      var ly=layers[L],shift=p*H*(.9+L*.5),oy=ly.y0-shift,ox=-40-mx*(10+L*14);
      g.globalAlpha=a;
      g.drawImage(ly.c,ox,oy,ly.lw,ly.lh);
      if(oy+ly.lh<H){g.fillStyle=ly.bottom;g.fillRect(0,oy+ly.lh-1,W,H-(oy+ly.lh)+2)}
    }
    g.globalAlpha=1;

    /* snow: one path, one fill; speed reacts to scroll velocity */
    var boost=1+Math.min(sv,60)*.12;
    g.fillStyle="rgba(215,240,255,.7)";g.beginPath();
    for(var j=0;j<flakes.length;j++){
      var f=flakes[j];
      f.y+=(f.s*boost+.15)*dt;f.d+=.012*dt;f.x+=(Math.sin(f.d)*.35+mx*.7)*dt;
      if(f.y>H+5){f.y=-6;f.x=Math.random()*W}
      if(f.x>W+5)f.x=-5;else if(f.x<-5)f.x=W+5;
      g.moveTo(f.x+f.r,f.y);g.arc(f.x,f.y,f.r,0,6.283);
    }
    g.fill();
  });

  /* ================= CLOCK + YEAR ================= */
  var clk=$("#clock");
  function tickClock(){try{clk.textContent=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date())}catch(e){}}
  tickClock();setInterval(tickClock,15000);
  $("#yr").textContent=new Date().getFullYear();

  /* first paint */
  buildScene();measure();
})();