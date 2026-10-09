import { afterEach, expect, it, vi } from 'vitest';
import { phase5 } from './phase5-helpers.js';
import { expected } from './phase3-helpers.js';
import { OpenAILLM } from '../src/adapters/ai/openai.js';
import { validatedLLM } from '../src/adapters/ai/providers.js';
let ctx: Awaited<ReturnType<typeof phase5>> | undefined;
afterEach(async()=>{await ctx?.close();ctx=undefined;});
const envelope=(raw:unknown)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(raw)}]}]}));
it.each(['source_identity','source_quote','item_reference','output_schema'] as const)('rejects %s in the record pipeline with safe server-only diagnostics and no stored draft',async(stage)=>{
  const raw=expected('structure/v_im_03.json');
  if(stage==='source_identity')raw.full.sourceRefs[0].source.segmentId='not_in_this_visit';
  if(stage==='source_quote')raw.full.sourceRefs[0].quote='PRIVATE_RESPONSE_SENTINEL missing quotation';
  if(stage==='item_reference')raw.full.answers[0].questionId='invented_question_id';
  if(stage==='output_schema')raw.full.diagnosis[0].id=raw.companion.medChanges[0].id;
  ctx=await phase5(validatedLLM(new OpenAILLM('PRIVATE_KEY_SENTINEL','virtual-model',{fetch:async()=>envelope(raw)})));
  const warn=vi.spyOn(ctx.app.log,'warn');
  expect(await ctx.structure()).toMatchObject({status:'failed',errorCode:'validation_failed',resultVersion:null,mode:null});
  expect(warn).toHaveBeenCalledWith({event:'ai_job_failed',kind:'structure',code:'validation_failed',stage},'AI 작업 실패');
  expect(JSON.stringify(warn.mock.calls)).not.toMatch(/PRIVATE_|not_in_this_visit|invented_question_id|sourceRefs|transcript|patientId|visitId/);
  expect((await ctx.request('u_b',`${ctx.base}?view=draft`)).json()).not.toHaveProperty('record');
  const response=await ctx.request('u_b',ctx.base);expect(response.body).not.toMatch(/stage|diagnostic|PRIVATE_/);
});
it('gives record OpenAI the exact current-visit source catalog and explicit item linkage, then validates mock output before storing',async()=>{
  let body:any;
  ctx=await phase5(validatedLLM(new OpenAILLM('PRIVATE_KEY_SENTINEL','virtual-model',{fetch:async(_url,init)=>{body=JSON.parse(init.body as string);return envelope(expected('structure/v_im_03.json'));}})));
  expect(await ctx.structure()).toMatchObject({status:'succeeded',mode:'live',resultState:'ready'});
  const content:string=body.input[0].content, sent=JSON.parse(content.slice(content.indexOf('{')));
  expect(sent.sourceCatalog).toBeDefined();
  for(const ref of expected('structure/v_im_03.json').full.sourceRefs){
    const source=sent.sourceCatalog.find((r:any)=>JSON.stringify(r.source)===JSON.stringify(ref.source));
    expect(source).toBeDefined();expect(source.quoteOptions.some((q:string)=>q.includes(ref.quote))).toBe(true);
  }
  expect(content).toContain('medChangeId');expect(content).toContain('questionId');expect(content).toContain('alertId=null');
  expect(JSON.stringify(sent.sourceCatalog)).not.toMatch(/v_os_01|ob_03|rx_os_01|가상록소정|private_notes|PRIVATE_KEY/);
  expect(body.store).toBe(false);expect(body.tools).toBeUndefined();
});
it.each([
  ['response_format',{status:'completed',output:[]},200,'validation_failed'],
  ['response_incomplete',{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]},200,'validation_failed'],
  ['response_refusal',{status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'refusal',refusal:'PRIVATE_RESPONSE_SENTINEL'}]}]},200,'validation_failed'],
  ['provider_transport',{error:{message:'PRIVATE_RESPONSE_SENTINEL'}},401,'ai_unavailable'],
] as const)('distinguishes record provider %s without publishing upstream details',async(stage,body,status,code)=>{
  ctx=await phase5(validatedLLM(new OpenAILLM('PRIVATE_KEY_SENTINEL','virtual-model',{fetch:async()=>new Response(JSON.stringify(body),{status})})));
  const warn=vi.spyOn(ctx.app.log,'warn');expect(await ctx.structure()).toMatchObject({status:'failed',errorCode:code,resultVersion:null});
  expect(warn).toHaveBeenCalledWith({event:'ai_job_failed',kind:'structure',code,stage},'AI 작업 실패');
  expect(JSON.stringify(warn.mock.calls)).not.toMatch(/PRIVATE_|max_output_tokens|sourceRefs|transcript|patientId|visitId/);
});
