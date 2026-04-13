import { useState } from 'react';
import { Users, Wrench, CreditCard } from 'lucide-react';
import ResidentDirectory from './ResidentDirectory';
import TechnicianDirectory from './TechnicianDirectory';
import FinancialManager from './FinancialManager';
import AuditLog from './AuditLog';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('residents');

    const tabs = [
        { id: 'residents', label: 'Grid (Residents)', icon: Users },
        { id: 'technicians', label: 'Pit Crew', icon: Wrench },
        { id: 'financials', label: 'Financials', icon: CreditCard },
    ];

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 italic uppercase tracking-tighter">PIT WALL: COMMAND CENTER</h1>
                <p className="text-gray-500 text-sm">Managing community operations and real-time forensic logs.</p>
            </header>

            <nav className="flex space-x-4 border-b border-gray-100">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2 px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${
                            activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3">
                    {activeTab === 'residents' && <ResidentDirectory />}
                    {activeTab === 'technicians' && <TechnicianDirectory />}
                    {activeTab === 'financials' && <FinancialManager />}
                </div>
                <div className="lg:col-span-1">
                    <AuditLog />
                </div>
            </div>
        </div>
    );
}