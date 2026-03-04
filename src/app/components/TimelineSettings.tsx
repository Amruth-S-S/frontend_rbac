"use client";
import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertTriangle, Plus, Trash2, Edit, Check, X, ChevronDown } from 'lucide-react';

interface TimelineSettingsData {
  id?: string | number; // Optional for new items, can be string or number
  name: string;
  financial_year: string;
  result_type: string;
  reporting_period: string;
  description: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

const TimelineSettingsForm = ({ boardId }: { boardId: string | number }) => {
  const [settingsList, setSettingsList] = useState<TimelineSettingsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set()); // Track items with unsaved changes
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
    duration?: number;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({ show: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { } });
  const [confirmDelete, setConfirmDelete] = useState<{
    show: boolean;
    id: string | number | undefined;
  }>({ show: false, id: undefined });

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL; 
    
    const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''; 

  // Dropdown options
  const resultTypeOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  const reportingPeriodOptions = [
    { value: 'calendar_year', label: 'Calendar year' },
    { value: 'financial_year', label: 'Financial year' },
    { value: 'custom', label: 'Custom' },

  ];

  // Fetch all timeline settings
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/timeline-settings/?include_inactive=false&active_only=false`,
        {
          headers: {
           "X-API-Key": EXCEL_API_KEY
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Ensure all fields have default values to prevent null/undefined
        const sanitizedData = (Array.isArray(data) ? data : [data]).map(item => ({
          id: item.id || '',
          name: item.name || '',
          financial_year: item.financial_year || '',
          result_type: item.result_type || '',
          reporting_period: item.reporting_period || '',
          description: item.description || '',
          is_active: item.is_active || false,
          created_at: item.created_at,
          updated_at: item.updated_at
        }));
        setSettingsList(sanitizedData);
      } else {
        setSettingsList([]);
        showToast('Failed to load timeline settings', 'error');
      }
    } catch (error) {
      console.error('Error fetching timeline settings:', error);
      showToast('An error occurred while loading settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (id: string | number | undefined, field: string, value: string) => {
    const idStr = id?.toString();
    if (!idStr) return;
    setEditingId(idStr);
    setEditingField(field);
    setEditValue(value || '');
  };

  const handleEditSave = async (id: string | number | undefined, field: keyof TimelineSettingsData) => {
    if (!id) return;

    try {
      // Update local state immediately
      const updatedList = settingsList.map(item =>
        item.id?.toString() === id.toString() ? { ...item, [field]: editValue } : item
      );

      setSettingsList(updatedList);

      // Mark this item as having unsaved changes (unless it's a new item)
      const idStr = id.toString();
      if (!isNewItem(id)) {
        setUnsavedChanges(prev => new Set([...prev, idStr]));
      }

    } catch (error) {
      console.error('Error saving edit:', error);
      showToast('Failed to save changes', 'error');
    } finally {
      setEditingId(null);
      setEditingField(null);
      setEditValue('');
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue('');
  };

  const handleSaveToAPI = async (id: string | number | undefined) => {
    if (!id) return;

    setSaving(true);
    const settingToUpdate = settingsList.find(item => item.id?.toString() === id.toString());

    if (!settingToUpdate) {
      showToast('Setting not found', 'error');
      setSaving(false);
      return;
    }

    try {
      const isNew = isNewItem(id);
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew
        ? `${API_BASE_URL}/main-boards/boards/timeline-settings/`
        : `${API_BASE_URL}/main-boards/boards/timeline-settings/${id}`;

      // Clean payload - ensure no empty strings for required fields
      const payload = {
        name: settingToUpdate.name || '',
        financial_year: settingToUpdate.financial_year || '',
        result_type: settingToUpdate.result_type || '',
        reporting_period: settingToUpdate.reporting_period || '',
        description: settingToUpdate.description || '',
        is_default: false
      };

      console.log('Saving to API:', { method, url, payload }); // Debug log

      const response = await fetch(url, {
        method,
        headers: {
          "X-API-Key": EXCEL_API_KEY,
          'Content-Type': 'application/json'
        }
        ,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('API Response:', responseData); // Debug log

        if (isNew) {
          // Update the list with the permanent ID from server
          setSettingsList(prev =>
            prev.map(item =>
              item.id?.toString() === id.toString() ? { ...responseData } : item
            )
          );
        } else {
          // For existing items, update with the response data
          setSettingsList(prev =>
            prev.map(item =>
              item.id?.toString() === id.toString() ? { ...item, ...responseData } : item
            )
          );
        }

        // Remove from unsaved changes
        setUnsavedChanges(prev => {
          const newSet = new Set(prev);
          newSet.delete(id.toString());
          return newSet;
        });

        showToast(`Settings ${isNew ? 'created' : 'updated'} successfully!`, 'success');

        // Clear editing state
        setEditingId(null);
        setEditingField(null);
        setEditValue('');

      } else {
        // Better error handling for 422 and other HTTP errors
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = await response.json();
          console.error('API Error:', errorData); // Debug log

          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              // Handle validation errors array
              errorMessage = errorData.detail.map((err: any) => {
                if (typeof err === 'object' && err.msg && err.loc) {
                  return `${err.loc.join('.')}: ${err.msg}`;
                }
                return JSON.stringify(err);
              }).join(', ');
            } else if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else {
              errorMessage = JSON.stringify(errorData.detail);
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `HTTP ${response.status}: Could not parse error response`;
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error saving timeline settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = () => {
    const newSetting: TimelineSettingsData = {
      id: `new-${Date.now()}`, // Temporary ID for new items
      name: '',
      financial_year: '',
      result_type: '',
      reporting_period: '',
      description: '',
      is_active: true
    };

    setSettingsList(prev => [...prev, newSetting]);
    // Set editing mode for the name field by default
    setEditingId(newSetting.id?.toString() ?? null);
    setEditingField('name');
    setEditValue('');
  };

  const handleDeleteClick = (id: string | number | undefined) => {
    if (!id) return;

    // Find the item to be deleted (assuming you have access to the data)
    const itemToDelete = settingsList.find(item => item.id === id); // Use settingsList as the data source
    if (!itemToDelete) return;

    setConfirmDelete({ show: true, id });

    // Show confirmation dialog instead of toast
    setConfirmDialog({
      show: true,
      title: 'Delete Timeline Setting',
      message: 'Are you sure you want to delete this timeline setting? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await handleDeleteConfirmed(id);
          showToast('Timeline setting deleted successfully!', 'success');
        } catch (error) {
          showToast('Error deleting timeline setting', 'error');
        } finally {
          setConfirmDelete({ show: false, id: undefined });
        }
      },
      onCancel: () => {
        setConfirmDelete({ show: false, id: undefined });
      }
    });
  };
  const handleDeleteConfirmed = async (id: string | number | undefined) => {
    if (!id) return;
    setConfirmDelete({ show: false, id: undefined });

    const idStr = id.toString();

    if (isNewItem(id)) {
      setSettingsList(prev => prev.filter(item => item.id?.toString() !== idStr));
      showToast('Draft timeline setting removed', 'success');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/timeline-settings/${idStr}?permanent=false`,
        {
          method: 'DELETE',
          headers: {
           "X-API-Key": EXCEL_API_KEY
        }
      }
      );

      if (response.ok) {
        showToast('Timeline setting deleted successfully!', 'success');
        fetchSettings();
      } else {
        const errorData = await response.json();
        showToast(`Failed to delete: ${errorData.detail || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting timeline setting:', error);
      showToast('An error occurred while deleting', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Update your showToast function to support actions
  const showToast = (
    message: string,
    type: 'success' | 'error' | 'warning' = 'success',
    duration = 4000,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    setToast({
      show: true,
      message,
      type,
      duration,
      onConfirm,
      onCancel
    });

    // Auto-hide non-warning toasts
    if (type !== 'warning') {
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, duration);
    }
  };

  const renderDropdown = (
    item: TimelineSettingsData,
    field: keyof TimelineSettingsData,
    options: { value: string; label: string }[]
  ) => {
    const isEditing = editingId === item.id?.toString() && editingField === field;
    const value = item[field] as string;

    if (isEditing) {
      return (
        <div className="relative">
          <select
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleEditSave(item.id, field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleEditSave(item.id, field);
              } else if (e.key === 'Escape') {
                handleEditCancel();
              }
            }}
            className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:border-blue-600 bg-white"
            autoFocus
          >
            {/* <option value="">Select...</option> */}
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-6 top-1 flex space-x-1">
            <button
              onClick={() => handleEditSave(item.id, field)}
              className="text-green-600 hover:text-green-800"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={handleEditCancel}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }

    const selectedOption = options.find(opt => opt.value === value);
    const displayValue = selectedOption ? selectedOption.label : value;

    return (
      <div
        onClick={() => handleEditStart(item.id, field, value)}
        className="w-full px-2 py-2 min-h-[36px] cursor-text hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded transition-colors duration-150 flex items-center justify-between"
      >
        <span className={`${!displayValue ? 'text-gray-400' : 'text-gray-900'}`}>
          {displayValue || 'Click to select...'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </div>
    );
  };

  const renderEditableCell = (
    item: TimelineSettingsData,
    field: keyof TimelineSettingsData,
    label: string,
    type: string = 'text'
  ) => {
    const isEditing = editingId === item.id?.toString() && editingField === field;
    const value = item[field] as string;

    if (isEditing) {
      return (
        <div className="relative">
          <input
            type={type}
            value={editValue || ''} // Ensure value is never null/undefined
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleEditSave(item.id, field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleEditSave(item.id, field);
              } else if (e.key === 'Escape') {
                handleEditCancel();
              }
            }}
            className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:border-blue-600"
            autoFocus
          />
          <div className="absolute right-1 top-1 flex space-x-1">
            <button
              onClick={() => handleEditSave(item.id, field)}
              className="text-green-600 hover:text-green-800"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={handleEditCancel}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={() => handleEditStart(item.id, field, value)}
        className="w-full px-2 py-2 min-h-[36px] cursor-text hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded transition-colors duration-150 flex items-center"
      >
        <span className={`${!value ? 'text-gray-400' : 'text-gray-900'}`}>
          {value || 'Click to edit...'}
        </span>
      </div>
    );
  };

  // Check if any row is being edited (has unsaved changes)
  const hasUnsavedChanges = (itemId: string | number | undefined) => {
    if (!itemId) return false;
    const idStr = itemId.toString();
    return editingId === idStr || unsavedChanges.has(idStr);
  };

  // Check if an item is new (has temporary ID)
  const isNewItem = (itemId: string | number | undefined) => {
    return itemId?.toString().startsWith('new-') || false;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Timeline Settings</h2>
          </div>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add row</span>
          </button>
        </div>

        <div className="p-6">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                    Financial Year
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                    Result Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                    Reporting Period
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                    Description
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                    Status
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {settingsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500 text-sm">
                      {loading ? 'Loading...' : 'No timeline settings found'}
                    </td>
                  </tr>
                ) : (
                  settingsList.map((item) => (
                    <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 ${hasUnsavedChanges(item.id) ? 'bg-yellow-50' : ''}`}>
                      <td className="px-3 py-2 border-r border-gray-100">
                        {renderEditableCell(item, 'name', 'Name')}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-100">
                        {renderEditableCell(item, 'financial_year', 'Financial Year')}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-100">
                        {renderDropdown(item, 'result_type', resultTypeOptions)}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-100">
                        {renderDropdown(item, 'reporting_period', reportingPeriodOptions)}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-100">
                        {renderEditableCell(item, 'description', 'Description')}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-100">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center space-x-2">
                          {isNewItem(item.id) || hasUnsavedChanges(item.id) ? (
                            <button
                              onClick={() => handleSaveToAPI(item.id)}
                              disabled={saving}
                              className="px-3 py-1 rounded-md flex items-center space-x-1 text-sm disabled:opacity-50"
                              title="Save"
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 text-green-500" />
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(item.id?.toString() || null);
                                setEditingField('name');
                                setEditValue(item.name);
                              }}
                              className="px-3 py-1 text-blue rounded-md flex items-center space-x-1 text-sm disabled:opacity-50"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4 text-blue-500" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(item.id)}
                            disabled={saving}
                            className="px-3 py-1 text-red rounded-md flex items-center space-x-1 text-sm disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">{confirmDialog.title}</h3>
            <p className="mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  confirmDialog.onCancel();
                  setConfirmDialog(prev => ({ ...prev, show: false }));
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, show: false }));
                }}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}


      {toast.show && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg 
        ${toast.type === 'success' ? 'bg-green-500' :
            toast.type === 'error' ? 'bg-red-500' :
              'bg-yellow-500'} text-white`}>
          {toast.message}
        </div>
      )}

    </div>
  );
};

export default TimelineSettingsForm;