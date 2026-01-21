"use client";

import { useState } from "react";
import { useTripStore } from "@/stores/tripStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewTripModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NewTripModal({ isOpen, onClose }: NewTripModalProps) {
    const store = useTripStore();
    const [name, setName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !startDate || !endDate) return;

        setIsLoading(true);
        try {
            await store.createTrip(name, startDate, endDate);
            onClose();
            // Reset form
            setName("");
            setStartDate("");
            setEndDate("");
        } catch (error) {
            console.error("Failed to create trip:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <Card className="w-full max-w-md relative z-10 bg-background/95 border-purple-500/20 shadow-2xl animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-1 rounded-full hover:bg-accent transition-colors"
                >
                    <X className="w-5 h-5 text-muted-foreground" />
                </button>

                <CardHeader>
                    <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                        Plan New Adventure
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="tripName">Trip Name</Label>
                            <Input
                                id="tripName"
                                placeholder="e.g. Goa Trip 2026"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Start Date</Label>
                                <div className="relative">
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="endDate">End Date</Label>
                                <div className="relative">
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3 justify-end">
                            <Button type="button" variant="ghost" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={!name || !startDate || !endDate || isLoading}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02]"
                            >
                                {isLoading ? "Creating..." : "Create Trip"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
