
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'data/users.json');

const readJson = () => JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
const writeJson = (data) => fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));

const testAuthFlow = () => {
    console.log('--- Starting Auth Flow Debug (Backend/CJS) ---');
    
    // 1. Find User
    let users = readJson();
    const targetUsername = 'dude'; 
    const userIndex = users.findIndex(u => u.username === targetUsername);
    
    if (userIndex === -1) {
        console.log(`User "${targetUsername}" not found in users.json`);
        return;
    }
    
    console.log('1. User found:', users[userIndex].username);
    
    // 2. Update Password
    const newPassword = 'password123';
    const hash = bcrypt.hashSync(newPassword, 10);
    
    console.log('2. Generated Hash:', hash);
    users[userIndex].password_hash = hash;
    writeJson(users);
    console.log('3. Password updated in users.json');
    
    // 4. Verify Password
    users = readJson();
    const targetUser = users.find(u => u.username === targetUsername);
    
    const isMatch = bcrypt.compareSync(newPassword, targetUser.password_hash);
    
    console.log('4. Verification Result:', isMatch);
    
    if (isMatch) {
        console.log('SUCCESS: Flow is working correctly.');
    } else {
        console.error('FAILURE: Password mismatch.');
    }
};

testAuthFlow();
