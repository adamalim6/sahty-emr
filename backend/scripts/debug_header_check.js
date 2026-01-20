const fs = require('fs');
const path = '/Users/adamalim/Desktop/medicaments_data_vfinale_with_name_clean.csv';

try {
    const fd = fs.openSync(path, 'r');
    const buffer = Buffer.alloc(1024);
    fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);
    
    const content = buffer.toString('utf8');
    const firstLine = content.split(/\r?\n/)[0];
    console.log('Path:', path);
    console.log('First Line:', firstLine);
} catch (e) {
    console.error('Error reading file:', e.message);
}
