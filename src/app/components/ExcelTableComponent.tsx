"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Check, X, Save, Loader2, Edit, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface ExcelFieldData {
    id: number;
    fieldName: string;
    fieldDescription: string;
    fieldType: string;
    fieldLength: string;
    fieldValue: string;
    apiId?: any;
    originalFieldName?: string; // Track original field name for updates
}

interface TableData {
    id: string;
    table_name: string;
    description: string;
    created_at?: string;
    updated_at?: string;
}

interface NewTableData {
    table_name: string;
    description: string;
}

interface ExcelTableComponentProps {
    boardId?: string | null;
}

const ExcelTableComponent = ({ boardId }: ExcelTableComponentProps) => {
    const [tables, setTables] = useState<TableData[]>([]);
    const [showTableModal, setShowTableModal] = useState(false);
    const [newTable, setNewTable] = useState<NewTableData>({ table_name: '', description: '' });
    const [expandedTable, setExpandedTable] = useState<string | null>(null);
    const [editingTableId, setEditingTableId] = useState<string | null>(null);
    const [editTableData, setEditTableData] = useState<NewTableData>({ table_name: '', description: '' });
    const [selectedTableForFields, setSelectedTableForFields] = useState<string | null>(null);
    const [tablesLoading, setTablesLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [updating, setUpdating] = useState(false);

    const [currentFieldsPage, setCurrentFieldsPage] = useState(1);
    const [fieldsPerPage] = useState(5); // Set to 5 items per page
    const [searchTerm, setSearchTerm] = useState('');

    const [excelData, setExcelData] = useState<ExcelFieldData[]>([]);

    // Filter and paginate
    const filteredTables = tables.filter(table =>
        table.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (table.description && table.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const indexOfLastField = currentFieldsPage * fieldsPerPage;
    const indexOfFirstField = indexOfLastField - fieldsPerPage;
    const currentFields = excelData.slice(indexOfFirstField, indexOfLastField);
    // Calculate total number of pages for fields
    const totalFieldsPages = Math.ceil(excelData.length / fieldsPerPage);
    // Change page function
    const paginateFields = (pageNumber: React.SetStateAction<number>) => {
        setCurrentFieldsPage(pageNumber);
    };

    const [toast, setToast] = useState<{
        show: boolean;
        message: string;
        type: 'success' | 'error' | 'warning';
    }>({ show: false, message: '', type: 'success' });

    const [confirmDialog, setConfirmDialog] = useState<{
        show: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        onCancel: () => void;
    }>({ show: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { } });

    const [editingExcelCell, setEditingExcelCell] = useState<string | null>(null);
    const [editExcelValue, setEditExcelValue] = useState<string>('');
    const [selectedExcelRows, setSelectedExcelRows] = useState<Set<number>>(new Set());
    const [savingExcel, setSavingExcel] = useState<boolean>(false);
    const [savedExcelRows, setSavedExcelRows] = useState<Set<number>>(new Set());
    const [modifiedExcelRows, setModifiedExcelRows] = useState<Set<number>>(new Set());
    const [loadingFields, setLoadingFields] = useState<boolean>(false);
    const [expandedListFields, setExpandedListFields] = useState<Set<number>>(new Set());
    const [listValues, setListValues] = useState<{ [fieldId: number]: string[] }>({});
    const excelInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

    const excelFieldTypes = ['char', 'list', 'number', 'date', 'boolean'];

   const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
   const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

    const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast({ show: false, message: '', type: 'success' });
        }, 4000);
    };

    const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
        setConfirmDialog({
            show: true,
            title,
            message,
            onConfirm: () => {
                onConfirm();
                setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { } });
            },
            onCancel: () => {
                setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { } });
            }
        });
    };

    useEffect(() => {
        if (boardId) {
            fetchTables();
        } else {
            // Clear tables if no boardId is provided
            setTables([]);
            setExcelData([]);
            setSelectedTableForFields(null);
            setExpandedTable(null);
        }
    }, [boardId]);

    const fetchTables = async () => {
        if (!boardId) {
            console.log('No boardId provided, skipping table fetch');
            setTables([]);
            return;
        }

        setTablesLoading(true);
        try {
            // Fetch all tables first, then filter by boardId (following your code pattern)
            const response = await fetch(
                `${API_BASE_URL}/main-boards/boards/master-data-settings/?active_only=false`,
                {
                    headers: {
                        "X-API-Key": EXCEL_API_KEY
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('All fetched tables:', data);
                console.log('Current boardId:', boardId, 'Type:', typeof boardId);

                // Check if the API response contains board_id field
                if (data.length > 0) {
                    console.log('First table structure:', Object.keys(data[0]));
                }

                // Try different possible field names for board_id
                const filteredData = data.filter(
                    (table: any) => {
                        console.log('Table data:', table);
                        // Try multiple possible field names
                        const tableBoardId = table.board_id || table.boardId || table.board || table.id;
                        console.log('Table board identifier:', tableBoardId, 'Current boardId:', boardId);
                        return String(tableBoardId) === String(boardId);
                    }
                );

                console.log('Filtered tables for board', boardId, ':', filteredData);

                // If no board_id field exists, show all tables for now (temporary fix)
                if (data.length > 0 && !data[0].hasOwnProperty('board_id') && !data[0].hasOwnProperty('boardId')) {
                    console.log('No board_id field found in response, showing all tables');
                    setTables(data);
                } else {
                    setTables(filteredData);
                }

                if (filteredData.length === 0 && data.length > 0) {
                    console.log('No tables found for board', boardId, 'but', data.length, 'total tables exist');
                }
            } else {
                console.error('Failed to fetch tables, status:', response.status);
                const errorText = await response.text();
                console.error('Error response:', errorText);
                setTables([]);
            }
        } catch (error) {
            console.error('Error fetching tables for board', boardId, ':', error);
            setTables([]);
        } finally {
            setTablesLoading(false);
        }
    };

    const handleCreateTable = async () => {
        if (!boardId) {
            showToast('No board selected. Please select a board first.', 'error');
            return;
        }

        if (!newTable.table_name.trim() || !newTable.description.trim()) {
            showToast('Please fill in both table name and description', 'error');
            return;
        }

        // Additional validation to ensure only one table per board
        if (tables.length > 0) {
            showToast('Only one master data table is allowed per board', 'error');
            return;
        }

        setCreating(true);
        try {
            // Include boardId in the request body - use the correct field name
            const requestBody = {
                table_name: newTable.table_name,
                description: newTable.description,
                board_id: parseInt(boardId) // Ensure it's a number like in your other components
            };

            console.log('Creating table with data:', requestBody);

            const response = await fetch(
                `${API_BASE_URL}/main-boards/boards/master-data-settings/manual`,
                {
                    method: 'POST',
                    headers: {
                        "X-API-Key": EXCEL_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            if (response.ok) {
                const responseData = await response.json();
                console.log('Table created successfully:', responseData);
                setShowTableModal(false);
                setNewTable({ table_name: '', description: '' });
                fetchTables(); // Refresh the tables list
                showToast('Master data table created successfully!', 'success');
            } else {
                const errorData = await response.json();
                console.error('Error creating table:', errorData);
                showToast(`Failed to create table: ${errorData.detail || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error creating table:', error);
            showToast('An error occurred while creating the table', 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleEditTableStart = (table: TableData) => {
        setExpandedTable(table.id);
        setEditingTableId(table.id);
        setEditTableData({
            table_name: table.table_name,
            description: table.description
        });
        showToast('Edit mode activated', 'success');
    };

    const handleEditTableCancel = () => {
        setEditingTableId(null);
        setEditTableData({ table_name: '', description: '' });
        showToast('Edit cancelled', 'warning');
    };

    const handleEditTableSave = async (tableId: string) => {
        if (!editTableData.table_name.trim() || !editTableData.description.trim()) {
            showToast('Please fill in both table name and description', 'error');
            return;
        }

        setUpdating(true);
        try {
            const response = await fetch(
                `${API_BASE_URL}/main-boards/boards/master-data-settings/${tableId}`,
                {
                    method: 'PUT',
                    headers: {
                        "X-API-Key": EXCEL_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(editTableData)
                }
            );

            if (response.ok) {
                setEditingTableId(null);
                setEditTableData({ table_name: '', description: '' });
                fetchTables();
                showToast('Table updated successfully!', 'success');
            } else {
                const errorData = await response.json();
                showToast(`Failed to update table: ${errorData.detail || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error updating table:', error);
            showToast('An error occurred while updating the table', 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteTable = (tableId: string, tableName: string) => {
        setConfirmDialog({
            show: true,
            title: 'Delete Table',
            message: `Are you sure you want to delete the master data table "${tableName}"? This action cannot be undone and will also delete all associated fields. After deletion, you will be able to create a new master data table.`,
            onConfirm: async () => {
                setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { } });

                try {
                    const response = await fetch(
                        `${API_BASE_URL}/main-boards/boards/master-data-settings/${tableId}`,
                        {
                            method: 'DELETE',
                            headers: {
                                "X-API-Key": EXCEL_API_KEY
                            }
                        }
                    );

                    if (response.ok) {
                        fetchTables();
                        setSelectedTableForFields(null);
                        setExcelData([]);
                        showToast('Master data table deleted successfully! You can now create a new one.', 'success');
                    } else {
                        const errorData = await response.json();
                        showToast(`Failed to delete table: ${errorData.detail || 'Unknown error'}`, 'error');
                    }
                } catch (error) {
                    console.error('Error deleting table:', error);
                    showToast('An error occurred while deleting the table', 'error');
                }
            },
            onCancel: () => {
                setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { } });
            }
        });
    };

    const toggleExpanded = async (tableId: string) => {
        setExpandedTable(expandedTable === tableId ? null : tableId);
        if (expandedTable !== tableId) {
            await handleManageFields(tableId);
        } else {
            setExcelData([]);
            setSelectedTableForFields(null);
        }
    };

    const handleManageFields = async (tableId: string) => {
        setSelectedTableForFields(tableId);
        setLoadingFields(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/main-boards/boards/master-data-settings/${tableId}/fields`,
                {
                    headers: {
                        "X-API-Key": EXCEL_API_KEY
                    }
                }
            );

            if (response.ok) {
                const responseData = await response.json();
                console.log('API Response:', responseData);

                let fieldsData = [];

                if (Array.isArray(responseData)) {
                    fieldsData = responseData;
                } else if (responseData && Array.isArray(responseData.fields)) {
                    fieldsData = responseData.fields;
                } else if (responseData && Array.isArray(responseData.data)) {
                    fieldsData = responseData.data;
                } else if (responseData && Array.isArray(responseData.results)) {
                    fieldsData = responseData.results;
                } else {
                    fieldsData = responseData ? [responseData] : [];
                }

                const transformedData: ExcelFieldData[] = fieldsData.map((field: any, index: number) => ({
                    id: index + 1,
                    fieldName: field.field_name || field.name || '',
                    fieldDescription: field.field_description || field.description || '',
                    fieldType: field.field_datatype || field.datatype || field.type || 'char',
                    fieldLength: field.field_length ? field.field_length.toString() : field.length?.toString() || '',
                    fieldValue: field.field_value || field.value || field.field_value_display || '',
                    apiId: field.field_name || field.name,
                    originalFieldName: field.field_name || field.name // Store original field name
                }));

                setExcelData(transformedData);

                if (transformedData.length === 0) {
                    showToast('No fields found for this table', 'warning');
                }
            } else {
                console.error('Failed to fetch fields');
                showToast('Failed to load fields', 'error');
                setExcelData([]);
            }
        } catch (error) {
            console.error('Error fetching fields:', error);
            showToast('Error loading fields', 'error');
            setExcelData([]);
        } finally {
            setLoadingFields(false);
        }
    };

    const saveExcelFieldToAPI = async (fieldData: ExcelFieldData): Promise<any> => {
        if (!selectedTableForFields) {
            showToast('No table selected for field operations', 'error');
            return;
        }

        try {
            setSavingExcel(true);

            // Prepare request body based on API documentation
            const requestBody = {
                new_field_name: fieldData.fieldName,
                new_field_description: fieldData.fieldDescription,
                new_field_datatype: fieldData.fieldType,
                new_field_value: fieldData.fieldValue,
                new_field_length: parseInt(fieldData.fieldLength) || 0,
                new_is_required: false
            };

            let response;
            let result;

            // Check if this is an update (has originalFieldName) or create (new field)
            if (fieldData.originalFieldName && fieldData.originalFieldName !== '') {
                // Update existing field using the original field name in the URL
                console.log('Updating field:', fieldData.originalFieldName, 'with data:', requestBody);

                response = await fetch(
                    `${API_BASE_URL}/main-boards/boards/master-data-settings/${selectedTableForFields}/fields/${encodeURIComponent(fieldData.originalFieldName)}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': EXCEL_API_KEY,
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    }
                );

                if (response.ok) {
                    result = await response.json();
                    console.log('Field updated successfully:', result);
                    showToast('Field updated successfully!', 'success');

                    // Clear the modified state for this row
                    setModifiedExcelRows(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(fieldData.id);
                        return newSet;
                    });

                    // Refresh the fields data from API to get the latest values
                    await handleManageFields(selectedTableForFields);
                } else {
                    const errorText = await response.text();
                    console.error('Update failed:', response.status, errorText);
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
            } else {
                // Create new field - use POST request
                const createRequestBody = {
                    field_name: fieldData.fieldName,
                    field_description: fieldData.fieldDescription,
                    field_datatype: fieldData.fieldType,
                    field_value: fieldData.fieldValue,
                    field_length: parseInt(fieldData.fieldLength) || 0,
                    is_required: false
                };

                console.log('Creating new field with data:', createRequestBody);

                response = await fetch(
                    `${API_BASE_URL}/main-boards/boards/master-data-settings/${selectedTableForFields}/fields`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': EXCEL_API_KEY,
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(createRequestBody)
                    }
                );

                if (response.ok) {
                    result = await response.json();
                    console.log('Field created successfully:', result);
                    showToast('Field created successfully!', 'success');

                    // Refresh the fields data from API to get the latest values including the new field
                    await handleManageFields(selectedTableForFields);
                } else {
                    const errorText = await response.text();
                    console.error('Create failed:', response.status, errorText);
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
            }

            setSavedExcelRows(prev => new Set([...prev, fieldData.id]));

            return result;
        } catch (error) {
            console.error('Error saving excel field:', error);
            showToast(`Error saving field: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            throw error;
        } finally {
            setSavingExcel(false);
        }
    };

    const deleteExcelFieldFromAPI = async (fieldData: ExcelFieldData): Promise<void> => {
        if (!selectedTableForFields) {
            showToast('No table selected for field operations', 'error');
            return;
        }

        if (!fieldData.originalFieldName && !fieldData.fieldName) {
            showToast('Field name is required for deletion', 'error');
            return;
        }

        try {
            const fieldNameToDelete = fieldData.originalFieldName || fieldData.fieldName;

            const response = await fetch(
                `${API_BASE_URL}/main-boards/boards/master-data-settings/${selectedTableForFields}/fields/${encodeURIComponent(fieldNameToDelete)}`,
                {
                    method: 'DELETE',
                    headers: {
                        'X-API-Key': EXCEL_API_KEY,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Delete failed:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            console.log('Excel field deleted successfully');
            showToast('Field deleted successfully!', 'success');

            // Remove the field from local state
            setExcelData(prevData => prevData.filter(row => row.id !== fieldData.id));
            setSelectedExcelRows(prev => {
                const newSet = new Set(prev);
                newSet.delete(fieldData.id);
                return newSet;
            });
            setSavedExcelRows(prev => {
                const newSet = new Set(prev);
                newSet.delete(fieldData.id);
                return newSet;
            });

        } catch (error) {
            console.error('Error deleting excel field:', error);
            showToast(`Error deleting field: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            throw error;
        }
    };

    const saveAllExcelFields = async (): Promise<void> => {
        if (!selectedTableForFields) {
            showToast('No table selected for field operations', 'error');
            return;
        }

        try {
            setSavingExcel(true);
            const promises = excelData.map(row => saveExcelFieldToAPI(row));
            await Promise.all(promises);
            showToast('All fields saved successfully!', 'success');

            // Refresh the fields data from API to get the latest values
            await handleManageFields(selectedTableForFields);
        } catch (error) {
            console.error('Error saving all excel fields:', error);
        } finally {
            setSavingExcel(false);
        }
    };

    const saveSelectedExcelFields = async (): Promise<void> => {
        if (!selectedTableForFields) {
            showToast('No table selected for field operations', 'error');
            return;
        }

        try {
            setSavingExcel(true);
            const selectedData = excelData.filter(row => selectedExcelRows.has(row.id));
            const promises = selectedData.map(row => saveExcelFieldToAPI(row));
            await Promise.all(promises);
            showToast(`${selectedData.length} fields saved successfully!`, 'success');

            // Refresh the fields data from API to get the latest values
            await handleManageFields(selectedTableForFields);
        } catch (error) {
            console.error('Error saving selected excel fields:', error);
        } finally {
            setSavingExcel(false);
        }
    };

    useEffect(() => {
        if (editingExcelCell && excelInputRef.current) {
            excelInputRef.current.focus();
            if (excelInputRef.current instanceof HTMLInputElement) {
                excelInputRef.current.select();
            }
        }
    }, [editingExcelCell]);

    const handleExcelCellClick = (rowId: number, field: keyof ExcelFieldData, currentValue: string): void => {
        setEditingExcelCell(`${rowId}-${field}`);
        setEditExcelValue(currentValue || '');
    };

    const handleExcelCellSave = (rowId: number, field: keyof ExcelFieldData): void => {
        setExcelData(prevData =>
            prevData.map(row => {
                if (row.id === rowId) {
                    const updatedRow = { ...row, [field]: editExcelValue };

                    // If changing field type to list, initialize list values
                    if (field === 'fieldType' && editExcelValue === 'list') {
                        setListValues(prev => ({
                            ...prev,
                            [rowId]: prev[rowId] || ['']
                        }));
                    }

                    // If changing field type from list, clear list values
                    if (field === 'fieldType' && row.fieldType === 'list' && editExcelValue !== 'list') {
                        setListValues(prev => {
                            const newValues = { ...prev };
                            delete newValues[rowId];
                            return newValues;
                        });
                        setExpandedListFields(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(rowId);
                            return newSet;
                        });
                    }

                    return updatedRow;
                }
                return row;
            })
        );

        // Mark row as modified when a cell is saved
        setModifiedExcelRows(prev => new Set([...prev, rowId]));

        setEditingExcelCell(null);
        setEditExcelValue('');
    };

    const handleExcelCellCancel = (): void => {
        setEditingExcelCell(null);
        setEditExcelValue('');
    };

    const handleExcelKeyDown = (e: React.KeyboardEvent, rowId: number, field: keyof ExcelFieldData): void => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleExcelCellSave(rowId, field);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleExcelCellCancel();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            handleExcelCellSave(rowId, field);
        }
    };

    const addNewExcelRow = (): void => {
        const newId = Math.max(...excelData.map(row => row.id), 0) + 1;
        const newRow: ExcelFieldData = {
            id: newId,
            fieldName: '',
            fieldDescription: '',
            fieldType: 'char',
            fieldLength: '',
            fieldValue: '',
            originalFieldName: '' // No original field name for new rows
        };
        setExcelData([...excelData, newRow]);
        showToast('New field row added. Don\'t forget to save!', 'success');
    };

    const deleteSelectedExcelRows = (): void => {
        setExcelData(excelData.filter(row => !selectedExcelRows.has(row.id)));
        setSelectedExcelRows(new Set());
    };

    const toggleExcelRowSelection = (rowId: number): void => {
        const newSelected = new Set(selectedExcelRows);
        if (newSelected.has(rowId)) {
            newSelected.delete(rowId);
        } else {
            newSelected.add(rowId);
        }
        setSelectedExcelRows(newSelected);
    };

    // List field management functions
    const toggleListExpansion = (fieldId: number) => {
        setExpandedListFields(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fieldId)) {
                newSet.delete(fieldId);
            } else {
                newSet.add(fieldId);
                // Initialize list values if not already present
                if (!listValues[fieldId]) {
                    // Parse existing comma-separated values or start with empty array
                    const field = excelData.find(f => f.id === fieldId);
                    const existingValues = field?.fieldValue ? field.fieldValue.split(',').map(v => v.trim()).filter(v => v) : [];
                    setListValues(prevValues => ({
                        ...prevValues,
                        [fieldId]: existingValues.length > 0 ? existingValues : ['']
                    }));
                }
            }
            return newSet;
        });
    };

    const addListValue = (fieldId: number) => {
        setListValues(prev => ({
            ...prev,
            [fieldId]: [...(prev[fieldId] || []), '']
        }));
    };

    const updateListValue = (fieldId: number, index: number, value: string) => {
        setListValues(prev => ({
            ...prev,
            [fieldId]: prev[fieldId]?.map((item, i) => i === index ? value : item) || []
        }));

        // Mark the field as modified
        setModifiedExcelRows(prev => new Set([...prev, fieldId]));
    };

    const removeListValue = (fieldId: number, index: number) => {
        setListValues(prev => ({
            ...prev,
            [fieldId]: prev[fieldId]?.filter((_, i) => i !== index) || []
        }));

        // Mark the field as modified
        setModifiedExcelRows(prev => new Set([...prev, fieldId]));
    };

    const saveListValues = (fieldId: number) => {
        const values = listValues[fieldId] || [];
        const validValues = values.filter(v => v.trim() !== '');

        // Update the field value with comma-separated list
        setExcelData(prevData =>
            prevData.map(row =>
                row.id === fieldId ? { ...row, fieldValue: validValues.join(', ') } : row
            )
        );

        // Mark as modified
        setModifiedExcelRows(prev => new Set([...prev, fieldId]));

        showToast('List values saved locally. Don\'t forget to save the field!', 'success');
    };

    // Function to render list items in individual rows
    const renderListItems = (field: ExcelFieldData) => {
        if (field.fieldType !== 'list' || !field.fieldValue) return null;

        const listItems = field.fieldValue.split(',').map(item => item.trim()).filter(item => item);
        if (listItems.length === 0) return null;

        return listItems.map((item, index) => (
            <tr key={`${field.id}-list-${index}`} className="bg-blue-25 border-l-4 border-blue-400">
                <td className="w-8 px-2 py-1 border-r border-gray-100">
                    <div className="flex items-center justify-center">
                        <span className="text-xs text-blue-600">•</span>
                    </div>
                </td>
                <td className="px-1 py-1 border-r border-gray-100 min-w-[150px]">
                    <div className="px-2 py-1 text-sm text-gray-600 italic">
                        ↳ {field.fieldName} item
                    </div>
                </td>
                <td className="px-1 py-1 border-r border-gray-100 min-w-[200px]">
                    <div className="px-2 py-1 text-sm text-gray-600">
                        List item {index + 1}
                    </div>
                </td>
                <td className="px-1 py-1 border-r border-gray-100 min-w-[100px]">
                    <div className="px-2 py-1 text-sm text-blue-600 font-medium">
                        list-item
                    </div>
                </td>
                <td className="px-1 py-1 border-r border-gray-100 min-w-[80px]">
                    <div className="px-2 py-1 text-sm text-gray-600">
                        {item.length}
                    </div>
                </td>
                <td className="px-1 py-1 border-r border-gray-100 min-w-[150px]">
                    <div className="px-2 py-1 text-sm font-medium text-gray-900 bg-blue-50 rounded">
                        {item}
                    </div>
                </td>
                <td className="px-2 py-1 text-center">
                    <div className="flex items-center justify-center space-x-1">
                        <span className="text-xs text-gray-400">list item</span>
                    </div>
                </td>
            </tr>
        ));
    };

    const selectAllExcelRows = (): void => {
        if (selectedExcelRows.size === excelData.length) {
            setSelectedExcelRows(new Set());
        } else {
            setSelectedExcelRows(new Set(excelData.map(row => row.id)));
        }
    };

    const renderExcelCell = (row: ExcelFieldData, field: keyof ExcelFieldData, label: string): React.ReactElement => {
        const cellKey = `${row.id}-${field}`;
        const isEditing = editingExcelCell === cellKey;
        const value = row[field] as string;

        // Special handling for field value when type is list
        if (field === 'fieldValue' && row.fieldType === 'list') {
            const listItems = value ? value.split(',').map(item => item.trim()).filter(item => item) : [];

            return (
                <div className="w-full px-2 py-2 min-h-[36px] border border-transparent hover:border-blue-200 rounded transition-colors duration-150">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">List values:</span>
                        <button
                            onClick={() => toggleListExpansion(row.id)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded"
                            title="Manage list values"
                        >
                            <Plus className="h-3 w-3" />
                        </button>
                    </div>

                    {/* Display list items as visual tags/boxes */}
                    <div className="flex flex-col gap-1">
                        {listItems.length > 0 ? (
                            listItems.map((item, index) => (
                                <div
                                    key={index}
                                    className="px-2 py-1 bg-blue-100 border border-blue-300 rounded text-sm font-medium text-blue-800"
                                    style={{
                                        border: '1px solid #3B82F6',
                                        borderRadius: '4px',
                                        backgroundColor: '#DBEAFE',
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        marginBottom: '4px' // Add space between items
                                    }}
                                >
                                    {item}
                                </div>
                            ))
                        ) : (
                            <span className="text-gray-400 text-sm">Click + to add list items</span>
                        )}
                    </div>

                    {/* Expanded list management */}

                    {/* Expanded list management */}
                    {expandedListFields.has(row.id) && (
                        <div className="mt-3 p-3 bg-gray-50 border rounded">
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {(listValues[row.id] || ['']).map((listValue, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={listValue}
                                            onChange={(e) => updateListValue(row.id, index, e.target.value)}
                                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                            placeholder={`List item ${index + 1}`}
                                        />
                                        <button
                                            onClick={() => removeListValue(row.id, index)}
                                            className="text-red-600 hover:text-red-800 p-1"
                                            title="Remove item"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-2 border-t">
                                <button
                                    onClick={() => addListValue(row.id)}
                                    className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Item
                                </button>
                                <div className="space-x-2">
                                    <button
                                        onClick={() => saveListValues(row.id)}
                                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                    >
                                        Save List
                                    </button>
                                    <button
                                        onClick={() => toggleListExpansion(row.id)}
                                        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* jjj */}
                </div>
            );
        }

        if (isEditing) {
            if (field === 'fieldType') {
                return (
                    <select
                        ref={excelInputRef as React.RefObject<HTMLSelectElement>}
                        value={editExcelValue}
                        onChange={(e) => setEditExcelValue(e.target.value)}
                        onBlur={() => handleExcelCellSave(row.id, field)}
                        onKeyDown={(e) => handleExcelKeyDown(e, row.id, field)}
                        className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:border-blue-600 bg-white"
                    >
                        {excelFieldTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                );
            }

            return (
                <div className="relative">
                    <input
                        ref={excelInputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={editExcelValue}
                        onChange={(e) => setEditExcelValue(e.target.value)}
                        onBlur={() => handleExcelCellSave(row.id, field)}
                        onKeyDown={(e) => handleExcelKeyDown(e, row.id, field)}
                        className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:border-blue-600"
                    />
                    <div className="absolute right-1 top-1 flex space-x-1">
                        <button
                            onClick={() => handleExcelCellSave(row.id, field)}
                            className="text-green-600 hover:text-green-800"
                        >
                            <Check className="h-3 w-3" />
                        </button>
                        <button
                            onClick={handleExcelCellCancel}
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
                onClick={() => handleExcelCellClick(row.id, field, value)}
                className="w-full px-2 py-2 min-h-[36px] cursor-text hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded transition-colors duration-150 flex items-center"
            >
                <span className={`${!value ? 'text-gray-400' : 'text-gray-900'}`}>
                    {value || 'Click to edit...'}
                </span>
            </div>
        );
    };

    function setCurrentPage(arg0: number) {
        throw new Error('Function not implemented.');
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    {/* <div className="flex justify-between items-center"> */}
                        {/* <h1 className="text-2xl font-semibold text-gray-900">Master Data Settings</h1> */}
                        <div className="flex justify-end space-x-2">  {/* Added justify-end */}
                            <button
                                onClick={() => setShowTableModal(true)}
                                disabled={tables.length > 0 || !boardId}
                                className={`px-4 py-2 rounded-lg flex items-center space-x-2 shadow-sm transition-colors duration-150 ${tables.length > 0 || !boardId
                                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                title={
                                    !boardId
                                        ? "Please select a board first"
                                        : tables.length > 0
                                            ? "Only one master data table is allowed per board"
                                            : "Create master data table"
                                }
                            >
                                <Plus className="h-4 w-4" />
                                <span>
                                    {!boardId
                                        ? 'Select Board First'
                                        : tables.length > 0
                                            ? 'Master Data Created'
                                            : 'Create Master Data'
                                    }
                                </span>
                            </button>
                        </div>
                    {/* </div> */}
                </div>

                {tablesLoading && (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                )}

                {!tablesLoading && (
                    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-6">
                        <table className="min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">
                                        Table Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">
                                        Table Description
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-black-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {tables.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                            {!boardId
                                                ? 'Please select a board to manage master data tables.'
                                                : 'No master data table found for this board. Click "Create Master Data" to create your table.'
                                            }
                                        </td>
                                    </tr>
                                ) : (
                                    tables.map((table) => (
                                        <React.Fragment key={table.id}>
                                            <tr className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {table.table_name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-900">
                                                        {table.description}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        {/* <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditTableStart(table);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 p-1"
                                                            title="Edit table"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button> */}
                                                        {/* <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteTable(table.id, table.table_name);
                                                            }}
                                                            className="text-red-600 hover:text-red-800 p-1"
                                                            title="Delete table"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button> */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleExpanded(table.id);
                                                            }}
                                                            className="text-green-600 hover:text-green-800 p-1"
                                                            title="Manage fields"
                                                        >
                                                            {expandedTable === table.id ? (
                                                                <ChevronUp className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* {!tablesLoading && ( */}
                                                {/* // <div className="mb-4"> */}
                                                    {/* <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Search tables..."
                                                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            value={searchTerm}
                                                            onChange={(e) => {
                                                                setSearchTerm(e.target.value);
                                                                setCurrentPage(1); // Reset to first page when searching
                                                            }}
                                                        />
                                                        {searchTerm && (
                                                            <button
                                                                onClick={() => setSearchTerm('')}
                                                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div> */}
                                                {/* </div> */}
                                            {/* // )} */}

                                            {expandedTable === table.id && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan={3} className="px-6 py-4">
                                                        {editingTableId === table.id ? (
                                                            <div className="space-y-4">
                                                                <h4 className="text-lg font-medium text-gray-900">Edit Table</h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                                            Table Name
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={editTableData.table_name}
                                                                            onChange={(e) => setEditTableData({
                                                                                ...editTableData,
                                                                                table_name: e.target.value
                                                                            })}
                                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                            placeholder="Enter master data table name"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                                            Description
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={editTableData.description}
                                                                            onChange={(e) => setEditTableData({
                                                                                ...editTableData,
                                                                                description: e.target.value
                                                                            })}
                                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                            placeholder="Enter description"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="flex space-x-4">
                                                                    <button
                                                                        onClick={() => handleEditTableSave(table.id)}
                                                                        disabled={updating}
                                                                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2 disabled:opacity-50"
                                                                    >
                                                                        <Save className="h-4 w-4" />
                                                                        <span>{updating ? 'Saving...' : 'Save'}</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={handleEditTableCancel}
                                                                        disabled={updating}
                                                                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center space-x-2 disabled:opacity-50"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                        <span>Cancel</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                <div className="mb-4 flex justify-between items-center">
                                                                    <h4 className="text-lg font-medium text-gray-900">Manage Fields</h4>
                                                                    <div className="flex space-x-2">
                                                                        <button
                                                                            onClick={addNewExcelRow}
                                                                            disabled={savingExcel}
                                                                            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-1 text-sm disabled:opacity-50"
                                                                        >
                                                                            <Plus className="h-3 w-3" />
                                                                            <span>Add Field</span>
                                                                        </button>

                                                                         {/* <button
                                                                            onClick={addNewmonetoryRow}
                                                                            disabled={savingmonetory}
                                                                            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-1 text-sm disabled:opacity-50"
                                                                        >
                                                                            <Plus className="h-3 w-3" />
                                                                            <span>Add Monetory Field</span>
                                                                        </button> */}

                                                                        {selectedExcelRows.size > 0 && (
                                                                            <div className="flex space-x-3">
                                                                                <button
                                                                                    onClick={saveSelectedExcelFields}
                                                                                    disabled={savingExcel}
                                                                                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-1 text-sm disabled:opacity-50"
                                                                                >
                                                                                    {savingExcel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                                                    <span>Save ({selectedExcelRows.size})</span>
                                                                                </button>
                                                                                <button
                                                                                    onClick={deleteSelectedExcelRows}
                                                                                    disabled={savingExcel}
                                                                                    className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center space-x-1 text-sm disabled:opacity-50"
                                                                                >
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                    <span>Delete ({selectedExcelRows.size})</span>
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        <button
                                                                            onClick={saveAllExcelFields}
                                                                            disabled={savingExcel}
                                                                            className="px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center space-x-1 text-sm disabled:opacity-50"
                                                                        >
                                                                            {savingExcel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                                            <span>Save All</span>
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {loadingFields ? (
                                                                    <div className="flex justify-center items-center h-32">
                                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                                                        <span className="ml-2 text-gray-600">Loading fields...</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                                        <table className="min-w-full">
                                                                            <thead>
                                                                                <tr className="bg-gray-100 border-b border-gray-200">
                                                                                    <th className="w-8 px-2 py-2 text-left">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={selectedExcelRows.size === excelData.length && excelData.length > 0}
                                                                                            onChange={selectAllExcelRows}
                                                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                                        />
                                                                                    </th>
                                                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                                                                                        Field Name
                                                                                    </th>
                                                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                                                                                        Description
                                                                                    </th>
                                                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                                                                                        Type
                                                                                    </th>
                                                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                                                                                        Length
                                                                                    </th>
                                                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200">
                                                                                        Value
                                                                                    </th>
                                                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">
                                                                                        Actions
                                                                                    </th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {currentFields.map((row, index) => (
                                                                                    <tr
                                                                                        key={row.id}
                                                                                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 ${selectedExcelRows.has(row.id) ? 'bg-blue-50' : ''
                                                                                            } ${savedExcelRows.has(row.id) ? 'bg-green-50 border-green-200' : ''} ${modifiedExcelRows.has(row.id) ? 'bg-orange-50 border-orange-200' : ''
                                                                                            }`}
                                                                                    >
                                                                                        <td className="w-8 px-2 py-1 border-r border-gray-100">
                                                                                            <div className="flex items-center space-x-1">
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    checked={selectedExcelRows.has(row.id)}
                                                                                                    onChange={() => toggleExcelRowSelection(row.id)}
                                                                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                                                />
                                                                                                {savedExcelRows.has(row.id) && (
                                                                                                    <Check className="h-2 w-2 text-green-600" />
                                                                                                )}
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-1 py-1 border-r border-gray-100 min-w-[150px]">
                                                                                            {renderExcelCell(row, 'fieldName', 'Field Name')}
                                                                                        </td>
                                                                                        <td className="px-1 py-1 border-r border-gray-100 min-w-[200px]">
                                                                                            {renderExcelCell(row, 'fieldDescription', 'Field Description')}
                                                                                        </td>
                                                                                        <td className="px-1 py-1 border-r border-gray-100 min-w-[100px]">
                                                                                            {renderExcelCell(row, 'fieldType', 'Field Type')}
                                                                                        </td>
                                                                                        <td className="px-1 py-1 border-r border-gray-100 min-w-[80px]">
                                                                                            {renderExcelCell(row, 'fieldLength', 'Field Length')}
                                                                                        </td>
                                                                                        <td className="px-1 py-1 border-r border-gray-100 min-w-[150px]">
                                                                                            {renderExcelCell(row, 'fieldValue', 'Field Value')}
                                                                                        </td>
                                                                                        <td className="px-2 py-1 text-center">
                                                                                            <div className="flex items-center justify-center space-x-1">
                                                                                                <button
                                                                                                    onClick={async () => {
                                                                                                        try {
                                                                                                            await saveExcelFieldToAPI(row);
                                                                                                        } catch (error) {
                                                                                                            // Error is already handled in saveExcelFieldToAPI
                                                                                                        }
                                                                                                    }}
                                                                                                    disabled={savingExcel}
                                                                                                    className={`${modifiedExcelRows.has(row.id)
                                                                                                            ? 'text-orange-600 hover:text-orange-800'
                                                                                                            : 'text-green-600 hover:text-green-800'
                                                                                                        } disabled:opacity-50`}
                                                                                                    title={modifiedExcelRows.has(row.id) ? 'Update this field' : 'Save this field'}
                                                                                                >
                                                                                                    {modifiedExcelRows.has(row.id) ? (
                                                                                                        <Edit className="h-3 w-3" />
                                                                                                    ) : (
                                                                                                        <Save className="h-3 w-3" />
                                                                                                    )}
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        showConfirmDialog(
                                                                                                            'Delete Field',
                                                                                                            `Are you sure you want to delete the field "${row.fieldName || 'Unnamed'}"?`,
                                                                                                            async () => {
                                                                                                                try {
                                                                                                                    if (row.originalFieldName) {
                                                                                                                        await deleteExcelFieldFromAPI(row);
                                                                                                                    } else {
                                                                                                                        setExcelData(excelData.filter(r => r.id !== row.id));
                                                                                                                        setSelectedExcelRows(prev => {
                                                                                                                            const newSet = new Set(prev);
                                                                                                                            newSet.delete(row.id);
                                                                                                                            return newSet;
                                                                                                                        });
                                                                                                                        showToast('Field deleted successfully', 'success');
                                                                                                                    }
                                                                                                                } catch (error) {
                                                                                                                    // Error is already handled in deleteExcelFieldFromAPI
                                                                                                                }
                                                                                                            }
                                                                                                        );
                                                                                                    }}
                                                                                                    className="text-red-600 hover:text-red-800"
                                                                                                    title="Delete this field"
                                                                                                >
                                                                                                    <Trash2 className="h-3 w-3" />
                                                                                                </button>
                                                                                                {/* <button
                                                                                                    onClick={() => {
                                                                                                        const newId = Math.max(...excelData.map(r => r.id), 0) + 1;
                                                                                                        const newRow: ExcelFieldData = {
                                                                                                            id: newId,
                                                                                                            fieldName: '',
                                                                                                            fieldDescription: '',
                                                                                                            fieldType: 'char',
                                                                                                            fieldLength: '',
                                                                                                            fieldValue: '',
                                                                                                            originalFieldName: ''
                                                                                                        };
                                                                                                        const currentIndex = excelData.findIndex(r => r.id === row.id);
                                                                                                        const newData = [...excelData];
                                                                                                        newData.splice(currentIndex + 1, 0, newRow);
                                                                                                        setExcelData(newData);
                                                                                                        showToast('New row added below', 'success');
                                                                                                    }}
                                                                                                    className="text-blue-600 hover:text-blue-800"
                                                                                                    title="Add row below"
                                                                                                >
                                                                                                    <Plus className="h-3 w-3" />
                                                                                                </button> */}
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                                {excelData.length === 0 && (
                                                                                    <tr>
                                                                                        <td colSpan={7} className="px-4 py-6 text-center text-gray-500 text-sm">
                                                                                            <div className="flex flex-col items-center space-y-2">
                                                                                                <span>No fields available for this table.</span>
                                                                                                <button
                                                                                                    onClick={addNewExcelRow}
                                                                                                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-1 text-sm"
                                                                                                >
                                                                                                    <Plus className="h-3 w-3" />
                                                                                                    <span>Add First Field</span>
                                                                                                </button>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}

                                                                <div className="mt-3 flex justify-between items-center text-xs text-gray-600">
                                                                    <div className="flex items-center space-x-3">
                                                                        <span>Total: {excelData.length} | Selected: {selectedExcelRows.size}</span>
                                                                        <span className="text-green-600">✓ Saved: {savedExcelRows.size}</span>
                                                                        {savingExcel && (
                                                                            <div className="flex items-center space-x-1 text-blue-600">
                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                                <span>Saving...</span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {excelData.length > fieldsPerPage && (
                                                                        <div className="flex items-center space-x-2">
                                                                            <button
                                                                                onClick={() => setCurrentFieldsPage(prev => Math.max(prev - 1, 1))}
                                                                                disabled={currentFieldsPage === 1}
                                                                                className="px-2 py-1 text-xs rounded border border-gray-300 bg-white disabled:opacity-50 hover:bg-gray-50"
                                                                            >
                                                                                Previous
                                                                            </button>

                                                                            <span className="text-xs text-gray-700">
                                                                                Page {currentFieldsPage} of {totalFieldsPages}
                                                                            </span>

                                                                            <button
                                                                                onClick={() => setCurrentFieldsPage(prev => Math.min(prev + 1, totalFieldsPages))}
                                                                                disabled={currentFieldsPage === totalFieldsPages}
                                                                                className="px-2 py-1 text-xs rounded border border-gray-300 bg-white disabled:opacity-50 hover:bg-gray-50"
                                                                            >
                                                                                Next
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    <div className="text-xs text-gray-500">
                                                                        Click cell to edit • Enter to save • Esc to cancel
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {toast.show && (
                    <div className="fixed top-4 right-4 z-[9999] animate-pulse">
                        <div className={`flex items-center p-4 rounded-lg shadow-xl border max-w-sm ${toast.type === 'success' ? 'bg-green-500 text-white border-green-600' :
                            toast.type === 'error' ? 'bg-red-500 text-white border-red-600' :
                                'bg-yellow-500 text-white border-yellow-600'
                            }`}>
                            <div className="flex items-center">
                                {toast.type === 'success' && <Check className="h-5 w-5 mr-2 flex-shrink-0" />}
                                {toast.type === 'error' && <X className="h-5 w-5 mr-2 flex-shrink-0" />}
                                {toast.type === 'warning' && <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />}
                                <span className="text-sm font-medium">{toast.message}</span>
                            </div>
                            <button
                                onClick={() => setToast({ show: false, message: '', type: 'success' })}
                                className="ml-3 text-white hover:text-gray-200 flex-shrink-0"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}

                {confirmDialog.show && (
                    <div
                        className="fixed inset-0 z-[10000] flex items-center justify-center"
                        style={{
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0
                        }}
                    >
                        <div
                            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 relative"
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '8px',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                maxWidth: '28rem',
                                width: '100%',
                                margin: '0 1rem',
                                zIndex: 10001
                            }}
                        >
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h3 className="text-lg font-medium text-gray-900">{confirmDialog.title}</h3>
                            </div>

                            <div className="px-6 py-4">
                                <p className="text-sm text-gray-600">{confirmDialog.message}</p>
                            </div>

                            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        confirmDialog.onCancel();
                                    }}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        confirmDialog.onConfirm();
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showTableModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-medium text-gray-900">Create Master Data Table</h3>
                                    <button
                                        onClick={() => setShowTableModal(false)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="px-6 py-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Master Data Table Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={newTable.table_name}
                                        onChange={(e) => setNewTable({
                                            ...newTable,
                                            table_name: e.target.value
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Enter table name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description *
                                    </label>
                                    <textarea
                                        value={newTable.description}
                                        onChange={(e) => setNewTable({
                                            ...newTable,
                                            description: e.target.value
                                        })}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Enter description"
                                    />
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowTableModal(false)}
                                    disabled={creating}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateTable}
                                    disabled={creating || !newTable.table_name.trim() || !newTable.description.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>{creating ? 'Creating...' : 'Create Master Data Table'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExcelTableComponent;