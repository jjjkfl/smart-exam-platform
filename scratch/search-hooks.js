const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchDir(fullPath, query);
        } else if (file.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes(query)) {
                console.log(`Found "${query}" in: ${fullPath}`);
            }
        }
    }
}

const backendDir = 'c:\\Users\\Tarun Siddappagoudar\\smart-exam-platform\\backend';
console.log('Searching for "pre("...');
searchDir(backendDir, 'pre(');
console.log('Searching for "post("...');
searchDir(backendDir, 'post(');
console.log('Searching for "AuditLog"...');
searchDir(backendDir, 'AuditLog');
