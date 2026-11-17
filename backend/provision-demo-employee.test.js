"use strict";
const{test}=require("node:test");
const assert=require("node:assert/strict");
const{passwordRules,safeFailure,provisionDemoEmployee,EXPECTED_COLUMNS}=require("./provision-demo-employee");
const{validateRegistration}=require("./registration");
const valid="ValidationFictive42!";
const input={password:valid,confirmation:valid,migrationPassword:"secret-fictif"};
function setup({failure,missingColumn=false,exists=false,roleExists=true,allowed=true}={}){
  const calls=[];
  const error=Object.assign(new Error("SECRET_MESSAGE password SQL details"),{code:"42501",severity:"ERROR",detail:valid});
  const client={async connect(){if(failure==="connexion")throw error;},async end(){},async query(sql,values=[]){
    calls.push([sql,values]);
    if(sql.startsWith("SELECT current_user"))return{rows:[{ok:allowed}]};
    if(sql==="SET LOCAL ROLE vg_owner"&&failure==="role")throw error;
    if(sql.startsWith("SELECT 1 FROM vg.users"))return{rows:exists?[{ok:1}]:[]};
    if(sql.startsWith("SELECT 1 FROM vg.roles"))return{rows:roleExists?[{ok:1}]:[]};
    if(sql.startsWith("SELECT c.relname"))return{rows:Object.entries(EXPECTED_COLUMNS).flatMap(([table,fields])=>Object.entries(fields).map(([name,type])=>({relname:table,attname:name,type}))).filter(row=>!missingColumn||row.attname!=="is_demo")};
    if(sql.startsWith("INSERT INTO vg.users")){if(failure==="insertion_compte")throw error;return{rows:[{id:"123"}]};}
    if(sql.startsWith("INSERT INTO vg.email_outbox")&&failure==="notification")throw error;
    if(sql==="COMMIT"&&failure==="commit")throw error;
    return{rows:[]};
  }};
  const options={createClient:()=>client,loadConfig:()=>({database:"vite_et_gourmand",user:"vg_app"}),hashPassword:async()=>"$argon2id$HASH_FICTIF",validate:validateRegistration};
  return{calls,options};
}
test("validation ciblée : les champs d'inscription absents ne font pas échouer un mot de passe valide",async()=>{
  const errors=validateRegistration({password:valid,passwordConfirmation:valid}).errors;
  assert.ok(errors.firstName&&errors.email);assert.ok(!errors.password&&!errors.passwordConfirmation);
  const{options,calls}=setup();const result=await provisionDemoEmployee(input,options);
  assert.equal(result.ok,true);assert.equal(result.diagnostic.resultat,"verification_sans_ecriture_ok");
  assert.ok(calls.some(([sql])=>sql==="BEGIN READ ONLY"));assert.equal(calls.at(-1)[0],"ROLLBACK");
  assert.ok(!calls.some(([sql])=>/^(INSERT|UPDATE|DELETE|CREATE|GRANT|COMMIT)\b/.test(sql)));
});
test("règles détaillées concordantes avec validateRegistration sans afficher valeurs ni longueur exacte",async()=>{
  const cases=["Court1!","sansmajuscule42!","SANS MINUSCULE42!","SansChiffre!","SansSpecial42","A".repeat(129)+"a1!","Abcdefghi1!\n",null,42,valid];
  for(const password of cases){
    const confirmation=password;const errors=validateRegistration({password,passwordConfirmation:confirmation}).errors;
    assert.equal(passwordRules(password,confirmation).length>0,!!(errors.password||errors.passwordConfirmation));
  }
  const result=await provisionDemoEmployee({password:"abc",confirmation:"def"},setup().options);
  assert.equal(result.ok,false);assert.equal(result.diagnostic.etape,"validation_mot_de_passe");
  assert.deepEqual(result.diagnostic.regles_non_respectees,["minimum_10_caracteres","majuscule","chiffre_ascii","caractere_special","confirmation_identique"]);
  assert.ok(!("length"in result.diagnostic));assert.ok(!JSON.stringify(result.diagnostic).includes('"abc"'));
});
test("étapes et codes filtrés : connexion, rôle, schéma, insertion, notification, commit",async()=>{
  for(const failure of ["connexion","role","insertion_compte","notification","commit"]){
    const{options,calls}=setup({failure});const result=await provisionDemoEmployee(input,{...options,create:true});
    assert.equal(result.ok,false);assert.deepEqual(result.diagnostic,{etape:failure,code_postgresql:"42501"});
    assert.ok(!JSON.stringify(result.diagnostic).includes("SECRET"));assert.ok(!JSON.stringify(result.diagnostic).includes(valid));
    if(["role","insertion_compte","notification","commit"].includes(failure))assert.equal(calls.at(-1)[0],"ROLLBACK");
  }
  for(const scenario of [{missingColumn:true},{exists:true},{roleExists:false}]){
    const{options,calls}=setup(scenario);const result=await provisionDemoEmployee(input,{...options,create:true});
    assert.equal(result.diagnostic.etape,"schema");assert.ok(!calls.some(([sql])=>sql.startsWith("INSERT")));
  }
  const result=await provisionDemoEmployee(input,{...setup().options,loadConfig:()=>{throw new Error(valid);}});
  assert.deepEqual(result.diagnostic,{etape:"configuration",code_postgresql:null});
  assert.deepEqual(safeFailure("connexion",{code:"EPIPE",message:valid}),{etape:"connexion",code_postgresql:null});
});
test("mode création simulé : un employé littéral et une notification, paramètres séparés, aucune permission ni compte administrateur",async()=>{
  const{options,calls}=setup();const result=await provisionDemoEmployee(input,{...options,create:true});assert.equal(result.ok,true);
  const inserts=calls.filter(([sql])=>sql.startsWith("INSERT"));assert.equal(inserts.length,2);
  assert.ok(inserts[0][0].includes("VALUES ('employe',$1,$2,$3,$4,$5,true,true)"));
  assert.deepEqual(inserts[0][1],["Employe","Fictif","employe.test@example.test","0600000000","$argon2id$HASH_FICTIF"]);
  assert.ok(!JSON.stringify(calls).includes(valid));assert.ok(!calls.some(([sql])=>/^(CREATE|GRANT|UPDATE|DELETE)\b/.test(sql)));
  assert.equal(calls.at(-1)[0],"COMMIT");assert.ok(!JSON.stringify(result).includes("HASH_FICTIF"));
});
