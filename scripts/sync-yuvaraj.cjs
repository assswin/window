const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString();
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

  // Read remote blob
  const remoteBlob = execSync(`git show yuvaraj/main:${remotePath}`, { maxBuffer: 50 * 1024 * 1024 });

  const localFullPath = path.resolve(__dirname, '..', localRelative);
  let isDifferent = true;

  if (fs.existsSync(localFullPath)) {
    const localContent = fs.readFileSync(localFullPath);
    if (Buffer.compare(localContent, remoteBlob) === 0) {
      isDifferent = false;
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
