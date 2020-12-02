import fs from 'fs';
import path from 'path';

const tempDir = path.join(__dirname, './temp');
fs.mkdirSync(tempDir, { recursive: true });

export default {
    readFile(filename: string): string {
        try {
            return fs.readFileSync(path.join(tempDir, filename), { encoding: 'utf-8' })
        } catch (e) {
            return '';
        }
    },

    writeFile(filename: string, content: string): boolean {
        try {
            fs.writeFileSync(path.join(tempDir, filename), content, { encoding: 'utf-8' });
            return true;
        } catch (e) {
            return false;
        }
    },

    readJSON(filename: string): object {
        try {
            return JSON.parse(
                fs.readFileSync(path.join(tempDir, filename), { encoding: 'utf-8' }),
            );
        } catch (e) {
            return {};
        }
    },

    writeJSON(filename: string, data: object): boolean {
        try {
            fs.writeFileSync(path.join(tempDir, filename), JSON.stringify(data), { encoding: 'utf-8' });
            return true;
        } catch (e) {
            return false;
        }
    },

    exists(filename: string): boolean {
        try {
            fs.accessSync(path.join(tempDir, filename));
            return true;
        } catch (e) {
            return false;
        }
    },

    delete(filename: string) {
        try {
            fs.unlinkSync(path.join(tempDir, filename));
            return true;
        } catch (e) {
            return false;
        }
    },

    getAbsPath(filename: string) {
        return path.join(tempDir, filename);
    },
}