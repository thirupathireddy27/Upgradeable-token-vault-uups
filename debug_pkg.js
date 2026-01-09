const fs = require('fs');
console.log('--- PACKAGE.JSON START ---');
console.log(fs.readFileSync('package.json', 'utf8'));
console.log('--- PACKAGE.JSON END ---');
