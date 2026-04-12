import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
    return (
        <Router>
            <Routes>
                {/* Default route redirects to login */}
                <Route path="/" element={<Navigate to="/login" />} />

                {/* The Login Page */}
                <Route path="/login" element={<Login />} />

                {/* The Dynamic Dashboard */}
                <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
        </Router>
    );
}

export default App;