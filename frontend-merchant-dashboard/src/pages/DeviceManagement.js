import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function DeviceManagement() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, trusted, untrusted
  const [searchTerm, setSearchTerm] = useState('');

  const merchantApiKey = localStorage.getItem('merchantApiKey');

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/devices?merchantApiKey=${merchantApiKey}`
      );
      const data = await response.json();
      if (data.status === 1 || data.status === 'SUCCESS') {
        setDevices(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrustToggle = async (sessionId, currentTrust) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/devices/${sessionId}/trust`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantApiKey,
            trusted: !currentTrust,
          }),
        }
      );
      const data = await response.json();
      if (data.status === 1 || data.status === 'SUCCESS') {
        fetchDevices(); // Refresh list
      }
    } catch (error) {
      console.error('Failed to update device trust:', error);
    }
  };

  const handleDeleteDevice = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this device session?')) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/devices/${sessionId}?merchantApiKey=${merchantApiKey}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (data.status === 1 || data.status === 'SUCCESS') {
        fetchDevices(); // Refresh list
      }
    } catch (error) {
      console.error('Failed to delete device:', error);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('merchantAuth');
    localStorage.removeItem('merchantApiKey');
    navigate('/');
  };

  const filteredDevices = devices.filter((device) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'trusted' && device.trusted === 1) ||
      (filter === 'untrusted' && device.trusted === 0);

    const matchesSearch =
      !searchTerm ||
      device.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.platform?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.userId?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getDeviceIcon = (platform) => {
    if (!platform) {
      return (
        <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    }
    const lower = platform.toLowerCase();

    // Mobile phone
    if (lower.includes('iphone') || lower.includes('android')) {
      return (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }

    // Tablet
    if (lower.includes('ipad') || lower.includes('tablet')) {
      return (
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }

    // Desktop/Laptop
    if (lower.includes('mac') || lower.includes('win') || lower.includes('linux')) {
      return (
        <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    }

    // Default desktop
    return (
      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  };

  const stats = {
    total: devices.length,
    trusted: devices.filter((d) => d.trusted === 1).length,
    untrusted: devices.filter((d) => d.trusted === 0).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Merchant Dashboard</h2>
          <div className="flex gap-2">
            <button onClick={() => navigate('/dashboard')} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Dashboard</button>
            <button onClick={() => navigate('/rules')} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Rules</button>
            <button onClick={() => navigate('/devices')} className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">Devices</button>
            <button onClick={handleSignOut} className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 hover:shadow-lg transition-all">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Device Management</h1>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by email, platform, or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Device List */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User / Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Browser ID (User Agent)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    No devices found
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => (
                  <tr key={device.sessionId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="mr-3 flex-shrink-0">
                          {getDeviceIcon(device.platform)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">
                            {device.userId}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {device.deviceFingerprint}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {device.platform || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {device.screenResolution}
                      </div>
                      <div className="text-xs text-gray-400">
                        {device.timezone}
                      </div>
                      {device.language && (
                        <div className="text-xs text-gray-400 mt-1">
                          <span className={`px-1.5 py-0.5 rounded ${
                            device.language.includes('ru') || device.language.includes('zh') || device.language.includes('ar')
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {device.language}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-2xl truncate">
                        {device.userAgent || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteDevice(device.sessionId)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DeviceManagement;
