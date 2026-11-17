'use strict';
// 원격 조작 서버의 HTTPS 인증서 (자체 서명). 휴대폰 브라우저는 보안 연결(https)인 페이지에서만 마이크를 허용하기 때문에 필요하다.
// 외부 패키지 없이 X.509 v3 인증서를 DER로 직접 만든다: RSA 2048 · SHA-256 · 주체 「ORPHEIA CTC LAB」 · 이 PC의 IP 주소들(SAN).
// 사용자 데이터 폴더에 보관하고 다시 쓴다 (휴대폰에서 경고를 한 번 넘기면 다음에도 같은 인증서). IP가 바뀌면 새로 만든다.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const len=n=>n<128?Buffer.from([n]):n<256?Buffer.from([0x81,n]):Buffer.from([0x82,n>>8,n&255]);
const tlv=(tag,body)=>Buffer.concat([Buffer.from([tag]),len(body.length),body]);
const seq=(...x)=>tlv(0x30,Buffer.concat(x)),set=(...x)=>tlv(0x31,Buffer.concat(x));
const oid=s=>{const p=s.split('.').map(Number),out=[40*p[0]+p[1]];for(const v of p.slice(2)){const b=[v&127];let n=v>>7;while(n){b.unshift((n&127)|128);n>>=7;}out.push(...b);}return tlv(0x06,Buffer.from(out));};
const int=buf=>tlv(0x02,buf[0]&0x80?Buffer.concat([Buffer.from([0]),buf]):buf);
const utf8=s=>tlv(0x0c,Buffer.from(s,'utf8'));
const time=d=>tlv(0x17,Buffer.from(d.toISOString().replace(/[-:T]/g,'').slice(2,14)+'Z'));      // UTCTime (2049년까지)
const name=cn=>seq(set(seq(oid('2.5.4.3'),utf8(cn))),set(seq(oid('2.5.4.10'),utf8('ORPHEIA'))));
const SHA256RSA=seq(oid('1.2.840.113549.1.1.11'),Buffer.from([5,0]));
function make(ips){
 const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const now=Date.now(),serial=crypto.randomBytes(12);serial[0]&=0x7f;
 const san=seq(...ips.map(ip=>tlv(0x87,Buffer.from(ip.split('.').map(Number)))),tlv(0x82,Buffer.from('localhost')));
 const ext=tlv(0xa3,seq(
  seq(oid('2.5.29.19'),tlv(0x04,seq())),                                                     // basicConstraints: CA 아님
  seq(oid('2.5.29.15'),tlv(0x01,Buffer.from([0xff])),tlv(0x04,tlv(0x03,Buffer.from([5,0xa0])))),   // keyUsage: 서명 · 키 암호화
  seq(oid('2.5.29.37'),tlv(0x04,seq(oid('1.3.6.1.5.5.7.3.1')))),                             // extKeyUsage: 서버 인증
  seq(oid('2.5.29.17'),tlv(0x04,san))));                                                       // subjectAltName: 이 PC의 IP · localhost
 const tbs=seq(tlv(0xa0,int(Buffer.from([2]))),int(serial),SHA256RSA,name('ORPHEIA CTC LAB 원격 조작'),seq(time(new Date(now-86400000)),time(new Date(now+3650*86400000))),name('ORPHEIA CTC LAB 원격 조작'),publicKey.export({type:'spki',format:'der'}),ext);
 const sig=crypto.sign('sha256',tbs,privateKey),der=seq(tbs,SHA256RSA,tlv(0x03,Buffer.concat([Buffer.from([0]),sig])));
 return {cert:'-----BEGIN CERTIFICATE-----\n'+der.toString('base64').match(/.{1,64}/g).join('\n')+'\n-----END CERTIFICATE-----\n',key:privateKey.export({type:'pkcs8',format:'pem'}),ips};
}
// 보관된 인증서가 지금 IP를 모두 담고 있으면 그대로, 아니면 새로 만든다
function load(file,ips){
 try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));const x=new crypto.X509Certificate(saved.cert);if(ips.every(ip=>saved.ips.includes(ip))&&new Date(x.validTo)>new Date(Date.now()+30*86400000))return saved;}catch{}
 const fresh=make(ips);try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(fresh),{mode:0o600});}catch{}
 return fresh;
}
module.exports={make,load};
