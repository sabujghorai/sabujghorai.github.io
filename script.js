(function(){
  "use strict";
  var $=function(s,c){return(c||document).querySelector(s)},
      $$=function(s,c){return[].slice.call((c||document).querySelectorAll(s))};
  var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))},
      ease=function(k,dt){return 1-Math.pow(1-k,dt)},
      ss=function(a,b,x){x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)},
      expo=function(t){return t===1?1:1-Math.pow(2,-10*t)},
      inOutQuart=function(t){return t<.5?8*t*t*t*t:1-Math.pow(-2*t+2,4)/2};
  var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,
      touch=matchMedia("(hover: none)").matches;
  var tasks=[],lenis=null,vw=innerWidth,vh=innerHeight;

  /* ================= SMOOTH SCROLL (Lenis) ================= */
  /* lerp: lower = silkier / floatier (.06 – .11) */
  if(window.Lenis&&!reduce){
    lenis=new Lenis({lerp:.075,smoothWheel:true,wheelMultiplier:.9,touchMultiplier:1.5,syncTouch:false});
    lenis.stop();
  }
  var lastT=0;
  (function raf(t){
    var dt=Math.min((t-lastT)/16.667,3)||1;lastT=t;
    if(lenis)lenis.raf(t);
    for(var i=0;i<tasks.length;i++)tasks[i](t,dt);
    requestAnimationFrame(raf);
  })(0);
  var curY=function(){return lenis?lenis.scroll:window.scrollY};

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

  $$('a[href^="#"]').forEach(function(a){a.addEventListener("click",function(e){
    var id=a.getAttribute("href");if(id.length<2)return;
    var t=$(id);if(!t)return;e.preventDefault();
    if(lenis)lenis.scrollTo(t,{offset:0,duration:3,easing:inOutQuart});
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

  var st=$("#statement"),sw=[];
  if(st){
    var words=st.textContent.trim().split(/\s+/);st.textContent="";
    words.forEach(function(w,i){
      var s=document.createElement("span");s.className="sw";s.textContent=w;st.appendChild(s);
      if(i<words.length-1)st.appendChild(document.createTextNode(" "));sw.push(s);
    });
  }

  /* ================= REVEALS / COUNTERS / HEATMAP ================= */
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){var el=e.target;el.classList.add("in");io.unobserve(el);setTimeout(function(){el.style.transitionDelay="0ms"},1500)}
  })},{threshold:.15,rootMargin:"0px 0px -6% 0px"});
  $$("[data-r],[data-split]").forEach(function(el,i){
    if(el.hasAttribute("data-r")&&!el.closest("#home"))el.style.transitionDelay=((i%4)*90)+"ms";
    if(!el.closest("#home"))io.observe(el);
  });
  var co=new IntersectionObserver(function(es){es.forEach(function(e){
    if(!e.isIntersecting)return;co.unobserve(e.target);
    var el=e.target,end=+el.dataset.count,t0=null,plus=el.hasAttribute("data-plus");
    (function step(ts){t0=t0||ts;var p=Math.min((ts-t0)/2000,1);
      el.textContent=Math.round(end*expo(p)).toLocaleString("en-US")+(plus&&p===1?"+":"");
      if(p<1)requestAnimationFrame(step)})(performance.now());
  })},{threshold:.6});
  $$("[data-count]").forEach(function(el){co.observe(el)});
  var heat=$("#heat"),lv=["rgba(168,230,255,.07)","rgba(90,192,255,.3)","rgba(90,192,255,.55)","rgba(168,230,255,.8)","#fff"];
  for(var h=0;h<26*7;h++){var c=document.createElement("i"),r=Math.random();
    c.style.background=lv[r<.3?0:r<.55?1:r<.8?2:r<.93?3:4];c.style.transitionDelay=(h*6)+"ms";heat.appendChild(c)}

  /* ================= SCROLL ENGINE (cached metrics) ================= */
  var bar=$("#progress"),steps=$$("#steps li"),depthEl=$("#depth"),secEl=$("#secname"),
      navMap=$$(".top nav a").map(function(a){return{a:a,s:$(a.getAttribute("href")),top:0,name:a.textContent}}),
      M={max:1,stTop:0,stH:1,stepC:[]},P=0,lastLim=0,lastNav=-2,lastStep=-2,lastDepth="";
  navMap.unshift({a:{classList:{toggle:function(){}}},s:$("#home"),top:0,name:"Home"});

  function absTop(el){return el.getBoundingClientRect().top+(window.scrollY||0)}
  function measure(){
    vw=innerWidth;vh=innerHeight;
    M.max=Math.max(1,document.documentElement.scrollHeight-vh);
    if(st){M.stTop=absTop(st);M.stH=st.offsetHeight}
    M.stepC=steps.map(function(li){return absTop(li)+li.offsetHeight/2});
    navMap.forEach(function(m){m.top=m.s?absTop(m.s):0});
    lastNav=-2;lastStep=-2;update(curY());
  }
  function update(y){
    P=clamp(y/M.max,0,1);
    bar.style.transform="scaleX("+P.toFixed(4)+")";
    var d=("0000"+Math.round(P*1280)).slice(-4);
    if(d!==lastDepth){depthEl.textContent=d;lastDepth=d}
    var mid=y+vh*.45,ni=0;
    for(var i=0;i<navMap.length;i++)if(navMap[i].top<=mid)ni=i;
    if(ni!==lastNav){navMap.forEach(function(m,k){m.a.classList.toggle("on",k===ni)});secEl.textContent=navMap[ni].name;lastNav=ni}
    if(st&&sw.length){
      var t=clamp((vh*.85-(M.stTop-y))/(M.stH+vh*.35),0,1),lim=Math.min(sw.length,Math.round(t*sw.length*1.05));
      if(lim!==lastLim){var a=Math.min(lim,lastLim),b=Math.max(lim,lastLim);
        for(var k=a;k<b&&k<sw.length;k++)sw[k].classList.toggle("on",k<lim);lastLim=lim}
    }
    var c50=y+vh*.5,best=-1,bd=1e9;
    for(var s=0;s<M.stepC.length;s++){var dd=Math.abs(M.stepC[s]-c50);if(dd<bd){bd=dd;best=s}}
    if(bd>vh*.45)best=-1;
    if(best!==lastStep){steps.forEach(function(li,k){li.classList.toggle("act",k===best)});lastStep=best}
  }
  if(lenis)lenis.on("scroll",function(l){update(l.scroll)});
  else{var tk=false;addEventListener("scroll",function(){if(!tk){tk=true;requestAnimationFrame(function(){tk=false;update(window.scrollY)})}},{passive:true})}

  var rz=0;
  function queueMeasure(){cancelAnimationFrame(rz);rz=requestAnimationFrame(function(){measure();if(gl)gl.resize()})}
  addEventListener("resize",queueMeasure);
  addEventListener("load",queueMeasure);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(queueMeasure);
  if(window.ResizeObserver)new ResizeObserver(function(){if(document.documentElement.scrollHeight-vh!==M.max)queueMeasure()}).observe(document.body);

  /* ================= CURSOR + MAGNETIC ================= */
  var tmx=0,tmy=0;
  addEventListener("pointermove",function(e){tmx=e.clientX/innerWidth-.5;tmy=e.clientY/innerHeight-.5},{passive:true});
  if(!touch){
    var cu=$("#cursor"),cx=0,cy=0,px=0,py=0;
    addEventListener("pointermove",function(e){px=e.clientX;py=e.clientY},{passive:true});
    tasks.push(function(t,dt){var k=ease(.2,dt);cx+=(px-cx)*k;cy+=(py-cy)*k;cu.style.transform="translate3d("+cx.toFixed(1)+"px,"+cy.toFixed(1)+"px,0)"});
    document.addEventListener("pointerover",function(e){cu.classList.toggle("hover",!!(e.target.closest&&e.target.closest("a,.btn,.sk,.stat")))});
    if(!reduce)$$(".mag").forEach(function(el){
      var r=null;
      el.addEventListener("pointerenter",function(){r=el.getBoundingClientRect()});
      el.addEventListener("pointermove",function(e){if(!r)r=el.getBoundingClientRect();
        el.style.transform="translate3d("+((e.clientX-r.left-r.width/2)*.28).toFixed(1)+"px,"+((e.clientY-r.top-r.height/2)*.38).toFixed(1)+"px,0)"});
      el.addEventListener("pointerleave",function(){r=null;el.style.transform=""});
    });
  }

  /* ================= 3D ICE WORLD (Three.js) ================= */
  var gl=null;
  function initGL(){
    var cv=$("#gl"),R=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:"high-performance"});
    R.setPixelRatio(Math.min(devicePixelRatio||1,1.75));R.setSize(innerWidth,innerHeight,false);
    R.shadowMap.enabled=innerWidth>=700;R.shadowMap.type=THREE.PCFSoftShadowMap;
    var scene=new THREE.Scene(),cA=new THREE.Color(0x14407a),cB=new THREE.Color(0x02060f),cc=new THREE.Color();
    scene.background=new THREE.Color(0x14407a);scene.fog=new THREE.FogExp2(0x14407a,.014);
    var cam=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,800);scene.add(cam);

    /* soft round sprite texture (used for snow + glows) */
    var tc=document.createElement("canvas");tc.width=tc.height=64;
    var tg=tc.getContext("2d"),gr=tg.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,"rgba(255,255,255,1)");gr.addColorStop(.4,"rgba(255,255,255,.55)");gr.addColorStop(1,"rgba(255,255,255,0)");
    tg.fillStyle=gr;tg.fillRect(0,0,64,64);var dot=new THREE.CanvasTexture(tc);

    /* lights */
    scene.add(new THREE.AmbientLight(0x5f8cc8,.95));
    var sun=new THREE.DirectionalLight(0xd8f1ff,1.05),sunOff=new THREE.Vector3(-46,52,28);
    sun.castShadow=innerWidth>=700;sun.shadow.mapSize.set(2048,2048);
    var sc=sun.shadow.camera;sc.left=-70;sc.right=70;sc.top=70;sc.bottom=-70;sc.near=1;sc.far=220;
    sun.shadow.bias=-.0004;sun.shadow.normalBias=.4;scene.add(sun);scene.add(sun.target);
    var camLight=new THREE.PointLight(0x7fd0ff,1.3,45);cam.add(camLight);

    /* flight path (camera moves along this curve as you scroll) */
    var V=function(x,y,z){return new THREE.Vector3(x,y,z)};
    var curve=new THREE.CatmullRomCurve3([V(0,3.2,40),V(2,3.6,5),V(7,4.4,-35),V(-7,5.2,-80),V(7,3.9,-125),V(-6,5.6,-170),V(6,4.2,-215),V(1,3.4,-250),V(0,3.2,-268)],false,"catmullrom",.5);
    var IG=V(0,0,-292),igLook=V(0,4.5,-292);

    /* ground */
    var ground=new THREE.Mesh(new THREE.PlaneGeometry(700,900),new THREE.MeshStandardMaterial({color:0x0b2142,roughness:.28,metalness:.55}));
    ground.rotation.x=-Math.PI/2;ground.position.set(0,0,-130);ground.receiveShadow=true;scene.add(ground);

    /* ice crystals (instanced, static) */
    var N=280,cg=new THREE.ConeGeometry(1,4,6),
        cm=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0x1a5fa0,emissiveIntensity:.45,metalness:.3,roughness:.15,flatShading:true,transparent:true,opacity:.88}),
        ci=new THREE.InstancedMesh(cg,cm,N),o=new THREE.Object3D(),col=new THREE.Color();
    for(var i=0;i<N;i++){
      var pc=curve.getPoint(Math.random()*.97),side=Math.random()<.5?-1:1,rr=7+Math.pow(Math.random(),1.5)*36,
          s=.5+Math.random()*2.7,w=.5+Math.random()*1.1;
      o.position.set(pc.x+side*rr,s*2-.4,pc.z+(Math.random()-.5)*16);
      o.rotation.set((Math.random()-.5)*.4,Math.random()*6.28,(Math.random()-.5)*.5);
      o.scale.set(w,s,w);o.updateMatrix();ci.setMatrixAt(i,o.matrix);
      col.setHSL(.54+Math.random()*.06,.75,.5+Math.random()*.28);ci.setColorAt(i,col);
    }
    ci.castShadow=true;ci.receiveShadow=true;scene.add(ci);

    /* distant mountains */
    var MN=36,mi=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,5),new THREE.MeshStandardMaterial({color:0x0e2c58,flatShading:true,roughness:.9}),MN);
    for(i=0;i<MN;i++){
      var mz=60-i*(400/MN)-Math.random()*20,ms=(i%2?1:-1),mw=40+Math.random()*40,mh=50+Math.random()*70;
      o.position.set(ms*(95+Math.random()*80),mh/2-2,mz);o.rotation.set(0,Math.random()*6,0);o.scale.set(mw,mh,mw);o.updateMatrix();mi.setMatrixAt(i,o.matrix);
    }
    scene.add(mi);

    /* igloo: real ice-block texture, arched entrance, snow drifts, warm door glow */
    function brickTex(){
      var c=document.createElement("canvas");c.width=1024;c.height=512;var x=c.getContext("2d"),rows=8,cols=16,rh=512/rows,cw=1024/cols,r,k,bx,l;
      x.fillStyle="#cfe6fa";x.fillRect(0,0,1024,512);
      for(r=0;r<rows;r++)for(k=0;k<=cols;k++){bx=k*cw-(r%2)*cw/2;l=205+Math.random()*32;
        x.fillStyle="rgb("+l+","+(l+14)+",255)";x.fillRect(bx+3,r*rh+3,cw-6,rh-6)}
      x.strokeStyle="rgba(50,100,160,.95)";x.lineWidth=5;
      for(r=0;r<=rows;r++){x.beginPath();x.moveTo(0,r*rh);x.lineTo(1024,r*rh);x.stroke()}
      for(r=0;r<rows;r++)for(k=0;k<=cols;k++){var xx=k*cw-(r%2)*cw/2;x.beginPath();x.moveTo(xx,r*rh);x.lineTo(xx,(r+1)*rh);x.stroke()}
      var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
    }
    var bt=brickTex(),
        iceMat=new THREE.MeshStandardMaterial({map:bt,bumpMap:bt,bumpScale:1.4,roughness:.5,metalness:.05,emissive:0x16365f,emissiveIntensity:.45,side:THREE.DoubleSide}),
        snowMat=new THREE.MeshStandardMaterial({color:0xf2fbff,roughness:.85,emissive:0x1b3d6b,emissiveIntensity:.35}),
        ig=new THREE.Group();
    function sh(m){m.castShadow=true;m.receiveShadow=true;return m}
    ig.add(sh(new THREE.Mesh(new THREE.SphereGeometry(9,56,28,0,Math.PI*2,0,Math.PI/2),iceMat)));
    var tg2=new THREE.CylinderGeometry(3.2,3.2,7,36,1,true,-Math.PI/2,Math.PI);tg2.rotateX(-Math.PI/2);
    var tun=sh(new THREE.Mesh(tg2,iceMat));tun.position.set(0,0,9);ig.add(tun);
    var cap=sh(new THREE.Mesh(new THREE.SphereGeometry(3.2,28,14,0,Math.PI*2,0,Math.PI/2),iceMat));cap.scale.set(1,1,.001);cap.visible=false;
    var frame=new THREE.Mesh(new THREE.RingGeometry(2.3,3.25,36,1,0,Math.PI),iceMat);frame.position.set(0,0,12.52);ig.add(frame);
    var door=new THREE.Mesh(new THREE.CircleGeometry(2.3,36,0,Math.PI),new THREE.MeshBasicMaterial({color:0xffc27a}));door.position.set(0,0,12.4);ig.add(door);
    var drift=sh(new THREE.Mesh(new THREE.TorusGeometry(9.3,1.3,12,72),snowMat));drift.rotation.x=Math.PI/2;drift.scale.set(1,1,.4);drift.position.y=.1;ig.add(drift);
    var drift2=sh(new THREE.Mesh(new THREE.SphereGeometry(2.4,16,10),snowMat));drift2.scale.set(1.8,.45,1.2);drift2.position.set(-5,.1,13);ig.add(drift2);
    var warm=new THREE.PointLight(0xffb06b,2.8,70);warm.position.set(0,3,19);ig.add(warm);
    var glow=new THREE.Sprite(new THREE.SpriteMaterial({map:dot,color:0xffb06b,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.85}));
    glow.scale.set(20,20,1);glow.position.set(0,2.2,14);ig.add(glow);
    var spill=new THREE.Mesh(new THREE.PlaneGeometry(26,40),new THREE.MeshBasicMaterial({map:dot,color:0xffa24a,blending:THREE.AdditiveBlending,transparent:true,opacity:.75,depthWrite:false}));
    spill.rotation.x=-Math.PI/2;spill.position.set(0,.06,26);ig.add(spill);
    ig.position.copy(IG);scene.add(ig);

    /* aurora */
    var au=new THREE.Mesh(new THREE.PlaneGeometry(560,160),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false,
      uniforms:{t:{value:0},a:{value:.3}},
      vertexShader:"varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:"varying vec2 v;uniform float t,a;void main(){float w=sin(v.x*9.+t*.35+sin(v.x*4.+t*.2)*2.)*.5+.5;float w2=sin(v.x*17.-t*.25+sin(v.x*7.+t*.3)*1.5)*.5+.5;float band=smoothstep(.0,.5,v.y)*(1.-smoothstep(.5,1.,v.y));float e=smoothstep(0.,.18,v.x)*(1.-smoothstep(.82,1.,v.x));float i=band*e*(.35+.65*w)*(.5+.5*w2);vec3 c=mix(vec3(.2,1.,.7),vec3(.35,.5,1.),v.y+w*.3);gl_FragColor=vec4(c,i*a);}"
    }));
    scene.add(au);

    /* stars (follow camera position, not rotation) */
    var SN=900,sp=new Float32Array(SN*3);
    for(i=0;i<SN;i++){var th=Math.random()*6.283,ph=Math.acos(Math.random()),rad=420;
      sp[i*3]=rad*Math.sin(ph)*Math.cos(th);sp[i*3+1]=rad*Math.cos(ph)*.9+20;sp[i*3+2]=rad*Math.sin(ph)*Math.sin(th)}
    var sg=new THREE.BufferGeometry();sg.setAttribute("position",new THREE.BufferAttribute(sp,3));
    var starMat=new THREE.PointsMaterial({color:0xcfeeff,size:1.6,sizeAttenuation:false,transparent:true,opacity:.2,fog:false,depthWrite:false});
    var stars=new THREE.Points(sg,starMat);scene.add(stars);

    /* shooting stars */
    var shoot=[];
    for(i=0;i<3;i++){var sm=new THREE.SpriteMaterial({map:dot,color:0xdff4ff,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0,fog:false,rotation:-.22});
      var ss2=new THREE.Sprite(sm);ss2.scale.set(26,.9,1);scene.add(ss2);shoot.push({s:ss2,life:0,wait:60+Math.random()*300,x:0,y:0,z:0})}

    /* snow */
    var FN=innerWidth<700?2200:4000,fp=new Float32Array(FN*3),fs=new Float32Array(FN);
    for(i=0;i<FN;i++){fp[i*3]=(Math.random()-.5)*90;fp[i*3+1]=Math.random()*35;fp[i*3+2]=50-Math.random()*370;fs[i]=.04+Math.random()*.08}
    var fg=new THREE.BufferGeometry();fg.setAttribute("position",new THREE.BufferAttribute(fp,3));
    scene.add(new THREE.Points(fg,new THREE.PointsMaterial({map:dot,color:0xdff4ff,size:.55,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending})));

    /* per-frame */
    var Ps=0,sv=0,prevY=0,mxs=0,mys=0,look=new THREE.Vector3(),fov=60;
    tasks.push(function(t,dt){
      if(document.hidden)return;
      var y=curY();sv+=(Math.abs(y-prevY)-sv)*ease(.08,dt);var vel=y-prevY;prevY=y;
      Ps+=(P-Ps)*ease(.05,dt);                       /* eased progress = silky camera */
      var tt=clamp(Ps,0,1)*.999,pos=curve.getPoint(tt),ahead=curve.getPoint(Math.min(1,tt+.035));
      mxs+=(tmx-mxs)*ease(.05,dt);mys+=(tmy-mys)*ease(.05,dt);
      cam.position.set(pos.x+mxs*1.8,pos.y+Math.sin(t*.0006)*.15-mys*.9,pos.z);
      var snap=.07,sx=Math.round(cam.position.x/snap)*snap,sz=Math.round((cam.position.z-35)/snap)*snap;
      sun.target.position.set(sx,0,sz);sun.position.set(sx+sunOff.x,sunOff.y,sz+sunOff.z);
      look.copy(ahead).lerp(igLook,ss(.86,1,tt));
      cam.lookAt(look);cam.rotateZ(clamp(-vel*.0006,-.06,.06)-mxs*.03);
      var nf=60+Math.min(sv,50)*.18;if(Math.abs(nf-fov)>.05){fov+=(nf-fov)*.2;cam.fov=fov;cam.updateProjectionMatrix()}

      cc.copy(cA).lerp(cB,ss(0,.55,tt));scene.background.copy(cc);scene.fog.color.copy(cc);
      scene.fog.density=.015-.004*ss(0,.8,tt);
      starMat.opacity=.15+.85*ss(.05,.55,tt);stars.position.copy(cam.position);
      au.material.uniforms.t.value=t*.001;au.material.uniforms.a.value=.25+.6*ss(.05,.6,tt);
      au.position.set(cam.position.x*.5,60,cam.position.z-210);
      warm.intensity=2.2+Math.sin(t*.003)*.25;

      for(var q=0;q<shoot.length;q++){var o2=shoot[q];
        if(o2.wait>0){o2.wait-=dt;if(o2.wait<=0){o2.life=1;o2.x=100+Math.random()*100;o2.y=60+Math.random()*70;o2.z=-190-Math.random()*60}}
        else{o2.life-=.012*dt;o2.x-=2.2*dt;o2.y-=.55*dt;
          if(o2.life<=0){o2.wait=240+Math.random()*420;o2.s.material.opacity=0}
          else o2.s.material.opacity=Math.sin(o2.life*3.1416)*.95*ss(.08,.4,tt)}
        o2.s.position.set(cam.position.x+o2.x,o2.y,cam.position.z+o2.z)}
      var arr=fg.attributes.position.array,boost=1+Math.min(sv,60)*.1;
      for(var j=0;j<FN;j++){
        var k=j*3;arr[k+1]-=fs[j]*boost*dt*4;arr[k]+=Math.sin(t*.0008+j)*.01*dt;
        if(arr[k+1]<0)arr[k+1]+=35;
      }
      fg.attributes.position.needsUpdate=true;
      R.render(scene,cam);
    });

    return{resize:function(){R.setPixelRatio(Math.min(devicePixelRatio||1,1.75));R.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}};
  }
  try{
    if(!window.THREE)throw new Error("no three");
    gl=initGL();
  }catch(err){
    console.warn("3D scene unavailable, using gradient fallback:",err);
    document.body.classList.add("nogl");
    var cvx=$("#gl");if(cvx)cvx.style.display="none";
  }

  /* ================= CLOCK + YEAR ================= */
  var clk=$("#clock");
  function tickClock(){try{clk.textContent=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date())}catch(e){}}
  tickClock();setInterval(tickClock,15000);
  $("#yr").textContent=new Date().getFullYear();

  measure();
})();