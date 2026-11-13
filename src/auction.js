export function status(a, now = Date.now()) {
  if (now >= a.forcedClose) return a.close === a.forcedClose ? 'Force Closed' : 'Closed';
  if (now >= a.close) return 'Closed';
  return now < a.start ? 'Scheduled' : 'Active';
}
export function validateAuction(input, now = Date.now()) {
  const a = { name: String(input.name || '').trim(), reference: String(input.reference || '').trim(), start: Date.parse(input.start), close: Date.parse(input.close), forcedClose: Date.parse(input.forcedClose), pickup: Date.parse(input.pickup), triggerWindow: Number(input.triggerWindow), extension: Number(input.extension), trigger: input.trigger, british: input.british !== false };
  if (!a.name || !a.reference) throw Error('RFQ name and reference are required.');
  if (![a.start,a.close,a.forcedClose,a.pickup].every(Number.isFinite)) throw Error('All dates must be valid.');
  if (a.close <= a.start || a.close <= now) throw Error('Close time must be after start time and in the future.');
  if (a.forcedClose <= a.close) throw Error('Forced close must be later than bid close.');
  if (a.pickup < a.close) throw Error('Service date must be after bidding closes.');
  if (![a.triggerWindow,a.extension].every(n => Number.isInteger(n) && n > 0 && n <= 1440)) throw Error('Trigger window and extension must be whole minutes between 1 and 1440.');
  if (!['bid','rank','leader'].includes(a.trigger)) throw Error('Select a valid extension trigger.');
  return a;
}
export function rank(bids) {
  const latest = new Map();
  for (const b of bids) latest.set(b.carrier.toLowerCase(),b);
  return [...latest.values()].sort((a,b)=>a.total-b.total || a.created-b.created || a.id-b.id);
}
export function evaluateBid(a, bids, input, now = Date.now()) {
  if (status(a,now) !== 'Active') throw Error('Bids are accepted only while the auction is active.');
  const b = {carrier:String(input.carrier || '').trim(),freight:Number(input.freight),origin:Number(input.origin),destination:Number(input.destination),transit:Number(input.transit),validity:Date.parse(input.validity),created:now};
  if (!b.carrier || b.carrier.length > 120) throw Error('Carrier name is required (maximum 120 characters).');
  if (![input.freight,input.origin,input.destination,input.transit].every(v=>v !== '' && v != null)) throw Error('Complete all charge and transit fields.');
  if (![b.freight,b.origin,b.destination].every(n=>Number.isFinite(n)&&n>=0) || !Number.isInteger(b.transit) || b.transit<1) throw Error('Charges must be non-negative and transit must be a positive whole number.');
  b.total = Math.round((b.freight+b.origin+b.destination)*100)/100;
  if (b.total <= 0 || b.total > 1e12) throw Error('Total quote must be positive and below 1 trillion.');
  if (!Number.isFinite(b.validity) || b.validity < Math.max(now,a.pickup)) throw Error('Quote validity must cover the service date and cannot be in the past.');
  const before = rank(bids), previous = before.find(x=>x.carrier.toLowerCase()===b.carrier.toLowerCase());
  if (previous && b.total >= previous.total) throw Error('Your revised quote must be lower than your previous quote.');
  const after = rank([...bids,b]);
  const leaderChanged = before.length>0 && before[0].carrier.toLowerCase()!==after[0].carrier.toLowerCase();
  const rankChanged = before.some((x,i)=>after.findIndex(y=>y.carrier.toLowerCase()===x.carrier.toLowerCase())!==i);
  const triggered = a.trigger==='bid' || (a.trigger==='rank' && rankChanged) || (a.trigger==='leader' && leaderChanged);
  const close = a.british && a.close-now <= a.triggerWindow*60000 && triggered ? Math.min(a.close+a.extension*60000,a.forcedClose) : a.close;
  return {bid:b,close,reason:{bid:'Bid received in trigger window',rank:'Supplier ranking changed',leader:'Lowest bidder (L1) changed'}[a.trigger]};
}
