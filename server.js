'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=+(process.env.PORT||8080),DATA=process.env.DARDASHAT_DATA_DIR||'/data';
const ADM=process.env.DARDASHAT_ADMIN_CODE||'';
if(ADM.length<16){console.error('DARDASHAT_ADMIN_CODE must have 16+ characters');process.exit(1)}
const ROOMS=['العامة','التعارف','الألعاب','التقنية'],LIMIT=20,MAXMSG=800;
fs.mkdirSync(DATA,{recursive:true});
const dbfile=path.join(DATA,'chat.json');
let db={users:{},messages:[],seq:1};
try{const saved=JSON.parse(fs.readFileSync(dbfile,'utf8'));if(saved.users&&saved.messages)db=saved}catch(e){if(e.code!=='ENOENT')console.error('Storage read failed:',e.message)}
const sessions=new Map(),adminSessions=new Map(),failures=new Map();
const now=()=>Date.now(),random=()=>crypto.randomBytes(32).toString('base64url');
function save(){const tmp=dbfile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db),{mode:0o600});fs.renameSync(tmp,dbfile)}
function json(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj))}
function bad(res,status,error){json(res,status,{error})}
function cookie(req,key){const s=req.headers.cookie||'';for(const item of s.split(';')){const [k,...v]=item.trim().split('=');if(k===key)return v.join('=')}return ''}
function setcookie(res,key,value,age){res.setHeader('Set-Cookie',key+'='+value+'; Path=/; SameSite=Strict; HttpOnly; Secure; Max-Age='+age)}
function validName(x){return typeof x==='string'&&x.length>=2&&Array.from(x).length<=22&&!/[\u0000-\u001f\u007f]/.test(x)}
function normal(x){return String(x||'').trim().replace(/\s+/g,' ')}
function userKey(x){return normal(x).toLocaleLowerCase()}
function passwordHash(s,p){return crypto.scryptSync(p,Buffer.from(s,'hex'),64,{N:16384,r:8,p:1}).toString('hex')}
function eq(a,b){try{const x=Buffer.from(a,'hex'),y=Buffer.from(b,'hex');return x.length===y.length&&crypto.timingSafeEqual(x,y)}catch{return false}}
function remote(req){let ip=req.socket.remoteAddress||'local';if(process.env.DARDASHAT_CLOUD==='1'){const v=req.headers['x-forwarded-for'];if(typeof v==='string')ip=v.split(',')[0].trim()}return ip.slice(0,128)}
function limited(id){const cutoff=now()-300000;const a=(failures.get(id)||[]).filter(t=>t>cutoff);failures.set(id,a);return a.length>=12}
function failed(id){const a=failures.get(id)||[];a.push(now());failures.set(id,a)}
function active(){const out=new Map();for(const [t,s] of sessions){if(now()-s.seen>7*86400000){sessions.delete(t);continue}if(now()-s.seen<65000&&db.users[s.user]&&(!db.users[s.user].ban||db.users[s.user].ban<now()))out.set(s.user,s.room)}return out}
function member(req,res){const sid=cookie(req,'dsid'),s=sessions.get(sid);if(!s||now()-s.seen>7*86400000||!db.users[s.user]||db.users[s.user].ban>now()){bad(res,401,'انتهت الجلسة، سجّل الدخول مجدداً');return null}const on=active();if(now()-s.seen>65000&&!on.has(s.user)&&on.size>=LIMIT){bad(res,403,'الدردشة ممتلئة حالياً');return null}s.seen=now();return {user:s.user,sid,s}}
function admin(req){const t=cookie(req,'dadmin');return adminSessions.get(t)>now()}
const responseHeaders={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; object-src 'none'; frame-ancestors 'none'"};
async function body(req){let chunks=[],n=0;for await(const c of req){n+=c.length;if(n>16384)throw Error('حجم الطلب كبير');chunks.push(c)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
async function route(req,res){
for(const [k,v] of Object.entries(responseHeaders))res.setHeader(k,v);
const url=new URL(req.url,'http://localhost'),p=url.pathname;
if(p==='/api/health')return json(res,200,{ok:true,app:'دردشات',rooms:4,capacity:LIMIT});
if(p==='/'||p==='/index.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return fs.createReadStream(path.join(__dirname,'index.html')).pipe(res)}
if(p==='/manifest.webmanifest'){res.writeHead(200,{'content-type':'application/manifest+json'});return res.end(JSON.stringify({name:'دردشات ♥',short_name:'دردشات',start_url:'/',display:'standalone',background_color:'#0b1020',theme_color:'#0b1020'}))}
if(!p.startsWith('/api/'))return bad(res,404,'غير موجود');
if(p==='/api/me'&&req.method==='GET'){const m=member(req,res);if(m)return json(res,200,{name:db.users[m.user].name});return}
if(p==='/api/state'&&req.method==='GET'){
const m=member(req,res);if(!m)return;
let room=url.searchParams.get('room')||ROOMS[0];if(!ROOMS.includes(room))room=ROOMS[0];
const peer=userKey(url.searchParams.get('peer'));sessions.get(m.sid).room=room;
const on=active(),members=[...on].map(([key,r])=>({name:db.users[key]?.name||key,room:r}));
const counts=Object.fromEntries(ROOMS.map(x=>[x,0]));for(const r of on.values())counts[r]++;
const messages=db.messages.filter(x=>peer?(x.to&&((x.from===m.user&&x.to===peer)||(x.from===peer&&x.to===m.user))):(!x.to&&x.room===room)).slice(-100);
let inbox={};for(const x of db.messages){if(!x.to)continue;if(x.from===m.user||x.to===m.user){let other=x.from===m.user?x.to:x.from;inbox[other]={name:db.users[other]?.name||other,last:x}}}
return json(res,200,{me:db.users[m.user].name,room,rooms:ROOMS,members,counts,count:on.size,capacity:LIMIT,messages,inbox:Object.values(inbox).sort((a,b)=>b.last.id-a.last.id)});
}
if(req.method!=='POST')return bad(res,405,'طريقة الطلب غير مدعومة');
if(!(req.headers['content-type']||'').startsWith('application/json'))return bad(res,415,'أرسل JSON');
let v;try{v=await body(req)}catch{return bad(res,400,'بيانات غير صحيحة')}
if(p==='/api/auth'){
const name=normal(v.name),pass=v.password,key=userKey(name),ip=remote(req);
if(!validName(name)||typeof pass!=='string'||pass.length<6||pass.length>128)return bad(res,400,'الاسم من 2 إلى 22 حرفاً وكلمة المرور 6 أحرف على الأقل');
if(limited(ip))return bad(res,429,'محاولات دخول كثيرة، حاول بعد قليل');
let u=db.users[key],created=!u;
if(u){if(!eq(u.hash,passwordHash(u.salt,pass))){failed(ip);return bad(res,401,'كلمة المرور غير صحيحة')}if(u.ban>now())return bad(res,403,'الحساب موقوف مؤقتاً')}
else{if(Object.keys(db.users).length>=300)return bad(res,403,'تم بلوغ حد الحسابات');const salt=crypto.randomBytes(16).toString('hex');u={name,salt,hash:passwordHash(salt,pass),ban:0};}
const on=active();if(!on.has(key)&&on.size>=LIMIT)return bad(res,403,'الغرف ممتلئة (20/20)');
if(created){db.users[key]=u;save()}
for(const [token,s] of sessions){if(s.user===key)sessions.delete(token)}
const sid=random();sessions.set(sid,{user:key,room:ROOMS[0],seen:now(),times:[]});setcookie(res,'dsid',sid,604800);
return json(res,200,{ok:true,name:u.name,newAccount:created})
}
if(p==='/api/logout'){sessions.delete(cookie(req,'dsid'));setcookie(res,'dsid','',0);return json(res,200,{ok:true})}
if(p==='/api/admin/login'){
const ip='admin:'+remote(req);if(limited(ip))return bad(res,429,'انتظر قبل المحاولة مجدداً');
if(typeof v.code!=='string'||v.code!==ADM){failed(ip);return bad(res,403,'رمز الإدارة غير صحيح')}
const t=random();adminSessions.set(t,now()+21600000);setcookie(res,'dadmin',t,21600);return json(res,200,{ok:true})
}
if(p==='/api/admin/action'){
if(!admin(req))return bad(res,403,'غير مصرح');
if(v.action==='delete'){const k=db.messages.findIndex(x=>x.id===Number(v.id));if(k<0)return bad(res,404,'الرسالة غير موجودة');db.messages.splice(k,1);save();return json(res,200,{ok:true})}
if(v.action==='kick'||v.action==='ban'){const key=userKey(v.user),u=db.users[key];if(!u)return bad(res,404,'المستخدم غير موجود');if(v.action==='ban'){u.ban=now()+1800000;save()}for(const [t,s] of sessions)if(s.user===key)sessions.delete(t);return json(res,200,{ok:true})}
return bad(res,400,'أمر غير معروف')
}
if(p==='/api/admin/status')return json(res,200,{admin:admin(req)});
const m=member(req,res);if(!m)return;
if(p==='/api/send'){
const text=normal(v.text),room=v.room||ROOMS[0],to=userKey(v.to),ss=sessions.get(m.sid);
if(!text||Array.from(text).length>MAXMSG)return bad(res,400,'الرسالة من 1 إلى 800 حرف');
if(!to&&!ROOMS.includes(room))return bad(res,400,'الغرفة غير موجودة');
if(to===m.user)return bad(res,400,'لا يمكن مراسلة نفسك');
if(to&&!db.users[to])return bad(res,404,'المستخدم غير موجود');
ss.times=ss.times.filter(t=>now()-t<8000);
if(ss.times.length>=5)return bad(res,429,'تمهّل قبل إرسال المزيد');
ss.times.push(now());
const msg={id:db.seq++,room,from:m.user,to,text,at:now()};db.messages.push(msg);
if(db.messages.length>2400)db.messages=db.messages.slice(-2400);
save();return json(res,200,{ok:true,message:msg});
}
if(p==='/api/delete'){
const i=db.messages.findIndex(x=>x.id===Number(v.id));if(i<0)return bad(res,404,'الرسالة غير موجودة');
const msg=db.messages[i];if(msg.from!==m.user||now()-msg.at>600000)return bad(res,403,'لا يمكنك حذف هذه الرسالة');
db.messages.splice(i,1);save();return json(res,200,{ok:true});
}
return bad(res,404,'غير موجود');
}
http.createServer((req,res)=>{route(req,res).catch(e=>{console.error(e);if(!res.headersSent)bad(res,500,'خطأ في السيرفر');else res.end()})}).listen(PORT,'0.0.0.0',()=>console.log('Dardashat listening on',PORT));
