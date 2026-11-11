const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString();
}

function normalizeNewlines(str) {
  return str.replace(/\r\n/g, '\n');
}

console.log('🔄 Fetching latest updates from yuvaraj repo...');
try {
  run('git fetch yuvaraj');
  console.log('✓ Successfully fetched from yuvaraj remote.');
} catch (err) {
  console.error('❌ Failed to fetch from yuvaraj remote:', err.message);
  process.exit(1);
}

const treeRaw = run('git ls-tree -r --name-only yuvaraj/main')
  .trim()
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean);

if (treeRaw.length === 0) {
  console.log('⚠️ No files found in yuvaraj/main.');
  process.exit(0);
}

// Detect if files are prefixed with window-main/ or already at root
const hasSubfolder = treeRaw.some(p => p.startsWith('window-main/'));
const prefix = hasSubfolder ? 'window-main/' : '';

console.log(`📁 Source layout in yuvaraj/main: ${hasSubfolder ? 'window-main/ subfolder' : 'root'}`);

const updatedFiles = [];

for (const remotePath of treeRaw) {
  if (hasSubfolder && !remotePath.startsWith('window-main/')) continue;
  const localRelative = hasSubfolder ? remotePath.slice(prefix.length) : remotePath;

  // Don't overwrite package.json script entry if we only added sync:yuvaraj
  if (localRelative === 'package.json') {
    const localFullPath = path.resolve(__dirname, '..', localRelative);
    const remoteStr = execSync(`git show yuvaraj/main:${remotePath}`).toString('utf-8');
    const localStr = fs.readFileSync(localFullPath, 'utf-8');
    try {
      const remotePkg = JSON.parse(remoteStr);
      const localPkg = JSON.parse(localStr);
      // Compare dependencies and devDependencies
      const depsChanged = JSON.stringify(remotePkg.dependencies) !== JSON.stringify(localPkg.dependencies) ||
                          JSON.stringify(remotePkg.devDependencies) !== JSON.stringify(localPkg.devDependencies);
      if (depsChanged) {
        localPkg.dependencies = remotePkg.dependencies;
        localPkg.devDependencies = remotePkg.devDependencies;
        fs.writeFileSync(localFullPath, JSON.stringify(localPkg, null, 2) + '\n');
        updatedFiles.push('package.json (dependencies updated)');
      }
    } catch (_) {}
    continue;
  }

  // Read remote blob
  const remoteBlob = execSync(`git show yuvaraj/main:${remotePath}`, { maxBuffer: 50 * 1024 * 1024 });

  const localFullPath = path.resolve(__dirname, '..', localRelative);
  let isDifferent = true;

  if (fs.existsSync(localFullPath)) {
    const localContent = fs.readFileSync(localFullPath);
    // Compare byte-for-byte or text-normalized
    if (Buffer.compare(localContent, remoteBlob) === 0) {
      isDifferent = false;
    } else {
      // Check if only line endings differ (CRLF vs LF)
      try {
        const localNorm = normalizeNewlines(localContent.toString('utf-8'));
        const remoteNorm = normalizeNewlines(remoteBlob.toString('utf-8'));
        if (localNorm === remoteNorm) {
          isDifferent = false;
        }
      } catch (_) {}
    }
  }

  if (isDifferent) {
    fs.mkdirSync(path.dirname(localFullPath), { recursive: true });
    fs.writeFileSync(localFullPath, remoteBlob);
    updatedFiles.push(localRelative);
  }
}

if (updatedFiles.length === 0) {
  console.log('✨ Your repository is 100% up to date with yuvaraj/main! (No changes detected)');
} else {
  console.log(`\n✅ Synced ${updatedFiles.length} updated file(s) into your repo root (without duplicates):`);
  updatedFiles.forEach(f => console.log(`   - ${f}`));
}
