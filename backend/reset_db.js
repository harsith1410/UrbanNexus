const { exec } = require('child_process');
require('dotenv').config();
const path = require('path');

const scriptPath1 = path.join(__dirname, '..', 'resources', 'DB_init.sql');
const scriptPath2 = path.join(__dirname, '..', 'resources', 'Test_Script.sql');

//Running thru command line for executing the script
const command = `mysql -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} < "${scriptPath1}"`;
const command = `mysql -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} < "${scriptPath2}"`;
console.log('Reset/Init database');

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error('Error executing script:', error.message);
        return;
    }
    if (stderr) {
        console.log('Warning:', stderr);
    }
    console.log('Good as new!!');
});