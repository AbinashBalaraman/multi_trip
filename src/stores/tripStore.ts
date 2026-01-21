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

// Trip Mapper
const dbToTrip = (row: any): Trip => ({
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
});

// Types
export interface Trip {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
}

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
    isLoading: boolean;

    // Trip Info
    tripName: string;
    startingBalance: number;
    currency: string;
    tripStartDate: string;
    tripEndDate: string;

    // Data
    trips: Trip[];
    members: Member[];
    categories: ExpenseCategory[];
    expenses: Expense[];
    timeline: TimelineEvent[];

    // Sync Action
    initSync: () => Promise<void>;
    setHasHydrated: (state: boolean) => void;

    // Trip Actions
    fetchTrips: () => Promise<void>;
    setCurrentTrip: (tripId: string) => Promise<void>;
    createTrip: (name: string, startDate: string, endDate: string) => Promise<void>;
    deleteTrip: (tripId: string) => Promise<void>;

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
            isLoading: false,
            tripName: '',
            startingBalance: 0,
            currency: 'INR',
            tripStartDate: '',
            tripEndDate: '',
            trips: [], // List of all trips
            members: [],
            categories: [],
            expenses: [],
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
                set({ isLoading: true });
                
                // Step 1: Fetch all trips
                await get().fetchTrips();
                const allTrips = get().trips;
                const currentId = get().tripId;

                let tripToLoad = null;

                if (allTrips.length > 0) {
                    // If we have a stored tripId and it exists, use it
                    if (currentId && allTrips.find(t => t.id === currentId)) {
                        tripToLoad = allTrips.find(t => t.id === currentId);
                    } else {
                        // Otherwise use the first one
                        tripToLoad = allTrips[0];
                    }
                } else {
                    // No trips exist - Create Default
                    await get().createTrip('Mysore and Bangalore Mini Trip', '2026-01-24', '2026-01-27');
                    
                    // After creating, fetch again to get the ID and data
                    await get().fetchTrips();
                    if (get().trips.length > 0) {
                        tripToLoad = get().trips[0];
                        
                        // Seed default data for this new trip (Only for the very first default trip)
                        // This logic is a bit implicit, but preserves original behavior for fresh install
                        const tripId = tripToLoad.id;
                        
                        // Seed Members
                        const defaultMembers: Member[] = [
                            { id: genId(), name: 'Sandy', planned: 3000, given: 2000, trip_id: tripId },
                            { id: genId(), name: 'Vicky', planned: 3000, given: 2000, trip_id: tripId },
                            { id: genId(), name: 'Abi', planned: 3000, given: 2000, trip_id: tripId },
                            { id: genId(), name: 'Lachu', planned: 3000, given: 2000, trip_id: tripId },
                            { id: genId(), name: 'Yuva', planned: 3000, given: 2000, trip_id: tripId },
                            { id: genId(), name: 'Kalai', planned: 3000, given: 2000, trip_id: tripId },
                            { id: genId(), name: 'Karthi', planned: 3000, given: 2000, trip_id: tripId },
                        ];
                        await Promise.all(defaultMembers.map(mem => supabase.from('members').insert(memberToDb(mem))));
                        
                        // Seed Categories
                        const defaultCategories: ExpenseCategory[] = [
                            { id: genId(), name: 'Transportation (Internal)', planned: 0, actual: 0, color: '#3B82F6', icon: 'car', trip_id: tripId },
                            { id: genId(), name: 'Travel - Train/Bus', planned: 1980, actual: 0, color: '#8B5CF6', icon: 'plane', trip_id: tripId },
                            { id: genId(), name: 'Activities Fun World', planned: 4497, actual: 4497, color: '#10B981', icon: 'ticket', trip_id: tripId },
                            { id: genId(), name: 'Turf', planned: 1000, actual: 0, color: '#F59E0B', icon: 'trophy', trip_id: tripId },
                            { id: genId(), name: 'Food Friday Night', planned: 400, actual: 0, color: '#EF4444', icon: 'utensils', trip_id: tripId },
                            { id: genId(), name: 'Food Saturday', planned: 2100, actual: 0, color: '#EF4444', icon: 'utensils', trip_id: tripId },
                            { id: genId(), name: 'Food Sunday', planned: 2100, actual: 0, color: '#EF4444', icon: 'utensils', trip_id: tripId },
                            { id: genId(), name: 'Food Monday', planned: 2100, actual: 0, color: '#EF4444', icon: 'utensils', trip_id: tripId },
                            { id: genId(), name: 'Tickets/Entry', planned: 0, actual: 0, color: '#06B6D4', icon: 'ticket', trip_id: tripId },
                            { id: genId(), name: 'Drinks/Beverages', planned: 0, actual: 0, color: '#EC4899', icon: 'coffee', trip_id: tripId },
                            { id: genId(), name: 'Emergency/Medical', planned: 500, actual: 0, color: '#DC2626', icon: 'alert', trip_id: tripId },
                            { id: genId(), name: 'Entertainment', planned: 0, actual: 0, color: '#A855F7', icon: 'music', trip_id: tripId },
                            { id: genId(), name: 'Tips/Service', planned: 0, actual: 0, color: '#84CC16', icon: 'heart', trip_id: tripId },
                            { id: genId(), name: 'Souvenirs/Gifts', planned: 0, actual: 0, color: '#F97316', icon: 'gift', trip_id: tripId },
                        ];
                        await Promise.all(defaultCategories.map(cat => supabase.from('categories').insert(categoryToDb(cat))));
                    }
                }

                if (tripToLoad) {
                    await get().setCurrentTrip(tripToLoad.id);
                } else {
                    set({ isLoading: false });
                }

                // Step 8: Subscribe to real-time updates (Global subscription for simplicity, but filtering by tripId would be better if dynamic)
                // For now, let's keep it simple and just listen to tables. 
                // Note: Better to subscribe in setCurrentTrip to filter by ID, but global is okay for small scale.
                // We'll stick to store-level subscription being global for now but checking trip_id in handler
                const setupSubscription = () => {
                    supabase
                    .channel('public:data')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, payload => {
                        const currentTripId = get().tripId;
                        if (!currentTripId) return;
                        
                        // Only process if it belongs to current trip
                        const record = (payload.new || payload.old) as any;
                        if (record.trip_id !== currentTripId) return;

                        if (payload.eventType === 'INSERT') {
                            set(s => {
                                const exists = s.members.some(m => m.id === payload.new.id);
                                return exists ? s : { members: [...s.members, dbToMember(payload.new)] };
                            });
                        }
                        if (payload.eventType === 'UPDATE') set(s => ({ members: s.members.map(m => m.id === payload.new.id ? dbToMember(payload.new) : m) }));
                        if (payload.eventType === 'DELETE') set(s => ({ members: s.members.filter(m => m.id !== payload.old.id) }));
                    })
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, payload => {
                        const currentTripId = get().tripId;
                        if (!currentTripId) return;
                        const record = (payload.new || payload.old) as any;
                        if (record.trip_id !== currentTripId) return;

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
                         const currentTripId = get().tripId;
                        if (!currentTripId) return;
                        const record = (payload.new || payload.old) as any;
                        if (record.trip_id !== currentTripId) return;

                        if (payload.eventType === 'INSERT') {
                            set(s => {
                                const exists = s.expenses.some(e => e.id === payload.new.id);
                                return exists ? s : { expenses: [dbToExpense(payload.new), ...s.expenses] };
                            });
                        }
                        if (payload.eventType === 'UPDATE') set(s => ({ expenses: s.expenses.map(e => e.id === payload.new.id ? dbToExpense(payload.new) : e) }));
                        if (payload.eventType === 'DELETE') set(s => ({ expenses: s.expenses.filter(e => e.id !== payload.old.id) }));
                    })
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, async () => {
                         // Reload trips if any trip changes
                         await get().fetchTrips();
                    })
                    .subscribe();
                };
                
                setupSubscription();
                console.log('[Sync] Real-time subscription active');
            },

            fetchTrips: async () => {
                const { data, error } = await supabase.from('trips').select('*').order('created_at', { ascending: false });
                if (error) {
                    console.error('[DB] fetchTrips failed:', error);
                    return;
                }
                set({ trips: data.map(dbToTrip) });
            },

            setCurrentTrip: async (tripId: string) => {
                const trip = get().trips.find(t => t.id === tripId);
                if (!trip) {
                    console.error('Trip not found:', tripId);
                    return;
                }

                set({ 
                    tripId: tripId, 
                    tripName: trip.name, 
                    tripStartDate: trip.startDate, 
                    tripEndDate: trip.endDate,
                    isLoading: true 
                });

                // Fetch data for this trip
                const [membersRes, categoriesRes, expensesRes] = await Promise.all([
                    supabase.from('members').select('*').eq('trip_id', tripId),
                    supabase.from('categories').select('*').eq('trip_id', tripId),
                    supabase.from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false })
                ]);

                if (membersRes.data) set({ members: membersRes.data.map(dbToMember) });
                if (categoriesRes.data) set({ categories: categoriesRes.data.map(dbToCategory) });
                if (expensesRes.data) set({ expenses: expensesRes.data.map(dbToExpense) });
                
                set({ isLoading: false, isSynced: true });
            },

            createTrip: async (name, startDate, endDate) => {
                const { data, error } = await supabase
                    .from('trips')
                    .insert({ name, start_date: startDate, end_date: endDate })
                    .select()
                    .single();
                
                if (error) {
                    console.error('[DB] createTrip failed:', error);
                    throw error;
                }
                
                const newTrip = dbToTrip(data);
                set(s => ({ trips: [newTrip, ...s.trips] }));
                
                // Add default categories for new trip to be helpful
                const tripId = newTrip.id;
                const defaultCategories: ExpenseCategory[] = [
                    { id: genId(), name: 'Transportation', planned: 0, actual: 0, color: '#3B82F6', icon: 'car', trip_id: tripId },
                    { id: genId(), name: 'Food', planned: 0, actual: 0, color: '#EF4444', icon: 'utensils', trip_id: tripId },
                    { id: genId(), name: 'Accommodation', planned: 0, actual: 0, color: '#F59E0B', icon: 'trophy', trip_id: tripId }, // trophy icon as 'hotel' mapped in component
                    { id: genId(), name: 'Activities', planned: 0, actual: 0, color: '#10B981', icon: 'ticket', trip_id: tripId },
                ];
                
                await Promise.all(defaultCategories.map(cat => supabase.from('categories').insert(categoryToDb(cat))));
                
                // Switch to new trip
                await get().setCurrentTrip(newTrip.id);
            },

            deleteTrip: async (tripId) => {
                const { error } = await supabase.from('trips').delete().eq('id', tripId);
                if (error) {
                    console.error('[DB] deleteTrip failed:', error);
                    return;
                }
                
                set(s => ({ trips: s.trips.filter(t => t.id !== tripId) }));
                
                // If deleted current trip, switch to another one
                if (get().tripId === tripId) {
                    const remainingTrips = get().trips;
                    if (remainingTrips.length > 0) {
                        await get().setCurrentTrip(remainingTrips[0].id);
                    } else {
                         // Reset state if no trips left
                         set({ 
                             tripId: null, 
                             tripName: '', 
                             members: [], 
                             categories: [], 
                             expenses: [] 
                         });
                    }
                }
            },

            addMember: async (name) => {
                if (!get().tripId) return;
                if (!name || name.trim() === '') { console.error("Validation Error: Name cannot be empty"); return; }
                const newMember: Member = { id: genId(), name, planned: 0, given: 0, trip_id: get().tripId! };
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
                if (!get().tripId) return;
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
                if (!get().tripId) return;
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
                        await supabase.from('categories').update({ actual_amount: currentCat.actual }).eq('id', exp.categoryId);
                    }
                } else {
                    await supabase.from('expenses').delete().eq('id', id);
                    get().setCurrentTrip(get().tripId!); // reload to stay in sync
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
                tripId: state.tripId, // Persist current trip ID
                // Do NOT persist: members, categories, expenses, timeline, trips (fetch trips fresh)
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);
