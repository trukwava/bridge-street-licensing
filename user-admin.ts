/**
 * Offline-only account administration.
 * Passwords are read from stdin; never put secrets in command arguments.
 *
 * read -rsp "New password: " BSL_PW; echo
 * printf '%s' "$BSL_PW" | node user-admin.ts create Taylor supervisor
 * unset BSL_PW
 */
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {ensureAuthSchema,provisionAccount,disableAccount,changePassword,listAccounts} from './auth.ts';

const root=fileURLToPath(new URL('.',import.meta.url));
mkdirSync(resolve(root,'data'),{recursive:true});
const db=new DatabaseSync(process.env.DB_PATH||resolve(root,'data/demo.sqlite'));
try{
 ensureAuthSchema(db);
 const [command,username,role]=process.argv.slice(2);
 if(command==='list'){
  for(const a of listAccounts(db) as any[])console.log(a.username+'\t'+a.role+'\t'+(a.enabled?'enabled':'disabled'));
 }else if(command==='create'||command==='password'){
  if(!username)throw Error('Username required');
  if(process.stdin.isTTY)throw Error('Supply password on stdin through a private shell prompt, not as an argument');
  const password=readFileSync(0,'utf8').replace(/[\r\n]+$/,'');
  if(command==='create')provisionAccount(db,username,password,role as any);
  else changePassword(db,username,password);
  console.log(command==='create'?'Account provisioned':'Password rotated and sessions revoked');
 }else if(command==='disable'){
  if(!username)throw Error('Username required');
  disableAccount(db,username);
  console.log('Account disabled and sessions revoked');
 }else throw Error('Usage: node user-admin.ts <list|create|password|disable> [username] [supervisor|coordinator]');
}catch(e:any){console.error('Account admin:',e.message);process.exitCode=1;}finally{db.close();}
