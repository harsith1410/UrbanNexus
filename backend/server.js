const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authenticateToken = require('./authMiddleware');

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
                resident_id: admin.resident_id
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
            db_test_result: rows[0].name
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ server: 'Running', database: 'Disconnected', error: error.message });
    }
});

// Add Resident
app.post('/api/residents', authenticateToken, async (req, res) => {
    const { name, house_block, house_floor, house_unit, ownership_status, contact, no_of_members } = req.body;

    try {
        const [result] = await db.query(
            'INSERT INTO resident (name, house_block, house_floor, house_unit, ownership_status, contact, no_of_members) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, house_block, house_floor, house_unit, ownership_status, contact, no_of_members]
        );
        res.status(201).json({ message: 'Resident added successfully!', resident_id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add resident' });
    }
});

// Add Technician
app.post('/api/technicians', authenticateToken, async (req, res) => {
    const { tech_id, name, contact, skill } = req.body;

    try {
        await db.query(
            'INSERT INTO technician (tech_id, name, contact, skill) VALUES (?, ?, ?, ?)',
            [tech_id, name, contact, skill]
        );
        res.status(201).json({ message: 'Technician added successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add technician' });
    }
});

// Add Amenity
app.post('/api/amenities', authenticateToken, async (req, res) => {
    const { amenity_id, name, capacity } = req.body;

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

    const { resident_id, skill, slot, assign_date } = req.body;

    try {
        const [results] = await db.query(
            'CALL AutoBookTechnician(?, ?, ?, ?)',
            [resident_id, skill, slot, assign_date]
        );

        const invoiceData = results[0][0];

        res.status(201).json({
            message: 'Technician booked successfully!',
            invoice: invoiceData
        });

    } catch (error) {
        console.error('Booking Error:', error);
        if (error.sqlState === '45000') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to book technician.' });
    }
});

// Book Amenity
app.post('/api/bookings/amenity', authenticateToken, async (req, res) => {
    const { resident_id, amenity_id, date, slot, capacity_booked } = req.body;

    try {
        const [results] = await db.query(
            'CALL AutoBookAmenity(?, ?, ?, ?, ?)',
            [resident_id, amenity_id, date, slot, capacity_booked]
        );

        const invoiceData = results[0][0];

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
    // We extract the ID directly from the decrypted token, NOT the URL!
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

    try {
        // Update the payment status to 'Paid'
        const [result] = await db.query(
            'UPDATE `UrbanNexus`.`payment` SET status = ? WHERE trans_no = ?',
            ['Paid', transNo]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Transaction not found.' });
        }

        res.status(200).json({ message: `Transaction ${transNo} successfully paid!` });
    } catch (error) {
        console.error('Payment Error:', error);
        res.status(500).json({ error: 'Failed to process payment.' });
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});