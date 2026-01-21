import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

// Helper for UUIDs
const genId = () => crypto.randomUUID();

// ========== MAPPERS: Frontend <-> Supabase ==========
// Members
const memberToDb = (m: Member) => ({
    id: m.id,
    name: m.name,
    planned_amount: m.planned,
    given_amount: m.given,
    trip_id: m.trip_id
});
const dbToMember = (row: any): Member => ({
    id: row.id,
    name: row.name,
    planned: row.planned_amount ?? 0,
    given: row.given_amount ?? 0,
    trip_id: row.trip_id
});

// Categories
const categoryToDb = (c: ExpenseCategory) => ({
    id: c.id,
    name: c.name,
    planned_amount: c.planned,
    actual_amount: c.actual,
    color: c.color,
    icon: c.icon,
    trip_id: c.trip_id
});
const dbToCategory = (row: any): ExpenseCategory => ({
    id: row.id,
    name: row.name,
    planned: row.planned_amount ?? 0,
    actual: row.actual_amount ?? 0,
    color: row.color,
    icon: row.icon,
    trip_id: row.trip_id
});

// Expenses (category_id -> categoryId, paid_by -> paidBy)
const expenseToDb = (e: Expense) => ({
    id: e.id,
    title: e.title,
    amount: e.amount,
    category_id: e.categoryId,
    paid_by: e.paidBy,
    trip_id: e.trip_id
});
const dbToExpense = (row: any): Expense => ({
    id: row.id,
    title: row.title,
    amount: row.amount,
    categoryId: row.category_id,
    paidBy: row.paid_by,
    date: row.created_at,
    trip_id: row.trip_id
});

// Types
export interface Member {
    id: string;
    name: string;
    planned: number;
    given: number;
    trip_id?: string;
}

export interface ExpenseCategory {
    id: string;
    name: string;
    planned: number;
    actual: number;
    color: string;
    icon: string;
    trip_id?: string;
}

export interface Expense {
    id: string;
    title: string;
    amount: number;
    categoryId: string;
    paidBy: string;
    date: string; // ISO string
    trip_id?: string;
}

export interface TimelineEvent {
    id: string;
    title: string;
    description: string;
    date: string;
    time: string;
    location: string;
    type: 'travel' | 'activity' | 'food' | 'stay' | 'other';
    trip_id?: string;
}

export interface TripStore {
    tripId: string | null;
    isSynced: boolean;
    _hasHydrated: boolean; // Tracking hydration state

    // Trip Info
    tripName: string;
    startingBalance: number;
    currency: string;
    tripStartDate: string;
    tripEndDate: string;

    // Data
    members: Member[];
    categories: ExpenseCategory[];
    expenses: Expense[];
    timeline: TimelineEvent[];

    // Sync Action
    initSync: () => Promise<void>;
    setHasHydrated: (state: boolean) => void;

    // Actions
    addMember: (name: string) => Promise<void>;
    updateMember: (id: string, data: Partial<Member>) => Promise<void>;
    deleteMember: (id: string) => Promise<void>;

    updateCategory: (id: string, data: Partial<ExpenseCategory>) => Promise<void>;
    addCategory: (name: string, planned: number, color: string, icon: string) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;

    addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
    updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;

    addEvent: (event: Omit<TimelineEvent, 'id'>) => Promise<void>;
    updateEvent: (id: string, data: Partial<TimelineEvent>) => Promise<void>;
    deleteEvent: (id: string) => Promise<void>;

    setTripDates: (startDate: string, endDate: string) => Promise<void>;

    // UI State (Persisted)
    sortColumn: 'name' | 'planned' | 'actual' | 'diff' | null;
    sortDirection: 'asc' | 'desc';
    setSortColumn: (col: 'name' | 'planned' | 'actual' | 'diff' | null) => void;
    setSortDirection: (dir: 'asc' | 'desc') => void;

    // Computed
    getTotalPlanned: () => number;
    getTotalMemberPlanned: () => number;
    getTotalCategoryPlanned: () => number;
    getTotalActual: () => number;
    getTotalGiven: () => number;
    getMemberBalance: (memberId: string) => number;
}

export const useTripStore = create<TripStore>()(
    persist(
        (set, get) => ({
            tripId: null,
            isSynced: false,
            _hasHydrated: false,
            tripName: 'Mysore and Bangalore Mini Trip',
            startingBalance: 0,
            currency: 'INR',
            tripStartDate: '2026-01-24',
            tripEndDate: '2026-01-27',
            members: [],
            categories: [],
            expenses: [],
            categories: [], // Note: duplicate key in original, kept to match structure (though redundant)
            expenses: [],   // Note: duplicate key in original
            timeline: [],

            // UI State Defaults
            sortColumn: null,
            sortDirection: 'asc',
            setSortColumn: (col) => set({ sortColumn: col }),
            setSortDirection: (dir) => set({ sortDirection: dir }),

            // Computed
            getTotalCategoryPlanned: () => get().categories.reduce((acc, cat) => acc + (cat.planned || 0), 0),
            getTotalMemberPlanned: () => get().members.reduce((acc, m) => acc + (m.planned || 0), 0),
            getTotalPlanned: () => get().getTotalCategoryPlanned(), // Default total planned is category based now
            getTotalActual: () => get().categories.reduce((acc, cat) => acc + (cat.actual || 0), 0),
            getTotalGiven: () => get().members.reduce((acc, m) => acc + (m.given || 0), 0),
            getMemberBalance: (mId) => (get().members.find(m => m.id === mId)?.given || 0) - (get().expenses.filter(e => e.paidBy === mId).reduce((acc, e) => acc + e.amount, 0)),

            initSync: async () => {
                const TRIP_NAME = 'Mysore and Bangalore Mini Trip';

                // Step 1: Find or create the SINGLE trip by name (database-first approach)
                const { data: existingTrips } = await supabase
                    .from('trips')
                    .select('*')
                    .eq('name', TRIP_NAME)
                    .limit(1);

                let currentTripId: string | null = null;

                if (existingTrips && existingTrips.length > 0) {
                    // Trip exists - use it
                    currentTripId = existingTrips[0].id;
                    console.log('[Sync] Found existing trip:', currentTripId);
                } else {
                    // Trip doesn't exist - create it
                    try {
                        const { data: newTrip, error } = await supabase
                            .from('trips')
                            .insert({
                                name: TRIP_NAME,
                                start_date: '2026-01-24',
                                end_date: '2026-01-27'
                            })
                            .select()
                            .single();

                        if (error) throw error;
                        if (newTrip) currentTripId = newTrip.id;
                        console.log('[Sync] Created new trip:', currentTripId);
                    } catch (e) {
                        console.error('[Sync] Failed to create trip:', e);
                    }
                }

                // Step 2: Handle offline mode
                if (!currentTripId) {
                    console.warn('[Sync] No Trip ID - running in offline mode');
                    set({ tripId: null, isSynced: false });
                    return;
                }

                // Step 3: Set trip ID and mark as synced
                set({ tripId: currentTripId, isSynced: true });

                // Step 4: Fetch all data from database (DATABASE IS SOURCE OF TRUTH)
                const { data: dbMembers } = await supabase
                    .from('members')
                    .select('*')
                    .eq('trip_id', currentTripId);

                const { data: dbCategories } = await supabase
                    .from('categories')
                    .select('*')
                    .eq('trip_id', currentTripId);

                const { data: dbExpenses } = await supabase
                    .from('expenses')
                    .select('*')
                    .eq('trip_id', currentTripId);

                // Step 5: Sync Members (DB-first, only seed if DB is completely empty)
                if (dbMembers && dbMembers.length > 0) {
                    // Database has data - use it
                    set({ members: dbMembers.map(dbToMember) });
                    console.log('[Sync] Loaded', dbMembers.length, 'members from DB');
                } else {
                    // Database is empty - seed defaults ONCE
                    console.log('[Sync] No members found - seeding defaults');
                    const defaultMembers: Member[] = [
                        { id: genId(), name: 'Sandy', planned: 3000, given: 2000, trip_id: currentTripId },
                        { id: genId(), name: 'Vicky', planned: 3000, given: 2000, trip_id: currentTripId },
                        { id: genId(), name: 'Abi', planned: 3000, given: 2000, trip_id: currentTripId },
                        { id: genId(), name: 'Lachu', planned: 3000, given: 2000, trip_id: currentTripId },
                        { id: genId(), name: 'Yuva', planned: 3000, given: 2000, trip_id: currentTripId },
                        { id: genId(), name: 'Kalai', planned: 3000, given: 2000, trip_id: currentTripId },
                        { id: genId(), name: 'Karthi', planned: 3000, given: 2000, trip_id: currentTripId },
                    ];

                    set({ members: defaultMembers });

                    // Insert all defaults to DB
                    await Promise.all(
                        defaultMembers.map(mem =>
                            supabase.from('members').insert(memberToDb(mem))
                        )
                    );
                }

                // Step 6: Sync Categories (DB-first, only seed if DB is empty)
                if (dbCategories && dbCategories.length > 0) {
                    set({ categories: dbCategories.map(dbToCategory) });
                    console.log('[Sync] Loaded', dbCategories.length, 'categories from DB');
                } else {
                    console.log('[Sync] No categories found - seeding defaults');
                    const defaultCategories: ExpenseCategory[] = [
                        { id: genId(), name: 'Transportation (Internal)', planned: 0, actual: 0, color: '#3B82F6', icon: 'car', trip_id: currentTripId },
                        { id: genId(), name: 'Travel - Train/Bus', planned: 1980, actual: 0, color: '#8B5CF6', icon: 'plane', trip_id: currentTripId },
                        { id: genId(), name: 'Activities Fun World', planned: 4497, actual: 4497, color: '#10B981', icon: 'ticket', trip_id: currentTripId },
                        { id: genId(), name: 'Turf', planned: 1000, actual: 0, color: '#F59E0B', icon: 'trophy', trip_id: currentTripId },
                        { id: genId(), name: 'Food Friday Night', planned: 400, actual: 0, color: '#EF4444', icon: 'utensils', trip_id: currentTripId },
                        { id: genId(), name: 'Food Saturday', planned: 2100, actual: 0, color: '#EF4444', icon: 'utensils', trip_id: currentTripId },
                        { id: genId(), name: 'Food Sunday', planned: 2100, actual: 0, color: '#EF4444', icon: 'utensils', trip_id: currentTripId },
                        { id: genId(), name: 'Food Monday', planned: 2100, actual: 0, color: '#EF4444', icon: 'utensils', trip_id: currentTripId },
                        { id: genId(), name: 'Tickets/Entry', planned: 0, actual: 0, color: '#06B6D4', icon: 'ticket', trip_id: currentTripId },
                        { id: genId(), name: 'Drinks/Beverages', planned: 0, actual: 0, color: '#EC4899', icon: 'coffee', trip_id: currentTripId },
                        { id: genId(), name: 'Emergency/Medical', planned: 500, actual: 0, color: '#DC2626', icon: 'alert', trip_id: currentTripId },
                        { id: genId(), name: 'Entertainment', planned: 0, actual: 0, color: '#A855F7', icon: 'music', trip_id: currentTripId },
                        { id: genId(), name: 'Tips/Service', planned: 0, actual: 0, color: '#84CC16', icon: 'heart', trip_id: currentTripId },
                        { id: genId(), name: 'Souvenirs/Gifts', planned: 0, actual: 0, color: '#F97316', icon: 'gift', trip_id: currentTripId },
                    ];

                    set({ categories: defaultCategories });

                    await Promise.all(
                        defaultCategories.map(cat =>
                            supabase.from('categories').insert(categoryToDb(cat))
                        )
                    );
                }

                // Step 7: Sync Expenses (DB-first)
                if (dbExpenses && dbExpenses.length > 0) {
                    set({ expenses: dbExpenses.map(dbToExpense) });
                    console.log('[Sync] Loaded', dbExpenses.length, 'expenses from DB');
                } else {
                    set({ expenses: [] });
                }

                // Step 8: Subscribe to real-time updates
                supabase
                    .channel('public:data')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, payload => {
                        if (payload.eventType === 'INSERT') {
                            // Only add if not already in local state (prevents duplicate from optimistic update)
                            set(s => {
                                const exists = s.members.some(m => m.id === payload.new.id);
                                return exists ? s : { members: [...s.members, dbToMember(payload.new)] };
                            });
                        }
                        if (payload.eventType === 'UPDATE') set(s => ({ members: s.members.map(m => m.id === payload.new.id ? dbToMember(payload.new) : m) }));
                        if (payload.eventType === 'DELETE') set(s => ({ members: s.members.filter(m => m.id !== payload.old.id) }));
                    })
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, payload => {
                        if (payload.eventType === 'INSERT') {
                            set(s => {
                                const exists = s.categories.some(c => c.id === payload.new.id);
                                return exists ? s : { categories: [...s.categories, dbToCategory(payload.new)] };
                            });
                        }
                        if (payload.eventType === 'UPDATE') set(s => ({ categories: s.categories.map(c => c.id === payload.new.id ? dbToCategory(payload.new) : c) }));
                        if (payload.eventType === 'DELETE') set(s => ({ categories: s.categories.filter(c => c.id !== payload.old.id) }));
                    })
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, payload => {
                        if (payload.eventType === 'INSERT') {
                            set(s => {
                                const exists = s.expenses.some(e => e.id === payload.new.id);
                                return exists ? s : { expenses: [dbToExpense(payload.new), ...s.expenses] };
                            });
                        }
                        if (payload.eventType === 'UPDATE') set(s => ({ expenses: s.expenses.map(e => e.id === payload.new.id ? dbToExpense(payload.new) : e) }));
                        if (payload.eventType === 'DELETE') set(s => ({ expenses: s.expenses.filter(e => e.id !== payload.old.id) }));
                    })
                    .subscribe();

                console.log('[Sync] Real-time subscription active');
            },

            addMember: async (name) => {
                if (!name || name.trim() === '') { console.error("Validation Error: Name cannot be empty"); return; }
                const newMember: Member = { id: genId(), name, planned: 3000, given: 0, trip_id: get().tripId! };
                set(s => ({ members: [...s.members, newMember] }));
                const { error } = await supabase.from('members').insert(memberToDb(newMember));
                if (error) console.error('[DB] addMember failed:', error);
            },
            updateMember: async (id, data) => {
                if (data.name !== undefined && data.name.trim() === '') { console.error("Validation Error: Name cannot be empty"); return; }
                if (data.planned !== undefined && data.planned < 0) { console.error("Validation Error: Planned amount cannot be negative"); return; }
                if (data.given !== undefined && data.given < 0) { console.error("Validation Error: Given amount cannot be negative"); return; }

                set(s => ({ members: s.members.map(m => m.id === id ? { ...m, ...data } : m) }));
                // Map partial data for DB update
                const dbData: any = {};
                if (data.planned !== undefined) dbData.planned_amount = data.planned;
                if (data.given !== undefined) dbData.given_amount = data.given;
                if (data.name !== undefined) dbData.name = data.name;
                const { error } = await supabase.from('members').update(dbData).eq('id', id);
                if (error) console.error('[DB] updateMember failed:', error);
            },
            deleteMember: async (id) => {
                set(s => ({ members: s.members.filter(m => m.id !== id) }));
                const { error } = await supabase.from('members').delete().eq('id', id);
                if (error) console.error('[DB] deleteMember failed:', error);
            },

            addCategory: async (name, planned, color, icon) => {
                if (!name || name.trim() === '') { console.error("Validation Error: Category name cannot be empty"); return; }
                if (planned < 0) { console.error("Validation Error: Planned amount cannot be negative"); return; }

                const newCat: ExpenseCategory = { id: genId(), name, planned, actual: 0, color, icon, trip_id: get().tripId! };
                set(s => ({ categories: [...s.categories, newCat] }));
                await supabase.from('categories').insert(categoryToDb(newCat));
            },
            updateCategory: async (id, data) => {
                if (data.name !== undefined && data.name.trim() === '') { console.error("Validation Error: Category name cannot be empty"); return; }
                if (data.planned !== undefined && data.planned < 0) { console.error("Validation Error: Planned amount cannot be negative"); return; }
                if (data.actual !== undefined && data.actual < 0) { console.error("Validation Error: Actual amount cannot be negative"); return; }

                set(s => ({ categories: s.categories.map(c => c.id === id ? { ...c, ...data } : c) }));
                // Map partial data for DB update
                const dbData: any = {};
                if (data.planned !== undefined) dbData.planned_amount = data.planned;
                if (data.actual !== undefined) dbData.actual_amount = data.actual;
                if (data.name !== undefined) dbData.name = data.name;
                if (data.color !== undefined) dbData.color = data.color;
                if (data.icon !== undefined) dbData.icon = data.icon;
                await supabase.from('categories').update(dbData).eq('id', id);
            },
            deleteCategory: async (id) => {
                set(s => ({ categories: s.categories.filter(c => c.id !== id) }));
                await supabase.from('categories').delete().eq('id', id);
            },

            addExpense: async (expense) => {
                if (!expense.title || expense.title.trim() === '') { console.error("Validation Error: Title cannot be empty"); return; }
                if (expense.amount < 0) { console.error("Validation Error: Amount cannot be negative"); return; }
                if (!expense.categoryId) { console.error("Validation Error: Category must be selected"); return; }

                const newInfo: Expense = { ...expense, id: genId(), trip_id: get().tripId! };
                // Optimistic update
                set(state => {
                    const updatedCategories = state.categories.map(c =>
                        c.id === expense.categoryId ? { ...c, actual: c.actual + expense.amount } : c
                    );
                    return { expenses: [newInfo, ...state.expenses], categories: updatedCategories };
                });
                await supabase.from('expenses').insert(expenseToDb(newInfo));

                // Update DB Category
                const currentCat = get().categories.find(c => c.id === expense.categoryId);
                if (currentCat) {
                    await supabase.from('categories').update({ actual_amount: currentCat.actual }).eq('id', expense.categoryId);
                }
            },
            updateExpense: async (id, data) => {
                if (data.title !== undefined && data.title.trim() === '') { console.error("Validation Error: Title cannot be empty"); return; }
                if (data.amount !== undefined && data.amount < 0) { console.error("Validation Error: Amount cannot be negative"); return; }

                const oldExp = get().expenses.find(e => e.id === id);
                if (oldExp && data.amount !== undefined && data.amount !== oldExp.amount) {
                    const diff = data.amount - oldExp.amount;
                    // Update Local
                    set(state => {
                        const updatedCategories = state.categories.map(c =>
                            c.id === oldExp.categoryId ? { ...c, actual: c.actual + diff } : c
                        );
                        const updatedExpenses = state.expenses.map(e => e.id === id ? { ...e, ...data } : e);
                        return { expenses: updatedExpenses, categories: updatedCategories };
                    });

                    // Update DB Category
                    const currentCat = get().categories.find(c => c.id === oldExp.categoryId);
                    if (currentCat) {
                        await supabase.from('categories').update({ actual_amount: currentCat.actual }).eq('id', oldExp.categoryId);
                    }
                } else {
                    // Simple update
                    set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...data } : e) }));
                }
                // Map partial data for DB update
                const dbData: any = {};
                if (data.title !== undefined) dbData.title = data.title;
                if (data.amount !== undefined) dbData.amount = data.amount;
                if (data.categoryId !== undefined) dbData.category_id = data.categoryId;
                if (data.paidBy !== undefined) dbData.paid_by = data.paidBy;
                await supabase.from('expenses').update(dbData).eq('id', id);
            },
            deleteExpense: async (id) => {
                const exp = get().expenses.find(e => e.id === id);
                if (exp) {
                    // Decrement from local state first
                    set(state => {
                        const updatedCategories = state.categories.map(c =>
                            c.id === exp.categoryId ? { ...c, actual: c.actual - exp.amount } : c
                        );
                        return { expenses: state.expenses.filter(e => e.id !== id), categories: updatedCategories };
                    });

                    // Update DB
                    await supabase.from('expenses').delete().eq('id', id);
                    const currentCat = get().categories.find(c => c.id === exp.categoryId);
                    if (currentCat) {
                        await supabase.from('categories').update({ actual: currentCat.actual - exp.amount }).eq('id', exp.categoryId);
                    }
                } else {
                    await supabase.from('expenses').delete().eq('id', id);
                    get().initSync();
                }
            },
            // Stub implementations for timeline (no table info provided/verified)
            addEvent: async (e) => set(s => ({ timeline: [...s.timeline, { ...e, id: genId() }] })),
            updateEvent: async (id, d) => set(s => ({ timeline: s.timeline.map(tn => tn.id === id ? { ...tn, ...d } : tn) })),
            deleteEvent: async (id) => set(s => ({ timeline: s.timeline.filter(t => t.id !== id) })),

            setTripDates: async (start, end) => {
                set({ tripStartDate: start, tripEndDate: end });
                if (get().tripId) await supabase.from('trips').update({ start_date: start, end_date: end }).eq('id', get().tripId);
            },

            getTotalPlanned: () => get().categories.reduce((sum, c) => sum + c.planned, 0),
            getTotalMemberPlanned: () => get().members.reduce((sum, m) => sum + m.planned, 0),
            getTotalActual: () => get().categories.reduce((sum, c) => sum + c.actual, 0),
            getTotalGiven: () => get().members.reduce((sum, m) => sum + m.given, 0),
            getMemberBalance: (memberId) => {
                const member = get().members.find(m => m.id === memberId);
                return member ? member.given - member.planned : 0;
            },

            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'boys-trip-2026',
            // CRITICAL: Only persist UI state, NOT data!
            // Database is the source of truth for members, categories, expenses
            partialize: (state) => ({
                sortColumn: state.sortColumn,
                sortDirection: state.sortDirection,
                _hasHydrated: state._hasHydrated,
                // Do NOT persist: members, categories, expenses, timeline
                // These come from the database via initSync
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);
