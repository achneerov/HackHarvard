import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function RulesManagement() {
  const navigate = useNavigate();
  const [rules, setRules] = useState([
    { id: 1, priority: 1, ruleType: 'amount', minAmount: 10000, maxAmount: null, successStatus: 0, enabled: true },
    { id: 2, priority: 2, ruleType: 'amount', minAmount: 5000, maxAmount: 10000, successStatus: 2, enabled: true },
    { id: 3, priority: 3, ruleType: 'location', successStatus: 1, enabled: true },
  ]);
  const [editingRule, setEditingRule] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    ruleType: 'amount',
    rangeType: 'min', // min, max, or both
    minAmount: '',
    maxAmount: '',
    location: '',
    successStatus: 1,
    enabled: true
  });
  const [draggedIndex, setDraggedIndex] = useState(null);

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
    navigate('/');
  };

  const handleEdit = (rule) => {
    setEditingRule(rule.id);

    if (rule.ruleType === 'amount') {
      const hasMin = rule.minAmount !== null && rule.minAmount !== undefined;
      const hasMax = rule.maxAmount !== null && rule.maxAmount !== undefined;

      setFormData({
        ruleType: 'amount',
        rangeType: hasMin && hasMax ? 'both' : hasMin ? 'min' : 'max',
        minAmount: rule.minAmount || '',
        maxAmount: rule.maxAmount || '',
        location: '',
        successStatus: rule.successStatus,
        enabled: rule.enabled
      });
    } else {
      setFormData({
        ruleType: 'location',
        rangeType: 'min',
        minAmount: '',
        maxAmount: '',
        location: '',
        successStatus: rule.successStatus,
        enabled: rule.enabled
      });
    }
    setShowForm(true);
  };

  const handleDelete = (id) => {
    const updatedRules = rules
      .filter(rule => rule.id !== id)
      .map((rule, index) => ({ ...rule, priority: index + 1 }));
    setRules(updatedRules);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let newRuleData;
    if (formData.ruleType === 'amount') {
      newRuleData = {
        ruleType: 'amount',
        minAmount: formData.rangeType === 'min' || formData.rangeType === 'both' ? parseFloat(formData.minAmount) : null,
        maxAmount: formData.rangeType === 'max' || formData.rangeType === 'both' ? parseFloat(formData.maxAmount) : null,
        location: null,
        successStatus: formData.successStatus,
        enabled: formData.enabled
      };
    } else {
      newRuleData = {
        ruleType: 'location',
        minAmount: null,
        maxAmount: null,
        successStatus: formData.successStatus,
        enabled: formData.enabled
      };
    }

    if (editingRule) {
      setRules(rules.map(rule =>
        rule.id === editingRule
          ? { ...rule, ...newRuleData }
          : rule
      ));
    } else {
      const newRule = {
        id: Date.now(),
        priority: rules.length + 1,
        ...newRuleData
      };
      setRules([...rules, newRule]);
    }

    setFormData({ ruleType: 'amount', rangeType: 'min', minAmount: '', maxAmount: '', location: '', successStatus: 1, enabled: true });
    setEditingRule(null);
    setShowForm(false);
  };

  const toggleRule = (id) => {
    setRules(rules.map(rule => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule));
  };

  const handleCancel = () => {
    setFormData({ ruleType: 'amount', rangeType: 'min', minAmount: '', maxAmount: '', location: '', successStatus: 1, enabled: true });
    setEditingRule(null);
    setShowForm(false);
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newRules = [...rules];
    const draggedRule = newRules[draggedIndex];
    newRules.splice(draggedIndex, 1);
    newRules.splice(index, 0, draggedRule);

    const reorderedRules = newRules.map((rule, idx) => ({
      ...rule,
      priority: idx + 1
    }));

    setRules(reorderedRules);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Merchant Dashboard</h2>
          <div className="flex gap-2">
            <button onClick={() => navigate('/dashboard')} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Dashboard</button>
            <button onClick={() => navigate('/rules')} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">Rules</button>
            <button onClick={handleLogout} className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Transaction Rules</h1>
            <p className="text-gray-600">Rules are evaluated in priority order (drag to reorder)</p>
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
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Amount Range</label>
                    <div className="flex gap-4 mb-4">
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="rangeType"
                          value="min"
                          checked={formData.rangeType === 'min'}
                          onChange={(e) => setFormData({ ...formData, rangeType: e.target.value })}
                          className="peer sr-only"
                        />
                        <div className="px-4 py-3 border-2 border-gray-200 rounded-lg text-center text-sm transition-all peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700 font-medium">
                          Min only (≥)
                        </div>
                      </label>
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="rangeType"
                          value="max"
                          checked={formData.rangeType === 'max'}
                          onChange={(e) => setFormData({ ...formData, rangeType: e.target.value })}
                          className="peer sr-only"
                        />
                        <div className="px-4 py-3 border-2 border-gray-200 rounded-lg text-center text-sm transition-all peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700 font-medium">
                          Max only (≤)
                        </div>
                      </label>
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="rangeType"
                          value="both"
                          checked={formData.rangeType === 'both'}
                          onChange={(e) => setFormData({ ...formData, rangeType: e.target.value })}
                          className="peer sr-only"
                        />
                        <div className="px-4 py-3 border-2 border-gray-200 rounded-lg text-center text-sm transition-all peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700 font-medium">
                          Range (min-max)
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {(formData.rangeType === 'min' || formData.rangeType === 'both') && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Amount ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.minAmount}
                          onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                          placeholder="1000.00"
                          required
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-all focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    )}
                    {(formData.rangeType === 'max' || formData.rangeType === 'both') && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Maximum Amount ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.maxAmount}
                          onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                          placeholder="5000.00"
                          required
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base transition-all focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="px-6 py-5 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <h4 className="text-sm font-bold text-blue-900 mb-2">Country Mismatch Detection</h4>
                  <p className="text-sm text-blue-800">
                    This rule triggers when a user's purchase location does not match their registered home country.
                  </p>
                </div>
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
                  <option value={2}>Flag for Review</option>
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

        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-lg">No rules yet. Click "+ Add Rule" to create your first rule.</p>
            </div>
          ) : (
            rules.map((rule, index) => (
              <div
                key={rule.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`bg-white rounded-2xl p-6 shadow-xl border border-gray-100 transition-all cursor-move hover:shadow-2xl ${
                  !rule.enabled ? 'opacity-50' : ''
                } ${draggedIndex === index ? 'opacity-50 scale-95' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">#{rule.priority}</span>
                    </div>
                    <div>
                      <div className="mb-3">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {rule.ruleType === 'amount' ? 'Amount Rule' : 'Location Rule'}
                        </span>
                        <h3 className="text-lg font-bold text-gray-900 mt-1">
                          {rule.ruleType === 'amount' ? (
                            <>
                              {rule.minAmount !== null && rule.maxAmount !== null ? (
                                `Transactions between $${rule.minAmount.toLocaleString()} and $${rule.maxAmount.toLocaleString()}`
                              ) : rule.minAmount !== null ? (
                                `Transactions $${rule.minAmount.toLocaleString()} and above`
                              ) : (
                                `Transactions up to $${rule.maxAmount.toLocaleString()}`
                              )}
                            </>
                          ) : (
                            `Purchase location differs from home country`
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
                    <label className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => toggleRule(rule.id)}
                        className="opacity-0 w-0 h-0 peer"
                      />
                      <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-300 rounded-full transition-all peer-checked:bg-green-500 before:absolute before:content-[''] before:h-5 before:w-5 before:left-0.5 before:bottom-0.5 before:bg-white before:rounded-full before:transition-all peer-checked:before:translate-x-6"></span>
                    </label>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default RulesManagement;
