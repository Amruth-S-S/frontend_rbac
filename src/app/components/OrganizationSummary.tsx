"use client";
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// Read-only organization strip shown above the Master Data / Currency Settings
// panels — extracted out of ExcelTableComponent so it stays fixed on screen
// regardless of which of those two sub-views is currently selected.
interface OrgSummary {
  org_code: string;
  name: string;
  industry_type: string;
  registered_country: string;
  subscription: string;
  is_active: boolean;
}

export default function OrganizationSummary() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

  const loggedInUserId = (() => {
    try {
      const d = sessionStorage.getItem("currentUserData");
      if (d) return String(JSON.parse(d).userId);
    } catch {}
    return localStorage.getItem("loggedInUserId") || null;
  })();

  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  useEffect(() => {
    const fetchOrg = async () => {
      setOrgLoading(true);
      try {
        // Prefer the org data cached at login — avoids an extra round trip
        const raw = sessionStorage.getItem("currentUserData");
        const cached = raw ? JSON.parse(raw)?.orgData : null;
        if (cached?.id) {
          setOrg({
            org_code: cached.org_code || "",
            name: cached.name || "",
            industry_type: cached.industry_type || "",
            registered_country: cached.registered_country || "",
            subscription: cached.subscription || "",
            is_active: cached.is_active !== undefined ? cached.is_active : true,
          });
          return;
        }
        if (!loggedInUserId) return;
        const res = await fetch(
          `${API_BASE_URL}/organizations/my-org?owner_user_id=${loggedInUserId}`,
          { headers: { Accept: "application/json", "X-API-Key": API_KEY } },
        );
        if (res.ok) {
          const data = await res.json();
          setOrg({
            org_code: data.org_code || "",
            name: data.name || "",
            industry_type: data.industry_type || "",
            registered_country: data.registered_country || "",
            subscription: data.subscription || "",
            is_active: data.is_active !== undefined ? data.is_active : true,
          });
        }
      } catch {
        // Organization list is a supplementary display — fail silently
      } finally {
        setOrgLoading(false);
      }
    };
    fetchOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUserId]);

  if (orgLoading) {
    return (
      <div className="p-4 sm:p-6 pb-0 flex justify-center items-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      </div>
    );
  }
  if (!org) return null;

  return (
    <div className="p-4 sm:p-6 pb-0">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-0.5">Organization</h3>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-full table-fixed">
          <colgroup>
            <col style={{ width: "14%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Org Code", "Name", "Industry", "Country", "Subscription", "Status"].map((col) => (
                <th
                  key={col}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase truncate"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2 text-xs font-semibold text-gray-800 truncate">{org.org_code}</td>
              <td className="px-3 py-2 text-xs font-semibold text-gray-800 truncate">{org.name}</td>
              <td className="px-3 py-2 text-xs text-gray-600 truncate">{org.industry_type}</td>
              <td className="px-3 py-2 text-xs text-gray-600 truncate">{org.registered_country}</td>
              <td className="px-3 py-2 text-xs text-gray-600 truncate">{org.subscription}</td>
              <td className="px-3 py-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    org.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {org.is_active ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
