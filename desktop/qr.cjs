'use strict';
// 원격 접속 주소용 작은 QR 코드 생성기 (바이트 모드 · 오류정정 L · 버전 1~5, 최대 106바이트). 외부 의존성 없이 SVG를 만든다.
// 알고리즘은 ISO/IEC 18004 (Nayuki의 공개 구현 방식을 간추림).
const TOTAL=[0,26,44,70,100,134],ECC=[0,7,10,15,20,26];
function mul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x;}return z&255;}
function divisor(n){const r=new Array(n).fill(0);r[n-1]=1;let root=1;for(let i=0;i<n;i++){for(let j=0;j<n;j++){r[j]=mul(r[j],root);if(j+1<n)r[j]^=r[j+1];}root=mul(root,2);}return r;}
function remainder(data,div){const r=new Array(div.length).fill(0);for(const b of data){const f=b^r.shift();r.push(0);div.forEach((d,i)=>{r[i]^=mul(d,f);});}return r;}
function encode(text){
 const bytes=[...Buffer.from(String(text),'utf8')];
 let v=1;while(v<=5&&4+8+bytes.length*8>(TOTAL[v]-ECC[v])*8)v++;if(v>5)throw new RangeError('QR 내용이 너무 깁니다.');
 const cap=(TOTAL[v]-ECC[v])*8,bits=[];const put=(val,len)=>{for(let i=len-1;i>=0;i--)bits.push((val>>>i)&1);};
 put(4,4);put(bytes.length,8);for(const b of bytes)put(b,8);put(0,Math.min(4,cap-bits.length));put(0,(8-bits.length%8)%8);
 for(let pad=0xec;bits.length<cap;pad^=0xec^0x11)put(pad,8);
 const data=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(''),2));
 const all=[...data,...remainder(data,divisor(ECC[v]))];
 const size=17+4*v,m=[...Array(size)].map(()=>new Array(size).fill(false)),fn=[...Array(size)].map(()=>new Array(size).fill(false));
 const set=(x,y,dark)=>{m[y][x]=dark;fn[y][x]=true;};
 for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
 const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),x=cx+dx,y=cy+dy;if(x>=0&&x<size&&y>=0&&y<size)set(x,y,d!==2&&d!==4);}};
 finder(3,3);finder(size-4,3);finder(3,size-4);
 if(v>=2){const p=4*v+10;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(p+dx,p+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);}
 const format=mask=>{const d=(1<<3)|mask;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const b=((d<<10)|r)^0x5412,bit=i=>((b>>>i)&1)===1;
  for(let i=0;i<=5;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));for(let i=9;i<15;i++)set(14-i,8,bit(i));
  for(let i=0;i<8;i++)set(size-1-i,8,bit(i));for(let i=8;i<15;i++)set(8,size-15+i,bit(i));set(8,size-8,true);};
 format(0);
 let i=0;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){const x=right-j,up=((right+1)&2)===0,y=up?size-1-vert:vert;if(!fn[y][x]&&i<all.length*8){m[y][x]=((all[i>>>3]>>>(7-(i&7)))&1)===1;i++;}}}
 const masks=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,x=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
 const apply=k=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!fn[y][x]&&masks[k](x,y))m[y][x]=!m[y][x];};
 const penalty=()=>{let p=0,dark=0;for(let a=0;a<size;a++){let rl=1,cl=1;for(let b=1;b<size;b++){if(m[a][b]===m[a][b-1]){rl++;if(rl===5)p+=3;else if(rl>5)p++;}else rl=1;if(m[b][a]===m[b-1][a]){cl++;if(cl===5)p+=3;else if(cl>5)p++;}else cl=1;}}
  for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=m[y][x];if(c===m[y][x+1]&&c===m[y+1][x]&&c===m[y+1][x+1])p+=3;}
  for(const row of m)for(const c of row)if(c)dark++;return p+Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;};
 let best=0,bestScore=Infinity;for(let k=0;k<8;k++){apply(k);format(k);const s=penalty();if(s<bestScore){bestScore=s;best=k;}apply(k);}
 apply(best);format(best);return m;
}
function svg(text,{scale=8,quiet=4,dark='#000',light='#fff'}={}){
 const m=encode(text),n=m.length+quiet*2;let d='';m.forEach((row,y)=>row.forEach((c,x)=>{if(c)d+=`M${x+quiet} ${y+quiet}h1v1h-1z`;}));
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n*scale}" height="${n*scale}" shape-rendering="crispEdges" role="img" aria-label="${String(text).replace(/[<&"]/g,'')}"><rect width="${n}" height="${n}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
module.exports={encode,svg};
