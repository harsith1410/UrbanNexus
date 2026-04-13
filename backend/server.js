const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authenticateToken = require('./authMiddleware');
const cron = require('node-cron');
const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

const app = express();
const PORT = process.env.PORT || 4720;

app.use(cors());
app.use(express.json());

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {

        const [admins] = await db.query('SELECT * FROM admin WHERE username = ?', [username]);

        if (admins.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const admin = admins[0];

        const isMatch = await bcrypt.compare(password, admin.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
            {
                id: admin.admin_id,
                role: admin.role,
                resident_id: admin.resident_id,
                tech_id: admin.tech_id
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful!',
            token: token,
            admin: {
                username: admin.username,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Technical Issue will be back in some time' });
    }
});

// Get Residents
app.get('/api/residents', async (req, res) => {
    try {
        const [rows] = await db.query("select * from resident;");
        res.json({
            server: 'Running',
            database: 'Connected',
            // Fix: Add a check to handle empty tables safely
            db_test_result: rows.length > 0 ? rows[0].name : 'No residents found'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ server: 'Running', database: 'Disconnected', error: error.message });
    }
});

// Add Resident
app.post('/api/residents', authenticateToken, async (req, res) => {
    const { name, house_block, house_floor, house_unit, ownership_status, contact, no_of_members } = req.body;

    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied.' });
    }

    try {
        // 1. Insert into the resident table
        const [resResult] = await db.query(
            'INSERT INTO resident (name, house_block, house_floor, house_unit, ownership_status, contact, no_of_members) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, house_block, house_floor, house_unit, ownership_status, contact, no_of_members]
        );
        const newResidentId = resResult.insertId;

        // 2. Create a default login account
        const defaultPassword = 'pwd123#';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        const username = name.toLowerCase().replace(/\s+/g, '_') + newResidentId;

        await db.query(
            'INSERT INTO admin (username, password_hash, role, resident_id) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, 'Resident', newResidentId]
        );

        res.status(201).json({
            message: 'Resident and Login created!',
            username: username,
            password: defaultPassword
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create resident account' });
    }
});

// Add Technician
app.post('/api/technicians', authenticateToken, async (req, res) => {
    const { tech_id, name, contact, skill } = req.body;
    if (req.admin.role !== 'SuperAdmin') return res.status(403).json({ error: 'Admin only.' });

    // Validate that tech_id is a number
    if (isNaN(tech_id)) return res.status(400).json({ error: 'Tech ID must be a number.' });

    const connection = await db.getConnection(); // Get connection for transaction
    try {
        await connection.beginTransaction();

        await connection.query(
            'INSERT INTO technician (tech_id, name, contact, skill) VALUES (?, ?, ?, ?)',
            [tech_id, name, contact, skill]
        );

        const username = name.toLowerCase().replace(/\s+/g, '_') + "_" + tech_id;
        const hashedPassword = await bcrypt.hash('pitstop123', 10);

        await connection.query(
            'INSERT INTO admin (username, password_hash, role, tech_id) VALUES (?, ?, "Technician", ?)',
            [username, hashedPassword, tech_id]
        );

        await connection.commit();
        res.status(201).json({ message: 'Technician & Login Created!', username, password: 'pitstop123' });

    } catch (error) {
        await connection.rollback();
        console.error("Crew Recruitment Error:", error.message);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'This Tech ID or Username is already taken on the grid.' });
        }
        res.status(500).json({ error: 'Failed to add technician to the grid.' });
    } finally {
        connection.release();
    }
});

// Add Amenity
app.post('/api/amenities', authenticateToken, async (req, res) => {
    const { amenity_id, name, capacity } = req.body;

    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied. SuperAdmin clearance required.' });
    }

    try {
        await db.query(
            'INSERT INTO amenity (amenity_id, name, capacity) VALUES (?, ?, ?)',
            [amenity_id, name, capacity]
        );
        res.status(201).json({ message: 'Amenity added successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add amenity' });
    }
});

// Book Technician
app.post('/api/bookings/technician', authenticateToken, async (req, res) => {

    const resident_id = req.admin.role === 'Resident' ? req.admin.resident_id : req.body.resident_id;
    const { skill, slot, assign_date } = req.body;

    try {
        // 1. Fetch the actual contact number from the DB first
        const [residentRows] = await db.query(
            'SELECT contact FROM resident WHERE resident_id = ?',
            [resident_id]
        );

        const residentContact = residentRows[0]?.contact;

        // 2. Run the booking procedure
        const [results] = await db.query('CALL AutoBookTechnician(?, ?, ?, ?)', [resident_id, skill, slot, assign_date]);
        const invoice = results[0][0];

        // 3. Send to the ACTUAL number found in Step 1
        if (residentContact) {
            sendConfirmationMessage(
                residentContact,
                `Pit crew confirmed! ${invoice.technician_name} dispatched for ${skill} on ${assign_date}.`
            );
        }

        res.status(201).json({ message: 'Booked!', invoice });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Booking failed' });
    }
});

// Book Amenity
app.post('/api/bookings/amenity', authenticateToken, async (req, res) => {
    const resident_id = req.admin.role === 'Resident' ? req.admin.resident_id : req.body.resident_id;
    const { amenity_id, date, slot, capacity_booked } = req.body;

    if (req.admin.role !== 'Resident' && req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Only Residents or Admins can create bookings.' });
    }

    try {
        const [results] = await db.query(
            'CALL AutoBookAmenity(?, ?, ?, ?, ?)',
            [resident_id, amenity_id, date, slot, capacity_booked]
        );

        const invoiceData = results[0][0];

        const [resRows] = await db.query('SELECT contact FROM resident WHERE resident_id = ?', [resident_id]);
        if (resRows[0]?.contact) {
            sendConfirmationMessage(
                resRows[0].contact,
                `Reservation confirmed! Your slot for ${invoiceData.amenity_name} is locked in for ${date}.`
            );
        }

        res.status(201).json({
            message: 'Amenity booked successfully!',
            invoice: invoiceData
        });

    } catch (error) {
        console.error('Amenity Booking Error:', error);

        // Catch our custom SQL errors (e.g., Capacity exceeded, Pricing not found)
        if (error.sqlState === '45000') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to book amenity.' });
    }
});

// ==========================================
// FINANCIAL ENDPOINTS
// ==========================================

// GET: Fetch Pending Dues for the currently logged-in Resident
app.get('/api/residents/me/dues', authenticateToken, async (req, res) => {

    const residentId = req.admin.resident_id;

    // Security Check: Make sure they are actually a resident
    if (req.admin.role !== 'Resident' || !residentId) {
        return res.status(403).json({ error: 'Access denied. You must be logged in as a Resident to view your dues.' });
    }

    try {
        const [results] = await db.query('CALL GetResidentPendingDues(?)', [residentId]);
        const pendingDues = results[0];

        res.status(200).json({
            message: 'Your pending dues retrieved successfully.',
            total_unpaid_invoices: pendingDues.length,
            invoices: pendingDues
        });

    } catch (error) {
        console.error('Error fetching dues:', error);
        res.status(500).json({ error: 'Failed to fetch pending dues.' });
    }
});

// POST: Trigger the Overdue Payment Cursor (Admin Task)
app.post('/api/admin/process-overdue', authenticateToken, async (req, res) => {

    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied. SuperAdmin clearance required.' });
    }

    try {
        // This calls the procedure with the CURSOR to loop through and update statuses
        await db.query('CALL ProcessOverduePayments()');

        res.status(200).json({
            message: 'Successfully ran the cursor. Pending payments are now marked as Overdue.'
        });

    } catch (error) {
        console.error('Error processing overdue payments:', error);
        res.status(500).json({ error: 'Failed to process overdue payments.' });
    }
});

// ==========================================
// ADVANCED SEARCH & FILTERING ENDPOINT
// ==========================================

// GET: Search all payments with dynamic filters
// Example usage: /api/admin/payments?status=Pending&type=Technician&search=TXN
app.get('/api/admin/payments', authenticateToken, async (req, res) => {

    // Add this check to: process-overdue, payments, residents/search, transactions, and audit-logs
    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied. SuperAdmin clearance required.' });
    }

    try {
        // 1. Grab variables from the URL query string
        const { status, type, search } = req.query;

        // 2. Start with a base query (1=1 is a trick to make appending AND clauses easier)
        let sqlQuery = 'SELECT * FROM `UrbanNexus`.`payment` WHERE 1=1';
        const queryParams = [];

        // 3. Dynamically append filters if they exist in the URL
        if (status) {
            sqlQuery += ' AND status = ?';
            queryParams.push(status);
        }

        if (type) {
            sqlQuery += ' AND type = ?';
            queryParams.push(type);
        }

        if (search) {
            sqlQuery += ' AND trans_no LIKE ?';
            queryParams.push(`%${search}%`); // % allows partial matching
        }

        // 4. Execute the dynamically built query
        const [results] = await db.query(sqlQuery, queryParams);

        res.status(200).json({
            count: results.length,
            filters_applied: { status, type, search },
            data: results
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search payments.' });
    }
});

// GET: Search and Filter Residents
// Example: /api/admin/residents/search?name=Test&block=A&unit=101
app.get('/api/admin/residents/search', authenticateToken, async (req, res) => {

    // Add this check to: process-overdue, payments, residents/search, transactions, and audit-logs
    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied. SuperAdmin clearance required.' });
    }

    try {
        const { name, block, floor, unit } = req.query;

        // 1=1 is a neat SQL trick so we can safely append "AND ..." for our filters
        let sqlQuery = 'SELECT * FROM `UrbanNexus`.`resident` WHERE 1=1';
        const queryParams = [];

        // Dynamically append filters if the admin provided them in the URL
        if (name) {
            sqlQuery += ' AND name LIKE ?';
            queryParams.push(`%${name}%`); // % allows for partial matches (e.g., "Har" finds "Harsith")
        }
        if (block) {
            sqlQuery += ' AND house_block = ?';
            queryParams.push(block);
        }
        if (floor) {
            sqlQuery += ' AND house_floor = ?';
            queryParams.push(floor);
        }
        if (unit) {
            sqlQuery += ' AND house_unit = ?';
            queryParams.push(unit);
        }

        const [results] = await db.query(sqlQuery, queryParams);

        res.status(200).json({
            count: results.length,
            filters_applied: { name, block, floor, unit },
            residents: results
        });

    } catch (error) {
        console.error('Resident Search Error:', error);
        res.status(500).json({ error: 'Failed to search residents.' });
    }
});

// GET: Advanced Transaction Search (Join Payments with Resident Details)
// Example: /api/admin/transactions?status=Pending&block=A
app.get('/api/admin/transactions', authenticateToken, async (req, res) => {

    // Add this check to: process-overdue, payments, residents/search, transactions, and audit-logs
    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied. SuperAdmin clearance required.' });
    }

    try {
        const { status, block, resident_name } = req.query;

        // Massive JOIN query to link the payment to the correct resident
        let sqlQuery = `
            SELECT
                p.trans_no, p.status, p.type, p.cost,
                COALESCE(r_am.name, r_tm.name) AS resident_name,
                COALESCE(r_am.house_block, r_tm.house_block) AS house_block,
                COALESCE(r_am.house_unit, r_tm.house_unit) AS house_unit
            FROM \`UrbanNexus\`.\`payment\` p
            LEFT JOIN \`UrbanNexus\`.\`amenity_mgmt\` am ON p.trans_no = am.trans_no
            LEFT JOIN \`UrbanNexus\`.\`resident\` r_am ON am.resident_id = r_am.resident_id
            LEFT JOIN \`UrbanNexus\`.\`technician_management\` tm ON p.trans_no = tm.trans_no
            LEFT JOIN \`UrbanNexus\`.\`resident\` r_tm ON tm.resident_id = r_tm.resident_id
            WHERE 1=1
        `;
        const queryParams = [];

        // Append Status Filter (e.g., Pending, Confirmed, Overdue)
        if (status) {
            sqlQuery += ' AND p.status = ?';
            queryParams.push(status);
        }

        // Append Block Filter (Checks both amenity and technician residents)
        if (block) {
            sqlQuery += ' AND (r_am.house_block = ? OR r_tm.house_block = ?)';
            queryParams.push(block, block);
        }

        // Append Name Search
        if (resident_name) {
            sqlQuery += ' AND (r_am.name LIKE ? OR r_tm.name LIKE ?)';
            const searchName = `%${resident_name}%`;
            queryParams.push(searchName, searchName);
        }

        const [results] = await db.query(sqlQuery, queryParams);

        res.status(200).json({
            count: results.length,
            transactions: results
        });

    } catch (error) {
        console.error('Transaction Search Error:', error);
        res.status(500).json({ error: 'Failed to search transactions.' });
    }
});

// ==========================================
// THE FINAL PIECES: PAYMENTS, HISTORY & AUDITS
// ==========================================

// 1. POST: Simulate Paying a Bill
// Example: /api/payments/TXN-TECH-12345/pay
app.post('/api/payments/:trans_no/pay', authenticateToken, async (req, res) => {
    const transNo = req.params.trans_no;
    const residentId = req.admin.resident_id;
    const isSuperAdmin = req.admin.role === 'SuperAdmin';

    try {
        // Base query to mark as Paid
        let sql = 'UPDATE `UrbanNexus`.`payment` p SET p.status = "Paid" WHERE p.trans_no = ?';
        let params = [transNo];

        // If NOT an admin, enforce the resident ownership check
        if (!isSuperAdmin) {
            sql += ` AND (
                EXISTS (SELECT 1 FROM \`UrbanNexus\`.\`amenity_mgmt\` am WHERE am.trans_no = p.trans_no AND am.resident_id = ?)
                OR 
                EXISTS (SELECT 1 FROM \`UrbanNexus\`.\`technician_management\` tm WHERE tm.trans_no = p.trans_no AND tm.resident_id = ?)
            )`;
            params.push(residentId, residentId);
        }

        const [result] = await db.query(sql, params);

        if (result.affectedRows === 0) {
            return res.status(403).json({ error: 'Transaction not found or you do not have permission.' });
        }

        res.status(200).json({ message: `Transaction ${transNo} processed successfully!` });
    } catch (error) {
        res.status(500).json({ error: 'Payment processing failed.' });
    }
});

// 2. GET: Resident's Upcoming/Past Bookings
app.get('/api/residents/me/bookings', authenticateToken, async (req, res) => {
    const residentId = req.admin.resident_id; // Using the ID from the JWT token

    if (req.admin.role !== 'Resident' || !residentId) {
        return res.status(403).json({ error: 'Access denied. Must be a Resident.' });
    }

    try {
        // Fetch Amenity Bookings
        const [amenities] = await db.query(`
            SELECT am.booking_id, a.name AS amenity, am.date, am.slot, am.status 
            FROM \`UrbanNexus\`.\`amenity_mgmt\` am
            JOIN \`UrbanNexus\`.\`amenity\` a ON am.amenity_id = a.amenity_id
            WHERE am.resident_id = ? ORDER BY am.date DESC
        `, [residentId]);

        // Fetch Technician Bookings
        const [technicians] = await db.query(`
            SELECT tm.assignment_id, t.name AS technician, t.skill, tm.assign_date, tm.slot, tm.status
            FROM \`UrbanNexus\`.\`technician_management\` tm
            JOIN \`UrbanNexus\`.\`technician\` t ON tm.tech_id = t.tech_id
            WHERE tm.resident_id = ? ORDER BY tm.assign_date DESC
        `, [residentId]);

        res.status(200).json({ amenities, technicians });
    } catch (error) {
        console.error('History Error:', error);
        res.status(500).json({ error: 'Failed to fetch booking history.' });
    }
});

// 3. GET: View the Tamper-Evident Audit Log (Admin Only)
app.get('/api/admin/audit-logs', authenticateToken, async (req, res) => {
    // Security: Only SuperAdmins should see the forensic logs
    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied. SuperAdmin clearance required.' });
    }

    try {
        const [logs] = await db.query('SELECT * FROM `UrbanNexus`.`audit_log` ORDER BY changed_at DESC');
        res.status(200).json({ count: logs.length, logs });
    } catch (error) {
        console.error('Audit Log Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs.' });
    }
});

app.put('/api/residents/me', authenticateToken, async (req, res) => {
    const residentId = req.admin.resident_id;
    const { contact, no_of_members } = req.body;

    if (!residentId) return res.status(403).json({ error: 'Only residents can update their profile.' });

    try {
        await db.query(
            'UPDATE resident SET contact = ?, no_of_members = ? WHERE resident_id = ?',
            [contact, no_of_members, residentId]
        );
        res.json({ message: 'Profile updated successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Update failed.' });
    }
});

// DELETE: Remove a Resident (and their linked login/bookings via CASCADE)
app.delete('/api/residents/:id', authenticateToken, async (req, res) => {
    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Only SuperAdmin can remove drivers from the grid.' });
    }

    try {
        const [result] = await db.query('DELETE FROM resident WHERE resident_id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Resident not found.' });
        }

        res.json({ message: 'Resident and all associated records deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Deletion failed.' });
    }
});

// DELETE: Remove a User Account (Admin Only)
app.delete('/api/admin/:id', authenticateToken, async (req, res) => {
    if (req.admin.role !== 'SuperAdmin') return res.status(403).json({ error: 'Access denied.' });

    try {
        await db.query('DELETE FROM admin WHERE admin_id = ?', [req.params.id]);
        res.json({ message: 'User account removed.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove account.' });
    }
});

// GET: Fetch assignments for the logged-in Technician
app.get('/api/technician/me/tasks', authenticateToken, async (req, res) => {
    if (req.admin.role !== 'Technician') return res.status(403).json({ error: 'Access denied.' });

    try {
        const [tasks] = await db.query(`
            SELECT tm.assignment_id, tm.assign_date, tm.slot, tm.status, 
                   r.name as resident_name, r.house_block, r.house_unit, r.contact as resident_phone
            FROM technician_management tm
            JOIN resident r ON tm.resident_id = r.resident_id
            WHERE tm.tech_id = ? ORDER BY tm.assign_date ASC, tm.slot ASC
        `, [req.admin.tech_id]);

        res.json(tasks);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch tasks.' }); }
});

// PUT: Unified Profile Update (Works for Resident AND Technician)
app.put('/api/profile/update', authenticateToken, async (req, res) => {
    const { name, contact, password } = req.body;
    const { resident_id, tech_id, id: admin_id } = req.admin;

    try {
        // 1. Update Password if provided
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query('UPDATE admin SET password_hash = ? WHERE admin_id = ?', [hashedPassword, admin_id]);
        }

        // 2. Update Role-Specific Table
        if (resident_id) {
            await db.query('UPDATE resident SET name = ?, contact = ? WHERE resident_id = ?', [name, contact, resident_id]);
        } else if (tech_id) {
            await db.query('UPDATE technician SET name = ?, contact = ? WHERE tech_id = ?', [name, contact, tech_id]);
        }

        res.json({ message: 'Profile updated successfully!' });
    } catch (error) { res.status(500).json({ error: 'Update failed.' }); }
});

// PUT: Technician updates task status (e.g., In Progress, Resolved)
app.put('/api/technician/tasks/:id/status', authenticateToken, async (req, res) => {
    const { status } = req.body;
    const assignment_id = req.params.id;

    try {
        // 1. Update status in the database
        await db.query('UPDATE technician_management SET status = ? WHERE assignment_id = ?', [status, assignment_id]);

        // 2. Fetch resident contact for notification
        const [details] = await db.query(`
            SELECT r.contact, r.name as resident_name, t.name as tech_name, t.skill
            FROM technician_management tm
            JOIN resident r ON tm.resident_id = r.resident_id
            JOIN technician t ON tm.tech_id = t.tech_id
            WHERE tm.assignment_id = ?
        `, [assignment_id]);

        if (details[0]?.contact) {
            const message = `${status.toUpperCase()}! Your ${details[0].skill} request is now ${status}. Tech: ${details[0].tech_name}.`;
            await sendConfirmationMessage(details[0].contact, message);
        }

        res.json({ message: `Task status updated to ${status}. Notification sent.` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

app.get('/api/admin/technicians', authenticateToken, async (req, res) => {
    if (req.admin.role !== 'SuperAdmin') return res.status(403).json({ error: 'Admin only.' });
    try {
        const [techs] = await db.query('SELECT * FROM technician');
        res.json(techs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch technical crew.' });
    }
});

app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
    if (req.admin.role !== 'SuperAdmin') return res.status(403).json({ error: 'Admin clearance required.' });

    const { name, username, password, contact } = req.body;
    const targetResidentId = req.params.id;

    try {
        // 1. Update Profile (Name/Contact)
        await db.query('UPDATE resident SET name = ?, contact = ? WHERE resident_id = ?', [name, contact, targetResidentId]);

        // 2. Update Credentials
        let loginSql = 'UPDATE admin SET username = ?';
        let loginParams = [username];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            loginSql += ', password_hash = ?';
            loginParams.push(hashedPassword);
        }

        loginSql += ' WHERE resident_id = ?';
        loginParams.push(targetResidentId);

        await db.query(loginSql, loginParams);
        res.json({ message: 'User details synchronized successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user details.' });
    }
});

// GET: Fetch current profile details for the logged-in user
app.get('/api/profile/me', authenticateToken, async (req, res) => {
    const { resident_id, tech_id } = req.admin;

    try {
        let data;
        if (resident_id) {
            [data] = await db.query('SELECT name, contact FROM resident WHERE resident_id = ?', [resident_id]);
        } else if (tech_id) {
            [data] = await db.query('SELECT name, contact FROM technician WHERE tech_id = ?', [tech_id]);
        }

        if (!data || data.length === 0) return res.status(404).json({ error: 'User not found' });

        res.json(data[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile info' });
    }
});

cron.schedule('0 0 * * *', async () => {
    try {
        await db.query('CALL ProcessOverduePayments()');
        console.log('Nightly Overdue Payment check completed.');
    } catch (error) {
        console.error('Failed to run nightly cron job:', error);
    }
});

const sendConfirmationMessage = async (to, message) => {
    if (!to) {
        console.error("[SMS Error] No phone number found.");
        return;
    }

    try {
        // 1. Force to string and remove spaces/special chars
        // This prevents the "Short Code" misinterpretation
        let cleanNumber = String(to).replace(/\s+/g, '');

        // 2. Format check: If it doesn't have '+', prepend '+91'
        const formattedNumber = cleanNumber.startsWith('+') ? cleanNumber : `+91${cleanNumber}`;

        console.log(`[Attempting SMS] Sending to: ${formattedNumber}`);

        await twilioClient.messages.create({
            body: `UrbanNexus: ${message}`,
            from: process.env.TWILIO_PHONE, // Ensure this is your Twilio #, not a short code
            to: formattedNumber
        });

        console.log(`[SMS Sent] to ${formattedNumber}`);
    } catch (err) {
        console.error("[Twilio Error]", err.message);
    }
};

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});