"use strict";

const EMAIL = "employe.test@example.test";
const EXPECTED_COLUMNS = {
  users: { id:"bigint",role_code:"text",first_name:"text",last_name:"text",email:"text",phone:"text",password_hash:"text",is_active:"boolean",is_demo:"boolean" },
  email_outbox: { user_id:"bigint",kind:"text",recipient:"text",status:"text" }
};

// Les noms de règles sont publics ; aucune valeur ni longueur saisie n'est renvoyée.
function passwordRules(password, confirmation) {
  const failed=[];
  if(typeof password!=="string")failed.push("type_chaine");
  else {
    if(password.length<10)failed.push("minimum_10_caracteres");
    if(password.length>128)failed.push("maximum_128_caracteres");
    if(!/\p{Lu}/u.test(password))failed.push("majuscule");
    if(!/\p{Ll}/u.test(password))failed.push("minuscule");
    if(!/\d/.test(password))failed.push("chiffre_ascii");
    if(!/[^\p{L}\p{N}\s]/u.test(password))failed.push("caractere_special");
    if(/[\p{Cc}\p{Cf}]/u.test(password))failed.push("absence_controle_et_format");
  }
  if(typeof confirmation!=="string"||confirmation!==password)failed.push("confirmation_identique");
  return failed;
}

function safeFailure(stage,error,rules=[]) {
  const code=typeof error?.severity==="string"&&typeof error.code==="string"&&/^[0-9A-Z]{5}$/.test(error.code)?error.code:null;
  return { etape:stage,code_postgresql:code,...(stage==="validation_mot_de_passe"?{regles_non_respectees:rules}:{}) };
}

async function provisionDemoEmployee(input,{create=false,createClient,loadConfig,hashPassword,validate}={}) {
  let stage="validation_mot_de_passe",client,begun=false,rules=[];
  try {
    if(!input||typeof input!=="object"||Array.isArray(input))throw new Error();
    const validator=validate||require("./registration.js").validateRegistration;
    const { errors }=validator({password:input.password,passwordConfirmation:input.confirmation});
    rules=passwordRules(input.password,input.confirmation);
    // Les erreurs nom/email/adresse ne concernent pas cette validation ciblée.
    if(errors.password||errors.passwordConfirmation||rules.length){
      if(!rules.length)rules=["validation_serveur_mot_de_passe"];
      throw new Error();
    }
    const hasher=hashPassword||((password)=>{
      const argon2=require("argon2");
      return argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
    });
    const hash=await hasher(input.password);
    if(typeof hash!=="string"||!hash.startsWith("$argon2id$"))throw new Error();

    stage="configuration";
    const config=loadConfig?loadConfig():(()=>{
      const {loadEnvironment,readConfig}=require("./config.js");loadEnvironment();return readConfig().database;
    })();
    if(!config||config.database!=="vite_et_gourmand"||typeof input.migrationPassword!=="string"||!input.migrationPassword)throw new Error();
    const options={...config,user:"vg_migrator",password:input.migrationPassword,connectionTimeoutMillis:5000,statement_timeout:5000,
      options:create?"-c search_path=vg,pg_catalog":"-c default_transaction_read_only=on -c search_path=vg,pg_catalog"};
    stage="connexion";
    client=createClient?createClient(options):new(require("pg").Client)(options);
    await client.connect();

    stage="role";
    const access=(await client.query("SELECT current_user='vg_migrator' AND pg_has_role(current_user,'vg_owner','SET') AS ok")).rows[0];
    if(!access?.ok)throw new Error();
    await client.query(create?"BEGIN":"BEGIN READ ONLY");begun=true;
    await client.query("SET LOCAL ROLE vg_owner");

    stage="schema";
    if((await client.query("SELECT 1 FROM vg.users WHERE lower(email)=$1",[EMAIL])).rows.length)throw new Error();
    if(!(await client.query("SELECT 1 FROM vg.roles WHERE code=$1",["employe"])).rows.length)throw new Error();
    const columns=(await client.query(`SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      WHERE n.nspname=$1 AND c.relname=ANY($2::text[])`,["vg",Object.keys(EXPECTED_COLUMNS)])).rows;
    for(const[table,fields]of Object.entries(EXPECTED_COLUMNS))for(const[name,type]of Object.entries(fields)){
      if(!columns.some(column=>column.relname===table&&column.attname===name&&column.type===type))throw new Error();
    }
    if(!create){
      await client.query("ROLLBACK");begun=false;
      return {ok:true,diagnostic:{etape:stage,resultat:"verification_sans_ecriture_ok"}};
    }

    stage="insertion_compte";
    const created=(await client.query(`INSERT INTO vg.users
      (role_code,first_name,last_name,email,phone,password_hash,is_active,is_demo)
      VALUES ('employe',$1,$2,$3,$4,$5,true,true) RETURNING id`,["Employe","Fictif",EMAIL,"0600000000",hash])).rows[0];
    stage="notification";
    await client.query(`INSERT INTO vg.email_outbox(user_id,kind,recipient,status)
      VALUES ($1,'nouvel_employe',$2,'en_attente')`,[created.id,EMAIL]);
    stage="commit";
    await client.query("COMMIT");begun=false;
    return {ok:true,diagnostic:{etape:stage,resultat:"compte_employe_fictif_cree_notification_en_attente"}};
  } catch(error) {
    if(client&&begun){try{await client.query("ROLLBACK");}catch{}}
    return {ok:false,diagnostic:safeFailure(stage,error,rules)};
  } finally {
    if(client){try{await client.end();}catch{}}
  }
}

async function main() {
  let input;
  try {
    let text="";process.stdin.setEncoding("utf8");
    for await(const chunk of process.stdin)text+=chunk;
    input=JSON.parse(text);text="";
  } catch(error) {console.error(JSON.stringify(safeFailure("validation_mot_de_passe",error,["transport_json"])));process.exitCode=1;return;}
  const args=process.argv.slice(2);
  if(args.length>1||(args.length&&!['--check-only','--create'].includes(args[0]))){
    console.error(JSON.stringify(safeFailure("configuration",null)));process.exitCode=1;return;
  }
  const result=await provisionDemoEmployee(input,{create:args[0]==="--create"});
  input=null;
  (result.ok?console.log:console.error)(JSON.stringify(result.diagnostic));
  if(!result.ok)process.exitCode=1;
}
if(require.main===module)main().catch(()=>{console.error(JSON.stringify(safeFailure("configuration",null)));process.exitCode=1;});
module.exports={passwordRules,safeFailure,provisionDemoEmployee,EXPECTED_COLUMNS};
