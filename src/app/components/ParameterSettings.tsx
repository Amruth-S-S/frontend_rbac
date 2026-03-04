"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Check, X, Save, Loader2, Edit, ChevronDown, ChevronUp, AlertTriangle, Lock } from 'lucide-react';

interface ParameterFieldData {
    id: number;
    fieldName: string;
    fieldDescription: string;
    fieldType: string;
    fieldLength: string;
    fieldValue: string;
    apiId?: any;
    originalFieldName?: string;
    isCalculated?: boolean;
    [key: string]: any; // Add index signature to allow string indexing
}

interface ParameterTableData {
    id: string;
    table_name: string;
    description: string;
    created_at?: string;
    updated_at?: string;
    key_figures?: string[];
    categorical_columns?: string[];
    calculated_key_figures?: Array<{
        name: string;
        display_name: string;
        formula: string;
        description: string;
        referenced_columns: string[];
        created_at: string;
    }>;
}

interface ParameterTableComponentProps {
    boardId?: string | null;
}

interface FormulaBuilder {
    name: string;
    display_name: string;
    description: string;
    formula: string;
    selected_fields: string[];
}

const ParameterSettings = ({ boardId }: ParameterTableComponentProps) => {
    const [tables, setTables] = useState<ParameterTableData[]>([]);
    const [expandedTable, setExpandedTable] = useState<string | null>(null);
    const [selectedTableForFields, setSelectedTableForFields] = useState<string | null>(null);
    const [tablesLoading, setTablesLoading] = useState(false);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);


    // Field management states
    const [currentFieldsPage, setCurrentFieldsPage] = useState(1);
    const [fieldsPerPage] = useState(10);
    const [parameterData, setParameterData] = useState<ParameterFieldData[]>([]);
    const [editingParameterCell, setEditingParameterCell] = useState<{ rowId: number; field: string } | null>(null);
    const [editParameterValue, setEditParameterValue] = useState<string>('');
    const [selectedParameterRows, setSelectedParameterRows] = useState<Set<number>>(new Set());
    const [savingParameter, setSavingParameter] = useState<boolean>(false);
    const [savedParameterRows, setSavedParameterRows] = useState<Set<number>>(new Set());
    const [modifiedParameterRows, setModifiedParameterRows] = useState<Set<number>>(new Set());
    const [loadingFields, setLoadingFields] = useState<boolean>(false);
    const parameterInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

    // Dataset upload states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [showDatasetModal, setShowDatasetModal] = useState(false);
    const [datasetTableName, setDatasetTableName] = useState<string>('');
    const [datasetDescription, setDatasetDescription] = useState<string>('');
    const [tableNameError, setTableNameError] = useState<string>('');
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<boolean>(false);
    // Existing states for tabbed view
    const [activeTab, setActiveTab] = useState<'fields' | 'key_figures' | 'categorical' | 'calculated'>('fields');
    const [showFormulaBuilder, setShowFormulaBuilder] = useState(false);
    const [selectedFields, setSelectedFields] = useState<string[]>([]);
    const [formulaBuilder, setFormulaBuilder] = useState<FormulaBuilder>({
        name: '',
        display_name: '',
        description: '',
        formula: '',
        selected_fields: []
    });
    const [creatingFormula, setCreatingFormula] = useState(false);
    const [detailedCalculatedFields, setDetailedCalculatedFields] = useState<{ [key: string]: any }>({});
    const [loadingCalculatedFields, setLoadingCalculatedFields] = useState<{ [key: string]: boolean }>({});

    const parameterFieldTypes = ['string', 'float',' integer','char', 'list', 'number', 'date', 'boolean', 'calculated'];


    // Pagination
    const indexOfLastField = currentFieldsPage * fieldsPerPage;
    const indexOfFirstField = indexOfLastField - fieldsPerPage;
    const currentFields = parameterData.slice(indexOfFirstField, indexOfLastField);
    const totalFieldsPages = Math.ceil(parameterData.length / fieldsPerPage);


    const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''; 
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL; 

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
            setTables([]);
            setParameterData([]);
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
            const response = await fetch(
                `${API_BASE_URL}/main-boards/boards/parameter-settings/?active_only=false`,
                {
                    headers: {
                        "X-API-Key": EXCEL_API_KEY
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('All fetched parameter tables:', data);
                console.log('Current boardId:', boardId, 'Type:', typeof boardId);

                const filteredData = data.filter(
                    (table: any) => {
                        const tableBoardId = table.board_id || table.boardId || table.board || table.id;
                        return String(tableBoardId) === String(boardId);
                    }
                );

                console.log('Filtered parameter tables for board', boardId, ':', filteredData);

                if (data.length > 0 && !data[0].hasOwnProperty('board_id') && !data[0].hasOwnProperty('boardId')) {
                    console.log('No board_id field found in response, showing all parameter tables');
                    setTables(data);
                } else {
                    setTables(filteredData);
                }
            } else {
                console.error('Failed to fetch parameter tables, status:', response.status);
                setTables([]);
            }
        } catch (error) {
            console.error('Error fetching parameter tables for board', boardId, ':', error);
            setTables([]);
        } finally {
            setTablesLoading(false);
        }
    };

    const handleDeleteTable = (tableId: string, tableName: string) => {
        setConfirmDialog({
            show: true,
            title: 'Delete Parameter Table',
            message: `Are you sure you want to delete the parameter table "${tableName}"? This action cannot be undone and will also delete all associated fields.`,
            onConfirm: async () => {
                setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { } });

                try {
                    const response = await fetch(
                        `${API_BASE_URL}/main-boards/boards/parameter-settings/${tableId}`,
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
                        setParameterData([]);
                        showToast('Parameter table deleted successfully!', 'success');
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
            setActiveTab('fields');
        } else {
            setParameterData([]);
            setSelectedTableForFields(null);
        }
    };

    const handleManageFields = async (tableId: string) => {
        setSelectedTableForFields(tableId);
        setLoadingFields(true);

        try {
            const fieldsResponse = await fetch(
                `${API_BASE_URL}/main-boards/boards/parameter-settings/${tableId}/fields?required_only=false`,
                {
                    headers: {
                        "X-API-Key": EXCEL_API_KEY
                    }
                }
            );

            const calculatedResponse = await fetch(
                `${API_BASE_URL}/main-boards/boards/parameter-settings/${tableId}/calculated-key-figures`,
                {
                    headers: {
                        "X-API-Key": EXCEL_API_KEY
                    }
                }
            );

            let allFields: ParameterFieldData[] = [];
            let calculatedFields: any[] = [];

            if (fieldsResponse.ok) {
                const responseData = await fieldsResponse.json();
                console.log('Parameter Fields API Response:', responseData);

                let fieldsData = [];
                if (Array.isArray(responseData)) {
                    fieldsData = responseData;
                } else if (responseData && Array.isArray(responseData.fields)) {
                    fieldsData = responseData.fields;
                } else if (responseData && Array.isArray(responseData.data)) {
                    fieldsData = responseData.data;
                } else {
                    fieldsData = responseData ? [responseData] : [];
                }

                const transformedRegularFields: ParameterFieldData[] = fieldsData.map((field: any, index: number) => ({
                    id: index + 1,
                    fieldName: field.field_name || field.name || '',
                    fieldDescription: field.field_description || field.description || '',
                    fieldType: field.field_datatype || field.datatype || field.type || 'char',
                    fieldLength: field.field_length ? field.field_length.toString() : field.length?.toString() || '',
                    fieldValue: field.field_value || field.value || field.field_value_display || '',
                    apiId: field.field_name || field.name,
                    originalFieldName: field.field_name || field.name,
                    isCalculated: false
                }));

                allFields = [...transformedRegularFields];
            }

            // Fetch and add calculated fields
            if (calculatedResponse.ok) {
                const calculatedData = await calculatedResponse.json();
                console.log('Calculated Fields API Response:', calculatedData);

                calculatedFields = calculatedData.calculated_key_figures || [];

                const transformedCalculatedFields: ParameterFieldData[] = calculatedFields.map((field: any, index: number) => ({
                    id: allFields.length + index + 1,
                    fieldName: field.name || field.display_name || '',
                    fieldDescription: field.description || `Calculated field: ${field.formula}`,
                    fieldType: 'calculated',
                    fieldLength: '',
                    fieldValue: field.formula || '',
                    apiId: field.name,
                    originalFieldName: field.name,
                    isCalculated: true
                }));

                allFields = [...allFields, ...transformedCalculatedFields];
                console.log('All fields including calculated:', allFields);
            }

            // Store detailed calculated fields for other tabs
            setDetailedCalculatedFields(prev => ({
                ...prev,
                [tableId]: calculatedFields
            }));

            // Set all fields including calculated ones
            setParameterData(allFields);

            await fetchTableDetails(tableId);

            if (allFields.length === 0) {
                showToast('No fields found for this table', 'warning');
            } else {
                console.log(`Total fields loaded: ${allFields.length} (${allFields.filter(f => !f.isCalculated).length} regular + ${allFields.filter(f => f.isCalculated).length} calculated)`);
            }

        } catch (error) {
            console.error('Error fetching parameter fields:', error);
            showToast('Error loading fields', 'error');
            setParameterData([]);
        } finally {
            setLoadingFields(false);
        }
    };

    const fetchTableDetails = async (tableId: string) => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/main-boards/boards/parameter-settings/${tableId}`,
                {
                    headers: {
                        "X-API-Key": EXCEL_API_KEY
                    }
                }
            );

            if (response.ok) {
                const tableDetails = await response.json();

                setTables(prevTables =>
                    prevTables.map(table =>
                        table.id === tableId
                            ? { ...table, ...tableDetails }
                            : table
                    )
                );
            }
        } catch (error) {
            console.error('Error fetching table details:', error);
        }
    };

    const fetchDetailedCalculatedFields = async (datasetId: string | number) => {
        try {
            setLoadingCalculatedFields(prev => ({ ...prev, [datasetId]: true }));
            const response = await fetch(
                `${API_BASE_URL}/main-boards/boards/parameter-settings/${datasetId}/calculated-key-figures`,
                {
                    headers: {
                        "X-API-Key": EXCEL_API_KEY
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setDetailedCalculatedFields(prev => ({
                    ...prev,
                    [datasetId]: data.calculated_key_figures || []
                }));
            } else {
                console.error('Failed to fetch detailed calculated fields');
                setDetailedCalculatedFields(prev => ({
                    ...prev,
                    [datasetId]: []
                }));
            }
        } catch (error) {
            console.error('Error fetching detailed calculated fields:', error);
            setDetailedCalculatedFields(prev => ({
                ...prev,
                [datasetId]: []
            }));
        } finally {
            setLoadingCalculatedFields(prev => ({ ...prev, [datasetId]: false }));
        }
    };
    const saveParameterFieldToAPI = async (fieldData: ParameterFieldData): Promise<any> => {
        if (!selectedTableForFields) {
            showToast('No table selected for field operations', 'error');
            return;
        }

        // Validate required field data before saving
        if (!fieldData.fieldName || !fieldData.fieldName.trim()) {
            showToast('Field Name is required. Please enter a field name before saving.', 'error');
            return;
        }

        if (!fieldData.fieldType || fieldData.fieldType.trim() === '') {
            showToast('Field Type is required. Please select a field type.', 'error');
            return;
        }

        try {
            setSavingParameter(true);

            let response;
            let result;

            if (fieldData.originalFieldName && fieldData.originalFieldName !== '') {
                // UPDATE existing field - use same structure as CREATE
                const updateRequestBody = {
                    field_name: fieldData.fieldName.trim(),
                    field_description: fieldData.fieldDescription?.trim() || '',
                    field_datatype: fieldData.fieldType,
                    field_value: fieldData.fieldValue?.trim() || '',
                    field_length: parseInt(fieldData.fieldLength) || 0,
                    is_required: false,
                    // is_key_figure: fieldData.isKeyFigure || false,
                    // is_categorical: fieldData.isCategorical || false
                };

                console.log('Updating parameter field:', fieldData.originalFieldName, 'with data:', updateRequestBody);

                response = await fetch(
                    `${API_BASE_URL}/main-boards/boards/parameter-settings/${selectedTableForFields}/fields`,
                    {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': EXCEL_API_KEY,
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(updateRequestBody)
                    }
                );

                if (response.ok) {
                    result = await response.json();
                    console.log('Parameter field updated successfully:', result);
                    showToast('Field updated successfully!', 'success');

                    setModifiedParameterRows(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(fieldData.id);
                        return newSet;
                    });

                    // Refresh the fields list
                    await handleManageFields(selectedTableForFields);
                } else {
                    const errorText = await response.text();
                    console.error('Parameter field update failed:', response.status, errorText);

                    // Parse error message
                    try {
                        const errorJson = JSON.parse(errorText);
                        showToast(`Update failed: ${errorJson.detail || errorText}`, 'error');
                    } catch {
                        showToast(`Update failed: ${errorText}`, 'error');
                    }
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
            } else {
                // CREATE new field
                const createRequestBody = {
                    field_name: fieldData.fieldName.trim(),
                    field_description: fieldData.fieldDescription?.trim() || '',
                    field_datatype: fieldData.fieldType,
                    field_value: fieldData.fieldValue?.trim() || '',
                    field_length: parseInt(fieldData.fieldLength) || 0,
                    is_required: false
                };

                console.log('Creating new parameter field with data:', createRequestBody);

                response = await fetch(
                    `${API_BASE_URL}/main-boards/boards/parameter-settings/${selectedTableForFields}/fields`,
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
                    console.log('Parameter field created successfully:', result);
                    showToast('Field created successfully!', 'success');

                    // Refresh the fields list
                    await handleManageFields(selectedTableForFields);
                } else {
                    const errorText = await response.text();
                    console.error('Parameter field create failed:', response.status, errorText);

                    // Parse error message
                    try {
                        const errorJson = JSON.parse(errorText);
                        showToast(`Creation failed: ${errorJson.detail || errorText}`, 'error');
                    } catch {
                        showToast(`Creation failed: ${errorText}`, 'error');
                    }
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
            }

            setSavedParameterRows(prev => new Set([...prev, fieldData.id]));
            return result;
        } catch (error) {
            console.error('Error saving parameter field:', error);
            if (error instanceof Error && !error.message.includes('HTTP error')) {
                showToast(`Error saving field: ${error.message}`, 'error');
            }
            throw error;
        } finally {
            setSavingParameter(false);
        }
    };

    const deleteParameterFieldFromAPI = async (fieldData: ParameterFieldData): Promise<void> => {
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
                `${API_BASE_URL}/main-boards/boards/parameter-settings/${selectedTableForFields}/fields/${encodeURIComponent(fieldNameToDelete)}`,
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
                console.error('Parameter field delete failed:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            console.log('Parameter field deleted successfully');
            showToast('Field deleted successfully!', 'success');

            setParameterData(prevData => prevData.filter(row => row.id !== fieldData.id));
            setSelectedParameterRows(prev => {
                const newSet = new Set(prev);
                newSet.delete(fieldData.id);
                return newSet;
            });
            setSavedParameterRows(prev => {
                const newSet = new Set(prev);
                newSet.delete(fieldData.id);
                return newSet;
            });

        } catch (error) {
            console.error('Error deleting parameter field:', error);
            showToast(`Error deleting field: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            throw error;
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        const file = files && files[0] ? files[0] : null;

        if (file) {
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                showToast('File size exceeds 10MB limit', 'error');
                event.target.value = '';
                setSelectedFile(null);
                return;
            }

            const allowedTypes = [
                'text/csv',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/json'
            ];

            if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls|json)$/i)) {
                showToast('Please select a CSV, Excel, or JSON file', 'error');
                event.target.value = '';
                setSelectedFile(null);
                return;
            }
        }

        setSelectedFile(file);
    };


    const handleDatasetUpload = async () => {
        if (!selectedFile) {
            showToast('Please select a file to upload', 'error');
            return;
        }

        if (!datasetTableName.trim() || !datasetDescription.trim()) {
            showToast('Please provide both table name and description', 'error');
            return;
        }

        // Perform duplicate check before uploading
        const isDuplicate = await checkTableNameDuplicate(datasetTableName);

        if (isDuplicate) {
            showToast(`A parameter table with the name "${datasetTableName.trim()}" already exists. Please use a different name.`, 'error');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('table_name', datasetTableName.trim());
            formData.append('description', datasetDescription.trim());
            formData.append('file', selectedFile);
            if (boardId) {
                formData.append('board_id', boardId);
            }

            const response = await fetch(
                `${API_BASE_URL}/main-boards/boards/parameter-settings/upload-minimal`,
                {
                    method: 'POST',
                    headers: {
                        "X-API-Key": EXCEL_API_KEY
                    },
                    body: formData
                }
            );

            if (response.ok) {
                const responseData = await response.json();
                console.log('Minimal dataset uploaded successfully:', responseData);
                showToast('Dataset uploaded and parameter table created successfully!', 'success');
                setShowDatasetModal(false);
                setSelectedFile(null);
                setDatasetTableName('');
                setDatasetDescription('');
                setTableNameError(''); // Clear error on success

                await fetchTables();
            } else {
                const errorData = await response.json();
                console.error('Dataset upload failed:', errorData);

                // Check if error is about duplicate name
                if (errorData.detail && errorData.detail.toLowerCase().includes('already exists')) {
                    showToast('A table with this name already exists. Please use a different name.', 'error');
                    setTableNameError('This table name already exists');
                } else {
                    showToast(`Upload failed: ${errorData.detail || 'Unknown error'}`, 'error');
                }
            }
        } catch (error) {
            console.error('Error uploading dataset:', error);
            showToast('Error uploading dataset', 'error');
        } finally {
            setUploading(false);
        }
    };

    // Add this function to check for duplicates in real-time
    const checkTableNameDuplicate = async (name: string): Promise<boolean> => {
        if (!name.trim()) {
            setTableNameError('');
            return false;
        }

        // Check in current tables state (client-side check)
        const duplicateInState = tables.find(
            table => table.table_name.toLowerCase().trim() === name.trim().toLowerCase()
        );

        if (duplicateInState) {
            setTableNameError('This table name already exists');
            return true;
        }

        // Also check server-side to be extra sure
        try {
            setIsCheckingDuplicate(true);
            const response = await fetch(
                `${API_BASE_URL}/main-boards/boards/parameter-settings/?active_only=false`,
                {
                    headers: {
                        "X-API-Key": EXCEL_API_KEY
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();

                // Filter by current boardId if it exists
                const relevantTables = boardId
                    ? data.filter((table: any) => {
                        const tableBoardId = table.board_id || table.boardId || table.board || table.id;
                        return String(tableBoardId) === String(boardId);
                    })
                    : data;

                const duplicateOnServer = relevantTables.find(
                    (table: any) => table.table_name.toLowerCase().trim() === name.trim().toLowerCase()
                );

                if (duplicateOnServer) {
                    setTableNameError('This table name already exists');
                    setIsCheckingDuplicate(false);
                    return true;
                }
            }
        } catch (error) {
            console.error('Error checking for duplicate:', error);
        } finally {
            setIsCheckingDuplicate(false);
        }

        setTableNameError('');
        return false;
    };

    useEffect(() => {
        if (editingParameterCell && parameterInputRef.current) {
            parameterInputRef.current.focus();
            if (parameterInputRef.current instanceof HTMLInputElement) {
                parameterInputRef.current.select();
            }
        }
    }, [editingParameterCell]);

    // Add this useEffect to cleanup the timer
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const handleParameterCellClick = (rowId: number, field: keyof ParameterFieldData, currentValue: string): void => {
        setEditingParameterCell({ rowId, field: field as string });
        setEditParameterValue(currentValue || '');
    };

    const handleParameterCellSave = (rowId: number, field: keyof ParameterFieldData): void => {
        setParameterData(prevData =>
            prevData.map(row => {
                if (row.id === rowId) {
                    return { ...row, [field]: editParameterValue };
                }
                return row;
            })
        );

        setModifiedParameterRows(prev => new Set([...prev, rowId]));
        setEditingParameterCell(null);
        setEditParameterValue('');
    };

    const handleParameterCellCancel = (id: number, field: string, value: string): void => {
        setEditingParameterCell(null);
        setEditParameterValue('');
    };

    const handleParameterKeyDown = (e: React.KeyboardEvent, rowId: number, field: keyof ParameterFieldData): void => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleParameterCellSave(rowId, field);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleParameterCellCancel(rowId, field as string, editParameterValue);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            handleParameterCellSave(rowId, field);
        }
    };

    const addNewParameterRow = (): void => {
        const newId = Math.max(...parameterData.map(row => row.id), 0) + 1;
        const newRow: ParameterFieldData = {
            id: newId,
            fieldName: '',
            fieldDescription: '',
            fieldType: 'char',
            fieldLength: '',
            fieldValue: '',
            originalFieldName: '' // Empty originalFieldName indicates it's a new field
        };

        const updatedData = [...parameterData, newRow];
        setParameterData(updatedData);

        // Calculate the page where the new field will be and navigate to it
        const newTotalPages = Math.ceil(updatedData.length / fieldsPerPage);
        setCurrentFieldsPage(newTotalPages);

        console.log('New field added:', newRow);
        console.log('Total fields after add:', updatedData.length);
        console.log('Current page:', newTotalPages);

        showToast('New field row added. Click cells to edit, then save!', 'success');
    };

    const toggleParameterRowSelection = (rowId: number): void => {
        const newSelected = new Set(selectedParameterRows);
        if (newSelected.has(rowId)) {
            newSelected.delete(rowId);
        } else {
            newSelected.add(rowId);
        }
        setSelectedParameterRows(newSelected);
    };

    const selectAllParameterRows = (): void => {
        if (selectedParameterRows.size === parameterData.length) {
            setSelectedParameterRows(new Set());
        } else {
            setSelectedParameterRows(new Set(parameterData.map(row => row.id)));
        }
    };

    const saveAllParameterFields = async (): Promise<void> => {
        if (!selectedTableForFields) {
            showToast('No table selected for field operations', 'error');
            return;
        }

        try {
            setSavingParameter(true);
            const promises = parameterData.map(row => saveParameterFieldToAPI(row));
            await Promise.all(promises);
            showToast('All fields saved successfully!', 'success');
            await handleManageFields(selectedTableForFields);
        } catch (error) {
            console.error('Error saving all parameter fields:', error);
        } finally {
            setSavingParameter(false);
        }
    };

    const saveSelectedParameterFields = async (): Promise<void> => {
        if (!selectedTableForFields) {
            showToast('No table selected for field operations', 'error');
            return;
        }

        try {
            setSavingParameter(true);
            const selectedData = parameterData.filter(row => selectedParameterRows.has(row.id));
            const promises = selectedData.map(row => saveParameterFieldToAPI(row));
            await Promise.all(promises);
            showToast(`${selectedData.length} fields saved successfully!`, 'success');
            await handleManageFields(selectedTableForFields);
        } catch (error) {
            console.error('Error saving selected parameter fields:', error);
        } finally {
            setSavingParameter(false);
        }
    };

    const deleteSelectedParameterRows = (): void => {
        setParameterData(parameterData.filter(row => !selectedParameterRows.has(row.id)));
        setSelectedParameterRows(new Set());
    };

    const renderParameterCell = (row: ParameterFieldData, field: string, label: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined) => {
        const isEditing = editingParameterCell?.rowId === row.id && editingParameterCell?.field === field;
        const value = row[field];

        // Make field name non-editable for existing fields
        if (field === 'fieldName' && row.originalFieldName) {
            return (
                <div className="px-2 py-1 text-xs text-gray-700 bg-gray-50 rounded flex items-center space-x-1">
                    <Lock className="h-3 w-3 text-gray-400" />
                    <span>{value || 'N/A'}</span>
                </div>
            );
        }

        // Make calculated fields read-only (except fieldValue which shows the formula)
        if (row.isCalculated && field !== 'fieldValue') {
            return (
                <div className="px-2 py-1 text-xs text-gray-700 bg-purple-50 rounded flex items-center space-x-1">
                    {field === 'fieldType' && <span className="px-1 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">CALC</span>}
                    <span>{value || 'N/A'}</span>
                </div>
            );
        }

        if (isEditing) {
            // Special handling for field type - show dropdown
            if (field === 'fieldType') {
                return (
                    <select
                        value={value || 'char'}
                        onChange={(e) => {
                            setParameterData(prevData =>
                                prevData.map(r => {
                                    if (r.id === row.id) {
                                        return { ...r, [field]: e.target.value };
                                    }
                                    return r;
                                })
                            );
                            setModifiedParameterRows(prev => new Set([...prev, row.id]));
                        }}
                        onBlur={() => setEditingParameterCell(null)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setEditingParameterCell(null);
                            } else if (e.key === 'Escape') {
                                setEditingParameterCell(null);
                            }
                        }}
                        autoFocus
                        className="w-full px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        {parameterFieldTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                );
            }

            // Regular text input for other fields
            return (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => {
                        // Update the field value in parameterData
                        setParameterData(prevData =>
                            prevData.map(r => {
                                if (r.id === row.id) {
                                    return { ...r, [field]: e.target.value };
                                }
                                return r;
                            })
                        );
                        // Mark row as modified
                        setModifiedParameterRows(prev => new Set([...prev, row.id]));
                    }}
                    onBlur={() => setEditingParameterCell(null)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            setEditingParameterCell(null);
                        } else if (e.key === 'Escape') {
                            setEditingParameterCell(null);
                        }
                    }}
                    autoFocus
                    className="w-full px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={typeof label === 'string' ? label : label !== undefined && label !== null ? String(label) : ''}
                />
            );
        }

        return (
            <div
                onClick={() => !row.isCalculated && setEditingParameterCell({ rowId: row.id, field })}
                className={`px-2 py-1 text-xs rounded min-h-[24px] ${row.isCalculated && field !== 'fieldValue'
                    ? 'bg-purple-50 text-gray-700'
                    : 'cursor-pointer hover:bg-gray-100'
                    }`}
            >
                {value || <span className="text-gray-400 italic">{label}</span>}
            </div>
        );
    };

    const resetFormulaBuilder = () => {
        setFormulaBuilder({
            name: '',
            display_name: '',
            description: '',
            formula: '',
            selected_fields: []
        });
    };

    const handleFieldSelection = (field: string, isSelected: boolean) => {
        if (isSelected) {
            setSelectedFields(prev => [...prev, field]);
        } else {
            setSelectedFields(prev => prev.filter(f => f !== field));
        }
    };

    const addFieldToFormula = (field: string) => {
        setFormulaBuilder(prev => ({
            ...prev,
            formula: prev.formula + `[${field}]`,
            selected_fields: [...new Set([...prev.selected_fields, field])]
        }));
    };

    const addOperatorToFormula = (operator: string) => {
        setFormulaBuilder(prev => ({
            ...prev,
            formula: prev.formula + ` ${operator} `
        }));
    };

    const clearFormula = () => {
        setFormulaBuilder(prev => ({
            ...prev,
            formula: '',
            selected_fields: []
        }));
    };

    const createCalculatedKeyFigure = async (datasetId: string | number) => {
        if (!formulaBuilder.name.trim() || !formulaBuilder.formula.trim()) {
            showToast('Please provide both name and formula', 'error');
            return;
        }

        try {
            setCreatingFormula(true);
            const response = await fetch(`${API_BASE_URL}/main-boards/boards/parameter-settings/${datasetId}/calculated-key-figures`, {
                method: 'POST',
                headers: {
                    "X-API-Key": EXCEL_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formulaBuilder.name.trim(),
                    display_name: formulaBuilder.display_name.trim() || formulaBuilder.name.trim(),
                    description: formulaBuilder.description.trim(),
                    formula: formulaBuilder.formula.trim(),
                    referenced_columns: formulaBuilder.selected_fields
                })
            });

            if (response.ok) {
                const responseData = await response.json();
                console.log('Calculated field created:', responseData);

                showToast('Calculated key figure created successfully!', 'success');

                setDetailedCalculatedFields(prev => ({
                    ...prev,
                    [datasetId]: responseData.calculated_key_figures || []
                }));

                resetFormulaBuilder();
            } else {
                const errorData = await response.json();
                console.error('Creation failed:', errorData);
                showToast(`Creation failed: ${errorData.message || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error creating calculated key figure:', error);
            showToast(`Error: ${String(error)}`, 'error');
        } finally {
            setCreatingFormula(false);
        }
    };

    const selectedTable = tables.find(d => d.id === selectedTableForFields);

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <div className="flex justify-end">
                        <button
                            onClick={async () => {
                                setDatasetTableName('');
                                setDatasetDescription('');
                                setSelectedFile(null);
                                setSelectedTableForFields(null);
                                setTableNameError('');
                                // Refresh tables before opening modal to ensure we have latest data
                                await fetchTables();
                                setShowDatasetModal(true);
                            }}
                            className="px-4 py-2 rounded-lg flex items-center space-x-2 shadow-sm transition-colors duration-150 bg-blue-500 text-white hover:bg-purple-700"
                            title="Upload minimal dataset to create parameter table"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Upload Minimal Dataset</span>
                        </button>
                    </div>
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
                                                ? 'Please select a board to manage parameter tables.'
                                                : 'No parameter table found for this board. Click "Upload Minimal Dataset" to create your table.'
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
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleExpanded(table.id);
                                                            }}
                                                            className="text-green-600 hover:text-green-800 p-1"
                                                            title="Manage table"
                                                        >
                                                            {expandedTable === table.id ? (
                                                                <ChevronUp className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteTable(table.id, table.table_name);
                                                            }}
                                                            className="text-red-600 hover:text-red-800 p-1"
                                                            title="Delete table"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {expandedTable === table.id && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan={3} className="px-6 py-4">
                                                        <div className="space-y-4">
                                                            <div className="flex border-b border-gray-200">
                                                                <button
                                                                    onClick={() => setActiveTab('fields')}
                                                                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'fields'
                                                                        ? 'border-blue-500 text-blue-600'
                                                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                                                        }`}
                                                                >
                                                                    All Fields ({parameterData.length})
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveTab('key_figures');
                                                                        if (selectedTableForFields) {
                                                                            fetchDetailedCalculatedFields(selectedTableForFields);
                                                                        }
                                                                    }}
                                                                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'key_figures'
                                                                        ? 'border-blue-500 text-blue-600'
                                                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                                                        }`}
                                                                >
                                                                    Key Figures ({table.key_figures?.length || 0})
                                                                </button>
                                                                <button
                                                                    onClick={() => setActiveTab('categorical')}
                                                                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'categorical'
                                                                        ? 'border-blue-500 text-blue-600'
                                                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                                                        }`}
                                                                >
                                                                    Categorical + Calculated ({(table.categorical_columns?.length || 0) + (selectedTableForFields && detailedCalculatedFields[selectedTableForFields]?.length || 0)})
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveTab('calculated');
                                                                        if (selectedTableForFields) {
                                                                            fetchDetailedCalculatedFields(selectedTableForFields);
                                                                        }
                                                                    }}
                                                                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'calculated'
                                                                        ? 'border-blue-500 text-blue-600'
                                                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                                                        }`}
                                                                >
                                                                    Calculated Details (
                                                                    {selectedTableForFields && detailedCalculatedFields[selectedTableForFields]?.length || 0}
                                                                    )
                                                                </button>
                                                            </div>

                                                            {activeTab === 'fields' && (
                                                                <div>
                                                                    <div className="mb-4 flex justify-between items-center">
                                                                        <h4 className="text-lg font-medium text-gray-900">Manage Fields</h4>
                                                                        <div className="flex space-x-2">
                                                                            <button
                                                                                onClick={addNewParameterRow}
                                                                                disabled={savingParameter}
                                                                                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-1 text-sm disabled:opacity-50"
                                                                            >
                                                                                <Plus className="h-3 w-3" />
                                                                                <span>Add Field</span>
                                                                            </button>

                                                                            {selectedParameterRows.size > 0 && (
                                                                                <div className="flex space-x-3">
                                                                                    <button
                                                                                        onClick={saveSelectedParameterFields}
                                                                                        disabled={savingParameter}
                                                                                        className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-1 text-sm disabled:opacity-50"
                                                                                    >
                                                                                        {savingParameter ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                                                        <span>Save ({selectedParameterRows.size})</span>
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={deleteSelectedParameterRows}
                                                                                        disabled={savingParameter}
                                                                                        className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center space-x-1 text-sm disabled:opacity-50"
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                        <span>Delete ({selectedParameterRows.size})</span>
                                                                                    </button>
                                                                                </div>
                                                                            )}

                                                                            <button
                                                                                onClick={saveAllParameterFields}
                                                                                disabled={savingParameter}
                                                                                className="px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center space-x-1 text-sm disabled:opacity-50"
                                                                            >
                                                                                {savingParameter ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
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
                                                                                                checked={selectedParameterRows.size === parameterData.length && parameterData.length > 0}
                                                                                                onChange={selectAllParameterRows}
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
                                                                                {/* <tbody> */}
                                                                                <tbody>
                                                                                    {currentFields.map((row, index) => (
                                                                                        <tr
                                                                                            key={row.id}
                                                                                            className={`border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 ${row.isCalculated ? 'bg-purple-50' : ''
                                                                                                } ${selectedParameterRows.has(row.id) ? 'bg-blue-50' : ''
                                                                                                } ${savedParameterRows.has(row.id) ? 'bg-green-50 border-green-200' : ''} ${modifiedParameterRows.has(row.id) ? 'bg-orange-50 border-orange-200' : ''
                                                                                                }`}
                                                                                        >
                                                                                            <td className="w-8 px-2 py-1 border-r border-gray-100">
                                                                                                <div className="flex items-center space-x-1">
                                                                                                    <input
                                                                                                        type="checkbox"
                                                                                                        checked={selectedParameterRows.has(row.id)}
                                                                                                        onChange={() => toggleParameterRowSelection(row.id)}
                                                                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                                                        disabled={row.isCalculated} // Disable selection for calculated fields
                                                                                                    />
                                                                                                    {savedParameterRows.has(row.id) && (
                                                                                                        <Check className="h-2 w-2 text-green-600" />
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="px-1 py-1 border-r border-gray-100 min-w-[150px]">
                                                                                                {renderParameterCell(row, 'fieldName', 'Field Name')}
                                                                                            </td>
                                                                                            <td className="px-1 py-1 border-r border-gray-100 min-w-[200px]">
                                                                                                {renderParameterCell(row, 'fieldDescription', 'Field Description')}
                                                                                            </td>
                                                                                            <td className="px-1 py-1 border-r border-gray-100 min-w-[100px]">
                                                                                                {renderParameterCell(row, 'fieldType', 'Field Type')}
                                                                                            </td>
                                                                                            <td className="px-1 py-1 border-r border-gray-100 min-w-[80px]">
                                                                                                {renderParameterCell(row, 'fieldLength', 'Field Length')}
                                                                                            </td>
                                                                                            <td className="px-1 py-1 border-r border-gray-100 min-w-[150px]">
                                                                                                {renderParameterCell(row, 'fieldValue', 'Field Value')}
                                                                                            </td>
                                                                                            <td className="px-2 py-1 text-center">
                                                                                                <div className="flex items-center justify-center space-x-1">
                                                                                                    {!row.isCalculated ? (
                                                                                                        <>
                                                                                                            <button
                                                                                                                onClick={async () => {
                                                                                                                    try {
                                                                                                                        await saveParameterFieldToAPI(row);
                                                                                                                    } catch (error) {
                                                                                                                        // Error handled in saveParameterFieldToAPI
                                                                                                                    }
                                                                                                                }}
                                                                                                                disabled={savingParameter}
                                                                                                                className={`${modifiedParameterRows.has(row.id) || !row.originalFieldName
                                                                                                                    ? 'text-orange-600 hover:text-orange-800'
                                                                                                                    : 'text-green-600 hover:text-green-800'
                                                                                                                    } disabled:opacity-50`}
                                                                                                                title={!row.originalFieldName ? 'Save new field' : modifiedParameterRows.has(row.id) ? 'Update this field' : 'Save this field'}
                                                                                                            >
                                                                                                                {!row.originalFieldName || modifiedParameterRows.has(row.id) ? (
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
                                                                                                                                    await deleteParameterFieldFromAPI(row);
                                                                                                                                } else {
                                                                                                                                    setParameterData(parameterData.filter(r => r.id !== row.id));
                                                                                                                                    setSelectedParameterRows(prev => {
                                                                                                                                        const newSet = new Set(prev);
                                                                                                                                        newSet.delete(row.id);
                                                                                                                                        return newSet;
                                                                                                                                    });
                                                                                                                                    showToast('Field deleted successfully', 'success');
                                                                                                                                }
                                                                                                                            } catch (error) {
                                                                                                                                // Error handled in deleteParameterFieldFromAPI
                                                                                                                            }
                                                                                                                        }
                                                                                                                    );
                                                                                                                }}
                                                                                                                className="text-red-600 hover:text-red-800"
                                                                                                                title="Delete this field"
                                                                                                            >
                                                                                                                <Trash2 className="h-3 w-3" />
                                                                                                            </button>
                                                                                                        </>
                                                                                                    ) : (
                                                                                                        <span className="text-xs text-purple-600 italic">Calculated</span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                    {parameterData.length === 0 && (
                                                                                        <tr>
                                                                                            <td colSpan={7} className="px-4 py-6 text-center text-gray-500 text-sm">
                                                                                                <div className="flex flex-col items-center space-y-2">
                                                                                                    <span>No fields available for this table.</span>
                                                                                                    <button
                                                                                                        onClick={addNewParameterRow}
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
                                                                            <span>Total: {parameterData.length} | Selected: {selectedParameterRows.size}</span>
                                                                            <span className="text-green-600">✓ Saved: {savedParameterRows.size}</span>
                                                                            {savingParameter && (
                                                                                <div className="flex items-center space-x-1 text-blue-600">
                                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                                    <span>Saving...</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {parameterData.length > fieldsPerPage && (
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

                                                            {activeTab === 'key_figures' && selectedTable && (
                                                                <div>
                                                                    {showFormulaBuilder && (
                                                                        <div className="mt-6 pt-6 border-t border-gray-200">
                                                                            <h5 className="text-md font-semibold text-gray-800 mb-4">Create New Calculated Field</h5>

                                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                                <div className="space-y-4">
                                                                                    <div>
                                                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name: *</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={formulaBuilder.name}
                                                                                            required
                                                                                            onChange={(e) => setFormulaBuilder(prev => ({ ...prev, name: e.target.value }))}
                                                                                            className="w-full p-2 border border-gray-300 rounded text-sm"
                                                                                            placeholder="Enter field name"
                                                                                        />
                                                                                    </div>

                                                                                    <div>
                                                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Display Name: *</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={formulaBuilder.display_name}
                                                                                            required
                                                                                            onChange={(e) => setFormulaBuilder(prev => ({ ...prev, display_name: e.target.value }))}
                                                                                            className="w-full p-2 border border-gray-300 rounded text-sm"
                                                                                            placeholder="Enter display name"
                                                                                        />
                                                                                    </div>

                                                                                    <div>
                                                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description:</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={formulaBuilder.description}
                                                                                            onChange={(e) => setFormulaBuilder(prev => ({ ...prev, description: e.target.value }))}
                                                                                            className="w-full p-2 border border-gray-300 rounded text-sm"
                                                                                            placeholder="Enter description"
                                                                                        />
                                                                                    </div>

                                                                                    <div>
                                                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Formula: *</label>
                                                                                        <textarea
                                                                                            value={formulaBuilder.formula}
                                                                                            required
                                                                                            onChange={(e) => setFormulaBuilder(prev => ({ ...prev, formula: e.target.value }))}
                                                                                            className="w-full p-2 border border-gray-300 rounded text-sm font-mono"
                                                                                            rows={3}
                                                                                            placeholder="Build your formula using fields and operators"
                                                                                        />
                                                                                    </div>
                                                                                </div>

                                                                                <div className="space-y-4">
                                                                                    {selectedFields.length > 0 && (
                                                                                        <div>
                                                                                            <label className="block text-sm font-medium text-gray-700 mb-2">Add Selected Fields:</label>
                                                                                            <div className="flex flex-wrap gap-1">
                                                                                                {selectedFields.map((field, index) => (
                                                                                                    <button
                                                                                                        key={index}
                                                                                                        onClick={() => addFieldToFormula(field)}
                                                                                                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200"
                                                                                                    >
                                                                                                        {field}
                                                                                                    </button>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    <div>
                                                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Operators:</label>
                                                                                        <div className="flex flex-wrap gap-1">
                                                                                            {['+', '-', '*', '/', '(', ')', '%'].map((op) => (
                                                                                                <button
                                                                                                    key={op}
                                                                                                    onClick={() => addOperatorToFormula(op)}
                                                                                                    className="px-3 py-1 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
                                                                                                >
                                                                                                    {op}
                                                                                                </button>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="flex gap-2">
                                                                                        <button
                                                                                            onClick={clearFormula}
                                                                                            className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                                                                                        >
                                                                                            Clear
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => createCalculatedKeyFigure(selectedTableForFields!)}
                                                                                            disabled={creatingFormula || !formulaBuilder.name.trim() || !formulaBuilder.formula.trim()}
                                                                                            className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                                                                        >
                                                                                            {creatingFormula ? 'Creating...' : 'Create Field'}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <div className="flex justify-between items-center mb-4">
                                                                        <h4 className="text-md font-semibold text-gray-800">Key Figures</h4>
                                                                        <button
                                                                            onClick={() => setShowFormulaBuilder(!showFormulaBuilder)}
                                                                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                                                        >
                                                                            {showFormulaBuilder ? 'Hide' : 'Create'} Formula
                                                                        </button>
                                                                    </div>

                                                                    {selectedTable.key_figures && selectedTable.key_figures.length > 0 ? (
                                                                        <div className="border border-gray-300 rounded overflow-hidden">
                                                                            <table className="w-full">
                                                                                <thead className="bg-gray-100">
                                                                                    <tr>
                                                                                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                                                                                            Select
                                                                                        </th>
                                                                                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                                                                                            Field Name
                                                                                        </th>
                                                                                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                                                                                            Type
                                                                                        </th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {selectedTable.key_figures.map((field: string, index: number) => (
                                                                                        <tr key={index} className="border-b border-gray-200 hover:bg-blue-50">
                                                                                            <td className="px-4 py-2 border-r border-gray-200">
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    checked={selectedFields.includes(field)}
                                                                                                    onChange={(e) => handleFieldSelection(field, e.target.checked)}
                                                                                                    className="w-4 h-4"
                                                                                                />
                                                                                            </td>
                                                                                            <td className="px-4 py-2 border-r border-gray-200 font-mono text-sm">
                                                                                                {field}
                                                                                            </td>
                                                                                            <td className="px-4 py-2 text-sm text-gray-600">
                                                                                                Numeric
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-center py-8 text-gray-500">
                                                                            No key figures found in this dataset. Upload a dataset to see key figures.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {activeTab === 'categorical' && selectedTable && (
                                                                <div>
                                                                    <h4 className="text-md font-semibold text-gray-800 mb-4">Categorical Columns & Calculated Fields</h4>

                                                                    {((selectedTable.categorical_columns && selectedTable.categorical_columns.length > 0) ||
                                                                        (selectedTableForFields && detailedCalculatedFields[selectedTableForFields] && detailedCalculatedFields[selectedTableForFields].length > 0)) ? (
                                                                        <div className="border border-gray-300 rounded overflow-hidden">
                                                                            <table className="w-full">
                                                                                <thead className="bg-gray-100">
                                                                                    <tr>
                                                                                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                                                                                            Field Name
                                                                                        </th>
                                                                                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                                                                                            Type
                                                                                        </th>
                                                                                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                                                                                            Details
                                                                                        </th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {selectedTable.categorical_columns && selectedTable.categorical_columns.map((field: string, index: number) => (
                                                                                        <tr key={`cat-${index}`} className="border-b border-gray-200 hover:bg-green-50">
                                                                                            <td className="px-4 py-2 border-r border-gray-200 font-mono text-sm">
                                                                                                {field}
                                                                                            </td>
                                                                                            <td className="px-4 py-2 border-r border-gray-200">
                                                                                                <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
                                                                                                    Categorical
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-4 py-2 text-sm text-gray-600">
                                                                                                Text/Categorical column from dataset
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}

                                                                                    {selectedTableForFields && detailedCalculatedFields[selectedTableForFields] &&
                                                                                        detailedCalculatedFields[selectedTableForFields].map((field: any, index: number) => (
                                                                                            <tr key={`calc-${index}`} className="border-b border-gray-200 hover:bg-purple-50">
                                                                                                <td className="px-4 py-2 border-r border-gray-200 font-mono text-sm">
                                                                                                    <div className="flex items-center">
                                                                                                        {field.name}
                                                                                                        <span className="ml-2 px-1 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">
                                                                                                            CALC
                                                                                                        </span>
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td className="px-4 py-2 border-r border-gray-200">
                                                                                                    <span className="inline-block bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium">
                                                                                                        Calculated
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td className="px-4 py-2 text-sm text-gray-600">
                                                                                                    <div className="space-y-1">
                                                                                                        <div><strong>Formula:</strong> <code className="text-xs bg-gray-100 px-1 rounded">{field.formula}</code></div>
                                                                                                        {field.description && (
                                                                                                            <div><strong>Description:</strong> {field.description}</div>
                                                                                                        )}
                                                                                                        {field.referenced_columns && field.referenced_columns.length > 0 && (
                                                                                                            <div>
                                                                                                                <strong>Uses:</strong>{' '}
                                                                                                                {field.referenced_columns.map((col: string, colIndex: number) => (
                                                                                                                    <span key={colIndex} className="inline-block bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-xs mr-1">
                                                                                                                        {col}
                                                                                                                    </span>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-center py-8 text-gray-500">
                                                                            No categorical columns or calculated fields found. Upload a dataset or create calculated fields to see them here.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {activeTab === 'calculated' && (
                                                                <div>
                                                                    <h4 className="text-md font-semibold text-gray-800 mb-4">Calculated Key Figures</h4>

                                                                    {selectedTableForFields && loadingCalculatedFields[selectedTableForFields] ? (
                                                                        <div className="text-center py-8 text-gray-500">
                                                                            Loading calculated field details...
                                                                        </div>
                                                                    ) : selectedTableForFields && detailedCalculatedFields[selectedTableForFields] && detailedCalculatedFields[selectedTableForFields].length > 0 ? (
                                                                        <div className="border border-gray-300 rounded overflow-hidden">
                                                                            <table className="w-full">
                                                                                <thead className="bg-gray-100">
                                                                                    <tr>
                                                                                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                                                                                            Field Name
                                                                                        </th>
                                                                                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                                                                                            Formula
                                                                                        </th>
                                                                                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                                                                                            Referenced Columns
                                                                                        </th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {detailedCalculatedFields[selectedTableForFields].map((field: any, index: number) => (
                                                                                        <tr key={index} className="border-b border-gray-200 hover:bg-purple-50">
                                                                                            <td className="px-4 py-2 border-r border-gray-200 font-mono text-sm">
                                                                                                {field.name}
                                                                                            </td>
                                                                                            <td className="px-4 py-2 border-r border-gray-200 font-mono text-xs bg-gray-50">
                                                                                                {field.formula}
                                                                                            </td>
                                                                                            <td className="px-4 py-2 border-r border-gray-200">
                                                                                                {field.referenced_columns && field.referenced_columns.length > 0 ? (
                                                                                                    <div className="flex flex-wrap gap-1">
                                                                                                        {field.referenced_columns.map((col: string, colIndex: number) => (
                                                                                                            <span key={colIndex} className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                                                                                                                {col}
                                                                                                            </span>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <span className="text-gray-400 text-sm">None</span>
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-center py-8 text-gray-500">
                                                                            No calculated fields found in this dataset
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
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

                {showDatasetModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-medium text-gray-900">Upload Minimal Dataset</h3>
                                    <button
                                        onClick={() => {
                                            setShowDatasetModal(false);
                                            setSelectedFile(null);
                                            setDatasetTableName('');
                                            setDatasetDescription('');
                                            setTableNameError(''); // Clear error on close
                                        }}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="px-6 py-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Parameter Table Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={datasetTableName}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setDatasetTableName(value);

                                            // Clear previous timeout
                                            if (debounceTimerRef.current) {
                                                clearTimeout(debounceTimerRef.current);
                                            }

                                            // Clear error if input is empty
                                            if (!value.trim()) {
                                                setTableNameError('');
                                                setIsCheckingDuplicate(false);
                                                return;
                                            }

                                            // Set checking state immediately for better UX
                                            setIsCheckingDuplicate(true);

                                            // Debounced check - wait 500ms after user stops typing
                                            debounceTimerRef.current = setTimeout(async () => {
                                                await checkTableNameDuplicate(value);
                                            }, 500);
                                        }}
                                        onBlur={async () => {
                                            // Also check on blur to catch edge cases
                                            if (datasetTableName.trim()) {
                                                // Clear any pending debounce
                                                if (debounceTimerRef.current) {
                                                    clearTimeout(debounceTimerRef.current);
                                                }
                                                await checkTableNameDuplicate(datasetTableName);
                                            }
                                        }}
                                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${tableNameError ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        placeholder="Enter table name"
                                    />
                                    {isCheckingDuplicate && (
                                        <p className="mt-1 text-xs text-blue-600 flex items-center">
                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                            Checking availability...
                                        </p>
                                    )}
                                    {tableNameError && !isCheckingDuplicate && (
                                        <p className="mt-1 text-xs text-red-600 flex items-center">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            {tableNameError}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description *
                                    </label>
                                    <textarea
                                        value={datasetDescription}
                                        onChange={(e) => setDatasetDescription(e.target.value)}
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="Enter description"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Upload Dataset File *
                                    </label>
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".csv,.xlsx,.xls,.json"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Upload a CSV/Excel file with column names and one row of sample values
                                    </p>
                                    {selectedFile && (
                                        <p className="mt-1 text-xs text-green-600">Selected: {selectedFile.name}</p>
                                    )}
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                    <p className="text-xs text-blue-800">
                                        <strong>Note:</strong> The dataset should contain only column headers and a single row with sample values. This will create a new parameter table with all fields automatically extracted from the dataset.
                                    </p>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        setShowDatasetModal(false);
                                        setSelectedFile(null);
                                        setDatasetTableName('');
                                        setDatasetDescription('');
                                        setTableNameError(''); // Clear error on cancel
                                    }}
                                    disabled={uploading}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDatasetUpload}
                                    disabled={
                                        uploading ||
                                        !selectedFile ||
                                        !datasetTableName.trim() ||
                                        !datasetDescription.trim() ||
                                        tableNameError !== '' ||  // More explicit check
                                        isCheckingDuplicate
                                    }
                                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Uploading...</span>
                                        </>
                                    ) : isCheckingDuplicate ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Checking...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4" />
                                            <span>Create & Upload</span>
                                        </>
                                    )}
                                </button>
                            </div>
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
            </div>
        </div>
    );
};

export default ParameterSettings;