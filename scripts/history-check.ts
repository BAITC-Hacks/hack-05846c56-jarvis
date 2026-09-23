/** Explicit integration check against the configured project DB; creates and removes one synthetic conversation. No auth accounts or email. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { saveHistory, readHistory, deleteHistory } from '../src/lib/history-store';

async function main() {
  const ownerA = `__jarvis_history_probe_a_${randomUUID()}`;
  const ownerB = `__jarvis_history_probe_b_${randomUUID()}`;
  let id: string | null = null;
  const checks: string[] = [];
  try {
    const initial = { locale: 'ru' as const, messages: [{ id:'probe-message', role:'user' as const, content:'Synthetic ownership test. Safe to delete.' }] };
    const saved = await saveHistory(ownerA, initial); id = saved.id;
    assert.equal(saved.revision,1); checks.push('create-owner-a');
    assert.equal((await readHistory(ownerA,id))?.messages[0].content,initial.messages[0].content);checks.push('read-owner-a');
    assert.equal(await readHistory(ownerB,id),null);checks.push('deny-cross-owner-read');
    await assert.rejects(()=>saveHistory(ownerB,{...initial,id:id!,revision:1}),{status:404});checks.push('deny-cross-owner-update');
    assert.equal(await deleteHistory(ownerB,id),false);checks.push('deny-cross-owner-delete');
    const updated=await saveHistory(ownerA,{...initial,id,revision:1,title:'Updated probe'});assert.equal(updated.revision,2);checks.push('owner-update-revision');
    await assert.rejects(()=>saveHistory(ownerA,{...initial,id:id!,revision:1}),{status:409});checks.push('reject-stale-revision');
    assert.equal(await deleteHistory(ownerA,id),true);assert.equal(await readHistory(ownerA,id),null);checks.push('delete-owner-a-and-confirm');id=null;
    console.log(JSON.stringify({ok:true,checks,syntheticRecordsRemaining:0}));
  } finally { if(id) await deleteHistory(ownerA,id); }
}
void main().catch(error=>{console.error('History integration failed:',error instanceof Error?error.name:'Unknown');process.exitCode=1;});
