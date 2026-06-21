const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Tarun Siddappagoudar\\smart-exam-platform\\backend\\src\\routes\\portalRoutes.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('AuditLog') || line.includes('Announcement')) {
        console.log(`${index + 1}: ${line}`);
    }
});
