/* logic.js  (Person A owns this file)
   Pure calculation: no document, no window. Safe to run in the browser and in Node.
   calculate(base, rows) -> { c, valid, badIdx, placed, failed, free, used } */
function ipToInt(s){
  var m=String(s).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(!m) return null;
  var o=m.slice(1).map(Number);
  if(o.some(function(x){return x>255;})) return null;
  return o[0]*16777216+o[1]*65536+o[2]*256+o[3];
}
function intToIp(n){
  return [Math.floor(n/16777216)%256,Math.floor(n/65536)%256,Math.floor(n/256)%256,n%256].join('.');
}
function fmt(n){return Number(n).toLocaleString('en-US');}
function parseCidr(s){
  var m=String(s).trim().match(/^([\d.]+)\/(\d{1,2})$/);
  if(!m) return {error:'Enter a block like 192.168.50.0/24.'};
  var ip=ipToInt(m[1]), p=Number(m[2]);
  if(ip===null) return {error:'That is not a valid IPv4 address.'};
  if(p<8||p>30) return {error:'Prefix length must be between /8 and /30.'};
  var size=Math.pow(2,32-p), net=Math.floor(ip/size)*size;
  return {net:net,prefix:p,total:size,adjusted:net!==ip};
}
function blockInfo(start,size){
  return {network:intToIp(start),mask:intToIp(Math.pow(2,32)-size),first:intToIp(start+1),last:intToIp(start+size-2),bcast:intToIp(start+size-1),end:intToIp(start+size-1)};
}
function calculate(base,rows){
  var c=parseCidr(base);
  if(c.error) return {c:c};
  var valid=[], badIdx=[];
  rows.forEach(function(r,i){
    var raw=String(r.hosts).trim(), h=Number(raw);
    if(raw!==''&&Number.isInteger(h)&&h>=1&&h<=16777214){
      valid.push({i:i,name:(r.name||'').trim()||('Facility '+(i+1)),hosts:h});
    } else badIdx.push(i);
  });
  var order=valid.slice().sort(function(a,b){return b.hosts-a.hosts||a.i-b.i;});
  var off=0, placed=[], failed=[];
  order.forEach(function(v){
    var bits=Math.max(2,Math.ceil(Math.log2(v.hosts+2)));
    var size=Math.pow(2,bits), prefix=32-bits;
    var o={i:v.i,name:v.name,hosts:v.hosts,bits:bits,size:size,prefix:prefix,usable:size-2,spare:size-2-v.hosts};
    if(prefix<c.prefix){o.reason='Needs a /'+prefix+' ('+fmt(size)+' addresses), larger than the whole block.';failed.push(o);return;}
    var a=Math.ceil(off/size)*size;
    if(a+size>c.total){o.reason='No room left. Needs '+fmt(size)+' addresses, '+fmt(c.total-off)+' still free.';failed.push(o);return;}
    var start=c.net+a;
    var b=blockInfo(start,size);
    for(var k in b) o[k]=b[k];
    o.start=start; o.offset=a;
    off=a+size; placed.push(o);
  });
  var free=[], cur=off;
  while(cur<c.total){
    var s=1;
    while(cur%(s*2)===0&&cur+s*2<=c.total) s*=2;
    var fb=blockInfo(c.net+cur,s);
    free.push({start:c.net+cur,size:s,prefix:32-Math.log2(s),network:fb.network,mask:fb.mask,first:fb.first,last:fb.last,bcast:fb.bcast});
    cur+=s;
  }
  return {c:c,valid:valid,badIdx:badIdx,placed:placed,failed:failed,free:free,used:off};
}

function applyHeadroom(rows, pct) {
  return rows.map(function (r) {
    var h = Number(r.hosts);
    return Number.isInteger(h) && h >= 1
      ? { name: r.name, hosts: String(Math.ceil(h * (1 + pct / 100))) }
      : r;
  });
}

function linkRows(count) {
  var out = [];
  for (var i = 1; i <= count; i++) out.push({ name: "Router link " + i, hosts: "2" });
  return out;
}

function toCsv(result) {
  var q = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
  var lines = ["Facility,Hosts,Network,Prefix,Mask,First,Last,Broadcast,Spare"];
  result.placed.forEach(function (p) {
    lines.push([q(p.name), p.hosts, p.network, "/" + p.prefix, p.mask, p.first, p.last, p.bcast, p.spare].join(","));
  });
  return lines.join("\n");
}

if (typeof module !== "undefined") {
  module.exports = { calculate: calculate, parseCidr: parseCidr, ipToInt: ipToInt, intToIp: intToIp,
    applyHeadroom: applyHeadroom, linkRows: linkRows, toCsv: toCsv };
}
