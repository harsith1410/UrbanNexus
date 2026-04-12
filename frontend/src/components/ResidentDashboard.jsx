import { CreditCard, Calendar, Wrench } from 'lucide-react';

export default function ResidentDashboard() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Resident Portal</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
                    <CreditCard className="w-8 h-8 text-blue-600 mb-4" />
                    <h3 className="text-lg font-bold">My Dues</h3>
                    <p className="text-gray-500 text-sm">View and pay pending maintenance and amenity bills.</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
                    <Calendar className="w-8 h-8 text-green-600 mb-4" />
                    <h3 className="text-lg font-bold">Book Amenity</h3>
                    <p className="text-gray-500 text-sm">Reserve the clubhouse, tennis courts, and more.</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
                    <Wrench className="w-8 h-8 text-orange-600 mb-4" />
                    <h3 className="text-lg font-bold">Request Service</h3>
                    <p className="text-gray-500 text-sm">Book a plumber, electrician, or maintenance tech.</p>
                </div>
            </div>
        </div>
    );
}