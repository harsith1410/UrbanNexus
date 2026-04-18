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

// Get Role for the logged-in User
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

// ------- RESIDENT BASED ENDPOINTS -------

// Add Resident
app.post('/api/residents', authenticateToken, async (req, res) => {
    const { name, house_block, house_floor, house_unit, ownership_status, contact, no_of_members } = req.body;

    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied.' });
    }

    try {
        const [resResult] = await db.query(
            'INSERT INTO resident (name, house_block, house_floor, house_unit, ownership_status, contact, no_of_members) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, house_block, house_floor, house_unit, ownership_status, contact, no_of_members]
        );
        const newResidentId = resResult.insertId;

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

// Get Pending Dues for the Resident
app.get('/api/residents/me/dues', authenticateToken, async (req, res) => {

    const residentId = req.admin.resident_id;

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

// Get the History of Bookings
app.get('/api/residents/me/bookings', authenticateToken, async (req, res) => {
    const residentId = req.admin.resident_id; // Using the ID from the JWT token

    if (req.admin.role !== 'Resident' || !residentId) {
        return res.status(403).json({ error: 'Access denied. Must be a Resident.' });
    }

    try {
        const [amenities] = await db.query(`
            SELECT am.booking_id, a.name AS amenity, am.date, am.slot, am.status 
            FROM \`UrbanNexus\`.\`amenity_mgmt\` am
            JOIN \`UrbanNexus\`.\`amenity\` a ON am.amenity_id = a.amenity_id
            WHERE am.resident_id = ? ORDER BY am.date DESC
        `, [residentId]);

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

// Resident Profile Update
app.put('/api/profile/update', authenticateToken, async (req, res) => {
    const { name, contact, password } = req.body;
    const { resident_id, tech_id, id: admin_id } = req.admin;

    try {
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query('UPDATE admin SET password_hash = ? WHERE admin_id = ?', [hashedPassword, admin_id]);
        }

        if (resident_id) {
            await db.query('UPDATE resident SET name = ?, contact = ? WHERE resident_id = ?', [name, contact, resident_id]);
        } else if (tech_id) {
            await db.query('UPDATE technician SET name = ?, contact = ? WHERE tech_id = ?', [name, contact, tech_id]);
        }

        res.json({ message: 'Profile updated successfully!' });
    } catch (error) { res.status(500).json({ error: 'Update failed.' }); }
});

// Delete Resident
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

// ------- TECHNICIAN BASED ENDPOINTS -------

// Add Technician
app.post('/api/technicians', authenticateToken, async (req, res) => {
    const { tech_id, name, contact, skill } = req.body;
    if (req.admin.role !== 'SuperAdmin') return res.status(403).json({ error: 'Admin only.' });

    // Validate that tech_id is a number
    if (isNaN(tech_id)) return res.status(400).json({ error: 'Tech ID must be a number.' });

    const connection = await db.getConnection();
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

// Book Technician
app.post('/api/bookings/technician', authenticateToken, async (req, res) => {

    const resident_id = req.admin.role === 'Resident' ? req.admin.resident_id : req.body.resident_id;
    const { skill, slot, assign_date } = req.body;

    try {
        const [residentRows] = await db.query(
            'SELECT contact FROM resident WHERE resident_id = ?',
            [resident_id]
        );

        const residentContact = residentRows[0]?.contact;

        const [results] = await db.query('CALL AutoBookTechnician(?, ?, ?, ?)', [resident_id, skill, slot, assign_date]);
        const invoice = results[0][0];

        if (residentContact) {
            sendConfirmationMessage(
                residentContact,
                `Technician confirmed! ${invoice.technician_name} dispatched for ${skill} on ${assign_date}.`
            );
        }

        res.status(201).json({ message: 'Booked!', invoice });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Booking failed' });
    }
});

// Get Scheduled Tasks for Technician
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

// Update the Status of the Task
app.put('/api/technician/tasks/:id/status', authenticateToken, async (req, res) => {
    const { status } = req.body;
    const assignment_id = req.params.id;

    try {
        await db.query('UPDATE technician_management SET status = ? WHERE assignment_id = ?', [status, assignment_id]);

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

// ------- AMENITY BASED ENDPOINTS -------

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

        if (error.sqlState === '45000') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to book amenity.' });
    }
});

// Get Amenity Details
app.get('/api/amenities', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT amenity_id, name, capacity FROM amenity');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve facilities.' });
    }
});

// ------- ADMIN BASED ENDPOINTS -------

// Filter and Fetch Residents
app.get('/api/admin/residents/search', authenticateToken, async (req, res) => {

    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied. SuperAdmin clearance required.' });
    }

    try {
        const { name, block, floor, unit } = req.query;

        let sqlQuery = 'SELECT * FROM `UrbanNexus`.`resident` WHERE 1=1';
        const queryParams = [];

        if (name) {
            sqlQuery += ' AND name LIKE ?';
            queryParams.push(`%${name}%`);
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

// Fetch Technicians
app.get('/api/admin/technicians', authenticateToken, async (req, res) => {
    if (req.admin.role !== 'SuperAdmin') return res.status(403).json({ error: 'Access denied.' });
    try {
        const [techs] = await db.query('SELECT tech_id, name, skill, contact FROM technician');
        res.json(techs);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch technicians' }); }
});

// Get all the Payment Details
app.get('/api/admin/transactions', authenticateToken, async (req, res) => {

    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied. SuperAdmin clearance required.' });
    }

    try {
        const { status, block, resident_name } = req.query;

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

        if (status) {
            sqlQuery += ' AND p.status = ?';
            queryParams.push(status);
        }

        if (block) {
            sqlQuery += ' AND (r_am.house_block = ? OR r_tm.house_block = ?)';
            queryParams.push(block, block);
        }

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

// Process Overdue Payment
app.post('/api/admin/process-overdue', authenticateToken, async (req, res) => {

    if (req.admin.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Access denied. SuperAdmin clearance required.' });
    }

    try {
        await db.query('CALL ProcessOverduePayments()');

        res.status(200).json({
            message: 'Successfully ran the cursor. Pending payments are now marked as Overdue.'
        });

    } catch (error) {
        console.error('Error processing overdue payments:', error);
        res.status(500).json({ error: 'Failed to process overdue payments.' });
    }
});

// Get Audit Logs
app.get('/api/admin/audit-logs', authenticateToken, async (req, res) => {

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

// ------- FINANCIAL ENDPOINTS -------

// Paying Bill
app.post('/api/payments/:trans_no/pay', authenticateToken, async (req, res) => {
    const transNo = req.params.trans_no;
    const residentId = req.admin.resident_id;
    const isSuperAdmin = req.admin.role === 'SuperAdmin';

    try {
        let sql = 'UPDATE `UrbanNexus`.`payment` p SET p.status = "Paid" WHERE p.trans_no = ?';
        let params = [transNo];

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

cron.schedule('*/30 * * * * *', async () => {
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