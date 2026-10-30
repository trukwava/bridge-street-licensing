/**
 * Synthetic-only, explicit backup/recovery tool. Run with Node 24+.
 *
 * node backup.ts export ./backups/demo-2026-10-30.json
 * node backup.ts verify ./backups/demo-2026-10-30.json
 * node backup.ts restore ./backups/demo-2026-10-30.json --replace
 *
 * Restoring is destructive. It is never exposed through HTTP.
 * This tool is not a production database backup strategy.
 */
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('.',import.meta.url));
const dbPath=process.env.DB_PATH||resolve(root,'data/demo.sqlite');
const [,,command,arg,flag]=process.argv;
const fail=(message:string):never=>{throw Error(message)};
const sha256=(value:string)=>createHash('sha256').update(value).digest('hex');
function validatePayload(value:any){
 if(!value||value.format!=='bridge-street-synthetic-backup-v1'||value.organization!=='demo')fail('Unsupported backup format or organization');
 if(!Array.isArray(value.records)||!Array.isArray(value.templates)||!value.records.length||!value.templates.length)fail('Missing backup records or templates');
 if(value.records.length>10000||value.templates.length>1000)fail('Backup exceeds synthetic size limits');
 const recordIds=new Set(),refs=new Set(),templateVersions=new Set();
 for(const item of value.records){
  if(!item||typeof item.id!=='string'||typeof item.revision!=='number'||item.revision<1||!item.body||item.body.id!==item.id||item.body.revision!==item.revision||item.body.status===undefined||!Array.isArray(item.body.tasks)||!Array.isArray(item.body.deficiencies)||!Array.isArray(item.body.activity))fail('Malformed application record');
  if(recordIds.has(item.id))fail('Duplicate application ID');
  recordIds.add(item.id);
  const ref=String(item.body.reference||'').trim().toLowerCase();
  if(!ref||refs.has(ref))fail('Duplicate or missing application reference');
  refs.add(ref);
  if(JSON.stringify(item.body).length>2_000_000)fail('Application too large');
 }
 for(const item of value.templates){
  if(!item||!Number.isInteger(item.version)||item.version<1||!item.body||item.body.version!==item.version||!Array.isArray(item.body.tasks))fail('Malformed template');
  if(templateVersions.has(item.version))fail('Duplicate template version');
  templateVersions.add(item.version);
 }
 for(const item of value.records)if(!templateVersions.has(item.body.templateVersion))fail('Application template version is missing');
 return value;
}
function readVerified(path:string){
 const file=JSON.parse(readFileSync(path,'utf8'));
 if(typeof file.checksum!=='string'||!file.payload)fail('Backup checksum or payload missing');
 const actual=sha256(JSON.stringify(file.payload));
 if(actual!==file.checksum)fail('Backup integrity check failed: checksum mismatch');
 return validatePayload(file.payload);
}
function connect(){
 const db=new DatabaseSync(dbPath);
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('records','templates')").all();
 if(tables.length!==2)fail('Database schema unavailable; start the demo first');
 return db;
}
function exportBackup(path:string){
 const db=connect();
 try{
  const records=db.prepare("SELECT id,revision,body FROM records WHERE org='demo' ORDER BY id").all().map((r:any)=>({id:r.id,revision:r.revision,body:JSON.parse(r.body)}));
  const templates=db.prepare('SELECT version,body FROM templates ORDER BY version').all().map((r:any)=>({version:r.version,body:JSON.parse(r.body)}));
  const payload=validatePayload({format:'bridge-street-synthetic-backup-v1',organization:'demo',createdAt:new Date().toISOString(),records,templates});
  const envelope=JSON.stringify({checksum:sha256(JSON.stringify(payload)),payload},null,2)+'\n';
  const destination=resolve(path);
  mkdirSync(dirname(destination),{recursive:true});
  if(existsSync(destination))fail('Destination already exists; choose a new backup filename');
  const tmp=destination+'.partial-'+process.pid;
  let fd:number|undefined;
  try{fd=openSync(tmp,'wx',0o600);writeFileSync(fd,envelope,'utf8');closeSync(fd);fd=undefined;renameSync(tmp,destination);}
  catch(e){if(fd!==undefined)closeSync(fd);try{unlinkSync(tmp)}catch{}throw e;}
  console.log('Backup created:',destination,'applications:',records.length,'templates:',templates.length);
 }finally{db.close();}
}
function restoreBackup(path:string,replace:boolean){
 if(!replace)fail('Restore is destructive: append --replace to confirm');
 const payload=readVerified(path);
 const db=connect();
 try{
  db.exec('BEGIN IMMEDIATE');
  try{
   db.prepare("DELETE FROM records WHERE org='demo'").run();
   db.prepare('DELETE FROM templates').run();
   const templateInsert=db.prepare('INSERT INTO templates (version,body) VALUES (?,?)');
   for(const item of payload.templates)templateInsert.run(item.version,JSON.stringify(item.body));
   const recordInsert=db.prepare('INSERT INTO records (id,org,revision,body) VALUES (?,?,?,?)');
   for(const item of payload.records)recordInsert.run(item.id,'demo',item.revision,JSON.stringify(item.body));
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  console.log('Demo restored:',payload.records.length,'applications,',payload.templates.length,'templates');
 }finally{db.close();}
}
try{
 if(command==='export'&&arg)exportBackup(arg);
 else if(command==='verify'&&arg){const p=readVerified(arg);console.log('Verified:',p.records.length,'applications,',p.templates.length,'templates');}
 else if(command==='restore'&&arg)restoreBackup(arg,flag==='--replace');
 else fail('Usage: node backup.ts <export|verify|restore> <filename> [--replace]');
}catch(e:any){console.error('Backup tool:',e.message);process.exitCode=1;}
