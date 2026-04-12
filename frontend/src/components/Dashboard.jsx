import { Navigate, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { LogOut } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import ResidentDashboard from './ResidentDashboard';

export default function Dashboard() {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    // 1. Security Check: If they have no token, kick them back to login
    if (!token) {
        return <Navigate to="/login" />;
    }

    // 2. Decode the token to find out who they are
    let userRole = '';
    try {
        const decoded = jwtDecode(token);
        userRole = decoded.role;
    } catch (error) {
        // If the token is tampered with or invalid, clear it and kick them out
        localStorage.removeItem('token');
        return <Navigate to="/login" />;
    }

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Universal Top Navigation Bar */}
            <nav className="bg-white shadow-sm border-b border-gray-200 px-8 py-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-blue-600">UrbanNexus</h1>
                <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500 font-medium px-3 py-1 bg-gray-100 rounded-full">
                        Role: {userRole}
                    </span>
                    <button
                        onClick={handleLogout}
                        className="flex items-center text-gray-500 hover:text-red-600 transition-colors"
                    >
                        <LogOut className="w-5 h-5 mr-1" />
                        Logout
                    </button>
                </div>
            </nav>

            {/* Render the correct dashboard based on the role! */}
            <main>
                {userRole === 'SuperAdmin' && <AdminDashboard />}
                {userRole === 'Resident' && <ResidentDashboard />}
                {userRole === 'Technician' && <div className="p-8">Technician view coming soon!</div>}
            </main>
        </div>
    );
}