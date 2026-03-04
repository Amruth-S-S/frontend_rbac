
"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Spinner from './Spinner';

interface PopupProps {
  mainBoardId: string;
  boardId?: string | null;
  boardName?: string;
  closeModal: () => void;
  onSubmit?: (boardData: { mainBoardId: string; boardName: string }) => Promise<void>;
  refreshNavItems: () => void; // Add function to refresh navigation items
}

interface Board {
  boardId: string;
  name: string;
  is_active: boolean;
  path?: string; // Optional field
}

interface MainBoard {
  main_board_id: string;
  name: string;
  boards: Record<string, Board>; // Key-value pair of boards
}

type NavItems = MainBoard[];

const Popup: React.FC<PopupProps> = ({ 
  mainBoardId, 
  boardId = null, 
  boardName = '', 
  closeModal,
  onSubmit,
  refreshNavItems
}) => {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL; 
  const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';


  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(boardName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSavePrompt = async () => {
    // Input validation
    if (!name.trim()) {
      setError("Board name cannot be empty");
      return;
    }
  
    try {
      setIsSubmitting(true);
      
      // Get user data from sessionStorage with proper type checking
      let currentUserData: { userId?: string } = {};
      if (typeof window !== 'undefined') {
        const storedData = sessionStorage.getItem('currentUserData');
        currentUserData = storedData ? JSON.parse(storedData) : {};
      }
      
      const userId = currentUserData.userId;
      if (!userId) {
        setError("User not found. Please log in again.");
        toast.error("User not found. Please log in again.");
        return;
      }
  
      const isEditMode = !!boardId;
      const url = isEditMode
        ? `${API_BASE_URL}/main-boards/boards/${boardId}?user_id=${userId}`
        : `${API_BASE_URL}/main-boards/boards/?user_id=${userId}`;
  
      const requestBody = {
        main_board_id: parseInt(mainBoardId),
        name: name,
      };
  
      console.log("Request Payload:", requestBody);
  
      const response = await fetch(url, {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-API-Key": "xxAJf365FZZidPt496lk9M2XDbvQCMKevOSuBgx2k6BAjp3ALe4vLTjXtcmgatoQtvsSLED3lx7zEgyHcohd1Wa2iJWTlukzQTuauvTbGYjSgMtFq5AUQLuAcMW44mp",
        },
        body: JSON.stringify(requestBody),
      });
  
      console.log("Response Status:", response.status);
  
      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Server error response:", errorBody);
        throw new Error(
          isEditMode
            ? `Failed to update board: ${response.status}`
            : `Failed to create board: ${response.status}`
        );
      }
  
      const data = await response.json();
      console.log(isEditMode ? "Board updated:" : "Board created:", data);
      
      // Immediately refresh navigation items to display the new board
      await refreshNavItems();
      
      // Close the modal
      closeModal();
      
      // Show success toast
      toast.success(isEditMode ? "Board updated successfully!" : "Board created successfully!");
      
      // Navigate to the container with the new board using a string URL
      console.log("Navigating to /Container");
      router.push(`/Container?main_board_id=${mainBoardId}&board_id=${isEditMode ? boardId : data.id}`);
  
    } catch (error) {
      console.error("Board operation error:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "An unexpected error occurred. Please try again.";
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <h2 className="text-2xl font-bold mb-6 text-gray-900">
        {boardId ? 'Edit Board Name' : 'Create Board Name'}
      </h2>
      <textarea
        placeholder="Enter Board Name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        className="w-full p-2 border text-black rounded-md mb-4 min-h-[100px]"
      />
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="flex justify-end">
        <button
          onClick={handleSavePrompt}
          disabled={isSubmitting}
          className={`px-4 py-2 bg-blue-600 text-white rounded-md transition-colors ${
            isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
          }`}
        >
          {isSubmitting ? (
            <span>Loading...</span>
          ) : (
            boardId ? 'Update' : 'Save'
          )}
        </button>
        {isSubmitting && <Spinner />}
        <button
          onClick={closeModal}
          disabled={isSubmitting}
          className={`ml-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md transition-colors ${
            isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-300'
          }`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default Popup;