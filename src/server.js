import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { status, validateAuction, evaluateBid, rank } from './auction.js';
mkdirSync(new URL('../data/',import.meta.url),{recursive:true});
const db = new DatabaseSync(process.env.DB_PATH || fileURLToPath(new URL('../data/auctions.sqlite',import.meta.url)));
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS auctions(id INTEGER PRIMARY KEY, reference TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bids(id INTEGER PRIMARY KEY, auction_id INTEGER NOT NULL REFERENCES auctions(id), payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY, auction_id INTEGER NOT NULL REFERENCES auctions(id), created INTEGER NOT NULL, type TEXT NOT NULL, message TEXT NOT NULL);`);
const log=(id,type,message)=>db.prepare('INSERT INTO activity(auction_id,created,type,message) VALUES(?,?,?,?)').run(id,Date.now(),type,message);
function get(id){ const r=db.prepare('SELECT * FROM auctions WHERE id=?').get(id); if(!r)throw Error('Auction not found'); return {...JSON.parse(r.payload),id:r.id}; }
function bids(id){return db.prepare('SELECT * FROM bids WHERE auction_id=? ORDER BY id').all(id).map(r=>({...JSON.parse(r.payload),id:r.id}));}
function detail(id){const a=get(id), history=bids(id); return {...a,status:status(a),bids:history,ranking:rank(history),activity:db.prepare('SELECT * FROM activity WHERE auction_id=? ORDER BY id DESC').all(id)};}
function create(input){const a=validateAuction(input); const r=db.prepare('INSERT INTO auctions(reference,payload) VALUES(?,?)').run(a.reference,JSON.stringify(a));log(Number(r.lastInsertRowid),'created','RFQ created and auction rules configured');return Number(r.lastInsertRowid);}
function seed(force = false){
 if(force || !db.prepare('SELECT id FROM auctions LIMIT 1').get()){
  db.exec('DELETE FROM activity; DELETE FROM bids; DELETE FROM auctions;');
  const now=Date.now(),iso=n=>new Date(n).toISOString();
  const id=create({name:'Ocean freight · Shanghai to Mumbai',reference:'RFQ-2026-001',start:iso(now-3600000),close:iso(now+18*60000),forcedClose:iso(now+90*60000),pickup:iso(now+7*86400000),triggerWindow:10,extension:5,trigger:'leader'});
  for(const [carrier,freight,origin,destination,transit] of [['Maersk Logistics',2450,180,220,18],['MSC Shipping',2320,200,190,21],['Hapag-Lloyd',2520,160,210,19]]){const b={carrier,freight,origin,destination,transit,validity:now+30*86400000,created:now-600000,total:freight+origin+destination};db.prepare('INSERT INTO bids(auction_id,payload) VALUES(?,?)').run(id,JSON.stringify(b));log(id,'bid',`${carrier} submitted a quote of $${b.total.toFixed(2)}`);}
  create({name:'Air cargo · Frankfurt to Delhi',reference:'RFQ-2026-002',start:iso(now+86400000),close:iso(now+2*86400000),forcedClose:iso(now+2*86400000+3600000),pickup:iso(now+10*86400000),triggerWindow:10,extension:5,trigger:'bid'});
 } else {
  const first=db.prepare("SELECT * FROM auctions WHERE reference='RFQ-2026-001'").get();
  if(first){
   const a=JSON.parse(first.payload);
   if(Date.now()>=a.close){
    const now=Date.now();
    a.start=now-3600000;a.close=now+18*60000;a.forcedClose=now+90*60000;a.pickup=now+7*86400000;
    db.prepare('UPDATE auctions SET payload=? WHERE id=?').run(JSON.stringify(a),first.id);
    log(first.id,'extension',`Demo session refreshed. Deadline extended to ${new Date(a.close).toISOString()}`);
   }
  }
 }
}
seed();
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'};
const server=http.createServer(async(req,res)=>{
 const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')){
   if(req.method==='GET'&&path==='/api/auctions')return send(200,db.prepare('SELECT id FROM auctions ORDER BY id DESC').all().map(r=>detail(r.id)));
   const match=path.match(/^\/api\/auctions\/(\d+)(\/bids)?$/);
   if(req.method==='GET'&&match&&!match[2])return send(200,detail(Number(match[1])));
   if(req.method==='POST'){
    if(path==='/api/reset'){seed(true);return send(200,{success:true});}
    let body='';for await(const chunk of req){body+=chunk;if(body.length>32768)return send(413,{error:'Request too large'});}
    let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Invalid JSON'});}
    if(path==='/api/auctions')return send(201,detail(create(input)));
    if(match&&match[2]){
     const id=Number(match[1]);db.exec('BEGIN IMMEDIATE');
     try{const a=get(id), result=evaluateBid(a,bids(id),input);db.prepare('INSERT INTO bids(auction_id,payload) VALUES(?,?)').run(id,JSON.stringify(result.bid));log(id,'bid',`${result.bid.carrier} submitted a quote of $${result.bid.total.toFixed(2)}`);
      if(result.close>a.close){a.close=result.close;db.prepare('UPDATE auctions SET payload=? WHERE id=?').run(JSON.stringify(a),id);log(id,'extension',`${result.reason}. Deadline extended to ${new Date(a.close).toISOString()}${a.close===a.forcedClose?' (forced-close limit reached)':''}`);}
      db.exec('COMMIT');return send(201,detail(id));
     }catch(e){db.exec('ROLLBACK');throw e;}
    }
   }
   return send(404,{error:'Endpoint not found'});
  }
  if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Method not allowed'});
  const file={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}[path];
  if(!file)return send(404,{error:'Not found'});
  res.writeHead(200,{'Content-Type':types['.'+file.split('.').pop()],'X-Content-Type-Options':'nosniff'});res.end(readFileSync(new URL('../public/'+file,import.meta.url)));
 }catch(e){send(e.message==='Auction not found'?404:400,{error:e.message.includes('UNIQUE')?'That RFQ reference already exists.':e.message});}
});
server.listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('GoComet auctions: http://localhost:'+(process.env.PORT||3000)));
