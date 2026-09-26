import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
test('delivery preserves webhook bytes, cookies, redirects and bypasses cache',async()=>{
 const original=globalThis.fetch;
 try {
  for(const status of [200,302,500]) {
   const request=new Request('https://opportunityhunter.xyz/api/razorpay/webhook',{method:'POST',headers:{cookie:'session=fixture','x-razorpay-signature':'fixture'},body:'{"event":"order.paid"}'});
   globalThis.fetch=async(r,options)=>{assert.equal(r,request);assert.equal(options.cache,'no-store');assert.equal(options.redirect,'manual');assert.equal(await r.text(),'{"event":"order.paid"}');return new Response('body',{status,headers:{'Set-Cookie':'session=fixture; HttpOnly','Location':'/settings','Cache-Control':'public,max-age=999'}});};
   const result=await worker.fetch(request,{RELEASE_SHA:'abc'});
   assert.equal(result.status,status);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(result.headers.get('set-cookie'),'session=fixture; HttpOnly');assert.equal(result.headers.get('location'),'/settings');assert.equal(result.headers.get('x-edge-commit'),'abc');assert.equal(await result.text(),'body');
  }
 }finally{globalThis.fetch=original;}
});
