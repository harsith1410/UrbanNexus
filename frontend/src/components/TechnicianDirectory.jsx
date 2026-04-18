import { useState, useEffect } from 'react';
import { Wrench, UserPlus, Phone, X, Loader2, Trash2, Edit } from 'lucide-react';
import api from '../api';

export default function TechnicianDirectory() {
    const [techs, setTechs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ tech_id: '', name: '', contact: '', skill: 'Plumber' });

    const fetchTechs = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/technicians');
            setTechs(res.data);
        } catch (err) { console.error("Staff lookup failed"); }
        finally { setLoading(false); }
    };

    const handleAddTech = async (e) => {
        e.preventDefault();
        try {
            await api.post('/technicians', formData);
            setShowModal(false);
            setFormData({ tech_id: '', name: '', contact: '', skill: 'Plumber' });
            fetchTechs();
        } catch (err) { alert("Failed to sign crew: " + err.response?.data?.error); }
    };

    useEffect(() => { fetchTechs(); }, []);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-tighter italic">Technical Crew</h2>
                <button onClick={() => setShowModal(true)} className="flex items-center space-x-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold">
                    <UserPlus className="w-4 h-4" />
                    <span>Recruit Crew</span>
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400">
                    <tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Name</th><th className="px-6 py-4">Skill</th><th className="px-6 py-4">Contact</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                    {loading ? <tr><td colSpan="4" className="text-center py-8 italic text-gray-400">Scanning crew database...</td></tr> :
                        techs.map(tech => (
                            <tr key={tech.tech_id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-mono">{tech.tech_id}</td>
                                <td className="px-6 py-4 font-bold">{tech.name}</td>
                                <td className="px-6 py-4"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold text-[10px]">{tech.skill}</span></td>
                                <td className="px-6 py-4 font-mono text-gray-500">{tech.contact}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal - Matches Screenshot image_caca54.png */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-8 relative">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X /></button>
                        <h3 className="text-xl font-bold mb-6 italic uppercase tracking-tighter">Sign New Pit Crew</h3>
                        <form onSubmit={handleAddTech} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Tech ID (e.g. 101)</label>
                                <input type="text" required className="w-full p-2 border rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                                       onChange={(e) => setFormData({...formData, tech_id: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Full Name</label>
                                <input type="text" required className="w-full p-2 border rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                                       onChange={(e) => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Contact</label>
                                <input type="text" required className="w-full p-2 border rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                                       onChange={(e) => setFormData({...formData, contact: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Skill</label>
                                <select className="w-full p-2 border rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                                        onChange={(e) => setFormData({...formData, skill: e.target.value})}>
                                    <option value="Plumber">Plumber</option>
                                    <option value="Electrician">Electrician</option>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Carpenter">Carpenter</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold uppercase hover:bg-blue-700 transition-colors">Deploy to Grid</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}