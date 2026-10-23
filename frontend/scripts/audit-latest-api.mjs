import fs from 'node:fs';
import {parse} from 'yaml';
import ts from 'typescript';
const old=parse(fs.readFileSync(new URL('../../docs/吃什么接口文档v2-openapi.yaml',import.meta.url),'utf8'));
const latest=JSON.parse(fs.readFileSync(new URL('../../docs/EatWhat 业务服务 API.openapi.json',import.meta.url),'utf8'));
const verbs=['get','post','put','patch','delete','head','options'];
const operations=spec=>Object.entries(spec.paths).flatMap(([path,item])=>verbs.filter(method=>item[method]).map(method=>({key:`${method.toUpperCase()} ${path}`,path,method,op:item[method]})));
const before=operations(old),after=operations(latest),beforeMap=new Map(before.map(x=>[x.key,x])),afterMap=new Map(after.map(x=>[x.key,x]));
function delta(a,b,path=''){
 if(JSON.stringify(a)===JSON.stringify(b))return [];
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>delta(a[k],b[k],path+'/'+k));
 return [{path,before:a,after:b}];
}
const changes=after.filter(x=>beforeMap.has(x.key)).map(x=>({key:x.key,changes:delta(beforeMap.get(x.key).op,x.op)})).filter(x=>x.changes.length);
const schemasBefore=old.components?.schemas??{},schemasAfter=latest.components?.schemas??{};
const schemaChanges=Object.keys(schemasAfter).filter(n=>schemasBefore[n]).map(name=>({name,changes:delta(schemasBefore[name],schemasAfter[name])})).filter(x=>x.changes.length);
const report={oldVersion:old.info.version,newVersion:latest.info.version,oldOperations:before.length,newOperations:after.length,servers:latest.servers,added:after.filter(x=>!beforeMap.has(x.key)),removed:before.filter(x=>!afterMap.has(x.key)),changes,newSchemas:Object.keys(schemasAfter).filter(n=>!schemasBefore[n]),removedSchemas:Object.keys(schemasBefore).filter(n=>!schemasAfter[n]),schemaChanges};
// Capture current service calls through a mock transport; never contact a server.
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const clientUrl=moduleUrl(transpile(fs.readFileSync(new URL('../src/api/client.ts',import.meta.url),'utf8')));
const serviceSource=transpile(fs.readFileSync(new URL('../src/api/service.ts',import.meta.url),'utf8')).replace('from "./client"',`from "${clientUrl}"`);
const {createApi}=await import(moduleUrl(serviceSource)),calls=[];
const api=createApi(async(path,options)=>{calls.push({path,options});return {code:0,data:{}};});
const fixtures=fs.readFileSync(new URL('../src/api/contract.test.ts',import.meta.url),'utf8');
const fixtureList=fixtures.match(/await Promise\.all\((\[[\s\S]*?\])\);/)[1];
await new Function('api',`return Promise.all(${fixtureList});`)(api);
report.currentService={count:calls.length,checks:calls.map(({path,options})=>{
 const method=(options.method??'GET').toLowerCase();
 const match=after.find(x=>x.method===method&&new RegExp('^'+x.path.replace(/\{[^}]+\}/g,'[^/]+')+'$').test(path));
 return {path,method,template:match?.path,permission:match?.op['x-permission'],missingRequiredQuery:(match?.op.parameters??[]).filter(p=>p.in==='query'&&p.required&&options.query?.[p.name]===undefined).map(p=>p.name),responseSchema:match?.op.responses?.['200']?.content?.['application/json']?.schema};
}),realBackendRequests:0};
fs.writeFileSync(new URL('../../output/latest-api-diff.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({oldVersion:report.oldVersion,newVersion:report.newVersion,oldOperations:before.length,newOperations:after.length,addedOperations:report.added.map(x=>x.key),removedOperations:report.removed.map(x=>x.key),currentService: {count:calls.length,missingOrChangedRequiredParams:report.currentService.checks.filter(x=>!x.template||x.missingRequiredQuery.length),realBackendRequests:0},responseSchemaChanges:changes.filter(x=>x.changes.some(c=>c.path.startsWith('/responses/200/content'))).map(x=>({key:x.key,changes:x.changes.filter(c=>c.path.startsWith('/responses/200/content'))})),fieldAdditions:Object.keys(schemasAfter).filter(n=>schemasBefore[n]&&!n.startsWith('Result_')).map(name=>({name,added:Object.keys(schemasAfter[name].properties??{}).filter(k=>!schemasBefore[name].properties?.[k]),removed:Object.keys(schemasBefore[name].properties??{}).filter(k=>!schemasAfter[name].properties?.[k])})).filter(x=>x.added.length||x.removed.length)},null,2));
