
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'data/users.json');

const resetUser = () => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const userIndex = users.findIndex(u => u.id === 'user_tenant_admin');
    
    if (userIndex !== -1) {
        users[userIndex].username = 'manager';
        users[userIndex].password_hash = bcrypt.hashSync('manager123', 10);
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log('Reset complete: manager / manager123');
    } else {
        console.log('User not found');
    }
};

resetUser();
