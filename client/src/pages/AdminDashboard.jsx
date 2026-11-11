import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';

const AdminDashboard = () => {
  const { showToast } = useNotification();

  const [stats, setStats] = useState({
    systemHealth: 'Stable',
    healthDetail: 'All Systems Operational',
    totalUsers: '1.2M',
    totalEmployers: '45k',
    totalJobs: '120k',
    totalApplications: 342,
  });

  const [moderationTab, setModerationTab] = useState('users'); // 'users' or 'companies'
  const [usersList, setUsersList] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Taxonomy state
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, companiesRes, taxonomyRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/companies'),
        api.get('/admin/taxonomy'),
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
      if (usersRes.data.success) {
        setUsersList(usersRes.data.users);
      }
      if (companiesRes.data.success) {
        setCompaniesList(companiesRes.data.companies);
      }
      if (taxonomyRes.data.success) {
        setTags(taxonomyRes.data.tags);
        setCategories(taxonomyRes.data.categories);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleUserStatus = async (userId, newStatus) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      setUsersList((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, status: newStatus } : u))
      );
      showToast({
        title: 'Status Updated',
        message: `User is now ${newStatus}.`,
        type: 'info',
      });
    } catch (err) {
      showToast({ title: 'Error', message: err.message, type: 'error' });
    }
  };

  const handleCompanyStatus = async (companyId, newStatus) => {
    try {
      await api.patch(`/admin/companies/${companyId}/status`, { status: newStatus });
      setCompaniesList((prev) =>
        prev.map((c) => (c._id === companyId ? { ...c, status: newStatus } : c))
      );
      showToast({
        title: 'Status Updated',
        message: `Company is now ${newStatus}.`,
        type: 'info',
      });
    } catch (err) {
      showToast({ title: 'Error', message: err.message, type: 'error' });
    }
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;

    try {
      const res = await api.post('/admin/taxonomy', {
        name: newTagInput.trim(),
        type: 'tag',
      });
      if (res.data.success) {
        setTags((prev) => [res.data.item, ...prev]);
        setNewTagInput('');
        showToast({ title: 'Tag Added', message: `Added tag #${res.data.item.name}`, type: 'success' });
      }
    } catch (err) {
      showToast({
        title: 'Error',
        message: err.response?.data?.message || err.message,
        type: 'error',
      });
    }
  };

  const handleDeleteTaxonomy = async (id, name, type) => {
    try {
      await api.delete(`/admin/taxonomy/${id}`);
      if (type === 'tag') {
        setTags((prev) => prev.filter((t) => t._id !== id));
      } else {
        setCategories((prev) => prev.filter((c) => c._id !== id));
      }
      showToast({ title: 'Deleted', message: `Removed ${name}`, type: 'info' });
    } catch (err) {
      showToast({ title: 'Error', message: err.message, type: 'error' });
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatInput.trim()) return;

    try {
      const res = await api.post('/admin/taxonomy', {
        name: newCatInput.trim(),
        type: 'category',
      });
      if (res.data.success) {
        setCategories((prev) => [...prev, res.data.item]);
        setNewCatInput('');
        setIsAddCatModalOpen(false);
        showToast({ title: 'Category Added', message: `Added ${res.data.item.name}`, type: 'success' });
      }
    } catch (err) {
      showToast({
        title: 'Error',
        message: err.response?.data?.message || err.message,
        type: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-500">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Metric Cards (Figure 8.7) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                System Health
              </span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900">
              {stats.systemHealth || 'Stable'}
            </p>
            <p className="text-[11px] font-semibold text-emerald-600 mt-1">
              ✓ {stats.healthDetail || 'All Systems Operational'}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Users
            </span>
            <p className="mt-3 text-2xl font-black text-slate-900">
              {stats.totalUsers > 1000 ? `${(stats.totalUsers / 1000).toFixed(1)}k` : stats.totalUsers || '1.2M'}
            </p>
            <p className="text-[11px] font-semibold text-blue-600 mt-1">
              +12% MoM growth
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Employers
            </span>
            <p className="mt-3 text-2xl font-black text-slate-900">
              {stats.totalEmployers || '45k'}
            </p>
            <p className="text-[11px] font-semibold text-emerald-600 mt-1">
              +8% new this week
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Listings
            </span>
            <p className="mt-3 text-2xl font-black text-slate-900">
              {stats.totalJobs || '120k'}
            </p>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              {stats.activeJobs || 12} currently active
            </p>
          </div>
        </div>

        {/* Main Grid: Moderation Queue vs Taxonomy Management (Figure 8.7) */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Moderation Queue */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Moderation Queue</h2>
                  <p className="text-xs text-slate-400">Review flagged accounts and reported content</p>
                </div>

                <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-bold">
                  <button
                    onClick={() => setModerationTab('users')}
                    className={`rounded-lg px-4 py-1.5 transition ${
                      moderationTab === 'users'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Users
                  </button>
                  <button
                    onClick={() => setModerationTab('companies')}
                    className={`rounded-lg px-4 py-1.5 transition ${
                      moderationTab === 'companies'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Companies
                  </button>
                </div>
              </div>

              {/* Moderation Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                      <th className="pb-3">Account Name</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Flag Reason</th>
                      <th className="pb-3">Reported By</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {moderationTab === 'users' ? (
                      usersList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">
                            No users in moderation queue.
                          </td>
                        </tr>
                      ) : (
                        usersList.map((item) => (
                          <tr key={item._id} className="hover:bg-slate-50 transition">
                            <td className="py-3.5 font-bold text-slate-900">
                              {item.name}
                              <span className="text-[10px] font-normal text-slate-400 block">
                                {item.email}
                              </span>
                            </td>
                            <td className="py-3.5 capitalize text-slate-600">
                              {item.role}
                            </td>
                            <td className="py-3.5">
                              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                {item.flagReason || 'Policy Review'}
                              </span>
                            </td>
                            <td className="py-3.5 text-slate-500">
                              {item.reportedBy || 'System (Automated)'}
                            </td>
                            <td className="py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleUserStatus(item._id, 'active')}
                                  className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50"
                                  title="Approve User"
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    check_circle
                                  </span>
                                </button>
                                <button
                                  onClick={() => handleUserStatus(item._id, 'banned')}
                                  className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                                  title="Ban / Suspend"
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    block
                                  </span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )
                    ) : (
                      companiesList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">
                            No companies in moderation queue.
                          </td>
                        </tr>
                      ) : (
                        companiesList.map((comp) => (
                          <tr key={comp._id} className="hover:bg-slate-50 transition">
                            <td className="py-3.5 font-bold text-slate-900">
                              {comp.name}
                              <span className="text-[10px] font-normal text-slate-400 block">
                                {comp.website || 'No website'}
                              </span>
                            </td>
                            <td className="py-3.5 text-slate-600">Company</td>
                            <td className="py-3.5">
                              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                {comp.flagReason || 'Profile Verification'}
                              </span>
                            </td>
                            <td className="py-3.5 text-slate-500">
                              {comp.reportedBy || 'System'}
                            </td>
                            <td className="py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleCompanyStatus(comp._id, 'active')}
                                  className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50"
                                  title="Approve"
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    check_circle
                                  </span>
                                </button>
                                <button
                                  onClick={() => handleCompanyStatus(comp._id, 'banned')}
                                  className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                                  title="Suspend"
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    block
                                  </span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Taxonomy Management (Figure 8.7) */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              <h3 className="font-black text-slate-900 text-base">
                Taxonomy Management
              </h3>

              {/* Add New Tag */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Add New Tag
                </label>
                <form onSubmit={handleAddTag} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Prompt Engineering"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                  >
                    Add
                  </button>
                </form>
              </div>

              {/* Recent Tags Added */}
              <div className="border-t border-slate-100 pt-5">
                <span className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  Recent Tags Added
                </span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag._id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {tag.name}
                      <button
                        onClick={() => handleDeleteTaxonomy(tag._id, tag.name, 'tag')}
                        className="text-slate-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Industry Categories */}
              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Industry Categories
                  </span>
                  <button
                    onClick={() => setIsAddCatModalOpen(true)}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    + Add Category
                  </button>
                </div>

                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div
                      key={cat._id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700"
                    >
                      <span className="font-semibold">{cat.name}</span>
                      <button
                        onClick={() => handleDeleteTaxonomy(cat._id, cat.name, 'category')}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Category Modal */}
      {isAddCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-black text-slate-900 mb-3">Add Industry Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Category name..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCatModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
