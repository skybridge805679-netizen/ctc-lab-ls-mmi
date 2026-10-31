'use strict';
// Format conversion only: preserve the generated design; encode every native size.
// Run with: electron tools/build-app-icons.cjs (Linux CI: xvfb-run -a ... --no-sandbox)
const {nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),out=path.join(root,'desktop/resources');
const source=nativeImage.createFromPath(path.join(root,'docs/assets/orpheia-app-icon-source.png'));
if(source.isEmpty()||source.getSize().width!==source.getSize().height)throw Error('Expected a square source icon');
const png=size=>source.resize({width:size,height:size,quality:'best'}).toPNG();
fs.writeFileSync(path.join(out,'icon.png'),png(1024));
const sizes=[16,20,24,32,40,48,64,128,256],frames=sizes.map(png);
const head=Buffer.alloc(6+16*sizes.length);head.writeUInt16LE(1,2);head.writeUInt16LE(sizes.length,4);
let offset=head.length;
frames.forEach((frame,i)=>{const n=6+16*i,size=sizes[i];head[n]=size===256?0:size;head[n+1]=head[n];head.writeUInt16LE(1,n+4);head.writeUInt16LE(32,n+6);head.writeUInt32LE(frame.length,n+8);head.writeUInt32LE(offset,n+12);offset+=frame.length;});
fs.writeFileSync(path.join(out,'icon.ico'),Buffer.concat([head,...frames]));
const types=[['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024],['ic11',32],['ic12',64],['ic13',256],['ic14',512]];
const chunks=types.map(([type,size])=>{const frame=png(size),h=Buffer.alloc(8);h.write(type);h.writeUInt32BE(frame.length+8,4);return Buffer.concat([h,frame]);});
const icns=Buffer.alloc(8);icns.write('icns');icns.writeUInt32BE(8+chunks.reduce((sum,x)=>sum+x.length,0),4);
fs.writeFileSync(path.join(out,'icon.icns'),Buffer.concat([icns,...chunks]));
console.log('Built 1024px PNG, 9-size Windows ICO, 11-size Mac ICNS from generated source');
process.exit(0);
