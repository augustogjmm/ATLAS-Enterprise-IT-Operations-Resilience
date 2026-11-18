import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAccessToken,AccessError} from '../worker/auth.js';

test('JWT Cloudflare Access: firma RS256, issuer, audience y vencimiento',async()=>{
  const origin='https://atlas-v5-security-test.cloudflareaccess.com';
  const aud='atlas-test-audience';
  const keys=await crypto.subtle.generateKey(
    {name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},
    true,['sign','verify']
  );
  const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);
  jwk.kid='test-2026-11';
  const fetcher=async url=>{
    assert.equal(url,origin+'/cdn-cgi/access/certs');
    return new Response(JSON.stringify({keys:[jwk]}),{status:200,headers:{'content-type':'application/json'}});
  };
  const base={
    iss:origin,aud,sub:'access-user-123',email:'Director@Example.com',
    iat:Math.floor(Date.now()/1000)-10,exp:Math.floor(Date.now()/1000)+300
  };
  const enc=obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
  async function token(payload,head={alg:'RS256',kid:jwk.kid,typ:'JWT'}){
    const unsigned=enc(head)+'.'+enc(payload);
    const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(unsigned));
    return unsigned+'.'+Buffer.from(sig).toString('base64url');
  }
  const req=value=>new Request('https://app.example/api/v1/session',{headers:{'Cf-Access-Jwt-Assertion':value}});
  const env={ACCESS_TEAM_DOMAIN:origin,ACCESS_AUD:aud};
  const good=await verifyAccessToken(req(await token(base)),env,fetcher);
  assert.equal(good.email,'director@example.com');
  assert.equal(good.sub,'access-user-123');
  const valid=await token(base);
  const forged=valid.split('.');
  forged[1]=enc({...base,email:'impostor@example.com'});
  await assert.rejects(verifyAccessToken(req(forged.join('.')),env,fetcher),AccessError);
  await assert.rejects(verifyAccessToken(req(await token({...base,aud:'otro-sitio'})),env,fetcher),AccessError);
  await assert.rejects(verifyAccessToken(req(await token({...base,exp:1})),env,fetcher),AccessError);
  await assert.rejects(verifyAccessToken(req(await token({...base,iss:'https://otro.cloudflareaccess.com'})),env,fetcher),AccessError);
  await assert.rejects(verifyAccessToken(req(await token(base,{alg:'none',kid:jwk.kid})),env,fetcher),AccessError);
  await assert.rejects(verifyAccessToken(new Request('https://app.example/api/v1/session'),env,fetcher),AccessError);
  await assert.rejects(verifyAccessToken(req(valid),{ACCESS_TEAM_DOMAIN:'',ACCESS_AUD:aud},fetcher),AccessError);
});
