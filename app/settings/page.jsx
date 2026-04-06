"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Pencil, Trash2, Save } from "lucide-react";
import BackToDashboardButton from "@/components/BackToDashboardButton";
import SettingsImg from "@/assets/settings_img.png";
import { toast } from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [currentTab, setCurrentTab] = useState("users");
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Branch management state
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [editBranchValues, setEditBranchValues] = useState(null);
  const [newBranchValues, setNewBranchValues] = useState({ name: "", location: "", phone: "", status: "ACTIVE" });
  const [isAddingBranch, setIsAddingBranch] = useState(false);

  const itemsPerPage = 5;

  // ----------------------------
  // 🔹 Fetch Current User
  // ----------------------------
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch("/api/me");
        const json = await res.json();
        if (json.success) {
          // We need more info about current user like isMain branch
          // Let's fetch the full user record or adjust /api/me
          const userRes = await fetch(`/api/users`); // This returns users list, maybe not efficient
          // Alternatively, we can use the /api/me but it needs to include isMain
          // For now let's assume if they can see all branches from /api/branches they are main admin
          setCurrentUser(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch me:", err);
      }
    };
    fetchMe();
  }, []);

  // ----------------------------
  // 🔹 Fetch Users & Branches
  // ----------------------------
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const toastId = toast.loading("Loading data...");
      try {
        const [usersRes, branchesRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/branches")
        ]);
        
        const usersJson = await usersRes.json();
        const branchesJson = await branchesRes.json();

        if (usersJson.success) {
          setUsers(usersJson.data);
        }
        if (branchesJson.success) {
          setBranches(branchesJson.data);
        }
        
        toast.success("Data loaded successfully!", { id: toastId });
      } catch (err) {
        console.error("Failed to fetch data:", err);
        toast.error("Error fetching data.", { id: toastId });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isMainAdmin = useMemo(() => {
    return branches.length > 1 || branches.some(b => b.isMain);
  }, [branches]);

  // ----------------------------
  // 🔹 Inline Editing
  // ----------------------------
  function startEdit(row) {
    setEditingId(row.id);
    setEditValues({
      username: row.username,
      fullName: row.fullName,
      role: row.role?.name || row.role || "",
      branchId: row.branchId,
      password: "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues(null);
  }

  async function saveEdit() {
    if (!editingId || !editValues) return;
    if (saving) return toast("Already saving...");

    // 🔸 Validate fields before saving
    const { username, fullName, password, role } = editValues;

    if (!username.trim()) {
      toast.error("Username is required.");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }
    if (password.length > 0 && password.length < 6) {

      if(password.match(/" "/ig)){
        toast.error("' ' white space character cannot be included in the password!")
        return 
      }
      toast.error("Password is required and must be at least 6 characters.");
      return;
    }
    if (!role || role === "") {
      toast.error("Role is required.");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Saving changes...");

    try {
      const res = await fetch(`/api/users/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error || "Failed to update user", { id: toastId });
        return;
      }

      if (data && data.id) {
        setUsers((prev) =>
          prev.map((u) => (u.id === editingId ? { ...u, ...data } : u))
        );
        cancelEdit();
        toast.success("User updated successfully!", { id: toastId });
      } else {
        toast.error("Invalid backend response.", { id: toastId });
      }
    } catch (err) {
      console.error("Error saving user:", err);
      toast.error("Something went wrong. Check console for details.", {
        id: toastId,
      });
    } finally {
      setSaving(false);
    }
  }

  // ----------------------------
  // 🔹 Delete User (with confirm + toast.promise)
  // ----------------------------
  async function deleteUser(id) {
    toast.custom((t) => (
      <div className="bg-white shadow-lg rounded-lg p-4 flex flex-col gap-3 border border-gray-200">
        <p className="text-gray-800 font-medium">
          Are you sure you want to delete this user?
        </p>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white"
            onClick={async () => {
              toast.dismiss(t.id);
              toast.promise(
                (async () => {
                  const res = await fetch(`/api/users/${id}`, {
                    method: "DELETE",
                  });
                  const data = await res.json();

                  if (!res.ok || !data.deletedUser) {
                    throw new Error("Failed to delete user.");
                  }

                  setUsers((prev) => prev.filter((u) => u.id !== id));
                  return "User deleted successfully.";
                })(),
                {
                  loading: "Deleting user...",
                  success: "User deleted successfully!",
                  error: (err) =>
                    err.message || "Something went wrong while deleting.",
                }
              );
            }}
          >
            Yes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.dismiss(t.id)}
          >
            No
          </Button>
        </div>
      </div>
    ));
  }

  // ----------------------------
  // 🔹 Branch Operations
  // ----------------------------
  async function createBranch() {
    if (!newBranchValues.name.trim()) return toast.error("Branch name is required");
    setSaving(true);
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBranchValues),
      });
      const data = await res.json();
      if (res.ok) {
        setBranches([data.data, ...branches]);
        setNewBranchValues({ name: "", location: "", phone: "" });
        setIsAddingBranch(false);
        toast.success("Branch created successfully!");
      } else {
        toast.error(data.error || "Failed to create branch");
      }
    } catch (err) {
      toast.error("Error creating branch");
    } finally {
      setSaving(false);
    }
  }

  async function updateBranch() {
    if (!editingBranchId || !editBranchValues) return;
    if (editBranchValues.isMain && editBranchValues.status === "INACTIVE") {
      toast.error("Main branch cannot be set to INACTIVE");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/branches/${editingBranchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editBranchValues),
      });
      const data = await res.json();
      if (res.ok) {
        setBranches(branches.map(b => b.id === editingBranchId ? data.data : b));
        setEditingBranchId(null);
        setEditBranchValues(null);
        toast.success("Branch updated successfully!");
      } else {
        toast.error(data.error || "Failed to update branch");
      }
    } catch (err) {
      toast.error("Error updating branch");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBranch(id) {
    if (!confirm("Are you sure you want to delete this branch?")) return;
    try {
      const res = await fetch(`/api/branches/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setBranches(branches.filter(b => b.id !== id));
        toast.success("Branch deleted successfully!");
      } else {
        toast.error(data.error || "Failed to delete branch");
      }
    } catch (err) {
      toast.error("Error deleting branch");
    }
  }

  // ----------------------------
  // 🔹 Search + Pagination
  // ----------------------------
  const filteredData = useMemo(() => {
    let result = [...users];
    if (searchQuery) {
      result = result.filter((u) =>
        u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  }, [users, searchQuery]);

  const filteredBranches = useMemo(() => {
    let result = [...branches];
    if (searchQuery && currentTab === "branches") {
      result = result.filter((b) =>
        b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  }, [branches, searchQuery, currentTab]);

  const totalPages = Math.ceil((currentTab === "users" ? filteredData.length : filteredBranches.length) / itemsPerPage);
  
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const data = currentTab === "users" ? filteredData : filteredBranches;
    return data.slice(start, start + itemsPerPage);
  }, [filteredData, filteredBranches, currentPage, itemsPerPage, currentTab]);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="p-6 space-y-6">
      {/* ----------------- Header ----------------- */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Image
            src={SettingsImg}
            width={70}
            height={70}
            alt="settings page logo"
          />
          Settings
        </h1>
        <div className="flex items-center gap-3">
          {currentTab === "users" ? (
            <Link href="/settings/add-user">
              <Button className="bg-green-400 hover:bg-green-500 text-md">
                New User
              </Button>
            </Link>
          ) : (
            <Button 
              onClick={() => setIsAddingBranch(true)}
              className="bg-green-400 hover:bg-green-500 text-md"
            >
              New Branch
            </Button>
          )}
          <BackToDashboardButton />
        </div>
      </div>

      {/* ----------------- Tabs ----------------- */}
      {isMainAdmin && (
        <div className="flex gap-4 border-b">
          <button
            className={`pb-2 px-4 font-medium ${currentTab === "users" ? "border-b-2 border-orange-500 text-orange-500" : "text-gray-500"}`}
            onClick={() => { setCurrentTab("users"); setCurrentPage(1); }}
          >
            Users
          </button>
          <button
            className={`pb-2 px-4 font-medium ${currentTab === "branches" ? "border-b-2 border-orange-500 text-orange-500" : "text-gray-500"}`}
            onClick={() => { setCurrentTab("branches"); setCurrentPage(1); }}
          >
            Branches
          </button>
        </div>
      )}

      {/* ----------------- Search ----------------- */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="relative w-[250px]">
          <Input
            placeholder={currentTab === "users" ? "Search by Name or Username" : "Search by Branch Name"}
            className="pr-8 focus:!ring-[#f25500] focus:!border-[#f25500]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
      </div>

      {/* ----------------- Content ----------------- */}
      {loading ? (
        <UsersTableSkeleton />
      ) : (
        <>
          {currentTab === "users" ? (
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="text-lg">
                      <TableHead>ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Role</TableHead>
                      {isMainAdmin && <TableHead>Branch</TableHead>}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length > 0
                      ? paginatedData.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell>#{u.id}</TableCell>
                            <TableCell>
                              {editingId === u.id ? (
                                <Input
                                  required
                                  value={editValues?.username || ""}
                                  onChange={(e) =>
                                    setEditValues((s) => ({
                                      ...s,
                                      username: e.target.value,
                                    }))
                                  }
                                  className="w-[160px]"
                                />
                              ) : (
                                u.username
                              )}
                            </TableCell>
                            <TableCell>
                              {editingId === u.id ? (
                                <Input
                                  required
                                  value={editValues?.fullName || ""}
                                  onChange={(e) =>
                                    setEditValues((s) => ({
                                      ...s,
                                      fullName: e.target.value,
                                    }))
                                  }
                                  className="w-[220px]"
                                />
                              ) : (
                                u.fullName
                              )}
                            </TableCell>
                            <TableCell>
                              {editingId === u.id ? (
                                <Input
                                  required
                                  minLength={6}
                                  type="text"
                                  placeholder="Enter new password"
                                  value={editValues?.password || ""}
                                  onChange={(e) =>
                                    setEditValues((s) => ({
                                      ...s,
                                      password: e.target.value,
                                    }))
                                  }
                                  className="w-[200px]"
                                />
                              ) : (
                                <Input
                                  type="password"
                                  value="********"
                                  readOnly
                                  className="w-[160px] bg-transparent border-none shadow-none cursor-default"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {editingId === u.id ? (
                                <Select
                                  value={editValues?.role || ""}
                                  onValueChange={(v) =>
                                    setEditValues((s) => ({
                                      ...s,
                                      role: v,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                                    <SelectItem value="CASHIER">CASHIER</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                u.role?.name || "—"
                              )}
                            </TableCell>
                            {isMainAdmin && (
                              <TableCell>
                                {editingId === u.id ? (
                                  <Select
                                    value={editValues?.branchId?.toString() || ""}
                                    onValueChange={(v) =>
                                      setEditValues((s) => ({
                                        ...s,
                                        branchId: parseInt(v),
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="w-[150px]">
                                      <SelectValue placeholder="Select Branch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {branches.map(b => (
                                        <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  u.branch?.name || "—"
                                )}
                              </TableCell>
                            )}
                            <TableCell className="flex gap-2 ml-2">
                              {editingId === u.id ? (
                                <>
                                  <Button
                                    disabled={saving}
                                    size="sm"
                                    onClick={saveEdit}
                                    className="bg-green-400 hover:bg-green-300 hover:text-green-800"
                                  >
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      toast("Edit canceled.");
                                      cancelEdit();
                                    }}
                                    className="hover:bg-gray-300 hover:text-gray-700"
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => startEdit(u)}
                                    className="hover:bg-gray-300 hover:text-gray-700"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteUser(u.id)}
                                    className="hover:bg-red-300 hover:text-red-800"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                {isAddingBranch && (
                  <div className="mb-6 p-4 border rounded-lg bg-gray-50 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="text-xs font-bold mb-1 block">Name</label>
                      <Input 
                        value={newBranchValues.name} 
                        onChange={e => setNewBranchValues({...newBranchValues, name: e.target.value})}
                        placeholder="Branch Name"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold mb-1 block">Location</label>
                      <Input 
                        value={newBranchValues.location} 
                        onChange={e => setNewBranchValues({...newBranchValues, location: e.target.value})}
                        placeholder="Location"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold mb-1 block">Phone</label>
                      <Input 
                        value={newBranchValues.phone} 
                        onChange={e => setNewBranchValues({...newBranchValues, phone: e.target.value})}
                        placeholder="Phone"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold mb-1 block">Status</label>
                      <Select
                        value={newBranchValues.status}
                        onValueChange={(v) => setNewBranchValues({...newBranchValues, status: v})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                          <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={createBranch} disabled={saving} className="bg-orange-500">Save</Button>
                      <Button variant="outline" onClick={() => setIsAddingBranch(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow className="text-lg">
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>#{b.id}</TableCell>
                        <TableCell>
                          {editingBranchId === b.id ? (
                            <Input 
                              value={editBranchValues.name} 
                              onChange={e => setEditBranchValues({...editBranchValues, name: e.target.value})}
                            />
                          ) : b.name}
                        </TableCell>
                        <TableCell>
                          {editingBranchId === b.id ? (
                            <Input 
                              value={editBranchValues.location} 
                              onChange={e => setEditBranchValues({...editBranchValues, location: e.target.value})}
                            />
                          ) : b.location}
                        </TableCell>
                        <TableCell>
                          {editingBranchId === b.id ? (
                            <Input 
                              value={editBranchValues.phone} 
                              onChange={e => setEditBranchValues({...editBranchValues, phone: e.target.value})}
                            />
                          ) : b.phone}
                        </TableCell>
                        <TableCell>
                          {editingBranchId === b.id ? (
                            <Select
                              value={editBranchValues.status}
                              onValueChange={(v) => setEditBranchValues({...editBranchValues, status: v})}
                            >
                              <SelectTrigger className="w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                                {!b.isMain && <SelectItem value="INACTIVE">INACTIVE</SelectItem>}
                              </SelectContent>
                            </Select>
                          ) : b.status}
                        </TableCell>
                        <TableCell className="flex gap-2">
                          {editingBranchId === b.id ? (
                            <>
                              <Button size="sm" onClick={updateBranch} disabled={saving} className="bg-green-400">
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingBranchId(null)}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => {
                                setEditingBranchId(b.id);
                                setEditBranchValues({...b});
                              }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {!b.isMain && (
                                <Button size="sm" variant="destructive" onClick={() => deleteBranch(b.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ----------------- Pagination ----------------- */}
      {totalPages > 1 && (
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Prev
          </Button>
          {[...Array(3)].map((_, i) => {
            let pageNumber;
            if (currentPage === 1) pageNumber = i + 1;
            else if (currentPage === totalPages)
              pageNumber = totalPages - 2 + i;
            else pageNumber = currentPage - 1 + i;

            if (pageNumber < 1 || pageNumber > totalPages) return null;

            return (
              <Button
                key={pageNumber}
                variant={pageNumber === currentPage ? "default" : "outline"}
                className={
                  pageNumber === currentPage ? "bg-orange-500 text-white" : ""
                }
                size="sm"
                onClick={() => goToPage(pageNumber)}
              >
                {pageNumber}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function UsersTableSkeleton() {
  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead className="text-right">
                <Skeleton className="h-4 w-16 ml-auto" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
