/* app.js  (Person B owns this file)
   Reads the inputs, calls calculate() from logic.js, and draws the results. */
var DEFAULT={base:'192.168.50.0/24',rows:[
  {name:'AI Research Lab',hosts:'100'},
  {name:'IoT Prototyping Lab',hosts:'50'},
  {name:'Staff Administration Room',hosts:'20'},
  {name:'Core Server Room',hosts:'5'}]};
var state={base:DEFAULT.base,rows:DEFAULT.rows.map(function(r){return {name:r.name,hosts:r.hosts};}),fixed:26};
var lastFixedKey='';
function $(id){return document.getElementById(id);}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function dot(i){return '<i class="dot" style="background:var(--c'+(i%8)+')"></i>';}

function renderRows(focusIdx){
  $('rows').innerHTML=state.rows.map(function(r,i){
    return '<div class="row">'+dot(i)+
      '<input id="nm-'+i+'" data-f="name" data-i="'+i+'" type="text" value="'+esc(r.name)+'" aria-label="Facility name" autocomplete="off">'+
      '<input id="hs-'+i+'" class="mono" data-f="hosts" data-i="'+i+'" type="number" min="1" step="1" inputmode="numeric" value="'+esc(r.hosts)+'" aria-label="Hosts needed">'+
      '<button class="x" type="button" data-rm="'+i+'" aria-label="Remove '+esc(r.name||'facility')+'">&times;</button></div>';
  }).join('');
  if(focusIdx!==undefined&&$('nm-'+focusIdx)) $('nm-'+focusIdx).focus();
}

function tableText(R){
  var lines=[['Facility','Hosts','CIDR','Mask','First usable','Last usable','Broadcast'].join('\t')];
  R.placed.forEach(function(p){lines.push([p.name,p.hosts,p.network+'/'+p.prefix,p.mask,p.first,p.last,p.bcast].join('\t'));});
  return lines.join('\n');
}

function renderAll(){
  var R=calculate(state.base,state.rows);
  var c=R.c;
  $('baseErr').hidden=!c.error; $('baseErr').textContent=c.error||'';
  $('base').classList.toggle('bad',!!c.error);
  $('baseNote').hidden=!(c.adjusted);
  if(c.adjusted) $('baseNote').textContent='Using the network address '+intToIp(c.net)+'/'+c.prefix+'.';
  var out=['stats','map','topo','tbl','work','cmp'];
  if(c.error){
    out.forEach(function(id){$(id).innerHTML='';});
    $('mapHint').textContent=''; $('cmpNote').textContent='';
    $('alert').hidden=false; $('alert').textContent='Enter a valid address block to see the plan.';
    return;
  }
  state.rows.forEach(function(r,i){
    var el=$('hs-'+i); if(el) el.classList.toggle('bad',R.badIdx.indexOf(i)>-1);
  });
  var n=R.valid.length;
  if(R.failed.length){
    $('alert').hidden=false;
    $('alert').textContent=R.failed.length+' of '+n+' facilities cannot be placed in '+intToIp(c.net)+'/'+c.prefix+'. Use a larger block or lower the host counts.';
  } else if(R.badIdx.length){
    $('alert').hidden=false;
    $('alert').textContent='Enter a whole number of hosts (1 or more) for every facility. Rows without one are left out.';
  } else $('alert').hidden=true;

  var served=0,prov=0;
  R.placed.forEach(function(p){served+=p.hosts;prov+=p.usable;});
  $('stats').innerHTML=
    '<div class="stat"><b>'+fmt(R.used)+' / '+fmt(c.total)+'</b><span>addresses allocated</span></div>'+
    '<div class="stat"><b>'+fmt(c.total-R.used)+'</b><span>addresses still free ('+((c.total-R.used)/c.total*100).toFixed(1)+'%)</span></div>'+
    '<div class="stat"><b>'+fmt(served)+' / '+fmt(prov)+'</b><span>hosts needed / usable capacity</span></div>'+
    '<div class="stat"><b>'+R.placed.length+' of '+n+'</b><span>facilities placed</span></div>';

  var segs=R.placed.map(function(p){
    var pct=p.size/c.total*100;
    return '<div class="seg" style="width:'+pct+'%;background:var(--c'+(p.i%8)+')" title="'+esc(p.name)+' '+p.network+'/'+p.prefix+'">'+(pct>=7?'/'+p.prefix:'')+'</div>';
  });
  if(R.used<c.total){
    var fp=(c.total-R.used)/c.total*100;
    segs.push('<div class="seg free" style="width:'+fp+'%" title="Unallocated">'+(fp>=9?'free':'')+'</div>');
  }
  $('mapHint').textContent='The full '+intToIp(c.net)+'/'+c.prefix+' block drawn to scale, '+fmt(c.total)+' addresses wide.';
  $('map').innerHTML='<div class="bar" role="img" aria-label="Address block divided into the allocated subnets and free space">'+segs.join('')+'</div>'+
    '<div class="ticks"><span>'+intToIp(c.net)+'</span><span>'+intToIp(c.net+c.total-1)+'</span></div>'+
    '<ul class="legend">'+R.placed.map(function(p){return '<li>'+dot(p.i)+esc(p.name)+' <code>'+p.network+'/'+p.prefix+'</code></li>';}).join('')+
    (R.free.length?'<li><i class="dot" style="background:repeating-linear-gradient(135deg,transparent 0 3px,var(--line) 3px 4px);border:1px solid var(--line)"></i>Free <code>'+R.free.map(function(f){return f.network+'/'+f.prefix;}).join(', ')+'</code></li>':'')+
    '</ul>';

  var head='<tr><th>Facility</th><th class="r">Hosts</th><th>Block</th><th>Network</th><th>Mask</th><th>Usable range</th><th>Broadcast</th><th class="r">Spare</th></tr>';
  var body=R.placed.map(function(p){
    return '<tr><td class="nm">'+dot(p.i)+esc(p.name)+'</td><td class="r">'+fmt(p.hosts)+'</td><td>/'+p.prefix+' <span class="m">('+fmt(p.size)+')</span></td><td>'+p.network+'/'+p.prefix+'</td><td>'+p.mask+'</td><td>'+p.first+' &ndash; '+p.last+'</td><td>'+p.bcast+'</td><td class="r">'+fmt(p.spare)+'</td></tr>';
  }).join('');
  body+=R.failed.map(function(p){
    return '<tr class="fail"><td class="nm">'+dot(p.i)+esc(p.name)+'</td><td class="r">'+fmt(p.hosts)+'</td><td>/'+p.prefix+' <span class="m">('+fmt(p.size)+')</span></td><td colspan="5" style="white-space:normal">'+esc(p.reason)+'</td></tr>';
  }).join('');
  body+=R.free.map(function(f){
    return '<tr class="freeRow"><td class="nm">Unallocated</td><td class="r">&ndash;</td><td>/'+f.prefix+' <span class="m">('+fmt(f.size)+')</span></td><td>'+f.network+'/'+f.prefix+'</td><td>'+f.mask+'</td><td>'+f.network+' &ndash; '+intToIp(f.start+f.size-1)+'</td><td>&ndash;</td><td class="r">&ndash;</td></tr>';
  }).join('');
  $('tbl').innerHTML='<thead>'+head+'</thead><tbody>'+body+'</tbody>';

  $('work').innerHTML=R.placed.concat(R.failed).sort(function(a,b){return b.hosts-a.hosts||a.i-b.i;}).map(function(p){
    return '<li><b>'+esc(p.name)+'</b><code>'+fmt(p.hosts)+' + 2 = '+fmt(p.hosts+2)+' &rarr; next power of two is 2<sup>'+p.bits+'</sup> = '+fmt(p.size)+' &rarr; '+p.bits+' host bits, so /'+p.prefix+(p.network?' &rarr; '+p.network+'/'+p.prefix:' &rarr; does not fit')+'</code></li>';
  }).join('');

  /* fixed-size comparison */
  var key=c.prefix;
  if(key!==lastFixedKey){
    var opts='';
    for(var p=c.prefix;p<=30;p++) opts+='<option value="'+p+'">/'+p+'</option>';
    $('fixedP').innerHTML=opts; lastFixedKey=key;
  }
  state.fixed=Math.min(30,Math.max(c.prefix,state.fixed));
  $('fixedP').value=String(state.fixed);
  var fsize=Math.pow(2,32-state.fixed), fus=fsize-2;
  var all=R.valid.slice().sort(function(a,b){return a.i-b.i;});
  var short=0, fspare=0;
  var cbody=all.map(function(v){
    var ok=v.hosts<=fus;
    if(ok) fspare+=fus-v.hosts; else short++;
    return '<tr><td class="nm">'+dot(v.i)+esc(v.name)+'</td><td class="r">'+fmt(v.hosts)+'</td><td class="r">'+fmt(fus)+'</td><td>'+(ok?'<span class="good">Fits</span>, '+fmt(fus-v.hosts)+' addresses unused':'<span class="badtxt">Too small</span>, short by '+fmt(v.hosts-fus)+' hosts')+'</td></tr>';
  }).join('');
  $('cmp').innerHTML='<thead><tr><th>Facility</th><th class="r">Hosts</th><th class="r">Usable at /'+state.fixed+'</th><th>Result</th></tr></thead><tbody>'+cbody+'</tbody>';
  var need=all.length*fsize, vspare=0;
  R.placed.forEach(function(p){vspare+=p.spare;});
  var msg='<b>Fixed /'+state.fixed+':</b> '+all.length+' &times; '+fmt(fsize)+' = '+fmt(need)+' addresses. ';
  if(short) msg+='<span class="badtxt">'+short+' of '+all.length+' facilities cannot be served.</span> ';
  if(need>c.total) msg+='<span class="badtxt">The total exceeds the '+fmt(c.total)+' addresses available.</span> ';
  if(!short&&need<=c.total) msg+='Everything fits, but '+fmt(fspare)+' usable addresses sit idle against '+fmt(vspare)+' with VLSM.';
  msg+='<br><b>VLSM:</b> '+fmt(R.used)+' addresses allocated, '+R.placed.length+' of '+n+' facilities served, '+fmt(c.total-R.used)+' left free for growth.';
  $('cmpNote').innerHTML=msg;

  /* network topology: router -> switch -> one card per placed subnet */
  $('topo').innerHTML='<div class="node">Router<small>one sub-interface per subnet</small></div>'+
    '<div class="vline"></div>'+
    '<div class="node">Switch<small>one VLAN per facility</small></div>'+
    '<div class="vline"></div>'+
    '<div class="lans">'+R.placed.map(function(p,k){
      return '<div class="lan" style="border-top-color:var(--c'+(p.i%8)+')"><b>'+esc(p.name)+'</b>'+
        '<code>'+p.network+'/'+p.prefix+'</code>'+
        '<span>VLAN '+((k+1)*10)+' &middot; gateway '+p.first+'</span>'+
        '<span>'+fmt(p.hosts)+' hosts, '+fmt(p.usable)+' usable</span></div>';
    }).join('')+'</div>';
}

/* events */
$('base').addEventListener('input',function(e){state.base=e.target.value;renderAll();});
$('rows').addEventListener('input',function(e){
  var t=e.target, i=t.getAttribute('data-i'); if(i===null) return;
  state.rows[Number(i)][t.getAttribute('data-f')]=t.value; renderAll();
});
$('rows').addEventListener('click',function(e){
  var b=e.target.closest('[data-rm]'); if(!b) return;
  state.rows.splice(Number(b.getAttribute('data-rm')),1);
  renderRows(); renderAll();
});
$('add').addEventListener('click',function(){
  state.rows.push({name:'New facility',hosts:'10'});
  renderRows(state.rows.length-1); renderAll();
});
$('reset').addEventListener('click',function(){
  state.base=DEFAULT.base; $('base').value=DEFAULT.base; state.fixed=26;
  state.rows=DEFAULT.rows.map(function(r){return {name:r.name,hosts:r.hosts};});
  renderRows(); renderAll();
});
$('fixedP').addEventListener('change',function(e){state.fixed=Number(e.target.value);renderAll();});
$('copy').addEventListener('click',function(){
  var R=calculate(state.base,state.rows); if(R.c.error) return;
  var txt=tableText(R), btn=$('copy');
  function fallback(){var b=$('copybox');b.hidden=false;b.value=txt;b.focus();b.select();}
  function done(){btn.textContent='Copied';setTimeout(function(){btn.textContent='Copy table';},1600);$('copybox').hidden=true;}
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,fallback);}
    else fallback();
  }catch(err){fallback();}
});

renderRows();
renderAll();