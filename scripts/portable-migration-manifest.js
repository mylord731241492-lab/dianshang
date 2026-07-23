const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const FORMAT_VERSION = 2;
const PACKAGE_TYPE = 'dianshang-windows-docker-migration';
const PLATFORM = 'windows-docker';

const ARTIFACT_DEFINITIONS = [
  { name: 'database', kind: 'sqlite', relativePath: 'database/data.db' },
  { name: 'data', kind: 'zip', relativePath: 'archives/data.zip' },
  { name: 'uploads', kind: 'zip', relativePath: 'archives/uploads.zip' },
  { name: 'logs', kind: 'zip', relativePath: 'archives/logs.zip' },
];

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const file = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(file, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(file);
  }
  return hash.digest('hex');
}

function ensurePathInside(rootPath, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error(`Artifact path must be relative: ${relativePath}`);
  }

  const root = path.resolve(rootPath);
  const candidate = path.resolve(root, relativePath);
  const relation = path.relative(root, candidate);
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) {
    if (!relation) {
      throw new Error(`Artifact path must identify a file below the package root: ${relativePath}`);
    }
    throw new Error(`Artifact path escapes the package root: ${relativePath}`);
  }
  return candidate;
}

function verifySqlite(databasePath) {
  const resolvedPath = path.resolve(databasePath);
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    throw new Error(`SQLite database does not exist: ${resolvedPath}`);
  }

  const database = new Database(resolvedPath, { readonly: true, fileMustExist: true });
  try {
    const quickCheck = database.pragma('quick_check').map((row) => Object.values(row)[0]);
    const integrityCheck = database.pragma('integrity_check').map((row) => Object.values(row)[0]);
    if (quickCheck.length !== 1 || quickCheck[0] !== 'ok') {
      throw new Error(`SQLite quick_check failed: ${quickCheck.join(', ')}`);
    }
    if (integrityCheck.length !== 1 || integrityCheck[0] !== 'ok') {
      throw new Error(`SQLite integrity_check failed: ${integrityCheck.join(', ')}`);
    }
    return { quickCheck, integrityCheck };
  } finally {
    database.close();
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createManifest(packageDirectory, metadataPath, environmentPath) {
  const packageRoot = path.resolve(packageDirectory);
  const metadata = readJson(path.resolve(metadataPath));
  const envPath = path.resolve(environmentPath);
  if (!fs.existsSync(envPath) || !fs.statSync(envPath).isFile()) {
    throw new Error(`Environment file is required for a portable package fingerprint: ${envPath}`);
  }

  const artifacts = ARTIFACT_DEFINITIONS.map((definition) => {
    const artifactPath = ensurePathInside(packageRoot, definition.relativePath);
    if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
      throw new Error(`Required migration artifact is missing: ${definition.relativePath}`);
    }
    const stat = fs.statSync(artifactPath);
    return {
      ...definition,
      required: true,
      bytes: stat.size,
      sha256: sha256File(artifactPath),
    };
  });

  const databaseArtifact = artifacts.find((artifact) => artifact.name === 'database');
  const databaseVerification = verifySqlite(
    ensurePathInside(packageRoot, databaseArtifact.relativePath),
  );

  const manifest = {
    formatVersion: FORMAT_VERSION,
    packageType: PACKAGE_TYPE,
    platform: PLATFORM,
    createdAt: metadata.createdAt || new Date().toISOString(),
    source: {
      container: metadata.container || 'dianshang-internal-app',
      layout: metadata.sourceLayout || {
        database: 'docker/data/data.db',
        uploads: 'docker/uploads',
        workflows: 'docker/data/workflows',
        logs: 'docker/logs',
      },
    },
    databaseVerification,
    maintenanceWindow: metadata.maintenanceWindow || null,
    environmentFile: {
      included: false,
      requiredForRestore: true,
      sourceRelativePath: 'docker/.env',
      bytes: fs.statSync(envPath).size,
      sha256: sha256File(envPath),
    },
    restorePolicy: {
      requiresEmptyTarget: true,
      overwriteSupported: false,
    },
    artifacts,
    note:
      metadata.note ||
      'Copy the source tree and the exact docker/.env separately. Restore this data package only into empty persistent directories.',
  };

  const manifestPath = path.join(packageRoot, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function verifyManifest(packageDirectory) {
  const packageRoot = path.resolve(packageDirectory);
  const manifestPath = path.join(packageRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Migration manifest does not exist: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath);
  if (manifest.formatVersion !== FORMAT_VERSION) {
    throw new Error(`Unsupported migration formatVersion: ${manifest.formatVersion}`);
  }
  if (manifest.packageType !== PACKAGE_TYPE || manifest.platform !== PLATFORM) {
    throw new Error('The package is not a Windows Docker migration package for this application.');
  }
  if (!manifest.restorePolicy?.requiresEmptyTarget || manifest.restorePolicy?.overwriteSupported) {
    throw new Error('The manifest restore policy must require an empty target and forbid overwrite.');
  }
  if (!Array.isArray(manifest.artifacts)) {
    throw new Error('The manifest artifacts list is missing.');
  }

  const verifiedArtifacts = ARTIFACT_DEFINITIONS.map((definition) => {
    const artifact = manifest.artifacts.find((item) => item.name === definition.name);
    if (!artifact || artifact.kind !== definition.kind || artifact.relativePath !== definition.relativePath) {
      throw new Error(`Required artifact definition is invalid: ${definition.name}`);
    }
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256 || '')) {
      throw new Error(`Artifact SHA-256 is invalid: ${definition.name}`);
    }

    const artifactPath = ensurePathInside(packageRoot, artifact.relativePath);
    if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
      throw new Error(`Required migration artifact is missing: ${artifact.relativePath}`);
    }
    const stat = fs.statSync(artifactPath);
    if (stat.size !== artifact.bytes) {
      throw new Error(`Artifact size mismatch: ${artifact.relativePath}`);
    }
    const actualSha256 = sha256File(artifactPath);
    if (actualSha256 !== artifact.sha256) {
      throw new Error(`Artifact SHA-256 mismatch: ${artifact.relativePath}`);
    }
    return { ...artifact, verified: true };
  });

  if (
    manifest.environmentFile?.included !== false ||
    manifest.environmentFile?.requiredForRestore !== true ||
    !/^[a-f0-9]{64}$/.test(manifest.environmentFile?.sha256 || '')
  ) {
    throw new Error('The environment file fingerprint is missing or invalid.');
  }

  const databaseArtifact = verifiedArtifacts.find((artifact) => artifact.name === 'database');
  const databaseVerification = verifySqlite(
    ensurePathInside(packageRoot, databaseArtifact.relativePath),
  );

  return {
    ...manifest,
    artifacts: verifiedArtifacts,
    databaseVerification,
    verifiedAt: new Date().toISOString(),
  };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'create' && args.length === 3) {
    printJson(createManifest(args[0], args[1], args[2]));
    return;
  }
  if (command === 'verify' && args.length === 1) {
    printJson(verifyManifest(args[0]));
    return;
  }
  if (command === 'verify-sqlite' && args.length === 1) {
    printJson(verifySqlite(args[0]));
    return;
  }
  throw new Error(
    'Usage: node portable-migration-manifest.js create <packageDir> <metadataJson> <dockerEnv> | verify <packageDir> | verify-sqlite <database>',
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  createManifest,
  ensurePathInside,
  sha256File,
  verifyManifest,
  verifySqlite,
};
