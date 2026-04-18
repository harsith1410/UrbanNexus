import { useState, useEffect } from 'react';
import { Building, Plus, X, Loader2 } from 'lucide-react';
import api from '../api';

export default function AmenityDirectory() {
    const [amenities, setAmenities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ amenity_id: '', name: '', capacity: 1 });

    const fetchAmenities = async () => {
        setLoading(true);
        try {
            const res = await api.get('/amenities');
            setAmenities(res.data);
        } catch (err) {
            console.error("Facility sync failed");
        } finally {
            setLoading(false);
        }
    };

    const handleAddAmenity = async (e) => {
        e.preventDefault();
        try {
            await api.post('/amenities', formData);
            setShowModal(false);
            setFormData({ amenity_id: '', name: '', capacity: 1 });
            fetchAmenities();
        } catch (err) {
            alert("Failed to add facility: " + (err.response?.data?.error || err.message));
        }
    };

    useEffect(() => { fetchAmenities(); }, []);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-tighter italic">Grid Facilities</h2>
                <button onClick={() => setShowModal(true)} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors">
                    <Plus className="w-4 h-4" />
                    <span>Add Amenity</span>
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400">
                    <tr>
                        <th className="px-6 py-4">Facility ID</th>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Max Capacity</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                    {loading ? (
                        <tr><td colSpan="3" className="text-center py-8 italic text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2"/> Scanning facilities...</td></tr>
                    ) : amenities.length === 0 ? (
                        <tr><td colSpan="3" className="text-center py-8 italic text-gray-400">No facilities registered on the grid.</td></tr>
                    ) : (
                        amenities.map(amenity => (
                            <tr key={amenity.amenity_id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-mono">{amenity.amenity_id}</td>
                                <td className="px-6 py-4 font-bold">{amenity.name}</td>
                                <td className="px-6 py-4">
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold text-[10px]">
                                            {amenity.capacity} Persons
                                        </span>
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>

            {/* Add Amenity Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-8 relative">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"><X /></button>
                        <h3 className="text-xl font-bold mb-6 italic uppercase tracking-tighter flex items-center">
                            <Building className="w-5 h-5 mr-2 text-blue-600" /> Register Facility
                        </h3>

                        <form onSubmit={handleAddAmenity} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Facility ID (Numeric)</label>
                                <input type="number" required className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                                       value={formData.amenity_id}
                                       onChange={(e) => setFormData({...formData, amenity_id: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Facility Name</label>
                                <input type="text" required placeholder="e.g. Swimming Pool" className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                                       value={formData.name}
                                       onChange={(e) => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Maximum Capacity</label>
                                <input type="number" min="1" required className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                                       value={formData.capacity}
                                       onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})} />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-3 mt-4 rounded-xl font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                                Deploy Facility
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}