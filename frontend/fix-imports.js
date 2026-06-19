const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const parts = fullPath.split(path.sep);
      // fullPath is relative to the root of the project e.g. "app\chat\page.jsx"
      // Number of directories is parts.length - 1
      const depth = parts.length - 1; 
      
      let relativePrefix = '';
      for (let i = 0; i < depth; i++) {
        relativePrefix += '../';
      }
      
      let newContent = content;
      // We previously replaced "@/..." with "../..." everywhere.
      // We also might have "./components" if depth was 1.
      // Let's replace ANY relative path that points to components, lib, hooks, app with the CORRECT relative path.
      
      // Specifically looking for "from [any number of . and /]components/..."
      newContent = newContent.replace(/from\s+[\"'](\.\/|\.\.\/)+((components|lib|hooks|app)\/.*?)[\"']/g, (match, prefix, rest) => {
         return 'from \"' + relativePrefix + rest + '\"';
      });
      newContent = newContent.replace(/import\s+[\"'](\.\/|\.\.\/)+((components|lib|hooks|app)\/.*?)[\"']/g, (match, prefix, rest) => {
         return 'import \"' + relativePrefix + rest + '\"';
      });
      
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
      }
    }
  }
}
processDir('.');
