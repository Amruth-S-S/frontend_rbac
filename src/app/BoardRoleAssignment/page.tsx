// "use client";

// import RoleBoardAssignment from "@/app/components/RoleBoardAssignment";

// export default function RoleBoardAssignmentPage() {

//   return <RoleBoardAssignment/>
// }

"use client";

import dynamic from "next/dynamic";

// ✅ Disable SSR entirely for this page — prevents sessionStorage/localStorage errors during build
const RoleBoardAssignment = dynamic(
  () => import("@/app/components/RoleBoardAssignment"),
  { ssr: false }
);

export default function RoleBoardAssignmentPage() {
  return <RoleBoardAssignment />;
}