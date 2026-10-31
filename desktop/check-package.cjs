'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {verifyArchive}=require('./package-audit.cjs');
const platform=process.platform;
const resources=platform==='darwin'?path.join('dist','mac-arm64','ORPHEIA CTC LAB.app','Contents','Resources'):path.join('dist','win-unpacked','resources');
const archive=path.join(resources,'app.asar');
const checked=verifyArchive(archive);
if(platform==='darwin'){
 const plist=fs.readFileSync(path.join(resources,'../Info.plist'),'utf8');
 const icon=plist.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
 assert.ok(icon,'Missing Mac bundle icon');
 assert.deepEqual(fs.readFileSync(path.join(resources,icon)),fs.readFileSync('desktop/resources/icon.icns'),'Mac bundle icon differs from source');
}
const outputs=fs.readdirSync('dist').filter(f=>platform==='darwin'?/mac-arm64\.(dmg|zip)$/.test(f):/win-x64\.(exe|zip)$/.test(f));
assert.equal(outputs.length,2,outputs);
console.log(`PASS ${checked} bundled files match source bytes, including all runtime assets; both deliverables:`,outputs.join(', '));
