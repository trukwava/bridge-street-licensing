/**
 * Named local-demo accounts and session authentication.
 * No builtin users, default passwords or public self-registration.
 * This is not an internet-ready identity provider.
 */
import {randomBytes, scryptSync, timingSafeEqual, createHash} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import type {DatabaseSync} from 'node:sqlite';

export type Role='supervisor'|'coordinator';
export type Account={username:string;role:Role};
export type Session={user:Account;csrfToken:string;sessionHash:string};
const SESSION_MS=12*60*60*1000;
const attempts=new Map<string,{failures:number;blockedUntil:number}>();
const SESSION_COOKIE='bsl_session';

export class AuthError extends Error{
 status:number;
 constructor(status:number,message:string){super(message);this.status=status;}
}
export function ensureAuthSchema(db:DatabaseSync){
 db.exec(
  'CREATE TABLE IF NOT EXISTS auth_users (username TEXT PRIMARY KEY, role TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);'+
  'CREATE TABLE IF NOT EXISTS auth_sessions (session_hash TEXT PRIMARY KEY, username TEXT NOT NULL, csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL);'
 );
}
export function validateAccount(username:string,password:string,role:string){
 if(!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username))throw Error('Username must be 3–32 letters, digits, dots, hyphens or underscores');
 if(!['supervisor','coordinator'].includes(role))throw Error('Invalid account role');
 if(typeof password!=='string'||password.length<12||Buffer.byteLength(password,'utf8')>256)throw Error('Password must be at least 12 characters and at most 256 UTF-8 bytes');
}
const hexHash=(data:string)=>createHash('sha256').update(data).digest('hex');
function derived(password:string,salt:string){
 return scryptSync(password,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
}
export function provisionAccount(db:DatabaseSync,username:string,password:string,role:Role){
 validateAccount(username,password,role);
 ensureAuthSchema(db);
 if(db.prepare('SELECT username FROM auth_users WHERE username=?').get(username))throw Error('Account already exists');
 const salt=randomBytes(32).toString('hex');
 db.prepare('INSERT INTO auth_users (username,role,salt,password_hash,enabled) VALUES (?,?,?,?,1)').run(username,role,salt,derived(password,salt));
}
export function disableAccount(db:DatabaseSync,username:string){
 ensureAuthSchema(db);
 const user=db.prepare('SELECT username FROM auth_users WHERE username=?').get(username);
 if(!user)throw Error('Account not found');
 const supervisor=db.prepare("SELECT COUNT(*) AS count FROM auth_users WHERE role='supervisor' AND enabled=1").get() as {count:number};
 const target=db.prepare('SELECT role,enabled FROM auth_users WHERE username=?').get(username) as {role:string;enabled:number};
 if(target.enabled===1&&target.role==='supervisor'&&supervisor.count<=1)throw Error('Cannot disable the final supervisor');
 db.prepare('UPDATE auth_users SET enabled=0 WHERE username=?').run(username);
 db.prepare('DELETE FROM auth_sessions WHERE username=?').run(username);
}
export function changePassword(db:DatabaseSync,username:string,password:string){
 ensureAuthSchema(db);
 const existing=db.prepare('SELECT username,role FROM auth_users WHERE username=?').get(username) as {username:string;role:Role}|undefined;
 if(!existing)throw Error('Account not found');
 validateAccount(username,password,existing.role);
 const salt=randomBytes(32).toString('hex');
 db.prepare('UPDATE auth_users SET salt=?,password_hash=?,enabled=1 WHERE username=?').run(salt,derived(password,salt),username);
 db.prepare('DELETE FROM auth_sessions WHERE username=?').run(username);
}
export function listAccounts(db:DatabaseSync){
 ensureAuthSchema(db);
 return db.prepare('SELECT username,role,enabled FROM auth_users ORDER BY username').all();
}
export function accountsConfigured(db:DatabaseSync){
 ensureAuthSchema(db);
 const row=db.prepare('SELECT COUNT(*) AS count FROM auth_users WHERE enabled=1').get() as {count:number};
 return row.count>0;
}
export function login(db:DatabaseSync,username:string,password:string){
 ensureAuthSchema(db);
 if(typeof username!=='string'||typeof password!=='string'||username.length>64||Buffer.byteLength(password,'utf8')>256)throw new AuthError(401,'Invalid username or password');
 const key=/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username)?username:'<invalid>';
 const now=Date.now();
 const existing=attempts.get(key);
 if(existing&&existing.blockedUntil>now)throw new AuthError(429,'Too many login attempts. Try again later');
 const user=db.prepare('SELECT username,role,salt,password_hash,enabled FROM auth_users WHERE username=?').get(username) as any;
 // Equal-cost derivation for nonexistent users, avoiding cheap account enumeration.
 const computed=derived(password,user?.salt||'0'.repeat(64));
 const expected=Buffer.from(user?.password_hash||'0'.repeat(128),'hex');
 const valid=timingSafeEqual(Buffer.from(computed,'hex'),expected)&&user?.enabled===1;
 if(!valid){
  const failures=(existing?.failures||0)+1;
  if(attempts.size>1000)attempts.clear();
  attempts.set(key,{failures,blockedUntil:failures>=5?now+60_000:0});
  throw new AuthError(401,'Invalid username or password');
 }
 attempts.delete(key);
 const token=randomBytes(32).toString('hex');
 const csrfToken=randomBytes(32).toString('hex');
 db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(now);
 db.prepare('INSERT INTO auth_sessions (session_hash,username,csrf_token,expires_at) VALUES (?,?,?,?)').run(hexHash(token),username,csrfToken,now+SESSION_MS);
 return {token,csrfToken,user:{username:user.username,role:user.role as Role}};
}
function cookieToken(req:IncomingMessage){
 const value=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='));
 const token=value?.slice(SESSION_COOKIE.length+1);
 return token&&/^[0-9a-f]{64}$/.test(token)?token:null;
}
export function resolveSession(db:DatabaseSync,req:IncomingMessage):Session|null{
 const token=cookieToken(req);
 if(!token)return null;
 const hash=hexHash(token);
 const row=db.prepare(
  'SELECT s.username,s.csrf_token,s.expires_at,u.role,u.enabled FROM auth_sessions s JOIN auth_users u ON u.username=s.username WHERE s.session_hash=?'
 ).get(hash) as any;
 if(!row||!row.enabled||row.expires_at<=Date.now())return null;
 return {user:{username:row.username,role:row.role as Role},csrfToken:row.csrf_token,sessionHash:hash};
}
export function assertCsrf(session:Session,provided:string|undefined){
 const token=typeof provided==='string'&&/^[0-9a-f]{64}$/.test(provided)?provided:'';
 const expected=Buffer.from(session.csrfToken,'hex');
 const actual=Buffer.from(token,'hex');
 if(actual.length!==expected.length||!timingSafeEqual(expected,actual))throw new AuthError(403,'Invalid session request token');
}
export function requireRole(session:Session,role:Role='supervisor'){
 if(session.user.role!==role)throw new AuthError(403,'Supervisor permission required');
}
export function logout(db:DatabaseSync,session:Session){
 db.prepare('DELETE FROM auth_sessions WHERE session_hash=?').run(session.sessionHash);
}
export function sessionCookie(token:string,secure=false){
 return SESSION_COOKIE+'='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+Math.floor(SESSION_MS/1000)+(secure?'; Secure':'');
}
export function clearSessionCookie(secure=false){
 return SESSION_COOKIE+'=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(secure?'; Secure':'');
}
