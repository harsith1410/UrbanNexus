import { useState, useEffect } from 'react';
import { Search, RefreshCw, CreditCard } from 'lucide-react';
import api from '../api';

export default function FinancialManager() {
    const [transactions, setTransactions] = useState([]);
    const [search, setSearch] = useState('');

    const fetchTransactions = async () => {
        try {
            const res = await api.get(`/admin/transactions?resident_name=${search}`);
            setTransactions(res.data.transactions);
        } catch (err) { console.error("Ledger sync failed"); }
    };

    const processPayment = async (transNo) => {
        try {
            await api.post(`/payments/${transNo}/pay`);
            fetchTransactions();
        } catch (err) { alert(err.response?.data?.error || "Processing failed"); }
    };

    const runOverdueScan = async () => {
        try {
            await api.post('/admin/process-overdue');
            alert("Overdue cursor executed. Ledger updated.");
            fetchTransactions();
        } catch (err) { alert("Scan failed"); }
    };

    useEffect(() => { fetchTransactions(); }, [search]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search by Resident Name..." className="w-full pl-10 pr-4 py-2 border rounded-lg" onChange={e => setSearch(e.target.value)} />
                </div>
                <button onClick={runOverdueScan} className="flex items-center space-x-2 bg-orange-100 text-orange-600 px-4 py-2 rounded-lg text-xs font-bold uppercase italic">
                    <RefreshCw className="w-3 h-3" /> <span>Run Overdue Scan</span>
                </button>
            </div>

            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400">
                <tr><th className="px-6 py-4">TXN #</th><th className="px-6 py-4">Driver</th><th className="px-6 py-4">Amount</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {transactions.map(tx => (
                    <tr key={tx.trans_no}>
                        <td className="px-6 py-4 font-mono">{tx.trans_no}</td>
                        <td className="px-6 py-4 font-bold">{tx.resident_name} <span className="text-[10px] text-gray-400">({tx.house_block}-{tx.house_unit})</span></td>
                        <td className="px-6 py-4 font-bold text-blue-600">₹{tx.cost}</td>
                        <td className="px-6 py-4 text-[10px] font-bold uppercase"><span className={`px-2 py-0.5 rounded ${tx.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{tx.status}</span></td>
                        <td className="px-6 py-4 text-right">
                            {tx.status !== 'Paid' && <button onClick={() => processPayment(tx.trans_no)} className="text-blue-600 hover:underline font-bold text-[10px] uppercase tracking-tighter">Process Pay</button>}
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}