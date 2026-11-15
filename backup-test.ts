import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const dir=mkdtempSync(join(tmpdir(),'bridge-backup-test-'));
const path=join(dir,'demo.sqlite'),backup=join(dir,'archive.json'),tampered=join(dir,'tampered.json');
const run=(...args:string[])=>spawnSync(process.execPath,['backup.ts',...args],{env:{...process.env,DB_PATH:path},encoding:'utf8'});
try{
 const db=new DatabaseSync(path);
 db.exec('CREATE TABLE records (id TEXT PRIMARY KEY,org TEXT NOT NULL,revision INTEGER NOT NULL,body TEXT NOT NULL);CREATE TABLE templates (version INTEGER PRIMARY KEY,body TEXT NOT NULL)');
 const tmpl={version:1,tasks:['Original task']};
 const caseFile={id:'SAMPLE-01',reference:'FAKE-001',revision:1,status:'active',templateVersion:1,tasks:[],deficiencies:[],activity:[]};
 db.prepare('INSERT INTO templates VALUES (?,?)').run(1,JSON.stringify(tmpl));
 db.prepare('INSERT INTO records VALUES (?,?,?,?)').run(caseFile.id,'demo',1,JSON.stringify(caseFile));
 db.close();
 assert.equal(run('export',backup).status,0,'Export creates archive');
 assert.equal(run('verify',backup).status,0,'Checksum verifies');
 assert.notEqual(run('export',backup).status,0,'Never overwrite a backup');
 const envelope=JSON.parse(readFileSync(backup,'utf8'));envelope.payload.records[0].body.reference='TAMPERED';
 writeFileSync(tampered,JSON.stringify(envelope));
 assert.notEqual(run('verify',tampered).status,0,'Tamper must fail verification');
 assert.notEqual(run('restore',backup).status,0,'Restore requires explicit --replace');
 assert.notEqual(run('restore',tampered,'--replace').status,0,'Tampered restore must be rejected');
 const changed=new DatabaseSync(path);
 changed.prepare('DELETE FROM records').run();
 changed.close();
 assert.equal(run('restore',backup,'--replace').status,0,'Explicit restore succeeds');
 const recovered=new DatabaseSync(path);
 const restored:any=recovered.prepare('SELECT body FROM records WHERE id=?').get('SAMPLE-01');
 assert.equal(JSON.parse(restored.body).reference,'FAKE-001');
 recovered.close();
 console.log('PASS: backup export, verify, no overwrite, tamper detection, explicit restore, recovered original');
}finally{rmSync(dir,{recursive:true,force:true});}
