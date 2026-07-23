const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function backupSqlite(sourcePath, destinationPath) {
  if (!sourcePath || !destinationPath) {
    throw new Error('BACKUP_SOURCE_DB and BACKUP_DESTINATION_DB are required');
  }
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(destinationPath);
  } finally {
    source.close();
  }
  const backup = new Database(destinationPath, { readonly: true, fileMustExist: true });
  try {
    const quickCheck = backup.pragma('quick_check', { simple: true });
    const integrityCheck = backup.pragma('integrity_check', { simple: true });
    if (quickCheck !== 'ok' || integrityCheck !== 'ok') {
      throw new Error(`SQLite verification failed: quick_check=${quickCheck}, integrity_check=${integrityCheck}`);
    }
    return {
      quickCheck,
      integrityCheck,
      bytes: fs.statSync(destinationPath).size
    };
  } finally {
    backup.close();
  }
}

if (require.main === module) {
  backupSqlite(process.env.BACKUP_SOURCE_DB, process.env.BACKUP_DESTINATION_DB)
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(error && error.stack ? error.stack : error);
      process.exit(1);
    });
}

module.exports = { backupSqlite };
