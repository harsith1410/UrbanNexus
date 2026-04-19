import { useState, useEffect } from 'react';
import { Search, UserPlus, X, Trash2, Edit } from 'lucide-react';
import api from '../api';

export default function ResidentDirectory() {
    const [residents, setResidents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '', house_block: '', house_floor: '', house_unit: '',
        ownership_status: '', contact: '', no_of_members: 1
    });

    const fetchResidents = async () => {
        try {
            const res = await api.get(`/admin/residents/search?name=${searchTerm}`);
            setResidents(res.data.residents);
        } catch (err) { console.error("Resident lookup failed"); }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/residents', formData);
            setShowModal(false);
            fetchResidents();
        } catch (err) { alert("Failed to add resident"); }
    };

    const handleDelete = async (id, name) => {
        if (window.confirm(`Remove ${name} from the grid?`)) {
            try {
                await api.delete(`/residents/${id}`);
                fetchResidents();
            } catch (err) { alert("Delete failed"); }
        }
    };

    useEffect(() => { fetchResidents(); }, [searchTerm]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-gray-800 italic uppercase">Resident Directory</h2>
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search Residents..." className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                           onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2">
                    <UserPlus className="w-4 h-4" /> <span>Sign New Resident</span>
                </button>
            </div>

            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400">
                <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Unit</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {residents.map(res => (
                    <tr key={res.resident_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-bold">{res.name}</td>
                        <td className="px-6 py-4 font-mono">{res.house_block}-{res.house_unit}</td>
                        <td className="px-6 py-4 text-[10px] font-bold uppercase"><span className="px-2 py-0.5 bg-green-50 text-green-600 rounded">{res.ownership_status}</span></td>
                        <td className="px-6 py-4 font-mono text-gray-500">{res.contact}</td>
                        <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDelete(res.resident_id, res.name)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-8 relative">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400"><X /></button>
                        <h3 className="text-xl font-bold mb-6 italic uppercase">Register New Resident</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <input type="text" placeholder="Full Name" required className="w-full p-2 border rounded-lg" onChange={e => setFormData({...formData, name: e.target.value})} />
                            <div className="grid grid-cols-3 gap-2">
                                <input type="text" placeholder="Block" className="p-2 border rounded-lg" onChange={e => setFormData({...formData, house_block: e.target.value})} />
                                <input type="text" placeholder="Floor" className="p-2 border rounded-lg" onChange={e => setFormData({...formData, house_floor: e.target.value})} />
                                <input type="text" placeholder="Unit" className="p-2 border rounded-lg" onChange={e => setFormData({...formData, house_unit: e.target.value})} />
                            </div>
                            <input type="text" placeholder="Contact Number" className="w-full p-2 border rounded-lg" onChange={e => setFormData({...formData, contact: e.target.value})} />

                            <select className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                    onChange={(e) => setFormData({...formData, ownership_status: e.target.value})}>
                                <option value="Owner">Owner</option>
                                <option value="Tenant">Tenant</option>
                            </select>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest">Number of Members (1-10)</label>
                                <input type="number" min="1" max="10" required className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                       onChange={(e) => setFormData({...formData, no_of_members: parseInt(e.target.value)})} />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold uppercase">Add to Grid</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}