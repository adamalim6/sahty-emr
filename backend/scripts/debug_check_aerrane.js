const fs = require('fs');
const path = '/Users/adamalim/Desktop/medicaments_data_vfinale_with_name_clean.csv';

try {
    const content = fs.readFileSync(path, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach(line => {
        if (line.includes('AERRANE')) {
            console.log('RAW ROW:', line);
        }
    });
} catch (e) {
    console.error('Error:', e.message);
}
