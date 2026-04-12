USE `UrbanNexus`;

-- 1. Residents: The 2026 Grid
INSERT INTO `resident` (name, house_block, house_floor, house_unit, ownership_status, contact, no_of_members)
VALUES
    ('Lewis Hamilton', 'A', 4, '44', 'Owner', '9444444444', 2),
    ('Max Verstappen', 'B', 1, '01', 'Owner', '9010101010', 1),
    ('Charles Leclerc', 'A', 16, '1601', 'Tenant', '9161616161', 2),
    ('Fernando Alonso', 'C', 14, '1401', 'Owner', '9141414141', 1),
    ('Lando Norris', 'B', 4, '404', 'Tenant', '9040404040', 3);

-- 2. Technicians: The Pit Wall (Meme Edition)
INSERT INTO `technician` (tech_id, name, contact, skill)
VALUES
    ('T101', 'Toto Wolff', '8888888888', 'Electrician'),
    ('T102', 'Charlie Whiting', '7777777777', 'Plumber'),
    ('T103', 'Gunther Steiner', '6666666666', 'Maintenance'),
    ('T104', 'Christian Horner', '5555555555', 'Carpenter');

-- 3. Amenities
INSERT INTO `amenity` (amenity_id, name, capacity)
VALUES
    ('AM-01', 'Paddock Club Lounge', 20),
    ('AM-02', 'Monaco Rooftop Pool', 15),
    ('AM-03', 'Parc Fermé Gym', 10);

-- 4. Login Accounts (Password: pwd123#)
-- Using a generic hash for demonstration; replace with your bcrypt logic in production
INSERT INTO `admin` (username, password_hash, role, resident_id)
VALUES
    ('sir_lewis', '$2b$10$7zV9RzG5fD6m7WJzGZ/6u.Y6p3e3N4k2YIq0tqI6n7Z5Z5Z5Z5Z5Z', 'Resident', 1),
    ('toto_admin', '$2b$10$7zV9RzG5fD6m7WJzGZ/6u.Y6p3e3N4k2YIq0tqI6n7Z5Z5Z5Z5Z5Z', 'SuperAdmin', NULL);

-- 5. Sample Payments (Ready for tomorrow's filtering tests)
INSERT INTO `payment` (trans_no, status, type, cost)
VALUES
    ('TXN-TECH-44', 'Pending', 'Technician', 440.00),
    ('TXN-AMEN-01', 'Paid', 'Amenity', 1000.00),
    ('TXN-TECH-33', 'Overdue', 'Technician', 330.00),
    ('TXN-AMEN-16', 'Pending', 'Amenity', 160.00);