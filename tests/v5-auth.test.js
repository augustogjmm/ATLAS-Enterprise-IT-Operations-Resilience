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
    // Se ignoran entradas JWKS corruptas, sin omitir la validación de firma RSA.
    return new Response(JSON.stringify({keys:[null,jwk]}),{status:200,headers:{'content-type':'application/json'}});
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
  // JSON válido pero incompatible con JWT: no permitir 500 por TypeError.
  for(const invalidShape of [null,[],42,'texto']){
    await assert.rejects(verifyAccessToken(req(await token(base,invalidShape)),env,fetcher),AccessError);
    await assert.rejects(verifyAccessToken(req(await token(invalidShape)),env,fetcher),AccessError);
  }
  for(const invalid of [
    {...base,iat:'0'}, {...base,iat:base.exp+500},
    {...base,exp:String(base.exp)}, {...base,nbf:'0'},
    {...base,nbf:base.exp+500}, {...base,exp:base.iat},
    {...base,sub:'x'.repeat(513)}, {...base,email:'x'.repeat(256)+'@a.test'}
  ]) await assert.rejects(verifyAccessToken(req(await token(invalid)),env,fetcher),AccessError);
});

test('Access: rotación JWKS actualiza clave desconocida y limita solicitudes con kid inválido',async()=>{
  const origin='https://atlas-key-rotation-v5.cloudflareaccess.com';
  const aud='atlas-rotation-test-aud';
  async function pair(kid){
    const material=await crypto.subtle.generateKey(
      {name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
        publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},
      true,['sign','verify']);
    const jwk=await crypto.subtle.exportKey('jwk',material.publicKey);jwk.kid=kid;
    return {material,jwk};
  }
  const first=await pair('old-key');
  const second=await pair('new-key');
  let served=[first.jwk],calls=0;
  const fetcher=async url=>{
    assert.equal(url,origin+'/cdn-cgi/access/certs');
    calls++;return Response.json({keys:served});
  };
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const timestamp=Math.floor(Date.now()/1000);
  const claims={iss:origin,aud,sub:'rotation-user',email:'owner@a.test',
    iat:timestamp-2,nbf:timestamp-2,exp:timestamp+100};
  const jwt=async(key,kid)=>{
    const unsigned=encode({alg:'RS256',kid})+'.'+encode(claims);
    const signed=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key.material.privateKey,
      new TextEncoder().encode(unsigned));
    return unsigned+'.'+Buffer.from(signed).toString('base64url');
  };
  const req=value=>new Request('https://atlas.example/api/v1/session',
    {headers:{'Cf-Access-Jwt-Assertion':value}});
  const env={ACCESS_TEAM_DOMAIN:origin,ACCESS_AUD:aud};
  await verifyAccessToken(req(await jwt(first,'old-key')),env,fetcher);
  assert.equal(calls,1);
  served=[second.jwk];
  await verifyAccessToken(req(await jwt(second,'new-key')),env,fetcher);
  assert.equal(calls,2,'No usar clave vieja cuando aparece un nuevo kid firmado');
  const attacker=await jwt(second,'kid-inexistente');
  await assert.rejects(verifyAccessToken(req(attacker),env,fetcher),AccessError);
  await assert.rejects(verifyAccessToken(req(attacker),env,fetcher),AccessError);
  assert.equal(calls,2,'Tras una rotación se respeta el backoff de 30 s ante kids inválidos');
});
