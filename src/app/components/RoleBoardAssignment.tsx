"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface Role {
  id: string;
  name: string;
}

interface Board {
  id: string;
  name: string;
  is_active?: boolean;
  main_board_id?: string;
}

interface MainBoard {
  id: string;
  name: string;
  boards: Board[];
  is_active?: boolean;
  main_board_id?: string;
}

// Accordion component
const Accordion = ({
  title,
  children,
  isOpen = true,
  onToggle
}: {
  title: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}) => {
  return (
    <div className="border rounded-lg mb-2 overflow-hidden">
      <button
        className={`w-full p-3 bg-gray-100 border-b flex justify-between items-center ${isOpen ? 'bg-gray-200' : ''}`}
        onClick={onToggle}
      >
        <h4 className="font-medium text-left">{title}</h4>
        <svg
          className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`transition-all duration-300 ${isOpen ? 'block' : 'hidden'}`}>
        {children}
      </div>
    </div>
  );
};

export default function BoardRoleAssignment() {
  const [isMounted, setIsMounted] = useState(false);
  const [mainBoards, setMainBoards] = useState<MainBoard[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [assignedBoardIds, setAssignedBoardIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedMainBoards, setExpandedMainBoards] = useState<Record<string, boolean>>({});
  const [boardSearchTerm, setBoardSearchTerm] = useState<string>('');
  const [reportFormat, setReportFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [currentRoleOnly, setCurrentRoleOnly] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [boardToRemove, setBoardToRemove] = useState<{ boardId: string; boardName: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState({
    name: "",
    email: "",
    id: "",
    role: "",
  });

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  // ✅ FIX 1: Set isMounted to true on client mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch user details from localStorage inside useEffect
  useEffect(() => {
    if (!isMounted) return;
    try {
      setUser({
        name: localStorage.getItem("loggedInUserName") || "",
        email: localStorage.getItem("loggedInUserEmail") || "",
        id: localStorage.getItem("loggedInUserId") || "",
        role: localStorage.getItem("loggedInUserRole") || "",
      });
    } catch (error) {
      console.error("Error accessing localStorage:", error);
    }
  }, [isMounted]);

  // Toggle dropdown visibility
  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isMounted) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMounted]);

  // Filter main boards based on search term
  const filteredMainBoards = useMemo(() => {
    return mainBoards.map(mainBoard => {
      const mainBoardMatches = mainBoard.name.toLowerCase().includes(boardSearchTerm.toLowerCase());
      const filteredSubBoards = mainBoard.boards.filter(board =>
        board.name.toLowerCase().includes(boardSearchTerm.toLowerCase())
      );
      if (!boardSearchTerm) return mainBoard;
      if (mainBoardMatches || filteredSubBoards.length > 0) {
        return {
          ...mainBoard,
          boards: mainBoardMatches ? mainBoard.boards : filteredSubBoards
        };
      }
      return null;
    }).filter(Boolean) as MainBoard[];
  }, [mainBoards, boardSearchTerm]);

  // Toggle main board expansion
  const toggleMainBoard = (mainBoardId: string) => {
    setExpandedMainBoards(prev => ({
      ...prev,
      [mainBoardId]: !prev[mainBoardId]
    }));
  };

  // Auto-close success messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Initialize expanded state when main boards are loaded
  useEffect(() => {
    if (mainBoards.length > 0) {
      const initialExpandedState = mainBoards.reduce((acc, board) => {
        acc[board.id] = false;
        return acc;
      }, {} as Record<string, boolean>);
      setExpandedMainBoards(initialExpandedState);
    }
  }, [mainBoards.length]);

  // Auto-expand main boards when searching
  useEffect(() => {
    if (boardSearchTerm && mainBoards.length > 0) {
      const expandedState: Record<string, boolean> = {};
      mainBoards.forEach(board => {
        const mainBoardMatches = board.name.toLowerCase().includes(boardSearchTerm.toLowerCase());
        const hasMatchingSubBoards = board.boards.some(b =>
          b.name.toLowerCase().includes(boardSearchTerm.toLowerCase())
        );
        if (mainBoardMatches || hasMatchingSubBoards) {
          expandedState[board.id] = true;
        }
      });
      setExpandedMainBoards(expandedState);
    }
  }, [boardSearchTerm]);

  // Fetch sub-boards for each main board
  const fetchSubBoards = async (mainBoardId: string, userId: string) => {
    if (!isMounted) return [];
    try {
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/${mainBoardId}/boards?user_id=${userId}&inActive=false`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-API-Key": EXCEL_API_KEY
          },
          cache: "no-store",
        }
      );
      if (response.ok) {
        const subBoardsData = await response.json();
        let boardsArray = Array.isArray(subBoardsData)
          ? subBoardsData
          : (subBoardsData.boards || subBoardsData.data || []);
        return boardsArray.filter((board: { is_active: boolean | undefined }) =>
          board.is_active === undefined || board.is_active === true
        );
      } else {
        console.error(`Failed to fetch sub-boards for main board ${mainBoardId}`);
        return [];
      }
    } catch (error) {
      console.error(`Error fetching sub-boards for main board ${mainBoardId}:`, error);
      return [];
    }
  };

  // Normalize main board data
  const normalizeMainBoard = (mainBoard: any): MainBoard => {
    return {
      id: mainBoard.main_board_id || mainBoard.id || "unknown-id",
      name: mainBoard.name || "Unnamed Board",
      is_active: mainBoard.is_active === undefined ? true : mainBoard.is_active,
      boards: []
    };
  };

  // Fetch main boards and their sub-boards
  const fetchMainBoards = useCallback(async () => {
    if (!isMounted) return;

    // ✅ FIX 3: Guard against sessionStorage being undefined during SSR
    if (typeof sessionStorage === 'undefined') return;

    setIsLoading(true);
    setError(null);

    try {
      const userDataString = sessionStorage.getItem('currentUserData') ||
        localStorage.getItem('loggedInUserId');

      if (!userDataString) {
        throw new Error("User session data not found");
      }

      let clientUserId;
      if (typeof userDataString === 'string' && userDataString.startsWith('{')) {
        const userData = JSON.parse(userDataString);
        clientUserId = userData.userId || userData.user_id || userData.id;
      } else {
        clientUserId = userDataString;
      }

      if (!clientUserId) {
        throw new Error("User ID not found in session data");
      }

      const response = await fetch(
        `${API_BASE_URL}/main-boards/get_all_info_tree?client_user_id=${clientUserId}&inActive=false`,
        {
          headers: {
            'Accept': 'application/json',
            'X-API-KEY': EXCEL_API_KEY
          },
          cache: "no-store",
        }
      );

      const data = await response.json();
      const mainBoardsArray = Array.isArray(data) ? data : (data.main_boards || data.data || []);
      const activeMainBoards = mainBoardsArray.filter((board: { is_active: boolean | undefined }) =>
        board.is_active === undefined || board.is_active === true
      );

      const enhancedMainBoards: MainBoard[] = [];

      for (const mainBoard of activeMainBoards) {
        const normalizedMainBoard = normalizeMainBoard(mainBoard);
        const subBoards = await fetchSubBoards(normalizedMainBoard.id, clientUserId);

        normalizedMainBoard.boards = subBoards.map((board: any) => ({
          id: board.board_id || board.id,
          name: board.name || "Unnamed Sub-Board",
          is_active: board.is_active === undefined ? true : board.is_active,
          main_board_id: normalizedMainBoard.id
        }));

        enhancedMainBoards.push(normalizedMainBoard);
      }

      setMainBoards(enhancedMainBoards);
    } catch (error) {
      console.error("Error fetching main boards:", error);
      setError("Error loading boards");
      setMainBoards([]);
    } finally {
      setIsLoading(false);
    }
  }, [isMounted]);

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    if (!isMounted) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/roles/`, {
        headers: { "X-API-Key": EXCEL_API_KEY },
      });
      const data = await response.json();
      setRoles(Array.isArray(data) ? data : data?.roles || data?.data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  }, [isMounted]);

  // Fetch assigned boards for role
  const fetchAssignedBoards = useCallback(async (roleId: string) => {
    if (!roleId || !isMounted) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/roles/${roleId}/boards`, {
        headers: { "X-API-Key": EXCEL_API_KEY },
      });
      const data = await response.json();
      setAssignedBoardIds(Array.isArray(data) ? data.map((item: any) => item.board_id || item) : []);
    } catch (error) {
      console.error('Error fetching assigned boards:', error);
      setAssignedBoardIds([]);
    } finally {
      setIsLoading(false);
    }
  }, [isMounted]);

  // Initial data loading
  useEffect(() => {
    if (isMounted) {
      fetchMainBoards();
      fetchRoles();
    }
  }, [isMounted, fetchMainBoards, fetchRoles]);

  // Fetch assigned boards when role changes
  useEffect(() => {
    if (isMounted && selectedRole) {
      fetchAssignedBoards(selectedRole);
    }
  }, [selectedRole, isMounted, fetchAssignedBoards]);

  // Handle board selection
  const handleBoardSelect = (boardId: string) => {
    if (!boardId || assignedBoardIds.includes(boardId)) return;
    setSelectedBoards(prev =>
      prev.includes(boardId)
        ? prev.filter(id => id !== boardId)
        : [...prev, boardId]
    );
  };

  // Toggle all boards selection
  const toggleAllBoards = () => {
    const allVisibleBoardIds = filteredMainBoards.flatMap(mb =>
      mb.boards.map(b => b.id).filter(Boolean) as string[]
    );
    const eligibleBoards = allVisibleBoardIds.filter(id => !assignedBoardIds.includes(id));
    setSelectedBoards(prev =>
      prev.length === eligibleBoards.length ? [] : eligibleBoards
    );
  };

  // Assign boards to role
  const assignBoardsToRole = async () => {
    if (!selectedRole || selectedBoards.length === 0) {
      setError('Please select at least one board and a role');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const promises = selectedBoards.map(boardId =>
        fetch(`${API_BASE_URL}/roles/${selectedRole}/boards/${boardId}`, {
          method: 'POST',
          headers: { "X-API-Key": EXCEL_API_KEY },
        })
      );
      await Promise.all(promises);
      setSuccess(`Successfully assigned ${selectedBoards.length} board(s) to role`);
      fetchAssignedBoards(selectedRole);
      setSelectedBoards([]);
    } catch (error) {
      setError('Failed to assign boards to role');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (boardId: string) => {
    const board = mainBoards.flatMap(mb => mb.boards).find(b => b.id === boardId);
    setBoardToRemove({ boardId, boardName: board?.name || `Board ${boardId}` });
    setShowConfirmModal(true);
  };

  const confirmRemoveBoard = async () => {
    if (!boardToRemove || !selectedRole) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setShowConfirmModal(false);
    try {
      await fetch(`${API_BASE_URL}/roles/${selectedRole}/boards/${boardToRemove.boardId}`, {
        method: 'DELETE',
        headers: { "X-API-Key": EXCEL_API_KEY },
      });
      setSuccess(`Successfully removed board "${boardToRemove.boardName}" from role`);
      fetchAssignedBoards(selectedRole);
    } catch (error) {
      setError('Failed to remove board from role');
    } finally {
      setIsLoading(false);
      setBoardToRemove(null);
    }
  };

  const cancelRemoveBoard = () => {
    setShowConfirmModal(false);
    setBoardToRemove(null);
  };

  const generateCSV = (boards: Board[], roles: Role[], assignments: Record<string, string[]>) => {
    let csv = 'Board ID,Board Name,Assigned Role\n';
    boards.forEach(board => {
      const boardRoles = [];
      for (const roleId in assignments) {
        if (assignments[roleId].includes(board.id)) {
          const role = roles.find(r => r.id.toString() === roleId.toString());
          boardRoles.push(role?.name || `[ID: ${roleId}]`);
        }
      }
      csv += `"${board.id}","${board.name}","${boardRoles.join(', ')}"\n`;
    });
    return csv;
  };

  const generateJSON = (boards: Board[], roles: Role[], assignments: Record<string, string[]>) => {
    const report = boards.map(board => {
      const boardRoles = [];
      for (const roleId in assignments) {
        if (assignments[roleId].includes(board.id)) {
          const role = roles.find(r => r.id.toString() === roleId.toString());
          boardRoles.push({ id: roleId, name: role?.name || 'Unknown Role' });
        }
      }
      return { boardId: board.id, boardName: board.name, roles: boardRoles };
    });
    return JSON.stringify(report, null, 2);
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    setError(null);
    try {
      let assignments: Record<string, string[]> = {};

      if (currentRoleOnly && selectedRole) {
        const response = await fetch(`${API_BASE_URL}/roles/${selectedRole}/boards`, {
          headers: { 'Accept': 'application/json', "X-API-Key": EXCEL_API_KEY },
        });
        if (response.ok) {
          const data = await response.json();
          assignments[selectedRole] = Array.isArray(data)
            ? data.map(item => typeof item === 'object' ? item.board_id : item)
            : [];
        }
      } else {
        await Promise.all(roles.map(async role => {
          const response = await fetch(`${API_BASE_URL}/roles/${role.id}/boards`, {
            headers: { 'Accept': 'application/json', "X-API-Key": EXCEL_API_KEY },
          });
          if (response.ok) {
            const data = await response.json();
            assignments[role.id] = Array.isArray(data)
              ? data.map(item => typeof item === 'object' ? item.board_id : item)
              : [];
          }
        }));
      }

      const boards: Board[] = mainBoards.flatMap(mb => mb.boards);
      let boardsToInclude = boards;
      if (currentRoleOnly && selectedRole) {
        const assignedIds = assignments[selectedRole] || [];
        boardsToInclude = boards.filter(board => assignedIds.includes(board.id));
      }

      let content: string;
      let fileName: string;
      let mimeType: string;

      switch (reportFormat) {
        case 'csv':
          content = generateCSV(boardsToInclude, roles, assignments);
          fileName = currentRoleOnly ? `board_role_assignments_${selectedRole}.csv` : 'board_role_assignments.csv';
          mimeType = 'text/csv';
          break;
        case 'json':
          content = generateJSON(boardsToInclude, roles, assignments);
          fileName = currentRoleOnly ? `board_role_assignments_${selectedRole}.json` : 'board_role_assignments.json';
          mimeType = 'application/json';
          break;
        case 'pdf':
          return await generatePDF(boardsToInclude, roles, assignments, currentRoleOnly);
        default:
          throw new Error('Unsupported report format');
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('Report generated successfully');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const generatePDF = async (
    _boards: Board[],
    roles: Role[],
    _assignments: Record<string, string[]>,
    currentRoleOnly: boolean = false
  ) => {
    try {
      const { PDFDocument, rgb } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 800]);
      const title = currentRoleOnly && selectedRole
        ? `User Role Assignment Report - ${roles.find(r => r.id === selectedRole)?.name || selectedRole}`
        : 'User Role Assignment Report';
      page.drawText(title, { x: 50, y: 750, size: 20, color: rgb(0, 0, 0) });
    } catch (error) {
      throw new Error('Failed to generate PDF: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // ✅ FIX 2: Return null while not mounted (prevents SSR from rendering browser-only code)
  if (!isMounted) {
    return null;
  }

  // ✅ Full JSX is now only rendered on the client after mount
  return (
    <>
      <header className="bg-white border-b p-4 shadow-md">
        <div className="flex justify-between items-center max-w-screen-xl mx-auto">
          <div></div>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={toggleDropdown}
              className="flex items-center gap-2 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-md transition-colors"
            >
              <span className="text-sm font-medium">Select Role</span>
              <svg
                className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg py-1 z-50">
                <a
                  href="/Dashboard"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Consultant Role
                </a>
                <a
                  href="/CXO"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  CXO Role
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-gray-100 p-4 w-full relative">
        {/* Generate Report Bar */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <h3 className="text-lg font-semibold mb-2 md:mb-0">Generate Report</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="currentRoleOnly"
                  checked={currentRoleOnly}
                  onChange={(e) => setCurrentRoleOnly(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded mr-2"
                  disabled={!selectedRole || isGeneratingReport}
                />
                <label htmlFor="currentRoleOnly" className="text-sm text-gray-700">
                  Current Role Only
                </label>
              </div>
              <button
                onClick={generateReport}
                disabled={isGeneratingReport || isLoading || mainBoards.flatMap(mb => mb.boards).length === 0}
                className={`px-4 py-2 rounded-lg flex items-center justify-center ${
                  isGeneratingReport || isLoading || mainBoards.flatMap(mb => mb.boards).length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isGeneratingReport ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="w-full max-w-full mx-auto">
          {/* Status Messages */}
          <div className="w-full mb-4">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <div className="flex justify-between">
                  <div className="flex">
                    <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="ml-3 text-sm text-red-700">{error}</p>
                  </div>
                  <button onClick={() => setError(null)} className="text-gray-500 hover:text-gray-700">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
                <div className="flex justify-between">
                  <div className="flex">
                    <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="ml-3 text-sm text-green-700">{success}</p>
                  </div>
                  <button onClick={() => setSuccess(null)} className="text-gray-500 hover:text-gray-700">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden w-full">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">Board Role Management</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 w-full">
              {/* Boards Column */}
              <div className="bg-gray-50 rounded-lg p-4 border" style={{ minHeight: '600px' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Boards</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {selectedBoards.length} selected
                    </span>
                    <button
                      onClick={toggleAllBoards}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      disabled={isLoading}
                    >
                      {selectedBoards.length === filteredMainBoards.flatMap(mb => mb.boards).filter(b => b.id && !assignedBoardIds.includes(b.id)).length
                        ? 'Unselect All'
                        : 'Select All'}
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search boards..."
                      className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={boardSearchTerm}
                      onChange={(e) => setBoardSearchTerm(e.target.value)}
                    />
                    {boardSearchTerm && (
                      <button onClick={() => setBoardSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {boardSearchTerm && (
                    <p className="mt-1 text-xs text-gray-600">
                      Showing {filteredMainBoards.reduce((count, mb) => count + mb.boards.length, 0)} boards
                    </p>
                  )}
                </div>

                <div className="h-[420px] overflow-y-auto space-y-2">
                  {isLoading && mainBoards.length === 0 ? (
                    <div className="p-4 text-center">Loading boards...</div>
                  ) : filteredMainBoards.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {boardSearchTerm ? `No boards found matching "${boardSearchTerm}"` : 'No boards found'}
                    </div>
                  ) : (
                    filteredMainBoards.map((mainBoard) => (
                      <Accordion
                        key={mainBoard.id}
                        title={mainBoard.name}
                        isOpen={expandedMainBoards[mainBoard.id]}
                        onToggle={() => toggleMainBoard(mainBoard.id)}
                      >
                        <div className="p-2 space-y-1">
                          {mainBoard.boards.length > 0 ? (
                            mainBoard.boards.map(board => {
                              const isAssigned = assignedBoardIds.includes(board.id || '');
                              return (
                                <div
                                  key={board.id || board.name}
                                  className={`p-2 rounded ${isAssigned ? 'bg-white' : 'hover:bg-gray-50'}`}
                                >
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedBoards.includes(board.id || '')}
                                      onChange={() => handleBoardSelect(board.id || '')}
                                      className="h-4 w-4 text-blue-600 rounded mr-3"
                                      disabled={isAssigned}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-baseline space-x-2">
                                        <span className="text-xs font-mono text-gray-500">ID: {board.id}</span>
                                        <span className="text-sm font-medium truncate">{board.name}</span>
                                      </div>
                                    </div>
                                    {isAssigned && (
                                      <span className="ml-auto text-xs text-green-600 whitespace-nowrap">Assigned</span>
                                    )}
                                  </label>
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-2 text-center text-gray-500 text-sm">No boards in this group</div>
                          )}
                        </div>
                      </Accordion>
                    ))
                  )}
                </div>
              </div>

              {/* Arrow Button Column */}
              <div className="flex flex-col items-center justify-center">
                <button
                  onClick={assignBoardsToRole}
                  disabled={isLoading || !selectedRole || selectedBoards.length === 0}
                  className={`p-3 rounded-full shadow-md transition-all ${
                    isLoading || !selectedRole || selectedBoards.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white transform hover:scale-105'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
                <p className="mt-2 text-sm text-gray-500 text-center">
                  {selectedBoards.length > 0 ? `Assign ${selectedBoards.length} board(s)` : 'Select boards to assign'}
                </p>
              </div>

              {/* Roles Column */}
              <div className="bg-gray-50 rounded-lg p-4 border" style={{ minHeight: '600px' }}>
                <div className="mb-4">
                  <label className="block text-lg font-semibold text-gray-700 mb-2">Roles</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  >
                    <option value="">Select a role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>

                <div className="h-[500px] overflow-y-auto">
                  {selectedRole ? (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-700">
                          {roles.find(r => r.id === selectedRole)?.name || 'Selected Role'}
                        </h4>
                        <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          {assignedBoardIds.length} assigned
                        </span>
                      </div>

                      {isLoading ? (
                        <div className="text-center py-4">Loading assigned boards...</div>
                      ) : assignedBoardIds.length > 0 ? (
                        <div className="space-y-2">
                          {assignedBoardIds.map(boardId => {
                            const board = mainBoards.flatMap(mb => mb.boards).find(b => b.id === boardId);
                            return (
                              <div key={boardId} className="p-3 bg-white rounded-lg border flex justify-between items-center">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline space-x-2">
                                    <span className="text-xs font-mono text-gray-500">ID: {boardId}</span>
                                    <span className="text-sm font-medium truncate">
                                      {board?.name || 'Board not found'}
                                    </span>
                                  </div>
                                  {board && (
                                    <div className="mt-1 text-xs text-gray-500">
                                      {mainBoards.find(mb => mb.boards.some(b => b.id === boardId))?.name || ''}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteClick(boardId)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  disabled={isLoading}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">No boards assigned to this role</div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">Please select a role</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 8.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">Confirm Board Removal</h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">
                  Are you sure you want to remove <strong>"{boardToRemove?.boardName}"</strong> from this role? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelRemoveBoard}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveBoard}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {isLoading ? 'Removing...' : 'Remove Board'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}