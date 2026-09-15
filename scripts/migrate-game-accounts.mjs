import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const path=resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite');
const db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=10000');
const exists=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='game_users'").get();
if(exists){console.log('Account migration already applied');db.close();process.exit(0);}
mkdirSync('data/backups',{recursive:true});
const backup=resolve('data/backups/before-game-accounts-'+Date.now()+'.sqlite');
db.exec("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
const sql=readFileSync('drizzle/0004_overrated_radioactive_man.sql','utf8');
db.exec('BEGIN IMMEDIATE');
try{db.exec(sql);db.exec('COMMIT');console.log('New account and battle tables applied; existing data preserved.');}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
