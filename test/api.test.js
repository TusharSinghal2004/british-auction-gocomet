import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
test('HTTP flow: create RFQ, bid, cap extension, reject worse revision, persist activity',async()=>{
 const child=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:'3199',DB_PATH:':memory:'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);child.stdout.on('data',chunk=>{if(chunk.toString().includes('GoComet auctions:')){clearTimeout(timer);resolve();}});child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(Error('Server exited: '+code));});});
  const request=async(path='',body)=>{const r=await fetch('http://localhost:3199/api/auctions'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:r.status,data:await r.json()};};
  assert.equal((await fetch('http://localhost:3199/')).status,200);
  assert.equal((await request()).data.length,2);
  const now=Date.now(),iso=n=>new Date(n).toISOString();
  const created=await request('',{name:'Integration RFQ',reference:'TEST-001',start:iso(now-60000),close:iso(now+60000),forcedClose:iso(now+120000),pickup:iso(now+86400000),triggerWindow:10,extension:5,trigger:'bid'});
  assert.equal(created.status,201);const id=created.data.id;
  const quote={carrier:'Test supplier',freight:100,origin:10,destination:20,transit:5,validity:iso(now+2*86400000)};
  const accepted=await request('/'+id+'/bids',quote);assert.equal(accepted.status,201);assert.equal(accepted.data.close,created.data.forcedClose);assert.equal(accepted.data.ranking[0].total,130);assert.equal(accepted.data.activity[0].type,'extension');
  assert.equal((await request('/'+id+'/bids',quote)).status,400);
  const saved=await request('/'+id);assert.equal(saved.data.bids.length,1);assert.equal(saved.data.activity.length,3);
  assert.equal((await request('/999999')).status,404);
 }finally{child.kill();}
});
