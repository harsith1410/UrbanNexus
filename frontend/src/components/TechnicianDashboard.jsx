import { useState, useEffect } from 'react';
import { Wrench, MapPin, CheckCircle2, Settings, Loader2 } from 'lucide-react';
import api from '../api';

export default function TechnicianDashboard() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTasks = async () => {
        try {
            const res = await api.get('/technician/me/tasks');
            setTasks(res.data);
        } catch (err) { console.error("Task sync failed"); }
        finally { setLoading(false); }
    };

    const updateStatus = async (id, status) => {
        try {
            await api.put(`/technician/tasks/${id}/status`, { status });
            fetchTasks();
        } catch (err) { alert("Status update failed"); }
    };

    useEffect(() => { fetchTasks(); }, []);

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold italic uppercase tracking-tighter border-b border-gray-200 pb-4">Task Assignment Sheet</h1>
            <div className="grid gap-4">
                {loading ? <Loader2 className="animate-spin text-blue-600 mx-auto" /> :
                    tasks.map(task => (
                        <div key={task.assignment_id} className="bg-white p-6 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Unit {task.house_block}-{task.house_unit}</span>
                                <h3 className="text-lg font-bold">{task.resident_name}</h3>
                                <p className="text-xs text-gray-500 flex items-center"><MapPin className="w-3 h-3 mr-1" /> Slot {task.slot}</p>
                            </div>
                            <div>
                                {task.status !== 'Resolved' ? (
                                    <button onClick={() => updateStatus(task.assignment_id, 'Resolved')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-green-700">
                                        Mark Resolved
                                    </button>
                                ) : (
                                    <div className="text-green-600 font-bold text-xs uppercase flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Resolved</div>
                                )}
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
}