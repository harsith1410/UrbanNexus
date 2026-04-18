import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';
import api from '../api';

export default function BookAmenity({ onBack }) {
    const [loading, setLoading] = useState(false);
    const [facilities, setFacilities] = useState([]); // Dynamic facility list
    const [invoice, setInvoice] = useState(null);
    const [formData, setFormData] = useState({
        amenity_id: '',
        date: '',
        slot: 1,
        capacity_booked: 1
    });

    useEffect(() => {
        const fetchFacilities = async () => {
            try {
                const response = await api.get('/amenities');
                setFacilities(response.data);
                // Set default amenity_id if facilities are returned
                if (response.data.length > 0) {
                    setFormData(prev => ({ ...prev, amenity_id: response.data[0].amenity_id.toString() }));
                }
            } catch (error) {
                console.error("Facility sync failure");
            }
        };
        fetchFacilities();
    }, []);

    const selectedFacility = facilities.find(f => f.amenity_id.toString() === formData.amenity_id);
    const isOverCapacity = selectedFacility && formData.capacity_booked > selectedFacility.capacity;

    const handleBooking = async (e) => {
        e.preventDefault();
        if (isOverCapacity) {
            alert("Booking blocked: You cannot exceed the facility's capacity limit.");
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const decoded = jwtDecode(token);

            const payload = {
                ...formData,
                resident_id: decoded.resident_id,
                amenity_id: parseInt(formData.amenity_id)
            };

            const response = await api.post('/bookings/amenity', payload);
            setInvoice(response.data.invoice);
        } catch (error) {
            alert("Booking Failed: " + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    if (invoice) {
        return (
            <div className="p-8 max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-green-200 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 italic mb-2 uppercase tracking-tighter">Reservation Confirmed</h2>
                <p className="text-gray-500 mb-6 font-medium">Your amenity pass has been generated and synced with the grid.</p>
                <div className="bg-gray-50 p-6 rounded-xl text-left font-mono text-sm border border-gray-100">
                    <p><strong>Booking ID:</strong> {invoice.booking_id}</p>
                    <p><strong>Amenity:</strong> {invoice.amenity_name}</p>
                    <p><strong>Date / Slot:</strong> {new Date(invoice.booking_date).toLocaleDateString()} / Slot {invoice.slot}</p>
                    <p><strong>Total Cost (inc. GST):</strong> ₹{invoice.total_with_gst}</p>
                    <p><strong>Transaction #:</strong> {invoice.trans_no}</p>
                </div>
                <button onClick={onBack} className="mt-8 bg-gray-900 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs">Return to Dashboard</button>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <button onClick={onBack} className="flex items-center text-blue-600 mb-6 hover:underline font-bold uppercase text-[10px] tracking-widest">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </button>
            <h2 className="text-2xl font-bold mb-6 italic tracking-tighter uppercase">Reserve Facility</h2>

            <form onSubmit={handleBooking} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">

                <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Select Facility</label>
                    <select
                        value={formData.amenity_id}
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        onChange={(e) => setFormData({...formData, amenity_id: e.target.value})}
                    >
                        {facilities.map(facility => (
                            <option key={facility.amenity_id} value={facility.amenity_id}>
                                {facility.name} (Max: {facility.capacity})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Date</label>
                        <input type="date" required className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                               onChange={(e) => setFormData({...formData, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Time Slot (1-10)</label>
                        <input type="number" min="1" max="10" required className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                               onChange={(e) => setFormData({...formData, slot: parseInt(e.target.value)})} />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Guests (Capacity)</label>
                    <input
                        type="number" min="1" required
                        className={`w-full p-3 border rounded-xl bg-gray-50 outline-none transition-all ${isOverCapacity ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
                        onChange={(e) => setFormData({...formData, capacity_booked: parseInt(e.target.value)})}
                    />

                    {isOverCapacity ? (
                        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <p className="text-[10px] font-bold uppercase tracking-tighter italic">Warning: Capacity exceeded. Max allowed for this facility is {selectedFacility.capacity}.</p>
                        </div>
                    ) : selectedFacility && (
                        <div className="flex items-center space-x-2 text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <Info className="w-4 h-4 flex-shrink-0" />
                            <p className="text-[10px] font-bold uppercase tracking-tighter italic">Facility capacity: {selectedFacility.capacity} occupants.</p>
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading || isOverCapacity}
                    className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest transition-all flex items-center justify-center ${isOverCapacity ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}`}
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <Calendar className="w-5 h-5 mr-2" />}
                    Confirm Booking
                </button>
            </form>
        </div>
    );
}