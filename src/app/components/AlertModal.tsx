"use client";
import React, { useState } from 'react';
import { ArrowLeft, Share, FileText, Search, ZoomIn, ZoomOut, Maximize, Download, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DocumentViewer() {
  const [currentPage, setCurrentPage] = useState(17);
  
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Top navigation */}
      <nav className="bg-white p-4 border-b flex items-center">
        <button className="mr-4">
          <ArrowLeft />
        </button>
        <div className="flex space-x-2 items-center">
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">
            ID
          </div>
        </div>
      </nav>
      
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-16 bg-white border-r flex flex-col items-center py-4 space-y-6">
          <button className="p-2 text-gray-500 hover:text-gray-800">
            <div className="w-6 h-6 border border-orange-500"></div>
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-800">
            <FileText />
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-800">
            <div className="rounded-full w-6 h-6 border border-gray-300 flex items-center justify-center">?</div>
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-800">
            <div className="w-6 h-6 border border-gray-300 flex items-center justify-center">⚙️</div>
          </button>
        </div>
        
        {/* Document content area */}
        <div className="flex-1 flex flex-col">
          {/* Document header */}
          <div className="bg-white p-4 border-b flex justify-between items-center">
            <div className="text-lg font-medium">
              To determine the primacy of coverage for your member, we need to consider the NAIC rules on coordination of benefits. Here's a breakdown based on the provided dates:
            </div>
            <div className="flex items-center space-x-2">
              <button className="px-4 py-2 border rounded-md bg-white flex items-center">
                <Share className="mr-2" size={18} />
                Shared
              </button>
              <button className="px-4 py-2 border rounded-md bg-white flex items-center">
                <FileText className="mr-2" size={18} />
                Open Artifacts
              </button>
            </div>
          </div>
          
          {/* Document body */}
          <div className="flex-1 overflow-auto p-6 bg-gray-50">
            <div className="max-w-4xl mx-auto bg-white p-8 shadow-sm rounded">
              <ol className="space-y-6 list-decimal pl-6">
                <li className="font-medium">
                  <span className="font-bold">From 1/1/25 to 2/1/25:</span> The member has coverage through Anthem. Since this is the only coverage during this period, Anthem is the primary plan.
                </li>
                <li className="font-medium">
                  <span className="font-bold">From 2/1/25 to 3/1/25:</span> The member gains spousal coverage through United Healthcare. According to the NAIC rules, when a person is covered by more than one plan, the plan that covers the person as an employee (or member) is primary, and the plan that covers the person as a dependent is secondary. Therefore, Anthem remains the primary plan, and United Healthcare is secondary.
                </li>
                <li className="font-medium">
                  <span className="font-bold">From 3/1/25 onwards:</span> The member's Anthem coverage changes to COBRA. The NAIC rules state that if a person is covered under another plan as an employee, member, or subscriber, that plan is primary, and COBRA coverage is secondary. Thus, United Healthcare becomes the primary plan, and Anthem (COBRA) is secondary.
                </li>
              </ol>
              
              <div className="mt-8">
                <h3 className="font-bold mb-4">Citations:</h3>
                <div className="flex space-x-4">
                  <div className="bg-blue-50 px-4 py-2 rounded text-sm">
                    1. model-law-120.pdf: Page-14
                  </div>
                  <div className="bg-blue-50 px-4 py-2 rounded text-sm">
                    2. model-law-120.pdf: Page-17
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Document footer */}
          <div className="bg-white border-t p-2 flex justify-between items-center">
            <div className="flex items-center">
              <button className="px-3 py-1 bg-blue-50 rounded-md">
                Select Source (0)
              </button>
              <input 
                type="text" 
                placeholder="Message iDiscovery" 
                className="ml-2 border rounded-md px-3 py-1 flex-1"
              />
            </div>
            <button className="text-gray-400">
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
        
        {/* Right panel PDF view */}
        <div className="w-96 bg-white border-l flex flex-col">
          {/* PDF header */}
          <div className="p-4 border-b flex justify-between items-center">
            <div className="flex space-x-4">
              <button className="text-gray-600 font-medium">ARTIFACTS</button>
              <button className="text-gray-600 font-medium">SOURCES</button>
              <button className="bg-gray-900 text-white px-3 py-1 rounded font-medium">PDF VIEW</button>
            </div>
            <button>
              <ChevronRight size={24} />
            </button>
          </div>
          
          {/* PDF title */}
          <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
            <div>Model-Law-120.Pdf</div>
            <div className="flex space-x-2">
              <Download size={18} />
              <Maximize size={18} />
              <Search size={18} />
              <ZoomIn size={18} />
            </div>
          </div>
          
          {/* PDF content */}
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            <div className="bg-white p-6 min-h-full">
              <h2 className="text-sm text-center mb-4">NAIC Model Laws, Regulations, Guidelines and Other Resources—October 2011</h2>
              
              <div className="text-sm space-y-4">
                <div>
                  <p>(i) If a court decree states that one of the parents is responsible for the dependent child's health care expenses or health care coverage and the Plan of that parent has actual knowledge of those terms, that Plan is primary.</p>
                </div>
                <div>
                  <p>(ii) If a court decree states that both parents are responsible for the dependent child's health care expenses or health care coverage, the provisions of Subparagraph (a) above shall determine the order of benefits;</p>
                </div>
                {/* Additional PDF content */}
              </div>
            </div>
          </div>
          
          {/* PDF pagination */}
          <div className="bg-gray-900 text-white p-2 flex justify-center items-center space-x-4">
            <button><ChevronLeft size={18} /></button>
            <button><ChevronLeft size={18} /></button>
            <div className="flex items-center space-x-2">
              <input type="text" value="16" className="w-8 bg-gray-800 text-white text-center rounded" />
              <div className="bg-white text-black w-8 h-8 rounded-full flex items-center justify-center">17</div>
              <div>18</div>
            </div>
            <button><ChevronRight size={18} /></button>
            <button><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-white p-2 text-center text-sm text-gray-600 border-t">
        ©2025 Carelon. All Rights Reserved. | Privacy Policy | Terms of Use
      </footer>
    </div>
  );
}