"use strict";

const { passwordRules, safeFailure, EXPECTED_COLUMNS: EMPLOYEE_COLUMNS } = require("./provision-demo-employee");
const { validateRegistration } = require("./registration");

// Compte fixe, provisionne hors application. Aucun role ni email fourni par stdin.
const ACCOUNT = Object.freeze({ email:"admin.test@example.test",firstName:"Admin",lastName:"Fictif",role:"administrateur",phone:"0600000000" });
const EXPECTED_COLUMNS = { ...EMPLOYEE_COLUMNS.users,created_at:"timestamp with time zone",deactivated_at:"timestamp with time zone" };
const PERMISSIONS_SQL = `SELECT current_user='vg_owner'
  AND has_schema_privilege(current_user,'vg','USAGE')
  AND has_table_privilege(current_user,'vg.users','SELECT')
  AND has_table_privilege(current_user,'vg.users','INSERT')
  AND has_column_privilege(current_user,'vg.roles','code','SELECT') AS ok`;
const UNIQUENESS_SQL = `SELECT EXISTS (
  SELECT 1 FROM pg_index i WHERE i.indrelid='vg.users'::regclass
  AND i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NULL
  AND i.indnkeyatts=1 AND pg_get_expr(i.indexprs,i.indrelid)='lower(email)'
) AS ok`;

function parseMode(args) {
  if (args.length>1 || (args.length===1 && !["--check-only","--create"].includes(args[0]))) throw new Error("Mode invalide");
  return args[0]==="--create";
}

async function provisionDemoAdmin(input,{create=false,createClient,loadConfig,hashPassword}={}) {
  let stage="validation_mot_de_passe",client,begun=false,rules=[],reason;
  try {
    if (!input || typeof input!=="object" || Array.isArray(input) || Object.keys(input).some(key=>!["password","confirmation","migrationPassword"].includes(key))) {
      rules=["transport_json_ou_champs_invalides"];throw new Error();
    }
    rules=passwordRules(input.password,input.confirmation);
    const {errors}=validateRegistration({password:input.password,passwordConfirmation:input.confirmation});
    if (rules.length || errors.password || errors.passwordConfirmation) {
      if (!rules.length) rules=["validation_serveur_mot_de_passe"];
      throw new Error();
    }
    stage="hachage";
    const hasher=hashPassword || (password=>{
      const argon2=require("argon2");
      return argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
    });
    const passwordHash=await hasher(input.password);
    if (typeof passwordHash!=="string" || !passwordHash.startsWith("$argon2id$")) throw new Error();

    stage="configuration";
    const config=loadConfig ? loadConfig() : (()=>{
      const {loadEnvironment,readConfig}=require("./config");loadEnvironment();return readConfig().database;
    })();
    if (!config || config.database!=="vite_et_gourmand" || typeof input.migrationPassword!=="string" || !input.migrationPassword) throw new Error();
    const options={...config,user:"vg_migrator",password:input.migrationPassword,connectionTimeoutMillis:5000,statement_timeout:5000,
      options:`-c search_path=vg,pg_catalog -c default_transaction_read_only=${create?"off":"on"}`};
    stage="connexion";
    client=createClient ? createClient(options) : new(require("pg").Client)(options);
    client.on?.("error",()=>{}); // Ne pas laisser un evenement pg afficher une erreur brute.
    await client.connect();
    stage="role_postgresql";
    const access=(await client.query("SELECT current_user='vg_migrator' AND pg_has_role(current_user,'vg_owner','SET') AS ok")).rows[0];
    if (!access?.ok) throw new Error();
    await client.query(create?"BEGIN READ WRITE":"BEGIN READ ONLY");begun=true;
    await client.query("SET LOCAL ROLE vg_owner");
    if (!create) {
      stage="lecture_seule";
      const mode=(await client.query("SELECT current_setting('transaction_read_only') AS mode")).rows[0];
      if (mode?.mode!=="on") throw new Error();
    }
    stage="permissions";
    if (!(await client.query(PERMISSIONS_SQL)).rows[0]?.ok) throw new Error();
    stage="schema";
    const columns=(await client.query(`SELECT a.attname,format_type(a.atttypid,a.atttypmod) AS type,
      a.attnotnull,a.attidentity,pg_get_expr(d.adbin,d.adrelid) AS default_value
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid='vg.users'::regclass AND a.attnum>0 AND NOT a.attisdropped`)).rows;
    for (const [name,type] of Object.entries(EXPECTED_COLUMNS)) if (!columns.some(column=>column.attname===name && column.type===type)) throw new Error();
    if (!columns.some(column=>column.attname==="id" && column.attidentity==="a")) throw new Error();
    const inserted=["role_code","first_name","last_name","email","phone","password_hash","is_active","is_demo"];
    // Une nouvelle colonne obligatoire sans valeur par defaut doit bloquer le diagnostic.
    if (columns.some(column=>!inserted.includes(column.attname) && column.attnotnull && !column.attidentity && column.default_value===null)) throw new Error();
    if (!(await client.query(UNIQUENESS_SQL)).rows[0]?.ok) {reason="index_email_unique_manquant";throw new Error();}
    stage="role_applicatif";
    if (!(await client.query("SELECT code FROM vg.roles WHERE code=$1",[ACCOUNT.role])).rows.some(row=>row.code===ACCOUNT.role)) {
      reason="role_administrateur_absent";throw new Error();
    }
    stage="disponibilite_compte";
    if ((await client.query("SELECT 1 FROM vg.users WHERE lower(email)=$1",[ACCOUNT.email])).rows.length) {
      reason="compte_deja_existant";throw new Error();
    }
    if (!create) {
      await client.query("ROLLBACK");begun=false;
      return {ok:true,diagnostic:{etape:"diagnostic",resultat:"verification_sans_ecriture_ok",role_applicatif:ACCOUNT.role}};
    }
    stage="insertion_compte";
    await client.query(`INSERT INTO vg.users
      (role_code,first_name,last_name,email,phone,password_hash,is_active,is_demo)
      VALUES ('administrateur',$1,$2,$3,$4,$5,true,true)`,
    [ACCOUNT.firstName,ACCOUNT.lastName,ACCOUNT.email,ACCOUNT.phone,passwordHash]);
    stage="commit";
    await client.query("COMMIT");begun=false;
    return {ok:true,diagnostic:{etape:stage,resultat:"compte_administrateur_fictif_cree"}};
  } catch (error) {
    if (client && begun) {try {await client.query("ROLLBACK");} catch { /* Aucune erreur brute ni secret. */ }}
    return {ok:false,diagnostic:{...safeFailure(stage,error,rules),...(reason?{motif:reason}:{})}};
  } finally {if (client) {try {await client.end();} catch { /* Diagnostic filtre uniquement. */ }}}
}

async function main() {
  let input,create;
  try {create=parseMode(process.argv.slice(2));}
  catch {console.error(JSON.stringify(safeFailure("configuration",null)));process.exitCode=1;return;}
  try {
    let body="";process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) {body+=chunk;if (body.length>16384) throw new Error();}
    input=JSON.parse(body);body="";
  } catch {console.error(JSON.stringify(safeFailure("validation_mot_de_passe",null,["transport_json"])));process.exitCode=1;return;}
  const result=await provisionDemoAdmin(input,{create});input=null;
  (result.ok?console.log:console.error)(JSON.stringify(result.diagnostic));
  if (!result.ok) process.exitCode=1;
}
if (require.main===module) main().catch(()=>{console.error(JSON.stringify(safeFailure("configuration",null)));process.exitCode=1;});
module.exports={provisionDemoAdmin,parseMode,ACCOUNT,EXPECTED_COLUMNS,PERMISSIONS_SQL,UNIQUENESS_SQL};
