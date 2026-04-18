import { useState, useEffect } from 'react';
import { CreditCard, Calendar, Wrench, ChevronLeft, Loader2, Settings, History, CheckCircle2, Clock } from 'lucide-react';
import BookAmenity from './BookAmenity';
import BookTechnician from './BookTechnician';
import api from '../api';

export default function ResidentDashboard() {
    const [view, setView] = useState('menu');
    const [data, setData] = useState([]); // Used for Dues
    const [bookings, setBookings] = useState({ amenities: [], technicians: [] }); // Used for History
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState({ name: '', contact: '', password: '' });

    // Synchronize current profile spec when entering settings
    useEffect(() => {
        if (view === 'settings') {
            const syncProfile = async () => {
                try {
                    const res = await api.get('/profile/me');
                    setProfile({ name: res.data.name, contact: res.data.contact, password: '' });
                } catch (err) { console.error("Profile sync failed"); }
            };
            syncProfile();
        }
    }, [view]);

    const fetchDues = async () => {
        setLoading(true);
        try {
            const res = await api.get('/residents/me/dues');
            setData(res.data.invoices);
            setView('dues');
        } catch (err) { alert(err.response?.data?.error || err.message); }
        finally { setLoading(false); }
    };

    // NEW: Fetch booking history from the new endpoint
    const fetchBookings = async () => {
        setLoading(true);
        try {
            const res = await api.get('/residents/me/bookings');
            setBookings(res.data);
            setView('history');
        } catch (err) { alert(err.response?.data?.error || err.message); }
        finally { setLoading(false); }
    };

    const handlePayment = async (transNo) => {
        try {
            await api.post(`/payments/${transNo}/pay`);
            alert("Payment successful! Your grid status is now clear.");
            fetchDues();
        } catch (error) { alert("Payment failed."); }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put('/profile/update', profile);
            alert("Profile synchronized with the grid!");
        } catch (err) { alert("Update failed"); }
    };

    if (view === 'book-amenity') return <BookAmenity onBack={() => setView('menu')} />;
    if (view === 'book-tech') return <BookTechnician onBack={() => setView('menu')} />;

    // --- Sub-View: Dues Table ---
    if (view === 'dues') {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <button onClick={() => setView('menu')} className="flex items-center text-blue-600 mb-6 font-bold uppercase text-xs">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                </button>
                <h2 className="text-2xl font-bold mb-6 italic tracking-tighter uppercase">Pending Invoices</h2>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400">
                        <tr><th className="px-6 py-4">TXN #</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Amount (Incl. GST)</th><th className="px-6 py-4 text-right">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {data.length === 0 ? (
                            <tr><td colSpan="4" className="text-center py-10 text-gray-400 italic">No pending dues. Debt Free!</td></tr>
                        ) : data.map((inv) => (
                            <tr key={inv.trans_no}>
                                <td className="px-6 py-4 font-mono text-sm">{inv.trans_no}</td>
                                <td className="px-6 py-4 text-sm font-semibold">{inv.service_type}</td>
                                <td className="px-6 py-4 font-bold text-blue-600">₹{inv.cost}</td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handlePayment(inv.trans_no)} className="bg-green-600 text-white px-4 py-1.5 rounded text-xs font-bold uppercase hover:bg-green-700">Pay Now</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // --- NEW Sub-View: Booking History ---
    if (view === 'history') {
        return (
            <div className="p-8 max-w-5xl mx-auto space-y-12">
                <button onClick={() => setView('menu')} className="flex items-center text-blue-600 mb-6 font-bold uppercase text-xs">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                </button>

                {/* Amenity History */}
                <section>
                    <h2 className="text-xl font-bold mb-6 italic tracking-tighter uppercase flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-green-600" /> Facility Reservations
                    </h2>
                    <div className="grid gap-4">
                        {bookings.amenities.length === 0 ? <p className="text-gray-400 italic text-sm">No facility bookings found.</p> :
                            bookings.amenities.map(b => (
                                <div key={b.booking_id} className="bg-white p-6 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                                    <div>
                                        <h3 className="font-bold text-lg">{b.amenity}</h3>
                                        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">{new Date(b.date).toLocaleDateString()} | Slot {b.slot}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${b.status === 'Confirmed' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {b.status}
                                </span>
                                </div>
                            ))}
                    </div>
                </section>

                {/* Technician History */}
                <section>
                    <h2 className="text-xl font-bold mb-6 italic tracking-tighter uppercase flex items-center">
                        <Wrench className="w-5 h-5 mr-2 text-orange-600" /> Technical Service History
                    </h2>
                    <div className="grid gap-4">
                        {bookings.technicians.length === 0 ? <p className="text-gray-400 italic text-sm">No technician requests found.</p> :
                            bookings.technicians.map(t => (
                                <div key={t.assignment_id} className="bg-white p-6 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                                    <div>
                                        <h3 className="font-bold text-lg">{t.technician} <span className="text-xs font-normal text-gray-400">({t.skill})</span></h3>
                                        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">{new Date(t.assign_date).toLocaleDateString()} | Slot {t.slot}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${t.status === 'Resolved' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                    {t.status}
                                </span>
                                </div>
                            ))}
                    </div>
                </section>
            </div>
        );
    }


    if (view === 'settings') {
        return (
            <div className="p-8 max-w-xl mx-auto">
                <button onClick={() => setView('menu')} className="flex items-center text-blue-600 mb-6 font-bold uppercase text-xs">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                </button>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                    <h2 className="text-2xl font-bold italic uppercase tracking-tighter">Account Tuning</h2>
                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Display Name</label>
                            <input type="text" value={profile.name} className="w-full p-3 border rounded-xl bg-gray-50" onChange={e => setProfile({...profile, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Contact Number</label>
                            <input type="text" value={profile.contact} className="w-full p-3 border rounded-xl bg-gray-50" onChange={e => setProfile({...profile, contact: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">New Password - (ALERT: CHANGING PWD)</label>
                            <input type="text" placeholder="*********" className="w-full p-3 border rounded-xl bg-gray-50" onChange={e => setProfile({...profile, password: e.target.value})} />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold uppercase">Save Changes</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <header><h1 className="text-3xl font-bold italic underline decoration-blue-500 uppercase tracking-tighter">Resident Portal</h1></header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8"> {/* Adjusted grid for 5 items */}
                <div onClick={fetchDues} className="bg-white p-8 rounded-2xl border border-gray-100 hover:border-blue-500 transition-all cursor-pointer group relative">
                    {loading && <Loader2 className="animate-spin absolute top-4 right-4 text-blue-600" />}
                    <CreditCard className="w-10 h-10 text-blue-600 mb-6 group-hover:scale-110 transition-transform" />
                    <h3 className="text-xl font-bold">My Dues</h3>
                </div>
                <div onClick={() => setView('book-amenity')} className="bg-white p-8 rounded-2xl border border-gray-100 hover:border-green-500 transition-all cursor-pointer group">
                    <Calendar className="w-10 h-10 text-green-600 mb-6 group-hover:scale-110 transition-transform" />
                    <h3 className="text-xl font-bold">Facilities</h3>
                </div>
                <div onClick={() => setView('book-tech')} className="bg-white p-8 rounded-2xl border border-gray-100 hover:border-orange-500 transition-all cursor-pointer group">
                    <Wrench className="w-10 h-10 text-orange-600 mb-6 group-hover:scale-110 transition-transform" />
                    <h3 className="text-xl font-bold">Technical Staff</h3>
                </div>
                {/* NEW: Booking History Card */}
                <div onClick={fetchBookings} className="bg-white p-8 rounded-2xl border border-gray-100 hover:border-purple-500 transition-all cursor-pointer group relative">
                    {loading && <Loader2 className="animate-spin absolute top-4 right-4 text-purple-600" />}
                    <History className="w-10 h-10 text-purple-600 mb-6 group-hover:scale-110 transition-transform" />
                    <h3 className="text-xl font-bold">My Bookings</h3>
                </div>
                <div onClick={() => setView('settings')} className="bg-white p-8 rounded-2xl border border-gray-100 hover:border-gray-900 transition-all cursor-pointer group">
                    <Settings className="w-10 h-10 text-gray-400 mb-6 group-hover:rotate-90 transition-transform" />
                    <h3 className="text-xl font-bold">Settings</h3>
                </div>
            </div>
        </div>
    );
}