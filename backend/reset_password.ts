import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

// Adjust path relative to where this script is run (backend dir)
const usersFile = path.join(__dirname, 'data/users.json');

try {
    if (!fs.existsSync(usersFile)) {
        console.error("Users file not found at:", usersFile);
        process.exit(1);
    }
    const rawData = fs.readFileSync(usersFile, 'utf-8');
    const users = JSON.parse(rawData);

    const targetUser = 'pharma1';
    const newPassword = 'password';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);

    let found = false;
    const updatedUsers = users.map((u: any) => {
        if (u.username === targetUser) {
            console.log(`Resetting password for ${u.username}`);
            found = true;
            return { ...u, password_hash: hash };
        }
        return u;
    });

    if (found) {
        fs.writeFileSync(usersFile, JSON.stringify(updatedUsers, null, 2));
        console.log(`Password for user '${targetUser}' has been reset to '${newPassword}'`);
    } else {
        console.error(`User '${targetUser}' not found.`);
    }

} catch (error) {
    console.error('Error:', error);
}
