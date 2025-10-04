import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function RulesManagement() {
  const navigate = useNavigate();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    ruleType: 'amount',
    condition: 'LESS_THAN',
    amount: '',
    location: '',
    successStatus: 1
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    const merchantApiKey = localStorage.getItem('merchantApiKey');

    if (!merchantApiKey) {
      navigate('/');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/rules?merchantApiKey=${merchantApiKey}`);
      const data = await response.json();

      if (data.status === 1) {
        setRules(data.data);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusLabels = {
    0: 'Decline',
    1: 'Approve',
    2: 'Flag for Review'
  };

  const statusColors = {
    0: 'bg-red-100 text-red-800',
    1: 'bg-green-100 text-green-800',
    2: 'bg-yellow-100 text-yellow-800'
  };

  const handleLogout = () => {
    localStorage.removeItem('merchantAuth');
    localStorage.removeItem('merchantApiKey');
    localStorage.removeItem('merchantEmail');
    navigate('/');
  };

  const handleEdit = (rule) => {
    setEditingRule(rule.ruleId);

    const ruleType = rule.amount !== null ? 'amount' : 'location';

    setFormData({
      ruleType,
      condition: rule.condition || 'LESS_THAN',
      amount: rule.amount || '',
      location: rule.location || '',
      successStatus: rule.successStatus
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const merchantApiKey = localStorage.getItem('merchantApiKey');

    try {
      const response = await fetch(`http://localhost:3001/api/rules/${id}?merchantApiKey=${merchantApiKey}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.status === 1) {
        fetchRules();
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const merchantApiKey = localStorage.getItem('merchantApiKey');

    const ruleData = {
      merchantApiKey,
      priority: editingRule ? rules.find(r => r.ruleId === editingRule)?.priority : (rules.length > 0 ? Math.max(...rules.map(r => r.priority)) + 1 : 1),
      amount: formData.ruleType === 'amount' ? parseFloat(formData.amount) : null,
      location: formData.ruleType === 'location' ? formData.location : null,
      timeStart: null,
      timeEnd: null,
      condition: formData.condition,
      successStatus: formData.successStatus
    };

    try {
      const url = editingRule
        ? `http://localhost:3001/api/rules/${editingRule}`
        : 'http://localhost:3001/api/rules';

      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });

      const data = await response.json();

      if (data.status === 1) {
        fetchRules();
        setFormData({ ruleType: 'amount', condition: 'LESS_THAN', amount: '', location: '', successStatus: 1 });
        setEditingRule(null);
        setShowForm(false);
      }
    } catch (error) {
      console.error('Error saving rule:', error);
    }
  };

  const handleCancel = () => {
    setFormData({ ruleType: 'amount', condition: 'LESS_THAN', amount: '', location: '', successStatus: 1 });
    setEditingRule(null);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Merchant Dashboard</h2>
          <div className="flex gap-2">
            <button onClick={() => navigate('/dashboard')} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Dashboard</button>
            <button onClick={() => navigate('/rules')} className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">Rules</button>
            <button onClick={handleLogout} className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 hover:shadow-lg transition-all">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Transaction Rules</h1>
            <p className="text-gray-600">Rules are evaluated in priority order</p>
          </div>
          <button
            onClick={() => showForm ? handleCancel() : setShowForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {showForm ? 'Cancel' : '+ Add Rule'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl p-8 mb-6 shadow-xl border border-gray-100">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">{editingRule ? 'Edit Rule' : 'Create New Rule'}</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Rule Type</label>
                <div className="flex gap-4">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="ruleType"
                      value="amount"
                      checked={formData.ruleType === 'amount'}
                      onChange={(e) => setFormData({ ...formData, ruleType: e.target.value })}
                      className="peer sr-only"
                    />
                    <div className="px-6 py-4 border-2 border-gray-200 rounded-lg text-center transition-all peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700 font-semibold">
                      Transaction Amount
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="ruleType"
                      value="location"
                      checked={formData.ruleType === 'location'}
                      onChange={(e) => setFormData({ ...formData, ruleType: e.target.value })}
                      className="peer sr-only"
                    />
                    <div className="px-6 py-4 border-2 border-gray-200 rounded-lg text-center transition-all peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700 font-semibold">
                      Transaction Location
                    </div>
                  </label>
                </div>
              </div>

              {formData.ruleType === 'amount' ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Condition</label>
                    <select
                      value={formData.condition}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-all focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="LESS_THAN">Less than</option>
                      <option value="GREATER">Greater than</option>
                      <option value="EQUAL">Equal to</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="1000.00"
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-all focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Location Value</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="HOME_LOCATION or specific location"
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-all focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Condition</label>
                    <select
                      value={formData.condition}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-all focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="IS">Is (matches)</option>
                      <option value="NOT">Not (doesn't match)</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Action</label>
                <select
                  value={formData.successStatus}
                  onChange={(e) => setFormData({ ...formData, successStatus: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-all focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value={1}>Approve Transaction</option>
                  <option value={0}>Decline Transaction</option>
                  <option value={2}>Require MFA</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Loading rules...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
                <p className="text-gray-500 text-lg">No rules yet. Click "+ Add Rule" to create your first rule.</p>
              </div>
            ) : (
              rules.map((rule) => {
                const ruleType = rule.amount !== null ? 'amount' : 'location';
                const conditionText = {
                  'LESS_THAN': 'less than',
                  'GREATER': 'greater than',
                  'EQUAL': 'equal to',
                  'IS': 'is',
                  'NOT': 'not'
                };

                return (
                  <div
                    key={rule.ruleId}
                    className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 transition-all hover:shadow-2xl"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">#{rule.priority}</span>
                        </div>
                        <div>
                          <div className="mb-3">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {ruleType === 'amount' ? 'Amount Rule' : 'Location Rule'}
                            </span>
                            <h3 className="text-lg font-bold text-gray-900 mt-1">
                              {ruleType === 'amount' ? (
                                `Amount ${conditionText[rule.condition]} $${rule.amount.toLocaleString()}`
                              ) : (
                                `Location ${conditionText[rule.condition]} ${rule.location}`
                              )}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Action:</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[rule.successStatus]}`}>
                              {statusLabels[rule.successStatus]}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(rule.ruleId)}
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RulesManagement;
