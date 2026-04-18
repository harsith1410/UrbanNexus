import { useState } from 'react';
import { Wrench, ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';
import api from '../api';

export default function BookTechnician({ onBack }) {
    const [loading, setLoading] = useState(false);
    const [invoice, setInvoice] = useState(null);
    const [formData, setFormData] = useState({
        skill: 'Plumber',
        assign_date: '',
        slot: 1
    });

    const handleBooking = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const decoded = jwtDecode(token);

            const payload = {
                ...formData,
                resident_id: decoded.resident_id
            };

            const response = await api.post('/bookings/technician', payload);
            setInvoice(response.data.invoice);
        } catch (error) {
            alert("Dispatch Failed: " + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    if (invoice) {
        return (
            <div className="p-8 max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-orange-200 text-center">
                <CheckCircle2 className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 italic mb-2">TECHNICIAN DISPATCHED</h2>
                <p className="text-gray-500 mb-6">Your Technician has been assigned</p>
                <div className="bg-gray-50 p-6 rounded-xl text-left font-mono text-sm border border-gray-100">
                    <p><strong>Assignment ID:</strong> {invoice.assignment_id}</p>
                    <p><strong>Crew Member:</strong> {invoice.technician_name}</p>
                    <p><strong>Date / Slot:</strong> {new Date(invoice.assign_date).toLocaleDateString()} / Slot {invoice.slot}</p>
                    <p><strong>Base Price:</strong> ₹{invoice.base_price}</p>
                    <p><strong>Transaction #:</strong> {invoice.trans_no}</p>
                </div>
                <button onClick={onBack} className="mt-8 bg-gray-900 text-white px-6 py-2 rounded-lg font-bold">Return to Dashboard</button>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <button onClick={onBack} className="flex items-center text-blue-600 mb-6 hover:underline font-medium">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </button>
            <h2 className="text-2xl font-bold mb-6 italic tracking-tighter">REQUEST TECHNICAL STAFF</h2>

            <form onSubmit={handleBooking} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest">Required Skill</label>
                    <select className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            onChange={(e) => setFormData({...formData, skill: e.target.value})}>
                        <option value="Plumber">Plumber</option>
                        <option value="Electrician">Electrician</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Carpenter">Carpenter</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest">Date</label>
                        <input type="date" required className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                               onChange={(e) => setFormData({...formData, assign_date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest">Time Slot (1-4)</label>
                        <input type="number" min="1" max="4" required className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                               onChange={(e) => setFormData({...formData, slot: parseInt(e.target.value)})} />
                    </div>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors flex items-center justify-center">
                    {loading ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <Wrench className="w-5 h-5 mr-2" />}
                    Request Dispatch
                </button>
            </form>
        </div>
    );
}