"use client";

import { useState } from "react";
import { useTripStore } from "@/stores/tripStore";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus, MapPin, Calendar, Trash2 } from "lucide-react";
import { NewTripModal } from "./NewTripModal";
import { cn } from "@/lib/utils";

export function TripSelector() {
    const store = useTripStore();
    const [isNewTripOpen, setIsNewTripOpen] = useState(false);

    const handleDelete = (e: React.MouseEvent, tripId: string, tripName: string) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${tripName}"? This cannot be undone.`)) {
            store.deleteTrip(tripId);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className="w-full justify-between px-3 py-6 bg-black/80 hover:bg-black/90 backdrop-blur-md group border border-white/10 hover:border-white/20 transition-all rounded-xl shadow-lg"
                    >
                        <div className="text-left overflow-hidden">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5 group-hover:text-blue-400 transition-colors">Current Trip</p>
                            <div className="font-bold truncate text-base">{store.tripName || "Select a Trip"}</div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-background/95 backdrop-blur-xl border-border/50" align="start" sideOffset={8}>
                    <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-3 py-2">
                        Your Trips
                    </DropdownMenuLabel>

                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {store.trips.map((trip) => (
                            <DropdownMenuItem
                                key={trip.id}
                                onClick={() => store.setCurrentTrip(trip.id)}
                                className={cn(
                                    "px-3 py-3 cursor-pointer mb-1 rounded-lg group",
                                    store.tripId === trip.id ? "bg-accent" : "hover:bg-accent/50"
                                )}
                            >
                                <div className="flex flex-col gap-1 flex-1 overflow-hidden">
                                    <span className={cn("font-medium truncate", store.tripId === trip.id && "text-blue-500")}>
                                        {trip.name}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(trip.startDate).getFullYear()}
                                        </span>
                                    </div>
                                </div>
                                {store.tripId === trip.id && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ml-2" />
                                )}
                                <button
                                    onClick={(e) => handleDelete(e, trip.id, trip.name)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-500 rounded transition-all ml-1"
                                    title="Delete Trip"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </DropdownMenuItem>
                        ))}
                    </div>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onSelect={() => setIsNewTripOpen(true)}
                        className="cursor-pointer text-blue-500 font-medium hover:text-blue-600 focus:text-blue-600 gap-2 py-3"
                    >
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10">
                            <Plus className="w-4 h-4" />
                        </div>
                        Create New Trip
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <NewTripModal
                isOpen={isNewTripOpen}
                onClose={() => setIsNewTripOpen(false)}
            />
        </>
    );
}
