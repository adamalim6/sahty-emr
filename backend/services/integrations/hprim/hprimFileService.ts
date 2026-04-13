/**
 * HPRIM File Service
 * 
 * Safe file I/O for HPRIM message exchange:
 * - Atomic write of .hpr files
 * - .ok companion file creation
 * - Ready-file detection (.hpr with matching .ok)
 * - Archive and error folder movement
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Write a .hpr file atomically (write to .tmp then rename)
 */
export function writeHprFile(dir: string, filename: string, content: string): string {
    const finalPath = path.join(dir, filename);
    const tmpPath = finalPath + '.tmp';

    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, finalPath);

    return finalPath;
}

/**
 * Write the .ok companion file
 */
export function writeOkFile(dir: string, hprFilename: string): string {
    const okFilename = hprFilename.replace(/\.hpr$/i, '.ok');
    const okPath = path.join(dir, okFilename);
    fs.writeFileSync(okPath, '', 'utf-8');
    return okFilename;
}

/**
 * Get the .ok filename for a given .hpr filename
 */
export function getOkFilename(hprFilename: string): string {
    return hprFilename.replace(/\.hpr$/i, '.ok');
}

/**
 * List .hpr files in a directory that have a matching .ok companion
 */
export function listReadyFiles(dir: string): { hprFile: string; okFile: string; hprPath: string; okPath: string }[] {
    if (!fs.existsSync(dir)) return [];

    const allFiles = fs.readdirSync(dir);
    const okFiles = new Set(allFiles.filter(f => f.endsWith('.ok')));
    const results: { hprFile: string; okFile: string; hprPath: string; okPath: string }[] = [];

    for (const file of allFiles) {
        if (!file.endsWith('.hpr')) continue;
        const expectedOk = getOkFilename(file);
        if (okFiles.has(expectedOk)) {
            results.push({
                hprFile: file,
                okFile: expectedOk,
                hprPath: path.join(dir, file),
                okPath: path.join(dir, expectedOk),
            });
        }
    }

    return results;
}

/**
 * Read the content of a .hpr file
 */
export function readHprFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Move a file pair (.hpr + .ok) to a target directory
 */
export function moveFiles(
    hprPath: string,
    okPath: string,
    targetDir: string
): void {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const hprName = path.basename(hprPath);
    const okName = path.basename(okPath);

    // Add timestamp to prevent name collisions in archive
    const ts = Date.now();
    const archiveHpr = path.join(targetDir, `${ts}_${hprName}`);
    const archiveOk = path.join(targetDir, `${ts}_${okName}`);

    fs.renameSync(hprPath, archiveHpr);
    if (fs.existsSync(okPath)) {
        fs.renameSync(okPath, archiveOk);
    }
}

/**
 * Archive processed files
 */
export function archiveFiles(hprPath: string, okPath: string, archiveDir: string): void {
    moveFiles(hprPath, okPath, archiveDir);
}

/**
 * Move failed files to error directory
 */
export function moveToError(hprPath: string, okPath: string, errorDir: string): void {
    moveFiles(hprPath, okPath, errorDir);
}
