import * as xlsx from 'xlsx';

function checkExcel() {
    const filePath = '/Users/adamalim/Desktop/EXPORT_ANALYSES20250712 (1).xls';
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Get all rows
    const data: any[] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Find header row (usually the one with "Code" or "Discipline")
    let headerRowIndex = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row && row.includes('Code') || row.includes('Discipline')) {
            headerRowIndex = i;
            break;
        }
    }
    
    console.log("Headers found at row:", headerRowIndex);
    console.log(data[headerRowIndex]);
    console.log("First data row:");
    console.log(data[headerRowIndex + 1]);
}

checkExcel();
