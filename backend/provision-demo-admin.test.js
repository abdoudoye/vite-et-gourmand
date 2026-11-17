"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const argon2=require("argon2");
const fs=require("node:fs"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const {provisionDemoAdmin,parseMode,ACCOUNT,EXPECTED_COLUMNS,PERMISSIONS_SQL,UNIQUENESS_SQL}=require("./provision-demo-admin");
const input={password:"ValidationFictive42!",confirmation:"ValidationFictive42!",migrationPassword:"migration-fictive-test"};

function setup({exists=false,role=true,permissions=true,access=true,readOnly=true,unique=true,missingColumn=false,failure}={}) {
  const calls=[];let configuration,closed=false;
  const error=Object.assign(new Error("SECRET SQL password="+input.password),{severity:"ERROR",code:"42501",detail:input.migrationPassword});
  const client={async connect(){if(failure==="connexion")throw error;},async end(){closed=true;},async query(sql,values=[]){
    calls.push([sql,values]);
    if(sql.includes("current_user='vg_migrator'"))return{rows:[{ok:access}]};
    if(sql==="SET LOCAL ROLE vg_owner" && failure==="role_postgresql")throw error;
    if(sql.includes("current_setting('transaction_read_only')"))return{rows:[{mode:readOnly?"on":"off"}]};
    if(sql===PERMISSIONS_SQL)return{rows:[{ok:permissions}]};
    if(sql===UNIQUENESS_SQL)return{rows:[{ok:unique}]};
    if(sql.startsWith("SELECT a.attname"))return{rows:Object.entries(EXPECTED_COLUMNS).map(([attname,type])=>({attname,type,attnotnull:attname!=="deactivated_at",attidentity:attname==="id"?"a":"",default_value:attname==="created_at"?"now()":null})).filter(row=>!missingColumn||row.attname!=="is_demo")};
    if(sql.startsWith("SELECT code FROM"))return{rows:role?[{code:ACCOUNT.role}]:[]};
    if(sql.startsWith("SELECT 1 FROM"))return{rows:exists?[{ok:1}]:[]};
    if(sql.startsWith("INSERT") && failure==="insertion_compte")throw error;
    if(sql==="COMMIT" && failure==="commit")throw error;
    return{rows:[]};
  }};
  return {calls,get configuration(){return configuration;},get closed(){return closed;},options:{
    loadConfig:()=>({database:"vite_et_gourmand",user:"vg_app",password:"jamais-utilise"}),
    createClient:config=>{configuration=config;return client;},hashPassword:async()=>"$argon2id$HASH_FICTIF"
  }};
}
test("diagnostic par défaut : double lecture seule, aucun DML/DDL, aucune création de compte et fermeture",async()=>{
  const fixture=setup();const result=await provisionDemoAdmin(input,fixture.options);
  assert.equal(result.ok,true);assert.equal(result.diagnostic.resultat,"verification_sans_ecriture_ok");
  assert.equal(fixture.configuration.user,"vg_migrator");assert.match(fixture.configuration.options,/default_transaction_read_only=on/);
  assert.ok(fixture.calls.some(([sql])=>sql==="BEGIN READ ONLY"));assert.equal(fixture.calls.at(-1)[0],"ROLLBACK");assert.ok(fixture.closed);
  assert.ok(!fixture.calls.some(([sql])=>/^(INSERT|UPDATE|DELETE|CREATE|ALTER|GRANT|REVOKE|COMMIT)\b/.test(sql)));
});
test("création préparée : une insertion littérale fixe, aucun autre utilisateur, permission, rôle ou email touché (client simulé)",async()=>{
  const fixture=setup();const result=await provisionDemoAdmin(input,{...fixture.options,create:true});assert.equal(result.ok,true);
  const inserts=fixture.calls.filter(([sql])=>sql.startsWith("INSERT"));assert.equal(inserts.length,1);
  assert.match(inserts[0][0],/VALUES \('administrateur',\$1,\$2,\$3,\$4,\$5,true,true\)/);
  assert.deepEqual(inserts[0][1],["Admin","Fictif","admin.test@example.test","0600000000","$argon2id$HASH_FICTIF"]);
  assert.ok(fixture.calls.some(([sql])=>sql==="BEGIN READ WRITE"));assert.equal(fixture.calls.at(-1)[0],"COMMIT");
  assert.ok(!fixture.calls.some(([sql])=>/^(UPDATE|DELETE|CREATE|ALTER|GRANT|REVOKE)\b/.test(sql)));
  assert.ok(!JSON.stringify(fixture.calls).includes(input.password));assert.ok(!JSON.stringify(result).includes("HASH_FICTIF"));
});
test("compte existant, rôle absent, schéma incompatible et droits insuffisants bloquent toute insertion",async()=>{
  for(const scenario of [{exists:true},{role:false},{permissions:false},{access:false},{unique:false},{missingColumn:true},{readOnly:false}]) {
    const fixture=setup(scenario);const result=await provisionDemoAdmin(input,fixture.options);
    assert.equal(result.ok,false);assert.ok(!fixture.calls.some(([sql])=>sql.startsWith("INSERT")));assert.ok(fixture.closed);
    if(scenario.exists)assert.equal(result.diagnostic.motif,"compte_deja_existant");
    if(scenario.role===false)assert.equal(result.diagnostic.motif,"role_administrateur_absent");
  }
});
test("validation réutilisée, identités non remplaçables et Argon2id imposé",async()=>{
  for(const change of [{password:"faible"},{confirmation:"Different42!"},{role:"administrateur"},{email:"autre@example.test"}]) {
    const fixture=setup();assert.equal((await provisionDemoAdmin({...input,...change},fixture.options)).ok,false);assert.equal(fixture.calls.length,0);
  }
  const fixture=setup();assert.equal((await provisionDemoAdmin(input,{...fixture.options,hashPassword:async()=>"$2b$hash-interdit"})).diagnostic.etape,"hachage");assert.equal(fixture.calls.length,0);
});
test("moteur réel Argon2id, paramètres mémoire/temps et vérification sans base PostgreSQL",async()=>{
  const fixture=setup();const {hashPassword,...options}=fixture.options;
  // Seul le hachage est réel. Le client SQL ci-dessus ne possède aucune connexion.
  const result=await provisionDemoAdmin(input,{...options,create:true});assert.ok(result.ok);
  const hash=fixture.calls.find(([sql])=>sql.startsWith("INSERT"))[1][4];
  assert.match(hash,/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);assert.ok(await argon2.verify(hash,input.password));assert.ok(!JSON.stringify(result).includes(hash));
});
test("diagnostics filtrés : étapes, code SQLSTATE seulement, rollback et aucun secret",async()=>{
  for(const failure of ["connexion","role_postgresql","insertion_compte","commit"]) {
    const fixture=setup({failure});const result=await provisionDemoAdmin(input,{...fixture.options,create:true});
    assert.equal(result.diagnostic.etape,failure);assert.equal(result.diagnostic.code_postgresql,"42501");
    for(const secret of [input.password,input.migrationPassword,"SECRET","password="])assert.ok(!JSON.stringify(result).includes(secret));
    if(failure!=="connexion")assert.equal(fixture.calls.at(-1)[0],"ROLLBACK");
  }
  const fixture=setup();assert.equal((await provisionDemoAdmin(input,{...fixture.options,loadConfig:()=>({database:"mauvaise_base"})})).diagnostic.etape,"configuration");
});
test("modes explicites et erreurs CLI : aucun argument ambigu, pas de secret imprimé",()=>{
  assert.equal(parseMode([]),false);assert.equal(parseMode(["--check-only"]),false);assert.equal(parseMode(["--create"]),true);
  for(const args of [["--creat"],["--create","--check-only"]])assert.throws(()=>parseMode(args));
  const script=path.join(__dirname,"provision-demo-admin.js");
  for(const [args,body] of [[["--invalide"],""],[["--check-only"],"{invalide"],[["--check-only"],JSON.stringify({password:"faible",confirmation:"faible"})]]) {
    const result=spawnSync(process.execPath,[script,...args],{input:body,encoding:"utf8"});assert.equal(result.status,1);
    assert.doesNotThrow(()=>JSON.parse(result.stderr.trim()));assert.ok(!result.stderr.includes("faible"));assert.equal(result.stdout,"");
  }
});
test("lanceur PowerShell limité au diagnostic : saisies masquées, stdin UTF-8, nettoyage",()=>{
  const script=fs.readFileSync(path.join(__dirname,"check-demo-admin.ps1"),"utf8");
  assert.equal((script.match(/-AsSecureString/g)||[]).length,3);assert.match(script,/--check-only/);
  assert.ok(!/provision-demo-admin\.js'\)\s+--create/.test(script));assert.match(script,/ZeroFreeBSTR/);assert.match(script,/UTF8Encoding/);
});
