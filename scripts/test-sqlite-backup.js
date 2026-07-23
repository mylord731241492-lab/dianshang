const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { backupSqlite } = require('./backup-sqlite');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-sqlite-backup-'));
  const sourcePath = path.join(tempRoot, 'source.db');
  const destinationPath = path.join(tempRoot, 'backup', 'data.db');
  try {
    const source = new Database(sourcePath);
    source.exec('CREATE TABLE backup_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    const insert = source.prepare('INSERT INTO backup_probe (value) VALUES (?)');
    const transaction = source.transaction(() => {
      for (let index = 0; index < 25; index += 1) insert.run(`probe-${index}`);
    });
    transaction();
    source.close();

    const result = await backupSqlite(sourcePath, destinationPath);
    assert(result.quickCheck === 'ok', 'Backup quick_check should be ok');
    assert(result.integrityCheck === 'ok', 'Backup integrity_check should be ok');
    assert(result.bytes > 0, 'Backup should not be empty');

    const backup = new Database(destinationPath, { readonly: true, fileMustExist: true });
    try {
      const count = backup.prepare('SELECT COUNT(*) AS count FROM backup_probe').get().count;
      assert(count === 25, `Backup row count should be 25, actual ${count}`);
    } finally {
      backup.close();
    }

    console.log(JSON.stringify({
      quickCheck: result.quickCheck,
      integrityCheck: result.integrityCheck,
      rows: 25,
      bytes: result.bytes
    }, null, 2));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
