import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../morphs-data.js';
const {entries,search,toggleTrait}=globalThis.CrestieMorphs;
test('visual combinations and het carriers stay distinct and discoverable',()=>{
  assert.equal(new Set(entries.map(m=>m.id)).size,entries.length);
  for(const id of ['lilly','axanthic','lilly-axanthic','lilly-het']) assert(entries.find(m=>m.id===id));
  assert(search('릴잔틱').some(m=>m.id==='lilly-axanthic'));
  assert(search('Lilly White Axanthic').some(m=>m.id==='lilly-axanthic'));
  assert(search('pinstripe','detail').some(m=>m.id==='full-pinstripe'));
  assert.equal(search('존재하지 않는 모프').length,0);
});
test('selected traits roundtrip through existing data without changing genetics or legacy fields',()=>{
  const old={geckos:[{id:'old',name:'크레',morph:'기존 분양 표기',customTraits:['기존 혈통'],notes:'보존 메모',photoUrl:'https://example.com/photo.webp',genetics:{axanthic:'unknown'}}],growth:[],pairings:[],photos:[{id:'photo'}],ledger:[{id:'entry'}]};
  const traits=toggleTrait(old.geckos[0].customTraits.join(', '),'릴리아잔틱');
  old.geckos[0].customTraits=traits.split(', ');
  const context=vm.createContext({localStorage:{getItem:()=>JSON.stringify(old)}});
  const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  vm.runInContext(app.slice(0,app.indexOf('function getGecko'))+';globalThis.result=state;',context);
  const result=JSON.parse(JSON.stringify(context.result));
  assert.deepEqual(result.geckos[0].customTraits,['기존 혈통','릴리아잔틱']);
  assert.equal(result.geckos[0].genetics.axanthic,'unknown');
  assert.equal(result.geckos[0].morph,'기존 분양 표기');
  assert.equal(result.geckos[0].notes,'보존 메모');
  assert.equal(result.geckos[0].photoUrl,old.geckos[0].photoUrl);
  assert.deepEqual(result.photos,old.photos);assert.deepEqual(result.ledger,old.ledger);
  assert.equal(toggleTrait(traits,'릴리아잔틱'),'기존 혈통');
});
test('custom trait badges escape user input',()=>{
  const context=vm.createContext({document:{querySelector:()=>null}});
  const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  vm.runInContext(app.slice(0,app.indexOf('let currentView')),context);
  const ui=fs.readFileSync(new URL('../morphs.js',import.meta.url),'utf8');
  vm.runInContext(ui.replace('initMorphPicker();',''),context);
  const html=vm.runInContext('morphBadges({customTraits:["<img src=x onerror=alert(1)>"]})',context);
  assert(!html.includes('<img'));assert(html.includes('&lt;img'));
});
