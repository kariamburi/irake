"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
    setValue: (name: "interests", value: string[]) => void;
    selectedInterests: string[];
};

const availableInterests = [
    // Arts & Entertainment
    "Music", "Movies", "Photography", "Drawing", "Painting", "Acting", "Dancing", "Singing", "Writing", "Poetry",
    "Podcasting", "Blogging", "YouTubing", "Theater",
    // Outdoors & Adventure
    "Travel", "Hiking", "Camping", "Backpacking", "Climbing", "Fishing", "Hunting", "Bird Watching",
    "Beach", "Road Trips", "Nature Walks", "Stargazing", "Exploring",
    // Sports & Fitness
    "Fitness", "Gym", "Running", "Cycling", "Yoga", "Swimming", "Football", "Basketball", "Tennis",
    "Martial Arts", "Skating", "Skiing", "Surfing",
    // Games & Tech
    "Gaming", "Board Games", "Card Games", "Chess", "Esports", "Coding", "Tech Gadgets", "Robotics", "AI", "Crypto",
    // Food & Drink
    "Cooking", "Baking", "Foodie", "Coffee", "Wine Tasting", "Beer Tasting", "Vegan Lifestyle", "Mixology",
    // Learning & Culture
    "Reading", "History", "Philosophy", "Psychology", "Science", "Languages", "Self-Improvement", "Museums", "Documentaries",
    // Fashion & Lifestyle
    "Fashion", "Makeup", "Skincare", "Shopping", "Interior Design", "DIY", "Minimalism", "Thrifting", "Vintage",
    // Social Causes & Others
    "Volunteering", "Environment", "Animal Rights", "Meditation", "Spirituality", "Religion", "Astrology", "Zodiac Signs"
];

export function InterestsSelector({ setValue, selectedInterests }: Props) {
    const [inputValue, setInputValue] = useState("");

    const handleAddInterest = (interest: string) => {
        if (selectedInterests.includes(interest) || selectedInterests.length >= 5) return;
        setValue("interests", [...selectedInterests, interest]);
        setInputValue("");
    };

    const handleRemove = (interest: string) => {
        setValue("interests", selectedInterests.filter((i) => i !== interest));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const suggestions = availableInterests.filter(
        (item) =>
            item.toLowerCase().includes(inputValue.toLowerCase()) &&
            !selectedInterests.includes(item)
    );

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                Interests (max 5)
            </label>

            <div className="flex flex-wrap gap-2 border rounded p-2 min-h-[40px]">
                <AnimatePresence>
                    {selectedInterests.map((item) => (
                        <motion.div
                            key={item}
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.7, opacity: 0 }}
                            className="bg-pink-100 text-pink-600 px-3 py-1 rounded-full flex items-center gap-2 cursor-pointer hover:bg-pink-200"
                            onClick={() => handleRemove(item)}
                        >
                            {item}
                            <span className="text-xs">✕</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <input
                type="text"
                placeholder="Type to add interest..."
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && inputValue.trim()) {
                        e.preventDefault();
                        handleAddInterest(inputValue.trim());
                    }
                }}
                className="w-full border px-3 py-2 rounded"
                disabled={selectedInterests.length >= 5}
            />

            {inputValue && suggestions.length > 0 && (
                <ul className="border bg-white rounded mt-1 shadow text-sm max-h-40 overflow-auto">
                    {suggestions.map((sug) => (
                        <li
                            key={sug}
                            onClick={() => handleAddInterest(sug)}
                            className="px-4 py-2 hover:bg-pink-100 cursor-pointer"
                        >
                            {sug}
                        </li>
                    ))}
                </ul>
            )}

            {selectedInterests.length >= 5 && (
                <p className="text-sm text-red-500 mt-1">Max 5 interests allowed.</p>
            )}
        </div>
    );
}
