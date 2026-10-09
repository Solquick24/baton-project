import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { openDatabase } from '../src/adapters/sqlite/database.js';
import { readConfig } from '../src/shared/config.js';
import { seedDatabase } from '../../../scripts/seed.js';
import { fixturesDir, password } from './helpers.js';

it('reopens a separate persisted database, exposes interrupted failure through product API, and safely retries once', async () => {
  const temporary=mkdtempSync(join(tmpdir(),'baton-recovery-')), path=join(temporary,'test.sqlite');
  const config=readConfig({NODE_ENV:'test',JWT_SECRET:'isolated-recovery-test-secret-32-characters',LLM_MODE:'fixture',STT_MODE:'fixture',LIVE_FALLBACK_TO_FIXTURE:'false',SQLITE_PATH:path,UPLOAD_DIR:join(temporary,'uploads')});
  let db=openDatabase(path), app=await buildApp({db,config});
  const base='/api/patients/p_01/visits/v_im_03';
  const login=async()=>{const r=await app.inject({method:'POST',url:'/api/auth/login',payload:{email:'b@baton.demo',password}});expect(r.statusCode).toBe(200);return {authorization:`Bearer ${r.json().accessToken}`};};
  try {
    seedDatabase(db,{fixturesDir}); await app.ready(); await app.baton.runner.stop();
    const headers=await login();
    const publishedBefore=(await app.inject({url:'/api/patients/p_01/visits/v_im_02',headers})).json();
    const submit=()=>app.inject({method:'POST',url:`${base}/questions/merge`,headers,payload:{inputVersion:3}});
    const first=await submit();expect(first.statusCode).toBe(202);const id=first.json().jobId;
    expect((await submit()).json().jobId).toBe(id);
    // Arrange the persisted interruption boundary without waiting on a live external provider.
    expect(app.baton.jobs.claim()?.id).toBe(id);
    expect((await submit()).json().jobId).toBe(id);
    await app.close();db.close();
    db=openDatabase(path);app=await buildApp({db,config});await app.ready();await app.baton.runner.stop();
    const recovered=await app.inject({url:`/api/jobs/${id}`,headers});
    expect(recovered.statusCode).toBe(200);expect(recovered.json()).toMatchObject({status:'failed',errorCode:'internal',attempt:1,mode:null,resultVersion:null,resultState:null});
    expect(recovered.body).not.toMatch(/scope|transcript|blocks|sourceRefs|storagePath/);
    expect((await app.inject({url:`${base}/questions`,headers})).json()).not.toHaveProperty('merged');
    const retry=await submit();expect(retry.statusCode).toBe(202);const retryId=retry.json().jobId;expect(retryId).not.toBe(id);
    expect((await submit()).json().jobId).toBe(retryId);await app.baton.runner.runNext();
    expect((await app.inject({url:`/api/jobs/${retryId}`,headers})).json()).toMatchObject({status:'succeeded',attempt:2,mode:'fixture',resultState:'ready',resultVersion:1});
    expect((await submit()).json().jobId).toBe(retryId);
    expect((await app.inject({url:`${base}/questions`,headers})).json().merged.mode).toBe('fixture');
    expect((await app.inject({url:'/api/patients/p_01/visits/v_im_02',headers})).json()).toEqual(publishedBefore);
    // A second startup preserves a completed result; it does not replay generation.
    await app.close();db.close();db=openDatabase(path);app=await buildApp({db,config});
    expect((await app.inject({url:`/api/jobs/${retryId}`,headers})).json().status).toBe('succeeded');
    expect(db.prepare("SELECT count(*) n FROM block_sets WHERE visitId='v_im_03' AND section='questions'").get()).toEqual({n:1});
  } finally {await app.close();db.close();rmSync(temporary,{recursive:true,force:true});}
});
