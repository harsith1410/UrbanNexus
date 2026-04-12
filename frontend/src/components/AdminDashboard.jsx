import { Users, FileText, Wrench, Activity } from 'lucide-react';

export default function AdminDashboard() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">SuperAdmin Control Panel</h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Placeholder Cards for the features we will connect soon */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Activity /></div>
                    <div><p className="text-sm text-gray-500">System Health</p><p className="text-xl font-bold">Online</p></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="p-3 bg-green-100 text-green-600 rounded-lg"><Users /></div>
                    <div><p className="text-sm text-gray-500">Residents</p><p className="text-xl font-bold">Manage</p></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Wrench /></div>
                    <div><p className="text-sm text-gray-500">Work Orders</p><p className="text-xl font-bold">Dispatch</p></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="p-3 bg-red-100 text-red-600 rounded-lg"><FileText /></div>
                    <div><p className="text-sm text-gray-500">Audit Logs</p><p className="text-xl font-bold">Review</p></div>
                </div>
            </div>
        </div>
    );
}