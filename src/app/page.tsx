"use client";

import { useState, useMemo, useEffect } from "react";
import { useTripStore } from "@/stores/tripStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExpenseBarChart } from "@/components/charts/ExpenseBarChart";
import { ExpensePieChart } from "@/components/charts/ExpensePieChart";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area, XAxis, YAxis,
  Tooltip, Legend, BarChart as RechartsBar, Bar
} from "recharts";
import { TripSelector } from "@/components/trip/TripSelector";
import {
  Plane, Menu, X, Wallet, Calendar, Users, Settings,
  TrendingUp, TrendingDown, BarChart3, PieChart,
  Plus, Trash2, Check, Pencil, ArrowRight, Activity,
  Car, Ticket, Utensils, Trophy, MoreHorizontal,
  Coffee, AlertTriangle, Music, Heart, Gift, Target, Zap, Crown, Beer,
  ChevronLeft, ChevronRight, Home, ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";

type Tab = "dashboard" | "timeline" | "members" | "settings";
type SortColumn = 'name' | 'planned' | 'actual' | 'diff';

// Icon mapping
const IconMap: Record<string, React.ElementType> = {
  car: Car, plane: Plane, ticket: Ticket, utensils: Utensils,
  trophy: Trophy, "more-horizontal": MoreHorizontal,
  coffee: Coffee, alert: AlertTriangle, music: Music, heart: Heart, gift: Gift
};

// Format currency
const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; fill: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur border border-border rounded-lg p-3 shadow-xl">
        <p className="font-medium text-sm mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-xs" style={{ color: entry.fill }}>{entry.name}: {formatCurrency(entry.value)}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TripDashboard() {
  const store = useTripStore();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [activeChart, setActiveChart] = useState<"bar" | "pie">("bar");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Default to expanded when open
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [memberEditValue, setMemberEditValue] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", planned: "", color: "#3B82F6" });
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [expenseEditValue, setExpenseEditValue] = useState("");
  const [editingDates, setEditingDates] = useState(false);
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [memberPlannedEdit, setMemberPlannedEdit] = useState<string | null>(null);
  const [memberPlannedValue, setMemberPlannedValue] = useState("");

  // Form states
  const [newMemberName, setNewMemberName] = useState("");
  const [newEvent, setNewEvent] = useState({ title: "", date: "", time: "", location: "", description: "", type: "activity" as const });
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({ title: "", amount: "", categoryId: "", paidBy: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, catId: string | null, catName: string }>({ isOpen: false, catId: null, catName: "" });

  // Sorting state moved to store

  const handleSort = (column: SortColumn) => {
    if (store.sortColumn === column) {
      store.setSortDirection(store.sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      store.setSortColumn(column);
      store.setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (store.sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return store.sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-blue-500" /> : <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />;
  };

  const sortedCategories = useMemo(() => {
    if (!store.sortColumn) return store.categories;
    return [...store.categories].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      if (store.sortColumn === 'name') { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
      else if (store.sortColumn === 'planned') { aVal = a.planned; bVal = b.planned; }
      else if (store.sortColumn === 'actual') { aVal = a.actual; bVal = b.actual; }
      else { aVal = a.planned - a.actual; bVal = b.planned - b.actual; } // diff

      if (aVal < bVal) return store.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return store.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [store.categories, store.sortColumn, store.sortDirection]);

  // Computed values
  const totalCategoryPlanned = store.getTotalCategoryPlanned(); // Sum of category planned column
  const totalMasterBudget = store.getTotalMemberPlanned();    // Sum of member planned (Master Budget)
  const totalActual = store.getTotalActual();
  const totalGiven = store.getTotalGiven();

  const remaining = totalGiven - totalActual; // Cash Balance (Given - Spent)
  const budgetRemaining = totalMasterBudget - totalActual; // Budget Left (Master - Spent)
  const spentPercent = totalMasterBudget > 0 ? Math.round((totalActual / totalMasterBudget) * 100) : 0;

  // Client-side mounting and loading states (MUST be at top before any early returns)
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Trip progress calculation (using fixed date to avoid hydration mismatch)
  const tripProgress = useMemo(() => {
    if (!mounted) return { totalDays: 0, daysElapsed: 0, daysRemaining: 0, progress: 0, isOngoing: false, hasStarted: false, daysToStart: 0 };

    // Normalize dates to midnight for accurate calculation
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const start = new Date(store.tripStartDate + 'T00:00:00').getTime();
    const end = new Date(store.tripEndDate + 'T00:00:00').getTime();

    // Calculate diffs in days (Inclusive +1)
    const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    const daysElapsed = Math.ceil((currentDate - start) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const daysToStart = Math.ceil((start - currentDate) / (1000 * 60 * 60 * 24));

    const progress = Math.min(100, Math.max(0, ((currentDate - start) / (end - start)) * 100));

    return { totalDays, daysElapsed, daysRemaining, progress, isOngoing: currentDate >= start && currentDate <= end, hasStarted: currentDate >= start, daysToStart };
  }, [store.tripStartDate, store.tripEndDate, mounted]);

  // Set mounted to true on client to avoid hydration mismatch and sync with Supabase
  useEffect(() => {
    setMounted(true);

    // Start sync after component mounts and hydration completes
    const syncData = async () => {
      if (store._hasHydrated) {
        await store.initSync();
        setIsLoading(false);
      }
    };

    if (store._hasHydrated) {
      syncData();
    }
  }, [store._hasHydrated]);

  // Chart data
  const chartData = store.categories.map(c => ({
    name: c.name,
    planned: c.planned,
    actual: c.actual,
    difference: c.planned - c.actual,
    color: c.color,
    icon: c.icon,
  })).filter(c => c.planned > 0 || c.actual > 0);

  // Member contribution data for chart
  const memberContribData = store.members.map(m => ({
    name: m.name,
    given: m.given,
    planned: m.planned,
    fill: m.given >= m.planned ? '#10B981' : '#EF4444'
  }));

  // Radar chart data (top 6 categories by spending)
  const radarData = store.categories
    .filter(c => c.actual > 0 || c.planned > 0)
    .slice(0, 6)
    .map(c => ({
      category: c.name.split(' ')[0], // Short name
      planned: c.planned,
      actual: c.actual,
      fullMark: Math.max(c.planned, c.actual) * 1.2
    }));

  // Progress donut data
  const progressData = [
    { name: 'Spent', value: totalActual, fill: '#3B82F6' },
    { name: 'Remaining', value: Math.max(0, remaining), fill: '#1E293B' }
  ];

  // Quick stats
  const quickStats = useMemo(() => {
    const topCategory = store.categories.reduce((max, c) => c.actual > max.actual ? c : max, store.categories[0]);
    const topSpender = store.members.reduce((max, m) => {
      const spent = store.expenses.filter(e => e.paidBy === m.name).reduce((s, e) => s + e.amount, 0);
      return spent > max.spent ? { name: m.name, spent } : max;
    }, { name: '', spent: 0 });

    return {
      topCategory: topCategory?.name || 'N/A',
      topCategoryAmount: topCategory?.actual || 0,
      topSpender: topSpender.name || 'N/A',
      topSpenderAmount: topSpender.spent,
      avgPerPerson: store.members.length > 0 ? totalActual / store.members.length : 0
    };
  }, [store.categories, store.members, store.expenses, totalActual]);

  // Budget health indicator
  const budgetHealth = useMemo(() => {
    if (spentPercent < 50) return { status: 'Healthy', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: '🟢' };
    if (spentPercent < 80) return { status: 'On Track', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: '🟡' };
    return { status: 'Over Budget Risk', color: 'text-red-500', bg: 'bg-red-500/10', icon: '🔴' };
  }, [spentPercent]);

  // Balance calculations
  const balances = (() => {
    if (store.members.length < 2) return [];
    const perPerson = totalActual / store.members.length;
    return store.members.map(m => ({
      id: m.id,
      name: m.name,
      balance: m.given - perPerson,
    }));
  })();

  // Who owes who
  const settlements = (() => {
    const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
    const debtors = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
    const debts: { from: string; to: string; amount: number }[] = [];
    for (const debtor of debtors) {
      for (const creditor of creditors) {
        if (debtor.balance >= -0.01) break;
        const amount = Math.min(-debtor.balance, creditor.balance);
        if (amount > 0.01) {
          debts.push({ from: debtor.name, to: creditor.name, amount: Math.round(amount * 100) / 100 });
          debtor.balance += amount;
          creditor.balance -= amount;
        }
      }
    }
    return debts;
  })();

  // Activity feed (last 5 expenses)
  const activityFeed = store.expenses.slice(0, 5);

  // Handle add expense
  const handleAddExpense = () => {
    if (!newExpense.title || !newExpense.amount || !newExpense.categoryId) return;
    store.addExpense({
      title: newExpense.title,
      amount: parseFloat(newExpense.amount),
      categoryId: newExpense.categoryId,
      paidBy: newExpense.paidBy || store.members[0]?.name || "Unknown",
      date: new Date().toISOString(),
    });
    setNewExpense({ title: "", amount: "", categoryId: "", paidBy: "" });
    setShowAddExpense(false);
  };

  // Handle add category
  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.planned) return;
    store.addCategory(newCategory.name, parseFloat(newCategory.planned), newCategory.color, 'more-horizontal');
    setNewCategory({ name: "", planned: "", color: "#3B82F6" });
    setShowAddCategory(false);
  };

  // Handle add member
  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    store.addMember(newMemberName.trim());
    setNewMemberName("");
  };

  // Handle add event
  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.date) return;
    store.addEvent({
      title: newEvent.title,
      date: newEvent.date,
      time: newEvent.time || "00:00",
      location: newEvent.location,
      description: newEvent.description,
      type: newEvent.type,
    });
    setNewEvent({ title: "", date: "", time: "", location: "", description: "", type: "activity" });
  };

  // Save category edit
  const saveCategory = (id: string) => {
    const value = parseFloat(editValue);
    if (!isNaN(value)) store.updateCategory(id, { planned: value });
    setEditingCategory(null);
  };

  // Save member contribution
  const saveMemberContribution = (id: string) => {
    const value = parseFloat(memberEditValue);
    if (!isNaN(value)) store.updateMember(id, { given: value });
    setEditingMember(null);
  };

  return (
    <>
      {/* Loading Overlay */}
      {(!mounted || isLoading) && (
        <div className="fixed inset-0 z-[9999] min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading your trip data...</p>
          </div>
        </div>
      )}

      {/* Main App */}
      <div className="min-h-screen bg-background">
        {/* Sidebar Overlay (works on all screens when sidebar is open) */}
        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={cn(
          "fixed top-0 left-0 h-full border-r border-border z-50 transition-all duration-300 group overflow-hidden w-64",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {/* Background Image & Overlay */}
          <div className="absolute inset-0 bg-[url('/campa-logo-v2.jpg')] bg-cover bg-center" />
          {/* Minimal overaly just for basic normalization, keeps image vibrant */}
          <div className="absolute inset-0 bg-black/10" />

          <div className="relative z-10 flex flex-col h-full p-6">
            {/* Logo & Close Button */}
            <div className="relative flex items-center mb-8 pr-8">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-purple-500/50 relative group cursor-pointer hover:scale-105 transition-transform flex-shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/campa-logo-v2.jpg" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div className="bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 shadow-lg overflow-hidden">
                  <span className="text-xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text drop-shadow-sm whitespace-nowrap tracking-wider animate-pulse truncate block">
                    The Boys
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="absolute -right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors border border-white/10"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Trip Info - Selector */}
            <div className="mb-8">
              <TripSelector />
            </div>

            {/* Navigation */}
            <nav className="space-y-2 w-full">
              {[
                { id: "dashboard", label: "Dashboard", icon: Home },
                { id: "timeline", label: "Timeline", icon: Calendar },
                { id: "members", label: "Members", icon: Users },
                { id: "settings", label: "Settings", icon: Settings },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as Tab); setIsSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative overflow-hidden",
                    activeTab === item.id
                      ? "bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)] text-white font-bold border border-purple-400/30"
                      : "bg-black/50 text-gray-100 hover:bg-black/70 hover:text-white border border-white/5 backdrop-blur-[2px]"
                  )}
                  title={item.label}
                >
                  <div className={cn("absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000")} />
                  <item.icon className={cn("w-5 h-5 flex-shrink-0 drop-shadow-md", activeTab === item.id ? "text-white" : "text-gray-300 group-hover:text-white")} />
                  <span className="drop-shadow-sm">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main>
          {/* Header */}
          <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
            <div className="flex items-center justify-between px-4 lg:px-8 py-4">
              <div className="flex items-center gap-4">
                <button className="p-2 rounded-lg hover:bg-accent" onClick={() => setIsSidebarOpen(true)}>
                  <Menu className="w-6 h-6" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-foreground capitalize">{activeTab}</h1>
                  <p className="text-sm text-muted-foreground">{store.tripName}</p>
                </div>
              </div>
              {activeTab === "dashboard" && (
                <Button variant="gradient" className="gap-2" onClick={() => setShowAddExpense(true)}>
                  <Plus className="w-4 h-4" /> Add Expense
                </Button>
              )}
            </div>
          </header>

          {/* Content */}
          <div className="p-4 lg:p-8 space-y-6">
            {/* DASHBOARD */}
            {activeTab === "dashboard" && (
              <>
                {/* Kalai's Mistakes Counter */}
                <Card variant="glass" className="border-2 border-red-500/20 bg-gradient-to-r from-red-500/10 to-orange-500/5 hover:border-red-500/40 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                        <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">Kalai's Mistakes</h3>
                        <p className="text-xs text-muted-foreground font-medium">Official Chaos Tracker</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        {editingCategory === 'mistakes-counter' ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const val = parseInt(editValue);
                                  if (!isNaN(val) && val >= 0) {
                                    store.setMistakesCount(val);
                                    setEditingCategory(null);
                                  }
                                } else if (e.key === 'Escape') {
                                  setEditingCategory(null);
                                }
                              }}
                              className="w-20 h-10 text-xl font-bold text-center bg-background/50 border-red-500/30 focus-visible:ring-red-500"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-10 w-10 hover:bg-emerald-500/10 hover:text-emerald-500"
                              onClick={() => {
                                const val = parseInt(editValue);
                                if (!isNaN(val) && val >= 0) {
                                  store.setMistakesCount(val);
                                  setEditingCategory(null);
                                }
                              }}
                            >
                              <Check className="w-5 h-5" />
                            </Button>
                          </div>
                        ) : (
                          <span
                            className="text-4xl font-black text-foreground tabular-nums tracking-tight cursor-pointer hover:text-red-500 transition-colors tooltip underline decoration-dashed decoration-transparent hover:decoration-red-500/30 underline-offset-4"
                            title="Click to edit manually"
                            onClick={() => {
                              setEditValue(store.mistakesCount.toString());
                              setEditingCategory('mistakes-counter');
                            }}
                          >
                            {store.mistakesCount}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => store.incrementMistakes()}
                        className="h-7 px-2 text-xs bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white shadow-lg shadow-red-500/20 border border-red-400/20"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> 1
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                {/* Trip Progress Bar */}
                <Card variant="glass" className="border border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-pink-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setEditingDates(true); setTempStartDate(store.tripStartDate); setTempEndDate(store.tripEndDate); }}>
                        <Calendar className="w-5 h-5 text-purple-500 group-hover:text-purple-400" />
                        {editingDates ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <Input type="date" value={tempStartDate} onChange={e => setTempStartDate(e.target.value)} className="h-7 w-32" />
                            <span className="text-muted-foreground">to</span>
                            <Input type="date" value={tempEndDate} onChange={e => setTempEndDate(e.target.value)} className="h-7 w-32" />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { store.setTripDates(tempStartDate, tempEndDate); setEditingDates(false); }}><Check className="w-3 h-3 text-emerald-500" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingDates(false)}><X className="w-3 h-3 text-red-500" /></Button>
                          </div>
                        ) : (
                          <span className="font-semibold group-hover:underline decoration-dashed underline-offset-4">{store.tripStartDate} → {store.tripEndDate}</span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{tripProgress.totalDays} day trip</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                      <div className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${tripProgress.progress}%` }} />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {tripProgress.hasStarted ? `${tripProgress.daysRemaining} days remaining` : `Starts in ${Math.max(0, tripProgress.daysToStart)} days`}
                    </p>
                  </CardContent>
                </Card>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card variant="glass"><CardContent className="p-6"><div className="flex items-center justify-between mb-2"><p className="text-sm text-muted-foreground">Collected Amount</p><Wallet className="w-5 h-5 text-emerald-500" /></div><p className="text-2xl font-bold">{formatCurrency(totalGiven)}</p><div className="flex items-center justify-between mt-1"><span className="text-xs text-muted-foreground">Master Budget:</span><span className="text-xs font-medium">{formatCurrency(totalMasterBudget)}</span></div></CardContent></Card>
                  <Card variant="glass"><CardContent className="p-6"><div className="flex items-center justify-between mb-2"><p className="text-sm text-muted-foreground">Total Spent</p><TrendingDown className="w-5 h-5 text-emerald-500" /></div><p className="text-2xl font-bold">{formatCurrency(totalActual)}</p><p className="text-xs text-emerald-500">{spentPercent}% of budget</p></CardContent></Card>
                  <Card variant="glass"><CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2"><p className="text-sm text-muted-foreground">Remaining</p><TrendingUp className="w-5 h-5 text-violet-500" /></div>
                    <p className="text-2xl font-bold">{formatCurrency(remaining)}</p>
                    <p className="text-xs text-muted-foreground mb-2">Cash Balance</p>
                    <div className="pt-2 border-t border-border/50 flex justify-between items-center bg-accent/20 p-2 rounded">
                      <span className="text-xs font-medium text-muted-foreground">Budget Rem:</span>
                      <span className="text-sm font-bold text-foreground">{formatCurrency(budgetRemaining)}</span>
                    </div>
                  </CardContent></Card>
                  <Card variant="glass" className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setActiveTab("members")}><CardContent className="p-6"><div className="flex items-center justify-between mb-2"><p className="text-sm text-muted-foreground">Members</p><Users className="w-5 h-5 text-orange-500" /></div><p className="text-2xl font-bold">{store.members.length}</p><p className="text-xs text-muted-foreground">Trip participants</p></CardContent></Card>
                </div>

                {/* Budget Health + Quick Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card variant="glass" className={cn("border-2", budgetHealth.bg)}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{budgetHealth.icon}</span>
                        <div>
                          <p className={cn("font-bold text-lg", budgetHealth.color)}>{budgetHealth.status}</p>
                          <p className="text-sm text-muted-foreground">{spentPercent}% of budget used</p>
                        </div>
                      </div>
                      {/* Mini progress bar */}
                      <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", spentPercent < 50 ? "bg-emerald-500" : spentPercent < 80 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${Math.min(spentPercent, 100)}%` }} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card variant="glass">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3"><Crown className="w-5 h-5 text-yellow-500" /><span className="font-semibold">Top Category</span></div>
                      <p className="text-xl font-bold">{quickStats.topCategory}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(quickStats.topCategoryAmount)} spent</p>
                    </CardContent>
                  </Card>


                </div>

                {/* Expense Table */}
                <Card variant="glass">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">Expenses</CardTitle>
                      <span className="text-sm text-muted-foreground">{store.categories.length} categories</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-card z-10">
                          <tr className="border-b border-border/50">
                            <th onClick={() => handleSort('name')} className="text-left py-3 px-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                              <span className="flex items-center">Category{getSortIcon('name')}</span>
                            </th>
                            <th onClick={() => handleSort('planned')} className="text-right py-3 px-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                              <span className="flex items-center justify-end">Planned{getSortIcon('planned')}</span>
                            </th>
                            <th onClick={() => handleSort('actual')} className="text-right py-3 px-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                              <span className="flex items-center justify-end">Actual{getSortIcon('actual')}</span>
                            </th>
                            <th onClick={() => handleSort('diff')} className="text-right py-3 px-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                              <span className="flex items-center justify-end">Diff.{getSortIcon('diff')}</span>
                            </th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b-2 border-orange-500/30 bg-orange-500/5">
                            <td className="py-3 px-4 text-sm text-muted-foreground">Totals</td>
                            <td className="py-3 px-4 text-right font-semibold">{formatCurrency(totalCategoryPlanned)}</td>
                            <td className="py-3 px-4 text-right font-semibold">{formatCurrency(totalActual)}</td>
                            <td className={cn("py-3 px-4 text-right font-semibold", (totalCategoryPlanned - totalActual) >= 0 ? "text-emerald-500" : "text-red-500")}>{formatCurrency(totalCategoryPlanned - totalActual)}</td>
                            <td></td>
                          </tr>

                          {sortedCategories.map((cat, i) => {
                            const Icon = IconMap[cat.icon] || MoreHorizontal;
                            const diff = cat.planned - cat.actual;
                            return (
                              <tr key={cat.id} className={cn("border-b border-border/30 hover:bg-accent/5", i % 2 === 1 && "bg-accent/5")}>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>
                                      <Icon className="w-4 h-4" style={{ color: cat.color }} />
                                    </div>
                                    <span className="text-sm font-medium">{cat.name}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {editingCategory === cat.id ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-24 h-8 text-right" autoFocus />
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveCategory(cat.id)}><Check className="w-3 h-3 text-emerald-500" /></Button>
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCategory(null)}><X className="w-3 h-3 text-red-500" /></Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1 group">
                                      <span className="text-sm text-muted-foreground">{formatCurrency(cat.planned)}</span>
                                      <button onClick={() => { setEditingCategory(cat.id); setEditValue(cat.planned.toString()); }} className="lg:opacity-0 lg:group-hover:opacity-100 p-1 hover:bg-accent rounded transition-opacity"><Pencil className="w-3 h-3 text-muted-foreground" /></button>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {editingCategory === `${cat.id}-actual` ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <Input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-24 h-8 text-right" autoFocus />
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { const v = parseFloat(editValue); if (!isNaN(v)) store.updateCategory(cat.id, { actual: v }); setEditingCategory(null); }}><Check className="w-3 h-3 text-emerald-500" /></Button>
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCategory(null)}><X className="w-3 h-3 text-red-500" /></Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1 group">
                                      <span className="text-sm font-medium">{formatCurrency(cat.actual)}</span>
                                      <button onClick={() => { setEditingCategory(`${cat.id}-actual`); setEditValue(cat.actual.toString()); }} className="lg:opacity-0 lg:group-hover:opacity-100 p-1 hover:bg-accent rounded transition-opacity"><Pencil className="w-3 h-3 text-muted-foreground" /></button>
                                    </div>
                                  )}
                                </td>
                                <td className={cn("py-3 px-4 text-right text-sm font-medium", diff >= 0 ? "text-emerald-500" : "text-red-500")}>{formatCurrency(diff)}</td>
                                <td className="py-3 px-4"><Button variant="ghost" size="sm" className="h-6 w-6 p-0 transition-opacity hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, catId: cat.id, catName: cat.name }); }}><Trash2 className="w-4 h-4 text-red-500" /></Button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Add Category Button */}
                    <div className="p-4 border-t border-border/50">
                      <Button variant="outline" className="w-full gap-2" onClick={() => setShowAddCategory(true)}>
                        <Plus className="w-4 h-4" /> Add New Category
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Expense Analytics (Charts) */}
                <Card variant="glass">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Expense Analytics</CardTitle>
                      <div className="flex items-center gap-1 p-1 bg-accent rounded-lg">
                        <button onClick={() => setActiveChart("bar")} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all", activeChart === "bar" ? "bg-background shadow-sm" : "text-muted-foreground")}><BarChart3 className="w-4 h-4" />Bar</button>
                        <button onClick={() => setActiveChart("pie")} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all", activeChart === "pie" ? "bg-background shadow-sm" : "text-muted-foreground")}><PieChart className="w-4 h-4" />Pie</button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activeChart === "bar" ? <ExpenseBarChart data={chartData} currency="INR" /> : <ExpensePieChart data={chartData} currency="INR" />}
                  </CardContent>
                </Card>

                {/* Advanced Visualizations Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Budget Progress Donut */}
                  <Card variant="glass">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-blue-500" />Budget Progress</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPie>
                            <Pie data={progressData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                              {progressData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                            </Pie>
                          </RechartsPie>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className="text-3xl font-bold">{spentPercent}%</p>
                          <p className="text-sm text-muted-foreground">Spent</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Member Contributions Bar Chart */}
                  <Card variant="glass">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-violet-500" />Member Contributions</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsBar data={memberContribData} layout="vertical" margin={{ left: 20, right: 20 }}>
                            <XAxis type="number" tickFormatter={(v) => `₹${v / 1000}k`} />
                            <YAxis type="category" dataKey="name" width={60} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="given" barSize={20} radius={[0, 4, 4, 0]}>
                              {memberContribData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                            </Bar>
                          </RechartsBar>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Radar Chart */}
                  {radarData.length >= 3 && (
                    <Card variant="glass">
                      <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-500" />Category Comparison</CardTitle></CardHeader>
                      <CardContent>
                        <div className="h-[280px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                              <PolarGrid stroke="#334155" />
                              <PolarAngleAxis dataKey="category" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                              <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                              <Radar name="Planned" dataKey="planned" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                              <Radar name="Actual" dataKey="actual" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.5} />
                              <Legend />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Activity Feed */}
                  <Card variant="glass">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-orange-500" />Recent Activity</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {activityFeed.length > 0 ? activityFeed.map((expense, i) => (
                        <div key={expense.id} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
                          <div>
                            <p className="font-medium">{expense.title}</p>
                            <p className="text-xs text-muted-foreground">{expense.paidBy} • {new Date(expense.date).toLocaleDateString()}</p>
                          </div>
                          <span className="font-bold text-blue-500">{formatCurrency(expense.amount)}</span>
                        </div>
                      )) : <p className="text-center text-muted-foreground py-4">No expenses yet</p>}
                    </CardContent>
                  </Card>
                </div>

                {/* Who Owes Who - REMOVED */}
              </>
            )}

            {/* TIMELINE */}
            {activeTab === "timeline" && (
              <>
                <Card variant="glass">
                  <CardHeader><CardTitle>Add Event</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-4">
                    <Input placeholder="Event title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
                    <Input type="date" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} />
                    <Input type="time" value={newEvent.time} onChange={e => setNewEvent({ ...newEvent, time: e.target.value })} />
                    <Button onClick={handleAddEvent} className="bg-gradient-to-r from-blue-500 to-violet-600"><Plus className="w-4 h-4 mr-2" />Add</Button>
                  </CardContent>
                </Card>
                <div className="space-y-4">
                  {store.timeline.map(event => (
                    <Card key={event.id} variant="glass" className="relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-violet-600" />
                      <CardContent className="p-4 pl-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{event.title}</h3>
                            {event.location && <p className="text-sm text-muted-foreground">📍 {event.location}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right text-sm text-muted-foreground">
                              <p>{new Date(event.date).toLocaleDateString()}</p>
                              <p className="font-medium">{event.time}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => store.deleteEvent(event.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {store.timeline.length === 0 && <Card variant="glass"><CardContent className="text-center py-10"><Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" /><p>No events yet. Plan your adventure!</p></CardContent></Card>}
                </div>
              </>
            )}

            {/* MEMBERS */}
            {activeTab === "members" && (
              <>
                <Card variant="glass">
                  <CardHeader><CardTitle>Add Member</CardTitle></CardHeader>
                  <CardContent className="flex gap-2">
                    <Input placeholder="Enter name..." value={newMemberName} onChange={e => setNewMemberName(e.target.value)} />
                    <Button onClick={handleAddMember} className="bg-gradient-to-r from-blue-500 to-violet-600">Add</Button>
                  </CardContent>
                </Card>
                <Card variant="glass">
                  <CardHeader><CardTitle>Trip Crew - Contributions</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead><tr className="border-b border-border/50"><th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Member</th><th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Planned</th><th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Given</th><th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Balance</th><th className="w-12"></th></tr></thead>
                      <tbody>
                        {store.members.map((m, i) => {
                          const balance = m.given - m.planned;
                          return (
                            <tr key={m.id} className={cn("border-b border-border/30", i % 2 === 1 && "bg-accent/5")}>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold">{m.name.charAt(0)}</div>
                                  <span className="font-medium">{m.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right text-sm text-muted-foreground">
                                {memberPlannedEdit === m.id ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Input type="number" value={memberPlannedValue} onChange={e => setMemberPlannedValue(e.target.value)} className="w-24 h-8 text-right" autoFocus />
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { const v = parseFloat(memberPlannedValue); if (!isNaN(v)) store.updateMember(m.id, { planned: v }); setMemberPlannedEdit(null); }}><Check className="w-3 h-3 text-emerald-500" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMemberPlannedEdit(null)}><X className="w-3 h-3 text-red-500" /></Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1 group">
                                    <span>{formatCurrency(m.planned)}</span>
                                    <button onClick={() => { setMemberPlannedEdit(m.id); setMemberPlannedValue(m.planned.toString()); }} className="lg:opacity-0 lg:group-hover:opacity-100 p-1 hover:bg-accent rounded transition-opacity"><Pencil className="w-3 h-3 text-muted-foreground" /></button>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {editingMember === m.id ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Input type="number" value={memberEditValue} onChange={e => setMemberEditValue(e.target.value)} className="w-24 h-8 text-right" autoFocus />
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveMemberContribution(m.id)}><Check className="w-3 h-3 text-emerald-500" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingMember(null)}><X className="w-3 h-3 text-red-500" /></Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1 group">
                                    <span className="text-sm font-medium">{formatCurrency(m.given)}</span>
                                    <button onClick={() => { setEditingMember(m.id); setMemberEditValue(m.given.toString()); }} className="lg:opacity-0 lg:group-hover:opacity-100 p-1 hover:bg-accent rounded transition-opacity"><Pencil className="w-3 h-3 text-muted-foreground" /></button>
                                  </div>
                                )}
                              </td>
                              <td className={cn("py-3 px-4 text-right text-sm font-medium", balance >= 0 ? "text-emerald-500" : "text-red-500")}>{formatCurrency(balance)}</td>
                              <td className="py-3 px-4"><Button variant="ghost" size="sm" onClick={() => store.deleteMember(m.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            )}

            {/* SETTINGS */}
            {activeTab === "settings" && (
              <Card variant="glass">
                <CardHeader><CardTitle>Trip Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Trip Name</Label><Input value={store.tripName} readOnly className="font-semibold" /></div>
                  <div className="space-y-2"><Label>Currency</Label><Input value={store.currency} readOnly /></div>
                  <p className="text-xs text-muted-foreground">Data is saved automatically to your browser&apos;s local storage.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>

        {/* Add Expense Modal */}
        {showAddExpense && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddExpense(false)}>
            <Card variant="glass" className="w-full max-w-md" onClick={e => e.stopPropagation()}>
              <CardHeader><CardTitle>Add Expense</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="What did you pay for?" value={newExpense.title} onChange={e => setNewExpense({ ...newExpense, title: e.target.value })} />
                <Input placeholder="Amount" type="number" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} />
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newExpense.categoryId} onChange={e => setNewExpense({ ...newExpense, categoryId: e.target.value })}>
                  <option value="">Select category...</option>
                  {store.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newExpense.paidBy} onChange={e => setNewExpense({ ...newExpense, paidBy: e.target.value })}>
                  <option value="">Who paid?</option>
                  {store.members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddExpense(false)}>Cancel</Button>
                  <Button className="flex-1 bg-gradient-to-r from-blue-500 to-violet-600" onClick={handleAddExpense}>Add</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Category Modal */}
        {showAddCategory && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddCategory(false)}>
            <Card variant="glass" className="w-full max-w-md" onClick={e => e.stopPropagation()}>
              <CardHeader><CardTitle>Add Custom Category</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Category name" value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })} />
                <Input placeholder="Planned amount" type="number" value={newCategory.planned} onChange={e => setNewCategory({ ...newCategory, planned: e.target.value })} />
                <div className="flex items-center gap-3">
                  <Label>Color</Label>
                  <input type="color" value={newCategory.color} onChange={e => setNewCategory({ ...newCategory, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  <span className="text-sm text-muted-foreground">{newCategory.color}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddCategory(false)}>Cancel</Button>
                  <Button className="flex-1 bg-gradient-to-r from-blue-500 to-violet-600" onClick={handleAddCategory}>Add Category</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {/* Deletion Confirmation Modal */}
        {deleteConfirm.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })} />
            <Card variant="glass" className="relative w-full max-w-md border-red-500/30 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <CardTitle className="text-xl">Delete Category?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Are you sure you want to remove <span className="text-foreground font-semibold">"{deleteConfirm.catName}"</span>?
                  This will delete the category but <span className="font-medium">linked expenses</span> might become uncategorized.
                </p>
                <div className="flex items-center gap-3 mt-8">
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}>Cancel</Button>
                  <Button variant="destructive" className="flex-1 shadow-lg shadow-red-500/20" onClick={() => {
                    if (deleteConfirm.catId) store.deleteCategory(deleteConfirm.catId);
                    setDeleteConfirm({ isOpen: false, catId: null, catName: "" });
                  }}>Delete Forever</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* DEBUG OVERLAY - REMOVED FOR PRODUCTION */}
      </div>
    </>
  );
}
